import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { checkRateLimit } from "./rateLimiting";
import { ConvexError } from "convex/values";
import { FunctionReference, makeFunctionReference } from "convex/server";
import { Id } from "../_generated/dataModel";

/**
 * Rate Limited Function Wrapper
 * 
 * This wrapper applies rate limiting to Convex queries, mutations, and actions
 * based on user ID and operation type.
 */

interface RateLimitOptions {
  operation: string;
  cost?: number;
  skipForOwners?: boolean;
  skipForAdmins?: boolean;
}

/**
 * Get user information from context for rate limiting
 */
async function getUserInfo(ctx: any): Promise<{ userId?: Id<"users">; userRole?: string }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return {};
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q: any) => q.eq("clerkId", identity.subject))
    .first();

  return {
    userId: user?._id,
    userRole: user?.role,
  };
}

/**
 * Extract IP address from request (for actions)
 */
function getIpAddress(ctx: any): string {
  // In Convex, we don't have direct access to IP address
  // This would need to be passed from the client or handled differently
  return "unknown";
}

/**
 * Check if user should skip rate limiting based on role
 */
function shouldSkipRateLimit(userRole: string | undefined, options: RateLimitOptions): boolean {
  if (!userRole) return false;
  
  if (options.skipForOwners && userRole === "owner") return true;
  if (options.skipForAdmins && (userRole === "admin" || userRole === "owner")) return true;
  
  return false;
}

/**
 * Rate limited query wrapper
 */
export function rateLimitedQuery<Args, Output>(
  queryFn: (ctx: QueryCtx, args: Args) => Promise<Output>,
  options: RateLimitOptions
) {
  return async (ctx: QueryCtx, args: Args): Promise<Output> => {
    const { userId, userRole } = await getUserInfo(ctx);
    
    // Skip rate limiting for certain roles if configured
    if (!shouldSkipRateLimit(userRole, options)) {
      const ipAddress = getIpAddress(ctx);
      
      const rateLimitOptions: {
        userId?: Id<"users">;
        ipAddress?: string;
        cost?: number;
      } = {};
      
      if (userId !== undefined) rateLimitOptions.userId = userId;
      if (ipAddress !== undefined && ipAddress !== "unknown") rateLimitOptions.ipAddress = ipAddress;
      if (options.cost !== undefined) rateLimitOptions.cost = options.cost;
      
      const rateLimitResult = await checkRateLimit(ctx, options.operation, rateLimitOptions);
      
      if (!rateLimitResult.allowed) {
        throw new ConvexError(`Rate limit exceeded for operation: ${options.operation}. Please try again in ${rateLimitResult.resetIn || 60} seconds.`);
      }
    }
    
    return await queryFn(ctx, args);
  };
}

/**
 * Rate limited mutation wrapper
 */
export function rateLimitedMutation<Args, Output>(
  mutationFn: (ctx: MutationCtx, args: Args) => Promise<Output>,
  options: RateLimitOptions
) {
  return async (ctx: MutationCtx, args: Args): Promise<Output> => {
    const { userId, userRole } = await getUserInfo(ctx);
    
    // Skip rate limiting for certain roles if configured
    if (!shouldSkipRateLimit(userRole, options)) {
      const ipAddress = getIpAddress(ctx);
      
      const rateLimitOptions: {
        userId?: Id<"users">;
        ipAddress?: string;
        cost?: number;
      } = {};
      
      if (userId !== undefined) rateLimitOptions.userId = userId;
      if (ipAddress !== undefined && ipAddress !== "unknown") rateLimitOptions.ipAddress = ipAddress;
      if (options.cost !== undefined) rateLimitOptions.cost = options.cost;
      
      const rateLimitResult = await checkRateLimit(ctx, options.operation, rateLimitOptions);
      
      if (!rateLimitResult.allowed) {
        throw new ConvexError(`Rate limit exceeded for operation: ${options.operation}. Please try again in ${rateLimitResult.resetIn || 60} seconds.`);
      }
    }
    
    return await mutationFn(ctx, args);
  };
}

/**
 * Rate limited action wrapper
 */
export function rateLimitedAction<Args, Output>(
  actionFn: (ctx: ActionCtx, args: Args) => Promise<Output>,
  options: RateLimitOptions
) {
  return async (ctx: ActionCtx, args: Args): Promise<Output> => {
    // For actions, we need to run the rate limit check as a mutation
    const rateLimitCheck = makeFunctionReference<"mutation", any, any>("security/rateLimiting:checkRateLimitAction");
    
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;
    
    try {
      const mutationArgs: {
        operation: string;
        cost?: number;
        clerkId?: string;
      } = {
        operation: options.operation,
      };
      
      if (options.cost !== undefined) mutationArgs.cost = options.cost;
      if (userId !== undefined) mutationArgs.clerkId = userId;
      
      await ctx.runMutation(rateLimitCheck, mutationArgs);
    } catch (error) {
      if (error instanceof ConvexError && error.message.includes("Rate limit exceeded")) {
        throw error;
      }
      // If it's not a rate limit error, let the action proceed
    }
    
    return await actionFn(ctx, args);
  };
}

/**
 * Helper to create rate limited functions with common patterns
 */
export const rateLimitPatterns = {
  // Standard CRUD operations
  query: (operation: string) => ({ operation: `query.${operation}`, skipForAdmins: true }),
  search: (operation: string) => ({ operation: `query.search.${operation}`, cost: 2 }),
  analytics: (operation: string) => ({ operation: `query.analytics.${operation}`, cost: 5, skipForAdmins: true }),
  
  create: (operation: string) => ({ operation: `mutation.create.${operation}`, cost: 2 }),
  update: (operation: string) => ({ operation: `mutation.update.${operation}`, cost: 1 }),
  delete: (operation: string) => ({ operation: `mutation.delete.${operation}`, cost: 3, skipForOwners: true }),
  bulkOperation: (operation: string) => ({ operation: `mutation.bulk.${operation}`, cost: 5, skipForAdmins: true }),
  
  // Actions
  fileUpload: () => ({ operation: "action.fileUpload", cost: 2 }),
  analysis: () => ({ operation: "action.analysis", cost: 1 }),
  export: () => ({ operation: "action.export", cost: 1, skipForAdmins: true }),
  
  // Auth operations
  auth: (operation: string) => ({ operation: `auth.${operation}` }),
};

/**
 * Decorator functions for easy application
 */
export const withRateLimit = {
  query: <Args, Output>(
    queryFn: (ctx: QueryCtx, args: Args) => Promise<Output>,
    options: RateLimitOptions
  ) => rateLimitedQuery(queryFn, options),
  
  mutation: <Args, Output>(
    mutationFn: (ctx: MutationCtx, args: Args) => Promise<Output>,
    options: RateLimitOptions
  ) => rateLimitedMutation(mutationFn, options),
  
  action: <Args, Output>(
    actionFn: (ctx: ActionCtx, args: Args) => Promise<Output>,
    options: RateLimitOptions
  ) => rateLimitedAction(actionFn, options),
};