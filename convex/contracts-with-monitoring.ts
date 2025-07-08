import { v } from "convex/values";
import { query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { createMonitoredQueryContext } from "./lib/queryPerformance";
import { ConvexCache, CACHE_TTL, CACHE_TAGS } from "./lib/convexCache";
import { contractStatusOptions } from "./schema";

/**
 * Example of contracts query with performance monitoring
 */
export const getContractsWithMonitoring = query({
  args: {
    enterpriseId: v.id("enterprises"),
    status: v.optional(v.union(...contractStatusOptions.map(s => v.literal(s)))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    // Create monitored context
    const { query: monitoredQuery, summary } = createMonitoredQueryContext(
      ctx,
      "getContractsWithMonitoring"
    );

    const cache = new ConvexCache(ctx);
    const limit = args.limit || 50;

    try {
      // Check cache first
      const cacheKey = `contracts:${args.enterpriseId}:${args.status || 'all'}`;
      const cached = await monitoredQuery(
        "cache_check",
        () => cache.get<any>("contracts", cacheKey),
        { cacheKey }
      );

      if (cached) {
        summary(); // Log performance summary
        return cached;
      }

      // Main contract query
      const contracts = await monitoredQuery(
        "fetch_contracts",
        async () => {
          const queryBuilder = args.status
            ? ctx.db
                .query("contracts")
                .withIndex("by_enterprise_status_created", q =>
                  q.eq("enterpriseId", args.enterpriseId).eq("status", args.status!)
                )
            : ctx.db
                .query("contracts")
                .withIndex("by_enterprise_created", q =>
                  q.eq("enterpriseId", args.enterpriseId)
                );

          return queryBuilder.order("desc").take(limit);
        },
        { status: args.status, limit }
      );

      // Batch fetch vendors
      const vendorIds = Array.from(new Set(contracts.map(c => c.vendorId).filter(Boolean)));
      const vendors = await monitoredQuery(
        "fetch_vendors_batch",
        () => Promise.all(vendorIds.map(id => ctx.db.get(id!))),
        { count: vendorIds.length }
      );

      // Create vendor map
      const vendorMap = new Map();
      vendors.forEach((vendor, index) => {
        if (vendor) {
          vendorMap.set(vendorIds[index], vendor);
        }
      });

      // Enrich contracts
      const enrichedContracts = contracts.map(contract => ({
        ...contract,
        vendor: contract.vendorId ? vendorMap.get(contract.vendorId) : null,
      }));

      // Cache the results
      await monitoredQuery(
        "cache_set",
        () => cache.set("contracts", cacheKey, enrichedContracts, {
          ttl: CACHE_TTL.MEDIUM,
          tags: [CACHE_TAGS.CONTRACTS],
          enterpriseId: args.enterpriseId,
        }),
        { cacheKey }
      );

      // Log performance summary
      summary();

      return enrichedContracts;
    } catch (error) {
      summary(); // Log summary even on error
      throw error;
    }
  },
});

/**
 * Dashboard data with comprehensive monitoring
 */
export const getDashboardDataWithMonitoring = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    const { monitor, query: monitoredQuery, summary } = createMonitoredQueryContext(
      ctx,
      "getDashboardData"
    );

    const cache = new ConvexCache(ctx);

    try {
      // Check cache
      const cacheKey = `dashboard:${args.enterpriseId}`;
      const cached = await monitoredQuery(
        "cache_check",
        () => cache.get<any>("dashboard", cacheKey)
      );

      if (cached) {
        monitor.endQuery(monitor.startQuery("cache_hit"), 1, true);
        summary();
        return cached;
      }

      // Parallel queries for dashboard data
      const [
        contractStats,
        vendorStats,
        recentActivity,
        upcomingRenewals,
      ] = await Promise.all([
        // Contract statistics
        monitoredQuery("contract_stats", async () => {
          const contracts = await ctx.db
            .query("contracts")
            .withIndex("by_enterprise", q => q.eq("enterpriseId", args.enterpriseId))
            .collect();

          return {
            total: contracts.length,
            active: contracts.filter(c => c.status === "active").length,
            expired: contracts.filter(c => c.status === "expired").length,
            totalValue: contracts.reduce((sum, c) => sum + (c.value || 0), 0),
          };
        }),

        // Vendor statistics
        monitoredQuery("vendor_stats", async () => {
          const vendors = await ctx.db
            .query("vendors")
            .withIndex("by_enterprise", q => q.eq("enterpriseId", args.enterpriseId))
            .collect();

          return {
            total: vendors.length,
            active: vendors.filter(v => v.status === "active").length,
            byCategory: groupByCategory(vendors),
          };
        }),

        // Recent activity
        monitoredQuery("recent_activity", async () => {
          return ctx.db
            .query("contracts")
            .withIndex("by_enterprise_created", q =>
              q.eq("enterpriseId", args.enterpriseId)
            )
            .order("desc")
            .take(5);
        }),

        // Upcoming renewals
        monitoredQuery("upcoming_renewals", async () => {
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

          const activeContracts = await ctx.db
            .query("contracts")
            .withIndex("by_enterprise_status_created", q =>
              q.eq("enterpriseId", args.enterpriseId).eq("status", "active")
            )
            .collect();

          return activeContracts.filter(contract => {
            if (!contract.extractedEndDate) return false;
            const endDate = new Date(contract.extractedEndDate);
            return endDate <= thirtyDaysFromNow && endDate >= new Date();
          });
        }),
      ]);

      const dashboardData = {
        contracts: contractStats,
        vendors: vendorStats,
        recentActivity,
        upcomingRenewals,
        timestamp: new Date().toISOString(),
      };

      // Cache the results
      await monitoredQuery(
        "cache_set",
        () => cache.set("dashboard", cacheKey, dashboardData, {
          ttl: CACHE_TTL.SHORT,
          tags: [CACHE_TAGS.DASHBOARD],
          enterpriseId: args.enterpriseId,
        })
      );

      // Log performance summary
      summary();

      // Log slow queries for monitoring
      const slowQueries = monitor.getSlowQueries();
      if (slowQueries.length > 0) {
        console.warn("Slow queries detected in dashboard data:", {
          count: slowQueries.length,
          queries: slowQueries.map(q => ({ name: q.name, duration: q.duration })),
          totalDuration: monitor.getSummary().totalDuration
        });
      }

      return dashboardData;
    } catch (error) {
      summary();
      throw error;
    }
  },
});

// Helper function
function groupByCategory(vendors: any[]): Record<string, number> {
  return vendors.reduce((acc, vendor) => {
    const category = vendor.category || "uncategorized";
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}