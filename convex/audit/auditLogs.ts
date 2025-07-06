import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

// Audit log types
export const AuditEventTypes = {
  // Authentication
  USER_LOGIN: "USER_LOGIN",
  USER_LOGOUT: "USER_LOGOUT",
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DELETED: "USER_DELETED",
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",
  
  // Contracts
  CONTRACT_CREATED: "CONTRACT_CREATED",
  CONTRACT_UPDATED: "CONTRACT_UPDATED",
  CONTRACT_DELETED: "CONTRACT_DELETED",
  CONTRACT_ANALYZED: "CONTRACT_ANALYZED",
  CONTRACT_EXPORTED: "CONTRACT_EXPORTED",
  CONTRACT_ASSIGNED: "CONTRACT_ASSIGNED",
  
  // Vendors
  VENDOR_CREATED: "VENDOR_CREATED",
  VENDOR_UPDATED: "VENDOR_UPDATED",
  VENDOR_DELETED: "VENDOR_DELETED",
  
  // Enterprise
  ENTERPRISE_CREATED: "ENTERPRISE_CREATED",
  ENTERPRISE_UPDATED: "ENTERPRISE_UPDATED",
  ENTERPRISE_SETTINGS_CHANGED: "ENTERPRISE_SETTINGS_CHANGED",
  
  // Security
  API_KEY_CREATED: "API_KEY_CREATED",
  API_KEY_REVOKED: "API_KEY_REVOKED",
  PERMISSION_CHANGED: "PERMISSION_CHANGED",
  
  // Data Operations
  DATA_EXPORTED: "DATA_EXPORTED",
  DATA_IMPORTED: "DATA_IMPORTED",
  BACKUP_CREATED: "BACKUP_CREATED",
  BACKUP_RESTORED: "BACKUP_RESTORED",
} as const;

export type AuditEventType = typeof AuditEventTypes[keyof typeof AuditEventTypes];

// Create audit log entry
export const createAuditLog = mutation({
  args: {
    eventType: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    action: v.string(),
    details: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const auditLog = await ctx.db.insert("auditLogs", {
      timestamp: new Date().toISOString(),
      userId: user._id,
      enterpriseId: user.enterpriseId,
      operation: args.eventType,
      resourceType: args.entityType,
      resourceId: args.entityId,
      action: args.action as "create" | "read" | "update" | "delete" | "export" | "share" | "approve" | "reject",
      status: "success",
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      metadata: {
        userEmail: identity.email,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        userRole: user.role,
        details: args.details,
      },
    });

    return auditLog;
  },
});

// Query audit logs with filters
export const getAuditLogs = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    eventType: v.optional(v.string()),
    entityType: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), identity.subject))
      .first();

    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      throw new Error("Unauthorized: Admin access required");
    }

    let query = ctx.db
      .query("auditLogs")
      .filter((q) => q.eq(q.field("enterpriseId"), user.enterpriseId));

    // Apply filters
    if (args.startDate) {
      query = query.filter((q) => q.gte(q.field("timestamp"), new Date(args.startDate!).toISOString()));
    }
    if (args.endDate) {
      query = query.filter((q) => q.lte(q.field("timestamp"), new Date(args.endDate!).toISOString()));
    }
    if (args.eventType) {
      query = query.filter((q) => q.eq(q.field("operation"), args.eventType));
    }
    if (args.entityType) {
      query = query.filter((q) => q.eq(q.field("resourceType"), args.entityType));
    }
    if (args.userId) {
      query = query.filter((q) => q.eq(q.field("userId"), args.userId));
    }

    // Get total count
    const allLogs = await query.collect();
    const total = allLogs.length;

    // Apply pagination
    const limit = args.limit || 50;
    const offset = args.offset || 0;
    const logs = allLogs.slice(offset, offset + limit);

    // Enrich with user data
    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        const user = await ctx.db.get(log.userId);
        return {
          ...log,
          user: user ? { 
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email, 
            email: user.email 
          } : null,
        };
      })
    );

    return {
      logs: enrichedLogs,
      total,
      limit,
      offset,
    };
  },
});

