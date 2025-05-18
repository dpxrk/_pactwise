// convex/vendors.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel"; // Ensure Id is imported
import { ConvexError } from "convex/values";
import { api } from "./_generated/api"; // Needed for checking contracts on delete

// Define the vendor category options (mirroring schema.ts for validation consistency)
// This ensures that the values passed from the client match what the schema expects.
const vendorCategoryOptions = [
  "technology", "marketing", "legal", "finance", "hr",
  "facilities", "logistics", "manufacturing", "consulting", "other"
] as const;
// Optional: export type VendorCategory = typeof vendorCategoryOptions[number];
// This type can be useful if you need to reference it elsewhere in the backend,
// though for args validation, v.union with v.literal is typically used directly.

// ============================================================================
// CREATE
// ============================================================================
export const createVendor = mutation({
  args: {
    // --- REQUIRED: enterpriseId to scope the vendor ---
    enterpriseId: v.id("enterprises"),
    // Required field for vendor name
    name: v.string(),
    // Optional fields based on your schema
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    website: v.optional(v.string()),
    // --- NEW: Optional category field ---
    category: v.optional(
      v.union(
        ...vendorCategoryOptions.map(option => v.literal(option))
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to create a vendor.");
    }
    // Optional: Further validation - check if the user (identity.subject)
    // belongs to the provided args.enterpriseId if you store user-enterprise relationships.

    if (!args.name || args.name.trim() === "") {
        throw new ConvexError("Validation Error: Vendor name cannot be empty.");
    }
    // Optional: Validate enterpriseId exists
    // const enterprise = await ctx.db.get(args.enterpriseId);
    // if (!enterprise) {
    //   throw new ConvexError(`Enterprise with ID ${args.enterpriseId} not found.`);
    // }

    const vendorId = await ctx.db.insert("vendors", {
      enterpriseId: args.enterpriseId, // Store the enterpriseId
      name: args.name.trim(),
      contactEmail: args.contactEmail || undefined,
      contactPhone: args.contactPhone || undefined,
      address: args.address || undefined,
      notes: args.notes || undefined,
      website: args.website || undefined,
      category: args.category || undefined, // Store the category
    });

    console.log(`Vendor created with ID: ${vendorId} for enterprise ${args.enterpriseId}`);
    return vendorId;
  },
});

// ============================================================================
// READ
// ============================================================================
export const getVendors = query({
  args: {
    // --- REQUIRED: enterpriseId to fetch vendors for a specific enterprise ---
    enterpriseId: v.id("enterprises"),
    // --- NEW: Optional filter by category ---
    category: v.optional(
      v.union(
        ...vendorCategoryOptions.map(option => v.literal(option)),
        v.literal("all") // Special value to fetch all categories for the enterprise
      )
    ),
    // You could add other filters like status, searchTerm, etc.
    // status: v.optional(v.string()),
    // searchTerm: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required to view vendors.");
    }
    // Optional: Validate user's access to this enterpriseId

    // Base query for the enterprise
    let queryBuilder = ctx.db
      .query("vendors")
      .withIndex("by_enterpriseId", (q) => q.eq("enterpriseId", args.enterpriseId));

    // Apply category filter if provided and not "all"
    if (args.category && args.category !== "all") {
        // This requires a composite index on ["enterpriseId", "category"]
        // The index name "by_category_and_enterprise" must match your schema.ts
        queryBuilder = ctx.db
          .query("vendors")
          .withIndex("by_category_and_enterpriseId", (q) =>
            q.eq("enterpriseId", args.enterpriseId).eq("category", args.category as Exclude<typeof args.category, "all">)
          );
    }

  
    const vendors = await queryBuilder.order("asc").collect(); // Orders by name ascending due to index order

    // Optionally, enrich vendors with contract counts or other related data
    // Be mindful of N+1 query performance if doing this for many vendors.
    const vendorsWithDetails = await Promise.all(
        vendors.map(async (vendor) => {
            const contracts = await ctx.db
                .query("contracts")
                // Assuming index on ["enterpriseId", "vendorId"] exists as "by_vendorId_and_enterpriseId"
                .withIndex("by_vendorId_and_enterpriseId", q => q.eq("enterpriseId", args.enterpriseId).eq("vendorId", vendor._id))
                .collect();
            return { ...vendor, contractCount: contracts.length };
        })
    );

    return vendorsWithDetails;
  },
});

