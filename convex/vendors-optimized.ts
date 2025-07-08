import { v } from "convex/values";
import { query, QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { vendorCategoryOptions } from "./schema";
import { DataLoaderContext } from "./lib/dataLoader";
import { ConvexCache, CACHE_TTL, CACHE_TAGS } from "./lib/convexCache";

/**
 * Optimized vendor queries with caching and DataLoader
 */

/**
 * Get vendors with caching and optimized loading
 */
export const getVendorsOptimized = query({
  args: {
    enterpriseId: v.id("enterprises"),
    category: v.optional(
      v.union(
        ...vendorCategoryOptions.map(option => v.literal(option)),
        v.literal("all")
      )
    ),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"), v.literal("all"))),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    const cache = new ConvexCache(ctx);
    const cacheKey = `vendors:${args.enterpriseId}:${args.category || 'all'}:${args.status || 'all'}`;

    // Try to get from cache for first page only
    if (!args.cursor) {
      const cached = await cache.get<any>("vendors", cacheKey);
      if (cached) {
        return cached;
      }
    }

    const limit = args.limit || 50;
    const loaderContext = new DataLoaderContext(ctx);

    // Build optimized query
    let queryBuilder;
    if (args.category && args.category !== "all" && args.status && args.status !== "all") {
      // Use the most specific index
      queryBuilder = ctx.db
        .query("vendors")
        .withIndex("by_enterprise_category_status", q =>
          q.eq("enterpriseId", args.enterpriseId)
            .eq("category", args.category as any)
            .eq("status", args.status as any)
        );
    } else if (args.category && args.category !== "all") {
      // Use category index
      queryBuilder = ctx.db
        .query("vendors")
        .withIndex("by_category_and_enterpriseId", q =>
          q.eq("enterpriseId", args.enterpriseId).eq("category", args.category as any)
        );
    } else if (args.status && args.status !== "all") {
      // Use status index
      queryBuilder = ctx.db
        .query("vendors")
        .withIndex("by_enterprise_status_created", q =>
          q.eq("enterpriseId", args.enterpriseId).eq("status", args.status as any)
        );
    } else {
      // Use enterprise-only index
      queryBuilder = ctx.db
        .query("vendors")
        .withIndex("by_enterprise_created", q =>
          q.eq("enterpriseId", args.enterpriseId)
        );
    }

    // Apply pagination
    const paginationBuilder = queryBuilder.order("desc");
    
    let vendors;
    let nextCursor: string | null = null;
    
    if (args.cursor) {
      const result = await paginationBuilder.paginate({ numItems: limit, cursor: args.cursor });
      vendors = result.page;
      nextCursor = result.continueCursor;
    } else {
      const result = await paginationBuilder.paginate({ numItems: limit, cursor: null });
      vendors = result.page;
      nextCursor = result.continueCursor;
    }

    // Apply additional filters if needed
    if (args.status && args.status !== "all" && !queryBuilder.toString().includes("status")) {
      vendors = vendors.filter(v => v.status === args.status);
    }

    // Enrich vendors with contract counts using efficient queries
    const enrichedVendors = await Promise.all(
      vendors.map(async (vendor) => {
        // Get contract counts using index
        const contracts = await ctx.db
          .query("contracts")
          .withIndex("by_vendorId_and_enterpriseId", q =>
            q.eq("enterpriseId", args.enterpriseId).eq("vendorId", vendor._id)
          )
          .collect();

        const activeContracts = contracts.filter(c => c.status === "active");
        const totalValue = activeContracts.reduce((sum, c) => sum + (c.value || 0), 0);

        return {
          ...vendor,
          contractCount: contracts.length,
          activeContractCount: activeContracts.length,
          totalContractValue: totalValue,
        };
      })
    );

    const result = {
      vendors: enrichedVendors,
      nextCursor,
      hasMore: nextCursor !== null,
    };

    // Cache first page results
    if (!args.cursor) {
      await cache.set("vendors", cacheKey, result, {
        ttl: CACHE_TTL.MEDIUM,
        tags: [CACHE_TAGS.VENDORS],
        enterpriseId: args.enterpriseId,
      });
    }

    return result;
  },
});

/**
 * Get vendor performance metrics with caching
 */
export const getVendorPerformanceMetrics = query({
  args: {
    enterpriseId: v.id("enterprises"),
    vendorId: v.id("vendors"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    const cache = new ConvexCache(ctx);
    const cacheKey = `performance:${args.vendorId}`;

    // Try cache first
    const cached = await cache.get<any>("vendor-metrics", cacheKey);
    if (cached) {
      return cached;
    }

    // Verify vendor belongs to enterprise
    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor || vendor.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Vendor not found.");
    }

    // Get all contracts for this vendor
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_vendorId_and_enterpriseId", q =>
        q.eq("enterpriseId", args.enterpriseId).eq("vendorId", args.vendorId)
      )
      .collect();

    // Calculate metrics
    const now = new Date();
    const metrics = {
      totalContracts: contracts.length,
      activeContracts: contracts.filter(c => c.status === "active").length,
      totalValue: contracts.reduce((sum, c) => sum + (c.value || 0), 0),
      averageContractValue: contracts.length > 0 
        ? contracts.reduce((sum, c) => sum + (c.value || 0), 0) / contracts.length 
        : 0,
      onTimeRenewalRate: calculateOnTimeRenewalRate(contracts),
      complianceScore: vendor.complianceScore || 85,
      performanceScore: vendor.performanceScore || 90,
      contractsByStatus: groupContractsByStatus(contracts),
      upcomingRenewals: contracts.filter(c => {
        if (!c.extractedEndDate || c.status !== "active") return false;
        const endDate = new Date(c.extractedEndDate);
        const daysUntilExpiry = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysUntilExpiry > 0 && daysUntilExpiry <= 90;
      }).length,
      expiredContracts: contracts.filter(c => c.status === "expired").length,
    };

    // Cache the metrics
    await cache.set("vendor-metrics", cacheKey, metrics, {
      ttl: CACHE_TTL.LONG,
      tags: [CACHE_TAGS.VENDORS, CACHE_TAGS.ANALYTICS],
      enterpriseId: args.enterpriseId,
    });

    return metrics;
  },
});

