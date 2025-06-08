// convex/notifications.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { NotificationChannel, NotificationData } from "./types";

// ============================================================================
// USER NOTIFICATIONS
// ============================================================================

/**
 * Create a new notification
 */
export const createNotification = mutation({
  args: {
    recipientId: v.id("users"),
    type: v.union(
      v.literal("contract_expiration"),
      v.literal("contract_created"), 
      v.literal("approval_required"),
      v.literal("payment_reminder"),
      v.literal("vendor_risk_alert"),
      v.literal("compliance_issue"),
      v.literal("task_assigned"),
      v.literal("system_alert"),
      v.literal("digest"),
    ),
    title: v.string(),
    message: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    channels: v.optional(v.array(v.union(v.literal("in_app"), v.literal("email"), v.literal("sms")))),
    contractId: v.optional(v.id("contracts")),
    vendorId: v.optional(v.id("vendors")),
    taskId: v.optional(v.id("agentTasks")),
    actionUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
    scheduledFor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Verify recipient exists
    const recipient = await ctx.db.get(args.recipientId);
    if (!recipient) {
      throw new ConvexError("Recipient not found");
    }

    // Get recipient's notification preferences
    const preferences = await ctx.db
      .query("userNotificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.recipientId))
      .first();

    // Determine delivery channels based on preferences
    let channels: NotificationChannel[] = args.channels || ["in_app"];
    if (preferences) {
      const finalChannels: NotificationChannel[] = [];
      
      if (preferences.inAppEnabled && channels.includes("in_app")) {
        finalChannels.push("in_app");
      }
      
      if (preferences.emailEnabled && channels.includes("email")) {
        // Check type-specific preferences
        const typeEnabled = (
          (args.type === "contract_expiration" || args.type === "contract_created") && preferences.contractNotifications ||
          args.type === "approval_required" && preferences.approvalNotifications ||
          args.type === "payment_reminder" && preferences.paymentNotifications ||
          (args.type === "vendor_risk_alert") && preferences.vendorNotifications ||
          args.type === "compliance_issue" && preferences.complianceNotifications ||
          args.type === "system_alert" && preferences.systemNotifications ||
          args.type === "task_assigned" || // Always enabled for task assignments
          args.type === "digest"
        );
        
        if (typeEnabled) {
          finalChannels.push("email");
        }
      }
      
      if (preferences.smsEnabled && channels.includes("sms")) {
        finalChannels.push("sms");
      }
      
      channels = finalChannels.length > 0 ? finalChannels : ["in_app"];
    }

    // Create the notification
    const notificationId = await ctx.db.insert("notifications", {
      recipientId: args.recipientId,
      type: args.type,
      title: args.title,
      message: args.message,
      priority: args.priority,
      channels: channels,
      status: args.scheduledFor ? "scheduled" : "pending",
      isRead: false,
      scheduledFor: args.scheduledFor,
      retryCount: 0,
      contractId: args.contractId,
      vendorId: args.vendorId,
      taskId: args.taskId,
      actionUrl: args.actionUrl,
      metadata: args.metadata,
      createdAt: new Date().toISOString(),
    });

    // Log creation event
    await ctx.db.insert("notificationEvents", {
      notificationId,
      eventType: "created",
      timestamp: new Date().toISOString(),
      metadata: {
        createdBy: identity.subject,
        channels,
      },
    });

    // If not scheduled, mark as ready for delivery
    if (!args.scheduledFor) {
      await ctx.db.patch(notificationId, {
        status: "delivered", // In a real system, this would be handled by a background job
        deliveredAt: new Date().toISOString(),
      });

      await ctx.db.insert("notificationEvents", {
        notificationId,
        eventType: "delivered",
        timestamp: new Date().toISOString(),
      });
    }

    return { 
      success: true, 
      notificationId,
      channels,
    };
  },
});

/**
 * Get notifications for the current user
 */
export const getMyNotifications = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    includeRead: v.optional(v.boolean()),
    type: v.optional(v.string()),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const limit = Math.min(args.limit || 20, 100);
    const offset = args.offset || 0;

    // Build query
    let query = ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", user._id));

    // Get all notifications first
    let notifications = await query.order("desc").collect();

    // Apply filters
    if (!args.includeRead) {
      notifications = notifications.filter(n => !n.isRead);
    }

    if (args.type) {
      notifications = notifications.filter(n => n.type === args.type);
    }

    if (args.priority) {
      notifications = notifications.filter(n => n.priority === args.priority);
    }

    // Exclude archived notifications
    notifications = notifications.filter(n => n.status !== "archived");

    // Apply pagination
    const paginatedNotifications = notifications.slice(offset, offset + limit);

    // Enrich with related data
    const enrichedNotifications = await Promise.all(
      paginatedNotifications.map(async (notification) => {
        const enriched: any = { ...notification };

        // Add contract info if available
        if (notification.contractId) {
          const contract = await ctx.db.get(notification.contractId);
          if (contract) {
            enriched.contract = {
              _id: contract._id,
              title: contract.title,
              status: contract.status,
            };
          }
        }

        // Add vendor info if available
        if (notification.vendorId) {
          const vendor = await ctx.db.get(notification.vendorId);
          if (vendor) {
            enriched.vendor = {
              _id: vendor._id,
              name: vendor.name,
              category: vendor.category,
            };
          }
        }

        return enriched;
      })
    );

    return {
      notifications: enrichedNotifications,
      total: notifications.length,
      unreadCount: notifications.filter(n => !n.isRead).length,
      hasMore: offset + limit < notifications.length,
    };
  },
});

