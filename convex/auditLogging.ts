import { QueryCtx, MutationCtx, ActionCtx, query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { defineTable } from "convex/server";
import { Id } from "./_generated/dataModel";
import { getSecurityContext } from "./security/rowLevelSecurity";

/**
 * Comprehensive Audit Logging System
 * 
 * Tracks all sensitive operations for compliance and security monitoring
 */

export const auditTables = {
  auditLogs: defineTable({
    userId: v.id("users"),
    enterpriseId: v.id("enterprises"),
    operation: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    action: v.union(
      v.literal("create"),
      v.literal("read"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("export"),
      v.literal("share"),
      v.literal("approve"),
      v.literal("reject")
    ),
    changes: v.optional(v.any()), // Before/after for updates
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    status: v.union(v.literal("success"), v.literal("failure")),
    errorMessage: v.optional(v.string()),
    timestamp: v.string(),
    metadata: v.optional(v.any()),
  })
  .index("by_user", ["userId"])
  .index("by_enterprise", ["enterpriseId"])
  .index("by_resource", ["resourceType", "resourceId"])
  .index("by_timestamp", ["timestamp"])
  .index("by_operation", ["operation"])
  .index("by_status", ["status"]),
  
  auditAlerts: defineTable({
    enterpriseId: v.id("enterprises"),
    alertType: v.union(
      v.literal("suspicious_activity"),
      v.literal("unauthorized_access"),
      v.literal("data_export"),
      v.literal("permission_change"),
      v.literal("bulk_operation"),
      v.literal("failed_attempts")
    ),
    severity: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical")
    ),
    description: v.string(),
    userId: v.optional(v.id("users")),
    ipAddress: v.optional(v.string()),
    resolved: v.boolean(),
    resolvedBy: v.optional(v.id("users")),
    resolvedAt: v.optional(v.string()),
    createdAt: v.string(),
    metadata: v.optional(v.any()),
  })
  .index("by_enterprise", ["enterpriseId"])
  .index("by_severity", ["severity"])
  .index("by_resolved", ["resolved"])
  .index("by_created", ["createdAt"]),
};

interface AuditContext {
  userId: Id<"users">;
  enterpriseId: Id<"enterprises">;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(
  ctx: MutationCtx,
  context: AuditContext,
  event: {
    operation: string;
    resourceType: string;
    resourceId?: string;
    action: "create" | "read" | "update" | "delete" | "export" | "share" | "approve" | "reject";
    changes?: any;
    status: "success" | "failure";
    errorMessage?: string;
    metadata?: any;
  }
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    userId: context.userId,
    enterpriseId: context.enterpriseId,
    operation: event.operation,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    action: event.action,
    changes: event.changes,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    sessionId: context.sessionId,
    status: event.status,
    errorMessage: event.errorMessage,
    timestamp: new Date().toISOString(),
    metadata: event.metadata,
  });
  
  // Check for suspicious patterns
  await checkSuspiciousActivity(ctx, context, event);
}

/**
 * Check for suspicious activity patterns
 */
async function checkSuspiciousActivity(
  ctx: MutationCtx,
  context: AuditContext,
  event: any
): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  // Check for multiple failed attempts
  const recentFailures = await ctx.db
    .query("auditLogs")
    .withIndex("by_user", (q) => q.eq("userId", context.userId))
    .filter((q) => 
      q.and(
        q.eq(q.field("status"), "failure"),
        q.gte(q.field("timestamp"), oneHourAgo)
      )
    )
    .collect();
  
  if (recentFailures.length >= 5) {
    await createAuditAlert(ctx, {
      enterpriseId: context.enterpriseId,
      alertType: "failed_attempts",
      severity: "high",
      description: `User has ${recentFailures.length} failed attempts in the last hour`,
      userId: context.userId,
      ipAddress: context.ipAddress,
      metadata: { failureCount: recentFailures.length }
    });
  }
  
  // Check for bulk operations
  if (event.action === "delete" || event.action === "export") {
    const recentSimilar = await ctx.db
      .query("auditLogs")
      .withIndex("by_user", (q) => q.eq("userId", context.userId))
      .filter((q) => 
        q.and(
          q.eq(q.field("action"), event.action),
          q.gte(q.field("timestamp"), oneHourAgo)
        )
      )
      .collect();
    
    if (recentSimilar.length >= 10) {
      await createAuditAlert(ctx, {
        enterpriseId: context.enterpriseId,
        alertType: "bulk_operation",
        severity: "medium",
        description: `User performed ${recentSimilar.length} ${event.action} operations in the last hour`,
        userId: context.userId,
        ipAddress: context.ipAddress,
        metadata: { operationCount: recentSimilar.length, action: event.action }
      });
    }
  }
  
  // Check for data exports
  if (event.action === "export") {
    await createAuditAlert(ctx, {
      enterpriseId: context.enterpriseId,
      alertType: "data_export",
      severity: "low",
      description: `Data export performed on ${event.resourceType}`,
      userId: context.userId,
      ipAddress: context.ipAddress,
      metadata: { resourceType: event.resourceType, resourceId: event.resourceId }
    });
  }
  
  // Check for permission changes
  if (event.resourceType === "users" && event.action === "update" && event.changes?.role) {
    await createAuditAlert(ctx, {
      enterpriseId: context.enterpriseId,
      alertType: "permission_change",
      severity: "medium",
      description: `User role changed from ${event.changes.role.old} to ${event.changes.role.new}`,
      userId: context.userId,
      metadata: { targetUserId: event.resourceId, roleChange: event.changes.role }
    });
  }
}

