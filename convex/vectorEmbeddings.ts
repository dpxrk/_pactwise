// convex/vectorEmbeddings.ts
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// ============================================================================
// VECTOR EMBEDDINGS FOR SEMANTIC MEMORY SEARCH
// ============================================================================

// Configuration for embedding service
const EMBEDDING_CONFIG = {
  model: "text-embedding-3-small", // OpenAI's latest embedding model
  dimensions: 1536, // OpenAI embedding dimensions
  batchSize: 100, // OpenAI batch size limit
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

// Generate embedding for text using OpenAI API
export const generateEmbedding = async (text: string): Promise<number[]> => {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: EMBEDDING_CONFIG.model,
        input: text.slice(0, 8191), // OpenAI token limit
        encoding_format: "float"
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    // Fallback to deterministic embedding for development/testing
    if (process.env.NODE_ENV === 'development' || !openaiApiKey) {
      const hash = text.split('').reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0);
      }, 0);
      
      const embedding = new Array(EMBEDDING_CONFIG.dimensions).fill(0);
      for (let i = 0; i < EMBEDDING_CONFIG.dimensions; i++) {
        embedding[i] = Math.sin(hash * (i + 1)) * Math.cos(hash / (i + 1));
      }
      
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      return embedding.map(val => val / magnitude);
    }
    throw error;
  }
};

// Generate embeddings for a batch of texts
export const generateBatchEmbeddings = async (
  texts: string[]
): Promise<number[][]> => {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  
  // OpenAI supports batch processing
  const results: number[][] = [];
  const chunkSize = EMBEDDING_CONFIG.batchSize;
  
  try {
    for (let i = 0; i < texts.length; i += chunkSize) {
      const chunk = texts.slice(i, i + chunkSize);
      const truncatedChunk = chunk.map(text => text.slice(0, 8191)); // Token limit
      
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: EMBEDDING_CONFIG.model,
          input: truncatedChunk,
          encoding_format: "float"
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      const embeddings = data.data.map((item: any) => item.embedding);
      results.push(...embeddings);
      
      // Rate limiting: wait 100ms between batches
      if (i + chunkSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  } catch (error) {
    console.error("Error generating batch embeddings:", error);
    // Fallback to individual processing
    if (process.env.NODE_ENV === 'development' || !openaiApiKey) {
      return Promise.all(texts.map(text => generateEmbedding(text)));
    }
    throw error;
  }
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
      const memory = memories[i];
      const embedding = embeddings[i];
      if (memory && embedding) {
        await ctx.db.patch(memory._id, {
          embedding: embedding,
        });
      }
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
            const firstMemory = cluster[i];
            const secondMemory = cluster[j];
            
            if (firstMemory && secondMemory && firstMemory.embedding && secondMemory.embedding) {
              const existing = await ctx.db
                .query("memoryAssociations")
                .withIndex("by_from", (q) => q.eq("fromMemoryId", firstMemory._id))
                .filter(q => q.eq(q.field("toMemoryId"), secondMemory._id))
                .first();
              
              if (!existing) {
                await ctx.db.insert("memoryAssociations", {
                  fromMemoryId: firstMemory._id,
                  toMemoryId: secondMemory._id,
                  associationType: "similar",
                  strength: cosineSimilarity(firstMemory.embedding, secondMemory.embedding),
                  confidence: 0.9,
                  createdAt: new Date().toISOString(),
                  lastReinforcedAt: new Date().toISOString(),
                });
              }
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
        const firstMemory = memories[i];
        const secondMemory = memories[j];
        
        if (!firstMemory || !secondMemory || !firstMemory.embedding || !secondMemory.embedding) continue;
        
        const similarity = cosineSimilarity(firstMemory.embedding, secondMemory.embedding);
        
        if (similarity >= EMBEDDING_CONFIG.similarityThreshold) {
          // Check if association exists
          const existing = await ctx.db
            .query("memoryAssociations")
            .withIndex("by_from", (q) => q.eq("fromMemoryId", firstMemory._id))
            .filter(q => q.eq(q.field("toMemoryId"), secondMemory._id))
            .first();
          
          if (!existing) {
            await ctx.db.insert("memoryAssociations", {
              fromMemoryId: firstMemory._id,
              toMemoryId: secondMemory._id,
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