import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { ConvexError } from "convex/values";
import { getSecurityContext } from "../security/rowLevelSecurity";

// System health check endpoint
export const getSystemHealth = query({
  args: {},
  handler: async (ctx) => {
    const checks: Record<string, { status: string; latency: number; error?: string }> = {
      database: { status: "healthy", latency: 0 },
      storage: { status: "healthy", latency: 0 },
      authentication: { status: "healthy", latency: 0 },
      aiServices: { status: "healthy", latency: 0 },
    };

    // Database health check
    const dbStart = Date.now();
    try {
      const testQuery = await ctx.db.query("users").take(1);
      checks.database.latency = Date.now() - dbStart;
      checks.database.status = "healthy";
    } catch (error) {
      checks.database.status = "unhealthy";
      checks.database.error = error instanceof Error ? error.message : String(error);
    }

    // Storage health check
    const storageStart = Date.now();
    try {
      // Check if we can generate a URL (doesn't actually access storage)
      const testUrl = await ctx.storage.getUrl("test-id" as any).catch(() => null);
      checks.storage.latency = Date.now() - storageStart;
      checks.storage.status = "healthy";
    } catch (error) {
      checks.storage.status = "unhealthy";
      checks.storage.error = error instanceof Error ? error.message : String(error);
    }

    // Authentication health check
    const authStart = Date.now();
    try {
      const identity = await ctx.auth.getUserIdentity();
      checks.authentication.latency = Date.now() - authStart;
      checks.authentication.status = identity ? "healthy" : "degraded";
    } catch (error) {
      checks.authentication.status = "unhealthy";
      checks.authentication.error = error instanceof Error ? error.message : String(error);
    }

    // Calculate overall health
    const statuses = Object.values(checks).map(c => c.status);
    const overallStatus = statuses.includes("unhealthy") ? "unhealthy" :
                         statuses.includes("degraded") ? "degraded" : "healthy";

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      version: process.env.APP_VERSION || "1.0.0",
      environment: process.env.NODE_ENV || "production",
    };
  },
});

