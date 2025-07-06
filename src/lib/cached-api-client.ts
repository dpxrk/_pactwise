import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useAction } from "convex/react";
import type {
    FunctionReference,
    FunctionArgs,
    FunctionReturnType
} from "convex/server";
import { cache, cacheKeys, cacheTTL } from './redis';
import { performanceMonitor } from './performance-monitoring';

// Cache configuration for different query types
const queryCacheConfig: Record<string, { ttl: number; cacheKey: (args: any) => string }> = {
  'contracts.getContracts': {
    ttl: cacheTTL.contractList,
    cacheKey: (args) => cacheKeys.contractList(args.enterpriseId, args),
  },
  'contracts.getContractById': {
    ttl: cacheTTL.contractList,
    cacheKey: (args) => cacheKeys.contract(args.contractId),
  },
  'vendors.getVendors': {
    ttl: cacheTTL.vendorList,
    cacheKey: (args) => cacheKeys.vendorList(args.enterpriseId),
  },
  'vendors.getVendorById': {
    ttl: cacheTTL.vendorList,
    cacheKey: (args) => cacheKeys.vendor(args.vendorId),
  },
  'contracts.getContractStats': {
    ttl: cacheTTL.dashboardStats,
    cacheKey: (args) => cacheKeys.dashboardStats(args.enterpriseId),
  },
  'analytics.getAnalytics': {
    ttl: cacheTTL.analytics,
    cacheKey: (args) => cacheKeys.analytics(args.type, args.enterpriseId, args.period),
  },
};

// Custom hook for cached Convex queries
export function useCachedConvexQuery<
    Query extends FunctionReference<"query">
