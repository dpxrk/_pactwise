// convex/ai/enhancedMemoryRetrieval.ts
import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { Doc } from "../_generated/dataModel";

// ============================================================================
// ENHANCED MEMORY RETRIEVAL WITH SEMANTIC SEARCH AND RERANKING
// ============================================================================

interface MemoryScore {
  memoryId: string;
  baseScore: number;
  semanticScore: number;
  temporalScore: number;
  contextScore: number;
  importanceScore: number;
  finalScore: number;
  explanation: string;
}

interface RetrievalContext {
  query: string;
  embedding?: number[];
  entityContext?: {
    type: string;
    id: string;
  };
  temporalContext?: {
    referenceTime: string;
    timeWindow?: number; // in hours
  };
  userContext?: {
    recentTopics: string[];
    preferences: string[];
  };
}

/**
 * Enhanced memory retrieval with multi-stage pipeline
 */
export const enhancedMemoryRetrieval = query({
  args: {
    context: v.object({
      query: v.string(),
      entityContext: v.optional(v.object({
        type: v.string(),
        id: v.string()
      })),
      temporalContext: v.optional(v.object({
        referenceTime: v.string(),
        timeWindow: v.optional(v.number())
      })),
      userContext: v.optional(v.object({
        recentTopics: v.array(v.string()),
        preferences: v.array(v.string())
      }))
    }),
    limit: v.optional(v.number()),
    includeExplanations: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { memories: [], explanations: [] };

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) return { memories: [], explanations: [] };

    const limit = args.limit || 20;
    
    // Stage 1: Candidate Retrieval
    const candidates = await retrieveCandidates(ctx, user._id, args.context, limit * 3);
    
    // Stage 2: Semantic Scoring (if embeddings available)
    const semanticScores = await calculateSemanticScores(ctx, candidates, args.context);
    
    // Stage 3: Contextual Reranking
    const rankedMemories = await rerankMemories(
      candidates,
      semanticScores,
      args.context,
      args.includeExplanations || false
    );
    
    // Stage 4: Diversity and Deduplication
    const diverseMemories = ensureDiversity(rankedMemories, limit);
    
    // Stage 5: Memory Synthesis (combine related memories)
    const synthesizedMemories = await synthesizeMemories(ctx, diverseMemories);
    
    return {
      memories: synthesizedMemories,
      explanations: args.includeExplanations ? 
        diverseMemories.map(m => ({
          memoryId: m.memoryId,
          explanation: m.explanation
        })) : []
    };
  }
});

/**
 * Stage 1: Retrieve candidate memories using multiple strategies
 */
async function retrieveCandidates(
  ctx: any,
  userId: string,
  context: RetrievalContext,
  limit: number
): Promise<Array<Doc<"shortTermMemory"> | Doc<"longTermMemory">>> {
  const candidates: Array<Doc<"shortTermMemory"> | Doc<"longTermMemory">> = [];
  
  // Strategy 1: Keyword-based retrieval
  const keywords = extractKeywords(context.query);
  
  // Get short-term memories
  const shortTermByKeywords = await ctx.db
    .query("shortTermMemory")
    .filter((q: any) => 
      q.and(
        q.eq(q.field("userId"), userId),
        q.or(
          ...keywords.map(keyword => 
            q.or(
              q.includes(q.field("content"), keyword),
              q.includes(q.field("structuredData"), keyword)
            )
          )
        )
      )
    )
    .take(limit);
  
  candidates.push(...shortTermByKeywords);
  
  // Get long-term memories
  const longTermByKeywords = await ctx.db
    .query("longTermMemory")
    .filter((q: any) =>
      q.and(
        q.eq(q.field("userId"), userId),
        q.or(
          ...keywords.map(keyword =>
            q.or(
              q.includes(q.field("content"), keyword),
              q.includes(q.field("summary"), keyword),
              q.arrayContains(q.field("keywords"), keyword)
            )
          )
        )
      )
    )
    .take(limit);
  
  candidates.push(...longTermByKeywords);
  
  // Strategy 2: Entity-based retrieval
  if (context.entityContext) {
    const entityMemories = await ctx.runQuery(
      api.memoryIntegration.getRelevantMemoriesForAgent,
      {
        agentType: "chat",
        entityId: context.entityContext.id,
        entityType: context.entityContext.type,
        limit: Math.floor(limit / 2)
      }
    );
    
    candidates.push(...entityMemories.shortTerm);
    candidates.push(...entityMemories.longTerm);
  }
  
  // Strategy 3: Temporal retrieval
  if (context.temporalContext) {
    const timeWindow = context.temporalContext.timeWindow || 24; // hours
    const referenceTime = new Date(context.temporalContext.referenceTime);
    const startTime = new Date(referenceTime.getTime() - timeWindow * 60 * 60 * 1000);
    
    const temporalMemories = await ctx.db
      .query("shortTermMemory")
      .filter((q: any) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.gte(q.field("createdAt"), startTime.toISOString()),
          q.lte(q.field("createdAt"), referenceTime.toISOString())
        )
      )
      .take(limit / 2);
    
    candidates.push(...temporalMemories);
  }
  
  // Remove duplicates
  const uniqueCandidates = Array.from(
    new Map(candidates.map(m => [m._id, m])).values()
  );
  
  return uniqueCandidates;
}

