// convex/memory/shortTermMemory.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// ============================================================================
// SHORT-TERM MEMORY FUNCTIONS
// ============================================================================

// Store a new short-term memory
export const store = mutation({
  args: {
    sessionId: v.string(),
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
    context: v.object({
      conversationId: v.optional(v.string()),
      taskId: v.optional(v.id("agentTasks")),
      contractId: v.optional(v.id("contracts")),
      vendorId: v.optional(v.id("vendors")),
      agentId: v.optional(v.string()),
      relatedEntities: v.optional(v.array(v.object({
        type: v.string(),
        id: v.string(),
        name: v.optional(v.string()),
      }))),
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
    sourceMetadata: v.optional(v.any()),
    expiresAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get user and enterprise info
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) throw new Error("User not found");

    const now = new Date().toISOString();
    
    // Calculate expiry if not provided
    const expiresAt = args.expiresAt || calculateExpiry(args.importance);

    // Check for similar existing memories to avoid duplicates
    const existingMemories = await ctx.db
      .query("shortTermMemory")
      .withIndex("by_user_session", (q) => 
        q.eq("userId", user._id).eq("sessionId", args.sessionId)
      )
      .filter((q) => 
        q.and(
          q.eq(q.field("memoryType"), args.memoryType),
          q.eq(q.field("content"), args.content)
        )
      )
      .first();

    if (existingMemories) {
      // Update access count and timestamp for existing memory
      await ctx.db.patch(existingMemories._id, {
        accessCount: existingMemories.accessCount + 1,
        lastAccessedAt: now,
        importance: args.importance, // Update importance if changed
        confidence: Math.max(existingMemories.confidence, args.confidence),
      });
      return existingMemories._id;
    }

    // Store new memory
    const memoryId = await ctx.db.insert("shortTermMemory", {
      userId: user._id,
      enterpriseId: user.enterpriseId,
      sessionId: args.sessionId,
      memoryType: args.memoryType,
      content: args.content,
      structuredData: args.structuredData,
      context: args.context,
      importance: args.importance,
      confidence: args.confidence,
      accessCount: 1,
      lastAccessedAt: now,
      createdAt: now,
      expiresAt,
      isProcessed: false,
      shouldConsolidate: args.importance === "critical" || args.importance === "high",
      source: args.source,
      sourceMetadata: args.sourceMetadata,
    });

    return memoryId;
  },
});

// Retrieve short-term memories for current session
export const getSessionMemories = query({
  args: {
    sessionId: v.string(),
    memoryType: v.optional(v.union(
      v.literal("user_preference"),
      v.literal("interaction_pattern"),
      v.literal("domain_knowledge"),
      v.literal("conversation_context"),
      v.literal("task_history"),
      v.literal("feedback"),
      v.literal("entity_relation"),
      v.literal("process_knowledge")
    )),
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

    let query = ctx.db
      .query("shortTermMemory")
      .withIndex("by_user_session", (q) => 
        q.eq("userId", user._id).eq("sessionId", args.sessionId)
      );

    if (args.memoryType) {
      query = query.filter((q) => q.eq(q.field("memoryType"), args.memoryType));
    }

    const memories = await query
      .order("desc")
      .take(args.limit || 50);

    // Note: In query functions, we cannot modify data
    // Access count would need to be updated in a separate mutation

    return memories;
  },
});

// Get recent memories across all sessions for a user
export const getRecentMemories = query({
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
    limit: v.optional(v.number()),
    minImportance: v.optional(v.union(
      v.literal("critical"),
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
      v.literal("temporary")
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) return [];

    const importanceLevels = ["critical", "high", "medium", "low", "temporary"];
    const minImportanceIndex = args.minImportance 
      ? importanceLevels.indexOf(args.minImportance)
      : importanceLevels.length - 1;

    let memories: Doc<"shortTermMemory">[] = [];

    // Query for each memory type if specified
    if (args.memoryTypes && args.memoryTypes.length > 0) {
      for (const memoryType of args.memoryTypes) {
        const typeMemories = await ctx.db
          .query("shortTermMemory")
          .withIndex("by_user_type_created", (q) => 
            q.eq("userId", user._id).eq("memoryType", memoryType)
          )
          .order("desc")
          .take(args.limit || 20);
        
        memories.push(...typeMemories);
      }
    } else {
      // Get all recent memories
      memories = await ctx.db
        .query("shortTermMemory")
        .withIndex("by_enterprise_user", (q) => 
          q.eq("enterpriseId", user.enterpriseId).eq("userId", user._id)
        )
        .order("desc")
        .take(args.limit || 50);
    }

    // Filter by importance
    memories = memories.filter(memory => {
      const memoryImportanceIndex = importanceLevels.indexOf(memory.importance);
      return memoryImportanceIndex <= minImportanceIndex;
    });

    // Sort by creation date and limit
    memories.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return memories.slice(0, args.limit || 50);
  },
});

// Search memories by content
export const searchMemories = query({
  args: {
    searchTerm: v.string(),
    sessionId: v.optional(v.string()),
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

    let query = ctx.db
      .query("shortTermMemory")
      .withIndex("by_enterprise_user", (q) => 
        q.eq("enterpriseId", user.enterpriseId).eq("userId", user._id)
      );

    const memories = await query
      .filter((q) => {
        if (args.sessionId) {
          return q.eq(q.field("sessionId"), args.sessionId);
        }
        return q.gt(q.field("_creationTime"), 0); // Get all memories
      })
      .order("desc")
      .take(args.limit || 20);

    // Filter by search term in application logic since Convex doesn't support string methods in queries
    const searchTermLower = args.searchTerm.toLowerCase();
    const filteredMemories = memories.filter(memory => 
      memory.content.toLowerCase().includes(searchTermLower)
    );

    return filteredMemories;
  },
});

// Mark memories for consolidation
export const markForConsolidation = mutation({
  args: {
    memoryIds: v.array(v.id("shortTermMemory")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) throw new Error("User not found");

    for (const memoryId of args.memoryIds) {
      const memory = await ctx.db.get(memoryId);
      if (memory && memory.userId === user._id) {
        await ctx.db.patch(memoryId, {
          shouldConsolidate: true,
        });
      }
    }
  },
});

// Clean up expired memories
export const cleanupExpiredMemories = mutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString();
    
    const expiredMemories = await ctx.db
      .query("shortTermMemory")
      .withIndex("by_expiry")
      .filter((q) => 
        q.and(
          q.neq(q.field("expiresAt"), undefined),
          q.lt(q.field("expiresAt"), now)
        )
      )
      .collect();

    for (const memory of expiredMemories) {
      // Only delete if not marked for consolidation
      if (!memory.shouldConsolidate) {
        await ctx.db.delete(memory._id);
      }
    }

    return expiredMemories.length;
  },
});

// Helper function to calculate expiry based on importance
function calculateExpiry(importance: string): string {
  const now = new Date();
  
  switch (importance) {
    case "critical":
      // Never expires (return far future date)
      return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
    case "high":
      // Expires in 7 days
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    case "medium":
      // Expires in 24 hours
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case "low":
      // Expires in 4 hours
      return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
    case "temporary":
      // Expires in 30 minutes
      return new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    default:
      // Default to 24 hours
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }
}