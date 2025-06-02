// convex/notification_schema.ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

// Notification types
const notificationTypeOptions = [
  "contract_expiration",
  "contract_created",
  "approval_required",
  "payment_reminder",
  "vendor_risk_alert",
  "compliance_issue",
  "task_assigned",
  "system_alert",
  "digest", // For batched notifications
] as const;

// Notification priority levels
const notificationPriorityOptions = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

// Notification delivery channels
const notificationChannelOptions = [
  "in_app",
  "email",
  "sms", // Future capability
] as const;

// Notification status
const notificationStatusOptions = [
  "pending",       // Just created, not yet processed
  "scheduled",     // Scheduled for future delivery
  "sending",       // Currently being sent
  "delivered",     // Successfully delivered
  "failed",        // Delivery failed, will retry
  "failed_permanently", // Exceeded retry limit
  "batched",       // Added to batch for digest
  "batched_sent",  // Sent as part of a batch
  "archived",      // Old notifications
] as const;

export const notificationTables = {
  // Main notifications table
  notifications: defineTable({
    // Recipient information
    recipientId: v.id("users"),
    
    // Notification details
    type: v.union(...notificationTypeOptions.map(t => v.literal(t))),
    title: v.string(),
    message: v.string(),
    priority: v.union(...notificationPriorityOptions.map(p => v.literal(p))),
    
    // Delivery information
    channels: v.array(v.union(...notificationChannelOptions.map(c => v.literal(c)))),
    status: v.union(...notificationStatusOptions.map(s => v.literal(s))),
    
    // Read status
    isRead: v.boolean(),
    readAt: v.optional(v.string()), // ISO 8601
    
    // Scheduling
    scheduledFor: v.optional(v.string()), // ISO 8601 - for delayed notifications
    
    // Delivery tracking
    deliveredAt: v.optional(v.string()), // ISO 8601
    lastAttemptAt: v.optional(v.string()), // ISO 8601
    retryCount: v.number(),
    lastError: v.optional(v.string()),
    
    // Batching
    batchId: v.optional(v.id("notifications")), // Reference to digest notification
    
    // Related entities
    contractId: v.optional(v.id("contracts")),
    vendorId: v.optional(v.id("vendors")),
    taskId: v.optional(v.id("agentTasks")),
    
    // Additional data
    metadata: v.optional(v.any()), // Flexible field for notification-specific data
    actionUrl: v.optional(v.string()), // Deep link or URL for action
    
    // Timestamps
    createdAt: v.string(), // ISO 8601
    archivedAt: v.optional(v.string()), // ISO 8601
  })
  .index("by_recipient", ["recipientId"])
  .index("by_recipient_and_status", ["recipientId", "status"])
  .index("by_recipient_and_read", ["recipientId", "isRead"])
  .index("by_status", ["status"])
  .index("by_scheduled", ["status", "scheduledFor"])
  .index("by_type", ["type"])
  .index("by_contract", ["contractId"])
  .index("by_vendor", ["vendorId"]),

  // Notification templates for consistent messaging
  notificationTemplates: defineTable({
    key: v.string(), // Unique identifier (e.g., "contract_expiration")
    name: v.string(),
    description: v.optional(v.string()),
    
    // Template content
    titleTemplate: v.string(), // Can include variables like {{contractTitle}}
    messageTemplate: v.string(), // Can include variables
    
    // Default settings
    defaultPriority: v.union(...notificationPriorityOptions.map(p => v.literal(p))),
    defaultChannels: v.array(v.union(...notificationChannelOptions.map(c => v.literal(c)))),
    
    // Template metadata
    variables: v.optional(v.array(v.string())), // List of available variables
    isActive: v.boolean(),
    
    // Timestamps
    createdAt: v.string(), // ISO 8601
    updatedAt: v.optional(v.string()), // ISO 8601
  })
  .index("by_key", ["key"])
  .index("by_active", ["isActive"]),

  // User notification preferences
  userNotificationPreferences: defineTable({
    userId: v.id("users"),
    
    // Channel preferences
    inAppEnabled: v.boolean(),
    emailEnabled: v.boolean(),
    smsEnabled: v.optional(v.boolean()), // For future use
    
    // Type-specific preferences
    contractNotifications: v.boolean(),
    approvalNotifications: v.boolean(),
    paymentNotifications: v.boolean(),
    vendorNotifications: v.boolean(),
    complianceNotifications: v.boolean(),
    systemNotifications: v.boolean(),
    
    // Delivery preferences
    batchNotifications: v.boolean(), // Whether to batch non-urgent notifications
    quietHoursEnabled: v.boolean(),
    quietHoursStart: v.optional(v.number()), // Hour (0-23)
    quietHoursEnd: v.optional(v.number()), // Hour (0-23)
    timezone: v.optional(v.string()), // User's timezone
    
    // Email preferences
    emailFrequency: v.optional(v.union(
      v.literal("immediate"),
      v.literal("hourly"),
      v.literal("daily"),
      v.literal("weekly"),
    )),
    emailDigestTime: v.optional(v.number()), // Hour for daily digest (0-23)
    
    // Timestamps
    createdAt: v.string(), // ISO 8601
    updatedAt: v.optional(v.string()), // ISO 8601
  })
  .index("by_user", ["userId"]),

  // Notification activity log
  notificationEvents: defineTable({
    notificationId: v.id("notifications"),
    eventType: v.union(
      v.literal("created"),
      v.literal("scheduled"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("failed"),
      v.literal("read"),
      v.literal("clicked"),
      v.literal("dismissed"),
      v.literal("batched"),
    ),
    channel: v.optional(v.union(...notificationChannelOptions.map(c => v.literal(c)))),
    timestamp: v.string(), // ISO 8601
    metadata: v.optional(v.any()), // Additional event data
  })
  .index("by_notification", ["notificationId"])
  .index("by_event_type", ["eventType"])
  .index("by_timestamp", ["timestamp"]),
};

