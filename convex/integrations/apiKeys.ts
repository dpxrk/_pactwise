"use node";

import { v } from "convex/values";
import { mutation, query, action } from "../_generated/server";
import { ConvexError } from "convex/values";
import { getSecurityContext } from "../security/rowLevelSecurity";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import crypto from "crypto";

// API Key permissions
export const APIKeyPermissions = {
  // Read permissions
  READ_CONTRACTS: "read:contracts",
  READ_VENDORS: "read:vendors",
  READ_USERS: "read:users",
  READ_ANALYTICS: "read:analytics",
  
  // Write permissions
  WRITE_CONTRACTS: "write:contracts",
  WRITE_VENDORS: "write:vendors",
  
  // Admin permissions
  MANAGE_USERS: "manage:users",
  MANAGE_SETTINGS: "manage:settings",
  
  // Special permissions
  TRIGGER_ANALYSIS: "action:analysis",
  EXPORT_DATA: "action:export",
} as const;

export type APIKeyPermission = typeof APIKeyPermissions[keyof typeof APIKeyPermissions];

// Create API key
export const createAPIKey = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
    expiresIn: v.optional(v.union(
      v.literal("30d"),
      v.literal("90d"),
      v.literal("1y"),
      v.literal("never")
    )),
    rateLimit: v.optional(v.object({
      requestsPerMinute: v.number(),
      requestsPerHour: v.number(),
      requestsPerDay: v.number(),
    })),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can create API keys
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    // Validate permissions
    const validPermissions = Object.values(APIKeyPermissions);
    for (const permission of args.permissions) {
      if (!validPermissions.includes(permission as APIKeyPermission)) {
        throw new ConvexError(`Invalid permission: ${permission}`);
      }
    }

    // Generate API key
    const apiKey = generateAPIKey();
    const keyHash = hashAPIKey(apiKey);
    const keyPrefix = apiKey.substring(0, 8);

    // Calculate expiration
    let expiresAt;
    if (args.expiresIn && args.expiresIn !== "never") {
      const now = new Date();
      switch (args.expiresIn) {
        case "30d":
          now.setDate(now.getDate() + 30);
          break;
        case "90d":
          now.setDate(now.getDate() + 90);
          break;
        case "1y":
          now.setFullYear(now.getFullYear() + 1);
          break;
      }
      expiresAt = now.toISOString();
    }

    const apiKeyId = await ctx.db.insert("apiKeys", {
      enterpriseId: securityContext.enterpriseId,
      name: args.name,
      description: args.description,
      keyHash,
      keyPrefix,
      permissions: args.permissions,
      rateLimit: args.rateLimit || {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
      },
      expiresAt,
      isActive: true,
      createdBy: securityContext.userId,
      createdAt: new Date().toISOString(),
      metadata: args.metadata,
    });

    // Log the creation
    await ctx.db.insert("auditLogs", {
      userId: securityContext.userId,
      enterpriseId: securityContext.enterpriseId,
      operation: "createAPIKey",
      resourceType: "apiKeys",
      resourceId: apiKeyId,
      action: "create",
      status: "success",
      timestamp: new Date().toISOString(),
      metadata: { 
        name: args.name, 
        permissions: args.permissions,
        expiresIn: args.expiresIn 
      }
    });

    return {
      id: apiKeyId,
      apiKey, // Only returned once during creation
      prefix: keyPrefix,
      message: "Store this API key securely. It will not be shown again.",
    };
  },
});

// List API keys
export const listAPIKeys = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can view API keys
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    let apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
      .collect();

    if (!args.includeInactive) {
      apiKeys = apiKeys.filter(k => k.isActive);
    }

    // Filter expired keys
    const now = new Date();
    apiKeys = apiKeys.filter(k => !k.expiresAt || new Date(k.expiresAt) > now);

    // Enrich with creator info and usage stats
    const enrichedKeys = await Promise.all(
      apiKeys.map(async (key) => {
        const creator = await ctx.db.get(key.createdBy);
        
        // Get recent usage stats
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const recentUsage = await ctx.db
          .query("apiKeyUsage")
          .withIndex("by_key_timestamp", (q) => 
            q.eq("apiKeyId", key._id).gte("timestamp", oneDayAgo)
          )
          .collect();

        const usageStats = {
          last24h: recentUsage.length,
          lastUsed: key.lastUsedAt,
          totalRequests: recentUsage.length, // Simplified - would need aggregation
        };

        return {
          ...key,
          keyHash: undefined, // Never expose the hash
          creatorName: creator ? `${creator.firstName || ""} ${creator.lastName || ""}`.trim() || creator.email : "Unknown",
          usageStats,
        };
      })
    );

    return enrichedKeys;
  },
});

