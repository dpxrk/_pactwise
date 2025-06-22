// convex/vendors.ts
import { query, mutation } from "../../_generated/server";
import { v } from "convex/values";
import { Id } from "../../_generated/dataModel"; 
import { ConvexError } from "convex/values";
import { api } from "../../_generated/api";
import { VendorFilters, VendorCategory, CreateVendorArgs, UpdateVendorArgs } from "../../shared/types"; 


const vendorCategoryOptions = [
  "technology", "marketing", "legal", "finance", "hr",
  "facilities", "logistics", "manufacturing", "consulting", "other"
] as const;

// ============================================================================
// CREATE
// ============================================================================
export const createVendor = mutation({
  args: {
    enterpriseId: v.id("enterprises"),
    name: v.string(),   
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    website: v.optional(v.string()),
    category: v.optional(
      v.union(
        ...vendorCategoryOptions.map(option => v.literal(option))
      )
    ),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to create a vendor.");
    }
    
    // Get current user to check permissions
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser || currentUser.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied: You can only create vendors for your enterprise.");
    }

    // Check role permissions (viewers cannot create)
    if (currentUser.role === "viewer") {
      throw new ConvexError("Permission denied: Viewers cannot create vendors.");
    }

    if (!args.name || args.name.trim() === "") {
        throw new ConvexError("Validation Error: Vendor name cannot be empty.");
    }
    
    // Check for duplicate vendor names
    const existingVendor = await ctx.db
      .query("vendors")
      .withIndex("by_name", (q) => q.eq("name", args.name.trim()))
      .filter((q) => q.eq(q.field("enterpriseId"), args.enterpriseId))
      .first();

    if (existingVendor) {
      throw new ConvexError("A vendor with this name already exists in your enterprise.");
    }

    // Validate email format if provided
    if (args.contactEmail && !isValidEmail(args.contactEmail)) {
      throw new ConvexError("Invalid email format.");
    }

    const vendorData: any = {
      enterpriseId: args.enterpriseId,
      name: args.name.trim(),
      createdAt: args.createdAt,
    };
    
    // Only add optional fields if they have values
    if (args.contactEmail) vendorData.contactEmail = args.contactEmail.toLowerCase();
    if (args.contactPhone) vendorData.contactPhone = args.contactPhone;
    if (args.address) vendorData.address = args.address;
    if (args.notes) vendorData.notes = args.notes;
    if (args.website) vendorData.website = args.website;
    if (args.category) vendorData.category = args.category;
    
    const vendorId = await ctx.db.insert("vendors", vendorData);

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
    // Search query
    searchQuery: v.optional(v.string()),
    // Pagination
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    // Sorting
    sortBy: v.optional(v.union(
      v.literal("name"),
      v.literal("contractCount"),
      v.literal("totalValue"),
      v.literal("lastActivity")
    )),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required to view vendors.");
    }
    
    // Verify user has access to this enterprise
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser || currentUser.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied: You can only view vendors from your enterprise.");
    }

    // Base query for the enterprise
    let queryBuilder = ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId));

    // Apply category filter if provided and not "all"
    if (args.category && args.category !== "all") {
        queryBuilder = ctx.db
          .query("vendors")
          .withIndex("by_category_and_enterpriseId", (q) =>
            q.eq("enterpriseId", args.enterpriseId).eq("category", args.category as Exclude<typeof args.category, "all">)
          );
    }

    let vendors = await queryBuilder.order("asc").collect();

    // Apply search filter if provided
    if (args.searchQuery && args.searchQuery.trim().length > 0) {
      const searchLower = args.searchQuery.toLowerCase().trim();
      vendors = vendors.filter(vendor => 
        vendor.name.toLowerCase().includes(searchLower) ||
        vendor.contactEmail?.toLowerCase().includes(searchLower) ||
        vendor.website?.toLowerCase().includes(searchLower) ||
        vendor.notes?.toLowerCase().includes(searchLower)
      );
    }

    // Optimize: Fetch all contracts for the enterprise once, then group by vendor
    const allContracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise", q => q.eq("enterpriseId", args.enterpriseId))
      .collect();

    // Group contracts by vendor ID for efficient lookup
    const contractsByVendor = new Map<string, typeof allContracts>();
    allContracts.forEach(contract => {
      if (contract.vendorId) {
        const vendorId = contract.vendorId;
        if (!contractsByVendor.has(vendorId)) {
          contractsByVendor.set(vendorId, []);
        }
        contractsByVendor.get(vendorId)!.push(contract);
      }
    });

    // Enrich vendors with contract data and calculate metrics
    const vendorsWithDetails = vendors.map(vendor => {
      const contracts = contractsByVendor.get(vendor._id) || [];
      const activeContracts = contracts.filter(c => c.status === "active");
      
      const totalValue = contracts.reduce((sum, contract) => {
        const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
        return sum + value;
      }, 0);

      // Get last activity (most recent contract creation or update)
      const lastActivity = contracts.reduce((latest, contract) => {
        const contractTime = contract._creationTime || 0;
        return contractTime > latest ? contractTime : latest;
      }, 0);

      return { 
        ...vendor, 
        contractCount: contracts.length,
        activeContractCount: activeContracts.length,
        totalValue,
        lastActivity,
        hasActiveContracts: activeContracts.length > 0,
      };
    });

    // Sort vendors
    let sortedVendors = [...vendorsWithDetails];
    if (args.sortBy) {
      sortedVendors.sort((a, b) => {
        let aVal, bVal;
        switch (args.sortBy) {
          case "name":
            aVal = a.name.toLowerCase();
            bVal = b.name.toLowerCase();
            break;
          case "contractCount":
            aVal = a.contractCount;
            bVal = b.contractCount;
            break;
          case "totalValue":
            aVal = a.totalValue;
            bVal = b.totalValue;
            break;
          case "lastActivity":
            aVal = a.lastActivity;
            bVal = b.lastActivity;
            break;
          default:
            return 0;
        }

        if (args.sortOrder === "desc") {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        } else {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        }
      });
    }

    // Apply pagination
    const limit = args.limit || 50;
    const offset = args.offset || 0;
    const paginatedVendors = sortedVendors.slice(offset, offset + limit);

    return {
      vendors: paginatedVendors,
      total: sortedVendors.length,
      hasMore: offset + limit < sortedVendors.length,
    };
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

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser || currentUser.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied.");
    }

    const vendor = await ctx.db.get(args.vendorId);

    if (!vendor) {
      return null;
    }

    // --- Security Check: Ensure the fetched vendor belongs to the specified enterprise ---
    if (vendor.enterpriseId !== args.enterpriseId) {
      console.warn(`User attempted to access vendor ${args.vendorId} not belonging to their enterprise ${args.enterpriseId}.`);
      return null;
    }

    // Fetch related data
    const contracts = await ctx.db
        .query("contracts")
        .withIndex("by_vendorId_and_enterpriseId", q => 
          q.eq("enterpriseId", args.enterpriseId).eq("vendorId", vendor._id)
        )
        .collect();

    // Calculate vendor metrics
    const activeContracts = contracts.filter(c => c.status === "active");
    const totalValue = contracts.reduce((sum, contract) => {
      const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
      return sum + value;
    }, 0);

    // Get contract value breakdown
    const contractsByStatus = contracts.reduce((acc, contract) => {
      acc[contract.status] = (acc[contract.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const contractsByType = contracts.reduce((acc, contract) => {
      const type = contract.contractType || "other";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { 
      ...vendor, 
      contracts,
      metrics: {
        totalContracts: contracts.length,
        activeContracts: activeContracts.length,
        totalValue,
        averageContractValue: contracts.length > 0 ? totalValue / contracts.length : 0,
        contractsByStatus,
        contractsByType,
      },
    };
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in to update a vendor.");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser || currentUser.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied.");
    }

    // Check role permissions
    if (currentUser.role === "viewer") {
      throw new ConvexError("Permission denied: Viewers cannot update vendors.");
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
    if(updates.name) {
      updates.name = updates.name.trim();
      
      // Check for duplicate names
      const duplicateVendor = await ctx.db
        .query("vendors")
        .withIndex("by_name", (q) => q.eq("name", updates.name!))
        .filter((q) => 
          q.and(
            q.eq(q.field("enterpriseId"), existingVendor.enterpriseId),
            q.neq(q.field("_id"), args.vendorId)
          )
        )
        .first();

      if (duplicateVendor) {
        throw new ConvexError("A vendor with this name already exists.");
      }
    }

    // Validate email if provided
    if (updates.contactEmail !== undefined && updates.contactEmail && !isValidEmail(updates.contactEmail)) {
      throw new ConvexError("Invalid email format.");
    }
    if (updates.contactEmail) {
      updates.contactEmail = updates.contactEmail.toLowerCase();
    }

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

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser || currentUser.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied.");
    }

    // Check role permissions (only admins and owners can delete)
    if (currentUser.role !== "owner" && currentUser.role !== "admin") {
      throw new ConvexError("Permission denied: Only owners and admins can delete vendors.");
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
      .withIndex("by_vendorId_and_enterpriseId", (q) =>
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

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get vendor analytics and statistics
 */
export const getVendorAnalytics = query({
  args: {
    enterpriseId: v.id("enterprises"),
    timeRange: v.optional(v.union(
      v.literal("30days"),
      v.literal("90days"),
      v.literal("1year"),
      v.literal("all")
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser || currentUser.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied.");
    }

    const vendors = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .collect();

    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_status_and_enterpriseId", (q) => 
        q.eq("enterpriseId", args.enterpriseId)
      )
      .collect();

    // Calculate time range filter
    let startDate: Date | null = null;
    if (args.timeRange && args.timeRange !== "all") {
      startDate = new Date();
      switch (args.timeRange) {
        case "30days":
          startDate.setDate(startDate.getDate() - 30);
          break;
        case "90days":
          startDate.setDate(startDate.getDate() - 90);
          break;
        case "1year":
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }
    }

    // Filter contracts by time range
    const filteredContracts = startDate 
      ? contracts.filter(c => c._creationTime && c._creationTime > startDate.getTime())
      : contracts;

    // Calculate analytics
    const analytics = {
      totalVendors: vendors.length,
      vendorsByCategory: {} as Record<string, number>,
      topVendorsByValue: [] as Array<{ vendor: any; totalValue: number; contractCount: number }>,
      topVendorsByContracts: [] as Array<{ vendor: any; contractCount: number; totalValue: number }>,
      vendorsWithActiveContracts: 0,
      vendorsWithoutContracts: 0,
      totalSpend: 0,
      averageContractValue: 0,
      categorySpend: {} as Record<string, number>,
    };

    // Group contracts by vendor
    const contractsByVendor = new Map<string, any[]>();
    filteredContracts.forEach(contract => {
      if (contract.vendorId) {
        const vendorId = contract.vendorId.toString();
        if (!contractsByVendor.has(vendorId)) {
          contractsByVendor.set(vendorId, []);
        }
        contractsByVendor.get(vendorId)!.push(contract);
      }
    });

    // Analyze each vendor
    vendors.forEach(vendor => {
      // Category breakdown - use "uncategorized" for vendors without category
      const category = vendor.category || "uncategorized";
      analytics.vendorsByCategory[category] = (analytics.vendorsByCategory[category] || 0) + 1;

      // Get vendor contracts
      const vendorContracts = contractsByVendor.get(vendor._id.toString()) || [];
      const activeContracts = vendorContracts.filter(c => c.status === "active");
      
      if (activeContracts.length > 0) {
        analytics.vendorsWithActiveContracts++;
      }
      if (vendorContracts.length === 0) {
        analytics.vendorsWithoutContracts++;
      }

      // Calculate total value
      const totalValue = vendorContracts.reduce((sum, contract) => {
        const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
        return sum + value;
      }, 0);

      analytics.totalSpend += totalValue;
      analytics.categorySpend[category] = (analytics.categorySpend[category] || 0) + totalValue;

      // Add to top vendors lists
      if (vendorContracts.length > 0) {
        const vendorData = {
          vendor: {
            _id: vendor._id,
            name: vendor.name,
            category: vendor.category,
          },
          totalValue,
          contractCount: vendorContracts.length,
        };
        analytics.topVendorsByValue.push(vendorData);
        analytics.topVendorsByContracts.push(vendorData);
      }
    });

    // Sort and limit top vendors
    analytics.topVendorsByValue.sort((a, b) => b.totalValue - a.totalValue);
    analytics.topVendorsByValue = analytics.topVendorsByValue.slice(0, 10);

    analytics.topVendorsByContracts.sort((a, b) => b.contractCount - a.contractCount);
    analytics.topVendorsByContracts = analytics.topVendorsByContracts.slice(0, 10);

    // Calculate average contract value
    if (filteredContracts.length > 0) {
      analytics.averageContractValue = analytics.totalSpend / filteredContracts.length;
    }

    return analytics;
  },
});

/**
 * Get vendor categories with counts
 */
export const getVendorCategories = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser || currentUser.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied.");
    }

    const vendors = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .collect();

    const categories = vendorCategoryOptions.map(category => {
      const count = vendors.filter(v => v.category === category).length;
      return { category, count };
    });

    // Add count for vendors without category as "uncategorized"
    const uncategorizedCount = vendors.filter(v => !v.category).length;
    if (uncategorizedCount > 0) {
      categories.push({ category: "uncategorized" as any, count: uncategorizedCount });
    }

    return categories.filter(c => c.count > 0);
  },
});

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Bulk update vendor categories
 */
export const bulkUpdateCategories = mutation({
  args: {
    enterpriseId: v.id("enterprises"),
    updates: v.array(v.object({
      vendorId: v.id("vendors"),
      category: v.union(
        ...vendorCategoryOptions.map(option => v.literal(option))
      ),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser || currentUser.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied.");
    }

    if (currentUser.role !== "owner" && currentUser.role !== "admin") {
      throw new ConvexError("Permission denied: Only owners and admins can bulk update vendors.");
    }

    let successCount = 0;
    const errors: Array<{ vendorId: string; error: string }> = [];

    for (const update of args.updates) {
      try {
        const vendor = await ctx.db.get(update.vendorId);
        if (!vendor) {
          errors.push({ vendorId: update.vendorId.toString(), error: "Vendor not found" });
          continue;
        }

        if (vendor.enterpriseId !== args.enterpriseId) {
          errors.push({ vendorId: update.vendorId.toString(), error: "Access denied" });
          continue;
        }

        await ctx.db.patch(update.vendorId, { category: update.category });
        successCount++;
      } catch (error) {
        errors.push({ 
          vendorId: update.vendorId.toString(), 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }

    return {
      success: true,
      successCount,
      totalCount: args.updates.length,
      errors,
    };
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}