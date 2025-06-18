import { mutation, query, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { getSecurityContext } from "../security/rowLevelSecurity";

/**
 * Real-time Event System
 * 
 * Handles broadcasting events across the application for real-time updates
 * Events are enterprise-scoped for security
 */

/**
 * Broadcast a real-time event to all users in the enterprise
 */
export const broadcastEvent = mutation({
  args: {
    eventType: v.union(
      v.literal("contract_updated"),
      v.literal("contract_created"),
      v.literal("contract_deleted"),
      v.literal("vendor_updated"),
      v.literal("vendor_created"),
      v.literal("analysis_completed"),
      v.literal("notification_created"),
      v.literal("user_joined"),
      v.literal("user_left"),
      v.literal("system_alert")
    ),
    resourceId: v.optional(v.string()),
    resourceType: v.optional(v.string()),
    data: v.optional(v.any()),
    targetUsers: v.optional(v.array(v.id("users"))), // If specified, only these users receive the event
  },
  handler: async (ctx, args) => {
    const security = await getSecurityContext(ctx);
    
    // Create the event record
    await ctx.db.insert("realtimeEvents", {
      enterpriseId: security.enterpriseId,
      userId: security.userId,
      eventType: args.eventType,
      ...(args.resourceId && { resourceId: args.resourceId }),
      ...(args.resourceType && { resourceType: args.resourceType }),
      ...(args.data && { data: args.data }),
      ...(args.targetUsers && { targetUsers: args.targetUsers }),
      timestamp: new Date().toISOString(),
      processed: false,
    });
  },
});

/**
 * Subscribe to real-time events for the current user
 */
export const subscribeToEvents = query({
  args: {
    since: v.optional(v.string()), // ISO timestamp
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const security = await getSecurityContext(ctx);
    
    // Get events for this enterprise since the specified time
    const since = args.since || new Date(Date.now() - 5 * 60 * 1000).toISOString(); // Default: last 5 minutes
    
    let events = await ctx.db
      .query("realtimeEvents")
      .withIndex("by_enterprise_timestamp", (q) => 
        q.eq("enterpriseId", security.enterpriseId)
         .gte("timestamp", since)
      )
      .order("desc")
      .take(args.limit || 50);

    // Filter events that are either for everyone or specifically for this user
    const relevantEvents = events.filter(event => 
      !event.targetUsers || 
      event.targetUsers.includes(security.userId) ||
      event.userId === security.userId
    );

    // Enrich events with user data
    const enrichedEvents = await Promise.all(
      relevantEvents.map(async (event) => {
        const user = await ctx.db.get(event.userId);
        
        return {
          ...event,
          user: user ? {
            _id: user._id,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            email: user.email,
          } : null,
        };
      })
    );

    return enrichedEvents;
  },
});

/**
 * Subscribe to live contract analysis updates
 */
export const subscribeToAnalysisEvents = query({
  args: {
    contractId: v.optional(v.id("contracts")),
  },
  handler: async (ctx, args) => {
    const security = await getSecurityContext(ctx);
    
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    let events = await ctx.db
      .query("realtimeEvents")
      .withIndex("by_enterprise_timestamp", (q) => 
        q.eq("enterpriseId", security.enterpriseId)
         .gte("timestamp", fiveMinutesAgo)
      )
      .filter((q) => q.eq(q.field("eventType"), "analysis_completed"))
      .collect();

    // Filter to specific contract if provided
    if (args.contractId) {
      events = events.filter(event => event.resourceId === args.contractId);
    }

    return events.map(event => ({
      _id: event._id,
      contractId: event.resourceId,
      eventType: event.eventType,
      data: event.data,
      timestamp: event.timestamp,
    }));
  },
});

/**
 * Create a system-wide notification event
 */
export const createSystemAlert = mutation({
  args: {
    alertType: v.union(
      v.literal("maintenance"),
      v.literal("update"),
      v.literal("security"),
      v.literal("info")
    ),
    title: v.string(),
    message: v.string(),
    severity: v.union(
      v.literal("low"),
      v.literal("medium"), 
      v.literal("high"),
      v.literal("critical")
    ),
    targetRoles: v.optional(v.array(v.string())), // Only users with these roles see the alert
  },
  handler: async (ctx, args) => {
    const security = await getSecurityContext(ctx);
    
    // Only admins and owners can create system alerts
    if (!["owner", "admin"].includes(security.role)) {
      throw new Error("Access denied: Only admins can create system alerts");
    }

    // Get users to target
    let targetUsers: Id<"users">[] | undefined;
    if (args.targetRoles) {
      const users = await ctx.db
        .query("users")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", security.enterpriseId))
        .collect();
      
      targetUsers = users
        .filter(user => args.targetRoles!.includes(user.role))
        .map(user => user._id);
    }

    // Broadcast the alert event
    await ctx.db.insert("realtimeEvents", {
      enterpriseId: security.enterpriseId,
      userId: security.userId,
      eventType: "system_alert",
      resourceType: "system",
      data: {
        alertType: args.alertType,
        title: args.title,
        message: args.message,
        severity: args.severity,
      },
      ...(targetUsers && { targetUsers }),
      timestamp: new Date().toISOString(),
      processed: false,
    });
  },
});

/**
 * Mark events as processed (for cleanup)
 */
export const markEventsProcessed = mutation({
  args: {
    eventIds: v.array(v.id("realtimeEvents")),
  },
  handler: async (ctx, args) => {
    const security = await getSecurityContext(ctx);
    
    for (const eventId of args.eventIds) {
      const event = await ctx.db.get(eventId);
      if (event && event.enterpriseId === security.enterpriseId) {
        await ctx.db.patch(eventId, { processed: true });
      }
    }
  },
});

/**
 * Clean up old events
 */
export const cleanupEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Delete events older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const oldEvents = await ctx.db
      .query("realtimeEvents")
      .filter((q) => q.lt(q.field("timestamp"), oneDayAgo))
      .collect();

    for (const event of oldEvents) {
      await ctx.db.delete(event._id);
    }
  },
});

