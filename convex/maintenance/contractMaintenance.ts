import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * Contract maintenance functions for scheduled jobs
 */

/**
 * Check for contracts expiring within specified days
 */
export const checkExpiringContracts = internalMutation({
  args: {
    daysAhead: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysAhead = args.daysAhead || 30;
    const today = new Date();
    const checkDate = new Date();
    checkDate.setDate(today.getDate() + daysAhead);

    console.log(`Checking for contracts expiring before ${checkDate.toISOString()}`);

    // Get contracts expiring soon
    const expiringContracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise")
      .filter(q => 
        q.and(
          q.eq(q.field("status"), "active"),
          q.lte(q.field("extractedEndDate"), checkDate.toISOString()),
          q.gte(q.field("extractedEndDate"), today.toISOString())
        )
      )
      .collect();

    console.log(`Found ${expiringContracts.length} expiring contracts`);

    // Group by days until expiry
    const expiryGroups = new Map<number, typeof expiringContracts>();
    
    expiringContracts.forEach(contract => {
      if (!contract.extractedEndDate) return;
      
      const endDate = new Date(contract.extractedEndDate);
      const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (!expiryGroups.has(daysUntilExpiry)) {
        expiryGroups.set(daysUntilExpiry, []);
      }
      expiryGroups.get(daysUntilExpiry)!.push(contract);
    });

    // Create notifications for different urgency levels
    let notificationsCreated = 0;

    for (const [days, contracts] of expiryGroups.entries()) {
      let priority: "high" | "medium" | "low" = "low";
      let notificationType = "contract_expiring_soon";

      if (days <= 7) {
        priority = "high";
        notificationType = "contract_expiring_urgent";
      } else if (days <= 14) {
        priority = "medium";
        notificationType = "contract_expiring_soon";
      }

      for (const contract of contracts) {
        // Check if notification already exists
        const existingNotification = await ctx.db
          .query("notifications")
          .withIndex("by_contract", q => q.eq("contractId", contract._id))
          .filter(q => 
            q.and(
              q.eq(q.field("type"), notificationType),
              q.gte(q.field("createdAt"), new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            )
          )
          .first();

        if (!existingNotification) {
          await ctx.db.insert("notifications", {
            recipientId: contract.ownerId || contract.createdBy || "" as Id<"users">,
            type: notificationType as "contract_expiration",
            title: `Contract Expiring: ${contract.title}`,
            message: `Contract "${contract.title}" will expire in ${days} days on ${new Date(contract.extractedEndDate!).toLocaleDateString()}`,
            priority,
            channels: ["in_app", "email"],
            status: "pending",
            isRead: false,
            retryCount: 0,
            contractId: contract._id,
            actionUrl: `/dashboard/contracts/${contract._id}`,
            createdAt: new Date().toISOString(),
          });
          notificationsCreated++;
        }
      }
    }

    return {
      contractsChecked: expiringContracts.length,
      notificationsCreated,
      expiryBreakdown: Object.fromEntries(
        Array.from(expiryGroups.entries()).map(([days, contracts]) => [
          `${days}_days`,
          contracts.length
        ])
      ),
    };
  },
});

/**
 * Update status of contracts that have expired
 */
export const updateExpiredContracts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString();
    console.log(`Updating expired contracts as of ${today}`);

    // Get active contracts that have passed their end date
    const expiredContracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise")
      .filter(q => 
        q.and(
          q.eq(q.field("status"), "active"),
          q.lt(q.field("extractedEndDate"), today)
        )
      )
      .collect();

    console.log(`Found ${expiredContracts.length} expired contracts to update`);

    let updated = 0;
    let errors: Array<{ contractId: Id<"contracts">; error: string }> = [];

    for (const contract of expiredContracts) {
      try {
        // Update contract status
        await ctx.db.patch(contract._id, {
          status: "expired",
          updatedAt: Date.now(),
        });

        // Create status history entry
        await ctx.db.insert("contractStatusHistory", {
          contractId: contract._id,
          previousStatus: "active",
          newStatus: "expired",
          changedBy: "system" as any, // System-initiated change
          changedAt: new Date().toISOString(),
          reason: "Contract end date reached",
          metadata: {
            comments: `Automatically expired on ${today}`,
          },
        });

        // Create notification for contract owner
        if (contract.ownerId) {
          await ctx.db.insert("notifications", {
            recipientId: contract.ownerId,
            type: "contract_expiration",
            title: `Contract Expired: ${contract.title}`,
            message: `Contract "${contract.title}" has expired as of ${new Date(contract.extractedEndDate!).toLocaleDateString()}`,
            priority: "medium",
            channels: ["in_app", "email"],
            status: "pending",
            isRead: false,
            retryCount: 0,
            contractId: contract._id,
            actionUrl: `/dashboard/contracts/${contract._id}`,
            createdAt: new Date().toISOString(),
          });
        }

        updated++;
      } catch (error) {
        console.error(`Failed to update contract ${contract._id}:`, error);
        errors.push({ contractId: contract._id, error: String(error) });
      }
    }

    return {
      contractsFound: expiredContracts.length,
      contractsUpdated: updated,
      errors,
    };
  },
});

