// convex/memoryMaintenance.ts
import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

// ============================================================================
// MEMORY MAINTENANCE AND OPTIMIZATION
// ============================================================================

// Schedule memory maintenance operations
export const scheduleMemoryMaintenance = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Schedule immediate cleanup
    await ctx.scheduler.runAfter(
      0,
      api.memoryMaintenance.performMaintenance,
      {}
    );

    // Schedule daily maintenance (24 hours)
    await ctx.scheduler.runAfter(
      24 * 60 * 60 * 1000,
      api.memoryMaintenance.performMaintenance,
      {}
    );

    return { scheduled: true };
  },
});

// Main maintenance function
export const performMaintenance = internalMutation({
  args: {},
  handler: async (ctx) => {
    const results = {
      expiredMemoriesDeleted: 0,
      weakMemoriesDecayed: 0,
      duplicatesRemoved: 0,
      threadsArchived: 0,
      consolidationJobsCreated: 0,
    };

    try {
      // 1. Clean up expired short-term memories
      const expiredCount = await ctx.runMutation(
        api.memory.shortTermMemory.cleanupExpiredMemories,
        {}
      );
      results.expiredMemoriesDeleted = expiredCount;

      // 2. Apply decay to long-term memories
      await ctx.runMutation(api.memory.longTermMemory.applyDecay, {});
      results.weakMemoriesDecayed = await countWeakMemories(ctx);

      // 3. Remove duplicate memories
      results.duplicatesRemoved = await removeDuplicateMemoriesInternal(ctx);

      // 4. Archive old conversation threads
      results.threadsArchived = await archiveOldThreads(ctx);

      // 5. Trigger consolidation for users with pending memories
      results.consolidationJobsCreated = await triggerConsolidationJobs(ctx);

      // 6. Optimize memory associations
      await optimizeMemoryAssociationsInternal(ctx);

      // Log maintenance completion
      console.log("Memory maintenance completed:", results);

      return results;
    } catch (error) {
      console.error("Memory maintenance failed:", error);
      throw error;
    }
  },
});

// Remove duplicate short-term memories
export const removeDuplicateMemoriesMutation = mutation({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity && !args.userId) throw new Error("Not authenticated");

    let removedCount = 0;

    // Get all short-term memories grouped by user
    const memories = args.userId 
      ? await ctx.db
          .query("shortTermMemory")
          .filter((q) => q.eq(q.field("userId"), args.userId))
          .collect()
      : await ctx.db.query("shortTermMemory").collect();

    // Group by user and content hash
    const memoryGroups = new Map<string, Doc<"shortTermMemory">[]>();
    
    memories.forEach(memory => {
      const key = `${memory.userId}-${memory.memoryType}-${hashContent(memory.content)}`;
      if (!memoryGroups.has(key)) {
        memoryGroups.set(key, []);
      }
      memoryGroups.get(key)!.push(memory);
    });

    // Remove duplicates, keeping the most recent
    for (const [key, duplicates] of Array.from(memoryGroups.entries())) {
      if (duplicates.length > 1) {
        // Sort by creation date, keep the newest
        duplicates.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        // Delete all but the first (newest)
        for (let i = 1; i < duplicates.length; i++) {
          await ctx.db.delete(duplicates[i]._id);
          removedCount++;
        }
      }
    }

    return removedCount;
  },
});

// Optimize memory associations
export const optimizeMemoryAssociationsMutation = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get all associations
    const associations = await ctx.db.query("memoryAssociations").collect();
    
    let optimizedCount = 0;

    for (const association of associations) {
      // Check if both memories still exist
      const fromMemory = await ctx.db.get(association.fromMemoryId);
      const toMemory = await ctx.db.get(association.toMemoryId);

      if (!fromMemory || !toMemory) {
        // Delete orphaned association
        await ctx.db.delete(association._id);
        optimizedCount++;
        continue;
      }

      // Decay association strength over time
      const daysSinceReinforcement = 
        (Date.now() - new Date(association.lastReinforcedAt).getTime()) / 
        (24 * 60 * 60 * 1000);
      
      const decayRate = 0.01; // 1% per day
      const newStrength = Math.max(0, association.strength - (decayRate * daysSinceReinforcement));

      if (newStrength < 0.1) {
        // Remove very weak associations
        await ctx.db.delete(association._id);
        optimizedCount++;
      } else if (newStrength !== association.strength) {
        // Update strength
        await ctx.db.patch(association._id, {
          strength: newStrength,
        });
      }
    }

    return optimizedCount;
  },
});