export const getVendorById = query({
  args: {
    vendorId: v.id("vendors"),
    // --- REQUIRED: enterpriseId for access control and context ---
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
        throw new ConvexError("Authentication required to view vendor details.");
    }

    const vendor = await ctx.db.get(args.vendorId);

    if (!vendor) {
      return null;
    }

    // --- Security Check: Ensure the fetched vendor belongs to the specified enterprise ---
    if (vendor.enterpriseId !== args.enterpriseId) {
      // You might want to log this attempt or handle it more silently
      console.warn(`User attempted to access vendor ${args.vendorId} not belonging to their enterprise ${args.enterpriseId}.`);
      return null; // Or throw new ConvexError("Access denied to this vendor.");
    }

    // Optionally, fetch related data like contracts for this vendor
    const contracts = await ctx.db
        .query("contracts")
        .withIndex("by_vendorId_and_enterpriseId", q => q.eq("enterpriseId", args.enterpriseId).eq("vendorId", vendor._id))
        .collect();

    return { ...vendor, contracts }; // Return vendor with its contracts
  },
});

// ============================================================================
// UPDATE
// ============================================================================
export const updateVendor = mutation({
  args: {
    vendorId: v.id("vendors"),
    // --- REQUIRED: enterpriseId for permission check ---
    enterpriseId: v.id("enterprises"),
    // Optional fields to update (matching schema)
    name: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    website: v.optional(v.string()),
    // --- NEW: Allow updating category ---
    category: v.optional(
      v.union(
        ...vendorCategoryOptions.map(option => v.literal(option))
      )
    ),
    // Add other updatable fields like status or riskLevel here if they are in your schema
    // status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to update a vendor.");
    }

    const existingVendor = await ctx.db.get(args.vendorId);
    if (!existingVendor) {
        throw new ConvexError(`Vendor not found with ID: ${args.vendorId}`);
    }

    // --- Security Check: Ensure user is updating a vendor within their enterprise ---
    if (existingVendor.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Permission denied: You do not have permission to update this vendor.");
    }

    const { vendorId, enterpriseId: _enterpriseId, ...updates } = args;

    if (updates.name !== undefined && updates.name.trim() === "") {
        throw new ConvexError("Validation Error: Vendor name cannot be empty.");
    }
    if(updates.name) updates.name = updates.name.trim();

    // Remove undefined values so patch only applies provided fields
    (Object.keys(updates) as Array<keyof typeof updates>).forEach(key => {
      if (updates[key] === undefined) {
        delete updates[key];
      }
    });

    if (Object.keys(updates).length === 0) {
        console.log("No fields provided to update for vendor:", vendorId);
        return { success: true, message: "No fields provided to update." };
    }

    await ctx.db.patch(args.vendorId, updates);

    console.log(`Vendor updated with ID: ${args.vendorId}. Updates applied:`, updates);
    return { success: true };
  },
});

// ============================================================================
// DELETE
// ============================================================================
export const deleteVendor = mutation({
  args: {
    vendorId: v.id("vendors"),
    // --- REQUIRED: enterpriseId for permission check ---
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to delete a vendor.");
    }

    const existingVendor = await ctx.db.get(args.vendorId);
    if (!existingVendor) {
        throw new ConvexError(`Vendor not found with ID: ${args.vendorId}`);
    }

    // --- Security Check: Ensure user is deleting a vendor within their enterprise ---
    if (existingVendor.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Permission denied: You do not have permission to delete this vendor.");
    }

    // Check for Associated Contracts (Safety Check within the correct enterprise)
    const associatedContracts = await ctx.db
      .query("contracts")
      .withIndex("by_vendorId_and_enterpriseId", (q) => // Use the composite index
          q.eq("enterpriseId", args.enterpriseId).eq("vendorId", args.vendorId)
      )
      .collect();

    if (associatedContracts.length > 0) {
        throw new ConvexError(
            `Cannot delete vendor: This vendor has ${associatedContracts.length} associated contract(s). Please delete or reassign the contracts first.`
        );
    }

    await ctx.db.delete(args.vendorId);

    console.log(`Vendor deleted with ID: ${args.vendorId} from enterprise ${args.enterpriseId}`);
    return { success: true };
  },
});