import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";

/**
 * Query Performance Monitoring for Convex
 * Tracks query execution times and patterns
 */

interface QueryMetrics {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  rowsReturned?: number;
  cacheHit?: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export class QueryPerformanceMonitor {
  private metrics: QueryMetrics[] = [];
  private readonly slowQueryThreshold = 100; // milliseconds
  private readonly context: string;

  constructor(context: string = "unknown") {
    this.context = context;
  }

  /**
   * Start tracking a query
   */
  startQuery(name: string, metadata?: Record<string, any>): QueryMetrics {
    const metric: QueryMetrics = {
      name,
      startTime: Date.now(),
      metadata,
    };
    this.metrics.push(metric);
    return metric;
  }

  /**
   * End tracking a query
   */
  endQuery(metric: QueryMetrics, rowsReturned?: number, cacheHit?: boolean): void {
    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.rowsReturned = rowsReturned;
    metric.cacheHit = cacheHit;

    // Log slow queries
    if (metric.duration > this.slowQueryThreshold) {
      console.warn(`Slow query detected: ${metric.name} took ${metric.duration}ms`, {
        context: this.context,
        rowsReturned: metric.rowsReturned,
        cacheHit: metric.cacheHit,
        metadata: metric.metadata,
      });
    }
  }

  /**
   * Record query error
   */
  recordError(metric: QueryMetrics, error: Error): void {
    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.error = error.message;
    
    console.error(`Query error: ${metric.name}`, {
      context: this.context,
      duration: metric.duration,
      error: error.message,
      metadata: metric.metadata,
    });
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    totalQueries: number;
    totalDuration: number;
    averageDuration: number;
    slowQueries: number;
    cacheHitRate: number;
    errors: number;
  } {
    const totalQueries = this.metrics.length;
    const completedQueries = this.metrics.filter(m => m.duration !== undefined);
    const totalDuration = completedQueries.reduce((sum, m) => sum + (m.duration || 0), 0);
    const averageDuration = totalQueries > 0 ? totalDuration / completedQueries.length : 0;
    const slowQueries = completedQueries.filter(m => (m.duration || 0) > this.slowQueryThreshold).length;
    const cacheHits = completedQueries.filter(m => m.cacheHit === true).length;
    const cacheHitRate = completedQueries.length > 0 ? cacheHits / completedQueries.length : 0;
    const errors = this.metrics.filter(m => m.error !== undefined).length;

    return {
      totalQueries,
      totalDuration,
      averageDuration,
      slowQueries,
      cacheHitRate,
      errors,
    };
  }

  /**
   * Get slow queries
   */
  getSlowQueries(): QueryMetrics[] {
    return this.metrics
      .filter(m => (m.duration || 0) > this.slowQueryThreshold)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));
  }

  /**
   * Clear metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Export metrics for logging
   */
  exportMetrics(): QueryMetrics[] {
    return [...this.metrics];
  }
}

/**
 * Wrap a query with performance monitoring
 */
export async function withQueryMonitoring<T>(
  monitor: QueryPerformanceMonitor,
  queryName: string,
  queryFn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const metric = monitor.startQuery(queryName, metadata);
  
  try {
    const result = await queryFn();
    
    // Try to determine rows returned
    let rowsReturned = 0;
    if (Array.isArray(result)) {
      rowsReturned = result.length;
    } else if (result && typeof result === 'object' && 'length' in result) {
      rowsReturned = (result as any).length;
    }
    
    monitor.endQuery(metric, rowsReturned, false);
    return result;
  } catch (error) {
    monitor.recordError(metric, error as Error);
    throw error;
  }
}

/**
 * Create a performance-monitored query context
 */
export function createMonitoredQueryContext(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  contextName: string
): {
  monitor: QueryPerformanceMonitor;
  query: <T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>) => Promise<T>;
  summary: () => void;
} {
  const monitor = new QueryPerformanceMonitor(contextName);

  return {
    monitor,
    query: async <T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>) => {
      return withQueryMonitoring(monitor, name, fn, metadata);
    },
    summary: () => {
      const summary = monitor.getSummary();
      if (summary.totalQueries > 0) {
        console.log(`Query Performance Summary for ${contextName}:`, {
          ...summary,
          averageDuration: `${summary.averageDuration.toFixed(2)}ms`,
          cacheHitRate: `${(summary.cacheHitRate * 100).toFixed(1)}%`,
        });

        // Log slow queries if any
        const slowQueries = monitor.getSlowQueries();
        if (slowQueries.length > 0) {
          console.warn(`Slow queries in ${contextName}:`, 
            slowQueries.map(q => ({
              name: q.name,
              duration: `${q.duration}ms`,
              rows: q.rowsReturned,
            }))
          );
        }
      }
    },
  };
}

/**
 * Track query patterns for optimization insights
 */
export class QueryPatternTracker {
  private patterns = new Map<string, {
    count: number;
    totalDuration: number;
    averageDuration: number;
    lastSeen: number;
  }>();

  track(queryName: string, duration: number): void {
    const existing = this.patterns.get(queryName) || {
      count: 0,
      totalDuration: 0,
      averageDuration: 0,
      lastSeen: 0,
    };

    existing.count++;
    existing.totalDuration += duration;
    existing.averageDuration = existing.totalDuration / existing.count;
    existing.lastSeen = Date.now();

    this.patterns.set(queryName, existing);
  }

  getTopPatterns(limit: number = 10): Array<{
    query: string;
    count: number;
    averageDuration: number;
  }> {
    return Array.from(this.patterns.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        averageDuration: stats.averageDuration,
      }));
  }

  getSlowestQueries(limit: number = 10): Array<{
    query: string;
    averageDuration: number;
    count: number;
  }> {
    return Array.from(this.patterns.entries())
      .sort((a, b) => b[1].averageDuration - a[1].averageDuration)
      .slice(0, limit)
      .map(([query, stats]) => ({
        query,
        averageDuration: stats.averageDuration,
        count: stats.count,
      }));
  }
}

// Global pattern tracker (in production, this would be stored in a database)
export const globalPatternTracker = new QueryPatternTracker();

/**
 * Store query performance metrics in database
 */
export async function storeQueryMetrics(
  ctx: MutationCtx,
  metrics: QueryMetrics[]
): Promise<void> {
  // Only store slow queries and errors
  const significantMetrics = metrics.filter(m => 
    (m.duration && m.duration > 50) || m.error
  );

  if (significantMetrics.length === 0) return;

  try {
    await Promise.all(
      significantMetrics.map(metric => 
        ctx.db.insert("queryMetrics", {
          name: metric.name,
          startTime: metric.startTime,
          duration: metric.duration || 0,
          rowsReturned: metric.rowsReturned || 0,
          cacheHit: metric.cacheHit || false,
          error: metric.error,
          metadata: metric.metadata,
          timestamp: new Date().toISOString(),
        })
      )
    );
  } catch (error) {
    console.error("Failed to store query metrics:", error);
  }
}