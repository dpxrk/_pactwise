import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// Define available metrics
export const AVAILABLE_METRICS = [
  { id: "total-contracts", name: "Total Contracts", type: "metric", defaultEnabled: true },
  { id: "active-contracts", name: "Active Contracts", type: "metric", defaultEnabled: true },
  { id: "expiring-soon", name: "Expiring Soon", type: "metric", defaultEnabled: true },
  { id: "total-value", name: "Total Value", type: "metric", defaultEnabled: true },
  { id: "compliance-score", name: "Compliance Score", type: "metric", defaultEnabled: true },
  { id: "vendors", name: "Vendors", type: "metric", defaultEnabled: true },
  { id: "risk-score", name: "Risk Score", type: "metric", defaultEnabled: false },
  { id: "savings-opportunities", name: "Savings Opportunities", type: "metric", defaultEnabled: false },
  { id: "pending-approvals", name: "Pending Approvals", type: "metric", defaultEnabled: false },
  { id: "recent-activity", name: "Recent Activity", type: "metric", defaultEnabled: false },
  { id: "contract-status-chart", name: "Contract Status Distribution", type: "chart", defaultEnabled: true },
  { id: "risk-distribution-chart", name: "Risk Distribution", type: "chart", defaultEnabled: true },
] as const;

export type MetricId = typeof AVAILABLE_METRICS[number]["id"];

// Get user's dashboard preferences
export const getUserPreferences = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return null;
    }

    const preferences = await ctx.db
      .query("dashboardPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Return default preferences if none exist
    if (!preferences) {
      return {
        enabledMetrics: AVAILABLE_METRICS
          .filter(m => m.defaultEnabled)
          .map(m => m.id),
        metricOrder: AVAILABLE_METRICS.map(m => m.id),
      };
    }

    return {
      enabledMetrics: preferences.enabledMetrics,
      metricOrder: preferences.metricOrder,
    };
  },
});

// Save user's dashboard preferences
export const saveUserPreferences = mutation({
  args: {
    enabledMetrics: v.array(v.string()),
    metricOrder: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const existingPreferences = await ctx.db
      .query("dashboardPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existingPreferences) {
      await ctx.db.patch(existingPreferences._id, {
        enabledMetrics: args.enabledMetrics,
        metricOrder: args.metricOrder,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("dashboardPreferences", {
        userId: user._id,
        enabledMetrics: args.enabledMetrics,
        metricOrder: args.metricOrder,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Reset dashboard preferences to default
export const resetUserPreferences = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const existingPreferences = await ctx.db
      .query("dashboardPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existingPreferences) {
      await ctx.db.delete(existingPreferences._id);
    }

    return { success: true };
  },
});