// convex/agents/notifications.ts
import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * Notifications Agent
 * 
 * Responsibilities:
 * - Send notifications for important events (contract expiry, approvals needed, etc.)
 * - Manage notification preferences and delivery
 * - Track notification history and delivery status
 * - Handle notification batching and scheduling
 * - Manage notification templates
 * - Ensure users receive timely alerts
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const NOTIFICATIONS_CONFIG = {
  // Processing settings
  checkIntervalMinutes: 5,
  batchSize: 20,
  maxRetries: 3,
  
  // Notification types with their settings
  notificationTypes: {
    contract_expiration: {
      priority: "high",
      channels: ["in_app", "email"],
      template: "contract_expiration",
      batchable: true,
    },
    contract_created: {
      priority: "medium",
      channels: ["in_app"],
      template: "contract_created",
      batchable: true,
    },
    approval_required: {
      priority: "high",
      channels: ["in_app", "email"],
      template: "approval_required",
      batchable: false,
    },
    payment_reminder: {
      priority: "high",
      channels: ["in_app", "email"],
      template: "payment_reminder",
      batchable: true,
    },
    vendor_risk_alert: {
      priority: "high",
      channels: ["in_app", "email"],
      template: "vendor_risk",
      batchable: false,
    },
    compliance_issue: {
      priority: "critical",
      channels: ["in_app", "email"],
      template: "compliance_alert",
      batchable: false,
    },
    task_assigned: {
      priority: "medium",
      channels: ["in_app"],
      template: "task_assigned",
      batchable: true,
    },
    system_alert: {
      priority: "medium",
      channels: ["in_app"],
      template: "system_alert",
      batchable: true,
    },
  },
  
  // Delivery settings
  delivery: {
    maxBatchSize: 10,
    batchDelayMinutes: 15,
    quietHoursStart: 22, // 10 PM
    quietHoursEnd: 7,    // 7 AM
    workingDaysOnly: false,
  },
  
  // Retry settings
  retry: {
    delays: [5, 15, 60], // Minutes between retries
    maxAttempts: 3,
  },
};

// Extended metrics for notifications agent
interface NotificationsAgentMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageRunTime: number;
  lastRunDuration?: number;
  dataProcessed?: number;
  insightsGenerated?: number;
  // Notification-specific metrics
  notificationsSent?: number;
  notificationsDelivered?: number;
  notificationsFailed?: number;
  notificationsBatched?: number;
  averageDeliveryTime?: number;
  channelBreakdown?: Record<string, number>;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export const run = internalMutation({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    
    try {
      await ctx.db.insert("agentLogs", {
        agentId: args.agentId,
        level: "info",
        message: "Notifications agent starting run",
        timestamp: new Date().toISOString(),
        category: "agent_execution",
      });

      await ctx.db.patch(args.agentId, {
        status: "busy",
        lastRun: new Date().toISOString(),
      });

      // Process notification tasks
      const tasksProcessed = await processNotificationTasks(ctx, args.agentId);
      
      // Check for scheduled notifications
      const scheduledSent = await sendScheduledNotifications(ctx, args.agentId);
      
      // Process notification batches
      const batchesSent = await processBatchedNotifications(ctx, args.agentId);
      
      // Retry failed notifications
      const retriesProcessed = await retryFailedNotifications(ctx, args.agentId);
      
      // Clean up old notifications
      await cleanupOldNotifications(ctx, args.agentId);
      
      // Generate notification insights
      await generateNotificationInsights(ctx, args.agentId);

      // Update metrics
      await updateAgentMetrics(ctx, args.agentId, {
        runTime: Date.now() - startTime,
        tasksProcessed,
        scheduledSent,
        batchesSent,
        retriesProcessed,
      });

      return { 
        success: true, 
        tasksProcessed,
        notificationsSent: scheduledSent + batchesSent,
        retriesProcessed,
      };

    } catch (error) {
      await handleAgentError(ctx, args.agentId, error);
      throw error;
    }
  },
});

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

