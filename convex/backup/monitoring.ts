import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get recent backups for monitoring
 */
export const getRecentBackups = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    
    const backups = await ctx.db
      .query("backupMetadata")
      .order("desc")
      .take(limit);
    
    return backups.map(backup => ({
      id: backup.id,
      timestamp: backup.timestamp,
      type: backup.type,
      version: backup.version,
      tables: backup.tables,
      recordCount: backup.recordCount,
      size: backup.size,
      location: backup.location,
      status: backup.status,
      error: backup.error,
    }));
  },
});

/**
 * Get backup statistics
 */
export const getBackupStats = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    const backups = await ctx.db
      .query("backupMetadata")
      .filter(q => q.gte(q.field("timestamp"), since))
      .collect();
    
    const stats = {
      totalBackups: backups.length,
      successfulBackups: backups.filter(b => b.status === 'completed').length,
      failedBackups: backups.filter(b => b.status === 'failed').length,
      totalSize: backups.reduce((sum, b) => sum + b.size, 0),
      totalRecords: backups.reduce((sum, b) => sum + b.recordCount, 0),
      averageSize: 0,
      averageRecords: 0,
      backupTypes: {
        full: backups.filter(b => b.type === 'full').length,
        incremental: backups.filter(b => b.type === 'incremental').length,
      },
      successRate: 0,
    };
    
    if (stats.totalBackups > 0) {
      stats.averageSize = Math.round(stats.totalSize / stats.totalBackups);
      stats.averageRecords = Math.round(stats.totalRecords / stats.totalBackups);
      stats.successRate = (stats.successfulBackups / stats.totalBackups) * 100;
    }
    
    return stats;
  },
});

/**
 * Check if backup is needed
 */
export const isBackupNeeded = query({
  args: {
    maxAgeHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxAge = args.maxAgeHours || 24;
    const cutoff = new Date(Date.now() - maxAge * 60 * 60 * 1000).toISOString();
    
    const recentBackup = await ctx.db
      .query("backupMetadata")
      .filter(q => 
        q.and(
          q.gte(q.field("timestamp"), cutoff),
          q.eq(q.field("status"), "completed")
        )
      )
      .first();
    
    return {
      needed: !recentBackup,
      lastBackup: recentBackup ? {
        timestamp: recentBackup.timestamp,
        ageHours: (Date.now() - new Date(recentBackup.timestamp).getTime()) / (1000 * 60 * 60),
      } : null,
    };
  },
});

/**
 * Get backup storage usage
 */
export const getStorageUsage = query({
  args: {},
  handler: async (ctx) => {
    const allBackups = await ctx.db.query("backupMetadata").collect();
    
    const usage = {
      totalBackups: allBackups.length,
      totalSize: allBackups.reduce((sum, b) => sum + b.size, 0),
      byType: {
        full: {
          count: 0,
          size: 0,
        },
        incremental: {
          count: 0,
          size: 0,
        },
      },
      oldestBackup: null as string | null,
      newestBackup: null as string | null,
    };
    
    allBackups.forEach(backup => {
      if (backup.type === 'full') {
        usage.byType.full.count++;
        usage.byType.full.size += backup.size;
      } else {
        usage.byType.incremental.count++;
        usage.byType.incremental.size += backup.size;
      }
    });
    
    if (allBackups.length > 0) {
      const sorted = allBackups.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      usage.oldestBackup = sorted[0].timestamp;
      usage.newestBackup = sorted[sorted.length - 1].timestamp;
    }
    
    return usage;
  },
});

/**
 * Validate backup integrity
 */
export const validateBackupIntegrity = query({
  args: {
    backupId: v.string(),
  },
  handler: async (ctx, args) => {
    const metadata = await ctx.db
      .query("backupMetadata")
      .filter(q => q.eq(q.field("id"), args.backupId))
      .first();
    
    if (!metadata) {
      return {
        valid: false,
        error: "Backup not found",
      };
    }
    
    const issues = [];
    
    // Check metadata consistency
    if (!metadata.checksum || metadata.checksum.length < 8) {
      issues.push("Invalid or missing checksum");
    }
    
    if (metadata.recordCount === 0 && metadata.type === 'full') {
      issues.push("Full backup has no records");
    }
    
    if (metadata.tables.length === 0) {
      issues.push("No tables in backup");
    }
    
    if (!metadata.location) {
      issues.push("No storage location specified");
    }
    
    // Check if backup data exists (if stored locally)
    if (!metadata.location.startsWith('s3://')) {
      const data = await ctx.db
        .query("backupData")
        .filter(q => q.eq(q.field("backupId"), args.backupId))
        .first();
      
      if (!data) {
        issues.push("Backup data not found in local storage");
      }
    }
    
    return {
      valid: issues.length === 0,
      metadata,
      issues,
    };
  },
});