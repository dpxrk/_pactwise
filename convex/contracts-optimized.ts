import { v } from "convex/values";
import { query, QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { 
  contractTypeOptions, 
  contractStatusOptions 
} from "./schema";
import { DataLoaderContext, loadContractUsers } from "./lib/dataLoader";

/**
 * Optimized contract queries using DataLoader pattern
 */

/**
 * Get contracts with optimized vendor and user loading
 */
export const getContractsOptimized = query({
  args: {
    enterpriseId: v.id("enterprises"),
    contractType: v.optional(
      v.union(
        ...contractTypeOptions.map(option => v.literal(option)),
        v.literal("all")
      )
    ),
    status: v.optional(
      v.union(
        ...contractStatusOptions.map(option => v.literal(option)),
        v.literal("all")
      )
    ),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required to view contracts.");
    }

    const limit = args.limit || 50;
    const loaderContext = new DataLoaderContext(ctx);

    // Build optimized query using the best index
    let queryBuilder;
    if (args.status && args.status !== "all") {
      // Use compound index when filtering by status
      queryBuilder = ctx.db
        .query("contracts")
        .withIndex("by_enterprise_status_created", q =>
          q.eq("enterpriseId", args.enterpriseId).eq("status", args.status as any)
        );
    } else {
      // Use enterprise-only index when no status filter
      queryBuilder = ctx.db
        .query("contracts")
        .withIndex("by_enterprise_created", q =>
          q.eq("enterpriseId", args.enterpriseId)
        );
    }

    // Apply pagination
    const paginationBuilder = queryBuilder.order("desc");
    
    let contracts;
    let nextCursor: string | null = null;
    
    if (args.cursor) {
      const result = await paginationBuilder.paginate({ numItems: limit, cursor: args.cursor });
      contracts = result.page;
      nextCursor = result.continueCursor;
    } else {
      const result = await paginationBuilder.paginate({ numItems: limit, cursor: null });
      contracts = result.page;
      nextCursor = result.continueCursor;
    }

    // Apply contract type filter if needed
    if (args.contractType && args.contractType !== "all") {
      contracts = contracts.filter(contract => contract.contractType === args.contractType);
    }

    // Use DataLoader to batch load vendors and users
    const vendorLoader = loaderContext.getLoader("vendors");
    const userLoader = loaderContext.getLoader("users");

    // Collect unique IDs
    const vendorIds = new Set<Id<"vendors">>();
    const userIds = new Set<Id<"users">>();
    
    contracts.forEach(contract => {
      if (contract.vendorId) vendorIds.add(contract.vendorId);
      if (contract.ownerId) userIds.add(contract.ownerId);
      if (contract.createdBy) userIds.add(contract.createdBy);
      if (contract.lastModifiedBy) userIds.add(contract.lastModifiedBy);
    });

    // Batch load all vendors and users in parallel
    const [vendorPromises, userPromises] = [
      Array.from(vendorIds).map(id => vendorLoader.load(id)),
      Array.from(userIds).map(id => userLoader.load(id)),
    ];

    const [vendors, users] = await Promise.all([
      Promise.all(vendorPromises),
      Promise.all(userPromises),
    ]);

    // Create lookup maps
    const vendorMap = new Map<Id<"vendors">, Doc<"vendors">>();
    Array.from(vendorIds).forEach((id, index) => {
      const vendor = vendors[index];
      if (vendor) vendorMap.set(id, vendor);
    });

    const userMap = new Map<Id<"users">, Doc<"users">>();
    Array.from(userIds).forEach((id, index) => {
      const user = users[index];
      if (user) userMap.set(id, user);
    });

    // Enrich contracts with related data
    const enrichedContracts = contracts.map(contract => ({
      ...contract,
      vendor: contract.vendorId ? vendorMap.get(contract.vendorId) || null : null,
      owner: contract.ownerId ? userMap.get(contract.ownerId) || null : null,
      createdByUser: contract.createdBy ? userMap.get(contract.createdBy) || null : null,
      lastModifiedByUser: contract.lastModifiedBy ? userMap.get(contract.lastModifiedBy) || null : null,
    }));

    return {
      contracts: enrichedContracts,
      nextCursor,
      hasMore: nextCursor !== null,
    };
  },
});

/**
 * Get contracts with full relationship data
 */
