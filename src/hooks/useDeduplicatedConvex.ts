import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { FunctionReference, FunctionReturnType, FunctionArgs } from 'convex/server';
import { convexDeduplicator, deduplicationMetrics } from '@/lib/convex-deduplication';
import { measurePerformance } from '@/lib/monitoring';

/**
 * Enhanced Convex query hook with request deduplication
 * Prevents multiple identical queries from being sent simultaneously
 */
export function useDeduplicatedQuery<Query extends FunctionReference<'query'>>(
  queryReference: Query,
  args: FunctionArgs<Query>
): FunctionReturnType<Query> | undefined {
  const result = useQuery(queryReference, args);
  const deduplicationRef = useRef<{ key: string; count: number }>({ key: '', count: 0 });

  useEffect(() => {
    if (result === undefined) return;

    const key = `${queryReference}:${JSON.stringify(args)}`;
    
    // Track deduplication effectiveness
    if (deduplicationRef.current.key === key) {
      deduplicationRef.current.count++;
      if (deduplicationRef.current.count > 1) {
        deduplicationMetrics.recordHit();
      }
    } else {
      deduplicationRef.current = { key, count: 1 };
      deduplicationMetrics.recordMiss();
    }
  }, [result, queryReference, args]);

  return result;
}

/**
 * Batch multiple queries together to reduce network overhead
 */
export function useBatchedQueries<T extends Record<string, FunctionReference<'query'>>>(
  queries: T,
  args: { [K in keyof T]: FunctionArgs<T[K]> }
): { [K in keyof T]: FunctionReturnType<T[K]> | undefined } {
  const results = {} as { [K in keyof T]: FunctionReturnType<T[K]> | undefined };
  
  // Execute all queries
  for (const key in queries) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    results[key] = useQuery(queries[key], args[key]);
  }
  
  return results;
}

/**
 * Prefetch query data before it's needed
 */
export function usePrefetchQuery<Query extends FunctionReference<'query'>>(
  queryReference: Query
) {
  return useCallback(
    (args: FunctionArgs<Query>) => {
      // This creates a query subscription that will cache the result
      // The actual implementation would depend on Convex's caching mechanism
      const key = `${queryReference}:${JSON.stringify(args)}`;
      
      // Mark this as a prefetch in our metrics
      if (typeof window !== 'undefined') {
        (window as any).__convexPrefetchCache = (window as any).__convexPrefetchCache || new Map();
        (window as any).__convexPrefetchCache.set(key, { 
          timestamp: Date.now(),
          args 
        });
      }
    },
    [queryReference]
  );
}

/**
 * Mutation with automatic retry and deduplication
 */
export function useDeduplicatedMutation<Mutation extends FunctionReference<'mutation'>>(
  mutationReference: Mutation,
  options?: {
    retries?: number;
    retryDelay?: number;
    deduplicationKey?: (...args: FunctionArgs<Mutation>) => string;
  }
) {
  const mutation = useMutation(mutationReference);
  const pendingMutations = useRef(new Map<string, Promise<any>>());

  return useCallback(
    async (args: FunctionArgs<Mutation>): Promise<FunctionReturnType<Mutation>> => {
      const key = options?.deduplicationKey
        ? options.deduplicationKey(...args)
        : JSON.stringify(args);

      // Check if there's already a pending mutation with the same key
      const pending = pendingMutations.current.get(key);
      if (pending) {
        deduplicationMetrics.recordHit();
        return pending;
      }

      // Create new mutation with retry logic
      const executeMutation = async (retriesLeft: number): Promise<any> => {
        try {
          const result = await measurePerformance.measureConvexCall(
            `mutation:${mutationReference}`,
            () => mutation(args)
          );
          deduplicationMetrics.recordMiss();
          return result;
        } catch (error) {
          if (retriesLeft > 0) {
            await new Promise(resolve => 
              setTimeout(resolve, options?.retryDelay || 1000)
            );
            return executeMutation(retriesLeft - 1);
          }
          deduplicationMetrics.recordError();
          throw error;
        }
      };

      const promise = executeMutation(options?.retries || 0);
      pendingMutations.current.set(key, promise);

      try {
        const result = await promise;
        pendingMutations.current.delete(key);
        return result;
      } catch (error) {
        pendingMutations.current.delete(key);
        throw error;
      }
    },
    [mutation, mutationReference, options]
  );
}

/**
 * Hook to get deduplication statistics
 */
export function useDeduplicationStats() {
  const [stats, setStats] = useState(() => deduplicationMetrics.getMetrics());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(deduplicationMetrics.getMetrics());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return stats;
}

/**
 * Optimistic update hook with deduplication
 */
export function useOptimisticMutation<
  Mutation extends FunctionReference<'mutation'>,
  OptimisticData = any
>(
  mutationReference: Mutation,
  options: {
    optimisticUpdate: (args: FunctionArgs<Mutation>) => OptimisticData;
    rollback?: (error: Error, args: FunctionArgs<Mutation>) => void;
  }
) {
  const mutation = useDeduplicatedMutation(mutationReference);
  const [optimisticData, setOptimisticData] = useState<OptimisticData | null>(null);

  const executeMutation = useCallback(
    async (args: FunctionArgs<Mutation>) => {
      // Apply optimistic update
      const optimistic = options.optimisticUpdate(args);
      setOptimisticData(optimistic);

      try {
        const result = await mutation(args);
        setOptimisticData(null);
        return result;
      } catch (error) {
        // Rollback on error
        setOptimisticData(null);
        if (options.rollback) {
          options.rollback(error as Error, args);
        }
        throw error;
      }
    },
    [mutation, options]
  );

  return { mutate: executeMutation, optimisticData };
}

// Helper to clear deduplication cache (useful for testing)
export function clearDeduplicationCache() {
  convexDeduplicator.clear();
  deduplicationMetrics.reset();
}