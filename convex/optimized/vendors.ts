import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { ConvexError } from "convex/values";

const vendorCategoryOptions = [
  "technology", "marketing", "legal", "finance", "hr",
  "facilities", "logistics", "manufacturing", "consulting", "other"
] as const;

/**
 * OPTIMIZED: Get vendor analytics without loading all data into memory
 */
export const getVendorAnalyticsOptimized = query({
  args: {
    enterpriseId: v.id("enterprises"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    const limit = args.limit || 20;

    // Get paginated vendors
    const vendorsResult = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise_status_created", q => 
        q.eq("enterpriseId", args.enterpriseId)
      )
      .order("desc")
      .paginate({ numItems: limit, cursor: args.cursor || null });

    // Batch calculate metrics for this page of vendors
    const vendorIds = vendorsResult.page.map(v => v._id);
    
    // Use aggregation query to get contract counts and values
    const contractMetrics = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise_status_vendor", q => 
        q.eq("enterpriseId", args.enterpriseId)
      )
      .filter(q => 
        q.or(...vendorIds.map(id => q.eq(q.field("vendorId"), id)))
      )
      .collect();

    // Process metrics efficiently
    const metricsMap = new Map<string, {
      totalContracts: number;
      activeContracts: number;
      totalValue: number;
      lastActivity: number;
    }>();

    contractMetrics.forEach(contract => {
      if (!contract.vendorId) return;
      
      const metrics = metricsMap.get(contract.vendorId) || {
        totalContracts: 0,
        activeContracts: 0,
        totalValue: 0,
        lastActivity: 0,
      };

      metrics.totalContracts++;
      if (contract.status === "active") {
        metrics.activeContracts++;
      }
      metrics.totalValue += contract.value || 0;
      metrics.lastActivity = Math.max(
        metrics.lastActivity, 
        contract.updatedAt || contract._creationTime
      );

      metricsMap.set(contract.vendorId, metrics);
    });

    // Enrich vendors with metrics
    const enrichedVendors = vendorsResult.page.map(vendor => {
      const metrics = metricsMap.get(vendor._id) || {
        totalContracts: 0,
        activeContracts: 0,
        totalValue: 0,
        lastActivity: vendor._creationTime,
      };

      return {
        ...vendor,
        ...metrics,
        performanceScore: calculatePerformanceScore(vendor, metrics),
      };
    });

    return {
      vendors: enrichedVendors,
      nextCursor: vendorsResult.continueCursor,
      hasMore: vendorsResult.continueCursor !== null,
    };
  },
});

/**
 * OPTIMIZED: Search vendors with efficient filtering
 */
export const searchVendorsOptimized = query({
  args: {
    enterpriseId: v.id("enterprises"),
    search: v.string(),
    category: v.optional(v.union(
      ...vendorCategoryOptions.map(option => v.literal(option)),
      v.literal("all")
    )),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"), v.literal("all"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    const limit = args.limit || 20;
    const searchLower = args.search.toLowerCase();

    // Build query with filters at database level
    let query = ctx.db
      .query("vendors")
      .withIndex("by_enterprise_status_created", q => 
        q.eq("enterpriseId", args.enterpriseId)
      );
    
    // Apply status filter separately
    if (args.status && args.status !== "all") {
      query = query.filter(q => q.eq(q.field("status"), args.status));
    }

    // Apply category filter at database level
    if (args.category && args.category !== "all") {
      query = query.filter(q => q.eq(q.field("category"), args.category));
    }

    // For search, we need to fetch and filter in memory, but with pagination
    const results = await query
      .order("desc")
      .collect();

    // Filter by search term
    const filtered = results.filter(vendor => 
      vendor.name.toLowerCase().includes(searchLower) ||
      vendor.contactEmail?.toLowerCase().includes(searchLower) ||
      vendor.contactName?.toLowerCase().includes(searchLower) ||
      vendor.notes?.toLowerCase().includes(searchLower)
    );

    // Manual pagination
    const paginatedResults = filtered.slice(0, limit);

    // Get contract counts for search results only
    const vendorIds = paginatedResults.map(v => v._id);
    const contractCounts = await getContractCountsForVendors(ctx, args.enterpriseId, vendorIds);

    // Enrich with contract data
    const enriched = paginatedResults.map(vendor => ({
      ...vendor,
      contractCount: contractCounts.get(vendor._id) || 0,
    }));

    return {
      vendors: enriched,
      total: filtered.length,
      hasMore: filtered.length > limit,
    };
  },
});