// Get API key details
export const getAPIKeyDetails = query({
  args: {
    apiKeyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can view API keys
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    const apiKey = await ctx.db.get(args.apiKeyId);
    if (!apiKey) {
      throw new ConvexError("API key not found");
    }

    if (apiKey.enterpriseId !== securityContext.enterpriseId) {
      throw new ConvexError("Access denied: API key belongs to different enterprise");
    }

    // Get usage history
    const usage = await ctx.db
      .query("apiKeyUsage")
      .withIndex("by_key", (q) => q.eq("apiKeyId", args.apiKeyId))
      .order("desc")
      .take(100);

    // Calculate usage statistics
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const usageStats = {
      lastHour: usage.filter(u => new Date(u.timestamp) > oneHourAgo).length,
      last24Hours: usage.filter(u => new Date(u.timestamp) > oneDayAgo).length,
      totalRequests: usage.length,
      averageResponseTime: usage.length > 0 
        ? usage.reduce((sum, u) => sum + u.responseTime, 0) / usage.length 
        : 0,
      errorRate: usage.length > 0
        ? (usage.filter(u => u.statusCode >= 400).length / usage.length) * 100
        : 0,
    };

    // Group usage by endpoint
    const endpointStats = usage.reduce((acc, u) => {
      const key = `${u.method} ${u.endpoint}`;
      if (!acc[key]) {
        acc[key] = { count: 0, errors: 0, avgTime: 0 };
      }
      acc[key].count++;
      if (u.statusCode >= 400) acc[key].errors++;
      acc[key].avgTime = ((acc[key].avgTime * (acc[key].count - 1)) + u.responseTime) / acc[key].count;
      return acc;
    }, {} as Record<string, { count: number; errors: number; avgTime: number }>);

    const creator = await ctx.db.get(apiKey.createdBy);

    return {
      ...apiKey,
      keyHash: undefined, // Never expose the hash
      creatorName: creator ? `${creator.firstName || ""} ${creator.lastName || ""}`.trim() || creator.email : "Unknown",
      usageStats,
      endpointStats: Object.entries(endpointStats).map(([endpoint, stats]) => ({
        endpoint,
        ...stats,
      })),
      recentUsage: usage.slice(0, 20),
    };
  },
});

// Update API key
export const updateAPIKey = mutation({
  args: {
    apiKeyId: v.id("apiKeys"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
    rateLimit: v.optional(v.object({
      requestsPerMinute: v.number(),
      requestsPerHour: v.number(),
      requestsPerDay: v.number(),
    })),
    isActive: v.optional(v.boolean()),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can manage API keys
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    const apiKey = await ctx.db.get(args.apiKeyId);
    if (!apiKey) {
      throw new ConvexError("API key not found");
    }

    if (apiKey.enterpriseId !== securityContext.enterpriseId) {
      throw new ConvexError("Access denied: API key belongs to different enterprise");
    }

    // Validate permissions if provided
    if (args.permissions) {
      const validPermissions = Object.values(APIKeyPermissions);
      for (const permission of args.permissions) {
        if (!validPermissions.includes(permission as APIKeyPermission)) {
          throw new ConvexError(`Invalid permission: ${permission}`);
        }
      }
    }

    const updates: any = {};
    
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.permissions !== undefined) updates.permissions = args.permissions;
    if (args.rateLimit !== undefined) updates.rateLimit = args.rateLimit;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.metadata !== undefined) updates.metadata = args.metadata;

    await ctx.db.patch(args.apiKeyId, updates);

    // Log the update
    await ctx.db.insert("auditLogs", {
      userId: securityContext.userId,
      enterpriseId: securityContext.enterpriseId,
      operation: "updateAPIKey",
      resourceType: "apiKeys",
      resourceId: args.apiKeyId,
      action: "update",
      status: "success",
      timestamp: new Date().toISOString(),
      changes: updates,
    });

    return { success: true };
  },
});

