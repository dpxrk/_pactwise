// convex/memoryConsolidation.ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

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

    // Note: The consolidation job needs to be processed separately
    // to avoid deep type instantiation issues with internal API calls
    // You can process it manually or via a cron job

    return { jobId, memoryCount: memories.length };
  },
});

