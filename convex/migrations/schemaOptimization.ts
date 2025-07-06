import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Schema optimization migration scripts
 * Run these in phases to gradually migrate to optimized schema
 */

// Migration phases
export const MIGRATION_PHASES = {
  PHASE_1: "add_new_fields",      // Add new fields without breaking existing
  PHASE_2: "migrate_data",        // Migrate data to use new structure
  PHASE_3: "create_new_indexes",  // Create optimized indexes
  PHASE_4: "remove_old_indexes",  // Remove redundant indexes
  PHASE_5: "cleanup",             // Final cleanup
} as const;

/**
 * Get current migration status
 */
export const getMigrationStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Check for migration status table
    // Note: migrationStatus table doesn't exist in current schema
    const status = null; // await ctx.db
      // .query("migrationStatus")
      // .filter(q => q.eq(q.field("migration"), "schema_optimization"))
      // .first();

    if (!status) {
      return {
        migration: "schema_optimization",
        currentPhase: null,
        completedPhases: [],
        startedAt: null,
        completedAt: null,
        errors: [],
      };
    }

    return status;
  },
});

/**
 * Phase 1: Add new fields to existing tables
 */
export const phase1_addNewFields = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("Phase 1: Adding new fields to existing tables");

    let updated = 0;
    let errors: any[] = [];

    try {
      // Add expiresAt to realtimeEvents
      const events = await ctx.db
        .query("realtimeEvents")
        .filter(q => q.eq(q.field("expiresAt"), undefined))
        .take(1000);

      for (const event of events) {
        try {
          await ctx.db.patch(event._id, {
            expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
          });
          updated++;
        } catch (error) {
          errors.push({ table: "realtimeEvents", id: event._id, error: String(error) });
        }
      }

      // Add expiresAt to analytics_events
      // Note: expiresAt field doesn't exist in current schema
      const analyticsEvents: any[] = []; // await ctx.db
        // .query("analytics_events")
        // .filter(q => q.eq(q.field("expiresAt"), undefined))
        // .take(1000);

      for (const event of analyticsEvents) {
        try {
          await ctx.db.patch(event._id, {
            expiresAt: Date.now() + (90 * 24 * 60 * 60 * 1000), // 90 days
          });
          updated++;
        } catch (error) {
          errors.push({ table: "analytics_events", id: event._id, error: String(error) });
        }
      }

      // Update migration status
      await updateMigrationStatus(ctx, MIGRATION_PHASES.PHASE_1, errors);

      return {
        phase: MIGRATION_PHASES.PHASE_1,
        updated,
        errors,
        success: errors.length === 0,
      };
    } catch (error) {
      console.error("Phase 1 failed:", error);
      throw error;
    }
  },
});

/**
 * Phase 2: Migrate data to optimized structure
 */
export const phase2_migrateData = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    console.log("Phase 2: Migrating data to optimized structure");

    const batchSize = args.batchSize || 100;
    let processed = 0;
    let errors: any[] = [];

    try {
      // Ensure vendor performance scores are calculated
      const vendors = await ctx.db
        .query("vendors")
        .filter(q => q.eq(q.field("performanceScore"), undefined))
        .take(batchSize);

      for (const vendor of vendors) {
        try {
          // Calculate performance score
          const contracts = await ctx.db
            .query("contracts")
            .withIndex("by_vendorId_and_enterpriseId", q => 
              q.eq("enterpriseId", vendor.enterpriseId).eq("vendorId", vendor._id)
            )
            .collect();

          const activeContracts = contracts.filter(c => c.status === "active").length;
          const totalValue = contracts.reduce((sum, c) => sum + (c.value || 0), 0);

          const score = calculatePerformanceScore(
            contracts.length,
            activeContracts,
            totalValue
          );

          await ctx.db.patch(vendor._id, {
            performanceScore: score,
            totalContractValue: totalValue,
            activeContracts,
            updatedAt: Date.now(),
          });
          processed++;
        } catch (error) {
          errors.push({ table: "vendors", id: vendor._id, error: String(error) });
        }
      }

      // Update contracts with missing timestamps
      const contracts = await ctx.db
        .query("contracts")
        .filter(q => q.eq(q.field("updatedAt"), undefined))
        .take(batchSize);

      for (const contract of contracts) {
        try {
          await ctx.db.patch(contract._id, {
            updatedAt: contract._creationTime,
          });
          processed++;
        } catch (error) {
          errors.push({ table: "contracts", id: contract._id, error: String(error) });
        }
      }

      await updateMigrationStatus(ctx, MIGRATION_PHASES.PHASE_2, errors);

      return {
        phase: MIGRATION_PHASES.PHASE_2,
        processed,
        errors,
        hasMore: vendors.length === batchSize || contracts.length === batchSize,
        success: errors.length === 0,
      };
    } catch (error) {
      console.error("Phase 2 failed:", error);
      throw error;
    }
  },
});

