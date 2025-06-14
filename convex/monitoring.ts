import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

// Analytics event schema
const analyticsEventSchema = v.object({
  event: v.string(),
  timestamp: v.number(),
  url: v.string(),
  userId: v.optional(v.string()),
  properties: v.optional(v.object({})),
  sessionId: v.string(),
  userAgent: v.optional(v.string()),
  ip: v.optional(v.string()),
});

// Error report schema
const errorReportSchema = v.object({
  message: v.string(),
  stack: v.optional(v.string()),
  timestamp: v.number(),
  url: v.string(),
  userId: v.optional(v.string()),
  sessionId: v.string(),
  userAgent: v.string(),
  context: v.optional(v.object({})),
});

/**
 * Log analytics event
 */
export const logAnalyticsEvent = mutation({
  args: analyticsEventSchema,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    
    // Get user for enterprise context
    const user = identity ? await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first() : null;

    // Store analytics event
    const eventId = await ctx.db.insert("analytics_events", {
      ...args,
      authenticatedUserId: user?._id,
      enterpriseId: user?.enterpriseId,
      serverTimestamp: Date.now(),
      createdAt: new Date().toISOString(),
    });

    // Log important events to console in development
    if (process.env.NODE_ENV === 'development' && 
        ['error', 'form_submit', 'feature_usage'].includes(args.event)) {
      console.log('Analytics Event:', {
        id: eventId,
        event: args.event,
        userId: user?._id,
        timestamp: new Date(args.timestamp).toISOString(),
      });
    }

    return eventId;
  },
});

/**
 * Log batch analytics events
 */
export const logAnalyticsEventBatch = mutation({
  args: {
    events: v.array(analyticsEventSchema),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    
    // Get user for enterprise context
    const user = identity ? await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first() : null;

    // Validate events
    const validEvents = args.events.filter(event => 
      event.event && event.timestamp && event.sessionId
    );

    if (validEvents.length === 0) {
      throw new ConvexError("No valid events found");
    }

    // Insert all events
    const eventIds = await Promise.all(
      validEvents.map(event => 
        ctx.db.insert("analytics_events", {
          ...event,
          authenticatedUserId: user?._id,
          enterpriseId: user?.enterpriseId,
          serverTimestamp: Date.now(),
          createdAt: new Date().toISOString(),
        })
      )
    );

    console.log(`Processed analytics batch: ${eventIds.length} events`);

    return {
      success: true,
      processed: eventIds.length,
      skipped: args.events.length - validEvents.length,
      eventIds,
    };
  },
});

/**
 * Get analytics events (for development/admin)
 */
export const getAnalyticsEvents = query({
  args: {
    limit: v.optional(v.number()),
    eventType: v.optional(v.string()),
    enterpriseId: v.optional(v.id("enterprises")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Get user to check permissions
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    // Only allow admin/owner roles to view analytics in development
    if (process.env.NODE_ENV === 'development' && 
        ['admin', 'owner'].includes(user.role)) {
      
      let eventsQuery = ctx.db.query("analytics_events");
      
      // Filter by enterprise if specified
      if (args.enterpriseId) {
        eventsQuery = eventsQuery.filter(q => q.eq(q.field("enterpriseId"), args.enterpriseId));
      } else if (user.enterpriseId) {
        eventsQuery = eventsQuery.filter(q => q.eq(q.field("enterpriseId"), user.enterpriseId));
      }

      // Filter by event type if specified
      if (args.eventType) {
        eventsQuery = eventsQuery.filter(q => q.eq(q.field("event"), args.eventType));
      }

      const events = await eventsQuery
        .order("desc")
        .take(args.limit || 100);

      return {
        events,
        total: events.length,
        timestamp: new Date().toISOString(),
      };
    }

    throw new ConvexError("Unauthorized");
  },
});

/**
 * Report error
 */
export const reportError = mutation({
  args: errorReportSchema,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    
    // Get user for enterprise context
    const user = identity ? await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first() : null;

    // Store error report
    const errorId = await ctx.db.insert("error_reports", {
      ...args,
      authenticatedUserId: user?._id,
      enterpriseId: user?.enterpriseId,
      serverTimestamp: Date.now(),
      createdAt: new Date().toISOString(),
    });

    // Log error to console
    console.error('Client Error Report:', {
      id: errorId,
      message: args.message,
      stack: args.stack,
      url: args.url,
      userId: user?._id,
      timestamp: new Date(args.timestamp).toISOString(),
    });

    // In production, you could integrate with external error tracking
    // Example: Send to Sentry, DataDog, etc.

    return errorId;
  },
});