async function processNotificationTasks(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  const tasks = await ctx.db
    .query("agentTasks")
    .withIndex("by_assigned_agent", (q: any) => q.eq("assignedAgentId", agentId))
    .filter((q: any) => 
      q.and(
        q.eq(q.field("status"), "pending"),
        q.eq(q.field("taskType"), "send_notification")
      )
    )
    .take(NOTIFICATIONS_CONFIG.batchSize);

  let processed = 0;

  for (const task of tasks) {
    try {
      await ctx.db.patch(task._id, {
        status: "in_progress",
        startedAt: new Date().toISOString(),
      });

      // Create notification from task
      const notification = await createNotificationFromTask(ctx, task);
      
      // Send or schedule the notification
      if (shouldSendImmediately(notification)) {
        await sendNotification(ctx, notification);
      } else if (isBatchable(notification)) {
        await addToBatch(ctx, notification);
      } else {
        await scheduleNotification(ctx, notification);
      }

      await ctx.db.patch(task._id, {
        status: "completed",
        completedAt: new Date().toISOString(),
        result: { notificationId: notification._id },
      });

      processed++;

    } catch (error) {
      await ctx.db.patch(task._id, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date().toISOString(),
      });

      await ctx.db.insert("agentLogs", {
        agentId,
        level: "error",
        message: `Failed to process notification task ${task._id}`,
        data: { taskId: task._id, error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date().toISOString(),
        category: "task_processing",
      });
    }
  }

  return processed;
}

async function sendScheduledNotifications(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  const now = new Date();
  
  // Get notifications that are scheduled and due
  const dueNotifications = await ctx.db
    .query("notifications")
    .filter((q: any) => 
      q.and(
        q.eq(q.field("status"), "scheduled"),
        q.lte(q.field("scheduledFor"), now.toISOString())
      )
    )
    .take(NOTIFICATIONS_CONFIG.batchSize);

  let sent = 0;

  for (const notification of dueNotifications) {
    try {
      await sendNotification(ctx, notification);
      sent++;
    } catch (error) {
      await handleNotificationError(ctx, notification, error);
    }
  }

  return sent;
}

async function processBatchedNotifications(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  // Get batched notifications older than batch delay
  const batchCutoff = new Date(Date.now() - NOTIFICATIONS_CONFIG.delivery.batchDelayMinutes * 60 * 1000);
  
  const batchedNotifications = await ctx.db
    .query("notifications")
    .filter((q: any) => 
      q.and(
        q.eq(q.field("status"), "batched"),
        q.lte(q.field("createdAt"), batchCutoff.toISOString())
      )
    )
    .collect();

  if (batchedNotifications.length === 0) return 0;

  // Group by recipient and type
  const batches = groupNotificationsForBatching(batchedNotifications);
  let totalSent = 0;

  for (const batch of batches) {
    try {
      await sendBatchedNotifications(ctx, batch);
      totalSent += batch.notifications.length;
    } catch (error) {
      await ctx.db.insert("agentLogs", {
        agentId,
        level: "error",
        message: "Failed to send notification batch",
        data: { 
          recipientId: batch.recipientId,
          notificationCount: batch.notifications.length,
          error: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date().toISOString(),
        category: "batch_delivery",
      });
    }
  }

  return totalSent;
}

async function retryFailedNotifications(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  const failedNotifications = await ctx.db
    .query("notifications")
    .filter((q: any) => 
      q.and(
        q.eq(q.field("status"), "failed"),
        q.lt(q.field("retryCount"), NOTIFICATIONS_CONFIG.maxRetries)
      )
    )
    .take(NOTIFICATIONS_CONFIG.batchSize);

  let retried = 0;

  for (const notification of failedNotifications) {
    const retryDelay = NOTIFICATIONS_CONFIG.retry.delays[notification.retryCount || 0] || 60;
    const lastAttempt = new Date(notification.lastAttemptAt || notification.createdAt);
    const nextRetryTime = new Date(lastAttempt.getTime() + retryDelay * 60 * 1000);

    if (nextRetryTime <= new Date()) {
      try {
        await sendNotification(ctx, notification);
        retried++;
      } catch (error) {
        await handleNotificationError(ctx, notification, error);
      }
    }
  }

  return retried;
}

async function cleanupOldNotifications(
  ctx: any,
  agentId: Id<"agents">
): Promise<void> {
  // Archive notifications older than 90 days
  const archiveCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  
  const oldNotifications = await ctx.db
    .query("notifications")
    .filter((q: any) => 
      q.and(
        q.lte(q.field("createdAt"), archiveCutoff.toISOString()),
        q.neq(q.field("status"), "archived")
      )
    )
    .take(100);

  for (const notification of oldNotifications) {
    await ctx.db.patch(notification._id, {
      status: "archived",
      archivedAt: new Date().toISOString(),
    });
  }
}

async function generateNotificationInsights(
  ctx: any,
  agentId: Id<"agents">
): Promise<void> {
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  // Get notification statistics
  const recentNotifications = await ctx.db
    .query("notifications")
    .filter((q: any) => q.gte(q.field("createdAt"), last24Hours.toISOString()))
    .collect();

  if (recentNotifications.length < 10) return; // Not enough data

  const stats = {
    total: recentNotifications.length,
    byType: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    byChannel: {} as Record<string, number>,
    deliveryRate: 0,
    averageDeliveryTime: 0,
  };

  let totalDeliveryTime = 0;
  let deliveredCount = 0;

  for (const notification of recentNotifications) {
    // Count by type
    stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
    
    // Count by status
    stats.byStatus[notification.status] = (stats.byStatus[notification.status] || 0) + 1;
    
    // Count by channel
    for (const channel of notification.channels) {
      stats.byChannel[channel] = (stats.byChannel[channel] || 0) + 1;
    }
    
    // Calculate delivery metrics
    if (notification.deliveredAt) {
      deliveredCount++;
      const deliveryTime = new Date(notification.deliveredAt).getTime() - 
                          new Date(notification.createdAt).getTime();
      totalDeliveryTime += deliveryTime;
    }
  }

  stats.deliveryRate = deliveredCount / stats.total;
  stats.averageDeliveryTime = deliveredCount > 0 ? totalDeliveryTime / deliveredCount : 0;

  // Create insights based on stats
  if (stats.deliveryRate < 0.9) {
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "alert",
      title: "Low Notification Delivery Rate",
      description: `Only ${(stats.deliveryRate * 100).toFixed(1)}% of notifications are being delivered successfully`,
      priority: "high",
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: stats,
    });
  }

  // Check for notification spikes
  const highVolumeTypes = Object.entries(stats.byType)
    .filter(([_, count]) => count > stats.total * 0.4)
    .map(([type]) => type);

  if (highVolumeTypes.length > 0) {
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "trend_analysis",
      title: "High Volume Notification Types",
      description: `${highVolumeTypes.join(', ')} notifications are unusually high`,
      priority: "medium",
      actionRequired: false,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: { highVolumeTypes, stats },
    });
  }
}

