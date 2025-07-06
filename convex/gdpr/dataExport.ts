import { v } from "convex/values";
import { query, mutation, action } from "../_generated/server";
import { ConvexError } from "convex/values";
import { getSecurityContext } from "../security/rowLevelSecurity";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";

// Export all user data (GDPR compliance)
export const exportUserData = action({
  args: {
    format: v.union(v.literal("json"), v.literal("csv")),
    includeRelatedData: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get user from database
    const user = await ctx.runQuery(api.users.getByClerkId, { 
      clerkId: identity.subject 
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Log the export request
    await ctx.runMutation(api.auditLogging.logEvent, {
      userId: user._id,
      operation: "exportUserData",
      resourceType: "userData",
      resourceId: user._id,
      action: "export",
      status: "success",
      metadata: { format: args.format, includeRelatedData: args.includeRelatedData }
    });

    // Collect all user data
    const userData: any = {
      user: {
        ...user,
        _id: user._id,
      },
      exportDate: new Date().toISOString(),
      format: args.format,
    };

    if (args.includeRelatedData) {
      // Get related data
      const [contracts, vendors, notifications, chatSessions, auditLogs] = await Promise.all([
        ctx.runQuery(api.contracts.getContracts, {
          filters: { ownerId: user._id }
        }),
        ctx.runQuery(api.vendors.getVendors, {}),
        ctx.runQuery(api.notifications.getMyNotifications, {}),
        ctx.runQuery(api.ai.chat.getChatSessions, {}),
        ctx.runQuery(api.auditLogging.getAuditLogs, {
          filters: { userId: user._id }
        }),
      ]);

      userData.relatedData = {
        contracts: contracts.contracts,
        vendors: vendors,
        notifications: notifications,
        chatSessions: chatSessions,
        auditLogs: auditLogs.logs,
      };
    }

    if (args.format === "csv") {
      // Convert to CSV format
      return convertToCSV(userData);
    }

    return userData;
  },
});

// Delete user data (GDPR right to be forgotten)
export const deleteUserData = mutation({
  args: {
    confirmDeletion: v.boolean(),
    deleteRelatedData: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!args.confirmDeletion) {
      throw new ConvexError("Deletion must be explicitly confirmed");
    }

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

    // Log the deletion request
    await ctx.db.insert("auditLogs", {
      userId: user._id,
      enterpriseId: user.enterpriseId,
      operation: "deleteUserData",
      resourceType: "userData",
      resourceId: user._id,
      action: "delete",
      status: "success",
      timestamp: new Date().toISOString(),
      metadata: { deleteRelatedData: args.deleteRelatedData }
    });

    if (args.deleteRelatedData) {
      // Delete related data
      const contracts = await ctx.db
        .query("contracts")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect();
      
      for (const contract of contracts) {
        // Transfer ownership instead of deleting
        await ctx.db.patch(contract._id, {
          ownerId: undefined,
          notes: `${contract.notes || ""}\n[Previous owner deleted their account]`
        });
      }

      // Delete notifications
      const notifications = await ctx.db
        .query("notifications")
        .withIndex("by_recipient", (q) => q.eq("recipientId", user._id))
        .collect();
      
      for (const notification of notifications) {
        await ctx.db.delete(notification._id);
      }

      // Delete chat sessions
      const chatSessions = await ctx.db
        .query("chatSessions")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      
      for (const session of chatSessions) {
        await ctx.db.delete(session._id);
      }
    }

    // Anonymize user data instead of hard delete
    await ctx.db.patch(user._id, {
      email: `deleted-${user._id}@anonymized.com`,
      firstName: "Deleted",
      lastName: "User",
      phoneNumber: undefined,
      department: undefined,
      title: undefined,
      isActive: false,
      clerkId: `deleted-${user._id}`,
    });

    return { success: true, message: "User data has been anonymized" };
  },
});

// Anonymize user data (alternative to deletion)
export const anonymizeUserData = mutation({
  args: {
    userId: v.optional(v.id("users")),
    preserveAnalytics: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    let targetUserId = args.userId || securityContext.userId;
    
    // If targeting another user, require admin access
    if (args.userId && args.userId !== securityContext.userId) {
      if (!["owner", "admin"].includes(securityContext.role)) {
        throw new ConvexError("Access denied: Admin access required");
      }
    }

    const user = await ctx.db.get(targetUserId);
    if (!user) {
      throw new Error("User not found");
    }

    // Generate anonymous ID
    const anonymousId = `anon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Anonymize user data
    await ctx.db.patch(targetUserId, {
      email: `${anonymousId}@anonymized.com`,
      firstName: "Anonymous",
      lastName: "User",
      phoneNumber: undefined,
      department: args.preserveAnalytics ? user.department : undefined,
      title: undefined,
      clerkId: anonymousId,
    });

    // Log the anonymization
    await ctx.db.insert("auditLogs", {
      userId: securityContext.userId,
      enterpriseId: securityContext.enterpriseId,
      operation: "anonymizeUserData",
      resourceType: "users",
      resourceId: targetUserId,
      action: "update",
      status: "success",
      timestamp: new Date().toISOString(),
      metadata: { preserveAnalytics: args.preserveAnalytics }
    });

    return { success: true, anonymousId };
  },
});

// Export enterprise data (for admins)
export const exportEnterpriseData = action({
  args: {
    format: v.union(v.literal("json"), v.literal("csv")),
    dataTypes: v.array(v.union(
      v.literal("users"),
      v.literal("contracts"),
      v.literal("vendors"),
      v.literal("analytics"),
      v.literal("auditLogs")
    )),
    dateRange: v.optional(v.object({
      startDate: v.string(),
      endDate: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.runQuery(api.users.getByClerkId, { 
      clerkId: identity.subject 
    });

    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Log the export
    await ctx.runMutation(api.auditLogging.logEvent, {
      userId: user._id,
      operation: "exportEnterpriseData",
      resourceType: "enterpriseData",
      resourceId: user.enterpriseId,
      action: "export",
      status: "success",
      metadata: { 
        format: args.format, 
        dataTypes: args.dataTypes,
        dateRange: args.dateRange 
      }
    });

    const exportData: any = {
      enterprise: await ctx.runQuery(api.enterprises.getEnterpriseById, {
        enterpriseId: user.enterpriseId
      }),
      exportDate: new Date().toISOString(),
      format: args.format,
      requestedBy: user.email,
    };

    // Export requested data types
    if (args.dataTypes.includes("users")) {
      exportData.users = await ctx.runQuery(api.users.getEnterpriseUsers, {});
    }

    if (args.dataTypes.includes("contracts")) {
      const contracts = await ctx.runQuery(api.contracts.getContracts, {
        filters: args.dateRange ? {
          startDate: args.dateRange.startDate,
          endDate: args.dateRange.endDate,
        } : {}
      });
      exportData.contracts = contracts.contracts;
    }

    if (args.dataTypes.includes("vendors")) {
      exportData.vendors = await ctx.runQuery(api.vendors.getVendors, {});
    }

    if (args.dataTypes.includes("analytics")) {
      exportData.analytics = await ctx.runQuery(api.analytics.getDashboardSummary, {});
    }

    if (args.dataTypes.includes("auditLogs")) {
      const auditLogs = await ctx.runQuery(api.auditLogging.getAuditLogs, {
        filters: args.dateRange ? {
          startDate: args.dateRange.startDate,
          endDate: args.dateRange.endDate,
        } : {}
      });
      exportData.auditLogs = auditLogs.logs;
    }

    if (args.format === "csv") {
      return convertToCSVMultiple(exportData);
    }

    return exportData;
  },
});

// Get data retention policy
export const getDataRetentionPolicy = query({
  args: {},
  handler: async (ctx) => {
    return {
      policy: {
        userDataRetention: "7 years after account closure",
        contractDataRetention: "10 years after contract expiration",
        auditLogRetention: "3 years",
        analyticsDataRetention: "2 years",
        backupRetention: "90 days",
      },
      dataSubjectRights: [
        "Right to access personal data",
        "Right to rectification",
        "Right to erasure (right to be forgotten)",
        "Right to restrict processing",
        "Right to data portability",
        "Right to object to processing",
      ],
      contactInfo: {
        dataProtectionOfficer: "dpo@pactwise.com",
        privacyTeam: "privacy@pactwise.com",
      },
      lastUpdated: "2024-01-01",
    };
  },
});

// Request data portability
export const requestDataPortability = mutation({
  args: {
    targetService: v.union(
      v.literal("salesforce"),
      v.literal("hubspot"),
      v.literal("sap"),
      v.literal("custom")
    ),
    customEndpoint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);

    // Create portability request
    const request = {
      userId: securityContext.userId,
      enterpriseId: securityContext.enterpriseId,
      targetService: args.targetService,
      customEndpoint: args.customEndpoint,
      status: "pending",
      requestedAt: new Date().toISOString(),
    };

    // Log the request
    await ctx.db.insert("auditLogs", {
      userId: securityContext.userId,
      enterpriseId: securityContext.enterpriseId,
      operation: "requestDataPortability",
      resourceType: "userData",
      resourceId: securityContext.userId,
      action: "export",
      status: "success",
      timestamp: new Date().toISOString(),
      metadata: request
    });

    // In production, this would trigger an async job
    return {
      success: true,
      message: "Data portability request has been submitted. You will receive an email when the export is ready.",
      requestId: `port-${Date.now()}`,
    };
  },
});

// Helper function to convert data to CSV
function convertToCSV(data: any): any {
  const csvData: any = {
    format: "csv",
    files: {},
  };

  // Convert user data
  if (data.user) {
    const userHeaders = Object.keys(data.user);
    const userValues = Object.values(data.user).map(v => 
      typeof v === 'object' ? JSON.stringify(v) : v
    );
    csvData.files.user = {
      headers: userHeaders,
      rows: [userValues],
    };
  }

  // Convert related data
  if (data.relatedData) {
    for (const [key, items] of Object.entries(data.relatedData)) {
      if (Array.isArray(items) && items.length > 0) {
        const headers = Object.keys(items[0]);
        const rows = items.map(item => 
          headers.map(h => {
            const value = item[h];
            return typeof value === 'object' ? JSON.stringify(value) : value;
          })
        );
        csvData.files[key] = { headers, rows };
      }
    }
  }

  return csvData;
}

// Helper function to convert multiple data types to CSV
function convertToCSVMultiple(data: any): any {
  const csvData: any = {
    format: "csv",
    files: {},
  };

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value) && value.length > 0) {
      const headers = Object.keys(value[0]);
      const rows = value.map(item => 
        headers.map(h => {
          const val = item[h];
          return typeof val === 'object' ? JSON.stringify(val) : val;
        })
      );
      csvData.files[key] = { headers, rows };
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Single object
      const headers = Object.keys(value);
      const row = headers.map(h => {
        const val = value[h];
        return typeof val === 'object' ? JSON.stringify(val) : val;
      });
      csvData.files[key] = { headers, rows: [row] };
    }
  }

  return csvData;
}