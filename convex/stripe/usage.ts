import { v } from "convex/values";
import { mutation, query, action } from "../_generated/server";
import { getStripe } from "./config";
import type { Id } from "../_generated/dataModel";

// Plan limits configuration
const PLAN_LIMITS: Record<string, Record<string, number>> = {
  starter: {
    api_calls: 10000,
    contracts_processed: 100,
    users_active: 10,
  },
  professional: {
    api_calls: 100000,
    contracts_processed: 1000,
    users_active: 50,
  },
  enterprise: {
    api_calls: -1, // unlimited
    contracts_processed: -1,
    users_active: -1,
  },
};

// Track usage for a metric
export const trackUsage = mutation({
  args: {
    enterpriseId: v.id("enterprises"),
    metric: v.string(), // e.g., "api_calls", "contracts_processed", "users_active"
    quantity: v.number(),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    // Get active subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    
    if (!subscription) {
      console.warn("No active subscription for usage tracking");
      return null;
    }
    
    // Record usage
    return await ctx.db.insert("usageRecords", {
      enterpriseId: args.enterpriseId,
      subscriptionId: subscription.stripeSubscriptionId,
      metric: args.metric,
      quantity: args.quantity,
      timestamp: Date.now(),
      metadata: args.metadata,
    });
  },
});

// Get usage for a period
export const getUsage = query({
  args: {
    enterpriseId: v.id("enterprises"),
    metric: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("usageRecords")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId));
    
    const records = await query.collect();
    
    // Filter by metric if specified
    let filtered = records;
    if (args.metric) {
      filtered = filtered.filter(r => r.metric === args.metric);
    }
    
    // Filter by time range if specified
    if (args.startTime !== undefined) {
      filtered = filtered.filter(r => r.timestamp >= args.startTime!);
    }
    if (args.endTime !== undefined) {
      filtered = filtered.filter(r => r.timestamp <= args.endTime!);
    }
    
    return filtered;
  },
});

// Get usage summary for current billing period
export const getCurrentPeriodUsage = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    // Get active subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    
    if (!subscription) {
      return null;
    }
    
    // Get usage records for current period
    const records = await ctx.db
      .query("usageRecords")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .collect();
    
    const periodRecords = records.filter(
      r => r.timestamp >= subscription.currentPeriodStart && 
           r.timestamp <= subscription.currentPeriodEnd
    );
    
    // Aggregate by metric
    const usage: Record<string, number> = {};
    for (const record of periodRecords) {
      usage[record.metric] = (usage[record.metric] || 0) + record.quantity;
    }
    
    const limits = PLAN_LIMITS[subscription.plan] || {};
    
    return {
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      usage,
      limits,
      plan: subscription.plan,
    };
  },
});

// Check if usage limit exceeded
export const checkUsageLimit = query({
  args: {
    enterpriseId: v.id("enterprises"),
    metric: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the subscription for this enterprise
    const subscription = await ctx.db.query("stripeSubscriptions")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    
    if (!subscription) {
      // No subscription, allow with warning
      return { allowed: true, warning: "No active subscription" };
    }
    
    // Get usage for this metric
    const startOfPeriod = new Date(subscription.currentPeriodStart).getTime();
    const usageRecords = await ctx.db.query("usageRecords")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .filter((q) => 
        q.and(
          q.eq(q.field("metric"), args.metric),
          q.gte(q.field("timestamp"), startOfPeriod)
        )
      )
      .collect();
    
    const used = usageRecords.reduce((sum, record) => sum + record.quantity, 0);
    const limits = PLAN_LIMITS[subscription.plan] || {};
    const limit = limits[args.metric];
    
    if (limit === -1) {
      // Unlimited
      return { allowed: true };
    }
    
    if (!limit) {
      // No limit defined for this metric
      return { allowed: true };
    }
    
    if (used >= limit) {
      return {
        allowed: false,
        used,
        limit,
        message: `Usage limit exceeded for ${args.metric}. Upgrade your plan to continue.`,
      };
    }
    
    // Check if approaching limit (80%)
    if (used >= limit * 0.8) {
      return {
        allowed: true,
        warning: `Approaching usage limit for ${args.metric} (${used}/${limit})`,
        used,
        limit,
      };
    }
    
    return { allowed: true, used, limit };
  },
});

// Report usage to Stripe (for metered billing)
export const reportUsageToStripe = action({
  args: {
    enterpriseId: v.id("enterprises"),
    metric: v.string(),
    quantity: v.number(),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const stripe = getStripe();
    
    // Get active subscription
    const subscription = await ctx.runQuery(api.stripe.subscriptions.getActiveSubscription, {
      enterpriseId: args.enterpriseId,
    });
    
    if (!subscription) {
      throw new Error("No active subscription");
    }
    
    // Get the subscription from Stripe to find the metered item
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    
    // Find the subscription item for this metric
    const meteredItem = stripeSubscription.items.data.find(
      item => item.price.recurring?.usage_type === "metered" && 
              item.price.metadata?.metric === args.metric
    );
    
    if (!meteredItem) {
      console.warn(`No metered billing item found for metric: ${args.metric}`);
      return null;
    }
    
    // Create usage record in Stripe
    const usageRecord = await (stripe.subscriptionItems as any).createUsageRecord(
      meteredItem.id,
      {
        quantity: Math.round(args.quantity),
        timestamp: args.timestamp ? Math.floor(args.timestamp / 1000) : undefined,
        action: "increment", // or "set" to overwrite
      }
    );
    
    return usageRecord;
  },
});

// Helper API reference
const api = {
  stripe: {
    subscriptions: {
      getActiveSubscription: {} as any,
    },
  },
};