/**
 * Get unread notification count for the current user
 */
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_and_read", (q) => 
        q.eq("recipientId", user._id).eq("isRead", false)
      )
      .filter((q) => q.neq(q.field("status"), "archived"))
      .collect();

    return {
      total: unreadNotifications.length,
      byPriority: {
        critical: unreadNotifications.filter(n => n.priority === "critical").length,
        high: unreadNotifications.filter(n => n.priority === "high").length,
        medium: unreadNotifications.filter(n => n.priority === "medium").length,
        low: unreadNotifications.filter(n => n.priority === "low").length,
      },
    };
  },
});

/**
 * Mark a notification as read
 */
export const markAsRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new ConvexError("Notification not found");
    }

    // Verify the notification belongs to the user
    if (notification.recipientId !== user._id) {
      throw new ConvexError("Access denied");
    }

    if (notification.isRead) {
      return { success: true, message: "Already marked as read" };
    }

    await ctx.db.patch(args.notificationId, {
      isRead: true,
      readAt: new Date().toISOString(),
    });

    // Log the event
    await ctx.db.insert("notificationEvents", {
      notificationId: args.notificationId,
      eventType: "read",
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  },
});

/**
 * Mark multiple notifications as read
 */
export const markMultipleAsRead = mutation({
  args: {
    notificationIds: v.array(v.id("notifications")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    let successCount = 0;
    const errors: string[] = [];

    for (const notificationId of args.notificationIds) {
      try {
        const notification = await ctx.db.get(notificationId);
        
        if (!notification) {
          errors.push(`Notification ${notificationId} not found`);
          continue;
        }

        if (notification.recipientId !== user._id) {
          errors.push(`Access denied for notification ${notificationId}`);
          continue;
        }

        if (!notification.isRead) {
          await ctx.db.patch(notificationId, {
            isRead: true,
            readAt: new Date().toISOString(),
          });

          await ctx.db.insert("notificationEvents", {
            notificationId,
            eventType: "read",
            timestamp: new Date().toISOString(),
          });

          successCount++;
        }
      } catch (error) {
        errors.push(`Error processing ${notificationId}: ${error}`);
      }
    }

    return {
      success: true,
      successCount,
      totalCount: args.notificationIds.length,
      errors,
    };
  },
});

/**
 * Mark all notifications as read
 */
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_and_read", (q) => 
        q.eq("recipientId", user._id).eq("isRead", false)
      )
      .filter((q) => q.neq(q.field("status"), "archived"))
      .collect();

    const readAt = new Date().toISOString();
    let count = 0;

    for (const notification of unreadNotifications) {
      await ctx.db.patch(notification._id, {
        isRead: true,
        readAt,
      });

      await ctx.db.insert("notificationEvents", {
        notificationId: notification._id,
        eventType: "read",
        timestamp: readAt,
      });

      count++;
    }

    return {
      success: true,
      count,
    };
  },
});

/**
 * Dismiss a notification
 */
export const dismissNotification = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new ConvexError("Notification not found");
    }

    if (notification.recipientId !== user._id) {
      throw new ConvexError("Access denied");
    }

    // Archive the notification
    await ctx.db.patch(args.notificationId, {
      status: "archived",
      archivedAt: new Date().toISOString(),
    });

    await ctx.db.insert("notificationEvents", {
      notificationId: args.notificationId,
      eventType: "dismissed",
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  },
});

// ============================================================================
// NOTIFICATION PREFERENCES
// ============================================================================

/**
 * Get notification preferences for the current user
 */
export const getMyPreferences = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const preferences = await ctx.db
      .query("userNotificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Return defaults if no preferences exist
    if (!preferences) {
      return {
        userId: user._id,
        inAppEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
        contractNotifications: true,
        approvalNotifications: true,
        paymentNotifications: true,
        vendorNotifications: true,
        complianceNotifications: true,
        systemNotifications: true,
        batchNotifications: false,
        quietHoursEnabled: false,
        quietHoursStart: 22,
        quietHoursEnd: 7,
        emailFrequency: "immediate",
        emailDigestTime: 9,
      };
    }

    return preferences;
  },
});

/**
 * Update notification preferences
 */