>(
  queryFn: Query,
  args: FunctionArgs<Query> | 'skip',
  options?: {
    staleTime?: number; // Time before data is considered stale
    cacheTime?: number; // Time to keep data in cache
    refetchOnMount?: boolean;
    refetchOnWindowFocus?: boolean;
    enabled?: boolean;
  }
) {
  const [cachedData, setCachedData] = useState<FunctionReturnType<Query> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const lastFetchTime = useRef<number>(0);

  const queryName = queryFn._functionPath || 'unknown_query';
  const cacheConfig = queryCacheConfig[queryName];
  
  // Use regular Convex query
  const convexResult = useQuery(
    queryFn,
    args === 'skip' || !options?.enabled ? 'skip' : args
  );

  // Generate cache key
  const cacheKey = cacheConfig && args !== 'skip' 
    ? cacheConfig.cacheKey(args)
    : null;

  // Check cache on mount
  useEffect(() => {
    if (!cacheKey || args === 'skip' || !options?.enabled) {
      setIsLoading(false);
      return;
    }

    const checkCache = async () => {
      try {
        const cached = await cache.get(cacheKey);
        if (cached) {
          setCachedData(cached as FunctionReturnType<Query>);
          lastFetchTime.current = Date.now();
        }
      } catch (err) {
        console.error('Cache read error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkCache();
  }, [cacheKey, args, options?.enabled]);

  // Update cache when Convex data changes
  useEffect(() => {
    if (convexResult !== undefined && cacheKey && cacheConfig) {
      // Update local state
      setCachedData(convexResult as FunctionReturnType<Query>);
      setError(null);
      setIsFetching(false);
      lastFetchTime.current = Date.now();

      // Update Redis cache
      cache.set(cacheKey, convexResult, cacheConfig.ttl).catch(err => {
        console.error('Cache write error:', err);
      });
    }
  }, [convexResult, cacheKey, cacheConfig]);

  // Refetch logic
  const refetch = async () => {
    if (!cacheKey || args === 'skip') return;

    setIsFetching(true);
    setError(null);

    try {
      // Force cache invalidation
      await cache.delete(cacheKey);
      
      // The Convex query will automatically refetch
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsFetching(false);
    }
  };

  // Check if data is stale
  const isStale = options?.staleTime 
    ? Date.now() - lastFetchTime.current > options.staleTime
    : false;

  return {
    data: cachedData,
    isLoading: isLoading && !cachedData,
    isFetching,
    isStale,
    error,
    refetch,
  };
}

// Cache invalidation helpers
export const cacheInvalidation = {
  // Invalidate all contract-related caches
  async invalidateContracts(enterpriseId: string) {
    const patterns = [
      `contract:*`,
      `contracts:${enterpriseId}:*`,
      `contract_analysis:*`,
      `dashboard:${enterpriseId}`,
    ];

    for (const pattern of patterns) {
      await cache.invalidatePattern(pattern);
    }
  },

  // Invalidate specific contract
  async invalidateContract(contractId: string, enterpriseId: string) {
    await Promise.all([
      cache.delete(cacheKeys.contract(contractId)),
      cache.invalidatePattern(`contracts:${enterpriseId}:*`),
      cache.delete(cacheKeys.contractAnalysis(contractId)),
      cache.delete(cacheKeys.dashboardStats(enterpriseId)),
    ]);
  },

  // Invalidate all vendor-related caches
  async invalidateVendors(enterpriseId: string) {
    const patterns = [
      `vendor:*`,
      `vendors:${enterpriseId}`,
      `vendor_performance:*`,
      `dashboard:${enterpriseId}`,
    ];

    for (const pattern of patterns) {
      await cache.invalidatePattern(pattern);
    }
  },

  // Invalidate specific vendor
  async invalidateVendor(vendorId: string, enterpriseId: string) {
    await Promise.all([
      cache.delete(cacheKeys.vendor(vendorId)),
      cache.delete(cacheKeys.vendorList(enterpriseId)),
      cache.delete(cacheKeys.vendorPerformance(vendorId)),
      cache.delete(cacheKeys.dashboardStats(enterpriseId)),
    ]);
  },

  // Invalidate user preferences
  async invalidateUserPreferences(userId: string) {
    await cache.delete(cacheKeys.userPreferences(userId));
  },

  // Invalidate search results
  async invalidateSearch() {
    await cache.invalidatePattern('search:*');
  },

  // Invalidate all caches for an enterprise
  async invalidateEnterprise(enterpriseId: string) {
    const patterns = [
      `contracts:${enterpriseId}:*`,
      `vendors:${enterpriseId}`,
      `dashboard:${enterpriseId}`,
      `analytics:*:${enterpriseId}:*`,
    ];

    for (const pattern of patterns) {
      await cache.invalidatePattern(pattern);
    }
  },
};

// Mutation wrapper that invalidates cache
export function useCachedConvexMutation<
    Mutation extends FunctionReference<"mutation">
>(
  mutationFn: Mutation,
  options?: {
    onSuccess?: (data: FunctionReturnType<Mutation>) => void | Promise<void>;
    invalidates?: string[] | ((args: FunctionArgs<Mutation>) => string[]);
  }
) {
  const mutation = useMutation(mutationFn);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = async (args: FunctionArgs<Mutation>) => {
    setIsLoading(true);
    setError(null);

    const measure = performanceMonitor.measureDatabaseQuery(
      mutationFn._functionPath || 'unknown_mutation'
    );

    try {
      const result = await mutation(args);
      measure.end(true);

      // Invalidate caches
      if (options?.invalidates) {
        const cacheKeys = typeof options.invalidates === 'function'
          ? options.invalidates(args)
          : options.invalidates;

        await Promise.all(cacheKeys.map(key => cache.delete(key)));
      }

      // Call success callback
      if (options?.onSuccess) {
        await options.onSuccess(result as FunctionReturnType<Mutation>);
      }

      return result as FunctionReturnType<Mutation>;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      measure.end(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { execute, isLoading, error };
}

// Prefetch data into cache
export async function prefetchQuery<Query extends FunctionReference<"query">>(
  queryFn: Query,
  args: FunctionArgs<Query>
): Promise<void> {
  const queryName = queryFn._functionPath || 'unknown_query';
  const cacheConfig = queryCacheConfig[queryName];
  
  if (!cacheConfig) {
    console.warn(`No cache configuration for query: ${queryName}`);
    return;
  }

  const cacheKey = cacheConfig.cacheKey(args);
  
  // Check if already cached
  const existing = await cache.get(cacheKey);
  if (existing) {
    return;
  }

  // Fetch and cache
  try {
    // This would need to be implemented with a server-side Convex client
    console.log(`Prefetching ${queryName} with args:`, args);
  } catch (error) {
    console.error(`Prefetch error for ${queryName}:`, error);
  }
}

// Batch prefetch multiple queries
export async function batchPrefetch(
  queries: Array<{
    queryFn: FunctionReference<"query">;
    args: any;
  }>
): Promise<void> {
  await Promise.all(
    queries.map(({ queryFn, args }) => prefetchQuery(queryFn, args))
  );
}