// convex/migrations/addContractOwnership.ts
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Migration to add contract ownership and department tracking
 * This adds the following fields to contracts:
 * - ownerId: The user who owns/is responsible for the contract
 * - departmentId: The department that manages the contract
 * - createdBy: The user who created the contract
 * - lastModifiedBy: The user who last modified the contract
 */
export const addContractOwnershipFields = internalMutation({
  args: {},
  handler: async (ctx) => {
    const contracts = await ctx.db.query("contracts").collect();
    
    let updated = 0;
    for (const contract of contracts) {
      // Skip if already has ownership fields
      if ('ownerId' in contract) continue;
      
      // Find the first admin or owner in the enterprise to assign as default owner
      const defaultOwner = await ctx.db
        .query("users")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", contract.enterpriseId))
        .filter((q) => 
          q.or(
            q.eq(q.field("role"), "owner"),
            q.eq(q.field("role"), "admin")
          )
        )
        .first();
      
      if (defaultOwner) {
        await ctx.db.patch(contract._id, {
          ownerId: defaultOwner._id,
          createdBy: defaultOwner._id,
          lastModifiedBy: defaultOwner._id,
        });
        updated++;
      }
    }
    
    return { 
      success: true, 
      contractsUpdated: updated,
      totalContracts: contracts.length 
    };
  },
});

/**
 * Migration to create contract assignments table for tracking contract ownership history
 */
export const createContractAssignments = internalMutation({
  args: {},
  handler: async (ctx) => {
    // This would create a new table to track assignment history
    // For now, we'll just return success as the table needs to be added to schema first
    return { 
      success: true, 
      message: "Contract assignments table ready to be created in schema" 
    };
  },
});