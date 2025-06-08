import { query, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { getSecurityContext } from "./rowLevelSecurity";
import { ConvexError } from "convex/values";

/**
 * Security monitoring and analytics
 */

// Get security dashboard data
export const getSecurityDashboard = query({
  args: {
    timeRange: v.optional(v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d")
    ))
  },
  handler: async (ctx, args) => {
    const security = await getSecurityContext(ctx);
    
    // Only admins and owners can view security dashboard
    if (!["owner", "admin"].includes(security.role)) {
      throw new ConvexError("Access denied");
    }
    
    const timeRange = args.timeRange || "24h";
    const cutoffs = {
      "24h": new Date(Date.now() - 24 * 60 * 60 * 1000),
      "7d": new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      "30d": new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    };
    const cutoff = cutoffs[timeRange].toISOString();
    
    // Get audit logs
    const auditLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", security.enterpriseId))
      .filter((q) => q.gte(q.field("timestamp"), cutoff))
      .collect();
    
    // Get rate limit violations
    const rateLimitLogs = await ctx.db
      .query("rateLimitLogs")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .filter((q) => q.eq(q.field("allowed"), false))
      .collect();
    
    // Get active alerts
    const alerts = await ctx.db
      .query("auditAlerts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", security.enterpriseId))
      .filter((q) => q.eq(q.field("resolved"), false))
      .collect();
    
    // Calculate metrics
    const metrics = {
      totalOperations: auditLogs.length,
      failedOperations: auditLogs.filter(l => l.status === "failure").length,
      uniqueUsers: new Set(auditLogs.map(l => l.userId.toString())).size,
      rateLimitViolations: rateLimitLogs.length,
      activeAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === "critical").length,
    };
    
    // Group operations by type
    const operationsByType = auditLogs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Get top users by activity
    const userActivity = auditLogs.reduce((acc, log) => {
      acc[log.userId.toString()] = (acc[log.userId.toString()] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topUsers = await Promise.all(
      Object.entries(userActivity)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(async ([userId, count]) => {
          const user = await ctx.db.get(userId as Id<"users">);
          return {
            userId,
            name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
            email: user?.email,
            operationCount: count
          };
        })
    );
    
    // Recent security events
    const recentEvents = auditLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
      .map(log => ({
        ...log,
        timestamp: log.timestamp,
        operation: log.operation,
        resourceType: log.resourceType,
        status: log.status
      }));
    
    return {
      timeRange,
      metrics,
      operationsByType,
      topUsers,
      recentEvents,
      alerts: alerts.slice(0, 5),
      hourlyActivity: calculateHourlyActivity(auditLogs)
    };
  }
});

// Calculate hourly activity for chart
function calculateHourlyActivity(logs: any[]): any[] {
  const hourly: Record<string, number> = {};
  
  logs.forEach(log => {
    const hour = new Date(log.timestamp).toISOString().slice(0, 13);
    hourly[hour] = (hourly[hour] || 0) + 1;
  });
  
  return Object.entries(hourly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, count]) => ({
      hour: hour + ":00",
      count
    }));
}

// Automated security monitoring job
export const runSecurityMonitoring = internalMutation({
  args: {},
  handler: async (ctx) => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Check for suspicious patterns across all enterprises
    const enterprises = await ctx.db.query("enterprises").collect();
    
    for (const enterprise of enterprises) {
      // Check for unusual activity volume
      const recentLogs = await ctx.db
        .query("auditLogs")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterprise._id))
        .filter((q) => q.gte(q.field("timestamp"), oneHourAgo))
        .collect();
      
      if (recentLogs.length > 1000) {
        await ctx.db.insert("auditAlerts", {
          enterpriseId: enterprise._id,
          alertType: "suspicious_activity",
          severity: "high",
          description: `Unusually high activity: ${recentLogs.length} operations in the last hour`,
          resolved: false,
          createdAt: new Date().toISOString(),
          metadata: { operationCount: recentLogs.length }
        });
      }
      
      // Check for access from multiple IPs
      const userIPs = new Map<string, Set<string>>();
      recentLogs.forEach(log => {
        if (log.ipAddress) {
          const userId = log.userId.toString();
          if (!userIPs.has(userId)) {
            userIPs.set(userId, new Set());
          }
          userIPs.get(userId)!.add(log.ipAddress);
        }
      });
      
      for (const [userId, ips] of userIPs.entries()) {
        if (ips.size > 3) {
          await ctx.db.insert("auditAlerts", {
            enterpriseId: enterprise._id,
            alertType: "suspicious_activity",
            severity: "medium",
            description: `User accessing from ${ips.size} different IP addresses`,
            userId: userId as Id<"users">,
            resolved: false,
            createdAt: new Date().toISOString(),
            metadata: { ipAddresses: Array.from(ips) }
          });
        }
      }
    }
    
    // Note: Rate limit cleanup is handled by the rateLimiting module
  }
});

// Schedule monitoring to run every hour
export const scheduleSecurityMonitoring = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Schedule next monitoring run in 1 hour
    // Note: Scheduler calls would need proper internal API setup
    console.log("Security monitoring scheduled");
  }
});