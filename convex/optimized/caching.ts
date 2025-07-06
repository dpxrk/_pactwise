import { query, mutation, internalMutation } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * Caching utilities for expensive operations
 */

export const CACHE_DURATIONS = {
  DASHBOARD_SUMMARY: 5 * 60 * 1000,        // 5 minutes
  ANALYTICS_DATA: 10 * 60 * 1000,          // 10 minutes
  VENDOR_METRICS: 15 * 60 * 1000,          // 15 minutes
  SEARCH_RESULTS: 2 * 60 * 1000,           // 2 minutes
  CONTRACT_STATS: 5 * 60 * 1000,           // 5 minutes
  AGENT_INSIGHTS: 30 * 60 * 1000,          // 30 minutes
} as const;

/**
 * Get cached value by key
 */
export const getCached = internalMutation({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const cached = await ctx.db
      .query("analyticsCache")
      .withIndex("by_key", q => q.eq("key", args.key))
      .first();

    if (!cached) return null;

    // Check if cache is still valid
    if (Date.now() > cached.expiresAt) {
      // Delete expired cache
      await ctx.db.delete(cached._id);
      return null;
    }

    return cached.data;
  },
});

/**
 * Set cached value with expiration
 */
export const setCached = internalMutation({
  args: {
    key: v.string(),
    data: v.any(),
    ttl: v.number(), // Time to live in milliseconds
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + args.ttl;

    // Check if cache entry already exists
    const existing = await ctx.db
      .query("analyticsCache")
      .withIndex("by_key", q => q.eq("key", args.key))
      .first();

    if (existing) {
      // Update existing cache
      await ctx.db.patch(existing._id, {
        data: args.data,
        timestamp: now,
        expiresAt,
      });
    } else {
      // Create new cache entry
      await ctx.db.insert("analyticsCache", {
        key: args.key,
        data: args.data,
        timestamp: now,
        expiresAt,
      });
    }
  },
});

/**
 * Invalidate cache by key pattern
 */
export const invalidateCache = mutation({
  args: {
    pattern: v.string(), // Key pattern to match (e.g., "analytics_*")
  },
  handler: async (ctx, args) => {
    // Get all cache entries
    const cacheEntries = await ctx.db
      .query("analyticsCache")
      .collect();

    // Filter by pattern and delete
    const toDelete = cacheEntries.filter(entry => 
      entry.key.startsWith(args.pattern.replace("*", ""))
    );

    await Promise.all(
      toDelete.map(entry => ctx.db.delete(entry._id))
    );

    return { deleted: toDelete.length };
  },
});

/**
 * Clean up expired cache entries
 */
export const cleanupExpiredCache = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const BATCH_SIZE = 100;
    let totalDeleted = 0;

    do {
      const expiredEntries = await ctx.db
        .query("analyticsCache")
        .withIndex("by_expires", q => q.lt("expiresAt", now))
        .take(BATCH_SIZE);

      if (expiredEntries.length === 0) break;

      await Promise.all(
        expiredEntries.map(entry => ctx.db.delete(entry._id))
      );

      totalDeleted += expiredEntries.length;
    } while (true);

    return { deleted: totalDeleted };
  },
});

/**
 * Cached query wrapper - use this to wrap expensive queries
 */
export function withCache<Args extends Record<string, any>, Result>(
  queryFn: (ctx: any, args: Args) => Promise<Result>,
  getCacheKey: (args: Args) => string,
  ttl: number
) {
  return async (ctx: any, args: Args): Promise<Result> => {
    const cacheKey = getCacheKey(args);

    // Try to get from cache
    const cached = await ctx.runMutation(api.optimized.caching.getCached, { key: cacheKey });
    if (cached) {
      return cached as Result;
    }

    // Execute the query
    const result = await queryFn(ctx, args);

    // Cache the result
    await ctx.runMutation(api.optimized.caching.setCached, {
      key: cacheKey,
      data: result,
      ttl,
    });

    return result;
  };
}

/**
 * Example: Cached dashboard summary
 */
export const getCachedDashboardSummary = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: withCache(
    async (ctx, args) => {
      // Expensive dashboard calculation logic here
      const [contracts, vendors, analytics] = await Promise.all([
        ctx.db
          .query("contracts")
          .withIndex("by_enterprise_status_vendor", q => 
            q.eq("enterpriseId", args.enterpriseId)
          )
          .take(1000),
        ctx.db
          .query("vendors")
          .withIndex("by_enterprise_status_created", q => 
            q.eq("enterpriseId", args.enterpriseId)
          )
          .take(1000),
        // Other expensive calculations
        calculateAnalytics(ctx, args.enterpriseId),
      ]);

      return {
        totalContracts: contracts.length,
        totalVendors: vendors.length,
        analytics,
      };
    },
    (args) => `dashboard_${args.enterpriseId}`,
    CACHE_DURATIONS.DASHBOARD_SUMMARY
  ),
});

/**
 * Cache warming - pre-populate cache for frequently accessed data
 */
export const warmCache = internalMutation({
  args: {
    enterpriseIds: v.array(v.id("enterprises")),
  },
  handler: async (ctx, args) => {
    const warmed: Id<"enterprises">[] = [];

    for (const enterpriseId of args.enterpriseIds) {
      try {
        // Pre-calculate and cache dashboard summary
        const summary = await calculateDashboardSummary(ctx, enterpriseId);
        await ctx.runMutation(api.optimized.caching.setCached, {
          key: `dashboard_${enterpriseId}`,
          data: summary,
          ttl: CACHE_DURATIONS.DASHBOARD_SUMMARY,
        });

        warmed.push(enterpriseId);
      } catch (error) {
        console.error(`Failed to warm cache for enterprise ${enterpriseId}:`, error);
      }
    }

    return { warmed: warmed.length, total: args.enterpriseIds.length };
  },
});

// Helper functions

async function calculateAnalytics(ctx: any, enterpriseId: Id<"enterprises">) {
  // Placeholder for expensive analytics calculation
  return {
    contractsByStatus: {},
    vendorsByCategory: {},
    monthlyTrends: [],
  };
}

async function calculateDashboardSummary(ctx: any, enterpriseId: Id<"enterprises">) {
  // Placeholder for dashboard summary calculation
  return {
    totalContracts: 0,
    activeContracts: 0,
    totalVendors: 0,
    totalValue: 0,
  };
}

// Import this in your crons.ts file to schedule cleanup
export { cleanupExpiredCache as scheduledCacheCleanup };