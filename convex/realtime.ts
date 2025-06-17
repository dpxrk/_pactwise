import { query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getSecurityContext } from "./security/rowLevelSecurity";

/**
 * Real-time Subscriptions for Contract Management Platform
 * 
 * These queries automatically update the frontend when data changes
 * All subscriptions are enterprise-scoped for security
 */

/**
 * Subscribe to contract changes for the user's enterprise
 * Updates when contracts are created, updated, or deleted
 */
export const subscribeToContracts = query({
  args: {
    filters: v.optional(v.object({
      status: v.optional(v.string()),
      vendorId: v.optional(v.id("vendors")),
      contractType: v.optional(v.string()),
    })),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const security = await getSecurityContext(ctx);
    
    // Base query with enterprise filtering
    let contractsQuery = ctx.db
      .query("contracts")
      .withIndex("by_status_and_enterpriseId", (q) => 
        q.eq("enterpriseId", security.enterpriseId)
      );

    // Apply status filter if provided
    if (args.filters?.status) {
      contractsQuery = ctx.db
        .query("contracts")
        .withIndex("by_status_and_enterpriseId", (q) => 
          q.eq("enterpriseId", security.enterpriseId)
           .eq("status", args.filters!.status as any)
        );
    }

    let contracts = await contractsQuery
      .order("desc")
      .take(args.limit || 50);

    // Apply additional filters
    if (args.filters?.vendorId) {
      contracts = contracts.filter(c => c.vendorId === args.filters!.vendorId);
    }
    if (args.filters?.contractType) {
      contracts = contracts.filter(c => c.contractType === args.filters!.contractType);
    }

    // Enrich with vendor data
    const enrichedContracts = await Promise.all(
      contracts.map(async (contract) => {
        const vendor = contract.vendorId ? await ctx.db.get(contract.vendorId) : null;
        return {
          ...contract,
          vendor: vendor ? {
            _id: vendor._id,
            name: vendor.name,
            category: vendor.category,
          } : null,
        };
      })
    );

    return enrichedContracts;
  },
});

/**
 * Subscribe to a specific contract's details
 * Updates when the contract or its related data changes
 */
export const subscribeToContract = query({
  args: {
    contractId: v.id("contracts"),
  },
  handler: async (ctx, args) => {
    const security = await getSecurityContext(ctx);
    
    const contract = await ctx.db.get(args.contractId);
    if (!contract) {
      return null;
    }

    // Verify enterprise access
    if (contract.enterpriseId !== security.enterpriseId) {
      throw new Error("Access denied: Contract belongs to different enterprise");
    }

    // Enrich with vendor data
    const vendor = contract.vendorId ? await ctx.db.get(contract.vendorId) : null;
    
    return {
      ...contract,
      vendor: vendor ? {
        _id: vendor._id,
        name: vendor.name,
        category: vendor.category,
        contactEmail: vendor.contactEmail,
        contactPhone: vendor.contactPhone,
        website: vendor.website,
      } : null,
    };
  },
});

/**
 * Subscribe to unread notifications for the current user
 * Updates in real-time as notifications are created or marked as read
 */
export const subscribeToNotifications = query({
  args: {
    limit: v.optional(v.number()),
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const security = await getSecurityContext(ctx);
    
    let notificationsQuery = ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", security.userId));

    let notifications = await notificationsQuery
      .order("desc")
      .take(args.limit || 20);

    // Filter to unread only if specified
    if (args.unreadOnly) {
      notifications = notifications.filter(n => !n.readAt);
    }

    // Enrich with related data
    const enrichedNotifications = await Promise.all(
      notifications.map(async (notification) => {
        let enrichedData: any = { ...notification };

        // Add contract data if notification is contract-related
        if (notification.contractId) {
          const contract = await ctx.db.get(notification.contractId);
          if (contract) {
            enrichedData.contract = {
              _id: contract._id,
              title: contract.title,
              status: contract.status,
            };
          }
        }

        // Add vendor data if notification is vendor-related
        if (notification.vendorId) {
          const vendor = await ctx.db.get(notification.vendorId);
          if (vendor) {
            enrichedData.vendor = {
              _id: vendor._id,
              name: vendor.name,
            };
          }
        }

        return enrichedData;
      })
    );

    return enrichedNotifications;
  },
});

/**
 * Subscribe to notification count for badges/indicators
 * Updates immediately when new notifications arrive
 */
export const subscribeToNotificationCount = query({
  args: {},
  handler: async (ctx) => {
    const security = await getSecurityContext(ctx);
    
    const allNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", security.userId))
      .collect();

    const unreadCount = allNotifications.filter(n => !n.readAt).length;
    const totalCount = allNotifications.length;

    return {
      unread: unreadCount,
      total: totalCount,
    };
  },
});

/**
 * Subscribe to vendors for the user's enterprise
 * Updates when vendors are created, updated, or deleted
 */
