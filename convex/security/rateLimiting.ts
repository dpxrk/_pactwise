import { QueryCtx, MutationCtx, ActionCtx, internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { defineTable } from "convex/server";
import { Id } from "../_generated/dataModel";

/**
 * Rate Limiting and DDoS Protection
 * 
 * Implements token bucket algorithm for rate limiting
 * with different limits for different operations
 */

interface RateLimitConfig {
  maxTokens: number;      // Maximum tokens in bucket
  refillRate: number;     // Tokens per minute
  costPerRequest: number; // Tokens consumed per request
}

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Queries - more lenient
  "query.default": { maxTokens: 100, refillRate: 60, costPerRequest: 1 },
  "query.search": { maxTokens: 30, refillRate: 20, costPerRequest: 2 },
  "query.analytics": { maxTokens: 20, refillRate: 10, costPerRequest: 5 },
  
  // Mutations - more restrictive
  "mutation.create": { maxTokens: 20, refillRate: 10, costPerRequest: 2 },
  "mutation.update": { maxTokens: 30, refillRate: 15, costPerRequest: 1 },
  "mutation.delete": { maxTokens: 10, refillRate: 5, costPerRequest: 3 },
  "mutation.bulk": { maxTokens: 5, refillRate: 2, costPerRequest: 5 },
  
  // Actions - most restrictive
  "action.fileUpload": { maxTokens: 5, refillRate: 2, costPerRequest: 2 },
  "action.analysis": { maxTokens: 3, refillRate: 1, costPerRequest: 1 },
  "action.export": { maxTokens: 2, refillRate: 1, costPerRequest: 1 },
  
  // Authentication - special handling
  "auth.login": { maxTokens: 10, refillRate: 5, costPerRequest: 1 },
  "auth.register": { maxTokens: 5, refillRate: 2, costPerRequest: 2 },
  "auth.passwordReset": { maxTokens: 3, refillRate: 1, costPerRequest: 1 },
};

// Rate limit buckets table schema
export const rateLimitTables = {
  rateLimitBuckets: defineTable({
    key: v.string(), // userId:operation or ip:operation
    tokens: v.number(),
    lastRefill: v.string(), // ISO timestamp
    violations: v.number(),
    blockedUntil: v.optional(v.string()), // ISO timestamp
  })
  .index("by_key", ["key"])
  .index("by_blocked", ["blockedUntil"]),
  
  rateLimitLogs: defineTable({
    userId: v.optional(v.id("users")),
    ipAddress: v.string(),
    operation: v.string(),
    allowed: v.boolean(),
    tokens: v.number(),
    timestamp: v.string(),
    userAgent: v.optional(v.string()),
    metadata: v.optional(v.any()),
  })
  .index("by_user", ["userId"])
  .index("by_ip", ["ipAddress"])
  .index("by_timestamp", ["timestamp"]),
};

/**
 * Check rate limit for an operation
 */
export async function checkRateLimit(
  ctx: any,
  operation: string,
  options: {
    userId?: Id<"users">;
    ipAddress?: string;
    cost?: number;
  } = {}
): Promise<{ allowed: boolean; tokens: number; resetIn?: number }> {
  const config = RATE_LIMIT_CONFIGS[operation] || RATE_LIMIT_CONFIGS["query.default"];
  if (!config) {
    throw new Error(`No rate limit config found for operation: ${operation}`);
  }
  const cost = options.cost || config.costPerRequest;
  
  // Generate rate limit key
  const key = options.userId 
    ? `user:${options.userId}:${operation}`
    : `ip:${options.ipAddress || "unknown"}:${operation}`;
  
  // Get or create bucket
  let bucket = await ctx.db
    .query("rateLimitBuckets")
    .withIndex("by_key", (q:any) => q.eq("key", key))
    .first();
  
  const now = new Date();
  
  if (!bucket) {
    // Create new bucket
    await ctx.db.insert("rateLimitBuckets", {
      key,
      tokens: config.maxTokens,
      lastRefill: now.toISOString(),
      violations: 0,
    });
    bucket = { 
      _id: undefined as any,
      key,
      tokens: config.maxTokens,
      lastRefill: now.toISOString(),
      violations: 0,
      blockedUntil: undefined
    };
  } else {
    // Check if blocked
    if (bucket.blockedUntil && new Date(bucket.blockedUntil) > now) {
      const resetIn = Math.ceil((new Date(bucket.blockedUntil).getTime() - now.getTime()) / 1000);
      
      const logData: {
        userId?: Id<"users">;
        ipAddress: string;
        operation: string;
        allowed: boolean;
        tokens: number;
        metadata?: any;
      } = {
        ipAddress: options.ipAddress || "unknown",
        operation,
        allowed: false,
        tokens: 0,
        metadata: { reason: "blocked", resetIn }
      };
      
      if (options.userId !== undefined) logData.userId = options.userId;
      
      await logRateLimit(ctx, logData);
      
      return { allowed: false, tokens: 0, resetIn };
    }
    
    // Refill tokens
    const timeSinceRefill = (now.getTime() - new Date(bucket.lastRefill).getTime()) / 60000; // minutes
    const tokensToAdd = Math.floor(timeSinceRefill * config.refillRate);
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);
      await ctx.db.patch(bucket._id, {
        tokens: bucket.tokens,
        lastRefill: now.toISOString(),
      });
    }
  }
  
  // Check if enough tokens
  if (bucket.tokens >= cost) {
    // Consume tokens
    if (bucket._id) {
      await ctx.db.patch(bucket._id, {
        tokens: bucket.tokens - cost,
        violations: 0, // Reset violations on successful request
      });
    }
    
    const logDataSuccess: {
      userId?: Id<"users">;
      ipAddress: string;
      operation: string;
      allowed: boolean;
      tokens: number;
      metadata?: any;
    } = {
      ipAddress: options.ipAddress || "unknown",
      operation,
      allowed: true,
      tokens: bucket.tokens - cost,
    };
    
    if (options.userId !== undefined) logDataSuccess.userId = options.userId;
    
    await logRateLimit(ctx, logDataSuccess);
    
    return { allowed: true, tokens: bucket.tokens - cost };
  } else {
    // Not enough tokens - increment violations
    const violations = bucket.violations + 1;
    const blockDuration = calculateBlockDuration(violations);
    
    if (bucket._id) {
      await ctx.db.patch(bucket._id, {
        violations,
        blockedUntil: blockDuration > 0 
          ? new Date(now.getTime() + blockDuration).toISOString()
          : undefined,
      });
    }
    
    const logDataFailure: {
      userId?: Id<"users">;
      ipAddress: string;
      operation: string;
      allowed: boolean;
      tokens: number;
      metadata?: any;
    } = {
      ipAddress: options.ipAddress || "unknown",
      operation,
      allowed: false,
      tokens: bucket.tokens,
      metadata: { violations, blockDuration }
    };
    
    if (options.userId !== undefined) logDataFailure.userId = options.userId;
    
    await logRateLimit(ctx, logDataFailure);
    
    const resetIn = Math.ceil((config.maxTokens - bucket.tokens) / config.refillRate * 60);
    
    return { allowed: false, tokens: bucket.tokens, resetIn };
  }
}

