import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { ConvexError } from "convex/values";
import { getSecurityContext } from "./rowLevelSecurity";
// Copy RATE_LIMIT_CONFIGS from rateLimiting.ts to avoid circular imports
const RATE_LIMIT_CONFIGS: Record<string, { maxTokens: number; refillRate: number; costPerRequest: number }> = {
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
import { Id } from "../_generated/dataModel";

// Get rate limit status for current user
export const getRateLimitStatus = query({
  args: {
    operation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("clerkId"), identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get all operations or specific one
    const operations = args.operation 
      ? [args.operation] 
      : Object.keys(RATE_LIMIT_CONFIGS);

    const statuses = await Promise.all(
      operations.map(async (operation) => {
        const config = RATE_LIMIT_CONFIGS[operation] || RATE_LIMIT_CONFIGS["query.default"];
        const key = `user:${user._id}:${operation}`;
        
        const bucket = await ctx.db
          .query("rateLimitBuckets")
          .withIndex("by_key", (q) => q.eq("key", key))
          .first();

        const now = new Date();
        let currentTokens = config.maxTokens;
        let resetIn = 0;
        let blocked = false;
        let blockedUntil: string | null = null;

        if (bucket) {
          // Check if blocked
          if (bucket.blockedUntil && new Date(bucket.blockedUntil) > now) {
            blocked = true;
            blockedUntil = bucket.blockedUntil;
            resetIn = Math.ceil((new Date(bucket.blockedUntil).getTime() - now.getTime()) / 1000);
          } else {
            // Calculate current tokens with refill
            const timeSinceRefill = (now.getTime() - new Date(bucket.lastRefill).getTime()) / 60000;
            const tokensToAdd = Math.floor(timeSinceRefill * config.refillRate);
            currentTokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);
            
            // Calculate reset time
            if (currentTokens < config.maxTokens) {
              resetIn = Math.ceil((config.maxTokens - currentTokens) / config.refillRate * 60);
            }
          }
        }

        return {
          operation,
          currentTokens,
          maxTokens: config.maxTokens,
          refillRate: config.refillRate,
          costPerRequest: config.costPerRequest,
          resetIn,
          blocked,
          blockedUntil,
          violations: bucket?.violations || 0,
        };
      })
    );

    return {
      userId: user._id,
      statuses,
      timestamp: new Date().toISOString(),
    };
  },
});