// Analyze memory usage patterns
export const analyzeMemoryUsage = mutation({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity && !args.userId) throw new Error("Not authenticated");

    const user = args.userId ? 
      await ctx.db.get(args.userId) :
      await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", identity!.subject))
        .first();

    if (!user) throw new Error("User not found");

    // Get memory statistics
    const shortTermMemories = await ctx.db
      .query("shortTermMemory")
      .withIndex("by_enterprise_user", (q) => 
        q.eq("enterpriseId", user.enterpriseId).eq("userId", user._id)
      )
      .collect();

    const longTermMemories = await ctx.db
      .query("longTermMemory")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const conversations = await ctx.db
      .query("conversationThreads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Analyze by type
    const shortTermByType = groupByType(shortTermMemories);
    const longTermByType = groupByType(longTermMemories);

    // Calculate trends
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentShortTerm = shortTermMemories.filter(m => m.createdAt > last7Days).length;
    const recentLongTerm = longTermMemories.filter(m => m.createdAt > last7Days).length;

    return {
      summary: {
        totalShortTermMemories: shortTermMemories.length,
        totalLongTermMemories: longTermMemories.length,
        totalConversations: conversations.length,
        activeConversations: conversations.filter(c => c.status === "active").length,
      },
      byType: {
        shortTerm: shortTermByType,
        longTerm: longTermByType,
      },
      trends: {
        recentShortTermMemories: recentShortTerm,
        recentLongTermMemories: recentLongTerm,
        avgMemoriesPerDay: (recentShortTerm + recentLongTerm) / 7,
      },
      recommendations: generateMemoryRecommendations(
        shortTermMemories,
        longTermMemories,
        conversations
      ),
    };
  },
});

// Bulk memory operations
export const bulkMemoryOperations = mutation({
  args: {
    operation: v.union(
      v.literal("consolidate_all"),
      v.literal("archive_old"),
      v.literal("remove_weak"),
      v.literal("optimize_all")
    ),
    userId: v.optional(v.id("users")),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity && !args.userId) throw new Error("Not authenticated");

    const user = args.userId ?
      await ctx.db.get(args.userId) :
      await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", identity!.subject))
        .first();

    if (!user) throw new Error("User not found");

    const results = {
      operation: args.operation,
      dryRun: args.dryRun || false,
      affectedItems: 0,
      details: {} as any,
    };

    switch (args.operation) {
      case "consolidate_all":
        if (!args.dryRun) {
          const consolidationResult = await ctx.runMutation(
            api.memoryConsolidation.triggerConsolidation,
            {}
          );
          results.affectedItems = consolidationResult.memoryCount || 0;
          results.details = consolidationResult;
        } else {
          const pendingMemories = await ctx.db
            .query("shortTermMemory")
            .withIndex("by_enterprise_user", (q) => 
              q.eq("enterpriseId", user.enterpriseId).eq("userId", user._id)
            )
            .filter((q) => q.eq(q.field("shouldConsolidate"), true))
            .collect();
          results.affectedItems = pendingMemories.length;
        }
        break;

      case "archive_old":
        if (!args.dryRun) {
          const archived = await ctx.runMutation(
            api.memory.conversationThread.archiveOldThreads,
            { daysOld: 30 }
          );
          results.affectedItems = archived.archived;
        } else {
          const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const oldThreads = await ctx.db
            .query("conversationThreads")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .filter((q) => 
              q.and(
                q.neq(q.field("status"), "archived"),
                q.lt(q.field("lastMessageAt"), cutoffDate)
              )
            )
            .collect();
          results.affectedItems = oldThreads.length;
        }
        break;

      case "remove_weak":
        if (!args.dryRun) {
          const weakMemories = await ctx.db
            .query("longTermMemory")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .filter((q) => q.lt(q.field("strength"), 0.2))
            .collect();
          
          for (const memory of weakMemories) {
            await ctx.db.delete(memory._id);
          }
          results.affectedItems = weakMemories.length;
        } else {
          const weakMemories = await ctx.db
            .query("longTermMemory")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .filter((q) => q.lt(q.field("strength"), 0.2))
            .collect();
          results.affectedItems = weakMemories.length;
        }
        break;

      case "optimize_all":
        if (!args.dryRun) {
          const duplicates = await ctx.runMutation(
            api.memory.memoryMaintenance.removeDuplicateMemoriesMutation,
            { userId: user._id }
          );
          const associations = await ctx.runMutation(
            api.memory.memoryMaintenance.optimizeMemoryAssociationsMutation,
            {}
          );
          results.affectedItems = duplicates + associations;
          results.details = { duplicatesRemoved: duplicates, associationsOptimized: associations };
        }
        break;
    }

    return results;
  },
});

// Helper functions
async function countWeakMemories(ctx: any): Promise<number> {
  const weakMemories = await ctx.db
    .query("longTermMemory")
    .withIndex("by_strength", (q) => q.lt("strength", 0.3))
    .collect();
  return weakMemories.length;
}

