import { ActionCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";

/**
 * Convex-native caching implementation using a dedicated cache table
 * This provides Redis-like caching functionality within Convex
 */

// Cache entry type
interface CacheEntry {
  key: string;
  value: string; // JSON stringified data
  expiresAt: number;
  tags: string[];
  enterpriseId?: Id<"enterprises">;
  metadata?: {
    type: string;
    version: number;
    compressed?: boolean;
  };
}

// Cache configuration
export interface CacheConfig {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for cache invalidation
  enterpriseId?: Id<"enterprises">; // For enterprise-specific caching
  compress?: boolean; // Whether to compress large values
}

// Default cache configurations for different data types
export const CACHE_TTL = {
  SHORT: 60, // 1 minute - for rapidly changing data
  MEDIUM: 300, // 5 minutes - for moderately stable data
  LONG: 900, // 15 minutes - for stable data
  HOUR: 3600, // 1 hour - for very stable data
  DAY: 86400, // 24 hours - for static data
} as const;

export const CACHE_TAGS = {
  CONTRACTS: "contracts",
  VENDORS: "vendors",
  ANALYTICS: "analytics",
  DASHBOARD: "dashboard",
  USER_PREFS: "user_prefs",
  REPORTS: "reports",
} as const;

/**
 * Cache manager for Convex
 */
export class ConvexCache {
  constructor(private ctx: QueryCtx | ActionCtx) {}

  /**
   * Generate a cache key with namespace
   */
  private getCacheKey(namespace: string, key: string): string {
    return `${namespace}:${key}`;
  }

  /**
   * Get a value from cache
   */
  async get<T>(namespace: string, key: string): Promise<T | null> {
    const cacheKey = this.getCacheKey(namespace, key);
    
    try {
      const entry = await (this.ctx as any).db
        .query("cache")
        .withIndex("by_key", (q: any) => q.eq("key", cacheKey))
        .first();

      if (!entry) {
        return null;
      }

      // Check if expired
      if (entry.expiresAt < Date.now()) {
        // Clean up expired entry
        await this.delete(namespace, key);
        return null;
      }

      // Parse and return the cached value
      return JSON.parse(entry.value) as T;
    } catch (error) {
      console.error(`Cache get error for ${cacheKey}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(
    namespace: string,
    key: string,
    value: T,
    config: CacheConfig = {}
  ): Promise<void> {
    const cacheKey = this.getCacheKey(namespace, key);
    const ttl = config.ttl || CACHE_TTL.MEDIUM;
    
    try {
      const cacheEntry = {
        key: cacheKey,
        value: JSON.stringify(value),
        expiresAt: Date.now() + (ttl * 1000),
        tags: config.tags || [],
        enterpriseId: config.enterpriseId,
        metadata: {
          type: namespace,
          version: 1,
          compressed: config.compress || false,
        },
      };

      // Check if entry exists
      const existing = await (this.ctx as any).db
        .query("cache")
        .withIndex("by_key", (q: any) => q.eq("key", cacheKey))
        .first();

      if (existing) {
        // Update existing entry
        await (this.ctx as any).db.patch(existing._id, cacheEntry);
      } else {
        // Insert new entry
        await (this.ctx as any).db.insert("cache", cacheEntry);
      }
    } catch (error) {
      console.error(`Cache set error for ${cacheKey}:`, error);
      // Don't throw - caching should not break the application
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(namespace: string, key: string): Promise<void> {
    const cacheKey = this.getCacheKey(namespace, key);
    
    try {
      const entry = await (this.ctx as any).db
        .query("cache")
        .withIndex("by_key", (q: any) => q.eq("key", cacheKey))
        .first();

      if (entry) {
        await (this.ctx as any).db.delete(entry._id);
      }
    } catch (error) {
      console.error(`Cache delete error for ${cacheKey}:`, error);
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let deletedCount = 0;
    
    try {
      // Get all entries with matching tags
      const entries = await (this.ctx as any).db
        .query("cache")
        .filter((q: any) => 
          tags.some(tag => q.eq(q.field("tags").includes(tag), true))
        )
        .collect();

      // Delete all matching entries
      for (const entry of entries) {
        await (this.ctx as any).db.delete(entry._id);
        deletedCount++;
      }
    } catch (error) {
      console.error(`Cache invalidation error for tags ${tags}:`, error);
    }

    return deletedCount;
  }

  /**
   * Invalidate cache by enterprise
   */
  async invalidateByEnterprise(enterpriseId: Id<"enterprises">): Promise<number> {
    let deletedCount = 0;
    
    try {
      const entries = await (this.ctx as any).db
        .query("cache")
        .withIndex("by_enterprise", (q: any) => q.eq("enterpriseId", enterpriseId))
        .collect();

      for (const entry of entries) {
        await (this.ctx as any).db.delete(entry._id);
        deletedCount++;
      }
    } catch (error) {
      console.error(`Cache invalidation error for enterprise ${enterpriseId}:`, error);
    }

    return deletedCount;
  }

  /**
   * Get or set with cache-aside pattern
   */
  async getOrSet<T>(
    namespace: string,
    key: string,
    fetchFn: () => Promise<T>,
    config: CacheConfig = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(namespace, key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const freshData = await fetchFn();

    // Cache the result
    await this.set(namespace, key, freshData, config);

    return freshData;
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(namespace: string, keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    
    const promises = keys.map(async (key) => {
      const value = await this.get<T>(namespace, key);
      result.set(key, value);
    });

    await Promise.all(promises);
    return result;
  }

  /**
   * Batch set multiple keys
   */
  async mset<T>(
    namespace: string,
    entries: Array<{ key: string; value: T }>,
    config: CacheConfig = {}
  ): Promise<void> {
    const promises = entries.map(({ key, value }) =>
      this.set(namespace, key, value, config)
    );

    await Promise.all(promises);
  }

  /**
   * Clean up expired cache entries
   */
  async cleanup(): Promise<number> {
    let deletedCount = 0;
    const now = Date.now();
    
    try {
      const expiredEntries = await (this.ctx as any).db
        .query("cache")
        .filter((q: any) => q.lt(q.field("expiresAt"), now))
        .collect();

      for (const entry of expiredEntries) {
        await (this.ctx as any).db.delete(entry._id);
        deletedCount++;
      }
    } catch (error) {
      console.error("Cache cleanup error:", error);
    }

    return deletedCount;
  }
}

/**
 * Cache helpers for common patterns
 */

/**
 * Cache dashboard data
 */
export async function cacheDashboardData(
  ctx: QueryCtx,
  enterpriseId: Id<"enterprises">,
  data: any
): Promise<void> {
  const cache = new ConvexCache(ctx);
  await cache.set(
    "dashboard",
    enterpriseId,
    data,
    {
      ttl: CACHE_TTL.MEDIUM,
      tags: [CACHE_TAGS.DASHBOARD],
      enterpriseId,
    }
  );
}

/**
 * Get cached dashboard data
 */
export async function getCachedDashboardData(
  ctx: QueryCtx,
  enterpriseId: Id<"enterprises">
): Promise<any | null> {
  const cache = new ConvexCache(ctx);
  return cache.get("dashboard", enterpriseId);
}

/**
 * Cache contract analytics
 */
export async function cacheContractAnalytics(
  ctx: QueryCtx,
  enterpriseId: Id<"enterprises">,
  analytics: any
): Promise<void> {
  const cache = new ConvexCache(ctx);
  await cache.set(
    "analytics",
    `contracts:${enterpriseId}`,
    analytics,
    {
      ttl: CACHE_TTL.LONG,
      tags: [CACHE_TAGS.ANALYTICS, CACHE_TAGS.CONTRACTS],
      enterpriseId,
    }
  );
}

/**
 * Cache vendor list
 */
export async function cacheVendorList(
  ctx: QueryCtx,
  enterpriseId: Id<"enterprises">,
  vendors: Doc<"vendors">[]
): Promise<void> {
  const cache = new ConvexCache(ctx);
  await cache.set(
    "vendors",
    `list:${enterpriseId}`,
    vendors,
    {
      ttl: CACHE_TTL.MEDIUM,
      tags: [CACHE_TAGS.VENDORS],
      enterpriseId,
    }
  );
}

/**
 * Invalidate all contract-related caches
 */
export async function invalidateContractCaches(
  ctx: QueryCtx | ActionCtx,
  enterpriseId: Id<"enterprises">
): Promise<void> {
  const cache = new ConvexCache(ctx);
  await Promise.all([
    cache.invalidateByTags([CACHE_TAGS.CONTRACTS]),
    cache.invalidateByTags([CACHE_TAGS.DASHBOARD]),
    cache.delete("analytics", `contracts:${enterpriseId}`),
  ]);
}

/**
 * Invalidate all vendor-related caches
 */
export async function invalidateVendorCaches(
  ctx: QueryCtx | ActionCtx,
  enterpriseId: Id<"enterprises">
): Promise<void> {
  const cache = new ConvexCache(ctx);
  await Promise.all([
    cache.invalidateByTags([CACHE_TAGS.VENDORS]),
    cache.invalidateByTags([CACHE_TAGS.DASHBOARD]),
    cache.delete("vendors", `list:${enterpriseId}`),
  ]);
}