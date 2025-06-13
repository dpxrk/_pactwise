/**
 * Rate Limiting Application Utility
 * 
 * This utility provides easy ways to apply rate limiting to existing Convex functions
 * without major refactoring.
 */

import { ConvexError } from "convex/values";
import { checkRateLimit } from "./rateLimiting";

/**
 * Apply rate limiting to any Convex function handler
 */
export async function withRateLimitCheck(
  ctx: any,
  operation: string,
  options: {
    cost?: number;
    skipForRoles?: string[];
  } = {}
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  
  // Get user information
  let userId;
  let userRole;
  
  if (identity) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q: any) => q.eq("clerkId", identity.subject))
      .first();
    
    userId = user?._id;
    userRole = user?.role;
  }
  
  // Skip rate limiting for certain roles
  if (userRole && options.skipForRoles?.includes(userRole)) {
    return;
  }
  
  // Check rate limit
  const rateLimitResult = await checkRateLimit(ctx, operation, {
    userId,
    cost: options.cost,
  });
  
  if (!rateLimitResult.allowed) {
    throw new ConvexError(
      `Rate limit exceeded for operation: ${operation}. ` +
      `Please try again in ${rateLimitResult.resetIn || 60} seconds.`
    );
  }
}

/**
 * Rate limiting decorator for function handlers
 */
export function rateLimitDecorator(
  operation: string,
  options: {
    cost?: number;
    skipForRoles?: string[];
  } = {}
) {
  return function <T extends (...args: any[]) => any>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;
    
    descriptor.value = (async function (this: any, ctx: any, ...args: any[]) {
      await withRateLimitCheck(ctx, operation, options);
      return method.apply(this, [ctx, ...args]);
    }) as T;
  };
}

/**
 * Common rate limit configurations for different operation types
 */
export const RATE_LIMIT_CONFIGS = {
  // Queries
  LIST_QUERY: { cost: 1, skipForRoles: ["admin", "owner"] },
  SEARCH_QUERY: { cost: 2, skipForRoles: ["admin"] },
  ANALYTICS_QUERY: { cost: 5, skipForRoles: ["admin", "owner"] },
  DETAIL_QUERY: { cost: 1, skipForRoles: [] },
  
  // Mutations
  CREATE_MUTATION: { cost: 2, skipForRoles: [] },
  UPDATE_MUTATION: { cost: 1, skipForRoles: [] },
  DELETE_MUTATION: { cost: 3, skipForRoles: ["owner"] },
  BULK_MUTATION: { cost: 5, skipForRoles: ["admin", "owner"] },
  
  // Actions
  FILE_UPLOAD_ACTION: { cost: 2, skipForRoles: [] },
  ANALYSIS_ACTION: { cost: 1, skipForRoles: [] },
  EXPORT_ACTION: { cost: 1, skipForRoles: ["admin", "owner"] },
  EMAIL_ACTION: { cost: 2, skipForRoles: [] },
  
  // Auth operations
  AUTH_OPERATION: { cost: 1, skipForRoles: [] },
};

/**
 * Helper functions for common patterns
 */
