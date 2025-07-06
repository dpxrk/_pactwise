import { useCallback } from 'react';
import { useMutation, useQuery, Preloaded, usePreloadedQuery } from 'convex/react';
import { FunctionReference, FunctionReturnType, FunctionArgs } from 'convex/server';
import { measurePerformance } from '@/lib/monitoring';

/**
 * Enhanced Convex mutation hook with performance monitoring
 */
export function useMutationWithMonitoring<Mutation extends FunctionReference<'mutation'>>(
  mutationReference: Mutation
) {
  const mutation = useMutation(mutationReference);
  
  return useCallback(
    async (args: FunctionArgs<Mutation>): Promise<FunctionReturnType<Mutation>> => {
      const functionName = 'mutation';
      
      return measurePerformance.measureConvexCall(functionName, () => 
        mutation(args)
      );
    },
    [mutation, mutationReference]
  );
}

/**
 * Enhanced Convex query hook with performance monitoring
 */
export function useQueryWithMonitoring<Query extends FunctionReference<'query'>>(
  queryReference: Query,
  args: FunctionArgs<Query>
) {
  // Note: useQuery doesn't return a promise, so we can't directly measure it
  // Instead, we'll track when the query result changes
  const result = useQuery(queryReference, args);
  
  // Track query performance when result changes
  const functionName = 'query';
  
  // Log query execution (this happens on every render when args change)
  if (result !== undefined) {
    // Query completed successfully
    if (typeof window !== 'undefined' && (window as Window & { convexAnalytics?: { logEvent: (event: string, data: Record<string, unknown>) => void } }).convexAnalytics) {
      (window as Window & { convexAnalytics?: { logEvent: (event: string, data: Record<string, unknown>) => void } }).convexAnalytics.logEvent('convex_query_completed', {
        function: functionName,
        hasResult: result !== null,
        resultType: Array.isArray(result) ? 'array' : typeof result,
      });
    }
  }
  
  return result;
}

/**
 * Enhanced preloaded query hook with monitoring
 */
export function usePreloadedQueryWithMonitoring<Query extends FunctionReference<'query'>>(
  queryReference: Query,
  preloadedQuery: Preloaded<Query>
): FunctionReturnType<Query> {
  const result = usePreloadedQuery(preloadedQuery);
  const functionName = 'preloaded_query';
  
  // Track preloaded query usage
  if (typeof window !== 'undefined' && (window as Window & { convexAnalytics?: { logEvent: (event: string, data: Record<string, unknown>) => void } }).convexAnalytics) {
    (window as Window & { convexAnalytics?: { logEvent: (event: string, data: Record<string, unknown>) => void } }).convexAnalytics.logEvent('convex_preloaded_query_used', {
      function: functionName,
      hasResult: result !== null,
      resultType: Array.isArray(result) ? 'array' : typeof result,
    });
  }
  
  return result;
}

/**
 * Utility to measure any async operation with Convex context
 */
export function useMeasuredOperation() {
  return useCallback(
    async <T>(operationName: string, operation: () => Promise<T>): Promise<T> => {
      return measurePerformance.measureConvexCall(operationName, operation);
    },
    []
  );
}

export default {
  useMutationWithMonitoring,
  useQueryWithMonitoring,
  usePreloadedQueryWithMonitoring,
  useMeasuredOperation,
};