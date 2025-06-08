// convex/analytics.ts
import { query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

// ============================================================================
// DASHBOARD ANALYTICS
// ============================================================================

/**
 * Get dashboard summary for the current user's enterprise
 */
export const getDashboardSummary = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    // Get all contracts for the enterprise
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", user.enterpriseId))
      .collect();

    // Get all vendors for the enterprise
    const vendors = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", user.enterpriseId))
      .collect();

    // Calculate contract statistics
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const contractStats = {
      total: contracts.length,
      active: contracts.filter(c => c.status === "active").length,
      draft: contracts.filter(c => c.status === "draft").length,
      pending: contracts.filter(c => c.status === "pending_approval").length,
      expired: contracts.filter(c => c.status === "expired").length,
      expiringIn30Days: contracts.filter(c => 
        c.status === "active" && 
        c.endDate && 
        new Date(c.endDate) <= thirtyDaysFromNow &&
        new Date(c.endDate) > now
      ).length,
      expiringIn90Days: contracts.filter(c => 
        c.status === "active" && 
        c.endDate && 
        new Date(c.endDate) <= ninetyDaysFromNow &&
        new Date(c.endDate) > now
      ).length,
    };

    // Calculate vendor statistics
    const vendorStats = {
      total: vendors.length,
      active: vendors.filter(v => v.status === "active").length,
      inactive: vendors.filter(v => v.status === "inactive").length,
      byCategory: vendors.reduce((acc, vendor) => {
        acc[vendor.category] = (acc[vendor.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    // Calculate total contract value
    const totalValue = contracts.reduce((sum, contract) => {
      return sum + (contract.value || 0);
    }, 0);

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentContracts = contracts.filter(c => 
      new Date(c.createdAt) >= thirtyDaysAgo
    );

    return {
      contractStats,
      vendorStats,
      totalValue,
      recentActivity: {
        newContracts: recentContracts.length,
        contractsCreatedThisMonth: recentContracts.filter(c => 
          new Date(c.createdAt).getMonth() === now.getMonth() &&
          new Date(c.createdAt).getFullYear() === now.getFullYear()
        ).length,
      },
      alerts: {
        contractsExpiringSoon: contractStats.expiringIn30Days,
        pendingApprovals: contractStats.pending,
        overdueContracts: contracts.filter(c => 
          c.status === "active" && 
          c.endDate && 
          new Date(c.endDate) < now
        ).length,
      },
    };
  },
});

/**
 * Get recent activity for the dashboard
 */
export const getRecentActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const limit = Math.min(args.limit || 10, 50);

    // Get recent events from multiple sources
    const events = [];

    // Recent contracts
    const recentContracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", user.enterpriseId))
      .order("desc")
      .take(limit);

    for (const contract of recentContracts) {
      events.push({
        id: contract._id,
        type: "contract",
        action: "created",
        title: `Contract "${contract.title}" was created`,
        timestamp: contract.createdAt,
        metadata: {
          contractId: contract._id,
          contractTitle: contract.title,
          status: contract.status,
        },
      });
    }

    // Recent vendors
    const recentVendors = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", user.enterpriseId))
      .order("desc")
      .take(limit);

    for (const vendor of recentVendors) {
      events.push({
        id: vendor._id,
        type: "vendor",
        action: "created",
        title: `Vendor "${vendor.name}" was added`,
        timestamp: vendor.createdAt,
        metadata: {
          vendorId: vendor._id,
          vendorName: vendor.name,
          category: vendor.category,
        },
      });
    }

    // Sort by timestamp and limit
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return events.slice(0, limit);
  },
});

/**
 * Get upcoming deadlines and alerts
 */
export const getUpcomingDeadlines = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const days = args.days || 30;
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // Get contracts expiring within the specified timeframe
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", user.enterpriseId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const upcomingDeadlines = contracts
      .filter(contract => {
        if (!contract.endDate) return false;
        const endDate = new Date(contract.endDate);
        return endDate > now && endDate <= futureDate;
      })
      .map(contract => ({
        id: contract._id,
        type: "contract_expiration",
        title: contract.title,
        deadline: contract.endDate,
        daysUntilDeadline: Math.ceil(
          (new Date(contract.endDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ),
        priority: new Date(contract.endDate!).getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000 
          ? "high" : "medium",
        vendor: contract.vendorId,
        value: contract.value,
      }))
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());

    return upcomingDeadlines;
  },
});

/**
 * Get contract analytics by status
 */
export const getContractAnalytics = query({
  args: {
    timeRange: v.optional(v.union(
      v.literal("7days"),
      v.literal("30days"),
      v.literal("90days"),
      v.literal("1year"),
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    // Calculate date range
    const now = new Date();
    const timeRange = args.timeRange || "30days";
    const daysMap = { "7days": 7, "30days": 30, "90days": 90, "1year": 365 };
    const cutoffDate = new Date(now.getTime() - daysMap[timeRange] * 24 * 60 * 60 * 1000);

    // Get contracts within the time range
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", user.enterpriseId))
      .filter((q) => q.gte(q.field("createdAt"), cutoffDate.toISOString()))
      .collect();

    // Group by status
    const byStatus = contracts.reduce((acc, contract) => {
      acc[contract.status] = (acc[contract.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by month for trend analysis
    const byMonth = contracts.reduce((acc, contract) => {
      const month = new Date(contract.createdAt).toISOString().substring(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate total value
    const totalValue = contracts.reduce((sum, contract) => sum + (contract.value || 0), 0);
    const averageValue = contracts.length > 0 ? totalValue / contracts.length : 0;

    return {
      summary: {
        total: contracts.length,
        totalValue,
        averageValue,
      },
      byStatus,
      byMonth,
      timeRange,
    };
  },
});

/**
 * Get vendor performance analytics
 */
export const getVendorAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    // Get all vendors and contracts for analysis
    const vendors = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", user.enterpriseId))
      .collect();

    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", user.enterpriseId))
      .collect();

    // Calculate vendor performance metrics
    const vendorMetrics = vendors.map(vendor => {
      const vendorContracts = contracts.filter(c => c.vendorId === vendor._id);
      const totalValue = vendorContracts.reduce((sum, c) => sum + (c.value || 0), 0);
      const activeContracts = vendorContracts.filter(c => c.status === "active").length;

      return {
        vendorId: vendor._id,
        name: vendor.name,
        category: vendor.category,
        contractCount: vendorContracts.length,
        totalValue,
        activeContracts,
        averageContractValue: vendorContracts.length > 0 ? totalValue / vendorContracts.length : 0,
      };
    });

    // Sort by total value
    vendorMetrics.sort((a, b) => b.totalValue - a.totalValue);

    // Group by category
    const byCategory = vendors.reduce((acc, vendor) => {
      acc[vendor.category] = (acc[vendor.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      topVendors: vendorMetrics.slice(0, 10),
      byCategory,
      summary: {
        totalVendors: vendors.length,
        activeVendors: vendors.filter(v => v.status === "active").length,
        totalContractValue: vendorMetrics.reduce((sum, v) => sum + v.totalValue, 0),
      },
    };
  },
});