import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { ConvexError } from "convex/values";
import { internal, api } from "./_generated/api";

// Contract type options (matching schema.ts)
const contractTypeOptions = [
  "nda", "msa", "sow", "saas", "lease", "employment", "partnership", "other"
] as const;

// Contract status options (matching schema.ts)
const contractStatusOptions = [
  "draft", "pending_analysis", "active", "expired", "terminated", "archived"
] as const;

// Analysis status options (matching schema.ts)
const analysisStatusOptions = [
  "pending", "processing", "completed", "failed"
] as const;

// ============================================================================
// FILE UPLOAD
// ============================================================================

/**
 * Generate upload URL for contract files
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to upload files.");
    }
    
    // Generate upload URL for file storage
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get contract file URL from storage
 */
export const getContractFileUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required to access contract files.");
    }
    
    return await ctx.storage.getUrl(args.storageId);
  },
});

// ============================================================================
// CREATE
// ============================================================================

/**
 * Create a new contract
 */
export const createContract = mutation({
  args: {
    enterpriseId: v.id("enterprises"),
    vendorId: v.id("vendors"),
    title: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    contractType: v.optional(
      v.union(...contractTypeOptions.map(option => v.literal(option)))
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to create a contract.");
    }

    // Validate required fields
    if (!args.title || args.title.trim() === "") {
      throw new ConvexError("Validation Error: Contract title cannot be empty.");
    }

    // Validate that vendor belongs to the enterprise
    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor) {
      throw new ConvexError("Vendor not found.");
    }
    if (vendor.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Vendor does not belong to the specified enterprise.");
    }

    // Create the contract
    const contractId = await ctx.db.insert("contracts", {
      enterpriseId: args.enterpriseId,
      vendorId: args.vendorId,
      title: args.title.trim(),
      status: "draft",
      contractType: args.contractType,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      analysisStatus: "pending",
      notes: args.notes?.trim() || undefined,
    });

    // Trigger contract analysis (optional - can be done manually or via agent system)
    // For now, we'll leave the contract in draft status until analysis is manually triggered

    console.log(`Contract created with ID: ${contractId} for enterprise ${args.enterpriseId}`);
    return contractId;
  },
});

// ============================================================================
// READ
// ============================================================================

/**
 * Get contracts for an enterprise with optional filters
 */
export const getContracts = query({
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required to view contracts.");
    }

    let queryBuilder = ctx.db
      .query("contracts")
      .withIndex("by_status_and_enterpriseId", (q) => 
        q.eq("enterpriseId", args.enterpriseId)
      );

    // Apply status filter if provided and not "all"
    if (args.status && args.status !== "all") {
      queryBuilder = ctx.db
        .query("contracts")
        .withIndex("by_status_and_enterpriseId", (q) =>
          q.eq("enterpriseId", args.enterpriseId).eq("status", args.status as Exclude<typeof args.status, "all">)
        );
    }

    let contracts = await queryBuilder.order("desc").collect();

    // Apply contract type filter if provided and not "all"
    if (args.contractType && args.contractType !== "all") {
      contracts = contracts.filter(contract => contract.contractType === args.contractType);
    }

    // Enrich contracts with vendor information
    const contractsWithVendors = await Promise.all(
      contracts.map(async (contract) => {
        const vendor = await ctx.db.get(contract.vendorId);
        return {
          ...contract,
          vendor: vendor ? {
            _id: vendor._id,
            name: vendor.name,
            category: vendor.category,
          } : null,
        };
      })
    );

    return contractsWithVendors;
  },
});

/**
 * Get contracts by vendor
 */
export const getContractsByVendor = query({
  args: {
    vendorId: v.id("vendors"),
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required to view contracts.");
    }

    // Verify vendor belongs to enterprise
    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor || vendor.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Vendor not found or access denied.");
    }

    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_vendorId_and_enterpriseId", (q) =>
        q.eq("enterpriseId", args.enterpriseId).eq("vendorId", args.vendorId)
      )
      .order("desc")
      .collect();

    // Enrich with vendor information
    const contractsWithVendor = contracts.map(contract => ({
      ...contract,
      vendor: {
        _id: vendor._id,
        name: vendor.name,
        category: vendor.category,
      },
    }));

    return contractsWithVendor;
  },
});

/**
 * Get a single contract by ID
 */
