import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Log user events for tracking user interactions
 */
export const logEvent = mutation({
  args: {
    event: v.string(),
    timestamp: v.optional(v.number()),
    url: v.optional(v.string()),
    userId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    properties: v.optional(v.any()), // Allow any properties for flexibility
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    
    // Get authenticated user if available
    const user = identity ? await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first() : null;

    // Extract values from properties if not provided at top level
    const properties = args.properties || {};
    const timestamp = args.timestamp || properties.timestamp || Date.now();
    const url = args.url || properties.url || '';
    const sessionId = args.sessionId || properties.sessionId || 'unknown';

    // Store user event
    const eventId = await ctx.db.insert("user_events", {
      event: args.event,
      timestamp,
      url,
      sessionId,
      userId: args.userId,
      userAgent: args.userAgent,
      properties: args.properties,
      ...(user?._id && { authenticatedUserId: user._id }),
      ...(user?.enterpriseId && { enterpriseId: user.enterpriseId }),
      serverTimestamp: Date.now(),
      createdAt: new Date().toISOString(),
    });

    // Log important events in development
    if (process.env.NODE_ENV === 'development' && 
        ['page_view', 'click', 'form_submit'].includes(args.event)) {
      console.log('User Event:', {
        id: eventId,
        event: args.event,
        userId: user?._id,
        timestamp: new Date(timestamp).toISOString(),
      });
    }

    return eventId;
  },
});