export const getContractsWithFullRelations = query({
  args: {
    enterpriseId: v.id("enterprises"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    const limit = args.limit || 20; // Smaller limit for full data
    const loaderContext = new DataLoaderContext(ctx);

    // Get contracts
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise_created", q =>
        q.eq("enterpriseId", args.enterpriseId)
      )
      .order("desc")
      .take(limit);

    // Batch load all related data
    const enrichedContracts = await Promise.all(
      contracts.map(async (contract) => {
        // Load vendor, assignments, and approvals in parallel
        const [vendor, assignments, approvals, statusHistory] = await Promise.all([
          contract.vendorId 
            ? loaderContext.getLoader("vendors").load(contract.vendorId)
            : null,
          ctx.db
            .query("contractAssignments")
            .withIndex("by_contract_active", q => 
              q.eq("contractId", contract._id).eq("isActive", true)
            )
            .collect(),
          ctx.db
            .query("contractApprovals")
            .withIndex("by_contract", q => q.eq("contractId", contract._id))
            .filter(q => q.eq(q.field("status"), "pending"))
            .collect(),
          ctx.db
            .query("contractStatusHistory")
            .withIndex("by_contract", q => q.eq("contractId", contract._id))
            .order("desc")
            .take(5), // Last 5 status changes
        ]);

        // Load users for assignments
        const assignmentUserIds = assignments.map(a => a.userId);
        const assignmentUsers = await loaderContext.getLoader("users").loadMany(assignmentUserIds);
        
        const assignmentsWithUsers = assignments.map((assignment, index) => ({
          ...assignment,
          user: assignmentUsers[index],
        }));

        return {
          ...contract,
          vendor,
          assignments: assignmentsWithUsers,
          pendingApprovals: approvals,
          recentStatusChanges: statusHistory,
        };
      })
    );

    return enrichedContracts;
  },
});

/**
 * Get contract analytics with optimized queries
 */
export const getContractAnalytics = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    // Use Promise.all to run queries in parallel
    const [
      activeContracts,
      expiringContracts,
      contractsByStatus,
      contractsByType,
      totalValue,
    ] = await Promise.all([
      // Active contracts count
      ctx.db
        .query("contracts")
        .withIndex("by_enterprise_status_created", q =>
          q.eq("enterpriseId", args.enterpriseId).eq("status", "active")
        )
        .collect()
        .then(contracts => contracts.length),

      // Expiring contracts (next 30 days)
      ctx.db
        .query("contracts")
        .withIndex("by_enterprise_status_created", q =>
          q.eq("enterpriseId", args.enterpriseId).eq("status", "active")
        )
        .collect()
        .then(contracts => {
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
          
          return contracts.filter(contract => {
            if (!contract.extractedEndDate) return false;
            const endDate = new Date(contract.extractedEndDate);
            return endDate <= thirtyDaysFromNow && endDate >= new Date();
          }).length;
        }),

      // Contracts by status
      Promise.all(
        contractStatusOptions.map(async (status) => ({
          status,
          count: await ctx.db
            .query("contracts")
            .withIndex("by_enterprise_status_created", q =>
              q.eq("enterpriseId", args.enterpriseId).eq("status", status)
            )
            .collect()
            .then(contracts => contracts.length),
        }))
      ),

      // Contracts by type
      ctx.db
        .query("contracts")
        .withIndex("by_enterprise", q => q.eq("enterpriseId", args.enterpriseId))
        .collect()
        .then(contracts => {
          const byType = new Map<string, number>();
          contracts.forEach(contract => {
            const type = contract.contractType || "uncategorized";
            byType.set(type, (byType.get(type) || 0) + 1);
          });
          return Array.from(byType.entries()).map(([type, count]) => ({ type, count }));
        }),

      // Total contract value
      ctx.db
        .query("contracts")
        .withIndex("by_enterprise_status_created", q =>
          q.eq("enterpriseId", args.enterpriseId).eq("status", "active")
        )
        .collect()
        .then(contracts => 
          contracts.reduce((sum, contract) => sum + (contract.value || 0), 0)
        ),
    ]);

    return {
      summary: {
        activeContracts,
        expiringContracts,
        totalValue,
      },
      byStatus: contractsByStatus,
      byType: contractsByType,
    };
  },
});

/**
 * Prefetch and cache contract data for dashboard
 */
export const prefetchDashboardData = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    const loaderContext = new DataLoaderContext(ctx);

    // Get recent contracts and prime the cache
    const recentContracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise_created", q =>
        q.eq("enterpriseId", args.enterpriseId)
      )
      .order("desc")
      .take(10);

    // Prime vendor cache
    const vendorLoader = loaderContext.getLoader("vendors");
    const vendorIds = new Set<Id<"vendors">>();
    recentContracts.forEach(c => {
      if (c.vendorId) vendorIds.add(c.vendorId);
    });

    // Load all vendors at once
    await Promise.all(Array.from(vendorIds).map(id => vendorLoader.load(id)));

    // Get top vendors by contract count
    const vendorContractCounts = new Map<Id<"vendors">, number>();
    const allContracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise", q => q.eq("enterpriseId", args.enterpriseId))
      .collect();

    allContracts.forEach(contract => {
      if (contract.vendorId) {
        vendorContractCounts.set(
          contract.vendorId,
          (vendorContractCounts.get(contract.vendorId) || 0) + 1
        );
      }
    });

    // Get top 5 vendors
    const topVendorIds = Array.from(vendorContractCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([vendorId]) => vendorId);

    const topVendors = await vendorLoader.loadMany(topVendorIds);

    return {
      recentContracts: recentContracts.length,
      topVendors: topVendors.filter(v => v !== null).length,
      totalContracts: allContracts.length,
      cached: true,
    };
  },
});