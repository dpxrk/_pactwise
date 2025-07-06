import { query, mutation, action } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { api } from "../_generated/api";

/**
 * Backup functions for Convex data
 * IMPORTANT: Only run these with proper admin authentication
 */

// Backup configuration
const BACKUP_TABLES = [
  "contracts",
  "vendors",
  "users",
  "enterprises",
  "contractAssignments",
  "contractStatusHistory",
  "contractApprovals",
  "budgets",
  "notifications",
  "agentInsights",
] as const;

type BackupTable = typeof BACKUP_TABLES[number];

/**
 * Export data from a specific table
 */
export const exportTableData = query({
  args: {
    tableName: v.union(...BACKUP_TABLES.map(t => v.literal(t))),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Additional admin check
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", q => q.eq("clerkId", identity.subject))
      .first();

    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      throw new ConvexError("Admin access required for backups");
    }

    const limit = args.limit || 1000;
    
    // Generic query for any table
    const result = await ctx.db
      .query(args.tableName)
      .paginate({ numItems: limit, cursor: args.cursor || null });

    return {
      tableName: args.tableName,
      data: result.page,
      nextCursor: result.continueCursor,
      hasMore: result.continueCursor !== null,
      count: result.page.length,
    };
  },
});

/**
 * Get backup metadata for all tables
 */
export const getBackupMetadata = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const metadata = await Promise.all(
      BACKUP_TABLES.map(async (tableName) => {
        // Get approximate count (first page)
        const sample = await ctx.db
          .query(tableName)
          .paginate({ cursor: null, numItems: 1 });

        return {
          tableName,
          hasData: sample.page.length > 0,
          sampleRecord: sample.page[0] || null,
        };
      })
    );

    return {
      tables: metadata,
      timestamp: new Date().toISOString(),
      backupVersion: "1.0",
    };
  },
});

/**
 * Create a complete backup action
 */
export const createFullBackup = action({
  args: {
    enterpriseId: v.optional(v.id("enterprises")),
  },
  handler: async (ctx, args) => {
    const backup = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      tables: {} as Record<string, any[]>,
    };

    // Export each table
    for (const tableName of BACKUP_TABLES) {
      console.log(`Backing up table: ${tableName}`);
      const tableData: any[] = [];
      let cursor = null;

      do {
        const result = await ctx.runQuery(api.backup.backupFunctions.exportTableData, {
          tableName,
          cursor,
          limit: 1000,
        });

        tableData.push(...result.data);
        cursor = result.nextCursor;
      } while (cursor);

      backup.tables[tableName] = tableData;
      console.log(`Backed up ${tableData.length} records from ${tableName}`);
    }

    // Store backup in external storage or return as JSON
    // For now, we'll return the backup data
    return backup;
  },
});

/**
 * Verify backup integrity
 */
