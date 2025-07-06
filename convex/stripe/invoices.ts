import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// Store invoice in database
export const store = mutation({
  args: {
    enterpriseId: v.id("enterprises"),
    stripeInvoiceId: v.string(),
    subscriptionId: v.optional(v.string()),
    status: v.string(),
    amount: v.number(),
    currency: v.string(),
    paid: v.boolean(),
    periodStart: v.number(),
    periodEnd: v.number(),
    dueDate: v.optional(v.number()),
    pdfUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if invoice already exists
    const existing = await ctx.db
      .query("invoices")
      .withIndex("by_stripe_id", (q) => q.eq("stripeInvoiceId", args.stripeInvoiceId))
      .first();
    
    if (existing) {
      // Update existing invoice
      await ctx.db.patch(existing._id, {
        ...args,
        createdAt: existing.createdAt,
      });
      return existing._id;
    }
    
    // Create new invoice
    return await ctx.db.insert("invoices", {
      ...args,
      createdAt: now,
    });
  },
});

// Get invoices for enterprise
export const getInvoices = query({
  args: {
    enterpriseId: v.id("enterprises"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("invoices")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .order("desc");
    
    if (args.limit) {
      return await query.take(args.limit);
    }
    
    return await query.collect();
  },
});

// Get invoice by ID
export const getInvoice = query({
  args: {
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.invoiceId);
  },
});

// Get upcoming invoice amount (for display)
export const getUpcomingInvoiceAmount = query({
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
    
    // Calculate based on plan and billing period
    const pricing: Record<string, Record<string, number>> = {
      starter: { monthly: 4900, annual: 39900 },
      professional: { monthly: 14900, annual: 119900 },
    };
    
    const planPricing = pricing[subscription.plan];
    if (!planPricing) {
      return null;
    }
    
    const amount = planPricing[subscription.billingPeriod];
    
    return {
      amount,
      currency: "usd",
      nextPaymentDate: subscription.currentPeriodEnd,
    };
  },
});

// Get invoice statistics
export const getInvoiceStats = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .collect();
    
    const stats = {
      totalInvoices: invoices.length,
      totalPaid: 0,
      totalPending: 0,
      totalAmount: 0,
    };
    
    for (const invoice of invoices) {
      if (invoice.paid) {
        stats.totalPaid++;
        stats.totalAmount += invoice.amount;
      } else {
        stats.totalPending++;
      }
    }
    
    return stats;
  },
});