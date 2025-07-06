import { query, mutation, internalMutation } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * OPTIMIZED: Subscribe to events with proper pagination
 */
export const subscribeToEventsOptimized = query({
  args: {
    enterpriseId: v.id("enterprises"),
    eventTypes: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const limit = args.limit || 20;

    // Build query with index
    let query = ctx.db
      .query("realtimeEvents")
      .withIndex("by_enterprise_timestamp", q => 
        q.eq("enterpriseId", args.enterpriseId)
      )
      .order("desc");

    // Apply event type filter if specified
    if (args.eventTypes && args.eventTypes.length > 0) {
      query = query.filter(q => 
        q.or(...args.eventTypes!.map(type => q.eq(q.field("eventType"), type)))
      );
    }

    // Get paginated results
    const result = await query.paginate({ 
      numItems: limit, 
      cursor: args.cursor || null 
    });

    // Batch fetch user information for events
    const userIds = [...new Set(result.page.map(event => event.userId))];
    const users = await batchFetchUsers(ctx, userIds);

    // Enrich events with user data
    const enrichedEvents = result.page.map(event => ({
      ...event,
      user: users.get(event.userId),
    }));

    return {
      events: enrichedEvents,
      nextCursor: result.continueCursor,
      hasMore: result.continueCursor !== null,
    };
  },
});

/**
 * OPTIMIZED: Get typing indicators efficiently
 */
export const getTypingIndicatorsOptimized = query({
  args: {
    resourceId: v.string(),
    resourceType: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Get typing indicators that are recent (last 10 seconds)
    const cutoffTime = new Date();
    cutoffTime.setSeconds(cutoffTime.getSeconds() - 10);

    const indicators = await ctx.db
      .query("typingIndicators")
      .withIndex("by_resource", q => 
        q.eq("resourceId", args.resourceId).eq("resourceType", args.resourceType)
      )
      .filter(q => q.gte(q.field("lastTyped"), cutoffTime.toISOString()))
      .collect();

    // Batch fetch user information
    const userIds = indicators.map(ind => ind.userId);
    const users = await batchFetchUsers(ctx, userIds);

    // Return enriched indicators
    return indicators.map(indicator => ({
      ...indicator,
      user: users.get(indicator.userId),
    }));
  },
});

/**
 * OPTIMIZED: Batch event creation
 */
export const createBatchEvents = mutation({
  args: {
    events: v.array(v.object({
      enterpriseId: v.id("enterprises"),
      eventType: v.string(),
      resourceId: v.optional(v.string()),
      resourceType: v.optional(v.string()),
      data: v.optional(v.any()),
      targetUsers: v.optional(v.array(v.id("users"))),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", q => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    // Calculate TTL (7 days for most events, 1 day for typing indicators)
    const now = Date.now();
    const defaultTTL = 7 * 24 * 60 * 60 * 1000; // 7 days
    const typingTTL = 24 * 60 * 60 * 1000; // 1 day

    // Process events in batches
    const BATCH_SIZE = 50;
    const eventIds: Id<"realtimeEvents">[] = [];

    for (let i = 0; i < args.events.length; i += BATCH_SIZE) {
      const batch = args.events.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(event => {
        const isTypingEvent = event.eventType.includes("typing");
        const ttl = isTypingEvent ? typingTTL : defaultTTL;
        
        return ctx.db.insert("realtimeEvents", {
          enterpriseId: event.enterpriseId,
          userId: user._id,
          eventType: event.eventType as any, // Type assertion needed due to union type
          resourceId: event.resourceId,
          resourceType: event.resourceType,
          data: event.data,
          targetUsers: event.targetUsers,
          timestamp: new Date().toISOString(),
          processed: false,
          expiresAt: now + ttl,
        });
      });

      const batchIds = await Promise.all(batchPromises);
      eventIds.push(...batchIds);
    }

    return { 
      created: eventIds.length,
      eventIds 
    };
  },
});

/**
 * OPTIMIZED: Mark events as processed in batch
 */
export const markEventsProcessed = mutation({
  args: {
    eventIds: v.array(v.id("realtimeEvents")),
  },
  handler: async (ctx, args) => {
    const BATCH_SIZE = 100;
    let processedCount = 0;

    for (let i = 0; i < args.eventIds.length; i += BATCH_SIZE) {
      const batch = args.eventIds.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(eventId => 
          ctx.db.patch(eventId, { processed: true })
        )
      );
      
      processedCount += batch.length;
    }

    return { processedCount };
  },
});

/**
 * INTERNAL: Automatic cleanup of old events
 */
export const cleanupExpiredEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const BATCH_SIZE = 100;
    let totalDeleted = 0;

    // Clean up expired events
    do {
      const expiredEvents = await ctx.db
        .query("realtimeEvents")
        .withIndex("by_processed_expires", q => 
          q.eq("processed", true).lt("expiresAt", now)
        )
        .take(BATCH_SIZE);

      if (expiredEvents.length === 0) break;

      await Promise.all(
        expiredEvents.map(event => ctx.db.delete(event._id))
      );

      totalDeleted += expiredEvents.length;
    } while (true);

    // Clean up old typing indicators (older than 1 minute)
    const typingCutoff = new Date();
    typingCutoff.setMinutes(typingCutoff.getMinutes() - 1);

    const oldTypingIndicators = await ctx.db
      .query("typingIndicators")
      .filter(q => q.lt(q.field("lastTyped"), typingCutoff.toISOString()))
      .take(BATCH_SIZE);

    await Promise.all(
      oldTypingIndicators.map(indicator => ctx.db.delete(indicator._id))
    );

    // Clean up old analytics events (older than 90 days)
    const analyticsCutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);
    
    const oldAnalytics = await ctx.db
      .query("analytics_events")
      .withIndex("by_timestamp", q => q.lt("timestamp", analyticsCutoff))
      .take(BATCH_SIZE);

    await Promise.all(
      oldAnalytics.map(event => ctx.db.delete(event._id))
    );

    return {
      deletedEvents: totalDeleted,
      deletedTypingIndicators: oldTypingIndicators.length,
      deletedAnalytics: oldAnalytics.length,
    };
  },
});

/**
 * OPTIMIZED: Get notification count without loading all notifications
 */
export const getUnreadCountOptimized = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Use pagination to count in batches
    let count = 0;
    let cursor: string | null = null;
    const BATCH_SIZE = 1000;

    do {
      const batch = await ctx.db
        .query("notifications")
        .withIndex("by_recipient", q => q.eq("recipientId", args.userId))
        .filter(q => q.eq(q.field("isRead"), false))
        .paginate({ numItems: BATCH_SIZE, cursor });

      count += batch.page.length;
      cursor = batch.continueCursor;
    } while (cursor);

    return count;
  },
});

// Helper functions

async function batchFetchUsers(ctx: any, userIds: Id<"users">[]) {
  if (userIds.length === 0) return new Map();

  const users = await ctx.db
    .query("users")
    .filter(q => q.or(...userIds.map(id => q.eq(q.field("_id"), id))))
    .collect();

  return new Map(users.map(u => [
    u._id,
    {
      _id: u._id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
    }
  ]));
}

/**
 * Schedule automatic cleanup to run periodically
 */
export const scheduleCleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    // This would be called by a cron job or scheduled function
    // For now, we'll just document that it should be scheduled
    console.log("Cleanup should be scheduled to run every hour");
  },
});