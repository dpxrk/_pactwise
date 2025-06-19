// convex/vectorEmbeddings.ts
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// ============================================================================
// VECTOR EMBEDDINGS FOR SEMANTIC MEMORY SEARCH
// ============================================================================

// Configuration for embedding service
const EMBEDDING_CONFIG = {
  model: "text-embedding-ada-002", // OpenAI's embedding model
  dimensions: 1536,
  batchSize: 100,
  similarityThreshold: 0.7,
  maxRetries: 3,
  cacheExpiry: 24 * 60 * 60 * 1000, // 24 hours
};

// Vector similarity functions
export const cosineSimilarity = (vec1: number[], vec2: number[]): number => {
  if (vec1.length !== vec2.length) return 0;
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i]! * vec2[i]!;
    norm1 += vec1[i]! * vec1[i]!;
    norm2 += vec2[i]! * vec2[i]!;
  }
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
};

// Generate embedding for text (mock implementation - replace with actual API)
export const generateEmbedding = async (text: string): Promise<number[]> => {
  // In production, this would call an embedding API like OpenAI
  // For now, we'll create a deterministic mock embedding
  const hash = text.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  
  const embedding = new Array(EMBEDDING_CONFIG.dimensions).fill(0);
  for (let i = 0; i < EMBEDDING_CONFIG.dimensions; i++) {
    embedding[i] = Math.sin(hash * (i + 1)) * Math.cos(hash / (i + 1));
  }
  
  // Normalize the vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
};

// Generate embeddings for a batch of texts
export const generateBatchEmbeddings = async (
  texts: string[]
): Promise<number[][]> => {
  // In production, batch process with API
  return Promise.all(texts.map(text => generateEmbedding(text)));
};

// Update memory with embedding
export const updateMemoryEmbedding = internalMutation({
  args: {
    memoryId: v.id("longTermMemory"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.memoryId, {
      embedding: args.embedding,
    });
  },
});

// Process memories without embeddings
export const processMemoryEmbeddings = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || EMBEDDING_CONFIG.batchSize;
    
    // Get memories without embeddings
    const memories = await ctx.db
      .query("longTermMemory")
      .filter(q => q.eq(q.field("embedding"), undefined))
      .take(batchSize);
    
    if (memories.length === 0) return { processed: 0 };
    
    // Generate embeddings for content
    const texts = memories.map(m => 
      `${m.memoryType}: ${m.content} ${m.summary || ''} ${m.keywords?.join(' ') || ''}`
    );
    
    const embeddings = await generateBatchEmbeddings(texts);
    
    // Update memories with embeddings
    for (let i = 0; i < memories.length; i++) {
      await ctx.db.patch(memories[i]!._id, {
        embedding: embeddings[i]!,
      });
    }
    
    return { processed: memories.length };
  },
});

// Semantic memory search with vector similarity
export const semanticMemorySearch = query({
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
    minSimilarity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) return [];
    
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(args.query);
    const minSimilarity = args.minSimilarity || EMBEDDING_CONFIG.similarityThreshold;
    
    // Get candidate memories
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
    
    // Calculate similarities and rank
    const rankedMemories = memories
      .filter(m => m.embedding !== undefined)
      .map(memory => {
        const similarity = cosineSimilarity(queryEmbedding, memory.embedding!);
        return { memory, similarity };
      })
      .filter(item => item.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, args.limit || 20);
    
    return rankedMemories.map(item => ({
      ...item.memory,
      similarity: item.similarity,
    }));
  },
});

// Find similar memories to a given memory
export const findSimilarMemories = query({
  args: {
    memoryId: v.id("longTermMemory"),
    limit: v.optional(v.number()),
    minSimilarity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.memoryId);
    if (!memory || !memory.embedding) return [];
    
    const minSimilarity = args.minSimilarity || EMBEDDING_CONFIG.similarityThreshold;
    
    // Get other memories of the same user
    const candidates = await ctx.db
      .query("longTermMemory")
      .withIndex("by_user", (q) => q.eq("userId", memory.userId))
      .collect();
    
    // Calculate similarities
    const similarMemories = candidates
      .filter(m => m._id !== args.memoryId && m.embedding !== undefined)
      .map(candidate => {
        const similarity = cosineSimilarity(memory.embedding!, candidate.embedding!);
        return { memory: candidate, similarity };
      })
      .filter(item => item.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, args.limit || 10);
    
    return similarMemories.map(item => ({
      ...item.memory,
      similarity: item.similarity,
    }));
  },
});

