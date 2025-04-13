// convex/vendors.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api"; // Needed for checking contracts on delete

// ============================================================================
// CREATE
// ============================================================================

/**
 * Creates a new vendor record.
 * Requires authentication.
 */
export const createVendor = mutation({
  args: {
    // Required field
    name: v.string(),
    // Optional fields based on simplified schema
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Authentication Check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to create a vendor.");
    }
    // Optional: Get userId if you plan to scope vendors per user
    // const userId = identity.subject;

    // 2. Validation (Basic)
    if (!args.name || args.name.trim() === "") {
        throw new ConvexError("Validation Error: Vendor name cannot be empty.");
    }
    // Add more specific validation if needed (e.g., email format)

    // 3. Create Vendor
    const vendorId = await ctx.db.insert("vendors", {
      name: args.name.trim(), // Trim whitespace
      contactEmail: args.contactEmail || undefined,
      contactPhone: args.contactPhone || undefined,
      address: args.address || undefined,
      notes: args.notes || undefined,
      website: args.website || undefined,
      // Optional: Assign ownership if scoping by user
      // userId: userId,
    });

    console.log(`Vendor created with ID: ${vendorId}`);
    return vendorId; // Return the ID of the newly created vendor
  },
});

// ============================================================================
// READ
// ============================================================================

/**
 * Retrieves a list of all vendors.
 * Returns an empty list if the user is not authenticated or if no vendors exist.
 * Consider adding user-specific filtering if scoping vendors by user.
 */
export const getVendors = query({
  args: {}, // No arguments needed to get all
  handler: async (ctx) => {
    // 1. Authentication Check (Optional for public read, Recommended for restricted)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Decide behavior: return empty list or throw error
      // console.log("No user authenticated, returning empty vendor list.");
      // return [];
      throw new ConvexError("Authentication required to view vendors.");
    }
    // Optional: Get userId if filtering by user
    // const userId = identity.subject;

    // 2. Fetch Vendors
    const vendors = await ctx.db
      .query("vendors")
      // Optional: Filter by user if implementing multi-tenancy
      // .withIndex("by_user", (q) => q.eq("userId", userId))
      //@ts-expect-error
      .withIndex("by_name", (q) => q.eq("name", q.asc())) // Order alphabetically by name
      // .order("desc") // Or order by creation time (default index)
      .collect();

    return vendors;
  },
});

/**
 * Retrieves a single vendor by its ID.
 * Returns null if the vendor is not found or if the user lacks permission (if scoped).
 * Requires authentication.
 */
export const getVendorById = query({
  args: {
    vendorId: v.id("vendors"), // Expect the Convex ID for the vendor
  },
  handler: async (ctx, args) => {
    // 1. Authentication Check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
        throw new ConvexError("Authentication required to view vendor details.");
    }
     // Optional: Get userId if filtering by user
    // const userId = identity.subject;

    // 2. Fetch Vendor
    const vendor = await ctx.db.get(args.vendorId);

    // 3. Handle Not Found / Permissions (if user-scoped)
    if (!vendor) {
      return null; // Or throw new ConvexError("Vendor not found");
    }

    // Optional: Check ownership if scoping by user
    // if (vendor.userId !== userId) {
    //   console.warn(`User ${userId} attempted to access vendor ${args.vendorId} owned by ${vendor.userId}`);
    //   throw new ConvexError("Permission denied: You do not have access to this vendor.");
    // }

    return vendor;
  },
});


// ============================================================================
// UPDATE
// ============================================================================

/**
 * Updates an existing vendor record.
 * Only updates the fields provided in the arguments.
 * Requires authentication and ownership (if scoped by user).
 */
export const updateVendor = mutation({
  args: {
    // Required ID of the vendor to update
    vendorId: v.id("vendors"),
    // Optional fields to update (matching schema)
    name: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Authentication Check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to update a vendor.");
    }
     // Optional: Get userId if filtering by user
    // const userId = identity.subject;

    // 2. Fetch Existing Vendor & Check Permissions
    const existingVendor = await ctx.db.get(args.vendorId);
    if (!existingVendor) {
        throw new ConvexError(`Vendor not found with ID: ${args.vendorId}`);
    }

    // Optional: Check ownership if scoping by user
    // if (existingVendor.userId !== userId) {
    //   throw new ConvexError("Permission denied: You do not have permission to update this vendor.");
    // }

    // 3. Prepare Updates
    const { vendorId, ...updates } = args; // Exclude vendorId from the updates object

     // Basic Validation: Ensure name isn't updated to empty string if provided
    if (updates.name !== undefined && updates.name.trim() === "") {
        throw new ConvexError("Validation Error: Vendor name cannot be empty.");
    }
    if(updates.name) updates.name = updates.name.trim(); // Trim if provided
    // Remove undefined values so patch only applies provided fields
    (Object.keys(updates) as Array<keyof typeof updates>).forEach(key => {
      if (updates[key] === undefined) {
        delete updates[key];
      }
    });

    if (Object.keys(updates).length === 0) {
        // No actual updates provided besides the ID
        console.log("No fields provided to update for vendor:", vendorId);
        return { success: true, message: "No fields provided to update." };
    }

    // 4. Apply Updates
    await ctx.db.patch(vendorId, updates);

    console.log(`Vendor updated with ID: ${vendorId}. Updates applied:`, updates);
    return { success: true };
  },
});


// ============================================================================
// DELETE
// ============================================================================

/**
 * Deletes a vendor record.
 * Requires authentication and ownership (if scoped by user).
 * **Important:** By default, this prevents deletion if the vendor has associated contracts.
 */
export const deleteVendor = mutation({
  args: {
    vendorId: v.id("vendors"),
  },
  handler: async (ctx, args) => {
    // 1. Authentication Check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to delete a vendor.");
    }
     // Optional: Get userId if filtering by user
    // const userId = identity.subject;

    // 2. Fetch Existing Vendor & Check Permissions
    const existingVendor = await ctx.db.get(args.vendorId);
    if (!existingVendor) {
        throw new ConvexError(`Vendor not found with ID: ${args.vendorId}`);
    }

    // Optional: Check ownership if scoping by user
    // if (existingVendor.userId !== userId) {
    //   throw new ConvexError("Permission denied: You do not have permission to delete this vendor.");
    // }

    // 3. Check for Associated Contracts (Safety Check)
    const associatedContracts = await ctx.db
      .query("contracts")
      .withIndex("by_vendorId", (q) => q.eq("vendorId", args.vendorId))
      .collect(); // Fetch all associated contracts

    if (associatedContracts.length > 0) {
        throw new ConvexError(
            `Cannot delete vendor: This vendor has ${associatedContracts.length} associated contract(s). Please delete or reassign the contracts first.`
        );
        // Alternative (Dangerous): Implement cascade delete if needed.
        // for (const contract of associatedContracts) {
        //   await ctx.storage.delete(contract.storageId); // Delete file
        //   await ctx.db.delete(contract._id); // Delete contract record
        // }
    }

    // 4. Delete Vendor
    await ctx.db.delete(args.vendorId);

    console.log(`Vendor deleted with ID: ${args.vendorId}`);
    return { success: true };
  },
});