/**
 * Subscribe to typing indicators for collaborative editing
 */
export const subscribeToTypingIndicators = query({
  args: {
    resourceId: v.string(),
    resourceType: v.string(),
  },
  handler: async (ctx, args) => {
    const security = await getSecurityContext(ctx);
    
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    
    const typingEvents = await ctx.db
      .query("typingIndicators")
      .withIndex("by_resource", (q) => 
        q.eq("resourceId", args.resourceId)
         .eq("resourceType", args.resourceType)
      )
      .filter((q) => 
        q.and(
          q.eq(q.field("enterpriseId"), security.enterpriseId),
          q.gte(q.field("lastTyped"), thirtySecondsAgo),
          q.neq(q.field("userId"), security.userId) // Don't show current user
        )
      )
      .collect();

    // Enrich with user data
    const enrichedIndicators = await Promise.all(
      typingEvents.map(async (indicator) => {
        const user = await ctx.db.get(indicator.userId);
        if (!user) return null;

        return {
          userId: user._id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          lastTyped: indicator.lastTyped,
          field: indicator.field,
        };
      })
    );

    return enrichedIndicators.filter(indicator => indicator !== null);
  },
});

/**
 * Update typing indicator
 */
export const updateTypingIndicator = mutation({
  args: {
    resourceId: v.string(),
    resourceType: v.string(),
    field: v.optional(v.string()), // Which field they're typing in
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const security = await getSecurityContext(ctx);
    
    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_user_resource", (q) => 
        q.eq("userId", security.userId)
         .eq("resourceId", args.resourceId)
         .eq("resourceType", args.resourceType)
      )
      .first();

    if (args.isTyping) {
      const data = {
        userId: security.userId,
        enterpriseId: security.enterpriseId,
        resourceId: args.resourceId,
        resourceType: args.resourceType,
        ...(args.field && { field: args.field }),
        lastTyped: new Date().toISOString(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, data);
      } else {
        await ctx.db.insert("typingIndicators", data);
      }
    } else if (existing) {
      // Remove typing indicator when user stops typing
      await ctx.db.delete(existing._id);
    }
  },
});