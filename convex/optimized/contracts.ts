import { query, mutation } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import { triggerContractEvents } from "../realtime/realtimeHelpers";
import { rateLimitHelpers } from "../security/applyRateLimit";

// Contract type options (matching schema.ts)
const contractTypeOptions = [
  "nda", "msa", "sow", "saas", "lease", "employment", "partnership", "other"
] as const;

// Contract status options (matching schema.ts)
const contractStatusOptions = [
  "draft", "pending_analysis", "active", "expired", "terminated", "archived",
] as const;

/**
 * OPTIMIZED: Get contracts with batch vendor fetching
 * Fixes N+1 query problem and adds proper pagination
 */
export const getContractsOptimized = query({
  args: {
    enterpriseId: v.id("enterprises"),
    contractType: v.optional(
      v.union(
        ...contractTypeOptions.map(option => v.literal(option)),
        v.literal("all")
      )
    ),
    status: v.optional(
      v.union(
        ...contractStatusOptions.map(option => v.literal(option)),
        v.literal("all")
      )
    ),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required to view contracts.");
    }

    const limit = args.limit || 20; // Smaller default for better performance

    // Build optimized query using composite index
    let query = ctx.db
      .query("contracts")
      .withIndex("by_enterprise_status_vendor", (q) => 
        q.eq("enterpriseId", args.enterpriseId)
      );
    
    // Apply status filter separately  
    if (args.status && args.status !== "all") {
      query = query.filter(q => q.eq(q.field("status"), args.status));
    }

    // Apply contract type filter at database level if possible
    if (args.contractType && args.contractType !== "all") {
      query = query.filter(q => q.eq(q.field("contractType"), args.contractType));
    }

    // Note: Search will be applied after fetching due to case-insensitive requirement

    // Paginate results
    const result = await query
      .order("desc")
      .paginate({ 
        numItems: limit, 
        cursor: args.cursor || null 
      });

    // Batch fetch vendors - single query instead of N queries
    const vendorIds = [...new Set(
      result.page
        .map(contract => contract.vendorId)
        .filter(Boolean)
    )] as Id<"vendors">[];

    // Use a single batch query for all vendors
    const vendors = await ctx.db
      .query("vendors")
      .filter(q => 
        q.or(...vendorIds.map(id => q.eq(q.field("_id"), id)))
      )
      .collect();

    // Create vendor lookup map
    const vendorMap = new Map(
      vendors.map(vendor => [vendor._id, {
        _id: vendor._id,
        name: vendor.name,
        category: vendor.category,
        status: vendor.status,
      }])
    );

    // Enrich contracts with vendor data
    const enrichedContracts = result.page.map(contract => ({
      ...contract,
      vendor: contract.vendorId ? vendorMap.get(contract.vendorId) || null : null,
    }));

    return {
      contracts: enrichedContracts,
      nextCursor: result.continueCursor,
      hasMore: result.continueCursor !== null,
    };
  },
});

/**
 * OPTIMIZED: Get contract with all related data in efficient queries
 */
export const getContractByIdOptimized = query({
  args: {
    contractId: v.id("contracts"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    const contract = await ctx.db.get(args.contractId);
    if (!contract) {
      throw new ConvexError("Contract not found.");
    }

    // Batch fetch all related data in parallel
    const [vendor, owner, createdBy, lastModifiedBy, assignments, statusHistory, approvals] = await Promise.all([
      // Vendor info
      contract.vendorId ? ctx.db.get(contract.vendorId) : null,
      // User info
      contract.ownerId ? ctx.db.get(contract.ownerId) : null,
      contract.createdBy ? ctx.db.get(contract.createdBy) : null,
      contract.lastModifiedBy ? ctx.db.get(contract.lastModifiedBy) : null,
      // Related records - use indexes and limit results
      ctx.db
        .query("contractAssignments")
        .withIndex("by_contract_active", q => 
          q.eq("contractId", args.contractId).eq("isActive", true)
        )
        .collect(),
      ctx.db
        .query("contractStatusHistory")
        .withIndex("by_contract_time", q => q.eq("contractId", args.contractId))
        .order("desc")
        .take(10), // Limit history to last 10 entries
      ctx.db
        .query("contractApprovals")
        .withIndex("by_contract_status", q => 
          q.eq("contractId", args.contractId).eq("status", "pending")
        )
        .collect(),
    ]);

    // Batch fetch users for assignments
    const assignmentUserIds = [...new Set(assignments.map(a => a.userId))];
    const assignmentUsers = await ctx.db
      .query("users")
      .filter(q => q.or(...assignmentUserIds.map(id => q.eq(q.field("_id"), id))))
      .collect();

    const userMap = new Map(assignmentUsers.map(u => [u._id, u]));

    return {
      ...contract,
      vendor,
      owner,
      createdBy,
      lastModifiedBy,
      assignments: assignments.map(a => ({
        ...a,
        user: userMap.get(a.userId),
      })),
      statusHistory,
      pendingApprovals: approvals,
    };
  },
});

/**
 * OPTIMIZED: Bulk update contract status with batching
 */
export const bulkUpdateContractStatus = mutation({
  args: {
    contractIds: v.array(v.id("contracts")),
    newStatus: v.union(...contractStatusOptions.map(option => v.literal(option))),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", q => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found.");
    }

    // Process in batches to avoid memory issues
    const BATCH_SIZE = 50;
    const results: Array<{ id: Id<"contracts">, success: boolean, error?: string }> = [];
    
    for (let i = 0; i < args.contractIds.length; i += BATCH_SIZE) {
      const batch = args.contractIds.slice(i, i + BATCH_SIZE);
      
      // Fetch contracts in batch
      const contracts = await Promise.all(
        batch.map(id => ctx.db.get(id))
      );

      // Update contracts and create history records
      const updates = contracts.map(async (contract, idx) => {
        if (!contract) return { id: batch[idx], success: false, error: "Not found" };

        try {
          // Update contract
          await ctx.db.patch(contract._id, {
            status: args.newStatus,
            lastModifiedBy: user._id,
            updatedAt: Date.now(),
          });

          // Create history record
          await ctx.db.insert("contractStatusHistory", {
            contractId: contract._id,
            previousStatus: contract.status,
            newStatus: args.newStatus,
            changedBy: user._id,
            changedAt: new Date().toISOString(),
            reason: args.reason,
          });

          return { id: contract._id, success: true };
        } catch (error) {
          return { 
            id: contract._id, 
            success: false, 
            error: error instanceof Error ? error.message : "Unknown error" 
          };
        }
      });

      const batchResults = await Promise.all(updates);
      results.push(...batchResults);
    }

    // Batch trigger events
    const successfulUpdates = results.filter(r => r.success);
    if (successfulUpdates.length > 0) {
      // Create a single batch event instead of individual events
      await ctx.db.insert("realtimeEvents", {
        enterpriseId: user.enterpriseId,
        userId: user._id,
        eventType: "contract_updated",
        resourceType: "contracts_batch",
        data: {
          contractIds: successfulUpdates.map(r => r.id),
          newStatus: args.newStatus,
          count: successfulUpdates.length,
        },
        timestamp: new Date().toISOString(),
        processed: false,
      });
    }

    return {
      total: args.contractIds.length,
      successful: successfulUpdates.length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  },
});