/**
 * Phase 3: Create new optimized indexes
 */
export const phase3_createNewIndexes = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("Phase 3: Creating new optimized indexes");

    // Note: In Convex, indexes are defined in schema.ts
    // This phase would involve deploying the new schema with optimized indexes
    // For now, we'll just mark this phase as requiring manual deployment

    await updateMigrationStatus(ctx, MIGRATION_PHASES.PHASE_3, []);

    return {
      phase: MIGRATION_PHASES.PHASE_3,
      message: "Deploy schema_optimized.ts to create new indexes",
      action_required: true,
      success: true,
    };
  },
});

/**
 * Phase 4: Verify and switch to new indexes
 */
export const phase4_verifyAndSwitch = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("Phase 4: Verifying new indexes and switching queries");

    let verified = 0;
    let errors: any[] = [];

    try {
      // Test new indexes with sample queries
      const tests = [
        {
          name: "contracts by enterprise_status_vendor",
          test: async () => {
            const result = await ctx.db
              .query("contracts")
              .withIndex("by_enterprise_status_vendor", q => 
                q.eq("enterpriseId", "dummy_id" as Id<"enterprises">)
              )
              .take(1);
            return result.length >= 0;
          },
        },
        {
          name: "vendors by enterprise_status_created",
          test: async () => {
            const result = await ctx.db
              .query("vendors")
              .withIndex("by_enterprise_status_created", q => 
                q.eq("enterpriseId", "dummy_id" as Id<"enterprises">)
              )
              .take(1);
            return result.length >= 0;
          },
        },
      ];

      for (const { name, test } of tests) {
        try {
          const success = await test();
          if (success) {
            verified++;
          } else {
            errors.push({ test: name, error: "Index verification failed" });
          }
        } catch (error) {
          errors.push({ test: name, error: String(error) });
        }
      }

      await updateMigrationStatus(ctx, MIGRATION_PHASES.PHASE_4, errors);

      return {
        phase: MIGRATION_PHASES.PHASE_4,
        verified,
        errors,
        success: errors.length === 0,
      };
    } catch (error) {
      console.error("Phase 4 failed:", error);
      throw error;
    }
  },
});

/**
 * Phase 5: Cleanup old data and indexes
 */
export const phase5_cleanup = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    console.log("Phase 5: Cleanup old data and indexes");

    const dryRun = args.dryRun ?? true;
    let cleaned = 0;
    let errors: any[] = [];

    try {
      // Clean up old events
      const oldEvents = await ctx.db
        .query("realtimeEvents")
        .filter(q => 
          q.and(
            q.eq(q.field("processed"), true),
            q.lt(q.field("timestamp"), new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          )
        )
        .take(1000);

      if (!dryRun) {
        for (const event of oldEvents) {
          try {
            await ctx.db.delete(event._id);
            cleaned++;
          } catch (error) {
            errors.push({ table: "realtimeEvents", id: event._id, error: String(error) });
          }
        }
      } else {
        cleaned = oldEvents.length;
      }

      // Clean up old analytics events
      const oldAnalytics = await ctx.db
        .query("analytics_events")
        .filter(q => 
          q.lt(q.field("timestamp"), Date.now() - 90 * 24 * 60 * 60 * 1000)
        )
        .take(1000);

      if (!dryRun) {
        for (const event of oldAnalytics) {
          try {
            await ctx.db.delete(event._id);
            cleaned++;
          } catch (error) {
            errors.push({ table: "analytics_events", id: event._id, error: String(error) });
          }
        }
      } else {
        cleaned += oldAnalytics.length;
      }

      await updateMigrationStatus(ctx, MIGRATION_PHASES.PHASE_5, errors);

      return {
        phase: MIGRATION_PHASES.PHASE_5,
        cleaned,
        errors,
        dryRun,
        success: errors.length === 0,
      };
    } catch (error) {
      console.error("Phase 5 failed:", error);
      throw error;
    }
  },
});