// Revoke API key
export const revokeAPIKey = mutation({
  args: {
    apiKeyId: v.id("apiKeys"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can revoke API keys
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    const apiKey = await ctx.db.get(args.apiKeyId);
    if (!apiKey) {
      throw new ConvexError("API key not found");
    }

    if (apiKey.enterpriseId !== securityContext.enterpriseId) {
      throw new ConvexError("Access denied: API key belongs to different enterprise");
    }

    await ctx.db.patch(args.apiKeyId, {
      isActive: false,
      revokedAt: new Date().toISOString(),
      revokedBy: securityContext.userId,
    });

    // Log the revocation
    await ctx.db.insert("auditLogs", {
      userId: securityContext.userId,
      enterpriseId: securityContext.enterpriseId,
      operation: "revokeAPIKey",
      resourceType: "apiKeys",
      resourceId: args.apiKeyId,
      action: "update",
      status: "success",
      timestamp: new Date().toISOString(),
      metadata: { reason: args.reason }
    });

    return { success: true };
  },
});

// Validate API key (called from API routes)
export const validateAPIKey = action({
  args: {
    apiKey: v.string(),
    endpoint: v.string(),
    method: v.string(),
    requiredPermission: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Extract prefix from API key
    const keyPrefix = args.apiKey.substring(0, 8);
    
    // Find API key by prefix
    const apiKeys = await ctx.runQuery(api.integrations.apiKeys.findByPrefix, {
      keyPrefix,
    });

    if (apiKeys.length === 0) {
      return { valid: false, error: "Invalid API key" };
    }

    // Verify the full key hash
    const keyHash = hashAPIKey(args.apiKey);
    const validKey = apiKeys.find(k => k.keyHash === keyHash);

    if (!validKey) {
      return { valid: false, error: "Invalid API key" };
    }

    // Check if key is active
    if (!validKey.isActive) {
      return { valid: false, error: "API key has been revoked" };
    }

    // Check expiration
    if (validKey.expiresAt && new Date(validKey.expiresAt) < new Date()) {
      return { valid: false, error: "API key has expired" };
    }

    // Check permission if required
    if (args.requiredPermission && !validKey.permissions.includes(args.requiredPermission)) {
      return { valid: false, error: "Insufficient permissions" };
    }

    // Check rate limits
    const rateLimitCheck = await checkAPIKeyRateLimit(ctx, validKey._id, validKey.rateLimit);
    if (!rateLimitCheck.allowed) {
      return { 
        valid: false, 
        error: `Rate limit exceeded. Try again in ${rateLimitCheck.resetIn} seconds`,
        rateLimitExceeded: true,
        resetIn: rateLimitCheck.resetIn,
      };
    }

    // Record usage
    await ctx.runMutation(api.integrations.apiKeys.recordUsage, {
      apiKeyId: validKey._id,
      endpoint: args.endpoint,
      method: args.method,
      statusCode: 200, // Will be updated by the actual API response
      responseTime: 0, // Will be updated by the actual API response
      ipAddress: "unknown", // Should be passed from the API route
    });

    // Update last used
    await ctx.runMutation(api.integrations.apiKeys.updateLastUsed, {
      apiKeyId: validKey._id,
    });

    return {
      valid: true,
      apiKeyId: validKey._id,
      enterpriseId: validKey.enterpriseId,
      permissions: validKey.permissions,
    };
  },
});

// Find API key by prefix (internal)
export const findByPrefix = query({
  args: {
    keyPrefix: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("apiKeys")
      .withIndex("by_prefix", (q) => q.eq("keyPrefix", args.keyPrefix))
      .collect();
  },
});

// Record API key usage
export const recordUsage = mutation({
  args: {
    apiKeyId: v.id("apiKeys"),
    endpoint: v.string(),
    method: v.string(),
    statusCode: v.number(),
    responseTime: v.number(),
    ipAddress: v.string(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("apiKeyUsage", {
      apiKeyId: args.apiKeyId,
      endpoint: args.endpoint,
      method: args.method,
      statusCode: args.statusCode,
      responseTime: args.responseTime,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      timestamp: new Date().toISOString(),
    });

    // Clean up old usage records (keep last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const oldUsage = await ctx.db
      .query("apiKeyUsage")
      .withIndex("by_key_timestamp", (q) => 
        q.eq("apiKeyId", args.apiKeyId).lt("timestamp", thirtyDaysAgo)
      )
      .collect();

    for (const usage of oldUsage) {
      await ctx.db.delete(usage._id);
    }
  },
});

// Update last used timestamp
export const updateLastUsed = mutation({
  args: {
    apiKeyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.apiKeyId, {
      lastUsedAt: new Date().toISOString(),
    });
  },
});

// Get API key statistics
export const getAPIKeyStats = query({
  args: {
    timeRange: v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d")
    ),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can view stats
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    const timeRanges = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    const startTime = new Date(Date.now() - timeRanges[args.timeRange]).toISOString();

    // Get all API keys for the enterprise
    const apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
      .collect();

    // Get usage for all keys
    const allUsage = await Promise.all(
      apiKeys.map(async (key) => {
        const usage = await ctx.db
          .query("apiKeyUsage")
          .withIndex("by_key_timestamp", (q) => 
            q.eq("apiKeyId", key._id).gte("timestamp", startTime)
          )
          .collect();
        return { key, usage };
      })
    );

    // Calculate aggregate stats
    const totalRequests = allUsage.reduce((sum, { usage }) => sum + usage.length, 0);
    const totalErrors = allUsage.reduce((sum, { usage }) => 
      sum + usage.filter(u => u.statusCode >= 400).length, 0
    );
    
    const activeKeys = apiKeys.filter(k => k.isActive && (!k.expiresAt || new Date(k.expiresAt) > new Date()));
    const expiredKeys = apiKeys.filter(k => k.expiresAt && new Date(k.expiresAt) <= new Date());
    const revokedKeys = apiKeys.filter(k => !k.isActive);

    // Top keys by usage
    const keyUsage = allUsage
      .map(({ key, usage }) => ({
        keyId: key._id,
        keyName: key.name,
        requestCount: usage.length,
        errorCount: usage.filter(u => u.statusCode >= 400).length,
        avgResponseTime: usage.length > 0
          ? usage.reduce((sum, u) => sum + u.responseTime, 0) / usage.length
          : 0,
      }))
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 10);

    // Endpoint breakdown
    const endpointBreakdown = allUsage
      .flatMap(({ usage }) => usage)
      .reduce((acc, u) => {
        const key = `${u.method} ${u.endpoint}`;
        if (!acc[key]) {
          acc[key] = { count: 0, errors: 0, avgTime: 0 };
        }
        acc[key].count++;
        if (u.statusCode >= 400) acc[key].errors++;
        acc[key].avgTime = ((acc[key].avgTime * (acc[key].count - 1)) + u.responseTime) / acc[key].count;
        return acc;
      }, {} as Record<string, { count: number; errors: number; avgTime: number }>);

    return {
      timeRange: args.timeRange,
      summary: {
        totalKeys: apiKeys.length,
        activeKeys: activeKeys.length,
        expiredKeys: expiredKeys.length,
        revokedKeys: revokedKeys.length,
        totalRequests,
        totalErrors,
        errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      },
      topKeysByUsage: keyUsage,
      endpointBreakdown: Object.entries(endpointBreakdown)
        .map(([endpoint, stats]) => ({
          endpoint,
          ...stats,
          errorRate: stats.count > 0 ? (stats.errors / stats.count) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count),
    };
  },
});

// Helper functions
function generateAPIKey(): string {
  const prefix = "pk_live_";
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return prefix + randomBytes;
}

function hashAPIKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function checkAPIKeyRateLimit(
  ctx: any,
  apiKeyId: string,
  limits: { requestsPerMinute: number; requestsPerHour: number; requestsPerDay: number }
): Promise<{ allowed: boolean; resetIn?: number }> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Get recent usage
  const usage = await ctx.runQuery(api.integrations.apiKeys.getRecentUsage, {
    apiKeyId,
    since: oneDayAgo.toISOString(),
  });

  // Check limits
  const lastMinute = usage.filter(u => new Date(u.timestamp) > oneMinuteAgo).length;
  if (lastMinute >= limits.requestsPerMinute) {
    return { allowed: false, resetIn: 60 };
  }

  const lastHour = usage.filter(u => new Date(u.timestamp) > oneHourAgo).length;
  if (lastHour >= limits.requestsPerHour) {
    return { allowed: false, resetIn: 3600 };
  }

  const lastDay = usage.filter(u => new Date(u.timestamp) > oneDayAgo).length;
  if (lastDay >= limits.requestsPerDay) {
    return { allowed: false, resetIn: 86400 };
  }

  return { allowed: true };
}

// Get recent usage (internal)
export const getRecentUsage = query({
  args: {
    apiKeyId: v.id("apiKeys"),
    since: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("apiKeyUsage")
      .withIndex("by_key_timestamp", (q) => 
        q.eq("apiKeyId", args.apiKeyId).gte("timestamp", args.since)
      )
      .collect();
  },
});