async function removeDuplicateMemoriesInternal(ctx: any): Promise<number> {
  // This is a simplified version for internal use
  const memories = await ctx.db.query("shortTermMemory").collect();
  const duplicateGroups = new Map<string, Doc<"shortTermMemory">[]>();
  
  memories.forEach(memory => {
    const key = `${memory.userId}-${memory.memoryType}-${hashContent(memory.content)}`;
    if (!duplicateGroups.has(key)) {
      duplicateGroups.set(key, []);
    }
    duplicateGroups.get(key)!.push(memory);
  });

  let removedCount = 0;
  for (const [key, duplicates] of Array.from(duplicateGroups.entries())) {
    if (duplicates.length > 1) {
      duplicates.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      for (let i = 1; i < duplicates.length; i++) {
        await ctx.db.delete(duplicates[i]._id);
        removedCount++;
      }
    }
  }

  return removedCount;
}

async function archiveOldThreads(ctx: any): Promise<number> {
  const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const oldThreads = await ctx.db
    .query("conversationThreads")
    .withIndex("by_last_message", (q) => q.lt("lastMessageAt", cutoffDate))
    .filter((q) => q.neq(q.field("status"), "archived"))
    .collect();

  for (const thread of oldThreads) {
    await ctx.db.patch(thread._id, {
      status: "archived",
    });
  }

  return oldThreads.length;
}

async function triggerConsolidationJobs(ctx: any): Promise<number> {
  // Get users with pending consolidation memories
  const pendingMemories = await ctx.db
    .query("shortTermMemory")
    .withIndex("by_consolidation", (q) => q.eq("shouldConsolidate", true))
    .collect();

  const userIds = new Set(pendingMemories.map(m => m.userId));
  let jobsCreated = 0;

  for (const userId of Array.from(userIds)) {
    const user = await ctx.db.get(userId);
    if (user) {
      const userMemories = pendingMemories.filter(m => m.userId === userId);
      
      // Create consolidation job
      await ctx.db.insert("memoryConsolidationJobs", {
        status: "pending",
        userId,
        enterpriseId: user.enterpriseId,
        shortTermMemoryIds: userMemories.map(m => m._id),
        memoriesProcessed: 0,
        memoriesConsolidated: 0,
        patternsFound: 0,
      });
      
      jobsCreated++;
    }
  }

  return jobsCreated;
}

async function optimizeMemoryAssociationsInternal(ctx: any) {
  // Clean up orphaned associations and apply decay
  const associations = await ctx.db.query("memoryAssociations").collect();
  
  for (const association of associations) {
    const fromMemory = await ctx.db.get(association.fromMemoryId);
    const toMemory = await ctx.db.get(association.toMemoryId);

    if (!fromMemory || !toMemory) {
      await ctx.db.delete(association._id);
      continue;
    }

    // Apply decay
    const daysSinceReinforcement = 
      (Date.now() - new Date(association.lastReinforcedAt).getTime()) / 
      (24 * 60 * 60 * 1000);
    
    const newStrength = Math.max(0, association.strength - (0.01 * daysSinceReinforcement));

    if (newStrength < 0.1) {
      await ctx.db.delete(association._id);
    } else {
      await ctx.db.patch(association._id, {
        strength: newStrength,
      });
    }
  }
}

function hashContent(content: string): string {
  // Simple hash function for duplicate detection
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}

function groupByType(memories: Array<{ memoryType: string }>): Record<string, number> {
  const grouped: Record<string, number> = {};
  memories.forEach(memory => {
    grouped[memory.memoryType] = (grouped[memory.memoryType] || 0) + 1;
  });
  return grouped;
}

function generateMemoryRecommendations(
  shortTermMemories: Doc<"shortTermMemory">[],
  longTermMemories: Doc<"longTermMemory">[],
  conversations: Doc<"conversationThreads">[]
): string[] {
  const recommendations: string[] = [];

  // Check for consolidation needs
  const pendingConsolidation = shortTermMemories.filter(m => m.shouldConsolidate).length;
  if (pendingConsolidation > 20) {
    recommendations.push(`Consider consolidating ${pendingConsolidation} pending memories`);
  }

  // Check for conversation cleanup
  const activeConversations = conversations.filter(c => c.status === "active").length;
  if (activeConversations > 10) {
    recommendations.push(`Consider archiving some of the ${activeConversations} active conversations`);
  }

  // Check memory distribution
  const totalMemories = shortTermMemories.length + longTermMemories.length;
  const shortTermRatio = shortTermMemories.length / totalMemories;
  if (shortTermRatio > 0.8) {
    recommendations.push("High ratio of short-term memories - consider more frequent consolidation");
  }

  // Check for weak long-term memories
  const weakMemories = longTermMemories.filter(m => m.strength < 0.3).length;
  if (weakMemories > 0) {
    recommendations.push(`${weakMemories} weak long-term memories could be cleaned up`);
  }

  return recommendations;
}