// Get system metrics
export const getSystemMetrics = query({
  args: {
    timeRange: v.union(
      v.literal("1h"),
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d")
    ),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can view system metrics
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    // Calculate time range
    const now = Date.now();
    const timeRanges = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    const startTime = new Date(now - timeRanges[args.timeRange]);

    // Get metrics data
    const [contracts, vendors, users, analytics, errors] = await Promise.all([
      ctx.db.query("contracts")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
        .collect(),
      ctx.db.query("vendors")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
        .collect(),
      ctx.db.query("users")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
        .collect(),
      ctx.db.query("analytics_events")
        .withIndex("by_enterprise_timestamp", (q) => 
          q.eq("enterpriseId", securityContext.enterpriseId)
            .gte("timestamp", startTime.getTime())
        )
        .collect(),
      ctx.db.query("error_reports")
        .withIndex("by_enterprise_timestamp", (q) => 
          q.eq("enterpriseId", securityContext.enterpriseId)
            .gte("timestamp", startTime.getTime())
        )
        .collect(),
    ]);

    // Calculate active users
    const activeUserIds = new Set(
      analytics
        .filter(e => e.authenticatedUserId)
        .map(e => e.authenticatedUserId)
    );

    // Calculate API usage
    const apiCalls = await ctx.db.query("rateLimitLogs")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", startTime.toISOString()))
      .collect();

    const enterpriseApiCalls = apiCalls.filter(call => 
      users.some(u => u._id === call.userId)
    );

    // Calculate storage usage
    const storageUsage = contracts.length * 1; // Simplified: 1MB per contract

    // Group errors by type
    const errorBreakdown = errors.reduce((acc, error) => {
      const type = error.message.split(':')[0] || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate performance metrics
    const avgResponseTime = analytics.length > 0
      ? analytics.reduce((sum, e) => sum + (e.properties?.duration || 0), 0) / analytics.length
      : 0;

    return {
      timeRange: args.timeRange,
      timestamp: new Date().toISOString(),
      overview: {
        totalContracts: contracts.length,
        activeContracts: contracts.filter(c => c.status === "active").length,
        totalVendors: vendors.length,
        activeVendors: vendors.filter(v => v.status === "active").length,
        totalUsers: users.length,
        activeUsers: activeUserIds.size,
      },
      usage: {
        apiCalls: enterpriseApiCalls.length,
        successfulCalls: enterpriseApiCalls.filter(c => c.allowed).length,
        failedCalls: enterpriseApiCalls.filter(c => !c.allowed).length,
        storageUsedMB: storageUsage,
        bandwidthMB: Math.round(enterpriseApiCalls.length * 0.1), // Estimate
      },
      performance: {
        avgResponseTime: Math.round(avgResponseTime),
        errorRate: analytics.length > 0 ? (errors.length / analytics.length) * 100 : 0,
        uptime: 99.9, // Would need real monitoring
        errorCount: errors.length,
        errorBreakdown,
      },
      activity: {
        pageViews: analytics.filter(e => e.event === "page_view").length,
        uniqueVisitors: activeUserIds.size,
        contractsCreated: contracts.filter(c => 
          new Date(c.createdAt) >= startTime
        ).length,
        vendorsCreated: vendors.filter(v => 
          new Date(v.createdAt) >= startTime
        ).length,
      },
    };
  },
});

// Get performance statistics
export const getPerformanceStats = query({
  args: {},
  handler: async (ctx) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can view performance stats
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get recent operations
    const [auditLogs, rateLimits, errors] = await Promise.all([
      ctx.db.query("auditLogs")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
        .filter((q) => q.gte(q.field("timestamp"), last24Hours.toISOString()))
        .collect(),
      ctx.db.query("rateLimitLogs")
        .withIndex("by_timestamp", (q) => q.gte("timestamp", last24Hours.toISOString()))
        .collect(),
      ctx.db.query("error_reports")
        .withIndex("by_enterprise_timestamp", (q) => 
          q.eq("enterpriseId", securityContext.enterpriseId)
            .gte("timestamp", last24Hours.getTime())
        )
        .collect(),
    ]);

    // Calculate operation performance
    const operationStats = auditLogs.reduce((acc, log) => {
      const key = `${log.resourceType}.${log.action}`;
      if (!acc[key]) {
        acc[key] = { count: 0, success: 0, failure: 0 };
      }
      acc[key].count++;
      if (log.status === "success") {
        acc[key].success++;
      } else {
        acc[key].failure++;
      }
      return acc;
    }, {} as Record<string, { count: number; success: number; failure: number }>);

    // Calculate rate limit impact
    const rateLimitStats = rateLimits.reduce((acc, log) => {
      if (!acc[log.operation]) {
        acc[log.operation] = { allowed: 0, blocked: 0 };
      }
      if (log.allowed) {
        acc[log.operation].allowed++;
      } else {
        acc[log.operation].blocked++;
      }
      return acc;
    }, {} as Record<string, { allowed: number; blocked: number }>);

    // Top operations by volume
    const topOperations = Object.entries(operationStats)
      .map(([op, stats]) => ({
        operation: op,
        ...stats,
        successRate: stats.count > 0 ? (stats.success / stats.count) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Critical errors
    const criticalErrors = errors
      .filter(e => e.stack?.includes("Error") || e.message.includes("failed"))
      .slice(0, 10);

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalOperations: auditLogs.length,
        successfulOperations: auditLogs.filter(l => l.status === "success").length,
        failedOperations: auditLogs.filter(l => l.status === "failure").length,
        overallSuccessRate: auditLogs.length > 0 
          ? (auditLogs.filter(l => l.status === "success").length / auditLogs.length) * 100 
          : 0,
        totalErrors: errors.length,
      },
      topOperations,
      rateLimitImpact: Object.entries(rateLimitStats).map(([op, stats]) => ({
        operation: op,
        ...stats,
        blockRate: (stats.allowed + stats.blocked) > 0 
          ? (stats.blocked / (stats.allowed + stats.blocked)) * 100 
          : 0,
      })),
      criticalErrors: criticalErrors.map(e => ({
        message: e.message,
        timestamp: new Date(e.timestamp).toISOString(),
        url: e.url,
        userId: e.userId,
      })),
    };
  },
});

// Get error logs
export const getErrorLogs = query({
  args: {
    limit: v.optional(v.number()),
    severity: v.optional(v.union(
      v.literal("all"),
      v.literal("error"),
      v.literal("warning"),
      v.literal("critical")
    )),
    timeRange: v.optional(v.union(
      v.literal("1h"),
      v.literal("24h"),
      v.literal("7d")
    )),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can view error logs
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    let startTime = 0;
    if (args.timeRange) {
      const timeRanges = {
        "1h": 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
      };
      startTime = Date.now() - timeRanges[args.timeRange];
    }

    // Query errors based on time range
    const baseQuery = ctx.db.query("error_reports")
      .withIndex("by_enterprise_timestamp", (q) => 
        q.eq("enterpriseId", securityContext.enterpriseId)
      );
    
    let errors = await baseQuery
      .order("desc")
      .take(args.limit || 100);
    
    // Filter by timestamp if needed
    if (startTime > 0) {
      errors = errors.filter(e => e.serverTimestamp >= startTime);
    }

    // Filter by severity if needed
    if (args.severity && args.severity !== "all") {
      errors = errors.filter(e => {
        if (args.severity === "critical") {
          return e.message.toLowerCase().includes("critical") || 
                 e.message.toLowerCase().includes("fatal");
        }
        if (args.severity === "error") {
          return e.message.toLowerCase().includes("error");
        }
        if (args.severity === "warning") {
          return e.message.toLowerCase().includes("warning");
        }
        return true;
      });
    }

    // Enrich with user data
    const enrichedErrors = await Promise.all(
      errors.map(async (error) => {
        let userName = "Unknown";
        if (error.authenticatedUserId) {
          const user = await ctx.db.get(error.authenticatedUserId);
          userName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : "Unknown";
        }
        
        return {
          ...error,
          userName,
          timestamp: new Date(error.timestamp).toISOString(),
          severity: error.message.toLowerCase().includes("critical") ? "critical" :
                   error.message.toLowerCase().includes("error") ? "error" : "warning",
        };
      })
    );

    return {
      errors: enrichedErrors,
      total: enrichedErrors.length,
      timeRange: args.timeRange || "all",
    };
  },
});

// Record health check
export const recordHealthCheck = mutation({
  args: {
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("health_checks", {
      timestamp: Date.now(),
      status: args.status,
      createdAt: new Date().toISOString(),
    });

    // Clean up old health checks (keep last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const oldChecks = await ctx.db
      .query("health_checks")
      .filter((q) => q.lt(q.field("timestamp"), sevenDaysAgo))
      .collect();

    for (const check of oldChecks) {
      await ctx.db.delete(check._id);
    }
  },
});

// Get feature flags (for A/B testing and gradual rollouts)
export const getFeatureFlags = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return getDefaultFeatureFlags();
    }

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), identity.subject))
      .first();

    if (!user) {
      return getDefaultFeatureFlags();
    }

    // Feature flags can be based on user role, enterprise, or other factors
    const flags = {
      newDashboard: true,
      aiInsights: user.role === "owner" || user.role === "admin",
      advancedAnalytics: user.role === "owner" || user.role === "admin",
      bulkOperations: true,
      collaborativeEditing: true,
      customReports: user.role === "owner" || user.role === "admin",
      apiAccess: user.role === "owner" || user.role === "admin",
      webhooks: user.role === "owner" || user.role === "admin",
      dataExport: true,
      themeCustomization: true,
    };

    return {
      flags,
      userId: user._id,
      role: user.role,
      timestamp: new Date().toISOString(),
    };
  },
});

function getDefaultFeatureFlags() {
  return {
    flags: {
      newDashboard: true,
      aiInsights: false,
      advancedAnalytics: false,
      bulkOperations: true,
      collaborativeEditing: true,
      customReports: false,
      apiAccess: false,
      webhooks: false,
      dataExport: true,
      themeCustomization: true,
    },
    userId: null,
    role: null,
    timestamp: new Date().toISOString(),
  };
}