// Get usage quotas for enterprise
export const getUsageQuotas = query({
  args: {},
  handler: async (ctx) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Get enterprise subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    // Define quota limits based on plan
    const quotaLimits = {
      starter: {
        contracts: 100,
        vendors: 50,
        users: 5,
        storageGB: 5,
        aiAnalysisPerMonth: 50,
        apiCallsPerMonth: 10000,
      },
      professional: {
        contracts: 1000,
        vendors: 500,
        users: 25,
        storageGB: 50,
        aiAnalysisPerMonth: 500,
        apiCallsPerMonth: 100000,
      },
      enterprise: {
        contracts: -1, // Unlimited
        vendors: -1,
        users: -1,
        storageGB: 500,
        aiAnalysisPerMonth: -1,
        apiCallsPerMonth: -1,
      },
    };

    const plan = subscription?.plan || "starter";
    const limits = quotaLimits[plan as keyof typeof quotaLimits];

    // Get current usage
    const [contracts, vendors, users] = await Promise.all([
      ctx.db
        .query("contracts")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
        .collect(),
      ctx.db
        .query("vendors")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
        .collect(),
      ctx.db
        .query("users")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
        .collect(),
    ]);

    // Get monthly usage metrics
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const aiAnalysisCount = await ctx.db
      .query("contractClauses")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
      .filter((q) => q.gte(q.field("createdAt"), currentMonth.toISOString()))
      .collect();

    const apiCalls = await ctx.db
      .query("rateLimitLogs")
      .withIndex("by_user", (q) => q.eq("userId", securityContext.userId))
      .filter((q) => q.gte(q.field("timestamp"), currentMonth.toISOString()))
      .collect();

    // Calculate storage (simplified - count file sizes)
    const contractsWithStorage = await Promise.all(
      contracts.map(async (contract) => {
        try {
          const url = await ctx.storage.getUrl(contract.storageId);
          // Estimate 1MB per contract (would need actual file size tracking)
          return 1;
        } catch {
          return 0;
        }
      })
    );
    const storageUsedMB = contractsWithStorage.reduce((sum: number, size) => sum + size, 0);
    const storageUsedGB = storageUsedMB / 1024;

    const usage = {
      contracts: contracts.length,
      vendors: vendors.length,
      users: users.length,
      storageGB: storageUsedGB,
      aiAnalysisPerMonth: aiAnalysisCount.length,
      apiCallsPerMonth: apiCalls.length,
    };

    // Calculate percentages and warnings
    const quotas = Object.entries(limits).map(([metric, limit]) => {
      const used = usage[metric as keyof typeof usage];
      const percentage = limit === -1 ? 0 : (used / limit) * 100;
      
      return {
        metric,
        used,
        limit,
        percentage: Math.round(percentage),
        unlimited: limit === -1,
        warning: percentage > 80 && percentage < 100,
        exceeded: percentage >= 100,
      };
    });

    return {
      plan,
      quotas,
      billingPeriod: subscription?.billingPeriod || "monthly",
      nextReset: subscription?.currentPeriodEnd 
        ? new Date(subscription.currentPeriodEnd).toISOString() 
        : new Date(currentMonth.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  },
});

// Get rate limit history
export const getRateLimitHistory = query({
  args: {
    timeRange: v.union(
      v.literal("1h"),
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d")
    ),
    operation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Calculate time range
    const now = Date.now();
    const timeRanges = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    const startTime = new Date(now - timeRanges[args.timeRange]).toISOString();

    let logs = await ctx.db
      .query("rateLimitLogs")
      .withIndex("by_user", (q) => q.eq("userId", securityContext.userId))
      .filter((q) => q.gte(q.field("timestamp"), startTime))
      .collect();

    if (args.operation) {
      logs = logs.filter((log) => log.operation === args.operation);
    }

    // Group by time buckets
    const bucketSize = args.timeRange === "1h" ? 5 * 60 * 1000 : // 5 minutes
                      args.timeRange === "24h" ? 60 * 60 * 1000 : // 1 hour
                      args.timeRange === "7d" ? 6 * 60 * 60 * 1000 : // 6 hours
                      24 * 60 * 60 * 1000; // 1 day

    const buckets = new Map<number, { allowed: number; blocked: number; total: number }>();

    logs.forEach((log) => {
      const time = new Date(log.timestamp).getTime();
      const bucketTime = Math.floor(time / bucketSize) * bucketSize;
      
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, { allowed: 0, blocked: 0, total: 0 });
      }
      
      const bucket = buckets.get(bucketTime)!;
      bucket.total++;
      if (log.allowed) {
        bucket.allowed++;
      } else {
        bucket.blocked++;
      }
    });

    // Convert to array and sort
    const history = Array.from(buckets.entries())
      .map(([time, stats]) => ({
        timestamp: new Date(time).toISOString(),
        ...stats,
        blockRate: stats.total > 0 ? (stats.blocked / stats.total) * 100 : 0,
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Calculate summary statistics
    const totalRequests = logs.length;
    const blockedRequests = logs.filter((log) => !log.allowed).length;
    const blockRate = totalRequests > 0 ? (blockedRequests / totalRequests) * 100 : 0;

    // Get operations breakdown
    const operationStats = logs.reduce((acc, log) => {
      if (!acc[log.operation]) {
        acc[log.operation] = { allowed: 0, blocked: 0, total: 0 };
      }
      acc[log.operation].total++;
      if (log.allowed) {
        acc[log.operation].allowed++;
      } else {
        acc[log.operation].blocked++;
      }
      return acc;
    }, {} as Record<string, { allowed: number; blocked: number; total: number }>);

    return {
      timeRange: args.timeRange,
      history,
      summary: {
        totalRequests,
        allowedRequests: totalRequests - blockedRequests,
        blockedRequests,
        blockRate: Math.round(blockRate * 100) / 100,
      },
      operationBreakdown: Object.entries(operationStats).map(([operation, stats]) => ({
        operation,
        ...stats,
        blockRate: stats.total > 0 ? Math.round((stats.blocked / stats.total) * 100 * 100) / 100 : 0,
      })),
    };
  },
});

// Reset rate limit for a specific operation (admin only)
export const resetRateLimit = mutation({
  args: {
    userId: v.id("users"),
    operation: v.string(),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins and owners can reset rate limits
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    const key = `user:${args.userId}:${args.operation}`;
    
    const bucket = await ctx.db
      .query("rateLimitBuckets")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (bucket) {
      const config = RATE_LIMIT_CONFIGS[args.operation] || RATE_LIMIT_CONFIGS["query.default"];
      
      await ctx.db.patch(bucket._id, {
        tokens: config.maxTokens,
        lastRefill: new Date().toISOString(),
        violations: 0,
        // Remove blockedUntil by not including it
      });

      // Log the action
      await ctx.db.insert("auditLogs", {
        userId: securityContext.userId,
        enterpriseId: securityContext.enterpriseId,
        operation: "resetRateLimit",
        resourceType: "rateLimits",
        resourceId: args.userId,
        action: "update",
        status: "success",
        timestamp: new Date().toISOString(),
        metadata: {
          targetUserId: args.userId,
          operation: args.operation,
        },
      });
    }

    return { success: true };
  },
});

// Get enterprise-wide rate limit statistics (admin only)
export const getEnterpriseRateLimitStats = query({
  args: {
    timeRange: v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d")
    ),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins and owners can view enterprise stats
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    // Get all users in enterprise
    const users = await ctx.db
      .query("users")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
      .collect();

    const userIds = users.map((u) => u._id);

    // Calculate time range
    const now = Date.now();
    const timeRanges = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    const startTime = new Date(now - timeRanges[args.timeRange]).toISOString();

    // Get logs for all users
    const allLogs = await Promise.all(
      userIds.map(async (userId) => {
        const logs = await ctx.db
          .query("rateLimitLogs")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .filter((q) => q.gte(q.field("timestamp"), startTime))
          .collect();
        return { userId, logs };
      })
    );

    // Aggregate statistics
    const userStats = allLogs.map(({ userId, logs }) => {
      const user = users.find((u) => u._id === userId)!;
      const totalRequests = logs.length;
      const blockedRequests = logs.filter((log) => !log.allowed).length;
      
      return {
        userId,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
        userEmail: user.email,
        totalRequests,
        allowedRequests: totalRequests - blockedRequests,
        blockedRequests,
        blockRate: totalRequests > 0 ? Math.round((blockedRequests / totalRequests) * 100 * 100) / 100 : 0,
      };
    }).filter((stats) => stats.totalRequests > 0)
      .sort((a, b) => b.totalRequests - a.totalRequests);

    // Get operation breakdown across all users
    const operationStats = allLogs.flatMap(({ logs }) => logs)
      .reduce((acc, log) => {
        if (!acc[log.operation]) {
          acc[log.operation] = { allowed: 0, blocked: 0, total: 0 };
        }
        acc[log.operation].total++;
        if (log.allowed) {
          acc[log.operation].allowed++;
        } else {
          acc[log.operation].blocked++;
        }
        return acc;
      }, {} as Record<string, { allowed: number; blocked: number; total: number }>);

    // Get current blocked users
    const blockedUsers = await Promise.all(
      userIds.map(async (userId) => {
        const buckets = await ctx.db
          .query("rateLimitBuckets")
          .filter((q) => q.eq(q.field("key"), `user:${userId}:`))
          .collect();
        
        const blockedBuckets = buckets.filter((b) => 
          b.blockedUntil && new Date(b.blockedUntil) > new Date()
        );
        
        if (blockedBuckets.length > 0) {
          const user = users.find((u) => u._id === userId)!;
          return {
            userId,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
            userEmail: user.email,
            blockedOperations: blockedBuckets.map((b) => ({
              operation: b.key.split(":")[2],
              blockedUntil: b.blockedUntil,
              violations: b.violations,
            })),
          };
        }
        return null;
      })
    ).then((results) => results.filter((r) => r !== null));

    const totalRequests = allLogs.reduce((sum, { logs }) => sum + logs.length, 0);
    const totalBlocked = allLogs.reduce((sum, { logs }) => 
      sum + logs.filter((log) => !log.allowed).length, 0
    );

    return {
      timeRange: args.timeRange,
      summary: {
        totalUsers: users.length,
        activeUsers: userStats.length,
        totalRequests,
        totalBlocked,
        overallBlockRate: totalRequests > 0 ? Math.round((totalBlocked / totalRequests) * 100 * 100) / 100 : 0,
        currentlyBlockedUsers: blockedUsers.length,
      },
      topUsers: userStats.slice(0, 10),
      operationBreakdown: Object.entries(operationStats).map(([operation, stats]) => ({
        operation,
        ...stats,
        blockRate: stats.total > 0 ? Math.round((stats.blocked / stats.total) * 100 * 100) / 100 : 0,
      })).sort((a, b) => b.total - a.total),
      blockedUsers,
    };
  },
});