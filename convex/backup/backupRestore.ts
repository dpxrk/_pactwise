import { v } from "convex/values";
import { mutation, query, action, internalMutation } from "../_generated/server";
import { ConvexError } from "convex/values";
import { getSecurityContext } from "../security/rowLevelSecurity";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";

// Backup types
export const BackupTypes = {
  FULL: "full",
  INCREMENTAL: "incremental",
  SELECTIVE: "selective",
} as const;

export type BackupType = typeof BackupTypes[keyof typeof BackupTypes];

// Create a backup
export const createBackup = action({
  args: {
    backupType: v.union(
      v.literal("full"),
      v.literal("incremental"),
      v.literal("selective")
    ),
    description: v.optional(v.string()),
    includeAttachments: v.optional(v.boolean()),
    selectedTables: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.runQuery(api.users.getByClerkId, { 
      clerkId: identity.subject 
    });

    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Create backup record
    const backupId = await ctx.runMutation(api.backup.backupRestore.createBackupRecord, {
      backupType: args.backupType,
      description: args.description,
      includeAttachments: args.includeAttachments,
      selectedTables: args.selectedTables,
    });

    // Start backup process
    try {
      const backupData = await performBackup(ctx, {
        backupId,
        backupType: args.backupType,
        enterpriseId: user.enterpriseId,
        includeAttachments: args.includeAttachments || false,
        selectedTables: args.selectedTables,
      });

      // Update backup record with success
      await ctx.runMutation(api.backup.backupRestore.updateBackupStatus, {
        backupId,
        status: "completed",
        size: JSON.stringify(backupData).length,
        recordCount: countRecords(backupData),
      });

      return {
        success: true,
        backupId,
        size: JSON.stringify(backupData).length,
        recordCount: countRecords(backupData),
      };
    } catch (error) {
      // Update backup record with failure
      await ctx.runMutation(api.backup.backupRestore.updateBackupStatus, {
        backupId,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  },
});

// Create backup record
export const createBackupRecord = mutation({
  args: {
    backupType: v.string(),
    description: v.optional(v.string()),
    includeAttachments: v.optional(v.boolean()),
    selectedTables: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can create backups
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    const backupId = await ctx.db.insert("backups", {
      enterpriseId: securityContext.enterpriseId,
      backupType: args.backupType,
      status: "in_progress",
      description: args.description,
      includeAttachments: args.includeAttachments || false,
      selectedTables: args.selectedTables,
      createdBy: securityContext.userId,
      createdAt: new Date().toISOString(),
      size: 0,
      recordCount: 0,
    });

    // Log the backup creation
    await ctx.db.insert("auditLogs", {
      userId: securityContext.userId,
      enterpriseId: securityContext.enterpriseId,
      operation: "createBackup",
      resourceType: "backups",
      resourceId: backupId,
      action: "create",
      status: "success",
      timestamp: new Date().toISOString(),
      metadata: { backupType: args.backupType }
    });

    return backupId;
  },
});

// Update backup status
export const updateBackupStatus = mutation({
  args: {
    backupId: v.id("backups"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    size: v.optional(v.number()),
    recordCount: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      status: args.status,
      completedAt: new Date().toISOString(),
    };

    if (args.size !== undefined) updates.size = args.size;
    if (args.recordCount !== undefined) updates.recordCount = args.recordCount;
    if (args.error !== undefined) updates.error = args.error;

    await ctx.db.patch(args.backupId, updates);
  },
});

// List backups
export const listBackups = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(v.union(
      v.literal("completed"),
      v.literal("in_progress"),
      v.literal("failed")
    )),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can view backups
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    let backups = await ctx.db
      .query("backups")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
      .order("desc")
      .take(args.limit || 50);

    if (args.status) {
      backups = backups.filter(b => b.status === args.status);
    }

    // Enrich with creator info
    const enrichedBackups = await Promise.all(
      backups.map(async (backup) => {
        const creator = await ctx.db.get(backup.createdBy);
        return {
          ...backup,
          creatorName: creator ? `${creator.firstName || ""} ${creator.lastName || ""}`.trim() || creator.email : "Unknown",
        };
      })
    );

    return enrichedBackups;
  },
});

// Get backup details
export const getBackupDetails = query({
  args: {
    backupId: v.id("backups"),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can view backups
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    const backup = await ctx.db.get(args.backupId);
    if (!backup) {
      throw new ConvexError("Backup not found");
    }

    if (backup.enterpriseId !== securityContext.enterpriseId) {
      throw new ConvexError("Access denied: Backup belongs to different enterprise");
    }

    const creator = await ctx.db.get(backup.createdBy);
    
    return {
      ...backup,
      creatorName: creator ? `${creator.firstName || ""} ${creator.lastName || ""}`.trim() || creator.email : "Unknown",
    };
  },
});

