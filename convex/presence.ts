import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getSecurityContext } from "./security/rowLevelSecurity";

/**
 * Real-time Presence System
 * 
 * Tracks who's online, what they're working on, and enables
 * real-time collaboration features
 */

/**
 * Update user presence - call this periodically from frontend
 */
export const updatePresence = mutation({
  args: {
    activity: v.optional(v.object({
      type: v.union(
        v.literal("viewing_contract"),
        v.literal("editing_contract"), 
        v.literal("viewing_vendor"),
        v.literal("dashboard"),
        v.literal("idle")
      ),
      resourceId: v.optional(v.string()),
      resourceTitle: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const security = await getSecurityContext(ctx);
    
    // Find existing presence record
    const existingPresence = await ctx.db
      .query("userPresence")
      .withIndex("by_user", (q) => q.eq("userId", security.userId))
      .first();

    const presenceData = {
      userId: security.userId,
      enterpriseId: security.enterpriseId,
      lastSeen: new Date().toISOString(),
      isOnline: true,
      activity: args.activity || { type: "dashboard" as const },
    };

    if (existingPresence) {
      await ctx.db.patch(existingPresence._id, presenceData);
    } else {
      await ctx.db.insert("userPresence", presenceData);
    }
  },
});

/**
 * Mark user as offline
 */
export const setOffline = mutation({
  args: {},
  handler: async (ctx) => {
    const security = await getSecurityContext(ctx);
    
    const existingPresence = await ctx.db
      .query("userPresence")
      .withIndex("by_user", (q) => q.eq("userId", security.userId))
      .first();

    if (existingPresence) {
      await ctx.db.patch(existingPresence._id, {
        isOnline: false,
        lastSeen: new Date().toISOString(),
        activity: { type: "idle" as const },
      });
    }
  },
});

/**
 * Subscribe to online users in the enterprise
 */
export const subscribeToOnlineUsers = query({
  args: {},
  handler: async (ctx) => {
    const security = await getSecurityContext(ctx);
    
    // Get all recent presence records for the enterprise
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const presenceRecords = await ctx.db
      .query("userPresence")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", security.enterpriseId))
      .filter((q) => 
        q.and(
          q.gte(q.field("lastSeen"), fiveMinutesAgo),
          q.eq(q.field("isOnline"), true)
        )
      )
      .collect();

    // Enrich with user data
    const onlineUsers = await Promise.all(
      presenceRecords.map(async (presence) => {
        const user = await ctx.db.get(presence.userId);
        if (!user) return null;

        return {
          userId: user._id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          email: user.email,
          role: user.role,
          activity: presence.activity,
          lastSeen: presence.lastSeen,
        };
      })
    );

    return onlineUsers.filter(user => user !== null);
  },
});

/**
 * Subscribe to who's viewing/editing a specific contract
 */
export const subscribeToContractViewers = query({
  args: {
    contractId: v.id("contracts"),
  },
  handler: async (ctx, args) => {
    const security = await getSecurityContext(ctx);
    
    // Verify user has access to this contract
    const contract = await ctx.db.get(args.contractId);
    if (!contract || contract.enterpriseId !== security.enterpriseId) {
      return [];
    }

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const viewers = await ctx.db
      .query("userPresence")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", security.enterpriseId))
      .filter((q) => 
        q.and(
          q.gte(q.field("lastSeen"), twoMinutesAgo),
          q.eq(q.field("isOnline"), true)
        )
      )
      .collect();

    // Filter to users viewing this specific contract
    const contractViewers = viewers.filter(presence => 
      presence.activity?.resourceId === args.contractId &&
      (presence.activity?.type === "viewing_contract" || presence.activity?.type === "editing_contract")
    );

    // Enrich with user data
    const enrichedViewers = await Promise.all(
      contractViewers.map(async (presence) => {
        const user = await ctx.db.get(presence.userId);
        if (!user) return null;

        return {
          userId: user._id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          activity: presence.activity,
          lastSeen: presence.lastSeen,
          isCurrentUser: user._id === security.userId,
        };
      })
    );

    return enrichedViewers.filter(viewer => viewer !== null);
  },
});

/**
 * Subscribe to enterprise activity feed
 */
export const subscribeToActivityFeed = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const security = await getSecurityContext(ctx);
    
    // Get recent presence updates and audit logs
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Get recent user activities
    const recentPresence = await ctx.db
      .query("userPresence")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", security.enterpriseId))
      .filter((q) => q.gte(q.field("lastSeen"), oneHourAgo))
      .collect();

    // Get recent audit events
    const recentAudit = await ctx.db
      .query("auditLogs")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", security.enterpriseId))
      .filter((q) => q.gte(q.field("timestamp"), oneHourAgo))
      .order("desc")
      .take(20);

    // Combine and sort activities
    const activities: any[] = [];

    // Add significant presence activities
    for (const presence of recentPresence) {
      if (presence.activity?.type === "editing_contract" || presence.activity?.type === "viewing_contract") {
        const user = await ctx.db.get(presence.userId);
        if (user) {
          activities.push({
            type: "presence",
            timestamp: presence.lastSeen,
            user: {
              _id: user._id,
              name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            },
            activity: presence.activity,
          });
        }
      }
    }

    // Add audit events
    for (const audit of recentAudit) {
      if (audit.status === "success" && ["create", "update", "delete"].includes(audit.action)) {
        const user = await ctx.db.get(audit.userId);
        if (user) {
          activities.push({
            type: "action",
            timestamp: audit.timestamp,
            user: {
              _id: user._id,
              name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            },
            action: audit.action,
            resourceType: audit.resourceType,
            operation: audit.operation,
          });
        }
      }
    }

    // Sort by timestamp and limit
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, args.limit || 10);
  },
});

/**
 * Clean up old presence records
 */
export const cleanupPresence = internalMutation({
  args: {},
  handler: async (ctx) => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Mark old presence records as offline
    const oldPresence = await ctx.db
      .query("userPresence")
      .filter((q) => q.lt(q.field("lastSeen"), oneHourAgo))
      .collect();

    for (const presence of oldPresence) {
      if (presence.isOnline) {
        await ctx.db.patch(presence._id, {
          isOnline: false,
          activity: { type: "idle" as const },
        });
      }
    }

    // Delete very old presence records (older than 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const veryOldPresence = await ctx.db
      .query("userPresence")
      .filter((q) => q.lt(q.field("lastSeen"), oneDayAgo))
      .collect();

    for (const presence of veryOldPresence) {
      await ctx.db.delete(presence._id);
    }
  },
});