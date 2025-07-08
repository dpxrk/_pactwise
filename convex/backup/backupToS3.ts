import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { ConvexError } from "convex/values";

/**
 * Backup to S3 storage action
 * This requires AWS SDK and credentials to be configured
 */

interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix?: string;
}

interface BackupMetadata {
  id: string;
  timestamp: string;
  type: 'full' | 'incremental';
  version: string;
  tables: string[];
  recordCount: number;
  size: number;
  location: string;
  checksum: string;
  status: 'completed' | 'failed' | 'in_progress';
  error?: string;
}

/**
 * Create automated daily backup
 */
export const automatedDailyBackup = internalAction({
  args: {},
  handler: async (ctx) => {
    const backupId = `backup-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`Starting automated daily backup: ${backupId}`);
      
      // Create incremental backup (changes from last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const backupData = await ctx.runAction(internal.backup.backupFunctions.createIncrementalBackup, {
        sinceTimestamp: yesterday,
      });

      // Store backup metadata
      await ctx.runMutation(internal.backup.backupToS3.storeBackupMetadata, {
        id: backupId,
        timestamp,
        type: 'incremental',
        version: backupData.version,
        tables: Object.keys(backupData.tables),
        recordCount: Object.values(backupData.tables).reduce((sum: number, records: any) => sum + (Array.isArray(records) ? records.length : 0), 0),
        size: JSON.stringify(backupData).length,
        location: `s3://${process.env.BACKUP_S3_BUCKET}/daily/${backupId}.json`,
        checksum: await generateChecksum(JSON.stringify(backupData)),
        status: 'completed',
      });

      // Upload to S3
      if (process.env.AWS_ACCESS_KEY_ID && process.env.BACKUP_S3_BUCKET) {
        await uploadToS3(backupData, `daily/${backupId}.json`);
      } else {
        // Fallback: Store locally or in Convex storage
        console.log("S3 not configured, storing backup locally");
        await ctx.runMutation(internal.backup.backupToS3.storeBackupData, {
          backupId,
          data: backupData,
        });
      }

      console.log(`Automated daily backup completed: ${backupId}`);
      
      // Clean up old backups (keep last 30 days)
      await ctx.runAction(internal.backup.backupToS3.cleanupOldBackups, {
        retentionDays: 30,
      });

    } catch (error) {
      console.error(`Automated backup failed: ${error}`);
      
      await ctx.runMutation(internal.backup.backupToS3.storeBackupMetadata, {
        id: backupId,
        timestamp,
        type: 'incremental',
        version: '1.0',
        tables: [],
        recordCount: 0,
        size: 0,
        location: '',
        checksum: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  },
});

/**
 * Create automated weekly full backup
 */
export const automatedWeeklyBackup = internalAction({
  args: {},
  handler: async (ctx) => {
    const backupId = `backup-full-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`Starting automated weekly full backup: ${backupId}`);
      
      // Create full backup
      const backupData = await ctx.runAction(internal.backup.backupFunctions.createFullBackup, {});

      // Store backup metadata
      await ctx.runMutation(internal.backup.backupToS3.storeBackupMetadata, {
        id: backupId,
        timestamp,
        type: 'full',
        version: backupData.version,
        tables: Object.keys(backupData.tables),
        recordCount: Object.values(backupData.tables).reduce((sum: number, records: any) => sum + (Array.isArray(records) ? records.length : 0), 0),
        size: JSON.stringify(backupData).length,
        location: `s3://${process.env.BACKUP_S3_BUCKET}/weekly/${backupId}.json`,
        checksum: await generateChecksum(JSON.stringify(backupData)),
        status: 'completed',
      });

      // Upload to S3
      if (process.env.AWS_ACCESS_KEY_ID && process.env.BACKUP_S3_BUCKET) {
        await uploadToS3(backupData, `weekly/${backupId}.json`);
      } else {
        // Fallback: Store locally
        console.log("S3 not configured, storing backup locally");
        await ctx.runMutation(internal.backup.backupToS3.storeBackupData, {
          backupId,
          data: backupData,
        });
      }

      console.log(`Automated weekly backup completed: ${backupId}`);
      
      // Clean up old weekly backups (keep last 12 weeks)
      await ctx.runAction(internal.backup.backupToS3.cleanupOldBackups, {
        retentionDays: 84,
        backupType: 'full',
      });

    } catch (error) {
      console.error(`Weekly backup failed: ${error}`);
      
      await ctx.runMutation(internal.backup.backupToS3.storeBackupMetadata, {
        id: backupId,
        timestamp,
        type: 'full',
        version: '1.0',
        tables: [],
        recordCount: 0,
        size: 0,
        location: '',
        checksum: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  },
});

/**
 * Clean up old backups based on retention policy
 */
export const cleanupOldBackups = internalAction({
  args: {
    retentionDays: v.number(),
    backupType: v.optional(v.union(v.literal('full'), v.literal('incremental'))),
  },
  handler: async (ctx, args) => {
    const cutoffDate = new Date(Date.now() - args.retentionDays * 24 * 60 * 60 * 1000);
    
    // Get old backups
    const oldBackups = await ctx.runQuery(internal.backup.backupToS3.getOldBackups, {
      before: cutoffDate.toISOString(),
      type: args.backupType,
    });

    console.log(`Found ${oldBackups.length} backups to clean up`);

    for (const backup of oldBackups) {
      try {
        // Delete from S3
        if (backup.location.startsWith('s3://') && process.env.AWS_ACCESS_KEY_ID) {
          await deleteFromS3(backup.location);
        }

        // Delete metadata and local data
        await ctx.runMutation(internal.backup.backupToS3.deleteBackup, {
          backupId: backup.id,
        });

        console.log(`Deleted backup: ${backup.id}`);
      } catch (error) {
        console.error(`Failed to delete backup ${backup.id}:`, error);
      }
    }
  },
});

