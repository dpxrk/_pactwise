import { v } from "convex/values";
import { action } from "../_generated/server";
import { getStripe, getStripePriceId } from "./config";
import { createOrGetStripeCustomer } from "./customers";
import type { Id } from "../_generated/dataModel";

// Create a Stripe checkout session
export const createCheckoutSession = action({
  args: {
    plan: v.union(v.literal("starter"), v.literal("professional")),
    billingPeriod: v.union(v.literal("monthly"), v.literal("annual")),
    enterpriseId: v.id("enterprises"),
    userId: v.id("users"),
    email: v.string(),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const stripe = getStripe();
    
    // Create or get Stripe customer
    const customerId = await createOrGetStripeCustomer(ctx, {
      enterpriseId: args.enterpriseId,
      email: args.email,
    });
    
    // Get the price ID for the selected plan
    const priceId = getStripePriceId(args.plan, args.billingPeriod);
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      mode: "subscription",
      allow_promotion_codes: true,
      billing_address_collection: "required",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14, // 14-day free trial
        metadata: {
          enterpriseId: args.enterpriseId,
          userId: args.userId,
          plan: args.plan,
          billingPeriod: args.billingPeriod,
        },
      },
      metadata: {
        enterpriseId: args.enterpriseId,
        userId: args.userId,
        plan: args.plan,
        billingPeriod: args.billingPeriod,
      },
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    });
    
    return {
      sessionId: session.id,
      url: session.url,
    };
  },
});

// Create a portal session for managing subscription
export const createPortalSession = action({
  args: {
    enterpriseId: v.id("enterprises"),
    returnUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const stripe = getStripe();
    
    // Get the Stripe customer
    const customer = await ctx.runQuery(api.stripe.customers.getByEnterpriseId, {
      enterpriseId: args.enterpriseId,
    });
    
    if (!customer) {
      throw new Error("No Stripe customer found for this enterprise");
    }
    
    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: args.returnUrl,
    });
    
    return {
      url: session.url,
    };
  },
});

// Create a setup session for adding payment method without immediate payment
export const createSetupSession = action({
  args: {
    enterpriseId: v.id("enterprises"),
    userId: v.id("users"),
    email: v.string(),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const stripe = getStripe();
    
    // Create or get Stripe customer
    const customerId = await createOrGetStripeCustomer(ctx, {
      enterpriseId: args.enterpriseId,
      email: args.email,
    });
    
    // Create setup session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      mode: "setup",
      metadata: {
        enterpriseId: args.enterpriseId,
        userId: args.userId,
      },
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    });
    
    return {
      sessionId: session.id,
      url: session.url,
    };
  },
});

// Helper API exports
const api = {
  stripe: {
    customers: {
      getByEnterpriseId: {} as any, // This will be imported from customers.ts
    },
  },
};