/**
 * Get top vendors by various metrics
 */
export const getTopVendors = query({
  args: {
    enterpriseId: v.id("enterprises"),
    metric: v.union(
      v.literal("value"),
      v.literal("contracts"),
      v.literal("performance")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    const cache = new ConvexCache(ctx);
    const cacheKey = `top-vendors:${args.enterpriseId}:${args.metric}`;

    // Try cache first
    const cached = await cache.get<any>("analytics", cacheKey);
    if (cached) {
      return cached;
    }

    const limit = args.limit || 10;

    // Get all vendors with their metrics
    let vendors;
    if (args.metric === "performance") {
      // Use performance index
      vendors = await ctx.db
        .query("vendors")
        .withIndex("by_enterprise_performance", q =>
          q.eq("enterpriseId", args.enterpriseId)
        )
        .order("desc")
        .take(limit);
    } else if (args.metric === "value") {
      // Use value index
      vendors = await ctx.db
        .query("vendors")
        .withIndex("by_enterprise_value", q =>
          q.eq("enterpriseId", args.enterpriseId)
        )
        .order("desc")
        .take(limit);
    } else {
      // For contract count, we need to calculate
      const allVendors = await ctx.db
        .query("vendors")
        .withIndex("by_enterprise", q =>
          q.eq("enterpriseId", args.enterpriseId)
        )
        .collect();

      // Get contract counts for all vendors in parallel
      const vendorMetrics = await Promise.all(
        allVendors.map(async (vendor) => {
          const contractCount = await ctx.db
            .query("contracts")
            .withIndex("by_vendorId_and_enterpriseId", q =>
              q.eq("enterpriseId", args.enterpriseId).eq("vendorId", vendor._id)
            )
            .collect()
            .then(contracts => contracts.length);

          return { vendor, contractCount };
        })
      );

      // Sort by contract count and take top N
      vendors = vendorMetrics
        .sort((a, b) => b.contractCount - a.contractCount)
        .slice(0, limit)
        .map(({ vendor }) => vendor);
    }

    // Enrich with additional data
    const enrichedVendors = await Promise.all(
      vendors.map(async (vendor) => {
        const contracts = await ctx.db
          .query("contracts")
          .withIndex("by_vendorId_and_enterpriseId", q =>
            q.eq("enterpriseId", args.enterpriseId).eq("vendorId", vendor._id)
          )
          .collect();

        return {
          ...vendor,
          contractCount: contracts.length,
          activeContracts: contracts.filter(c => c.status === "active").length,
          totalValue: contracts.reduce((sum, c) => sum + (c.value || 0), 0),
        };
      })
    );

    // Cache the results
    await cache.set("analytics", cacheKey, enrichedVendors, {
      ttl: CACHE_TTL.LONG,
      tags: [CACHE_TAGS.VENDORS, CACHE_TAGS.ANALYTICS],
      enterpriseId: args.enterpriseId,
    });

    return enrichedVendors;
  },
});

/**
 * Prefetch vendor data for dashboard
 */
export const prefetchVendorData = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    const cache = new ConvexCache(ctx);
    const loaderContext = new DataLoaderContext(ctx);

    // Prefetch active vendors
    const activeVendors = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise_status_created", q =>
        q.eq("enterpriseId", args.enterpriseId).eq("status", "active")
      )
      .order("desc")
      .take(20);

    // Prime the loader cache
    const vendorLoader = loaderContext.getLoader("vendors");
    activeVendors.forEach(vendor => {
      vendorLoader.prime(vendor._id, vendor);
    });

    // Cache vendor categories
    const vendorsByCategory = new Map<string, number>();
    const allVendors = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise", q => q.eq("enterpriseId", args.enterpriseId))
      .collect();

    allVendors.forEach(vendor => {
      const category = vendor.category || "uncategorized";
      vendorsByCategory.set(category, (vendorsByCategory.get(category) || 0) + 1);
    });

    const categoryStats = Array.from(vendorsByCategory.entries()).map(([category, count]) => ({
      category,
      count,
    }));

    // Cache category stats
    await cache.set("analytics", `vendor-categories:${args.enterpriseId}`, categoryStats, {
      ttl: CACHE_TTL.HOUR,
      tags: [CACHE_TAGS.VENDORS, CACHE_TAGS.ANALYTICS],
      enterpriseId: args.enterpriseId,
    });

    return {
      activeVendors: activeVendors.length,
      totalVendors: allVendors.length,
      categories: categoryStats.length,
      cached: true,
    };
  },
});

// Helper functions

function calculateOnTimeRenewalRate(contracts: Doc<"contracts">[]): number {
  // Since "renewal" is not a valid contract type, we'll check for contracts that have isAutoRenew flag
  const renewableContracts = contracts.filter(c => 
    c.status === "active" && c.isAutoRenew === true
  );
  
  if (renewableContracts.length === 0) return 100;
  
  // This is a simplified calculation
  // In reality, you'd check if renewals happened before expiry
  return 95; // Placeholder
}

function groupContractsByStatus(contracts: Doc<"contracts">[]): Record<string, number> {
  const statusCounts: Record<string, number> = {};
  
  contracts.forEach(contract => {
    const status = contract.status || "unknown";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  
  return statusCounts;
}