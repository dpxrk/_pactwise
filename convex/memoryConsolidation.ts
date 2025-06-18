// convex/memoryConsolidation.ts
import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// ============================================================================
// MEMORY CONSOLIDATION SYSTEM
// ============================================================================

// Trigger memory consolidation for a user
export const triggerConsolidation = mutation({
  args: {
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) throw new Error("User not found");

    // Get memories to consolidate
    let memories = await ctx.db
      .query("shortTermMemory")
      .withIndex("by_enterprise_user", (q) => 
        q.eq("enterpriseId", user.enterpriseId).eq("userId", user._id)
      )
      .filter((q) => 
        q.and(
          q.eq(q.field("shouldConsolidate"), true),
          q.eq(q.field("consolidatedAt"), undefined)
        )
      )
      .collect();

    if (args.sessionId) {
      memories = memories.filter(m => m.sessionId === args.sessionId);
    }

    if (memories.length === 0) {
      return { message: "No memories to consolidate" };
    }

    // Create consolidation job
    const jobId = await ctx.db.insert("memoryConsolidationJobs", {
      status: "pending",
      userId: user._id,
      enterpriseId: user.enterpriseId,
      shortTermMemoryIds: memories.map(m => m._id),
      memoriesProcessed: 0,
      memoriesConsolidated: 0,
      patternsFound: 0,
    });

    // Schedule the consolidation directly since processConsolidationJob is in the same file
    await ctx.scheduler.runAfter(0, internal.memoryConsolidation.processConsolidationJob, {
      jobId,
    });

    return { jobId, memoryCount: memories.length };
  },
});

