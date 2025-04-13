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

// Type alias for the contract status literal union
type ContractStatus = typeof contractStatusOptions[number];
// Type alias for the analysis status literal union
type AnalysisStatus = typeof analysisStatusOptions[number];

// ============================================================================
// CREATE (includes file upload initiation)
// ============================================================================

/**
 * 1. Generate a URL for the client to upload a file directly to Convex storage.
 * Requires authentication.
 */
export const generateUploadUrl = mutation({
  args: {}, // No arguments needed for a simple upload URL
  handler: async (ctx) => {
    // Authentication Check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to upload files.");
    }
    // Generate and return the URL
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return uploadUrl;
  },
});

/**
 * 2. Creates a new contract record AFTER the file has been uploaded.
 * Links the contract to a vendor and the uploaded file (storageId).
 * Schedules the analysis action.
 * Requires authentication.
 */
export const createContract = mutation({
  args: {
    // Required fields
    vendorId: v.id("vendors"),
    title: v.string(),
    storageId: v.id("_storage"), // The ID returned by the client after successful upload
    fileName: v.string(),
    fileType: v.string(),
    // Optional initial status (defaults to 'pending_analysis' if not provided)
    status: v.optional(v.union(
        v.literal(contractStatusOptions[0]), v.literal(contractStatusOptions[1]),
        v.literal(contractStatusOptions[2]), v.literal(contractStatusOptions[3]),
        v.literal(contractStatusOptions[4]), v.literal(contractStatusOptions[5])
    )),
    // Optional notes
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Authentication Check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to create a contract.");
    }
    // Optional: Get userId if scoping contracts per user
    // const userId = identity.subject;

    // 2. Validation
    if (!args.title || args.title.trim() === "") {
        throw new ConvexError("Validation Error: Contract title cannot be empty.");
    }
     // Check if the referenced vendor exists
    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor) {
        throw new ConvexError(`Validation Error: Vendor with ID ${args.vendorId} not found.`);
    }

    // 3. Prepare Contract Data
    const contractData = {
      vendorId: args.vendorId,
      title: args.title.trim(),
      status: args.status || "pending_analysis", // Default status
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      analysisStatus: "pending", // Initial analysis status
      notes: args.notes || undefined,
      // Optional: Add userId for ownership
      // userId: userId,
      // Extracted fields are initially null/undefined
      extractedParties: undefined,
      extractedStartDate: undefined,
      extractedEndDate: undefined,
      extractedPaymentSchedule: undefined,
      extractedPricing: undefined,
      extractedScope: undefined,
      analysisError: undefined,
    };
    // 4. Create Contract Record
    const contractId = await ctx.db.insert("contracts", {
      ...contractData,
      analysisStatus: "pending" as const
    });

    // 5. Schedule Analysis Action
    //    Run immediately after commit (delay 0)
    await ctx.scheduler.runAfter(0, api.contracts.analyzeContract, {
        contractId: contractId,
        storageId: args.storageId,
    });

    console.log(`Contract created with ID: ${contractId}, analysis scheduled.`);
    return contractId;
  },
});

// ============================================================================
// READ
// ============================================================================

/**
 * Retrieves all contracts associated with a specific vendor.
 * Requires authentication.
 */
export const getContractsByVendor = query({
  args: {
    vendorId: v.id("vendors"),
  },
  handler: async (ctx, args) => {
    // 1. Authentication Check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required to view contracts.");
    }
    // Optional: If scoping contracts by user, add filter here

    // 2. Fetch Contracts
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_vendorId", (q) => q.eq("vendorId", args.vendorId))
      .order("desc") // Order by creation time (most recent first)
      .collect();

    return contracts;
  },
});

/**
 * Retrieves a single contract by its ID.
 * Requires authentication.
 */