export const getContractById = query({
  args: {
    contractId: v.id("contracts"),
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required to view contract details.");
    }

    const contract = await ctx.db.get(args.contractId);
    if (!contract) {
      return null;
    }

    // Security check: ensure contract belongs to the enterprise
    if (contract.enterpriseId !== args.enterpriseId) {
      console.warn(`User attempted to access contract ${args.contractId} not belonging to their enterprise ${args.enterpriseId}.`);
      return null;
    }

    // Get vendor information
    const vendor = await ctx.db.get(contract.vendorId);

    return {
      ...contract,
      vendor: vendor ? {
        _id: vendor._id,
        name: vendor.name,
        category: vendor.category,
        contactEmail: vendor.contactEmail,
        contactPhone: vendor.contactPhone,
      } : null,
    };
  },
});

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Update contract details
 */
export const updateContract = mutation({
  args: {
    contractId: v.id("contracts"),
    enterpriseId: v.id("enterprises"),
    title: v.optional(v.string()),
    status: v.optional(
      v.union(...contractStatusOptions.map(option => v.literal(option)))
    ),
    contractType: v.optional(
      v.union(...contractTypeOptions.map(option => v.literal(option)))
    ),
    notes: v.optional(v.string()),
    // Allow updating extracted fields if needed
    extractedParties: v.optional(v.array(v.string())),
    extractedStartDate: v.optional(v.string()),
    extractedEndDate: v.optional(v.string()),
    extractedPaymentSchedule: v.optional(v.string()),
    extractedPricing: v.optional(v.string()),
    extractedScope: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to update a contract.");
    }

    const existingContract = await ctx.db.get(args.contractId);
    if (!existingContract) {
      throw new ConvexError(`Contract not found with ID: ${args.contractId}`);
    }

    // Security check: ensure user is updating a contract within their enterprise
    if (existingContract.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Permission denied: You do not have permission to update this contract.");
    }

    const { contractId, enterpriseId, ...updates } = args;

    // Validate title if provided
    if (updates.title !== undefined && updates.title.trim() === "") {
      throw new ConvexError("Validation Error: Contract title cannot be empty.");
    }
    if (updates.title) {
      updates.title = updates.title.trim();
    }

    // Trim notes if provided
    if (updates.notes) {
      updates.notes = updates.notes.trim();
    }

    // Remove undefined values
    (Object.keys(updates) as Array<keyof typeof updates>).forEach(key => {
      if (updates[key] === undefined) {
        delete updates[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      console.log("No fields provided to update for contract:", contractId);
      return { success: true, message: "No fields provided to update." };
    }

    await ctx.db.patch(args.contractId, updates);

    console.log(`Contract updated with ID: ${args.contractId}. Updates applied:`, updates);
    return { success: true };
  },
});

// ============================================================================
// DELETE
// ============================================================================

/**
 * Delete a contract
 */
export const deleteContract = mutation({
  args: {
    contractId: v.id("contracts"),
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to delete a contract.");
    }

    const existingContract = await ctx.db.get(args.contractId);
    if (!existingContract) {
      throw new ConvexError(`Contract not found with ID: ${args.contractId}`);
    }

    // Security check: ensure user is deleting a contract within their enterprise
    if (existingContract.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Permission denied: You do not have permission to delete this contract.");
    }

    // Delete the associated file from storage
    try {
      await ctx.storage.delete(existingContract.storageId);
    } catch (error) {
      console.warn(`Failed to delete file for contract ${args.contractId}:`, error);
      // Continue with contract deletion even if file deletion fails
    }

    // Delete the contract
    await ctx.db.delete(args.contractId);

    console.log(`Contract deleted with ID: ${args.contractId} from enterprise ${args.enterpriseId}`);
    return { success: true };
  },
});

// ============================================================================
// ANALYSIS (Internal Actions)
// ============================================================================

/**
 * Analyze contract content (can be called by agents or manually)
 */
export const analyzeContract = action({
  args: {
    contractId: v.id("contracts"),
  },
  handler: async (ctx, args) => {
    try {
      // Get the contract directly
      const contract = await ctx.runQuery(api.contracts.getContractForAnalysis, {
        contractId: args.contractId,
      });

      if (!contract) {
        throw new Error("Contract not found for analysis");
      }

      // Update status to processing
      await ctx.runMutation(api.contracts.updateAnalysisStatus, {
        contractId: args.contractId,
        status: "processing",
      });

      // Get file content
      const fileUrl = await ctx.storage.getUrl(contract.storageId);
      if (!fileUrl) {
        throw new Error("Could not get file URL for analysis");
      }

      // Simulate contract analysis (replace with actual AI/ML analysis)
      const analysisResult = await simulateContractAnalysis(fileUrl, contract);

      // Update contract with analysis results
      await ctx.runMutation(api.contracts.updateAnalysisResults, {
        contractId: args.contractId,
        analysisResult,
      });

      console.log(`Contract analysis completed for contract ${args.contractId}`);

    } catch (error) {
      console.error(`Contract analysis failed for contract ${args.contractId}:`, error);
      
      // Update status to failed
      await ctx.runMutation(api.contracts.updateAnalysisStatus, {
        contractId: args.contractId,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});

// ============================================================================
// INTERNAL HELPERS (for analysis workflow)
// ============================================================================

export const getContractForAnalysis = query({
  args: {
    contractId: v.id("contracts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.contractId);
  },
});

export const updateAnalysisStatus = mutation({
  args: {
    contractId: v.id("contracts"),
    status: v.union(...analysisStatusOptions.map(option => v.literal(option))),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      analysisStatus: args.status,
    };

    if (args.error) {
      updates.analysisError = args.error;
    } else if (args.status === "processing") {
      // Clear any previous error when starting processing
      updates.analysisError = undefined;
    }

    await ctx.db.patch(args.contractId, updates);
  },
});

export const updateAnalysisResults = mutation({
  args: {
    contractId: v.id("contracts"),
    analysisResult: v.object({
      extractedParties: v.optional(v.array(v.string())),
      extractedStartDate: v.optional(v.string()),
      extractedEndDate: v.optional(v.string()),
      extractedPaymentSchedule: v.optional(v.string()),
      extractedPricing: v.optional(v.string()),
      extractedScope: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contractId, {
      analysisStatus: "completed",
      analysisError: undefined,
      status: "active", // Move to active status after successful analysis
      ...args.analysisResult,
    });
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Simulate contract analysis (replace with actual AI/ML integration)
 */
async function simulateContractAnalysis(fileUrl: string, contract: any): Promise<{
  extractedParties?: string[];
  extractedStartDate?: string;
  extractedEndDate?: string;
  extractedPaymentSchedule?: string;
  extractedPricing?: string;
  extractedScope?: string;
}> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Mock analysis results based on contract type and filename
  const mockResults: any = {};

  // Extract parties (mock)
  mockResults.extractedParties = [
    "Acme Corp", // Your company
    contract.vendor?.name || "Vendor Name"
  ];

  // Mock dates based on current date
  const startDate = new Date();
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 1); // 1 year contract

  mockResults.extractedStartDate = startDate.toISOString().split('T')[0];
  mockResults.extractedEndDate = endDate.toISOString().split('T')[0];

  // Mock pricing based on contract type
  const pricingMap: Record<string, string> = {
    saas: "$500/month",
    nda: "No fees",
    msa: "$10,000",
    sow: "$25,000",
    lease: "$2,000/month",
    employment: "$75,000/year",
    partnership: "Revenue share: 30%",
    other: "$5,000"
  };

  mockResults.extractedPricing = pricingMap[contract.contractType] || "$1,000";

  // Mock payment schedule
  const paymentMap: Record<string, string> = {
    saas: "Monthly recurring payment due on the 1st of each month",
    msa: "Net 30 payment terms",
    sow: "50% upfront, 50% on completion",
    lease: "Monthly payment due on the 1st",
    employment: "Bi-weekly salary payments",
    partnership: "Quarterly revenue sharing",
    other: "Payment due within 30 days"
  };

  mockResults.extractedPaymentSchedule = paymentMap[contract.contractType] || "Net 30 payment terms";

  // Mock scope
  const scopeMap: Record<string, string> = {
    saas: "Software as a Service platform access and support",
    nda: "Confidentiality obligations for proprietary information",
    msa: "General terms for ongoing professional services",
    sow: "Specific project deliverables and milestones",
    lease: "Office space rental and facilities usage",
    employment: "Full-time employment terms and conditions",
    partnership: "Strategic partnership and collaboration terms",
    other: "General business agreement terms"
  };

  mockResults.extractedScope = scopeMap[contract.contractType] || "General business services";

  return mockResults;
}

// ============================================================================
// UTILITY QUERIES
// ============================================================================

/**
 * Get contract statistics for an enterprise
 */
export const getContractStats = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required to view contract statistics.");
    }

    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_status_and_enterpriseId", (q) => 
        q.eq("enterpriseId", args.enterpriseId)
      )
      .collect();

    const stats = {
      total: contracts.length,
      byStatus: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      byAnalysisStatus: {} as Record<string, number>,
      recentlyCreated: 0,
    };

    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    contracts.forEach(contract => {
      // Count by status
      stats.byStatus[contract.status] = (stats.byStatus[contract.status] || 0) + 1;

      // Count by type
      const type = contract.contractType || "other";
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Count by analysis status
      const analysisStatus = contract.analysisStatus || "pending";
      stats.byAnalysisStatus[analysisStatus] = (stats.byAnalysisStatus[analysisStatus] || 0) + 1;

      // Count recently created
      if (contract._creationTime && contract._creationTime > oneWeekAgo) {
        stats.recentlyCreated++;
      }
    });

    return stats;
  },
});