// Internal function to process consolidation job
export const processConsolidationJob = internalMutation({
  args: {
    jobId: v.id("memoryConsolidationJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status !== "pending") return;

    await ctx.db.patch(args.jobId, {
      status: "processing",
      startedAt: new Date().toISOString(),
    });

    try {
      const shortTermMemories = await Promise.all(
        job.shortTermMemoryIds.map(id => ctx.db.get(id))
      );

      const validMemories = shortTermMemories.filter(m => m !== null) as Doc<"shortTermMemory">[];
      
      // Group memories by type and context
      const memoryGroups = groupMemoriesByTypeAndContext(validMemories);
      
      const createdLongTermMemoryIds: Id<"longTermMemory">[] = [];
      let patternsFound = 0;

      for (const group of memoryGroups) {
        const consolidatedMemory = await consolidateMemoryGroup(ctx, group, job.userId, job.enterpriseId);
        if (consolidatedMemory) {
          createdLongTermMemoryIds.push(consolidatedMemory.id);
          if (consolidatedMemory.patterns > 0) {
            patternsFound += consolidatedMemory.patterns;
          }
        }
      }

      // Mark all processed memories as consolidated
      const now = new Date().toISOString();
      for (const memory of validMemories) {
        await ctx.db.patch(memory._id, {
          consolidatedAt: now,
        });
      }

      // Update job status
      await ctx.db.patch(args.jobId, {
        status: "completed",
        completedAt: now,
        createdLongTermMemoryIds,
        memoriesProcessed: validMemories.length,
        memoriesConsolidated: createdLongTermMemoryIds.length,
        patternsFound,
      });

    } catch (error) {
      await ctx.db.patch(args.jobId, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

// Group memories by type and context for intelligent consolidation
function groupMemoriesByTypeAndContext(
  memories: Doc<"shortTermMemory">[]
): Doc<"shortTermMemory">[][] {
  const groups = new Map<string, Doc<"shortTermMemory">[]>();

  for (const memory of memories) {
    // Create grouping key based on type and main context
    const contextKey = [
      memory.context.contractId,
      memory.context.vendorId,
      memory.context.taskId,
    ].filter(Boolean).join("-");
    
    const groupKey = `${memory.memoryType}-${contextKey || "general"}`;
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(memory);
  }

  return Array.from(groups.values());
}

// Consolidate a group of related memories
async function consolidateMemoryGroup(
  ctx: any,
  memories: Doc<"shortTermMemory">[],
  userId: Id<"users">,
  enterpriseId: Id<"enterprises">
): Promise<{ id: Id<"longTermMemory">; patterns: number } | null> {
  if (memories.length === 0) return null;

  // Analyze the memory group
  const analysis = analyzeMemoryGroup(memories);
  
  // Skip if confidence is too low
  if (analysis.confidence < 0.5) return null;

  // Extract common context
  const commonContext = extractCommonContext(memories);
  
  // Create consolidated memory
  const memoryId = await ctx.db.insert("longTermMemory", {
    userId,
    enterpriseId,
    memoryType: memories[0]?.memoryType || "domain_knowledge",
    content: analysis.consolidatedContent,
    structuredData: analysis.structuredData,
    summary: analysis.summary,
    keywords: analysis.keywords,
    context: {
      domain: analysis.domain,
      relatedMemories: [],
      contractIds: commonContext.contractIds,
      vendorIds: commonContext.vendorIds,
      tags: analysis.tags,
    },
    importance: analysis.importance,
    strength: analysis.strength,
    reinforcementCount: memories.length - 1,
    decayRate: calculateDecayRate(analysis.importance),
    accessCount: memories.reduce((sum, m) => sum + m.accessCount, 0),
    lastAccessedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    consolidatedFrom: memories.map(m => m._id),
    confidence: analysis.confidence,
    isVerified: false,
    source: determinePrimarySource(memories),
    sourceChain: memories.map(m => `${m.source}: ${m.createdAt}`),
  });

  // Create associations between related patterns
  if (analysis.patterns.length > 0) {
    await createPatternAssociations(ctx, memoryId, analysis.patterns);
  }

  return { id: memoryId, patterns: analysis.patterns.length };
}

// Analyze a group of memories to extract patterns and insights
function analyzeMemoryGroup(memories: Doc<"shortTermMemory">[]) {
  const contents = memories.map(m => m.content);
  const allKeywords = new Set<string>();
  const importanceCounts = new Map<string, number>();
  
  // Count importance levels
  memories.forEach(m => {
    importanceCounts.set(m.importance, (importanceCounts.get(m.importance) || 0) + 1);
  });
  
  // Determine consolidated importance (highest that appears frequently)
  const importance = determineConsolidatedImportance(importanceCounts);
  
  // Extract patterns
  const patterns = extractPatterns(memories);
  
  // Generate consolidated content
  const consolidatedContent = generateConsolidatedContent(memories, patterns);
  
  // Extract keywords from all memories
  contents.forEach(content => {
    extractKeywords(content).forEach(keyword => allKeywords.add(keyword));
  });
  
  // Calculate confidence based on consistency
  const confidence = calculateGroupConfidence(memories);
  
  // Determine domain from context
  const domain = extractDomain(memories);
  
  return {
    consolidatedContent,
    summary: generateSummary(consolidatedContent, patterns),
    keywords: Array.from(allKeywords).slice(0, 20),
    importance,
    strength: calculateInitialStrength(importance),
    confidence,
    patterns,
    domain,
    tags: extractTags(memories),
    structuredData: mergeStructuredData(memories),
  };
}

// Extract patterns from memories
function extractPatterns(memories: Doc<"shortTermMemory">[]): string[] {
  const patterns: string[] = [];
  
  // Look for repeated concepts
  const conceptCounts = new Map<string, number>();
  memories.forEach(m => {
    const concepts = extractConcepts(m.content);
    concepts.forEach(concept => {
      conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
    });
  });
  
  // Patterns are concepts that appear in multiple memories
  conceptCounts.forEach((count, concept) => {
    if (count >= Math.min(3, memories.length * 0.5)) {
      patterns.push(concept);
    }
  });
  
  return patterns;
}

// Generate consolidated content from memories and patterns
function generateConsolidatedContent(
  memories: Doc<"shortTermMemory">[],
  patterns: string[]
): string {
  // Sort memories by importance and confidence
  const sortedMemories = [...memories].sort((a, b) => {
    const importanceOrder = ["critical", "high", "medium", "low", "temporary"];
    const aIdx = importanceOrder.indexOf(a.importance);
    const bIdx = importanceOrder.indexOf(b.importance);
    if (aIdx !== bIdx) return aIdx - bIdx;
    return b.confidence - a.confidence;
  });
  
  // Start with the most important memory
  let consolidated = sortedMemories[0]?.content || "";
  
  // Add unique information from other memories
  for (let i = 1; i < sortedMemories.length; i++) {
    const additionalInfo = extractUniqueInformation(
      sortedMemories[i]?.content || "",
      consolidated
    );
    if (additionalInfo) {
      consolidated += ` ${additionalInfo}`;
    }
  }
  
  // Add pattern summary if patterns found
  if (patterns.length > 0) {
    consolidated += ` Key patterns: ${patterns.join(", ")}.`;
  }
  
  return consolidated;
}

// Extract common context from memories
function extractCommonContext(memories: Doc<"shortTermMemory">[]) {
  const contractIds = new Set<Id<"contracts">>();
  const vendorIds = new Set<Id<"vendors">>();
  
  memories.forEach(m => {
    if (m.context.contractId) contractIds.add(m.context.contractId);
    if (m.context.vendorId) vendorIds.add(m.context.vendorId);
  });
  
  return {
    contractIds: Array.from(contractIds),
    vendorIds: Array.from(vendorIds),
  };
}

// Create associations for discovered patterns
async function createPatternAssociations(
  ctx: any,
  memoryId: Id<"longTermMemory">,
  patterns: string[]
) {
  // This would create associations with other memories containing similar patterns
  // For now, we'll skip the implementation
}

// Helper functions
function determineConsolidatedImportance(
  importanceCounts: Map<string, number>
): string {
  const levels = ["critical", "high", "medium", "low", "temporary"];
  
  // Find the highest importance level that appears in at least 30% of memories
  for (const level of levels) {
    const count = importanceCounts.get(level) || 0;
    const total = Array.from(importanceCounts.values()).reduce((a, b) => a + b, 0);
    if (count / total >= 0.3) {
      return level;
    }
  }
  
  return "medium";
}

function calculateGroupConfidence(memories: Doc<"shortTermMemory">[]): number {
  const avgConfidence = memories.reduce((sum, m) => sum + m.confidence, 0) / memories.length;
  const consistencyBonus = memories.length > 3 ? 0.1 : 0;
  return Math.min(1, avgConfidence + consistencyBonus);
}

function extractDomain(memories: Doc<"shortTermMemory">[]): string {
  // Extract domain from memory types and content
  const memoryType = memories[0]?.memoryType || "domain_knowledge";
  
  switch (memoryType) {
    case "domain_knowledge":
      return "contract_management";
    case "user_preference":
      return "user_settings";
    case "task_history":
      return "task_execution";
    default:
      return "general";
  }
}

function extractTags(memories: Doc<"shortTermMemory">[]): string[] {
  const tags = new Set<string>();
  
  memories.forEach(m => {
    // Extract tags from memory type
    tags.add(m.memoryType);
    
    // Extract tags from source
    tags.add(m.source);
    
    // Add context-based tags
    if (m.context.contractId) tags.add("contract-related");
    if (m.context.vendorId) tags.add("vendor-related");
    if (m.context.taskId) tags.add("task-related");
  });
  
  return Array.from(tags);
}

function mergeStructuredData(memories: Doc<"shortTermMemory">[]): any {
  // Merge structured data from all memories
  const merged: any = {};
  
  memories.forEach(m => {
    if (m.structuredData) {
      Object.assign(merged, m.structuredData);
    }
  });
  
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function determinePrimarySource(memories: Doc<"shortTermMemory">[]): "explicit_feedback" | "implicit_learning" | "task_outcome" | "error_correction" | "conversation" | "system_observation" {
  // Count sources
  const sourceCounts = new Map<string, number>();
  memories.forEach(m => {
    sourceCounts.set(m.source, (sourceCounts.get(m.source) || 0) + 1);
  });
  
  // Return most common source
  let maxCount = 0;
  let primarySource: "explicit_feedback" | "implicit_learning" | "task_outcome" | "error_correction" | "conversation" | "system_observation" = memories[0]?.source || "system_observation";
  
  sourceCounts.forEach((count, source) => {
    if (count > maxCount) {
      maxCount = count;
      primarySource = source as typeof primarySource;
    }
  });
  
  return primarySource;
}

function extractConcepts(text: string): string[] {
  // Simple concept extraction - in production use NLP
  const words = text.toLowerCase().split(/\s+/);
  const concepts: string[] = [];
  
  // Look for noun phrases (simplified)
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i]?.length > 3 && words[i + 1]?.length > 3) {
      concepts.push(`${words[i]} ${words[i + 1]}`);
    }
  }
  
  return concepts;
}

function extractUniqueInformation(newContent: string, existingContent: string): string {
  const newWords = new Set(newContent.toLowerCase().split(/\s+/));
  const existingWords = new Set(existingContent.toLowerCase().split(/\s+/));
  
  const uniqueWords = Array.from(newWords).filter(w => !existingWords.has(w));
  
  if (uniqueWords.length < 3) return "";
  
  // Return sentences containing unique words
  const sentences = newContent.split(/[.!?]+/);
  const uniqueSentences = sentences.filter(sentence => {
    const sentenceWords = sentence.toLowerCase().split(/\s+/);
    return sentenceWords.some(w => uniqueWords.includes(w));
  });
  
  return uniqueSentences.slice(0, 2).join(". ");
}

function generateSummary(content: string, patterns: string[]): string {
  // Take first 200 chars and add patterns
  let summary = content.substring(0, 200);
  if (content.length > 200) summary += "...";
  
  if (patterns.length > 0) {
    summary += ` Patterns: ${patterns.slice(0, 3).join(", ")}`;
  }
  
  return summary;
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been'
  ]);
  
  const words = text.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  const wordFreq = new Map<string, number>();
  words.forEach(word => {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  });
  
  return Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function calculateInitialStrength(importance: string): number {
  switch (importance) {
    case "critical": return 1.0;
    case "high": return 0.8;
    case "medium": return 0.6;
    case "low": return 0.4;
    case "temporary": return 0.2;
    default: return 0.5;
  }
}

function calculateDecayRate(importance: string): number {
  switch (importance) {
    case "critical": return 0.001;
    case "high": return 0.005;
    case "medium": return 0.01;
    case "low": return 0.02;
    case "temporary": return 0.05;
    default: return 0.01;
  }
}