export const getContractById = query({
  args: {
    contractId: v.id("contracts"),
  },
  handler: async (ctx, args) => {
    // 1. Authentication Check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required to view contract details.");
    }
    // Optional: Check if user owns/has access to this specific contract

    // 2. Fetch Contract
    const contract = await ctx.db.get(args.contractId);

    // 3. Handle Not Found
    if (!contract) {
      return null; // Or throw new ConvexError("Contract not found");
    }

    return contract;
  },
});

/**
 * Retrieves the download/view URL for a contract's file using its storageId.
 * Requires authentication.
 */
export const getContractFileUrl = query({
    args: {
        storageId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        // 1. Authentication Check
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError("Authentication required to get file URL.");
        }
        // Optional: Add fine-grained access check based on who owns the contract associated with this storageId

        // 2. Get URL
        const url = await ctx.storage.getUrl(args.storageId);

        if (!url) {
            // This could happen if the file was deleted or never existed.
            console.error(`Failed to get URL for storageId: ${args.storageId}`);
            return null;
        }

        return url;
    }
});

/**
 * Retrieves all contracts in the system.
 * Requires authentication.
 */
export const getContracts = query({
  args: {}, // No arguments needed
  handler: async (ctx) => {
    // 1. Authentication Check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required to view contracts.");
    }
    // Optional: If scoping contracts by user, add filter here

    // 2. Fetch All Contracts
    const contracts = await ctx.db
      .query("contracts")
      .order("desc") // Order by creation time (most recent first)
      .collect();

    // 3. Fetch Vendor Data for Each Contract
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
          vendor: vendor || { name: "Unknown Vendor" }
        };
      })
    );

    return contractsWithVendors;
  },
});



// ============================================================================
// UPDATE
// ============================================================================

/**
 * Updates mutable fields of an existing contract record.
 * Typically used for changing title, status, or notes.
 * Avoid using this to update file info or analysis results directly.
 * Requires authentication.
 */
export const updateContract = mutation({
  args: {
    // Required ID of the contract to update
    contractId: v.id("contracts"),
    // Optional fields to update
    title: v.optional(v.string()),
    status: v.optional(v.union(
        v.literal(contractStatusOptions[0]), v.literal(contractStatusOptions[1]),
        v.literal(contractStatusOptions[2]), v.literal(contractStatusOptions[3]),
        v.literal(contractStatusOptions[4]), v.literal(contractStatusOptions[5])
    )),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Authentication Check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to update a contract.");
    }
    // Optional: Check ownership if scoping by user

    // 2. Fetch Existing Contract
    const existingContract = await ctx.db.get(args.contractId);
    if (!existingContract) {
        throw new ConvexError(`Contract not found with ID: ${args.contractId}`);
    }
    // Optional: Ownership check here

    // 3. Prepare Updates
    const { contractId, ...updates } = args; // Exclude contractId from updates

    // Basic Validation: Ensure title isn't updated to empty string if provided
    if (updates.title !== undefined && updates.title.trim() === "") {
        throw new ConvexError("Validation Error: Contract title cannot be empty.");
    }
    if(updates.title) updates.title = updates.title.trim();

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

    // 4. Apply Updates
    await ctx.db.patch(contractId, updates);

    console.log(`Contract updated with ID: ${contractId}. Updates applied:`, updates);
    return { success: true };
  },
});


// ============================================================================
// DELETE
// ============================================================================

/**
 * Deletes a contract record AND its associated file from storage.
 * Requires authentication.
 */
