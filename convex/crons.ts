import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled cron jobs for maintenance and optimization
 */

const crons = cronJobs();

// ============================================================================
// DATA CLEANUP JOBS
// ============================================================================

/**
 * Clean up expired events and logs every hour
 */
crons.hourly(
  "cleanup expired data",
  { minuteUTC: 0 }, // Run at the start of every hour
  internal.optimized.events.cleanupExpiredEvents
);

/**
 * Clean up expired cache entries every 30 minutes
 */
crons.interval(
  "cleanup expired cache",
  { minutes: 30 },
  internal.optimized.caching.cleanupExpiredCache
);

/**
 * Clean up old performance logs daily
 */
crons.daily(
  "cleanup performance logs",
  { hourUTC: 3, minuteUTC: 0 }, // Run at 3 AM UTC
  internal.monitoring.performanceMonitoring.cleanupOldLogs,
  { daysToKeep: 30 } // Keep logs for 30 days
);

// ============================================================================
// ANALYTICS & AGGREGATION JOBS
// ============================================================================

/**
 * Pre-warm cache for active enterprises
 */
crons.hourly(
  "warm analytics cache",
  { minuteUTC: 15 }, // Run at 15 minutes past every hour
  internal.optimized.caching.warmCache,
  { 
    // This would need to be implemented to get active enterprise IDs
    enterpriseIds: [] 
  }
);

/**
 * Calculate and cache vendor performance scores
 */
crons.daily(
  "update vendor scores",
  { hourUTC: 2, minuteUTC: 0 }, // Run at 2 AM UTC
  internal.vendors.maintenance.updateAllVendorScores
);

// ============================================================================
// AGENT MEMORY CONSOLIDATION
// ============================================================================

/**
 * Consolidate agent memories daily
 */
crons.daily(
  "consolidate agent memories",
  { hourUTC: 4, minuteUTC: 0 }, // Run at 4 AM UTC
  internal.memory.consolidateAllMemories
);

/**
 * Clean up old agent logs weekly
 */
crons.weekly(
  "cleanup agent logs",
  { dayOfWeek: "sunday", hourUTC: 5, minuteUTC: 0 }, // Sunday at 5 AM UTC
  internal.agents.manager.cleanupOldLogs,
  { daysToKeep: 90 }
);

// ============================================================================
// NOTIFICATION CLEANUP
// ============================================================================

/**
 * Archive old notifications monthly
 */
crons.monthly(
  "archive old notifications",
  { day: 1, hourUTC: 6, minuteUTC: 0 }, // 1st of month at 6 AM UTC
  internal.notifications.archiveOldNotifications,
  { daysToKeep: 180 }
);

// ============================================================================
// CONTRACT MAINTENANCE
// ============================================================================

/**
 * Check for expiring contracts daily
 */
crons.daily(
  "check expiring contracts",
  { hourUTC: 9, minuteUTC: 0 }, // Run at 9 AM UTC
  internal.maintenance.contractMaintenance.checkExpiringContracts,
  { daysAhead: 30 }
);

/**
 * Update contract status for expired contracts
 */
crons.daily(
  "update expired contracts",
  { hourUTC: 0, minuteUTC: 30 }, // Run at 12:30 AM UTC
  internal.maintenance.contractMaintenance.updateExpiredContracts
);

// ============================================================================
// SYSTEM HEALTH CHECKS
// ============================================================================

/**
 * System health check every 5 minutes
 */
crons.interval(
  "system health check",
  { minutes: 5 },
  internal.monitoring.performHealthCheck
);

/**
 * Generate performance report weekly
 */
crons.weekly(
  "performance report",
  { dayOfWeek: "monday", hourUTC: 8, minuteUTC: 0 }, // Monday at 8 AM UTC
  internal.monitoring.generateWeeklyReport
);

// ============================================================================
// BACKUP JOBS
// ============================================================================

/**
 * Create incremental backup daily
 */
crons.daily(
  "incremental backup",
  { hourUTC: 1, minuteUTC: 0 }, // Run at 1 AM UTC
  internal.backup.backupFunctions.createIncrementalBackup
);

/**
 * Create full backup weekly
 */
crons.weekly(
  "full backup",
  { dayOfWeek: "sunday", hourUTC: 2, minuteUTC: 0 }, // Sunday at 2 AM UTC
  internal.backup.backupFunctions.createFullBackup
);

export default crons;