// Export audit logs
export const exportAuditLogs = query({
  args: {
    format: v.union(v.literal("csv"), v.literal("json")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), identity.subject))
      .first();

    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Note: In a real implementation, you would log this export action via a mutation
    // For now, we'll skip logging the export itself to avoid the query/mutation issue
    
    // await ctx.db.insert("auditLogs", {
    //   timestamp: new Date().toISOString(),
    //   userId: user._id,
    //   enterpriseId: user.enterpriseId,
    //   operation: AuditEventTypes.DATA_EXPORTED,
    //   resourceType: "auditLogs",
    //   resourceId: undefined,
    //   action: "export",
    //   status: "success",
    //   metadata: {
    //     userEmail: identity.email,
    //     userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    //     userRole: user.role,
    //     details: {
    //       format: args.format,
    //       startDate: args.startDate,
    //       endDate: args.endDate,
    //     },
    //   },
    // });

    let query = ctx.db
      .query("auditLogs")
      .filter((q) => q.eq(q.field("enterpriseId"), user.enterpriseId));

    if (args.startDate) {
      query = query.filter((q) => q.gte(q.field("timestamp"), new Date(args.startDate!).toISOString()));
    }
    if (args.endDate) {
      query = query.filter((q) => q.lte(q.field("timestamp"), new Date(args.endDate!).toISOString()));
    }

    const logs = await query.collect();

    if (args.format === "csv") {
      // Convert to CSV format
      const headers = [
        "Timestamp",
        "Event Type",
        "Entity Type",
        "Entity ID",
        "Action",
        "User Email",
        "User Name",
        "Details",
      ];
      
      const rows = logs.map((log) => [
        log.timestamp,
        log.operation,
        log.resourceType,
        log.resourceId || "",
        log.action,
        log.metadata?.userEmail || "",
        log.metadata?.userName || "",
        JSON.stringify(log.metadata?.details || {}),
      ]);

      return {
        format: "csv",
        headers,
        data: rows,
      };
    } else {
      // Return JSON format
      return {
        format: "json",
        data: logs,
      };
    }
  },
});

// Search audit logs
export const searchAuditLogs = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), identity.subject))
      .first();

    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      throw new Error("Unauthorized: Admin access required");
    }

    const logs = await ctx.db
      .query("auditLogs")
      .filter((q) => q.eq(q.field("enterpriseId"), user.enterpriseId))
      .collect();

    // Search in multiple fields
    const searchResults = logs.filter((log) => {
      const searchStr = args.searchTerm.toLowerCase();
      return (
        log.operation.toLowerCase().includes(searchStr) ||
        log.resourceType.toLowerCase().includes(searchStr) ||
        log.action.toLowerCase().includes(searchStr) ||
        (log.resourceId && log.resourceId.toLowerCase().includes(searchStr)) ||
        (log.metadata?.userEmail && log.metadata.userEmail.toLowerCase().includes(searchStr)) ||
        (log.metadata?.userName && log.metadata.userName.toLowerCase().includes(searchStr)) ||
        (log.metadata?.details && JSON.stringify(log.metadata.details).toLowerCase().includes(searchStr))
      );
    });

    const limit = args.limit || 50;
    return searchResults.slice(0, limit);
  },
});

// Get audit summary/statistics
export const getAuditSummary = query({
  args: {
    timeRange: v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d"),
      v.literal("90d")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), identity.subject))
      .first();

    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Calculate time range
    const now = Date.now();
    const timeRanges = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      "90d": 90 * 24 * 60 * 60 * 1000,
    };
    const startTime = now - timeRanges[args.timeRange];

    const logs = await ctx.db
      .query("auditLogs")
      .filter((q) => q.eq(q.field("enterpriseId"), user.enterpriseId))
      .filter((q) => q.gte(q.field("timestamp"), new Date(startTime).toISOString()))
      .collect();

    // Calculate statistics
    const eventTypeCounts = logs.reduce((acc, log) => {
      acc[log.operation] = (acc[log.operation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const entityTypeCounts = logs.reduce((acc, log) => {
      acc[log.resourceType] = (acc[log.resourceType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const userActivityCounts = logs.reduce((acc, log) => {
      const userKey = log.metadata?.userEmail || "unknown";
      acc[userKey] = (acc[userKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get most active users
    const topUsers = Object.entries(userActivityCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([email, count]) => ({ email, count }));

    return {
      totalEvents: logs.length,
      timeRange: args.timeRange,
      eventTypes: eventTypeCounts,
      entityTypes: entityTypeCounts,
      topUsers,
      criticalEvents: logs.filter((log) => 
        log.operation.includes("DELETED") || 
        log.operation.includes("SECURITY") ||
        log.operation.includes("PERMISSION")
      ).length,
    };
  },
});