export const verifyBackup = query({
  args: {
    backupData: v.object({
      version: v.string(),
      timestamp: v.string(),
      tables: v.record(v.string(), v.array(v.any())),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const verification = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
      summary: {} as Record<string, { count: number; valid: boolean }>,
    };

    // Check version
    if (args.backupData.version !== "1.0") {
      verification.errors.push(`Unsupported backup version: ${args.backupData.version}`);
      verification.valid = false;
    }

    // Verify each table
    for (const [tableName, records] of Object.entries(args.backupData.tables)) {
      const tableVerification = {
        count: records.length,
        valid: true,
      };

      // Basic validation
      if (!BACKUP_TABLES.includes(tableName as BackupTable)) {
        verification.warnings.push(`Unknown table in backup: ${tableName}`);
      }

      if (records.length === 0) {
        verification.warnings.push(`No records found for table: ${tableName}`);
      }

      // Check for required fields
      if (records.length > 0) {
        const sample = records[0];
        if (!sample._id || !sample._creationTime) {
          verification.errors.push(`Invalid record format in table: ${tableName}`);
          tableVerification.valid = false;
          verification.valid = false;
        }
      }

      verification.summary[tableName] = tableVerification;
    }

    return verification;
  },
});

/**
 * Create incremental backup (changes since timestamp)
 */
export const createIncrementalBackup = action({
  args: {
    sinceTimestamp: v.string(),
    tables: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const tablesToBackup = args.tables || BACKUP_TABLES;
    const since = new Date(args.sinceTimestamp).getTime();
    
    const backup = {
      version: "1.0",
      type: "incremental",
      sinceTimestamp: args.sinceTimestamp,
      timestamp: new Date().toISOString(),
      tables: {} as Record<string, any[]>,
    };

    for (const tableName of tablesToBackup) {
      console.log(`Backing up changes in: ${tableName}`);
      const tableData: any[] = [];
      let cursor = null;

      do {
        const result = await ctx.runQuery(api.backup.backupFunctions.exportTableData, {
          tableName: tableName as BackupTable,
          cursor,
          limit: 1000,
        });

        // Filter by modification time
        const recentRecords = result.data.filter(record => {
          const updatedAt = record.updatedAt || record._creationTime;
          return updatedAt > since;
        });

        tableData.push(...recentRecords);
        cursor = result.nextCursor;
      } while (cursor);

      if (tableData.length > 0) {
        backup.tables[tableName] = tableData;
        console.log(`Found ${tableData.length} changed records in ${tableName}`);
      }
    }

    return backup;
  },
});

/**
 * Export specific enterprise data
 */
export const exportEnterpriseData = action({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    console.log(`Starting export for enterprise: ${args.enterpriseId}`);

    const export_ = {
      version: "1.0",
      type: "enterprise",
      enterpriseId: args.enterpriseId,
      timestamp: new Date().toISOString(),
      data: {} as Record<string, any[]>,
    };

    // Export enterprise
    const enterprise = await ctx.runQuery(api.enterprises.getById, {
      id: args.enterpriseId,
    });
    export_.data.enterprise = [enterprise];

    // Export related data
    const queries = [
      { table: "users", index: "by_enterprise" },
      { table: "contracts", index: "by_enterprise" },
      { table: "vendors", index: "by_enterprise" },
      { table: "budgets", index: "by_enterprise" },
      { table: "notifications", index: "by_enterprise" },
    ];

    for (const { table, index } of queries) {
      console.log(`Exporting ${table} for enterprise`);
      const data = await ctx.runQuery(api.backup.backupFunctions.exportEnterpriseTable, {
        tableName: table as BackupTable,
        enterpriseId: args.enterpriseId,
      });
      export_.data[table] = data;
    }

    return export_;
  },
});


/**
 * Helper to export enterprise-specific table data
 */
export const exportEnterpriseTable = query({
  args: {
    tableName: v.string(),
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const data = await ctx.db
      .query(args.tableName as any)
      .withIndex("by_enterprise" as any, q => q.eq("enterpriseId", args.enterpriseId))
      .collect();

    return data;
  },
});

/**
 * Generate backup summary report
 */
export const generateBackupReport = query({
  args: {
    includeStats: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const report = {
      timestamp: new Date().toISOString(),
      tables: [] as any[],
      totalRecords: 0,
      estimatedSize: 0,
    };

    for (const tableName of BACKUP_TABLES) {
      // Sample to get stats
      const sample = await ctx.db
        .query(tableName as any)
        .take(100);

      const avgRecordSize = sample.length > 0 
        ? JSON.stringify(sample).length / sample.length 
        : 0;

      const tableInfo = {
        name: tableName,
        sampleCount: sample.length,
        hasData: sample.length > 0,
        avgRecordSize: Math.round(avgRecordSize),
        fields: sample.length > 0 ? Object.keys(sample[0]) : [],
      };

      if (args.includeStats && sample.length > 0) {
        // Get date range
        const dates = sample
          .map(r => r._creationTime)
          .filter(Boolean)
          .sort();
        
        (tableInfo as any).oldestRecord = new Date(dates[0]).toISOString();
        (tableInfo as any).newestRecord = new Date(dates[dates.length - 1]).toISOString();
      }

      report.tables.push(tableInfo);
      report.totalRecords += sample.length;
      report.estimatedSize += avgRecordSize * sample.length;
    }

    return report;
  },
});