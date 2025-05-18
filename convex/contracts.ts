// convex/contracts.ts
import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";

// Define the allowed status options based on the simplified schema
const contractStatusOptions = [
  "draft",
  "pending_analysis",
  "active",
  "expired",
  "terminated",
  "archived",
] as const;

// Define the allowed analysis status options based on the simplified schema
const analysisStatusOptions = [
    "pending",
    "processing",
    "completed",
    "failed",
] as const;

type ContractStatus = typeof contractStatusOptions[number];
type AnalysisStatus = typeof analysisStatusOptions[number];

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to upload files.");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const createContract = mutation({
  args: {
    // --- ADD enterpriseId AS A REQUIRED ARGUMENT ---
    enterpriseId: v.id("enterprises"), // Assuming you'll have an 'enterprises' table
    // Required fields
    vendorId: v.id("vendors"),
    title: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    status: v.optional(v.union(
        v.literal(contractStatusOptions[0]), v.literal(contractStatusOptions[1]),
        v.literal(contractStatusOptions[2]), v.literal(contractStatusOptions[3]),
        v.literal(contractStatusOptions[4]), v.literal(contractStatusOptions[5])
    )),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to create a contract.");
    }

    if (!args.title || args.title.trim() === "") {
        throw new ConvexError("Validation Error: Contract title cannot be empty.");
    }
    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor) {
        throw new ConvexError(`Validation Error: Vendor with ID ${args.vendorId} not found.`);
    }

    // --- VALIDATE enterpriseId if needed (e.g., check if it exists) ---
    // const enterprise = await ctx.db.get(args.enterpriseId);
    // if (!enterprise) {
    //   throw new ConvexError(`Validation Error: Enterprise with ID ${args.enterpriseId} not found.`);
    // }
    // You might also want to check if the currently authenticated user
    // belongs to this enterprise, if you store that link in Convex.

    const contractData = {
      // --- STORE enterpriseId ---
      enterpriseId: args.enterpriseId,
      vendorId: args.vendorId,
      title: args.title.trim(),
      status: args.status || "pending_analysis",
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      analysisStatus: "pending" as const, // Explicitly type
      notes: args.notes || undefined,
      extractedParties: undefined,
      extractedStartDate: undefined,
      extractedEndDate: undefined,
      extractedPaymentSchedule: undefined,
      extractedPricing: undefined,
      extractedScope: undefined,
      analysisError: undefined,
    };

    const contractId = await ctx.db.insert("contracts", contractData);

    await ctx.scheduler.runAfter(0, api.contracts.analyzeContract, {
        contractId: contractId,
        storageId: args.storageId,
    });

    console.log(`Contract created with ID: ${contractId} for enterprise ${args.enterpriseId}, analysis scheduled.`);
    return contractId;
  },
});

// ... (rest of your contracts.ts file: getContractsByVendor, getContractById, etc.)
// IMPORTANT: Any query/mutation that should be enterprise-specific will also need
// to accept `enterpriseId` as an argument or derive it if you create a Convex `users` table
// that links Clerk users to enterprises.

// Example for getContracts - making it enterprise-specific:
export const getContracts = query({
  args: {
    // --- ADD enterpriseId AS A REQUIRED ARGUMENT ---
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required to view contracts.");
    }

    const contracts = await ctx.db
      .query("contracts")
      // --- FILTER BY enterpriseId ---
      .withIndex("by_enterpriseId", (q) => q.eq("enterpriseId", args.enterpriseId))
      .order("desc")
      .collect();

    const contractsWithVendors = await Promise.all(
      contracts.map(async (contract) => {
        let vendor = null;
        try {
          vendor = await ctx.db.get(contract.vendorId);
        } catch (error) {
          console.error(`Failed to fetch vendor for contract ${contract._id}:`, error);
        }
        return {
          ...contract,
          vendor: vendor || { name: "Unknown Vendor" } // Provide a default/fallback
        };
      })
    );
    return contractsWithVendors;
  },
});