/**
 * OPTIMIZED: Get vendor with related data efficiently
 */
export const getVendorByIdOptimized = query({
  args: {
    vendorId: v.id("vendors"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor) {
      throw new ConvexError("Vendor not found.");
    }

    // Get contracts with pagination
    const contractsResult = await ctx.db
      .query("contracts")
      .filter(q => 
        q.and(
          q.eq(q.field("enterpriseId"), vendor.enterpriseId),
          q.eq(q.field("vendorId"), args.vendorId)
        )
      )
      .order("desc")
      .paginate({ numItems: 10, cursor: null });

    // Calculate metrics from contracts
    const metrics = {
      totalContracts: 0,
      activeContracts: 0,
      totalValue: 0,
      avgContractValue: 0,
      recentActivity: [] as any[],
    };

    contractsResult.page.forEach(contract => {
      metrics.totalContracts++;
      if (contract.status === "active") {
        metrics.activeContracts++;
      }
      metrics.totalValue += contract.value || 0;
    });

    if (metrics.totalContracts > 0) {
      metrics.avgContractValue = metrics.totalValue / metrics.totalContracts;
    }

    // Get recent activity (last 5 status changes)
    const recentChanges = await ctx.db
      .query("contractStatusHistory")
      .withIndex("by_contract_time")
      .filter(q => 
        q.or(...contractsResult.page.map(c => q.eq(q.field("contractId"), c._id)))
      )
      .order("desc")
      .take(5);

    return {
      ...vendor,
      metrics,
      recentContracts: contractsResult.page,
      recentActivity: recentChanges,
      hasMoreContracts: contractsResult.continueCursor !== null,
    };
  },
});

/**
 * OPTIMIZED: Bulk vendor operations
 */
export const bulkUpdateVendorStatus = mutation({
  args: {
    vendorIds: v.array(v.id("vendors")),
    status: v.union(v.literal("active"), v.literal("inactive")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    // Process in batches
    const BATCH_SIZE = 50;
    const results: Array<{ id: Id<"vendors">, success: boolean, error?: string }> = [];

    for (let i = 0; i < args.vendorIds.length; i += BATCH_SIZE) {
      const batch = args.vendorIds.slice(i, i + BATCH_SIZE);
      
      const updates = await Promise.all(
        batch.map(async (vendorId) => {
          try {
            await ctx.db.patch(vendorId, {
              status: args.status,
              updatedAt: Date.now(),
            });
            return { id: vendorId, success: true };
          } catch (error) {
            return { 
              id: vendorId, 
              success: false, 
              error: error instanceof Error ? error.message : "Unknown error" 
            };
          }
        })
      );

      results.push(...updates);
    }

    return {
      total: args.vendorIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  },
});

// Helper function to calculate performance score
function calculatePerformanceScore(
  vendor: Doc<"vendors">, 
  metrics: { totalContracts: number; activeContracts: number; totalValue: number }
): number {
  let score = 50; // Base score

  // Contract activity (up to 20 points)
  if (metrics.totalContracts > 0) {
    score += Math.min(20, metrics.totalContracts * 2);
  }

  // Active contract ratio (up to 15 points)
  if (metrics.totalContracts > 0) {
    const activeRatio = metrics.activeContracts / metrics.totalContracts;
    score += activeRatio * 15;
  }

  // Value contribution (up to 15 points)
  if (metrics.totalValue > 100000) {
    score += 15;
  } else if (metrics.totalValue > 50000) {
    score += 10;
  } else if (metrics.totalValue > 10000) {
    score += 5;
  }

  return Math.min(100, Math.round(score));
}

// Helper to get contract counts for multiple vendors
async function getContractCountsForVendors(
  ctx: any,
  enterpriseId: Id<"enterprises">,
  vendorIds: Id<"vendors">[]
): Promise<Map<string, number>> {
  const contracts = await ctx.db
    .query("contracts")
    .withIndex("by_enterprise_status_vendor", q => 
      q.eq("enterpriseId", enterpriseId)
    )
    .filter(q => 
      q.or(...vendorIds.map(id => q.eq(q.field("vendorId"), id)))
    )
    .collect();

  const counts = new Map<string, number>();
  contracts.forEach(contract => {
    if (contract.vendorId) {
      counts.set(
        contract.vendorId, 
        (counts.get(contract.vendorId) || 0) + 1
      );
    }
  });

  return counts;
}