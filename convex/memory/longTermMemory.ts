// convex/memory/longTermMemory.ts
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

// ============================================================================
// LONG-TERM MEMORY FUNCTIONS
// ============================================================================

// Store or update a long-term memory
export const store = mutation({
  args: {
    memoryType: v.union(
      v.literal("user_preference"),
      v.literal("interaction_pattern"),
      v.literal("domain_knowledge"),
      v.literal("conversation_context"),
      v.literal("task_history"),
      v.literal("feedback"),
      v.literal("entity_relation"),
      v.literal("process_knowledge")
    ),
    content: v.string(),
    structuredData: v.optional(v.any()),
    summary: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    context: v.object({
      domain: v.optional(v.string()),
      relatedMemories: v.optional(v.array(v.id("longTermMemory"))),
      contractIds: v.optional(v.array(v.id("contracts"))),
      vendorIds: v.optional(v.array(v.id("vendors"))),
      tags: v.optional(v.array(v.string())),
    }),
    importance: v.union(
      v.literal("critical"),
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
      v.literal("temporary")
    ),
    confidence: v.number(),
    source: v.union(
      v.literal("explicit_feedback"),
      v.literal("implicit_learning"),
      v.literal("task_outcome"),
      v.literal("error_correction"),
      v.literal("conversation"),
      v.literal("system_observation")
    ),
    sourceChain: v.optional(v.array(v.string())),
    consolidatedFrom: v.optional(v.array(v.id("shortTermMemory"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) throw new Error("User not found");

    const now = new Date().toISOString();
    
    // Check for existing similar memory
    const existingMemory = await findSimilarMemory(ctx, user._id, args.memoryType, args.content);
    
    if (existingMemory) {
      // Reinforce existing memory
      const newStrength = Math.min(1, existingMemory.strength + 0.1);
      const newConfidence = Math.max(existingMemory.confidence, args.confidence);
      
      await ctx.db.patch(existingMemory._id, {
        strength: newStrength,
        confidence: newConfidence,
        reinforcementCount: existingMemory.reinforcementCount + 1,
        lastReinforcedAt: now,
        updatedAt: now,
        accessCount: existingMemory.accessCount + 1,
        lastAccessedAt: now,
        importance: getHigherImportance(existingMemory.importance, args.importance) as typeof existingMemory.importance,
      });
      
      return existingMemory._id;
    }

    // Create new long-term memory
    const memoryId = await ctx.db.insert("longTermMemory", {
      userId: user._id,
      enterpriseId: user.enterpriseId,
      memoryType: args.memoryType,
      content: args.content,
      structuredData: args.structuredData,
      summary: args.summary || args.content.substring(0, 200),
      embedding: undefined, // Will be set by vector embedding service
      keywords: args.keywords || extractKeywords(args.content),
      context: args.context,
      importance: args.importance,
      strength: calculateInitialStrength(args.importance),
      reinforcementCount: 0,
      decayRate: calculateDecayRate(args.importance),
      accessCount: 1,
      lastAccessedAt: now,
      createdAt: now,
      updatedAt: now,
      consolidatedFrom: args.consolidatedFrom,
      confidence: args.confidence,
      isVerified: false,
      contradictedBy: undefined,
      source: args.source,
      sourceChain: args.sourceChain,
    });

    // Mark short-term memories as consolidated
    if (args.consolidatedFrom) {
      for (const stmId of args.consolidatedFrom) {
        await ctx.db.patch(stmId, {
          consolidatedAt: now,
        });
      }
    }

    return memoryId;
  },
});

// Retrieve memories by type and importance
export const getMemories = query({
  args: {
    memoryTypes: v.optional(v.array(v.union(
      v.literal("user_preference"),
      v.literal("interaction_pattern"),
      v.literal("domain_knowledge"),
      v.literal("conversation_context"),
      v.literal("task_history"),
      v.literal("feedback"),
      v.literal("entity_relation"),
      v.literal("process_knowledge")
    ))),
    minImportance: v.optional(v.union(
      v.literal("critical"),
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
      v.literal("temporary")
    )),
    minStrength: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) return [];

    let memories: Doc<"longTermMemory">[] = [];
    
    if (args.memoryTypes && args.memoryTypes.length > 0) {
      // Query specific memory types
      for (const memoryType of args.memoryTypes) {
        const typeMemories = await ctx.db
          .query("longTermMemory")
          .withIndex("by_user_type_strength", (q) => 
            q.eq("userId", user._id).eq("memoryType", memoryType)
          )
          .order("desc")
          .take(args.limit || 50);
        
        memories.push(...typeMemories);
      }
    } else {
      // Get all memories
      memories = await ctx.db
        .query("longTermMemory")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(args.limit || 100);
    }

    // Apply filters
    if (args.minImportance) {
      const importanceLevels = ["critical", "high", "medium", "low", "temporary"];
      const minIndex = importanceLevels.indexOf(args.minImportance);
      memories = memories.filter(m => 
        importanceLevels.indexOf(m.importance) <= minIndex
      );
    }

    if (args.minStrength !== undefined) {
      memories = memories.filter(m => m.strength >= args.minStrength!);
    }

    // Sort by strength and recency
    memories.sort((a, b) => {
      const strengthDiff = b.strength - a.strength;
      if (Math.abs(strengthDiff) > 0.1) {
        return strengthDiff;
      }
      return new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime();
    });

    // Note: In query functions, we cannot modify data
    // Access count would need to be updated in a separate mutation

    return memories.slice(0, args.limit || 50);
  },
});

// Search memories by keywords or content
export const searchMemories = query({
  args: {
    query: v.string(),
    memoryTypes: v.optional(v.array(v.union(
      v.literal("user_preference"),
      v.literal("interaction_pattern"),
      v.literal("domain_knowledge"),
      v.literal("conversation_context"),
      v.literal("task_history"),
      v.literal("feedback"),
      v.literal("entity_relation"),
      v.literal("process_knowledge")
    ))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) return [];

    const queryLower = args.query.toLowerCase();
    const queryKeywords = extractKeywords(args.query);

    let memories = await ctx.db
      .query("longTermMemory")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Filter by memory types if specified
    if (args.memoryTypes && args.memoryTypes.length > 0) {
      memories = memories.filter(m => 
        args.memoryTypes!.includes(m.memoryType)
      );
    }

    // Score and rank memories
    const scoredMemories = memories.map(memory => {
      let score = 0;
      
      // Content match
      if (memory.content.toLowerCase().includes(queryLower)) {
        score += 3;
      }
      
      // Summary match
      if (memory.summary?.toLowerCase().includes(queryLower)) {
        score += 2;
      }
      
      // Keyword matches
      if (memory.keywords) {
        const keywordMatches = queryKeywords.filter(qk => 
          memory.keywords!.some(mk => mk.toLowerCase().includes(qk))
        ).length;
        score += keywordMatches * 1.5;
      }
      
      // Tag matches
      if (memory.context.tags) {
        const tagMatches = memory.context.tags.filter(tag => 
          tag.toLowerCase().includes(queryLower)
        ).length;
        score += tagMatches;
      }
      
      // Boost by strength and importance
      score *= memory.strength;
      if (memory.importance === "critical") score *= 2;
      if (memory.importance === "high") score *= 1.5;
      
      return { memory, score };
    });

    // Filter out zero scores and sort
    const relevantMemories = scoredMemories
      .filter(sm => sm.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, args.limit || 20)
      .map(sm => sm.memory);

    return relevantMemories;
  },
});

// Get related memories
export const getRelatedMemories = query({
  args: {
    memoryId: v.id("longTermMemory"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const memory = await ctx.db.get(args.memoryId);
    if (!memory) return [];

    // Get directly related memories
    const relatedIds = memory.context.relatedMemories || [];
    
    // Get memories through associations
    const associations = await ctx.db
      .query("memoryAssociations")
      .withIndex("by_from", (q) => q.eq("fromMemoryId", args.memoryId))
      .collect();
    
    const associatedIds = associations.map(a => a.toMemoryId);
    
    // Combine and dedupe
    const allRelatedIds = [...new Set([...relatedIds, ...associatedIds])];
    
    // Fetch memories
    const relatedMemories = await Promise.all(
      allRelatedIds.slice(0, args.limit || 10).map(id => ctx.db.get(id))
    );
    
    return relatedMemories.filter(m => m !== null) as Doc<"longTermMemory">[];
  },
});

// Reinforce a memory (increase strength)
export const reinforceMemory = mutation({
  args: {
    memoryId: v.id("longTermMemory"),
    reinforcementStrength: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const memory = await ctx.db.get(args.memoryId);
    if (!memory) throw new Error("Memory not found");

    const reinforcement = args.reinforcementStrength || 0.1;
    const newStrength = Math.min(1, memory.strength + reinforcement);
    
    await ctx.db.patch(args.memoryId, {
      strength: newStrength,
      reinforcementCount: memory.reinforcementCount + 1,
      lastReinforcedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },
});

// Verify a memory (user confirmation)
export const verifyMemory = mutation({
  args: {
    memoryId: v.id("longTermMemory"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const memory = await ctx.db.get(args.memoryId);
    if (!memory) throw new Error("Memory not found");

    await ctx.db.patch(args.memoryId, {
      isVerified: true,
      confidence: 1.0,
      strength: Math.min(1, memory.strength + 0.2),
      updatedAt: new Date().toISOString(),
    });
  },
});

// Apply decay to memories (called periodically)
export const applyDecay = mutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    
    // Get memories that haven't been accessed in the last day
    const memories = await ctx.db
      .query("longTermMemory")
      .withIndex("by_last_accessed")
      .filter((q) => q.lt(q.field("lastAccessedAt"), oneDayAgo))
      .collect();

    for (const memory of memories) {
      // Skip critical memories and verified memories
      if (memory.importance === "critical" || memory.isVerified) {
        continue;
      }
      
      // Calculate days since last access
      const daysSinceAccess = 
        (now.getTime() - new Date(memory.lastAccessedAt).getTime()) / 
        (24 * 60 * 60 * 1000);
      
      // Apply decay
      const decay = memory.decayRate * daysSinceAccess;
      const newStrength = Math.max(0, memory.strength - decay);
      
      if (newStrength > 0) {
        await ctx.db.patch(memory._id, {
          strength: newStrength,
        });
      } else {
        // Memory has decayed completely - delete it
        await ctx.db.delete(memory._id);
      }
    }
  },
});

// Helper functions
async function findSimilarMemory(
  ctx: any,
  userId: Id<"users">,
  memoryType: string,
  content: string
): Promise<Doc<"longTermMemory"> | null> {
  const memories = await ctx.db
    .query("longTermMemory")
    .withIndex("by_user_type_strength", (q) => 
      q.eq("userId", userId).eq("memoryType", memoryType)
    )
    .order("desc")
    .take(50);

  // Simple similarity check - in production, use embeddings
  const contentLower = content.toLowerCase();
  for (const memory of memories) {
    const similarity = calculateSimilarity(
      memory.content.toLowerCase(),
      contentLower
    );
    if (similarity > 0.8) {
      return memory;
    }
  }
  
  return null;
}

function calculateSimilarity(str1: string, str2: string): number {
  // Simple Jaccard similarity for now
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));
  
  const intersection = new Set(Array.from(words1).filter(x => words2.has(x)));
  const union = new Set([...Array.from(words1), ...Array.from(words2)]);
  
  return intersection.size / union.size;
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction - in production, use NLP
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'them',
    'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all',
    'each', 'every', 'some', 'any', 'few', 'more', 'most', 'other', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very'
  ]);
  
  const words = text.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  // Get unique words sorted by frequency
  const wordFreq = new Map<string, number>();
  words.forEach(word => {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  });
  
  const entries = Array.from(wordFreq.entries());
  return entries
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
    case "critical": return 0.001;  // Very slow decay
    case "high": return 0.005;      // Slow decay
    case "medium": return 0.01;     // Moderate decay
    case "low": return 0.02;        // Fast decay
    case "temporary": return 0.05;  // Very fast decay
    default: return 0.01;
  }
}

function getHigherImportance(imp1: string, imp2: string): typeof imp1 {
  const levels = ["temporary", "low", "medium", "high", "critical"];
  const index1 = levels.indexOf(imp1);
  const index2 = levels.indexOf(imp2);
  return index1 > index2 ? imp1 : imp2;
}