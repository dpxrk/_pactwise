import { query } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * OPTIMIZED: Get dashboard summary with efficient aggregation
 * Instead of loading all contracts and vendors, use targeted queries
 */
export const getDashboardSummaryOptimized = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Use parallel queries with limits for efficiency
    const [
      activeContractsPage,
      expiringContractsPage,
      vendorsPage,
      recentContractsPage,
      recentAnalytics
    ] = await Promise.all([
      // Count active contracts (paginated)
      ctx.db
        .query("contracts")
        .withIndex("by_enterprise_status_vendor", q => 
          q.eq("enterpriseId", args.enterpriseId).eq("status", "active")
        )
        .paginate({ numItems: 1000, cursor: null }), // Large page for counting

      // Get expiring contracts in next 30 days
      ctx.db
        .query("contracts")
        .withIndex("by_enterprise", q => 
          q.eq("enterpriseId", args.enterpriseId)
        )
        .filter(q => {
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
          return q.and(
            q.eq(q.field("status"), "active"),
            q.lte(q.field("extractedEndDate"), thirtyDaysFromNow.toISOString())
          );
        })
        .paginate({ numItems: 100, cursor: null }),

      // Count active vendors
      ctx.db
        .query("vendors")
        .withIndex("by_enterprise_status_created", q => 
          q.eq("enterpriseId", args.enterpriseId).eq("status", "active")
        )
        .paginate({ numItems: 1000, cursor: null }),

      // Get recent contracts for activity
      ctx.db
        .query("contracts")
        .withIndex("by_enterprise_created", q => 
          q.eq("enterpriseId", args.enterpriseId)
        )
        .order("desc")
        .paginate({ numItems: 10, cursor: null }),

      // Get cached analytics if available
      getCachedAnalytics(ctx, args.enterpriseId)
    ]);

    // Calculate total value efficiently
    let totalContractValue = 0;
    let processedContracts = 0;
    let continueCursor = activeContractsPage.continueCursor;

    // Process first page
    activeContractsPage.page.forEach(contract => {
      totalContractValue += contract.value || 0;
      processedContracts++;
    });

    // If we need more precise counting and there's more data, 
    // we should implement background aggregation jobs
    const hasMoreData = continueCursor !== null;

    return {
      summary: {
        totalContracts: processedContracts + (hasMoreData ? "+" : ""),
        activeContracts: processedContracts,
        expiringContracts: expiringContractsPage.page.length,
        totalVendors: vendorsPage.page.length + (vendorsPage.continueCursor ? "+" : ""),
        totalContractValue,
        complianceScore: recentAnalytics?.complianceScore || calculateComplianceScore(activeContractsPage.page),
      },
      recentActivity: recentContractsPage.page.map(contract => ({
        id: contract._id,
        title: contract.title,
        type: "contract_created",
        timestamp: contract.createdAt,
      })),
      alerts: generateAlerts(expiringContractsPage.page),
      isApproximate: hasMoreData,
    };
  },
});

/**
 * OPTIMIZED: Get contract analytics with pagination
 */