/**
 * Get error reports (for development/admin)
 */
export const getErrorReports = query({
  args: {
    limit: v.optional(v.number()),
    enterpriseId: v.optional(v.id("enterprises")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Get user to check permissions
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    // Only allow admin/owner roles to view errors in development
    if (process.env.NODE_ENV === 'development' && 
        ['admin', 'owner'].includes(user.role)) {
      
      let errorsQuery = ctx.db.query("error_reports");
      
      // Filter by enterprise if specified
      if (args.enterpriseId) {
        errorsQuery = errorsQuery.filter(q => q.eq(q.field("enterpriseId"), args.enterpriseId));
      } else if (user.enterpriseId) {
        errorsQuery = errorsQuery.filter(q => q.eq(q.field("enterpriseId"), user.enterpriseId));
      }

      const errors = await errorsQuery
        .order("desc")
        .take(args.limit || 50);

      return {
        errors,
        total: errors.length,
        timestamp: new Date().toISOString(),
      };
    }

    throw new ConvexError("Unauthorized");
  },
});

/**
 * Health check
 */
export const getHealthStatus = query({
  args: {},
  handler: async (ctx) => {
    try {
      // Perform basic health checks
      const now = Date.now();
      
      // Check database connectivity by counting users
      const userCount = await ctx.db.query("users").collect().then(users => users.length);
      
      // Check if we can read (removed write test since this is a query)
      // const testId = await ctx.db.insert("health_checks", {
      //   timestamp: now,
      //   status: "test",
      //   createdAt: new Date().toISOString(),
      // });
      // const testRecord = await ctx.db.get(testId);
      // await ctx.db.delete(testId);

      return {
        status: "healthy",
        timestamp: new Date().toISOString(),
        checks: {
          database: "ok", // Simplified health check (write operations removed)
          userCount,
          responseTime: Date.now() - now,
        },
        version: process.env.NEXT_PUBLIC_APP_VERSION || "development",
        environment: process.env.NODE_ENV,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        version: process.env.NEXT_PUBLIC_APP_VERSION || "development",
        environment: process.env.NODE_ENV,
      };
    }
  },
});

/**
 * Get system metrics (for monitoring dashboard)
 */
export const getSystemMetrics = query({
  args: {
    timeRange: v.optional(v.union(v.literal("1h"), v.literal("1d"), v.literal("7d"))),
    enterpriseId: v.optional(v.id("enterprises")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Get user to check permissions
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || !['admin', 'owner'].includes(user.role)) {
      throw new ConvexError("Unauthorized");
    }

    const enterpriseId = args.enterpriseId || user.enterpriseId;
    const timeRange = args.timeRange || "1d";
    
    // Calculate time bounds
    const now = Date.now();
    const timeRangeMs = {
      "1h": 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
    }[timeRange];
    
    const since = now - timeRangeMs;

    // Get metrics
    const [
      activeUsers,
      totalContracts,
      recentErrors,
      recentEvents
    ] = await Promise.all([
      // Active users (users with recent events)
      ctx.db.query("analytics_events")
        .filter(q => q.and(
          q.eq(q.field("enterpriseId"), enterpriseId),
          q.gte(q.field("timestamp"), since)
        ))
        .collect()
        .then(events => new Set(events.map(e => e.authenticatedUserId)).size),
      
      // Total contracts
      ctx.db.query("contracts")
        .withIndex("by_enterprise", q => q.eq("enterpriseId", enterpriseId))
        .collect()
        .then(contracts => contracts.length),
      
      // Recent errors
      ctx.db.query("error_reports")
        .filter(q => q.and(
          q.eq(q.field("enterpriseId"), enterpriseId),
          q.gte(q.field("timestamp"), since)
        ))
        .collect(),
      
      // Recent events count
      ctx.db.query("analytics_events")
        .filter(q => q.and(
          q.eq(q.field("enterpriseId"), enterpriseId),
          q.gte(q.field("timestamp"), since)
        ))
        .collect()
    ]);

    return {
      timeRange,
      metrics: {
        activeUsers,
        totalContracts,
        errorCount: recentErrors.length,
        eventCount: recentEvents.length,
        errorRate: recentEvents.length > 0 ? (recentErrors.length / recentEvents.length) * 100 : 0,
      },
      timestamp: new Date().toISOString(),
    };
  },
});