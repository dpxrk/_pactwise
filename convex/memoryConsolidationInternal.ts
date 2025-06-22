// convex/memoryConsolidationInternal.ts
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

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
    const key = `${memory.memoryType}_${memory.context?.taskId || 'general'}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(memory);
  }

  return Array.from(groups.values());
}

// Consolidate a group of related memories
async function consolidateMemoryGroup(
  ctx: any,
  memories: Doc<"shortTermMemory">[],
  userId: Id<"users">,
  enterpriseId: Id<"enterprises">
): Promise<{ id: Id<"longTermMemory">, patterns: number } | null> {
  if (memories.length === 0) return null;

  const firstMemory = memories[0];
  if (!firstMemory) return null;
  
  const memoryType = firstMemory.memoryType;
  const patterns = identifyPatterns(memories);
  const consolidatedContent = synthesizeContent(memories);
  const importance = calculateImportance(memories);
  const confidence = calculateAverageConfidence(memories);

  // Store in long-term memory
  const longTermMemoryId = await ctx.db.insert("longTermMemory", {
    userId,
    enterpriseId,
    memoryType,
    content: consolidatedContent,
    summary: generateSummary(consolidatedContent),
    importance,
    confidence,
    reinforcementCount: memories.length,
    lastReinforcedAt: new Date().toISOString(),
    decayRate: calculateDecayRate(importance),
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    associatedAgentIds: extractAgentIds(memories),
    contextualTags: extractTags(memories),
    consolidatedFrom: memories.map(m => m._id),
    isActive: true,
    isVerified: confidence > 0.8,
  });

  return { id: longTermMemoryId, patterns: patterns.length };
}

// Pattern identification
function identifyPatterns(memories: Doc<"shortTermMemory">[]): string[] {
  const patterns: string[] = [];
  const contentFrequency = new Map<string, number>();

  // Analyze content for recurring themes
  for (const memory of memories) {
    const words = memory.content.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 4) { // Only consider meaningful words
        contentFrequency.set(word, (contentFrequency.get(word) || 0) + 1);
      }
    }
  }

  // Identify frequently occurring words as patterns
  for (const [word, count] of contentFrequency.entries()) {
    if (count >= memories.length * 0.3) { // Word appears in 30% of memories
      patterns.push(word);
    }
  }

  return patterns;
}

// Synthesize content from multiple memories
function synthesizeContent(memories: Doc<"shortTermMemory">[]): string {
  // Sort memories by confidence and importance
  const sortedMemories = memories.sort((a, b) => {
    const scoreA = a.confidence * (a.importance === "critical" ? 3 : a.importance === "high" ? 2 : 1);
    const scoreB = b.confidence * (b.importance === "critical" ? 3 : b.importance === "high" ? 2 : 1);
    return scoreB - scoreA;
  });

  // Take top memories and combine their content
  const topMemories = sortedMemories.slice(0, Math.min(5, memories.length));
  const contents = topMemories.map(m => m.content);
  
  return contents.join(" | ");
}

// Calculate overall importance
function calculateImportance(memories: Doc<"shortTermMemory">[]): "critical" | "high" | "medium" | "low" {
  const importanceScores = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
    temporary: 0,
  };

  const avgScore = memories.reduce((sum, m) => sum + importanceScores[m.importance], 0) / memories.length;
  
  if (avgScore >= 3.5) return "critical";
  if (avgScore >= 2.5) return "high";
  if (avgScore >= 1.5) return "medium";
  return "low";
}

// Calculate average confidence
function calculateAverageConfidence(memories: Doc<"shortTermMemory">[]): number {
  return memories.reduce((sum, m) => sum + m.confidence, 0) / memories.length;
}

// Generate summary
function generateSummary(content: string): string {
  // Simple summary: first 200 characters
  return content.substring(0, 200) + (content.length > 200 ? "..." : "");
}

// Calculate decay rate based on importance
function calculateDecayRate(importance: string): number {
  switch (importance) {
    case "critical": return 0.01; // Very slow decay
    case "high": return 0.05;
    case "medium": return 0.1;
    case "low": return 0.2;
    default: return 0.3;
  }
}

// Extract agent IDs from memories
function extractAgentIds(memories: Doc<"shortTermMemory">[]): string[] {
  const agentIds = new Set<string>();
  for (const memory of memories) {
    if (memory.context?.agentId) {
      agentIds.add(memory.context.agentId);
    }
  }
  return Array.from(agentIds);
}

// Extract contextual tags
function extractTags(memories: Doc<"shortTermMemory">[]): string[] {
  const tags = new Set<string>();
  
  for (const memory of memories) {
    // Add memory type as tag
    tags.add(memory.memoryType);
    
    // Add entity types from context
    if (memory.context?.relatedEntities) {
      for (const entity of memory.context.relatedEntities) {
        tags.add(entity.type);
      }
    }
  }
  
  return Array.from(tags);
}