export const rateLimitHelpers = {
  /**
   * Apply rate limiting to a contract query
   */
  forContractQuery: (operation: string, type: 'list' | 'search' | 'analytics' | 'detail' = 'list') => {
    const config = {
      list: RATE_LIMIT_CONFIGS.LIST_QUERY,
      search: RATE_LIMIT_CONFIGS.SEARCH_QUERY,
      analytics: RATE_LIMIT_CONFIGS.ANALYTICS_QUERY,
      detail: RATE_LIMIT_CONFIGS.DETAIL_QUERY,
    }[type];
    
    return (ctx: any) => withRateLimitCheck(ctx, `query.contracts.${operation}`, config);
  },
  
  /**
   * Apply rate limiting to a contract mutation
   */
  forContractMutation: (operation: string, type: 'create' | 'update' | 'delete' | 'bulk' = 'update') => {
    const config = {
      create: RATE_LIMIT_CONFIGS.CREATE_MUTATION,
      update: RATE_LIMIT_CONFIGS.UPDATE_MUTATION,
      delete: RATE_LIMIT_CONFIGS.DELETE_MUTATION,
      bulk: RATE_LIMIT_CONFIGS.BULK_MUTATION,
    }[type];
    
    return (ctx: any) => withRateLimitCheck(ctx, `mutation.contracts.${operation}`, config);
  },
  
  /**
   * Apply rate limiting to a vendor query
   */
  forVendorQuery: (operation: string, type: 'list' | 'search' | 'detail' = 'list') => {
    const config = {
      list: RATE_LIMIT_CONFIGS.LIST_QUERY,
      search: RATE_LIMIT_CONFIGS.SEARCH_QUERY,
      detail: RATE_LIMIT_CONFIGS.DETAIL_QUERY,
    }[type];
    
    return (ctx: any) => withRateLimitCheck(ctx, `query.vendors.${operation}`, config);
  },
  
  /**
   * Apply rate limiting to a vendor mutation
   */
  forVendorMutation: (operation: string, type: 'create' | 'update' | 'delete' = 'update') => {
    const config = {
      create: RATE_LIMIT_CONFIGS.CREATE_MUTATION,
      update: RATE_LIMIT_CONFIGS.UPDATE_MUTATION,
      delete: RATE_LIMIT_CONFIGS.DELETE_MUTATION,
    }[type];
    
    return (ctx: any) => withRateLimitCheck(ctx, `mutation.vendors.${operation}`, config);
  },
  
  /**
   * Apply rate limiting to an action
   */
  forAction: (operation: string, type: 'fileUpload' | 'analysis' | 'export' | 'email' = 'analysis') => {
    const config = {
      fileUpload: RATE_LIMIT_CONFIGS.FILE_UPLOAD_ACTION,
      analysis: RATE_LIMIT_CONFIGS.ANALYSIS_ACTION,
      export: RATE_LIMIT_CONFIGS.EXPORT_ACTION,
      email: RATE_LIMIT_CONFIGS.EMAIL_ACTION,
    }[type];
    
    return (ctx: any) => withRateLimitCheck(ctx, `action.${operation}`, config);
  },
};

/**
 * Middleware-style rate limiting for existing functions
 * 
 * Usage:
 * const originalHandler = async (ctx, args) => { ... };
 * const rateLimitedHandler = applyRateLimit(originalHandler, 'query.contracts.list', { cost: 1 });
 */
export function applyRateLimit<T extends (ctx: any, ...args: any[]) => Promise<any>>(
  handler: T,
  operation: string,
  options: {
    cost?: number;
    skipForRoles?: string[];
  } = {}
): T {
  return (async (ctx: any, ...args: any[]) => {
    await withRateLimitCheck(ctx, operation, options);
    return handler(ctx, ...args);
  }) as T;
}

/**
 * Batch rate limiting for operations that process multiple items
 */
export async function withBatchRateLimit(
  ctx: any,
  operation: string,
  itemCount: number,
  options: {
    costPerItem?: number;
    maxBatchSize?: number;
    skipForRoles?: string[];
  } = {}
): Promise<void> {
  const { costPerItem = 1, maxBatchSize = 100, skipForRoles = [] } = options;
  
  // Check batch size limit
  if (itemCount > maxBatchSize) {
    throw new ConvexError(`Batch size ${itemCount} exceeds maximum allowed size of ${maxBatchSize}`);
  }
  
  // Apply rate limiting with cost multiplier
  await withRateLimitCheck(ctx, operation, {
    cost: itemCount * costPerItem,
    skipForRoles,
  });
}

/**
 * Rate limiting for expensive operations with progressive cost
 */
export async function withProgressiveRateLimit(
  ctx: any,
  operation: string,
  complexity: 'simple' | 'moderate' | 'complex' | 'intensive',
  options: {
    skipForRoles?: string[];
  } = {}
): Promise<void> {
  const costMap = {
    simple: 1,
    moderate: 3,
    complex: 8,
    intensive: 15,
  };
  
  await withRateLimitCheck(ctx, operation, {
    cost: costMap[complexity],
    skipForRoles: options.skipForRoles,
  });
}