export const deleteContract = mutation({
  args: {
    contractId: v.id("contracts"),
  },
  handler: async (ctx, args) => {
    // 1. Authentication Check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to delete a contract.");
    }
    // Optional: Check ownership if scoping by user

    // 2. Fetch Existing Contract
    const contract = await ctx.db.get(args.contractId);
    if (!contract) {
        throw new ConvexError(`Contract not found with ID: ${args.contractId}`);
    }
    // Optional: Ownership check here

    // 3. Delete Associated File from Storage
    //    Attempt this first. If it fails, we won't delete the DB record.
    try {
        await ctx.storage.delete(contract.storageId);
        console.log(`Deleted file from storage with storageId: ${contract.storageId}`);
    } catch (error) {
        console.error(`Failed to delete file from storage (storageId: ${contract.storageId}):`, error);
        // Decide if you want to proceed with DB deletion or throw an error.
        // Throwing an error is safer as it indicates an incomplete delete.
        throw new ConvexError(`Failed to delete associated file from storage. Database record not deleted. Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 4. Delete Contract Record from Database
    await ctx.db.delete(args.contractId);

    console.log(`Contract record deleted from DB with ID: ${args.contractId}`);
    return { success: true };
  },
});


// ============================================================================
// ANALYSIS ACTION and related INTERNAL MUTATION (Copied from initial example)
// ============================================================================

/**
 * INTERNAL MUTATION: Updates contract with analysis results or status.
 * Should only be called internally by the `analyzeContract` action.
 */
export const updateContractAnalysis = mutation({
    // Make internal to prevent client-side calls if desired
    // access: internal,
    args: {
      contractId: v.id("contracts"),
      analysisStatus: v.union(
        v.literal(analysisStatusOptions[1]), // processing
        v.literal(analysisStatusOptions[2]), // completed
        v.literal(analysisStatusOptions[3])  // failed
      ),
      extractedData: v.optional(v.object({ // Structure matching schema optional fields
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
       // Internal mutations skip user auth checks as they are called by trusted backend code
       const { contractId, ...patchData } = args;
       await ctx.db.patch(contractId, patchData);
    },
});

/**
 * ACTION: Performs the analysis of the contract file content.
 * Fetches the file, attempts to extract text/data (using placeholders here),
 * and calls the internal mutation `updateContractAnalysis` to store results.
 */
export const analyzeContract = action({
  args: {
    contractId: v.id("contracts"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx: ActionCtx, args: {
    [x: string]: any; contractId: Id<"contracts">, storageId: Id<"_storage"> 
}) => {
    console.log(`[Action] Starting analysis for contract ${args.contractId}`);

    // 1. Mark as processing
    await ctx.runMutation(api.contracts.updateContractAnalysis, {
      contractId: args.contractId,
      analysisStatus: "processing",
    });

    try {
      // 2. Get the file content (simplified placeholder logic)
      const fileUrl = await ctx.storage.getUrl(args.storageId);
      if (!fileUrl) throw new Error("File URL not found.");
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
      const fileBlob = await response.blob();
      let textContent = `Placeholder text for file type: ${fileBlob.type}. Full analysis requires external APIs or libraries.`;

      // TODO: Replace placeholder logic with actual text extraction (e.g., pdf-parse)
      //       and data extraction (e.g., OpenAI API call, AWS Textract, etc.)
      console.log(`[Action] Extracted text (placeholder): ${textContent.substring(0, 100)}...`);

      // 3. Perform Analysis (Placeholder Data)
      //    Replace this with your actual analysis results.
      const extractedData = {
           extractedParties: ["Placeholder Party A", "Placeholder Party B", `${args.fileName}`],
           extractedStartDate: "2024-01-01",
           extractedEndDate: "2024-12-31",
           extractedPaymentSchedule: "Monthly Net 30 (Placeholder)",
           extractedPricing: "$1000/month (Placeholder)",
           extractedScope: `Placeholder scope extracted from ${args.fileName}. Analysis depends on content.`,
      };
      console.log("[Action] Using placeholder extraction data:", extractedData);


      // 4. Update the contract record with results
      await ctx.runMutation(api.contracts.updateContractAnalysis, {
        contractId: args.contractId,
        analysisStatus: "completed",
        extractedData: extractedData,
      });
      console.log(`[Action] Analysis completed successfully for contract ${args.contractId}`);

    } catch (error: any) {
      console.error(`[Action] Analysis failed for contract ${args.contractId}:`, error);
      // 5. Update the contract record with error status
      await ctx.runMutation(api.contracts.updateContractAnalysis, {
        contractId: args.contractId,
        analysisStatus: "failed",
        analysisError: error.message || "Unknown analysis error",
      });
    }
  },
});


