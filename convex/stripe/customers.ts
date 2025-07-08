import { v } from "convex/values";
import { mutation, query, action } from "../_generated/server";
import { getStripe } from "./config";
import type { Id } from "../_generated/dataModel";
import { api as convexApi } from "../_generated/api";

// Create or get a Stripe customer for an enterprise
export const createOrGetStripeCustomer = action({
  args: {
    enterpriseId: v.id("enterprises"),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const stripe = await getStripe();
    
    // Check if customer already exists in our database
    const existingCustomer = await ctx.runQuery(convexApi.stripe.storeCustomer, {
      enterpriseId: args.enterpriseId,
    });
    
    if (existingCustomer) {
      return existingCustomer.stripeCustomerId;
    }
    
    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email: args.email,
      name: args.name,
      metadata: {
        enterpriseId: args.enterpriseId,
      },
    });
    
    // Store customer in our database
    await ctx.runMutation(convexApi.stripe.storeCustomer, {
      enterpriseId: args.enterpriseId,
      stripeCustomerId: customer.id,
      email: args.email,
    });
    
    return customer.id;
  },
});

// Store Stripe customer in database
export const store = mutation({
  args: {
    enterpriseId: v.id("enterprises"),
    stripeCustomerId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    return await ctx.db.insert("stripeCustomers", {
      enterpriseId: args.enterpriseId,
      stripeCustomerId: args.stripeCustomerId,
      email: args.email,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Get Stripe customer by enterprise ID
export const getByEnterpriseId = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("stripeCustomers")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .first();
  },
});

// Update customer email
export const updateEmail = mutation({
  args: {
    enterpriseId: v.id("enterprises"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("stripeCustomers")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .first();
    
    if (!customer) {
      throw new Error("Customer not found");
    }
    
    await ctx.db.patch(customer._id, {
      email: args.email,
      updatedAt: Date.now(),
    });
    
    return customer._id;
  },
});

// Sync customer data from Stripe
export const syncFromStripe = action({
  args: {
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const stripe = await getStripe();
    
    // Fetch customer from Stripe
    const customer = await stripe.customers.retrieve(args.stripeCustomerId);
    
    if (customer.deleted) {
      throw new Error("Customer has been deleted in Stripe");
    }
    
    // Update our database
    const enterpriseId = customer.metadata.enterpriseId as Id<"enterprises">;
    
    if (!enterpriseId) {
      throw new Error("Customer missing enterpriseId in metadata");
    }
    
    await ctx.runMutation(convexApi.stripe.storeCustomer, {
      enterpriseId,
      email: customer.email || "",
    });
    
    return customer;
  },
});

// API export for internal use
export const stripeCustomersApi = {
  stripe: {
    customers: {
      store,
      getByEnterpriseId,
      updateEmail,
    },
  },
};