export const getContractAnalyticsOptimized = query({
  args: {
    enterpriseId: v.id("enterprises"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    groupBy: v.optional(v.union(
      v.literal("status"),
      v.literal("type"),
      v.literal("vendor"),
      v.literal("month")
    )),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Check cache first
    const cacheKey = `analytics_${args.enterpriseId}_${args.startDate}_${args.endDate}_${args.groupBy}`;
    const cached = await getCachedResult(ctx, cacheKey);
    if (cached) return cached;

    // Build query with date filters
    let query = ctx.db
      .query("contracts")
      .withIndex("by_enterprise_created", q => 
        q.eq("enterpriseId", args.enterpriseId)
      );

    // Apply date filters
    if (args.startDate || args.endDate) {
      query = query.filter(q => {
        let condition = q.eq(q.field("enterpriseId"), args.enterpriseId);
        if (args.startDate) {
          condition = q.and(condition, q.gte(q.field("createdAt"), args.startDate));
        }
        if (args.endDate) {
          condition = q.and(condition, q.lte(q.field("createdAt"), args.endDate));
        }
        return condition;
      });
    }

    // Process in batches
    const BATCH_SIZE = 100;
    const result = await query.paginate({ 
      numItems: BATCH_SIZE, 
      cursor: args.cursor || null 
    });

    // Aggregate data for this batch
    const analytics = processContractBatch(result.page, args.groupBy || "status");

    // If this is the first page and no more data, cache the result
    if (!args.cursor && !result.continueCursor) {
      await cacheResult(ctx, cacheKey, analytics, 5 * 60 * 1000); // 5 minute cache
    }

    return {
      analytics,
      nextCursor: result.continueCursor,
      hasMore: result.continueCursor !== null,
      isPartialResult: result.continueCursor !== null,
    };
  },
});

/**
 * OPTIMIZED: Search with pagination and relevance scoring
 */
export const searchContractsOptimized = query({
  args: {
    enterpriseId: v.id("enterprises"),
    query: v.string(),
    filters: v.optional(v.object({
      status: v.optional(v.string()),
      type: v.optional(v.string()),
      vendorId: v.optional(v.id("vendors")),
      dateRange: v.optional(v.object({
        start: v.string(),
        end: v.string(),
      })),
    })),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const limit = args.limit || 20;
    const searchLower = args.query.toLowerCase();

    // Build base query with filters
    let query = ctx.db
      .query("contracts")
      .withIndex("by_enterprise_status_vendor", q => 
        q.eq("enterpriseId", args.enterpriseId)
      );
    
    // Apply status filter separately
    if (args.filters?.status) {
      const status = args.filters.status;
      query = query.filter(q => q.eq(q.field("status"), status as any));
    }

    // Apply additional filters
    if (args.filters?.type) {
      query = query.filter(q => q.eq(q.field("contractType"), args.filters?.type));
    }
    if (args.filters?.vendorId) {
      query = query.filter(q => q.eq(q.field("vendorId"), args.filters!.vendorId));
    }

    // Get paginated results
    const result = await query
      .order("desc")
      .paginate({ numItems: limit * 2, cursor: args.cursor || null }); // Fetch extra for filtering

    // Score and filter results
    const scoredResults = result.page
      .map(contract => {
        const score = calculateRelevanceScore(contract, searchLower);
        return { contract, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Batch fetch vendors
    const vendorIds = [...new Set(scoredResults.map(r => r.contract.vendorId).filter(Boolean))];
    const vendors = await batchFetchVendors(ctx, vendorIds as Id<"vendors">[]);

    // Enrich results
    const enrichedResults = scoredResults.map(({ contract, score }) => ({
      ...contract,
      vendor: contract.vendorId ? vendors.get(contract.vendorId) : null,
      relevanceScore: score,
    }));

    return {
      results: enrichedResults,
      nextCursor: result.continueCursor,
      hasMore: result.continueCursor !== null,
      totalProcessed: result.page.length,
    };
  },
});

// Helper functions

async function getCachedAnalytics(ctx: any, enterpriseId: Id<"enterprises">) {
  const cached = await ctx.db
    .query("analyticsCache")
    .withIndex("by_key", q => q.eq("key", `summary_${enterpriseId}`))
    .first();

  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached.data;
  }
  return null;
}

async function getCachedResult(ctx: any, key: string) {
  const cached = await ctx.db
    .query("analyticsCache")
    .withIndex("by_key", q => q.eq("key", key))
    .first();

  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }
  return null;
}

async function cacheResult(ctx: any, key: string, data: any, ttl: number) {
  const existing = await ctx.db
    .query("analyticsCache")
    .withIndex("by_key", q => q.eq("key", key))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    });
  } else {
    await ctx.db.insert("analyticsCache", {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    });
  }
}

function calculateComplianceScore(contracts: any[]): number {
  if (contracts.length === 0) return 100;
  
  const compliantContracts = contracts.filter(c => 
    c.analysisStatus === "completed" && 
    c.status === "active"
  );
  
  return Math.round((compliantContracts.length / contracts.length) * 100);
}

function generateAlerts(expiringContracts: any[]): any[] {
  return expiringContracts.map(contract => ({
    type: "contract_expiring",
    severity: getDaysUntilExpiry(contract.extractedEndDate) <= 7 ? "high" : "medium",
    title: `Contract "${contract.title}" expiring soon`,
    contractId: contract._id,
    expiryDate: contract.extractedEndDate,
  }));
}

function getDaysUntilExpiry(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function processContractBatch(contracts: any[], groupBy: string): any {
  const groups = new Map<string, number>();
  
  contracts.forEach(contract => {
    let key: string;
    switch (groupBy) {
      case "status":
        key = contract.status;
        break;
      case "type":
        key = contract.contractType || "other";
        break;
      case "vendor":
        key = contract.vendorId || "no_vendor";
        break;
      case "month":
        key = new Date(contract.createdAt).toISOString().substring(0, 7);
        break;
      default:
        key = "unknown";
    }
    
    groups.set(key, (groups.get(key) || 0) + 1);
  });

  return Object.fromEntries(groups);
}

function calculateRelevanceScore(contract: any, searchTerm: string): number {
  let score = 0;
  
  // Title match (highest weight)
  if (contract.title.toLowerCase().includes(searchTerm)) {
    score += 10;
  }
  
  // File name match
  if (contract.fileName.toLowerCase().includes(searchTerm)) {
    score += 5;
  }
  
  // Notes match
  if (contract.notes?.toLowerCase().includes(searchTerm)) {
    score += 3;
  }
  
  // Extracted content match
  const extractedFields = [
    contract.extractedParties,
    contract.extractedScope,
    contract.extractedPaymentSchedule
  ];
  
  extractedFields.forEach(field => {
    if (field && field.toString().toLowerCase().includes(searchTerm)) {
      score += 2;
    }
  });
  
  return score;
}

async function batchFetchVendors(ctx: any, vendorIds: Id<"vendors">[]) {
  if (vendorIds.length === 0) return new Map();
  
  const vendors = await ctx.db
    .query("vendors")
    .filter(q => q.or(...vendorIds.map(id => q.eq(q.field("_id"), id))))
    .collect();
    
  return new Map(vendors.map(v => [v._id, v]));
}