export const updatePreferences = mutation({
  args: {
    preferences: v.object({
      inAppEnabled: v.optional(v.boolean()),
      emailEnabled: v.optional(v.boolean()),
      smsEnabled: v.optional(v.boolean()),
      contractNotifications: v.optional(v.boolean()),
      approvalNotifications: v.optional(v.boolean()),
      paymentNotifications: v.optional(v.boolean()),
      vendorNotifications: v.optional(v.boolean()),
      complianceNotifications: v.optional(v.boolean()),
      systemNotifications: v.optional(v.boolean()),
      batchNotifications: v.optional(v.boolean()),
      quietHoursEnabled: v.optional(v.boolean()),
      quietHoursStart: v.optional(v.number()),
      quietHoursEnd: v.optional(v.number()),
      timezone: v.optional(v.string()),
      emailFrequency: v.optional(v.union(
        v.literal("immediate"),
        v.literal("hourly"),
        v.literal("daily"),
        v.literal("weekly"),
      )),
      emailDigestTime: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const existingPreferences = await ctx.db
      .query("userNotificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existingPreferences) {
      // Update existing preferences
      await ctx.db.patch(existingPreferences._id, {
        ...args.preferences,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Create new preferences
      await ctx.db.insert("userNotificationPreferences", {
        userId: user._id,
        inAppEnabled: args.preferences.inAppEnabled ?? true,
        emailEnabled: args.preferences.emailEnabled ?? true,
        smsEnabled: args.preferences.smsEnabled ?? false,
        contractNotifications: args.preferences.contractNotifications ?? true,
        approvalNotifications: args.preferences.approvalNotifications ?? true,
        paymentNotifications: args.preferences.paymentNotifications ?? true,
        vendorNotifications: args.preferences.vendorNotifications ?? true,
        complianceNotifications: args.preferences.complianceNotifications ?? true,
        systemNotifications: args.preferences.systemNotifications ?? true,
        batchNotifications: args.preferences.batchNotifications ?? false,
        quietHoursEnabled: args.preferences.quietHoursEnabled ?? false,
        quietHoursStart: args.preferences.quietHoursStart ?? 22,
        quietHoursEnd: args.preferences.quietHoursEnd ?? 7,
        timezone: args.preferences.timezone,
        emailFrequency: args.preferences.emailFrequency ?? "immediate",
        emailDigestTime: args.preferences.emailDigestTime ?? 9,
        createdAt: new Date().toISOString(),
      });
    }

    return { success: true };
  },
});

// ============================================================================
// NOTIFICATION ANALYTICS
// ============================================================================

/**
 * Get notification statistics for the current user
 */
export const getMyNotificationStats = query({
  args: {
    timeRange: v.optional(v.union(
      v.literal("7days"),
      v.literal("30days"),
      v.literal("90days"),
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    // Calculate date range
    const now = new Date();
    const timeRange = args.timeRange || "30days";
    const daysMap = { "7days": 7, "30days": 30, "90days": 90 };
    const cutoffDate = new Date(now.getTime() - daysMap[timeRange] * 24 * 60 * 60 * 1000);

    // Get all notifications in the time range
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", user._id))
      .filter((q) => q.gte(q.field("createdAt"), cutoffDate.toISOString()))
      .collect();

    // Calculate statistics
    const stats = {
      total: notifications.length,
      read: notifications.filter(n => n.isRead).length,
      unread: notifications.filter(n => !n.isRead).length,
      byType: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      byChannel: {} as Record<string, number>,
      deliveryRate: 0,
      readRate: 0,
    };

    // Group by type
    notifications.forEach(n => {
      stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
      stats.byPriority[n.priority] = (stats.byPriority[n.priority] || 0) + 1;
      
      n.channels.forEach(channel => {
        stats.byChannel[channel] = (stats.byChannel[channel] || 0) + 1;
      });
    });

    // Calculate rates
    if (stats.total > 0) {
      const delivered = notifications.filter(n => n.status === "delivered").length;
      stats.deliveryRate = delivered / stats.total;
      stats.readRate = stats.read / stats.total;
    }

    return stats;
  },
});

// ============================================================================
// TEST NOTIFICATIONS (for development)
// ============================================================================

/**
 * Create a test notification (only in development)
 */
export const createTestNotification = mutation({
  args: {
    type: v.optional(v.string()),
    title: v.optional(v.string()),
    message: v.optional(v.string()),
    priority: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical"),
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const notificationId = await ctx.db.insert("notifications", {
      recipientId: user._id,
      type: (args.type || "system_alert") as any,
      title: args.title || "Test Notification",
      message: args.message || "This is a test notification to verify the system is working.",
      priority: args.priority || "medium",
      channels: ["in_app"],
      status: "delivered",
      isRead: false,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      metadata: {
        isTest: true,
        createdBy: user._id,
      },
    });

    return { success: true, notificationId };
  },
});