/**
 * Create an audit alert
 */
async function createAuditAlert(
  ctx: MutationCtx,
  alert: {
    enterpriseId: Id<"enterprises">;
    alertType: "suspicious_activity" | "unauthorized_access" | "data_export" | "permission_change" | "bulk_operation" | "failed_attempts";
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    userId?: Id<"users">;
    ipAddress?: string;
    metadata?: any;
  }
): Promise<void> {
  // Check if similar alert already exists
  const existingAlert = await ctx.db
    .query("auditAlerts")
    .withIndex("by_enterprise", (q) => q.eq("enterpriseId", alert.enterpriseId))
    .filter((q) => 
      q.and(
        q.eq(q.field("alertType"), alert.alertType),
        q.eq(q.field("userId"), alert.userId),
        q.eq(q.field("resolved"), false)
      )
    )
    .first();
  
  if (!existingAlert) {
    await ctx.db.insert("auditAlerts", {
      ...alert,
      resolved: false,
      createdAt: new Date().toISOString(),
    });
    
    // TODO: Send notification to admins
  }
}

/**
 * Audit log query functions
 */
export const getAuditLogs = query({
  args: {
    filters: v.optional(v.object({
      userId: v.optional(v.id("users")),
      resourceType: v.optional(v.string()),
      resourceId: v.optional(v.string()),
      action: v.optional(v.string()),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      status: v.optional(v.union(v.literal("success"), v.literal("failure"))),
    })),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins and owners can view audit logs
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Audit logs require admin access");
    }
    
    let query = ctx.db
      .query("auditLogs")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId));
    
    // Apply filters
    let logs = await query.order("desc").collect();
    
    if (args.filters) {
      if (args.filters.userId) {
        logs = logs.filter(l => l.userId === args.filters!.userId);
      }
      if (args.filters.resourceType) {
        logs = logs.filter(l => l.resourceType === args.filters!.resourceType);
      }
      if (args.filters.resourceId) {
        logs = logs.filter(l => l.resourceId === args.filters!.resourceId);
      }
      if (args.filters.action) {
        logs = logs.filter(l => l.action === args.filters!.action);
      }
      if (args.filters.status) {
        logs = logs.filter(l => l.status === args.filters!.status);
      }
      if (args.filters.startDate) {
        logs = logs.filter(l => l.timestamp >= args.filters!.startDate!);
      }
      if (args.filters.endDate) {
        logs = logs.filter(l => l.timestamp <= args.filters!.endDate!);
      }
    }
    
    // Apply pagination
    const limit = args.limit || 50;
    const offset = args.offset || 0;
    const paginatedLogs = logs.slice(offset, offset + limit);
    
    // Enrich with user information
    const enrichedLogs = await Promise.all(
      paginatedLogs.map(async (log) => {
        const user = await ctx.db.get(log.userId);
        return {
          ...log,
          userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
          userEmail: user?.email,
        };
      })
    );
    
    return {
      logs: enrichedLogs,
      total: logs.length,
      hasMore: offset + limit < logs.length,
    };
  },
});

/**
 * Get audit alerts
 */
export const getAuditAlerts = query({
  args: {
    resolved: v.optional(v.boolean()),
    severity: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical")
    )),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins and owners can view audit alerts
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Audit alerts require admin access");
    }
    
    let query = ctx.db
      .query("auditAlerts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId));
    
    let alerts = await query.order("desc").collect();
    
    if (args.resolved !== undefined) {
      alerts = alerts.filter(a => a.resolved === args.resolved);
    }
    
    if (args.severity) {
      alerts = alerts.filter(a => a.severity === args.severity);
    }
    
    return alerts;
  },
});

/**
 * Resolve an audit alert
 */
export const resolveAuditAlert = mutation({
  args: {
    alertId: v.id("auditAlerts"),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins and owners can resolve alerts
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Only admins can resolve alerts");
    }
    
    const alert = await ctx.db.get(args.alertId);
    if (!alert) {
      throw new ConvexError("Alert not found");
    }
    
    if (alert.enterpriseId !== securityContext.enterpriseId) {
      throw new ConvexError("Access denied: Alert belongs to different enterprise");
    }
    
    await ctx.db.patch(args.alertId, {
      resolved: true,
      resolvedBy: securityContext.userId,
      resolvedAt: new Date().toISOString(),
    });
    
    // Log the resolution
    await logAuditEvent(ctx, securityContext, {
      operation: "resolveAuditAlert",
      resourceType: "auditAlerts",
      resourceId: args.alertId,
      action: "update",
      status: "success",
      metadata: { alertType: alert.alertType, severity: alert.severity }
    });
  },
});

/**
 * Log an audit event (mutation for external calls)
 */
export const logEvent = mutation({
  args: {
    userId: v.id("users"),
    operation: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    action: v.union(
      v.literal("create"),
      v.literal("read"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("export"),
      v.literal("share"),
      v.literal("approve"),
      v.literal("reject")
    ),
    status: v.union(v.literal("success"), v.literal("failure")),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Get user to find enterpriseId
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    await ctx.db.insert("auditLogs", {
      userId: args.userId,
      enterpriseId: user.enterpriseId,
      operation: args.operation,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      action: args.action,
      status: args.status,
      errorMessage: args.errorMessage,
      metadata: args.metadata,
      timestamp: new Date().toISOString(),
      ipAddress: "unknown", // Actions don't have IP info
      userAgent: "system",
      sessionId: "action-session",
    });
  },
});