// ============================================================================
// NOTIFICATION HANDLING FUNCTIONS
// ============================================================================

async function createNotificationFromTask(ctx: any, task: any): Promise<any> {
  const notificationType = task.data?.notificationType || "system_alert";
  const config = NOTIFICATIONS_CONFIG.notificationTypes[notificationType as keyof typeof NOTIFICATIONS_CONFIG.notificationTypes];
  
  // Determine recipient
  let recipientId: Id<"users"> | null = null;
  if (task.data?.recipientUserId) {
    recipientId = task.data.recipientUserId;
  } else if (task.data?.recipient === "contract_owner_or_manager" && task.contractId) {
    // Find contract owner or assigned user
    const contract = await ctx.db.get(task.contractId);
    if (contract) {
      // For now, we'll need to implement logic to find the appropriate user
      // This is a placeholder - you'd need to add contract ownership tracking
      const contractManagers = await ctx.db
        .query("users")
        .withIndex("by_enterprise", (q: any) => q.eq("enterpriseId", contract.enterpriseId))
        .filter((q: any) => 
          q.or(
            q.eq(q.field("role"), "owner"),
            q.eq(q.field("role"), "admin"),
            q.eq(q.field("role"), "manager")
          )
        )
        .first();
      
      recipientId = contractManagers?._id || null;
    }
  }

  if (!recipientId) {
    throw new Error("Could not determine notification recipient");
  }

  // Get user preferences
  const user = await ctx.db.get(recipientId);
  const preferences = await getUserNotificationPreferences(ctx, recipientId);
  
  // Determine which channels to use
  const channels = config?.channels || ["in_app"];
  const enabledChannels = channels.filter(channel => {
    if (channel === "in_app") return preferences.inApp;
    if (channel === "email") return preferences.email;
    return false;
  });

  const notificationId = await ctx.db.insert("notifications", {
    recipientId,
    type: notificationType,
    title: task.data?.title || task.title || "New Notification",
    message: task.data?.message || "You have a new notification",
    priority: task.data?.urgency || config?.priority || "medium",
    channels: enabledChannels,
    status: "pending",
    isRead: false,
    metadata: {
      taskId: task._id,
      contractId: task.contractId,
      vendorId: task.vendorId,
      ...task.data,
    },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });

  return await ctx.db.get(notificationId);
}

async function sendNotification(ctx: any, notification: any): Promise<void> {
  try {
    await ctx.db.patch(notification._id, {
      status: "sending",
      lastAttemptAt: new Date().toISOString(),
    });

    // In-app notification is always created
    if (notification.channels.includes("in_app")) {
      // Already stored in database, just mark as delivered for in-app
    }

    // Email notification (placeholder for actual email sending)
    if (notification.channels.includes("email")) {
      await sendEmailNotification(ctx, notification);
    }

    // Mark as delivered
    await ctx.db.patch(notification._id, {
      status: "delivered",
      deliveredAt: new Date().toISOString(),
    });

  } catch (error) {
    throw error;
  }
}

