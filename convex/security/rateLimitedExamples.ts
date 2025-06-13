/**
 * Rate Limited Function Examples
 * 
 * This file demonstrates how to apply rate limiting to existing Convex functions.
 * These are examples that can be applied to actual functions in the codebase.
 */

import { query, mutation, action } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { withRateLimit, rateLimitPatterns } from "./rateLimitedWrapper";

// ============================================================================
// RATE LIMITED QUERY EXAMPLES
// ============================================================================

/**
 * Example: Rate limited contract listing
 */
export const getContractsWithRateLimit = query({
  args: {
    filters: v.optional(v.object({
      status: v.optional(v.string()),
      vendorId: v.optional(v.string()),
      search: v.optional(v.string()),
    })),
    pagination: v.optional(v.object({
      limit: v.optional(v.number()),
      offset: v.optional(v.number()),
    })),
  },
  handler: withRateLimit.query(
    async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required");
      }

      // Original function logic would go here
      const contracts = await ctx.db
        .query("contracts")
        .collect();

      return contracts;
    },
    rateLimitPatterns.query("contracts.list")
  ),
});

/**
 * Example: Rate limited search with higher cost
 */
export const searchContractsWithRateLimit = query({
  args: {
    searchQuery: v.string(),
    filters: v.optional(v.object({
      status: v.optional(v.string()),
      contractType: v.optional(v.string()),
    })),
  },
  handler: withRateLimit.query(
    async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required");
      }

      // Search logic with higher computational cost
      const results = await ctx.db
        .query("contracts")
        .collect();

      // Filter and search logic would go here
      return results.filter(contract => 
        contract.title?.toLowerCase().includes(args.searchQuery.toLowerCase())
      );
    },
    rateLimitPatterns.search("contracts")
  ),
});

/**
 * Example: Rate limited analytics query
 */
export const getAnalyticsWithRateLimit = query({
  args: {
    timeRange: v.object({
      start: v.string(),
      end: v.string(),
    }),
    metrics: v.array(v.string()),
  },
  handler: withRateLimit.query(
    async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required");
      }

      // Heavy analytics computation
      const contracts = await ctx.db.query("contracts").collect();
      
      // Complex analytics calculations would go here
      return {
        totalContracts: contracts.length,
        activeContracts: contracts.filter(c => c.status === "active").length,
        // More analytics...
      };
    },
    rateLimitPatterns.analytics("contracts.overview")
  ),
});

// ============================================================================
// RATE LIMITED MUTATION EXAMPLES
// ============================================================================

/**
 * Example: Rate limited contract creation
 */
export const createContractWithRateLimit = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    vendorId: v.id("vendors"),
    contractType: v.string(),
    status: v.optional(v.string()),
  },
  handler: withRateLimit.mutation(
    async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required");
      }

      // Get current user
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
        .first();

      if (!user) {
        throw new ConvexError("User not found");
      }

      // Create contract
      const contractId = await ctx.db.insert("contracts", {
        title: args.title,
        description: args.description,
        vendorId: args.vendorId,
        contractType: args.contractType as any,
        status: (args.status as any) || "draft",
        enterpriseId: user.enterpriseId,
        createdBy: user._id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return contractId;
    },
    rateLimitPatterns.create("contracts")
  ),
});

/**
 * Example: Rate limited contract update
 */
export const updateContractWithRateLimit = mutation({
  args: {
    contractId: v.id("contracts"),
    updates: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      status: v.optional(v.string()),
    }),
  },
  handler: withRateLimit.mutation(
    async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required");
      }

      // Check contract exists and user has permission
      const contract = await ctx.db.get(args.contractId);
      if (!contract) {
        throw new ConvexError("Contract not found");
      }

      // Update contract
      await ctx.db.patch(args.contractId, {
        ...args.updates,
        updatedAt: new Date().toISOString(),
      });

      return args.contractId;
    },
    rateLimitPatterns.update("contracts")
  ),
});

/**
 * Example: Rate limited bulk operation
 */
export const bulkUpdateContractsWithRateLimit = mutation({
  args: {
    contractIds: v.array(v.id("contracts")),
    updates: v.object({
      status: v.optional(v.string()),
    }),
  },
  handler: withRateLimit.mutation(
    async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required");
      }

      // Bulk update logic
      const results = [];
      for (const contractId of args.contractIds) {
        const contract = await ctx.db.get(contractId);
        if (contract) {
          await ctx.db.patch(contractId, {
            ...args.updates,
            updatedAt: new Date().toISOString(),
          });
          results.push(contractId);
        }
      }

      return results;
    },
    rateLimitPatterns.bulkOperation("contracts.update")
  ),
});

// ============================================================================
// RATE LIMITED ACTION EXAMPLES
// ============================================================================

/**
 * Example: Rate limited file upload action
 */
export const uploadContractFileWithRateLimit = action({
  args: {
    contractId: v.id("contracts"),
    fileName: v.string(),
    fileType: v.string(),
  },
  handler: withRateLimit.action(
    async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required");
      }

      // File upload logic would go here
      // This is a placeholder for the actual file upload implementation
      
      return {
        success: true,
        message: `File ${args.fileName} uploaded for contract ${args.contractId}`,
      };
    },
    rateLimitPatterns.fileUpload()
  ),
});

/**
 * Example: Rate limited contract analysis action
 */
export const analyzeContractWithRateLimit = action({
  args: {
    contractId: v.id("contracts"),
    analysisType: v.string(),
  },
  handler: withRateLimit.action(
    async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required");
      }

      // AI analysis logic would go here
      // This is computationally expensive and should be rate limited
      
      return {
        analysisId: `analysis_${Date.now()}`,
        status: "processing",
        estimatedCompletion: new Date(Date.now() + 300000).toISOString(), // 5 minutes
      };
    },
    rateLimitPatterns.analysis()
  ),
});

/**
 * Example: Rate limited export action
 */
export const exportContractsWithRateLimit = action({
  args: {
    filters: v.optional(v.object({
      status: v.optional(v.string()),
      dateRange: v.optional(v.object({
        start: v.string(),
        end: v.string(),
      })),
    })),
    format: v.string(), // "csv", "pdf", "xlsx"
  },
  handler: withRateLimit.action(
    async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required");
      }

      // Export generation logic would go here
      // This is resource-intensive and should be rate limited
      
      return {
        exportId: `export_${Date.now()}`,
        downloadUrl: `https://example.com/exports/export_${Date.now()}.${args.format}`,
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      };
    },
    rateLimitPatterns.export()
  ),
});

// ============================================================================
// RATE LIMIT MONITORING QUERIES
// ============================================================================

/**
 * Get rate limit status for current user
 */
export const getRateLimitStatus = query({
  args: {
    operations: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const operations = args.operations || [
      "query.contracts.list",
      "mutation.create.contracts",
      "action.fileUpload",
    ];

    const status: Record<string, any> = {};

    for (const operation of operations) {
      const key = `user:${user._id}:${operation}`;
      const bucket = await ctx.db
        .query("rateLimitBuckets")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();

      status[operation] = {
        tokens: bucket?.tokens || 0,
        maxTokens: 100, // Would need to get from config
        isBlocked: bucket?.blockedUntil && new Date(bucket.blockedUntil) > new Date(),
        blockedUntil: bucket?.blockedUntil,
        violations: bucket?.violations || 0,
      };
    }

    return status;
  },
});