/**
 * Calculate block duration based on violations
 */
function calculateBlockDuration(violations: number): number {
  if (violations < 5) return 0;
  if (violations < 10) return 5 * 60 * 1000; // 5 minutes
  if (violations < 20) return 15 * 60 * 1000; // 15 minutes
  if (violations < 50) return 60 * 60 * 1000; // 1 hour
  return 24 * 60 * 60 * 1000; // 24 hours
}

/**
 * Log rate limit check
 */
async function logRateLimit(
  ctx: any,
  data: {
    userId?: Id<"users">;
    ipAddress: string;
    operation: string;
    allowed: boolean;
    tokens: number;
    metadata?: any;
  }
): Promise<void> {
  const logEntry: any = {
    ipAddress: data.ipAddress,
    operation: data.operation,
    allowed: data.allowed,
    tokens: data.tokens,
    timestamp: new Date().toISOString(),
  };
  
  if (data.userId !== undefined) logEntry.userId = data.userId;
  if (data.metadata !== undefined) logEntry.metadata = data.metadata;
  
  await ctx.db.insert("rateLimitLogs", logEntry);
}

/**
 * Rate limit check for actions (called from action context)
 */
export const checkRateLimitAction = mutation({
  args: {
    operation: v.string(),
    cost: v.optional(v.number()),
    clerkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let userId: Id<"users"> | undefined;
    
    // Get user by Clerk ID if provided
    if (args.clerkId) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId!))
        .first();
      userId = user?._id;
    }
    
    const rateLimitOptions: {
      userId?: Id<"users">;
      cost?: number;
    } = {};
    
    if (userId !== undefined) rateLimitOptions.userId = userId;
    if (args.cost !== undefined) rateLimitOptions.cost = args.cost;
    
    const rateLimitResult = await checkRateLimit(ctx, args.operation, rateLimitOptions);
    
    if (!rateLimitResult.allowed) {
      throw new ConvexError(`Rate limit exceeded for operation: ${args.operation}. Please try again in ${rateLimitResult.resetIn || 60} seconds.`);
    }
    
    return rateLimitResult;
  },
});

/**
 * Clean up old rate limit data
 */
export const cleanupRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // Clean up old logs
    const oldLogs = await ctx.db
      .query("rateLimitLogs")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", thirtyDaysAgo))
      .collect();
    
    for (const log of oldLogs) {
      await ctx.db.delete(log._id);
    }
    
    // Clean up expired blocks
    const now = new Date().toISOString();
    const expiredBlocks = await ctx.db
      .query("rateLimitBuckets")
      .withIndex("by_blocked", (q) => q.lt("blockedUntil", now))
      .collect();
    
    for (const bucket of expiredBlocks) {
      if (bucket.blockedUntil) {
        const patchData: any = {
          violations: 0,
        };
        // Remove blockedUntil by not including it in the patch
        await ctx.db.patch(bucket._id, patchData);
      }
    }
  },
});
