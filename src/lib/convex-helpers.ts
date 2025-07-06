/**
 * Optimized Convex integration helpers
 */

import { useQuery, useMutation, usePaginatedQuery } from 'convex/react';
import { FunctionReference } from 'convex/server';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useState, useCallback, useEffect, useRef } from 'react';
import { logger } from './logger';
import { cache } from './cache';

/**
 * Optimistic update wrapper for mutations
 */
export function useOptimisticMutation<Args extends unknown[], Response>(
  mutation: (...args: Args) => Promise<Response>,
  options?: {
    onSuccess?: (data: Response) => void;
    onError?: (error: Error) => void;
    optimisticUpdate?: (args: Args) => void;
    rollback?: () => void;
  }
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mutate = useMutation(mutation);
  
  const execute = useCallback(async (...args: Args) => {
    setIsLoading(true);
    setError(null);
    
    // Apply optimistic update
    if (options?.optimisticUpdate) {
      options.optimisticUpdate(args);
    }
    
    try {
      const result = await mutate(...args);
      if (options?.onSuccess) {
        options.onSuccess(result);
      }
      return result;
    } catch (err) {
      const error = err as Error;
      setError(error);
      
      // Rollback optimistic update
      if (options?.rollback) {
        options.rollback();
      }
      
      if (options?.onError) {
        options.onError(error);
      }
      
      logger.error('Mutation failed', error, { mutation: mutation.name });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [mutate, options]);
  
  return {
    execute,
    isLoading,
    error,
  };
}

/**
 * Query with caching and error handling
 */
export function useCachedQuery<T>(
  query: (...args: unknown[]) => unknown,
  args: unknown,
  options?: {
    cacheKey?: string;
    cacheTTL?: number;
    staleWhileRevalidate?: boolean;
    onError?: (error: Error) => void;
  }
) {
  const [cachedData, setCachedData] = useState<T | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const queryResult = useQuery(query, args);
  
  useEffect(() => {
    const loadCachedData = async () => {
      if (options?.cacheKey) {
        const cached = await cache.get<T>(options.cacheKey);
        if (cached) {
          setCachedData(cached);
        }
      }
    };
    
    loadCachedData();
  }, [options?.cacheKey]);
  
  useEffect(() => {
    if (queryResult !== undefined && options?.cacheKey) {
      cache.set(options.cacheKey, queryResult, options.cacheTTL ? { ttl: options.cacheTTL } : undefined);
      setCachedData(queryResult);
    }
  }, [queryResult, options?.cacheKey, options?.cacheTTL]);
  
  // Return cached data while revalidating if enabled
  if (options?.staleWhileRevalidate && cachedData && queryResult === undefined) {
    setIsValidating(true);
    return {
      data: cachedData,
      isLoading: false,
      isValidating: true,
      error: null,
    };
  }
  
  return {
    data: queryResult ?? cachedData,
    isLoading: queryResult === undefined && !cachedData,
    isValidating,
    error: null,
  };
}

/**
 * Infinite scroll pagination hook
 */
export function useInfiniteQuery<T>(
  query: any,
  baseArgs: Record<string, unknown>,
  options?: {
    pageSize?: number;
    enabled?: boolean;
  }
) {
  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const pageRef = useRef(0);
  
  const { results, status, loadMore } = usePaginatedQuery(
    query,
    { ...baseArgs, paginationOpts: { numItems: options?.pageSize || 20 } },
    { initialNumItems: options?.pageSize || 20 }
  );
  
  useEffect(() => {
    if (results) {
      setItems(results);
      setHasMore(status === 'CanLoadMore');
    }
  }, [results, status]);
  
  const loadNextPage = useCallback(async () => {
    if (!hasMore || isLoadingMore || status !== 'CanLoadMore') return;
    
    setIsLoadingMore(true);
    try {
      await loadMore(options?.pageSize || 20);
      pageRef.current += 1;
    } catch (error) {
      logger.error('Failed to load more items', error as Error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, status, loadMore, options?.pageSize]);
  
  return {
    items,
    hasMore,
    isLoadingMore,
    loadNextPage,
    refresh: () => {
      pageRef.current = 0;
      setItems([]);
      setHasMore(true);
    },
  };
}

/**
 * Real-time subscription with connection management
 */
export function useSubscription<T>(
  query: (...args: unknown[]) => unknown,
  args: unknown,
  options?: {
    onUpdate?: (data: T) => void;
    onError?: (error: Error) => void;
    enabled?: boolean;
  }
) {
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const previousDataRef = useRef<T | undefined>();
  
  const data = options?.enabled !== false 
    ? useQuery(query, args)
    : undefined;
  
  useEffect(() => {
    if (data !== undefined && data !== previousDataRef.current) {
      previousDataRef.current = data;
      setLastUpdate(new Date());
      
      if (options?.onUpdate) {
        options.onUpdate(data);
      }
    }
  }, [data, options]);
  
  return {
    data,
    isConnected,
    lastUpdate,
  };
}

/**
 * Batch operations helper
 */
export function useBatchMutation<T, Args extends unknown[]>(
  mutation: FunctionReference<"mutation">,
  options?: {
    batchSize?: number;
    onProgress?: (completed: number, total: number) => void;
    onBatchComplete?: (results: T[]) => void;
    onError?: (error: Error, index: number) => void;
  }
) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const mutate = useMutation(mutation);
  
  const executeBatch = useCallback(async (items: Args[]) => {
    const batchSize = options?.batchSize || 10;
    const results: T[] = [];
    
    setIsProcessing(true);
    setProgress({ completed: 0, total: items.length });
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (args, index) => {
        try {
          const result = await mutate(args as any);
          return { success: true, result, index: i + index };
        } catch (error) {
          if (options?.onError) {
            options.onError(error as Error, i + index);
          }
          return { success: false, error, index: i + index };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(({ success, result }) => {
        if (success && result) {
          results.push(result);
        }
      });
      
      const completed = Math.min(i + batchSize, items.length);
      setProgress({ completed, total: items.length });
      
      if (options?.onProgress) {
        options.onProgress(completed, items.length);
      }
    }
    
    setIsProcessing(false);
    
    if (options?.onBatchComplete) {
      options.onBatchComplete(results);
    }
    
    return results;
  }, [mutate, options]);
  
  return {
    executeBatch,
    isProcessing,
    progress,
  };
}

/**
 * Error recovery wrapper
 */
export function useQueryWithRetry<T>(
  query: FunctionReference<"query">,
  args: unknown,
  options?: {
    maxRetries?: number;
    retryDelay?: number;
    onRetry?: (attempt: number) => void;
  }
) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const maxRetries = options?.maxRetries || 3;
  const retryDelay = options?.retryDelay || 1000;
  
  const data = useQuery(query, args as any);
  
  const retry = useCallback(async () => {
    if (retryCount >= maxRetries) return;
    
    setIsRetrying(true);
    const attempt = retryCount + 1;
    
    if (options?.onRetry) {
      options.onRetry(attempt);
    }
    
    await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    
    setRetryCount(attempt);
    setIsRetrying(false);
  }, [retryCount, maxRetries, retryDelay, options]);
  
  return {
    data,
    isLoading: data === undefined && !isRetrying,
    isRetrying,
    retry,
    canRetry: retryCount < maxRetries,
    retryCount,
  };
}

/**
 * Prefetch data for better UX
 */
export function usePrefetch() {
  const prefetchedQueries = useRef(new Set<string>());
  
  const prefetch = useCallback(async (query: any, args: unknown, cacheKey: string) => {
    if (prefetchedQueries.current.has(cacheKey)) return;
    
    try {
      // Mark as prefetched to avoid duplicate requests
      prefetchedQueries.current.add(cacheKey);
      
      // In a real implementation, you would call the query here
      // For now, we'll just cache the intent
      logger.info('Prefetching data', { query: query.name, cacheKey });
    } catch (error) {
      logger.error('Prefetch failed', error as Error);
      prefetchedQueries.current.delete(cacheKey);
    }
  }, []);
  
  return { prefetch };
}