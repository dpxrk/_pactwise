import { query, mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { api } from "../_generated/api";

/**
 * Performance monitoring for Convex queries
 */

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  QUERY_SLOW: 200,        // ms - queries slower than this are logged
  QUERY_CRITICAL: 1000,   // ms - queries slower than this trigger alerts
  MEMORY_WARNING: 50,     // MB - memory usage warning
  MEMORY_CRITICAL: 100,   // MB - memory usage critical
} as const;

// Monitored query types
const MONITORED_OPERATIONS = [
  "contracts.getContracts",
  "contracts.getContractsOptimized",
  "vendors.getVendors",
  "vendors.getVendorAnalytics",
  "analytics.getDashboardSummary",
  "analytics.getContractAnalytics",
  "search.searchContracts",
  "ai.searchContractsNL",
] as const;

type MonitoredOperation = typeof MONITORED_OPERATIONS[number];

/**
 * Log query performance metrics
 */
export const logQueryPerformance = internalMutation({
  args: {
    operation: v.string(),
    duration: v.number(),
    resultCount: v.optional(v.number()),
    memoryUsed: v.optional(v.number()),
    metadata: v.optional(v.object({
      enterpriseId: v.optional(v.id("enterprises")),
      userId: v.optional(v.id("users")),
      filters: v.optional(v.any()),
      cursor: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    
    // Determine performance level
    let level: "normal" | "slow" | "critical" = "normal";
    if (args.duration >= PERFORMANCE_THRESHOLDS.QUERY_CRITICAL) {
      level = "critical";
    } else if (args.duration >= PERFORMANCE_THRESHOLDS.QUERY_SLOW) {
      level = "slow";
    }

    // Store performance log
    // TODO: Add performanceLogs table to schema
    console.log("Performance log:", {
      operation: args.operation,
      duration: args.duration,
      level,
      resultCount: args.resultCount,
      memoryUsed: args.memoryUsed,
      metadata: args.metadata,
      timestamp,
      hour: new Date(timestamp).toISOString().substring(0, 13), // For hourly aggregation
      day: new Date(timestamp).toISOString().substring(0, 10),  // For daily aggregation
    });

    // Trigger alert if critical
    if (level === "critical") {
      // TODO: Add performanceAlerts table to schema
      console.error("PERFORMANCE ALERT:", {
        operation: args.operation,
        duration: args.duration,
        level: "critical",
        message: `Query ${args.operation} took ${args.duration}ms (threshold: ${PERFORMANCE_THRESHOLDS.QUERY_CRITICAL}ms)`,
        timestamp,
        acknowledged: false,
      });
    }
  },
});

/**
 * Get performance metrics for a specific operation
 */
export const getOperationMetrics = query({
  args: {
    operation: v.string(),
    timeRange: v.optional(v.union(
      v.literal("hour"),
      v.literal("day"),
      v.literal("week"),
      v.literal("month")
    )),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let startTime = now;

    switch (args.timeRange || "day") {
      case "hour":
        startTime = now - 60 * 60 * 1000;
        break;
      case "day":
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case "week":
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case "month":
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }

    // TODO: Implement performanceLogs table
    // For now, return mock data
    const logs: any[] = [];

    if (logs.length === 0) {
      return {
        operation: args.operation,
        timeRange: args.timeRange || "day",
        metrics: {
          count: 0,
          avgDuration: 0,
          minDuration: 0,
          maxDuration: 0,
          p50Duration: 0,
          p95Duration: 0,
          p99Duration: 0,
          slowQueries: 0,
          criticalQueries: 0,
        },
      };
    }

    // Calculate metrics
    const durations = logs.map(l => l.duration).sort((a, b) => a - b);
    const count = logs.length;
    const avgDuration = durations.reduce((a, b) => a + b, 0) / count;
    const minDuration = durations[0];
    const maxDuration = durations[count - 1];
    const p50Duration = durations[Math.floor(count * 0.5)];
    const p95Duration = durations[Math.floor(count * 0.95)];
    const p99Duration = durations[Math.floor(count * 0.99)];
    const slowQueries = logs.filter(l => l.level === "slow").length;
    const criticalQueries = logs.filter(l => l.level === "critical").length;

    return {
      operation: args.operation,
      timeRange: args.timeRange || "day",
      metrics: {
        count,
        avgDuration: Math.round(avgDuration),
        minDuration,
        maxDuration,
        p50Duration,
        p95Duration,
        p99Duration,
        slowQueries,
        criticalQueries,
      },
      recentSlowQueries: logs
        .filter(l => l.level !== "normal")
        .slice(-10)
        .map(l => ({
          duration: l.duration,
          timestamp: new Date(l.timestamp).toISOString(),
          metadata: l.metadata,
        })),
    };
  },
});

/**
 * Get overall system performance dashboard
 */
export const getPerformanceDashboard = query({
  args: {
    timeRange: v.optional(v.union(
      v.literal("hour"),
      v.literal("day"),
      v.literal("week")
    )),
  },
  handler: async (ctx, args) => {
    const timeRange = args.timeRange || "day";
    const now = Date.now();
    let startTime = now;

    switch (timeRange) {
      case "hour":
        startTime = now - 60 * 60 * 1000;
        break;
      case "day":
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case "week":
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
    }

    // TODO: Implement performanceLogs and performanceAlerts tables
    // For now, return mock data
    const logs: any[] = [];
    const alerts: any[] = [];

    // Aggregate by operation
    const operationStats = new Map<string, any>();
    
    logs.forEach(log => {
      const stats = operationStats.get(log.operation) || {
        count: 0,
        totalDuration: 0,
        slowCount: 0,
        criticalCount: 0,
      };

      stats.count++;
      stats.totalDuration += log.duration;
      if (log.level === "slow") stats.slowCount++;
      if (log.level === "critical") stats.criticalCount++;

      operationStats.set(log.operation, stats);
    });

    // Calculate top operations
    const topOperations = Array.from(operationStats.entries())
      .map(([operation, stats]) => ({
        operation,
        count: stats.count,
        avgDuration: Math.round(stats.totalDuration / stats.count),
        slowRate: (stats.slowCount / stats.count) * 100,
        criticalRate: (stats.criticalCount / stats.count) * 100,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10);

    // Calculate hourly trend
    const hourlyTrend = new Map<string, { count: number; totalDuration: number }>();
    
    logs.forEach(log => {
      const hour = log.hour;
      const trend = hourlyTrend.get(hour) || { count: 0, totalDuration: 0 };
      trend.count++;
      trend.totalDuration += log.duration;
      hourlyTrend.set(hour, trend);
    });

    const trends = Array.from(hourlyTrend.entries())
      .map(([hour, data]) => ({
        hour,
        count: data.count,
        avgDuration: Math.round(data.totalDuration / data.count),
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return {
      timeRange,
      summary: {
        totalQueries: logs.length,
        avgDuration: logs.length > 0 
          ? Math.round(logs.reduce((sum, l) => sum + l.duration, 0) / logs.length)
          : 0,
        slowQueries: logs.filter(l => l.level === "slow").length,
        criticalQueries: logs.filter(l => l.level === "critical").length,
        activeAlerts: alerts.length,
      },
      topOperations,
      hourlyTrend: trends,
      recentAlerts: alerts.map(a => ({
        id: a._id,
        operation: a.operation,
        duration: a.duration,
        message: a.message,
        timestamp: new Date(a.timestamp).toISOString(),
      })),
    };
  },
});

/**
 * Compare performance between original and optimized queries
 */
export const compareQueryPerformance = query({
  args: {
    originalOperation: v.string(),
    optimizedOperation: v.string(),
    timeRange: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const [originalMetrics, optimizedMetrics] = await Promise.all([
      ctx.runQuery(api.monitoring.performanceMonitoring.getOperationMetrics, {
        operation: args.originalOperation,
        timeRange: args.timeRange as any,
      }),
      ctx.runQuery(api.monitoring.performanceMonitoring.getOperationMetrics, {
        operation: args.optimizedOperation,
        timeRange: args.timeRange as any,
      }),
    ]);

    const improvement = {
      avgDuration: originalMetrics.metrics.avgDuration > 0
        ? ((originalMetrics.metrics.avgDuration - optimizedMetrics.metrics.avgDuration) / originalMetrics.metrics.avgDuration) * 100
        : 0,
      p95Duration: originalMetrics.metrics.p95Duration > 0
        ? ((originalMetrics.metrics.p95Duration - optimizedMetrics.metrics.p95Duration) / originalMetrics.metrics.p95Duration) * 100
        : 0,
      slowQueries: originalMetrics.metrics.slowQueries > 0
        ? ((originalMetrics.metrics.slowQueries - optimizedMetrics.metrics.slowQueries) / originalMetrics.metrics.slowQueries) * 100
        : 0,
    };

    return {
      original: originalMetrics,
      optimized: optimizedMetrics,
      improvement,
      recommendation: improvement.avgDuration > 20 
        ? "Optimized query shows significant improvement. Consider migrating."
        : "Performance improvement is marginal. Review implementation.",
    };
  },
});

/**
 * Acknowledge performance alert
 */
export const acknowledgeAlert = mutation({
  args: {
    alertId: v.id("performanceAlerts"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // TODO: Implement performanceAlerts table
    // await ctx.db.patch(args.alertId, {
    //   acknowledged: true,
    //   acknowledgedAt: Date.now(),
    //   acknowledgedBy: identity.subject,
    // });
    console.log("Alert acknowledged:", args.alertId);

    return { success: true };
  },
});

/**
 * Clean up old performance logs
 */
export const cleanupOldLogs = internalMutation({
  args: {
    daysToKeep: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysToKeep = args.daysToKeep || 30;
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    let deleted = 0;
    const BATCH_SIZE = 100;

    // TODO: Implement cleanup when performanceLogs and performanceAlerts tables are added
    console.log("Cleanup would delete logs older than", new Date(cutoffTime).toISOString());
    
    // Placeholder - remove when tables are implemented
    const oldAlerts: any[] = [];
    
    for (const alert of oldAlerts) {
      await ctx.db.delete(alert._id);
      deleted++;
    }

    return {
      deleted,
      logsDeleted: deleted - oldAlerts.length,
      alertsDeleted: oldAlerts.length,
    };
  },
});

/**
 * Wrapper to monitor query performance
 */
export function withPerformanceMonitoring<Args extends Record<string, any>, Result>(
  operation: string,
  queryFn: (ctx: any, args: Args) => Promise<Result>
) {
  return async (ctx: any, args: Args): Promise<Result> => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = await queryFn(ctx, args);
      const duration = Date.now() - startTime;
      const memoryUsed = process.memoryUsage().heapUsed - startMemory;

      // Log performance asynchronously
      ctx.scheduler.runAfter(0, api.monitoring.performanceMonitoring.logQueryPerformance, {
        operation,
        duration,
        resultCount: Array.isArray(result) ? result.length : undefined,
        memoryUsed: Math.round(memoryUsed / 1024 / 1024), // Convert to MB
        metadata: {
          enterpriseId: args.enterpriseId,
          filters: args.filters || args.status || args.type,
          cursor: args.cursor,
        },
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log error
      ctx.scheduler.runAfter(0, api.monitoring.performanceMonitoring.logQueryPerformance, {
        operation,
        duration,
        metadata: {
          error: String(error),
        },
      });

      throw error;
    }
  };
}