/**
 * Restore from backup
 */
export const restoreFromBackup = action({
  args: {
    backupId: v.string(),
    tables: v.optional(v.array(v.string())),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get backup metadata
    const metadata = await ctx.runQuery(internal.backup.backupToS3.getBackupMetadata, {
      backupId: args.backupId,
    });

    if (!metadata) {
      throw new ConvexError(`Backup not found: ${args.backupId}`);
    }

    // Download backup data
    let backupData;
    if (metadata.location.startsWith('s3://')) {
      backupData = await downloadFromS3(metadata.location);
    } else {
      backupData = await ctx.runQuery(internal.backup.backupToS3.getBackupData, {
        backupId: args.backupId,
      });
    }

    // Verify checksum
    const checksum = await generateChecksum(JSON.stringify(backupData));
    if (checksum !== metadata.checksum) {
      throw new ConvexError('Backup integrity check failed');
    }

    // Restore data
    const tablesToRestore = args.tables || Object.keys(backupData.tables);
    const restoreResult = {
      timestamp: new Date().toISOString(),
      backupId: args.backupId,
      tablesRestored: [] as string[],
      recordsRestored: 0,
      errors: [] as string[],
    };

    for (const tableName of tablesToRestore) {
      try {
        const records = backupData.tables[tableName];
        if (!records || records.length === 0) continue;

        if (!args.dryRun) {
          await ctx.runAction(internal.backup.backupRestore.restoreTable, {
            tableName,
            records,
          });
        }

        restoreResult.tablesRestored.push(tableName);
        restoreResult.recordsRestored += records.length;
        
        console.log(`Restored ${records.length} records to ${tableName}`);
      } catch (error) {
        const errorMsg = `Failed to restore ${tableName}: ${error}`;
        console.error(errorMsg);
        restoreResult.errors.push(errorMsg);
      }
    }

    return restoreResult;
  },
});

// Helper functions

async function generateChecksum(data: string): Promise<string> {
  // Simple checksum for now - in production use crypto
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

async function uploadToS3(data: any, key: string): Promise<void> {
  // This would use AWS SDK in a real implementation
  console.log(`Would upload to S3: ${key}`);
  // const s3 = new AWS.S3({ ... });
  // await s3.putObject({ ... }).promise();
}

async function deleteFromS3(location: string): Promise<void> {
  // This would use AWS SDK in a real implementation
  console.log(`Would delete from S3: ${location}`);
  // const s3 = new AWS.S3({ ... });
  // await s3.deleteObject({ ... }).promise();
}

async function downloadFromS3(location: string): Promise<any> {
  // This would use AWS SDK in a real implementation
  console.log(`Would download from S3: ${location}`);
  // const s3 = new AWS.S3({ ... });
  // const result = await s3.getObject({ ... }).promise();
  // return JSON.parse(result.Body.toString());
  return {};
}

// Internal mutations for storing backup metadata

export const storeBackupMetadata = internalMutation({
  args: {
    id: v.string(),
    timestamp: v.string(),
    type: v.union(v.literal('full'), v.literal('incremental')),
    version: v.string(),
    tables: v.array(v.string()),
    recordCount: v.number(),
    size: v.number(),
    location: v.string(),
    checksum: v.string(),
    status: v.union(v.literal('completed'), v.literal('failed'), v.literal('in_progress')),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('backupMetadata', args);
  },
});

export const storeBackupData = internalMutation({
  args: {
    backupId: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('backupData', {
      backupId: args.backupId,
      data: JSON.stringify(args.data),
      createdAt: Date.now(),
    });
  },
});

export const getOldBackups = internalQuery({
  args: {
    before: v.string(),
    type: v.optional(v.union(v.literal('full'), v.literal('incremental'))),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query('backupMetadata')
      .filter(q => q.lt(q.field('timestamp'), args.before));
    
    if (args.type) {
      query = query.filter(q => q.eq(q.field('type'), args.type));
    }
    
    return await query.collect();
  },
});

export const getBackupMetadata = internalQuery({
  args: {
    backupId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.query('backupMetadata')
      .filter(q => q.eq(q.field('id'), args.backupId))
      .first();
  },
});

export const getBackupData = internalQuery({
  args: {
    backupId: v.string(),
  },
  handler: async (ctx, args) => {
    const backup = await ctx.db.query('backupData')
      .filter(q => q.eq(q.field('backupId'), args.backupId))
      .first();
    
    return backup ? JSON.parse(backup.data) : null;
  },
});

export const deleteBackup = internalMutation({
  args: {
    backupId: v.string(),
  },
  handler: async (ctx, args) => {
    // Delete metadata
    const metadata = await ctx.db.query('backupMetadata')
      .filter(q => q.eq(q.field('id'), args.backupId))
      .first();
    
    if (metadata) {
      await ctx.db.delete(metadata._id);
    }
    
    // Delete data
    const data = await ctx.db.query('backupData')
      .filter(q => q.eq(q.field('backupId'), args.backupId))
      .first();
    
    if (data) {
      await ctx.db.delete(data._id);
    }
  },
});

// Import internal mutations
import { internalMutation, internalQuery } from "../_generated/server";