// Restore from backup
export const restoreFromBackup = action({
  args: {
    backupId: v.id("backups"),
    restoreOptions: v.object({
      overwriteExisting: v.boolean(),
      selectedTables: v.optional(v.array(v.string())),
      dryRun: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.runQuery(api.users.getByClerkId, { 
      clerkId: identity.subject 
    });

    if (!user || user.role !== "owner") {
      throw new Error("Unauthorized: Owner access required for restore");
    }

    // Get backup details
    const backup = await ctx.runQuery(api.backup.backupRestore.getBackupDetails, {
      backupId: args.backupId,
    });

    if (!backup || backup.status !== "completed") {
      throw new Error("Invalid or incomplete backup");
    }

    // Log the restore attempt
    await ctx.runMutation(api.auditLogging.logEvent, {
      userId: user._id,
      operation: "restoreFromBackup",
      resourceType: "backups",
      resourceId: args.backupId,
      action: "update",
      status: "success",
      metadata: args.restoreOptions
    });

    if (args.restoreOptions.dryRun) {
      // Simulate restore and return what would be affected
      return {
        success: true,
        dryRun: true,
        affectedTables: backup.selectedTables || getAllTables(),
        estimatedRecords: backup.recordCount,
        warnings: [
          "This is a dry run. No data has been modified.",
          args.restoreOptions.overwriteExisting 
            ? "Existing data would be overwritten." 
            : "Existing data would be preserved.",
        ],
      };
    }

    // Perform actual restore
    try {
      const result = await performRestore(ctx, {
        backupId: args.backupId,
        enterpriseId: user.enterpriseId,
        overwriteExisting: args.restoreOptions.overwriteExisting,
        selectedTables: args.restoreOptions.selectedTables,
      });

      return {
        success: true,
        restoredTables: result.restoredTables,
        restoredRecords: result.restoredRecords,
        skippedRecords: result.skippedRecords,
      };
    } catch (error) {
      throw new Error(`Restore failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

// Delete old backups
export const deleteOldBackups = internalMutation({
  args: {
    retentionDays: v.number(),
  },
  handler: async (ctx, args) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - args.retentionDays);

    const oldBackups = await ctx.db
      .query("backups")
      .filter((q) => q.lt(q.field("createdAt"), cutoffDate.toISOString()))
      .collect();

    for (const backup of oldBackups) {
      // Delete backup data from storage if exists
      if (backup.storageId) {
        try {
          await ctx.storage.delete(backup.storageId);
        } catch {
          // Storage might already be deleted
        }
      }

      await ctx.db.delete(backup._id);
    }

    return { deletedCount: oldBackups.length };
  },
});

// Schedule automatic backup
export const scheduleBackup = mutation({
  args: {
    schedule: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly")
    ),
    backupType: v.union(
      v.literal("full"),
      v.literal("incremental")
    ),
    time: v.string(), // HH:MM format
    timezone: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only owners can schedule backups
    if (securityContext.role !== "owner") {
      throw new ConvexError("Access denied: Owner access required");
    }

    // Check if schedule already exists
    const existingSchedule = await ctx.db
      .query("backupSchedules")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
      .first();

    if (existingSchedule) {
      // Update existing schedule
      await ctx.db.patch(existingSchedule._id, {
        schedule: args.schedule,
        backupType: args.backupType,
        time: args.time,
        timezone: args.timezone,
        isActive: args.isActive,
        updatedAt: new Date().toISOString(),
      });

      return { id: existingSchedule._id, updated: true };
    } else {
      // Create new schedule
      const scheduleId = await ctx.db.insert("backupSchedules", {
        enterpriseId: securityContext.enterpriseId,
        schedule: args.schedule,
        backupType: args.backupType,
        time: args.time,
        timezone: args.timezone,
        isActive: args.isActive,
        createdBy: securityContext.userId,
        createdAt: new Date().toISOString(),
        lastRunAt: undefined,
        nextRunAt: calculateNextRun(args.schedule, args.time, args.timezone),
      });

      return { id: scheduleId, created: true };
    }
  },
});

// Get backup schedule
export const getBackupSchedule = query({
  args: {},
  handler: async (ctx) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can view backup schedule
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    const schedule = await ctx.db
      .query("backupSchedules")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
      .first();

    if (!schedule) {
      return null;
    }

    const creator = await ctx.db.get(schedule.createdBy);

    return {
      ...schedule,
      creatorName: creator ? `${creator.firstName || ""} ${creator.lastName || ""}`.trim() || creator.email : "Unknown",
    };
  },
});

// Export specific data
export const exportData = action({
  args: {
    exportType: v.union(
      v.literal("contracts"),
      v.literal("vendors"),
      v.literal("analytics"),
      v.literal("all")
    ),
    format: v.union(v.literal("json"), v.literal("csv")),
    filters: v.optional(v.object({
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      status: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.runQuery(api.users.getByClerkId, { 
      clerkId: identity.subject 
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Log the export
    await ctx.runMutation(api.auditLogging.logEvent, {
      userId: user._id,
      operation: "exportData",
      resourceType: args.exportType,
      action: "export",
      status: "success",
      metadata: { format: args.format, filters: args.filters }
    });

    const exportData: any = {
      exportType: args.exportType,
      exportDate: new Date().toISOString(),
      exportedBy: user.email,
      filters: args.filters,
    };

    // Fetch data based on export type
    if (args.exportType === "contracts" || args.exportType === "all") {
      const contracts = await ctx.runQuery(api.contracts.getContracts, {
        filters: args.filters,
      });
      exportData.contracts = contracts.contracts;
    }

    if (args.exportType === "vendors" || args.exportType === "all") {
      const vendors = await ctx.runQuery(api.vendors.getVendors, {});
      exportData.vendors = vendors;
    }

    if (args.exportType === "analytics" || args.exportType === "all") {
      const analytics = await ctx.runQuery(api.analytics.getDashboardSummary, {});
      exportData.analytics = analytics;
    }

    if (args.format === "csv") {
      return convertToCSVExport(exportData);
    }

    return exportData;
  },
});

// Import data
export const importData = action({
  args: {
    importType: v.union(
      v.literal("contracts"),
      v.literal("vendors")
    ),
    data: v.any(),
    options: v.object({
      updateExisting: v.boolean(),
      skipDuplicates: v.boolean(),
      validateOnly: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.runQuery(api.users.getByClerkId, { 
      clerkId: identity.subject 
    });

    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Validate data structure
    const validation = validateImportData(args.importType, args.data);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }

    if (args.options.validateOnly) {
      return {
        success: true,
        validationOnly: true,
        recordCount: validation.recordCount,
        warnings: validation.warnings,
      };
    }

    // Log the import
    await ctx.runMutation(api.auditLogging.logEvent, {
      userId: user._id,
      operation: "importData",
      resourceType: args.importType,
      action: "create",
      status: "success",
      metadata: { 
        recordCount: validation.recordCount,
        options: args.options 
      }
    });

    // Perform import based on type
    const result = await performImport(ctx, {
      importType: args.importType,
      data: args.data,
      options: args.options,
      enterpriseId: user.enterpriseId,
      userId: user._id,
    });

    return {
      success: true,
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
    };
  },
});

// Helper functions
function getAllTables(): string[] {
  return [
    "users",
    "enterprises",
    "contracts",
    "vendors",
    "notifications",
    "auditLogs",
    "contractClauses",
    "contractAssignments",
    "contractStatusHistory",
    "contractApprovals",
    "complianceChecks",
    "budgets",
    "contractBudgetAllocations",
  ];
}

function countRecords(data: any): number {
  let count = 0;
  for (const table in data) {
    if (Array.isArray(data[table])) {
      count += data[table].length;
    }
  }
  return count;
}

function calculateNextRun(schedule: string, time: string, timezone: string): string {
  // Simplified calculation - in production, use a proper date library
  const now = new Date();
  const [hours, minutes] = time.split(":").map(Number);
  
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  
  if (next <= now) {
    switch (schedule) {
      case "daily":
        next.setDate(next.getDate() + 1);
        break;
      case "weekly":
        next.setDate(next.getDate() + 7);
        break;
      case "monthly":
        next.setMonth(next.getMonth() + 1);
        break;
    }
  }
  
  return next.toISOString();
}

async function performBackup(ctx: any, options: any): Promise<any> {
  // In a real implementation, this would fetch and serialize all relevant data
  // For now, return a mock structure
  return {
    version: "1.0",
    timestamp: new Date().toISOString(),
    enterpriseId: options.enterpriseId,
    tables: options.selectedTables || getAllTables(),
    data: {
      // Mock data structure
      contracts: [],
      vendors: [],
      users: [],
    },
  };
}

async function performRestore(ctx: any, options: any): Promise<any> {
  // In a real implementation, this would deserialize and restore data
  // For now, return mock results
  return {
    restoredTables: options.selectedTables || getAllTables(),
    restoredRecords: 100,
    skippedRecords: 0,
  };
}

function validateImportData(type: string, data: any): any {
  // Basic validation - in production, use a proper schema validator
  const result = {
    valid: true,
    errors: [] as string[],
    warnings: [] as string[],
    recordCount: 0,
  };

  if (!Array.isArray(data)) {
    result.valid = false;
    result.errors.push("Data must be an array");
    return result;
  }

  result.recordCount = data.length;

  // Type-specific validation
  if (type === "contracts") {
    data.forEach((record, index) => {
      if (!record.title) {
        result.errors.push(`Record ${index}: Missing required field 'title'`);
        result.valid = false;
      }
    });
  } else if (type === "vendors") {
    data.forEach((record, index) => {
      if (!record.name) {
        result.errors.push(`Record ${index}: Missing required field 'name'`);
        result.valid = false;
      }
    });
  }

  return result;
}

async function performImport(ctx: any, options: any): Promise<any> {
  // Mock implementation - in production, actually import the data
  return {
    imported: options.data.length,
    updated: 0,
    skipped: 0,
    errors: [],
  };
}

function convertToCSVExport(data: any): any {
  // Convert data to CSV format
  const csvData: any = {
    format: "csv",
    files: {},
  };

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value) && value.length > 0) {
      const headers = Object.keys(value[0]);
      const rows = value.map(item => 
        headers.map(h => {
          const val = item[h];
          return typeof val === 'object' ? JSON.stringify(val) : val;
        })
      );
      csvData.files[key] = { headers, rows };
    }
  }

  return csvData;
}