// Cluster memories by semantic similarity
export const clusterMemories = internalMutation({
  args: {
    userId: v.id("users"),
    clusterThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const threshold = args.clusterThreshold || 0.8;
    
    // Get all memories with embeddings
    const memories = await ctx.db
      .query("longTermMemory")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter(q => q.neq(q.field("embedding"), undefined))
      .collect();
    
    if (memories.length < 2) return { clusters: 0 };
    
    // Simple clustering algorithm
    const clusters: Doc<"longTermMemory">[][] = [];
    const clustered = new Set<Id<"longTermMemory">>();
    
    for (const memory of memories) {
      if (clustered.has(memory._id)) continue;
      
      const cluster = [memory];
      clustered.add(memory._id);
      
      // Find similar memories
      for (const candidate of memories) {
        if (clustered.has(candidate._id)) continue;
        
        const similarity = cosineSimilarity(memory.embedding!, candidate.embedding!);
        if (similarity >= threshold) {
          cluster.push(candidate);
          clustered.add(candidate._id);
        }
      }
      
      if (cluster.length > 1) {
        clusters.push(cluster);
        
        // Create associations between clustered memories
        for (let i = 0; i < cluster.length; i++) {
          for (let j = i + 1; j < cluster.length; j++) {
            const existing = await ctx.db
              .query("memoryAssociations")
              .withIndex("by_from", (q) => q.eq("fromMemoryId", cluster[i]._id))
              .filter(q => q.eq(q.field("toMemoryId"), cluster[j]._id))
              .first();
            
            if (!existing) {
              await ctx.db.insert("memoryAssociations", {
                fromMemoryId: cluster[i]._id,
                toMemoryId: cluster[j]._id,
                associationType: "similar",
                strength: cosineSimilarity(cluster[i].embedding!, cluster[j].embedding!),
                confidence: 0.9,
                createdAt: new Date().toISOString(),
                lastReinforcedAt: new Date().toISOString(),
              });
            }
          }
        }
      }
    }
    
    return { clusters: clusters.length };
  },
});

// Generate embeddings for specific content types
export const generateContentEmbedding = async (
  contentType: string,
  content: any
): Promise<number[]> => {
  let text = "";
  
  switch (contentType) {
    case "contract":
      text = `Contract: ${content.name} ${content.description || ''} 
              Type: ${content.contractType} Value: ${content.value} 
              Vendor: ${content.vendorName || ''} ${content.summary || ''}`;
      break;
      
    case "vendor":
      text = `Vendor: ${content.name} ${content.description || ''} 
              Category: ${content.category || ''} Services: ${content.services?.join(', ') || ''} 
              Risk: ${content.riskLevel || ''} Performance: ${content.performanceScore || ''}`;
      break;
      
    case "task":
      text = `Task: ${content.taskType} Priority: ${content.priority} 
              Status: ${content.status} ${content.description || ''} 
              Result: ${content.result || ''}`;
      break;
      
    case "insight":
      text = `Insight: ${content.type} ${content.title} ${content.description} 
              Priority: ${content.priority} ${content.data ? JSON.stringify(content.data) : ''}`;
      break;
      
    default:
      text = JSON.stringify(content);
  }
  
  return generateEmbedding(text);
};

// Index memories by domain for faster retrieval
export const indexMemoriesByDomain = internalMutation({
  args: {
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    // Get memories for the domain
    const memories = await ctx.db
      .query("longTermMemory")
      .filter(q => q.eq(q.field("context.domain"), args.domain))
      .collect();
    
    if (memories.length < 2) return { indexed: 0 };
    
    // Calculate pairwise similarities within domain
    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        if (!memories[i].embedding || !memories[j].embedding) continue;
        
        const similarity = cosineSimilarity(memories[i].embedding!, memories[j].embedding!);
        
        if (similarity >= EMBEDDING_CONFIG.similarityThreshold) {
          // Check if association exists
          const existing = await ctx.db
            .query("memoryAssociations")
            .withIndex("by_from", (q) => q.eq("fromMemoryId", memories[i]._id))
            .filter(q => q.eq(q.field("toMemoryId"), memories[j]._id))
            .first();
          
          if (!existing) {
            await ctx.db.insert("memoryAssociations", {
              fromMemoryId: memories[i]._id,
              toMemoryId: memories[j]._id,
              associationType: "related",
              strength: similarity,
              confidence: 0.8,
              createdAt: new Date().toISOString(),
              lastReinforcedAt: new Date().toISOString(),
            });
          }
        }
      }
    }
    
    return { indexed: memories.length };
  },
});