export const subscribeToVendors = query({
  args: {
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const security = await getSecurityContext(ctx);
    
    let vendorsQuery = ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", security.enterpriseId));

    // Apply category filter if provided
    if (args.category) {
      vendorsQuery = ctx.db
        .query("vendors")
        .withIndex("by_category_and_enterpriseId", (q) => 
          q.eq("enterpriseId", security.enterpriseId)
           .eq("category", args.category as any)
        );
    }

    const vendors = await vendorsQuery
      .order("desc")
      .take(args.limit || 100);

    // Enrich with contract counts
    const enrichedVendors = await Promise.all(
      vendors.map(async (vendor) => {
        const contractCount = await ctx.db
          .query("contracts")
          .withIndex("by_vendorId_and_enterpriseId", (q) => 
            q.eq("enterpriseId", security.enterpriseId)
             .eq("vendorId", vendor._id)
          )
          .collect()
          .then(contracts => contracts.length);

        const activeContractCount = await ctx.db
          .query("contracts")
          .withIndex("by_vendorId_and_enterpriseId", (q) => 
            q.eq("enterpriseId", security.enterpriseId)
             .eq("vendorId", vendor._id)
          )
          .collect()
          .then(contracts => contracts.filter(c => c.status === "active").length);

        return {
          ...vendor,
          contractCount,
          activeContractCount,
        };
      })
    );

    return enrichedVendors;
  },
});

/**
 * Subscribe to dashboard analytics that update in real-time
 * Updates when contracts or vendors change
 */
export const subscribeToDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const security = await getSecurityContext(ctx);
    
    // Get all contracts for the enterprise
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_status_and_enterpriseId", (q) => 
        q.eq("enterpriseId", security.enterpriseId)
      )
      .collect();

    // Get all vendors for the enterprise
    const vendors = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", security.enterpriseId))
      .collect();

    // Calculate stats
    const totalContracts = contracts.length;
    const activeContracts = contracts.filter(c => c.status === "active").length;
    const pendingContracts = contracts.filter(c => c.status === "pending_analysis").length;
    const expiredContracts = contracts.filter(c => c.status === "expired").length;
    
    const totalVendors = vendors.length;
    const vendorsByCategory = vendors.reduce((acc, vendor) => {
      if (vendor.category) {
        acc[vendor.category] = (acc[vendor.category] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime();
    const recentContracts = contracts.filter(c => c._creationTime >= thirtyDaysAgo);

    return {
      contracts: {
        total: totalContracts,
        active: activeContracts,
        pending: pendingContracts,
        expired: expiredContracts,
        recentCount: recentContracts.length,
      },
      vendors: {
        total: totalVendors,
        byCategory: vendorsByCategory,
      },
      activity: {
        recentContractsCount: recentContracts.length,
        lastUpdated: new Date().toISOString(),
      }
    };
  },
});

/**
 * Subscribe to recent user activity across the enterprise
 * Updates when users perform actions (for activity feeds)
 */
export const subscribeToRecentActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const security = await getSecurityContext(ctx);
    
    // Only admins and owners can view enterprise activity
    if (!["owner", "admin"].includes(security.role)) {
      return [];
    }

    // Get recent audit logs
    const recentLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", security.enterpriseId))
      .order("desc")
      .take(args.limit || 20);

    // Enrich with user and resource data
    const enrichedActivity = await Promise.all(
      recentLogs.map(async (log) => {
        const user = await ctx.db.get(log.userId);
        
        let enrichedData: any = {
          ...log,
          user: user ? {
            _id: user._id,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            email: user.email,
          } : null,
        };

        // Add resource-specific data
        if (log.resourceType === "contracts" && log.resourceId) {
          const contract = await ctx.db.get(log.resourceId as Id<"contracts">);
          if (contract) {
            enrichedData.resource = {
              _id: contract._id,
              title: contract.title,
              status: contract.status,
            };
          }
        } else if (log.resourceType === "vendors" && log.resourceId) {
          const vendor = await ctx.db.get(log.resourceId as Id<"vendors">);
          if (vendor) {
            enrichedData.resource = {
              _id: vendor._id,
              name: vendor.name,
            };
          }
        }

        return enrichedData;
      })
    );

    return enrichedActivity;
  },
});

/**
 * Subscribe to contract analysis status updates
 * Updates in real-time as AI analysis progresses
 */
export const subscribeToContractAnalysis = query({
  args: {
    contractId: v.optional(v.id("contracts")),
  },
  handler: async (ctx, args) => {
    const security = await getSecurityContext(ctx);
    
    let query = ctx.db
      .query("contracts")
      .withIndex("by_analysisStatus_and_enterpriseId", (q) => 
        q.eq("enterpriseId", security.enterpriseId)
      );

    let contracts = await query.collect();

    // Filter to specific contract if provided
    if (args.contractId) {
      contracts = contracts.filter(c => c._id === args.contractId);
    }

    // Only return contracts with pending or processing analysis
    const analysisContracts = contracts.filter(c => 
      c.analysisStatus === "pending" || 
      c.analysisStatus === "processing"
    );

    return analysisContracts.map(contract => ({
      _id: contract._id,
      title: contract.title,
      analysisStatus: contract.analysisStatus,
      analysisError: contract.analysisError,
      _creationTime: contract._creationTime,
    }));
  },
});