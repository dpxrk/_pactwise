import { v } from "convex/values";
import { mutation, query, action } from "../_generated/server";
import { getStripe } from "./config";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { PLANS, type PlanType, type BillingPeriod, type SubscriptionStatus } from "./types";

// Store subscription in database
export const store = mutation({
  args: {
    enterpriseId: v.id("enterprises"),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    status: v.string(),
    plan: v.string(),
    billingPeriod: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    canceledAt: v.optional(v.number()),
    trialEnd: v.optional(v.number()),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if subscription already exists
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_id", (q) => q.eq("stripeSubscriptionId", args.stripeSubscriptionId))
      .first();
    
    if (existing) {
      // Update existing subscription
      await ctx.db.patch(existing._id, {
        status: args.status as SubscriptionStatus,
        plan: args.plan as PlanType,
        billingPeriod: args.billingPeriod as BillingPeriod,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        canceledAt: args.canceledAt,
        trialEnd: args.trialEnd,
        metadata: args.metadata,
        updatedAt: now,
      });
      return existing._id;
    }
    
    // Create new subscription
    return await ctx.db.insert("subscriptions", {
      ...args,
      status: args.status as SubscriptionStatus,
      plan: args.plan as PlanType,
      billingPeriod: args.billingPeriod as BillingPeriod,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Get active subscription for enterprise
export const getActiveSubscription = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
  },
});

// Get all subscriptions for enterprise
export const getSubscriptions = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .order("desc")
      .collect();
  },
});

// Cancel subscription
export const cancelSubscription = action({
  args: {
    enterpriseId: v.id("enterprises"),
    immediately: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const stripe = getStripe();
    
    // Get active subscription
    const subscription = await ctx.runQuery(api.stripe.subscriptions.getActiveSubscription, {
      enterpriseId: args.enterpriseId,
    });
    
    if (!subscription) {
      throw new Error("No active subscription found");
    }
    
    // Cancel in Stripe
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: !args.immediately,
        proration_behavior: 'create_prorations',
      }
    );
    
    if (args.immediately) {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    }
    
    // Update in database
    await ctx.runMutation(api.stripe.subscriptions.store, {
      enterpriseId: args.enterpriseId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripeCustomerId: subscription.stripeCustomerId,
      status: args.immediately ? "canceled" : subscription.status,
      plan: subscription.plan,
      billingPeriod: subscription.billingPeriod,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: !args.immediately,
      canceledAt: Date.now(),
      trialEnd: subscription.trialEnd,
      metadata: subscription.metadata,
    });
    
    return updatedSubscription;
  },
});

// Resume canceled subscription
export const resumeSubscription = action({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const stripe = getStripe();
    
    // Get subscription that's set to cancel
    const subscription = await ctx.runQuery(api.stripe.subscriptions.getActiveSubscription, {
      enterpriseId: args.enterpriseId,
    });
    
    if (!subscription || !subscription.cancelAtPeriodEnd) {
      throw new Error("No subscription scheduled for cancellation");
    }
    
    // Resume in Stripe
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: false,
      }
    );
    
    // Update in database
    await ctx.runMutation(api.stripe.subscriptions.store, {
      enterpriseId: args.enterpriseId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripeCustomerId: subscription.stripeCustomerId,
      status: subscription.status,
      plan: subscription.plan,
      billingPeriod: subscription.billingPeriod,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: false,
      canceledAt: undefined,
      trialEnd: subscription.trialEnd,
      metadata: subscription.metadata,
    });
    
    return updatedSubscription;
  },
});

// Update subscription plan
export const updateSubscriptionPlan = action({
  args: {
    enterpriseId: v.id("enterprises"),
    newPlan: v.union(v.literal("starter"), v.literal("professional")),
    newBillingPeriod: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
  },
  handler: async (ctx, args) => {
    const stripe = getStripe();
    
    // Get current subscription
    const subscription = await ctx.runQuery(api.stripe.subscriptions.getActiveSubscription, {
      enterpriseId: args.enterpriseId,
    });
    
    if (!subscription) {
      throw new Error("No active subscription found");
    }
    
    // Get new price ID
    const billingPeriod = args.newBillingPeriod || subscription.billingPeriod;
    const priceId = process.env[`STRIPE_PRICE_ID_${args.newPlan.toUpperCase()}_${billingPeriod.toUpperCase()}`];
    
    if (!priceId) {
      throw new Error("Invalid plan or billing period");
    }
    
    // Get current subscription from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    
    // Update subscription
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items: [{
          id: stripeSubscription.items.data[0].id,
          price: priceId,
        }],
        proration_behavior: "create_prorations",
        metadata: {
          ...stripeSubscription.metadata,
          plan: args.newPlan,
          billingPeriod: billingPeriod,
        },
      }
    );
    
    // Update in database
    await ctx.runMutation(api.stripe.subscriptions.store, {
      enterpriseId: args.enterpriseId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripeCustomerId: subscription.stripeCustomerId,
      status: updatedSubscription.status as SubscriptionStatus,
      plan: args.newPlan,
      billingPeriod: billingPeriod as BillingPeriod,
      currentPeriodStart: (updatedSubscription as any).current_period_start * 1000,
      currentPeriodEnd: (updatedSubscription as any).current_period_end * 1000,
      cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
      canceledAt: subscription.canceledAt,
      trialEnd: updatedSubscription.trial_end ? updatedSubscription.trial_end * 1000 : undefined,
      metadata: updatedSubscription.metadata as Record<string, string>,
    });
    
    return updatedSubscription;
  },
});

// Check if enterprise has access to a feature based on their plan
export const hasFeatureAccess = query({
  args: {
    enterpriseId: v.id("enterprises"),
    feature: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    
    if (!subscription) {
      return false;
    }
    
    // Define feature access by plan
    const featureAccess: Record<string, PlanType[]> = {
      "advanced_analytics": ["professional", "enterprise"],
      "ai_insights": ["professional", "enterprise"],
      "custom_branding": ["professional", "enterprise"],
      "sso": ["enterprise"],
      "api_access": ["starter", "professional", "enterprise"],
      "unlimited_users": ["enterprise"],
      "priority_support": ["professional", "enterprise"],
    };
    
    const allowedPlans = featureAccess[args.feature];
    if (!allowedPlans) {
      // Unknown feature, default to allowing access
      return true;
    }
    
    return allowedPlans.includes(subscription.plan);
  },
});