/**
 * Stage 2: Calculate semantic similarity scores
 */
async function calculateSemanticScores(
  ctx: any,
  memories: Array<Doc<"shortTermMemory"> | Doc<"longTermMemory">>,
  context: RetrievalContext
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  
  // If we have embeddings, calculate cosine similarity
  if (context.embedding) {
    for (const memory of memories) {
      if ('embedding' in memory && memory.embedding) {
        const similarity = cosineSimilarity(context.embedding, memory.embedding);
        scores.set(memory._id, similarity);
      } else {
        // Fallback to text similarity
        const textSimilarity = calculateTextSimilarity(context.query, memory.content);
        scores.set(memory._id, textSimilarity);
      }
    }
  } else {
    // Use text-based similarity
    for (const memory of memories) {
      const similarity = calculateTextSimilarity(context.query, memory.content);
      scores.set(memory._id, similarity);
    }
  }
  
  return scores;
}

/**
 * Stage 3: Rerank memories based on multiple factors
 */
async function rerankMemories(
  memories: Array<Doc<"shortTermMemory"> | Doc<"longTermMemory">>,
  semanticScores: Map<string, number>,
  context: RetrievalContext,
  includeExplanations: boolean
): Promise<MemoryScore[]> {
  const scoredMemories: MemoryScore[] = [];
  
  for (const memory of memories) {
    const memoryScore: MemoryScore = {
      memoryId: memory._id,
      baseScore: 0,
      semanticScore: semanticScores.get(memory._id) || 0,
      temporalScore: 0,
      contextScore: 0,
      importanceScore: 0,
      finalScore: 0,
      explanation: ""
    };
    
    // Temporal scoring - recent memories get higher scores
    const memoryAge = Date.now() - new Date(memory.createdAt).getTime();
    const daysSinceCreation = memoryAge / (1000 * 60 * 60 * 24);
    memoryScore.temporalScore = Math.exp(-daysSinceCreation / 30); // Decay over 30 days
    
    // Context scoring - memories related to current context get higher scores
    if (context.entityContext && 'context' in memory) {
      // Check if memory is related to the entity
      let hasEntity = false;
      
      // For shortTermMemory with relatedEntities
      if ('relatedEntities' in memory.context && memory.context.relatedEntities) {
        hasEntity = memory.context.relatedEntities.some(
          (e: any) => e.id === context.entityContext?.id
        );
      }
      
      // For longTermMemory with contractIds/vendorIds
      if ('contractIds' in memory.context) {
        if (context.entityContext.type === 'contract' && memory.context.contractIds) {
          hasEntity = memory.context.contractIds.includes(context.entityContext.id as any);
        }
      }
      if ('vendorIds' in memory.context) {
        if (context.entityContext.type === 'vendor' && memory.context.vendorIds) {
          hasEntity = memory.context.vendorIds.includes(context.entityContext.id as any);
        }
      }
      
      memoryScore.contextScore = hasEntity ? 1.0 : 0.2;
    }
    
    // Importance scoring
    const importanceMap: Record<string, number> = {
      critical: 1.0,
      high: 0.8,
      medium: 0.5,
      low: 0.3,
      temporary: 0.1
    };
    memoryScore.importanceScore = importanceMap[memory.importance] || 0.5;
    
    // Long-term memory strength bonus
    if ('strength' in memory) {
      memoryScore.baseScore = memory.strength * 0.5;
    }
    
    // Calculate final score with weights
    memoryScore.finalScore = 
      memoryScore.baseScore * 0.1 +
      memoryScore.semanticScore * 0.4 +
      memoryScore.temporalScore * 0.2 +
      memoryScore.contextScore * 0.2 +
      memoryScore.importanceScore * 0.1;
    
    // Generate explanation if requested
    if (includeExplanations) {
      const factors: string[] = [];
      if (memoryScore.semanticScore > 0.7) factors.push("high relevance");
      if (memoryScore.temporalScore > 0.8) factors.push("recent");
      if (memoryScore.contextScore > 0.5) factors.push("contextually related");
      if (memoryScore.importanceScore > 0.7) factors.push("high importance");
      
      memoryScore.explanation = `Retrieved due to: ${factors.join(", ")}`;
    }
    
    scoredMemories.push(memoryScore);
  }
  
  // Sort by final score
  scoredMemories.sort((a, b) => b.finalScore - a.finalScore);
  
  return scoredMemories;
}