// ... (Rest of the file: analyzeContract, updateContractAnalysis etc. remain the same for now)
// updateContract, deleteContract etc. would also need to check for enterpriseId
// or ensure the user has permission based on their enterprise.
export const getContractsByVendor = query({
    args: {
      vendorId: v.id("vendors"),
      // Optional: If you also want to ensure it's for the correct enterprise
      enterpriseId: v.optional(v.id("enterprises")),
    },
    handler: async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required to view contracts.");
      }
  
      let query = ctx.db
        .query("contracts")
        .withIndex("by_vendorId", (q) => q.eq("vendorId", args.vendorId));
  
      // If enterpriseId is provided, further filter by it.
      // This requires an index on [vendorId, enterpriseId] or querying all by vendorId
      // and then filtering, or ensuring contracts table has an index by_enterprise_and_vendor
      // For simplicity here, we'll fetch by vendorId and if enterpriseId is given, we'd filter results.
      // A more efficient way is to ensure your schema supports this directly.
      // For now, we'll assume getContractsByVendor is called in a context where enterprise is already known
      // or handled at a higher level. If direct enterprise filtering is needed here, the query needs adjustment.
  
      const contracts = await query.order("desc").collect();
  
      // If enterpriseId was passed, filter in code (less efficient but works without schema change)
      if (args.enterpriseId) {
        return contracts.filter(c => c.enterpriseId === args.enterpriseId);
      }
      return contracts;
    },
  });
  
  export const getContractById = query({
    args: {
      contractId: v.id("contracts"),
      // Optional: enterpriseId for an ownership/access check
      enterpriseId: v.optional(v.id("enterprises")),
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
  
      // If enterpriseId is provided, verify the contract belongs to that enterprise
      if (args.enterpriseId && contract.enterpriseId !== args.enterpriseId) {
        // You might want to throw an error or return null based on your security model
        console.warn(`Access denied: Contract ${args.contractId} does not belong to enterprise ${args.enterpriseId}`);
        return null; // Or throw new ConvexError("Access denied to this contract.");
      }
      return contract;
    },
  });
  
  export const getContractFileUrl = query({
      args: {
          storageId: v.id("_storage"),
      },
      handler: async (ctx, args) => {
          const identity = await ctx.auth.getUserIdentity();
          if (!identity) {
              throw new ConvexError("Authentication required to get file URL.");
          }
          const url = await ctx.storage.getUrl(args.storageId);
          if (!url) {
              console.error(`Failed to get URL for storageId: ${args.storageId}`);
              return null;
          }
          return url;
      }
  });
  
  
  export const updateContract = mutation({
    args: {
      contractId: v.id("contracts"),
      enterpriseId: v.optional(v.id("enterprises")), // For permission check
      title: v.optional(v.string()),
      status: v.optional(v.union(
          v.literal(contractStatusOptions[0]), v.literal(contractStatusOptions[1]),
          v.literal(contractStatusOptions[2]), v.literal(contractStatusOptions[3]),
          v.literal(contractStatusOptions[4]), v.literal(contractStatusOptions[5])
      )),
      notes: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required.");
      }
  
      const existingContract = await ctx.db.get(args.contractId);
      if (!existingContract) {
          throw new ConvexError(`Contract not found.`);
      }
  
      // Permission Check: Ensure the user is updating a contract within their enterprise
      if (args.enterpriseId && existingContract.enterpriseId !== args.enterpriseId) {
          throw new ConvexError("Permission denied to update this contract.");
      }
      // If enterpriseId is not passed from client, you might need to fetch it based on user identity
      // or assume the check is done client-side before calling.
  
      const { contractId, enterpriseId: _enterpriseId, ...updates } = args;
      if (updates.title !== undefined && updates.title.trim() === "") {
          throw new ConvexError("Title cannot be empty.");
      }
      if(updates.title) updates.title = updates.title.trim();
  
      (Object.keys(updates) as Array<keyof typeof updates>).forEach(key => {
        if (updates[key] === undefined) delete updates[key];
      });
  
      if (Object.keys(updates).length === 0) {
          return { success: true, message: "No fields to update." };
      }
  
      await ctx.db.patch(contractId, updates);
      return { success: true };
    },
  });
  
  export const deleteContract = mutation({
    args: {
      contractId: v.id("contracts"),
      enterpriseId: v.optional(v.id("enterprises")), // For permission check
    },
    handler: async (ctx, args) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required.");
      }
  
      const contract = await ctx.db.get(args.contractId);
      if (!contract) {
          throw new ConvexError(`Contract not found.`);
      }
  
      if (args.enterpriseId && contract.enterpriseId !== args.enterpriseId) {
          throw new ConvexError("Permission denied to delete this contract.");
      }
  
      try {
          await ctx.storage.delete(contract.storageId);
      } catch (error) {
          console.error(`Failed to delete file from storage (storageId: ${contract.storageId}):`, error);
          throw new ConvexError(`Failed to delete associated file. DB record not deleted.`);
      }
  
      await ctx.db.delete(args.contractId);
      return { success: true };
    },
  });
  
  export const updateContractAnalysis = mutation({
      args: {
        contractId: v.id("contracts"),
        analysisStatus: v.union(
          v.literal(analysisStatusOptions[1]),
          v.literal(analysisStatusOptions[2]),
          v.literal(analysisStatusOptions[3])
        ),
        extractedData: v.optional(v.object({
          extractedParties: v.optional(v.array(v.string())),
          extractedStartDate: v.optional(v.string()),
          extractedEndDate: v.optional(v.string()),
          extractedPaymentSchedule: v.optional(v.string()),
          extractedPricing: v.optional(v.string()),
          extractedScope: v.optional(v.string()),
        })),
        analysisError: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
         const { contractId, ...patchData } = args;
         await ctx.db.patch(contractId, patchData);
      },
  });
  
  export const analyzeContract = action({
    args: {
      contractId: v.id("contracts"),
      storageId: v.id("_storage"),
      // fileName might be useful for context in analysis, but not strictly required by the action's core logic
      fileName: v.optional(v.string()),
    },
    handler: async (ctx: ActionCtx, args: {
       contractId: Id<"contracts">, storageId: Id<"_storage"> , fileName?: string
  }) => {
      console.log(`[Action] Starting analysis for contract ${args.contractId}`);
  
      await ctx.runMutation(api.contracts.updateContractAnalysis, {
        contractId: args.contractId,
        analysisStatus: "processing",
      });
  
      try {
        const fileUrl = await ctx.storage.getUrl(args.storageId);
        if (!fileUrl) throw new Error("File URL not found.");
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
        const fileBlob = await response.blob();
        let textContent = `Placeholder text for file type: ${fileBlob.type}. Full analysis requires external APIs. File: ${args.fileName || 'N/A'}`;
  
        console.log(`[Action] Extracted text (placeholder): ${textContent.substring(0, 100)}...`);
  
        const extractedData = {
             extractedParties: ["Placeholder Party A", "Placeholder Party B", `${args.fileName || 'Unknown File'}`],
             extractedStartDate: "2024-01-01", // Placeholder
             extractedEndDate: "2024-12-31",   // Placeholder
             extractedPaymentSchedule: "Monthly Net 30 (Placeholder)",
             extractedPricing: "$1000/month (Placeholder)",
             extractedScope: `Placeholder scope for ${args.fileName || 'the document'}. Analysis depends on actual content.`,
        };
        console.log("[Action] Using placeholder extraction data:", extractedData);
  
        await ctx.runMutation(api.contracts.updateContractAnalysis, {
          contractId: args.contractId,
          analysisStatus: "completed",
          extractedData: extractedData,
        });
        console.log(`[Action] Analysis completed for contract ${args.contractId}`);
  
      } catch (error: any) {
        console.error(`[Action] Analysis failed for contract ${args.contractId}:`, error);
        await ctx.runMutation(api.contracts.updateContractAnalysis, {
          contractId: args.contractId,
          analysisStatus: "failed",
          analysisError: error.message || "Unknown analysis error",
        });
      }
    },
  });