async function sendEmailNotification(ctx: any, notification: any): Promise<void> {
  // This is a placeholder for actual email sending
  // In a real implementation, you would:
  // 1. Get user's email from the users table
  // 2. Use an email service (SendGrid, AWS SES, etc.)
  // 3. Apply the appropriate template
  // 4. Send the email
  
  await ctx.db.insert("agentLogs", {
    agentId: notification.agentId || "system",
    level: "info",
    message: "Email notification would be sent here",
    data: {
      notificationId: notification._id,
      recipientId: notification.recipientId,
      type: notification.type,
    },
    timestamp: new Date().toISOString(),
    category: "email_delivery",
  });
}

async function sendBatchedNotifications(ctx: any, batch: any): Promise<void> {
  // Create a digest notification
  const digestNotification = {
    recipientId: batch.recipientId,
    type: "digest",
    title: `You have ${batch.notifications.length} notifications`,
    message: createDigestMessage(batch.notifications),
    priority: "medium",
    channels: ["in_app", "email"],
    status: "sending",
    isRead: false,
    metadata: {
      batchedNotificationIds: batch.notifications.map((n: any) => n._id),
      originalTypes: [...new Set(batch.notifications.map((n: any) => n.type))],
    },
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };

  const digestId = await ctx.db.insert("notifications", digestNotification);

  // Mark original notifications as part of batch
  for (const notification of batch.notifications) {
    await ctx.db.patch(notification._id, {
      status: "batched_sent",
      batchId: digestId,
      deliveredAt: new Date().toISOString(),
    });
  }

  // Send the digest
  const digest = await ctx.db.get(digestId);
  await sendNotification(ctx, digest);
}