/**
 * Stage 4: Ensure diversity in retrieved memories
 */
function ensureDiversity(
  rankedMemories: MemoryScore[],
  limit: number
): MemoryScore[] {
  const selected: MemoryScore[] = [];
  const typeCount = new Map<string, number>();
  const maxPerType = Math.ceil(limit / 4); // Max 25% of any single type
  
  for (const memory of rankedMemories) {
    // This is simplified - in production, you'd look up the actual memory type
    const memoryType = memory.memoryId.includes("short") ? "short" : "long";
    
    const currentCount = typeCount.get(memoryType) || 0;
    if (currentCount < maxPerType) {
      selected.push(memory);
      typeCount.set(memoryType, currentCount + 1);
    }
    
    if (selected.length >= limit) break;
  }
  
  return selected;
}

/**
 * Stage 5: Synthesize related memories
 */
async function synthesizeMemories(
  ctx: any,
  memories: MemoryScore[]
): Promise<any[]> {
  // Group memories by similarity
  const groups = clusterMemories(memories);
  
  const synthesized: any[] = [];
  for (const group of groups) {
    if (group.length > 1) {
      // Create a synthesized memory that combines the group
      const combined = {
        type: "synthesized",
        content: `Combined insight from ${group.length} related memories`,
        sourceMemories: group.map(m => m.memoryId),
        confidence: Math.max(...group.map(m => m.finalScore))
      };
      synthesized.push(combined);
    } else {
      synthesized.push(group[0]);
    }
  }
  
  return synthesized;
}

// Helper functions

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'what',
    'when', 'where', 'who', 'why', 'how', 'can', 'could', 'should', 'would'
  ]);
  
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 10);
}

function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return 0;
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set(Array.from(words1).filter(x => words2.has(x)));
  const union = new Set([...Array.from(words1), ...Array.from(words2)]);
  
  return intersection.size / union.size; // Jaccard similarity
}

function clusterMemories(memories: MemoryScore[]): MemoryScore[][] {
  // Simple clustering - in production, use proper clustering algorithms
  const threshold = 0.8;
  const clusters: MemoryScore[][] = [];
  const assigned = new Set<string>();
  
  for (const memory of memories) {
    if (assigned.has(memory.memoryId)) continue;
    
    const cluster = [memory];
    assigned.add(memory.memoryId);
    
    for (const other of memories) {
      if (assigned.has(other.memoryId)) continue;
      
      // Check similarity between memories
      if (memory.finalScore > 0 && other.finalScore > 0) {
        const similarity = Math.abs(memory.finalScore - other.finalScore);
        if (similarity < (1 - threshold)) {
          cluster.push(other);
          assigned.add(other.memoryId);
        }
      }
    }
    
    clusters.push(cluster);
  }
  
  return clusters;
}

/**
 * Memory contradiction detection
 */
export const detectContradictions = query({
  args: {
    memoryId: v.string(),
    candidateMemories: v.array(v.string())
  },
  handler: async (ctx, args) => {
    // Check for contradicting information
    const contradictions = [];
    
    // This would use more sophisticated NLP in production
    // For now, it's a placeholder for the architecture
    
    return { contradictions };
  }
});