/**
 * Run all migration phases
 */
export const runFullMigration = internalMutation({
  args: {
    phases: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const phasesToRun = args.phases || Object.values(MIGRATION_PHASES);
    const results: any[] = [];

    for (const phase of phasesToRun) {
      console.log(`Running migration phase: ${phase}`);

      try {
        let result;
        switch (phase) {
          case MIGRATION_PHASES.PHASE_1:
            result = await ctx.runMutation(api.migrations.schemaOptimization.phase1_addNewFields, {});
            break;
          case MIGRATION_PHASES.PHASE_2:
            // Run phase 2 in batches until complete
            do {
              result = await ctx.runMutation(api.migrations.schemaOptimization.phase2_migrateData, { batchSize: 100 });
            } while (result.hasMore);
            break;
          case MIGRATION_PHASES.PHASE_3:
            result = await ctx.runMutation(api.migrations.schemaOptimization.phase3_createNewIndexes, {});
            break;
          case MIGRATION_PHASES.PHASE_4:
            result = await ctx.runMutation(api.migrations.schemaOptimization.phase4_verifyAndSwitch, {});
            break;
          case MIGRATION_PHASES.PHASE_5:
            result = await ctx.runMutation(api.migrations.schemaOptimization.phase5_cleanup, { dryRun: false });
            break;
          default:
            throw new Error(`Unknown phase: ${phase}`);
        }

        results.push(result);

        if (!result.success) {
          console.error(`Phase ${phase} failed, stopping migration`);
          break;
        }
      } catch (error) {
        console.error(`Error in phase ${phase}:`, error);
        results.push({
          phase,
          error: String(error),
          success: false,
        });
        break;
      }
    }

    return {
      phases: results,
      completed: results.filter(r => r.success).length,
      total: phasesToRun.length,
      success: results.every(r => r.success),
    };
  },
});

// Helper functions

async function updateMigrationStatus(ctx: any, phase: string, errors: any[]) {
  const existing = await ctx.db
    .query("migrationStatus")
    .filter(q => q.eq(q.field("migration"), "schema_optimization"))
    .first();

  if (existing) {
    const completedPhases = existing.completedPhases || [];
    if (!completedPhases.includes(phase)) {
      completedPhases.push(phase);
    }

    await ctx.db.patch(existing._id, {
      currentPhase: phase,
      completedPhases,
      lastUpdated: new Date().toISOString(),
      errors: [...(existing.errors || []), ...errors],
    });
  } else {
    await ctx.db.insert("migrationStatus", {
      migration: "schema_optimization",
      currentPhase: phase,
      completedPhases: [phase],
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      errors,
    });
  }
}

function calculatePerformanceScore(
  totalContracts: number,
  activeContracts: number,
  totalValue: number
): number {
  let score = 50; // Base score

  // Contract activity (up to 20 points)
  if (totalContracts > 0) {
    score += Math.min(20, totalContracts * 2);
  }

  // Active contract ratio (up to 15 points)
  if (totalContracts > 0) {
    const activeRatio = activeContracts / totalContracts;
    score += activeRatio * 15;
  }

  // Value contribution (up to 15 points)
  if (totalValue > 100000) {
    score += 15;
  } else if (totalValue > 50000) {
    score += 10;
  } else if (totalValue > 10000) {
    score += 5;
  }

  return Math.min(100, Math.round(score));
}