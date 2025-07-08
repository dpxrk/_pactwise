import { FunctionReference, FunctionArgs } from 'convex/server';

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
  subscribers: number;
}

/**
 * Request deduplication for Convex queries
 * Prevents multiple identical requests from being sent simultaneously
 */
class ConvexRequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly TTL = 5000; // 5 seconds TTL for cached promises

  /**
   * Generate a unique key for the request
   */
  private generateKey(functionName: string, args: any): string {
    return `${functionName}:${JSON.stringify(args)}`;
  }

  /**
   * Clean up expired pending requests
   */
  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, pending] of this.pendingRequests.entries()) {
      if (now - pending.timestamp > this.TTL && pending.subscribers === 0) {
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Deduplicate a request
   */
  async deduplicate<T>(
    functionName: string,
    args: any,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const key = this.generateKey(functionName, args);
    
    // Clean up expired requests periodically
    this.cleanupExpired();

    // Check if there's already a pending request
    const existing = this.pendingRequests.get(key);
    if (existing) {
      existing.subscribers++;
      try {
        const result = await existing.promise;
        existing.subscribers--;
        return result as T;
      } catch (error) {
        existing.subscribers--;
        if (existing.subscribers === 0) {
          this.pendingRequests.delete(key);
        }
        throw error;
      }
    }

    // Create new pending request
    const promise = fetcher();
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
      subscribers: 1,
    });

    try {
      const result = await promise;
      const pending = this.pendingRequests.get(key);
      if (pending) {
        pending.subscribers--;
        if (pending.subscribers === 0) {
          // Keep in cache for a short time for subsequent requests
          setTimeout(() => {
            const current = this.pendingRequests.get(key);
            if (current && current.subscribers === 0) {
              this.pendingRequests.delete(key);
            }
          }, 100);
        }
      }
      return result;
    } catch (error) {
      const pending = this.pendingRequests.get(key);
      if (pending) {
        pending.subscribers--;
        if (pending.subscribers === 0) {
          this.pendingRequests.delete(key);
        }
      }
      throw error;
    }
  }

  /**
   * Get statistics about pending requests
   */
  getStats(): {
    pendingCount: number;
    totalSubscribers: number;
    requests: Array<{ key: string; subscribers: number; age: number }>;
  } {
    const now = Date.now();
    const requests = Array.from(this.pendingRequests.entries()).map(([key, pending]) => ({
      key,
      subscribers: pending.subscribers,
      age: now - pending.timestamp,
    }));

    return {
      pendingCount: this.pendingRequests.size,
      totalSubscribers: requests.reduce((sum, req) => sum + req.subscribers, 0),
      requests,
    };
  }

  /**
   * Clear all pending requests (useful for testing)
   */
  clear(): void {
    this.pendingRequests.clear();
  }
}

// Global instance
export const convexDeduplicator = new ConvexRequestDeduplicator();

/**
 * React hook for deduplicated queries
 */
export function useDeduplicatedQuery<Query extends FunctionReference<'query'>>(
  queryFn: Query,
  args: FunctionArgs<Query>,
  fetcher: () => Promise<any>
) {
  const functionName = queryFn.toString();
  
  return convexDeduplicator.deduplicate(functionName, args, fetcher);
}

/**
 * Utility to wrap any async function with deduplication
 */
export function withDeduplication<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  return (async (...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    return convexDeduplicator.deduplicate(
      fn.name || 'anonymous',
      key,
      () => fn(...args)
    );
  }) as T;
}

/**
 * Batch multiple queries into a single deduplicated request
 */
export class QueryBatcher {
  private batch: Array<{ resolve: (value: any) => void; reject: (error: any) => void; query: any }> = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly batchSize: number;
  private readonly batchDelay: number;

  constructor(batchSize = 10, batchDelay = 10) {
    this.batchSize = batchSize;
    this.batchDelay = batchDelay;
  }

  async add<T>(query: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.batch.push({ resolve, reject, query });

      if (this.batch.length >= this.batchSize) {
        this.flush();
      } else if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => this.flush(), this.batchDelay);
      }
    });
  }

  private async flush() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const currentBatch = this.batch.splice(0, this.batchSize);
    if (currentBatch.length === 0) return;

    // Execute all queries in parallel
    const promises = currentBatch.map(item => item.query());
    
    try {
      const results = await Promise.all(promises);
      currentBatch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      currentBatch.forEach(item => {
        item.reject(error);
      });
    }
  }
}

// Global query batcher instance
export const globalQueryBatcher = new QueryBatcher();

/**
 * Performance metrics for deduplication
 */
export class DeduplicationMetrics {
  private hits = 0;
  private misses = 0;
  private errors = 0;

  recordHit() {
    this.hits++;
  }

  recordMiss() {
    this.misses++;
  }

  recordError() {
    this.errors++;
  }

  getMetrics() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      errors: this.errors,
      hitRate: total > 0 ? this.hits / total : 0,
      total,
    };
  }

  reset() {
    this.hits = 0;
    this.misses = 0;
    this.errors = 0;
  }
}

export const deduplicationMetrics = new DeduplicationMetrics();