/**
 * Clean up draft contracts older than 90 days
 */
export const cleanupOldDrafts = internalMutation({
  args: {
    daysOld: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysOld = args.daysOld || 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    console.log(`Cleaning up draft contracts older than ${cutoffDate.toISOString()}`);

    // Get old draft contracts
    const oldDrafts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise_status_vendor")
      .filter(q => 
        q.and(
          q.eq(q.field("status"), "draft"),
          q.lt(q.field("createdAt"), cutoffDate.toISOString())
        )
      )
      .collect();

    console.log(`Found ${oldDrafts.length} old draft contracts`);

    let deleted = 0;
    let archived = 0;

    for (const draft of oldDrafts) {
      try {
        // Check if contract has any assignments or important data
        const assignments = await ctx.db
          .query("contractAssignments")
          .withIndex("by_contract", q => q.eq("contractId", draft._id))
          .collect();

        if (assignments.length > 0 || draft.analysisStatus === "completed") {
          // Archive instead of delete
          await ctx.db.patch(draft._id, {
            status: "archived",
            updatedAt: Date.now(),
          });
          archived++;
        } else {
          // Safe to delete
          await ctx.db.delete(draft._id);
          deleted++;
        }
      } catch (error) {
        console.error(`Failed to process draft ${draft._id}:`, error);
      }
    }

    return {
      draftsFound: oldDrafts.length,
      deleted,
      archived,
    };
  },
});

/**
 * Recalculate contract metrics
 */
export const recalculateContractMetrics = internalMutation({
  args: {
    enterpriseId: v.optional(v.id("enterprises")),
  },
  handler: async (ctx, args) => {
    console.log("Recalculating contract metrics");

    // Get enterprises to process
    let enterprises;
    if (args.enterpriseId) {
      const enterprise = await ctx.db.get(args.enterpriseId);
      enterprises = enterprise ? [enterprise] : [];
    } else {
      enterprises = await ctx.db.query("enterprises").collect();
    }

    const results: Array<{ enterpriseId: Id<"enterprises">; enterpriseName: string; metrics: any }> = [];

    for (const enterprise of enterprises) {
      const contracts = await ctx.db
        .query("contracts")
        .withIndex("by_enterprise", q => q.eq("enterpriseId", enterprise._id))
        .collect();

      const metrics = {
        total: contracts.length,
        active: contracts.filter(c => c.status === "active").length,
        expired: contracts.filter(c => c.status === "expired").length,
        totalValue: contracts.reduce((sum, c) => sum + (c.value || 0), 0),
        avgValue: contracts.length > 0 
          ? contracts.reduce((sum, c) => sum + (c.value || 0), 0) / contracts.length 
          : 0,
      };

      results.push({
        enterpriseId: enterprise._id,
        enterpriseName: enterprise.name,
        metrics,
      });
    }

    return {
      enterprisesProcessed: enterprises.length,
      results,
    };
  },
});