async function handleNotificationError(ctx: any, notification: any, error: any): Promise<void> {
  const retryCount = (notification.retryCount || 0) + 1;
  
  await ctx.db.patch(notification._id, {
    status: retryCount >= NOTIFICATIONS_CONFIG.maxRetries ? "failed_permanently" : "failed",
    retryCount,
    lastError: error instanceof Error ? error.message : String(error),
    lastAttemptAt: new Date().toISOString(),
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function shouldSendImmediately(notification: any): boolean {
  if (notification.priority === "critical") return true;
  
  const now = new Date();
  const hour = now.getHours();
  
  // Check quiet hours
  if (NOTIFICATIONS_CONFIG.delivery.quietHoursStart > NOTIFICATIONS_CONFIG.delivery.quietHoursEnd) {
    // Quiet hours span midnight
    if (hour >= NOTIFICATIONS_CONFIG.delivery.quietHoursStart || hour < NOTIFICATIONS_CONFIG.delivery.quietHoursEnd) {
      return false;
    }
  } else {
    // Normal quiet hours
    if (hour >= NOTIFICATIONS_CONFIG.delivery.quietHoursStart && hour < NOTIFICATIONS_CONFIG.delivery.quietHoursEnd) {
      return false;
    }
  }
  
  // Check working days
  if (NOTIFICATIONS_CONFIG.delivery.workingDaysOnly) {
    const day = now.getDay();
    if (day === 0 || day === 6) return false; // Weekend
  }
  
  return true;
}

function isBatchable(notification: any): boolean {
  const config = NOTIFICATIONS_CONFIG.notificationTypes[notification.type as keyof typeof NOTIFICATIONS_CONFIG.notificationTypes];
  return config?.batchable || false;
}

async function addToBatch(ctx: any, notification: any): Promise<void> {
  await ctx.db.patch(notification._id, {
    status: "batched",
  });
}

async function scheduleNotification(ctx: any, notification: any): Promise<void> {
  const now = new Date();
  let scheduledTime = new Date();
  
  // Schedule for next available time
  if (now.getHours() >= NOTIFICATIONS_CONFIG.delivery.quietHoursStart) {
    // Schedule for tomorrow morning
    scheduledTime.setDate(scheduledTime.getDate() + 1);
    scheduledTime.setHours(NOTIFICATIONS_CONFIG.delivery.quietHoursEnd, 0, 0, 0);
  } else if (now.getHours() < NOTIFICATIONS_CONFIG.delivery.quietHoursEnd) {
    // Schedule for this morning
    scheduledTime.setHours(NOTIFICATIONS_CONFIG.delivery.quietHoursEnd, 0, 0, 0);
  }
  
  await ctx.db.patch(notification._id, {
    status: "scheduled",
    scheduledFor: scheduledTime.toISOString(),
  });
}

function groupNotificationsForBatching(notifications: any[]): any[] {
  const groups = new Map<string, any[]>();
  
  for (const notification of notifications) {
    const key = `${notification.recipientId}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(notification);
  }
  
  return Array.from(groups.entries()).map(([key, notifications]) => ({
    recipientId: notifications[0].recipientId,
    notifications: notifications.slice(0, NOTIFICATIONS_CONFIG.delivery.maxBatchSize),
  }));
}

function createDigestMessage(notifications: any[]): string {
  const typeCount = notifications.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const summaries = Object.entries(typeCount).map(([type, count]:[string, any]) => {
    const typeName = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return `${count} ${typeName}${count > 1 ? 's' : ''}`;
  });
  
  return `You have ${summaries.join(', ')}. Click to view details.`;
}

async function getUserNotificationPreferences(ctx: any, userId: Id<"users">): Promise<any> {
  // For now, return default preferences
  // In a real implementation, you'd fetch from a user preferences table
  return {
    inApp: true,
    email: true,
    sms: false,
    contractNotifications: true,
    approvalNotifications: true,
    signatureNotifications: true,
    analyticsNotifications: false,
  };
}

async function updateAgentMetrics(
  ctx: any,
  agentId: Id<"agents">,
  runData: {
    runTime: number;
    tasksProcessed: number;
    scheduledSent: number;
    batchesSent: number;
    retriesProcessed: number;
  }
): Promise<void> {
  const agent = await ctx.db.get(agentId);
  if (!agent) return;

  const existingMetrics = (agent.metrics as NotificationsAgentMetrics) || {
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    averageRunTime: 0,
    notificationsSent: 0,
    notificationsDelivered: 0,
    notificationsFailed: 0,
    notificationsBatched: 0,
  };

  const newMetrics: NotificationsAgentMetrics = {
    ...existingMetrics,
    totalRuns: existingMetrics.totalRuns + 1,
    successfulRuns: existingMetrics.successfulRuns + 1,
    averageRunTime: 
      ((existingMetrics.averageRunTime * existingMetrics.totalRuns) + runData.runTime) / 
      (existingMetrics.totalRuns + 1),
    lastRunDuration: runData.runTime,
    notificationsSent: (existingMetrics.notificationsSent || 0) + runData.scheduledSent + runData.batchesSent,
    dataProcessed: (existingMetrics.dataProcessed || 0) + runData.tasksProcessed,
  };

  await ctx.db.patch(agentId, {
    status: "active",
    lastSuccess: new Date().toISOString(),
    runCount: (agent.runCount || 0) + 1,
    metrics: newMetrics,
  });
}

async function handleAgentError(ctx: any, agentId: Id<"agents">, error: any): Promise<void> {
  await ctx.db.insert("agentLogs", {
    agentId,
    level: "error",
    message: "Notifications agent failed",
    data: { error: error instanceof Error ? error.message : String(error) },
    timestamp: new Date().toISOString(),
    category: "agent_execution",
  });

  const agent = await ctx.db.get(agentId);
  if (agent) {
    const existingMetrics = (agent.metrics as NotificationsAgentMetrics) || {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      averageRunTime: 0,
    };

    await ctx.db.patch(agentId, {
      status: "error",
      errorCount: (agent.errorCount || 0) + 1,
      lastError: error instanceof Error ? error.message : String(error),
      metrics: {
        ...existingMetrics,
        totalRuns: existingMetrics.totalRuns + 1,
        failedRuns: existingMetrics.failedRuns + 1,
      },
    });
  }
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

export const getPendingNotifications = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .filter((q: any) => 
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "scheduled"),
          q.eq(q.field("status"), "batched")
        )
      )
      .order("desc")
      .take(args.limit || 50);

    return notifications;
  },
});

export const getNotificationStats = internalQuery({
  args: {
    timeRange: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cutoffDate = args.timeRange === "24h" 
      ? new Date(Date.now() - 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const notifications = await ctx.db
      .query("notifications")
      .filter((q: any) => q.gte(q.field("createdAt"), cutoffDate.toISOString()))
      .collect();

    const stats = {
      total: notifications.length,
      pending: notifications.filter(n => n.status === "pending").length,
      delivered: notifications.filter(n => n.status === "delivered").length,
      failed: notifications.filter(n => n.status === "failed" || n.status === "failed_permanently").length,
      batched: notifications.filter(n => n.status === "batched").length,
    };

    return stats;
  },
});