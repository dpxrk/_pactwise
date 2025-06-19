// convex/memory/test.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Test function to verify memory system works
export const testMemorySystem = mutation({
  args: {
    testContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) throw new Error("User not found");

    const testContent = args.testContent || "Test memory: System is working correctly";
    const sessionId = `test-${Date.now()}`;

    try {
      // Test storing a short-term memory
      const memoryId = await ctx.runMutation(api.memoryShortTerm.store, {
        sessionId,
        memoryType: "process_knowledge",
        content: testContent,
        context: {},
        importance: "medium",
        confidence: 1.0,
        source: "system_observation",
      });

      // Test retrieving memories
      const memories = await ctx.runQuery(api.memory.shortTermMemory.getSessionMemories, {
        sessionId,
        limit: 10,
      });

      // Test conversation thread
      const threadResult = await ctx.runMutation(api.memoryConversationThread.createThread, {
        title: "Test Conversation",
        initialMessage: "Hello, this is a test message for the memory system.",
      });

      return {
        success: true,
        memoryId,
        memoriesFound: memories.length,
        threadId: threadResult.threadId,
        message: "Memory system test completed successfully!",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Memory system test failed",
      };
    }
  },
});

// Get memory system status
export const getMemorySystemStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { authenticated: false };

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) return { authenticated: true, userFound: false };

    // Count memories
    const shortTermCount = await ctx.db
      .query("shortTermMemory")
      .withIndex("by_enterprise_user", (q) => 
        q.eq("enterpriseId", user.enterpriseId).eq("userId", user._id)
      )
      .collect()
      .then(memories => memories.length);

    const longTermCount = await ctx.db
      .query("longTermMemory")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()
      .then(memories => memories.length);

    const threadCount = await ctx.db
      .query("conversationThreads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect()
      .then(threads => threads.length);

    return {
      authenticated: true,
      userFound: true,
      userId: user._id,
      enterpriseId: user.enterpriseId,
      counts: {
        shortTermMemories: shortTermCount,
        longTermMemories: longTermCount,
        conversationThreads: threadCount,
      },
      status: "Memory system is operational",
    };
  },
});