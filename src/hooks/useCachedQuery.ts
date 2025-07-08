import { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { FunctionReference, FunctionArgs, FunctionReturnType } from 'convex/server';
import { IndexedDBCache } from '@/lib/indexeddb-cache';

interface CachedQueryOptions {
  ttl?: number; // Time to live in milliseconds
  staleWhileRevalidate?: boolean; // Return stale data while fetching fresh
  cacheKey?: string; // Custom cache key
  enabled?: boolean; // Whether to run the query
}

/**
 * Hook that wraps Convex queries with IndexedDB caching
 * Provides offline support and faster initial loads
 */
export function useCachedQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: FunctionArgs<Query> | 'skip',
  options?: CachedQueryOptions
): {
  data: FunctionReturnType<Query> | undefined;
  isLoading: boolean;
  isCached: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const [cachedData, setCachedData] = useState<FunctionReturnType<Query> | undefined>();
  const [isCached, setIsCached] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef(new IndexedDBCache('convex-query-cache', 'queries'));
  const lastFetchTime = useRef(0);

  // Generate cache key
  const cacheKey = options?.cacheKey || `${query.toString()}_${JSON.stringify(args)}`;
  
  // Use Convex query
  const convexData = useQuery(
    query,
    args === 'skip' || options?.enabled === false ? 'skip' : args
  );
  
  const isLoading = convexData === undefined && !cachedData;

  // Load from cache on mount
  useEffect(() => {
    if (args === 'skip' || options?.enabled === false) return;

    const loadFromCache = async () => {
      try {
        const cached = await cacheRef.current.get<FunctionReturnType<Query>>(cacheKey);
        if (cached) {
          setCachedData(cached);
          setIsCached(true);
        }
      } catch (err) {
        console.error('Failed to load from cache:', err);
      }
    };

    loadFromCache();
  }, [cacheKey, args, options?.enabled]);

  // Update cache when new data arrives
  useEffect(() => {
    if (convexData !== undefined && args !== 'skip') {
      const updateCache = async () => {
        try {
          await cacheRef.current.set(cacheKey, convexData, {
            ttl: options?.ttl,
          });
          setCachedData(convexData);
          setIsCached(false);
          lastFetchTime.current = Date.now();
        } catch (err) {
          console.error('Failed to update cache:', err);
        }
      };

      updateCache();
    }
  }, [convexData, cacheKey, options?.ttl, args]);

  // Refetch function
  const refetch = useCallback(() => {
    // Clear cached data to force loading state
    if (!options?.staleWhileRevalidate) {
      setCachedData(undefined);
      setIsCached(false);
    }
    
    // In a real implementation, we'd need to trigger Convex to refetch
    // This is a limitation of the current Convex React hooks
    lastFetchTime.current = Date.now();
  }, [options?.staleWhileRevalidate]);

  // Return appropriate data based on strategy
  const data = options?.staleWhileRevalidate
    ? cachedData || convexData // Return cached data immediately if available
    : convexData !== undefined ? convexData : cachedData; // Prefer fresh data

  return {
    data,
    isLoading,
    isCached: isCached && convexData === undefined,
    error,
    refetch,
  };
}

/**
 * Hook for caching large datasets with pagination support
 */
export function useCachedPaginatedQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: FunctionArgs<Query> | 'skip',
  options?: CachedQueryOptions & {
    pageSize?: number;
    prefetchNext?: boolean;
  }
): {
  data: FunctionReturnType<Query> | undefined;
  isLoading: boolean;
  isCached: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
} {
  const [allData, setAllData] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  const pageArgs = args === 'skip' ? 'skip' : {
    ...args,
    offset: page * (options?.pageSize || 50),
    limit: options?.pageSize || 50,
  };
  
  const { data, isLoading, isCached, error, refetch } = useCachedQuery(
    query,
    pageArgs as FunctionArgs<Query>,
    {
      ...options,
      cacheKey: `${options?.cacheKey || query.toString()}_page_${page}`,
    }
  );

  // Append new data
  useEffect(() => {
    if (data && Array.isArray(data)) {
      setAllData(prev => [...prev, ...data]);
      setHasMore(data.length === (options?.pageSize || 50));
    }
  }, [data, options?.pageSize]);

  // Prefetch next page
  useEffect(() => {
    if (options?.prefetchNext && hasMore && !isLoading) {
      const prefetchArgs = args === 'skip' ? 'skip' : {
        ...args,
        offset: (page + 1) * (options?.pageSize || 50),
        limit: options?.pageSize || 50,
      };
      
      // Trigger prefetch (would need actual implementation)
      // This is a simplified version
      const cacheKey = `${options?.cacheKey || query.toString()}_page_${page + 1}`;
      // Prefetch logic would go here
    }
  }, [page, hasMore, isLoading, options?.prefetchNext, args, query, options?.pageSize, options?.cacheKey]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [isLoading, hasMore]);

  return {
    data: allData as FunctionReturnType<Query>,
    isLoading,
    isCached,
    error,
    hasMore,
    loadMore,
  };
}

/**
 * Preload and cache data for later use
 */
export async function preloadQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: FunctionArgs<Query>,
  options?: {
    ttl?: number;
    cacheKey?: string;
  }
): Promise<void> {
  const cache = new IndexedDBCache('convex-query-cache', 'queries');
  const cacheKey = options?.cacheKey || `${query.toString()}_${JSON.stringify(args)}`;
  
  try {
    // In a real implementation, we'd fetch from Convex here
    // For now, just mark as intent to preload
    console.log('[Cache] Marked for preload:', cacheKey);
  } catch (error) {
    console.error('[Cache] Preload failed:', error);
  }
}

/**
 * Clear all cached queries
 */
export async function clearQueryCache(): Promise<void> {
  const cache = new IndexedDBCache('convex-query-cache', 'queries');
  await cache.clear();
}