import { v } from "convex/values";
import { mutation, query, action } from "../_generated/server";
import { ConvexError } from "convex/values";
import { getSecurityContext } from "../security/rowLevelSecurity";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";

// Webhook event types
export const WebhookEventTypes = {
  // Contracts
  CONTRACT_CREATED: "contract.created",
  CONTRACT_UPDATED: "contract.updated",
  CONTRACT_DELETED: "contract.deleted",
  CONTRACT_ANALYZED: "contract.analyzed",
  CONTRACT_EXPIRING: "contract.expiring",
  CONTRACT_EXPIRED: "contract.expired",
  
  // Vendors
  VENDOR_CREATED: "vendor.created",
  VENDOR_UPDATED: "vendor.updated",
  VENDOR_DELETED: "vendor.deleted",
  VENDOR_PERFORMANCE_ALERT: "vendor.performance_alert",
  
  // Users
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_DELETED: "user.deleted",
  USER_ROLE_CHANGED: "user.role_changed",
  
  // Compliance
  COMPLIANCE_ISSUE: "compliance.issue",
  COMPLIANCE_RESOLVED: "compliance.resolved",
  
  // Analytics
  ANALYTICS_REPORT_READY: "analytics.report_ready",
  THRESHOLD_EXCEEDED: "analytics.threshold_exceeded",
} as const;

export type WebhookEventType = typeof WebhookEventTypes[keyof typeof WebhookEventTypes];

// Register a new webhook
export const registerWebhook = mutation({
  args: {
    url: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    events: v.array(v.string()),
    secret: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    headers: v.optional(v.record(v.string(), v.string())),
    retryConfig: v.optional(v.object({
      maxRetries: v.number(),
      initialDelay: v.number(),
      maxDelay: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can manage webhooks
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    // Validate URL
    try {
      new URL(args.url);
    } catch {
      throw new ConvexError("Invalid webhook URL");
    }

    // Validate events
    const validEvents = Object.values(WebhookEventTypes);
    for (const event of args.events) {
      if (!validEvents.includes(event as WebhookEventType)) {
        throw new ConvexError(`Invalid event type: ${event}`);
      }
    }

    // Generate webhook secret if not provided
    const secret = args.secret || generateWebhookSecret();

    const webhook = await ctx.db.insert("webhooks", {
      enterpriseId: securityContext.enterpriseId,
      url: args.url,
      name: args.name,
      description: args.description,
      events: args.events,
      secret,
      isActive: args.isActive !== false,
      headers: args.headers || {},
      retryConfig: args.retryConfig || {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 60000,
      },
      createdBy: securityContext.userId,
      createdAt: new Date().toISOString(),
      lastTriggeredAt: undefined,
      failureCount: 0,
      successCount: 0,
    });

    // Log the creation
    await ctx.db.insert("auditLogs", {
      userId: securityContext.userId,
      enterpriseId: securityContext.enterpriseId,
      operation: "registerWebhook",
      resourceType: "webhooks",
      resourceId: webhook,
      action: "create",
      status: "success",
      timestamp: new Date().toISOString(),
      metadata: { url: args.url, events: args.events }
    });

    return { id: webhook, secret };
  },
});

// List webhooks
export const listWebhooks = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can view webhooks
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    let webhooks = await ctx.db
      .query("webhooks")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
      .collect();

    if (!args.includeInactive) {
      webhooks = webhooks.filter(w => w.isActive);
    }

    // Enrich with creator info
    const enrichedWebhooks = await Promise.all(
      webhooks.map(async (webhook) => {
        const creator = await ctx.db.get(webhook.createdBy);
        return {
          ...webhook,
          creatorName: creator ? `${creator.firstName || ""} ${creator.lastName || ""}`.trim() || creator.email : "Unknown",
          // Hide secret in listing
          secret: undefined,
        };
      })
    );

    return enrichedWebhooks;
  },
});

// Get webhook details
export const getWebhook = query({
  args: {
    webhookId: v.id("webhooks"),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can view webhooks
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) {
      throw new ConvexError("Webhook not found");
    }

    if (webhook.enterpriseId !== securityContext.enterpriseId) {
      throw new ConvexError("Access denied: Webhook belongs to different enterprise");
    }

    // Get recent deliveries
    const deliveries = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_webhook", (q) => q.eq("webhookId", args.webhookId))
      .order("desc")
      .take(10);

    return {
      ...webhook,
      recentDeliveries: deliveries,
    };
  },
});

// Update webhook
export const updateWebhook = mutation({
  args: {
    webhookId: v.id("webhooks"),
    url: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    events: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
    headers: v.optional(v.record(v.string(), v.string())),
    retryConfig: v.optional(v.object({
      maxRetries: v.number(),
      initialDelay: v.number(),
      maxDelay: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can manage webhooks
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) {
      throw new ConvexError("Webhook not found");
    }

    if (webhook.enterpriseId !== securityContext.enterpriseId) {
      throw new ConvexError("Access denied: Webhook belongs to different enterprise");
    }

    // Validate URL if provided
    if (args.url) {
      try {
        new URL(args.url);
      } catch {
        throw new ConvexError("Invalid webhook URL");
      }
    }

    // Validate events if provided
    if (args.events) {
      const validEvents = Object.values(WebhookEventTypes);
      for (const event of args.events) {
        if (!validEvents.includes(event as WebhookEventType)) {
          throw new ConvexError(`Invalid event type: ${event}`);
        }
      }
    }

    const updates: any = {
      updatedAt: new Date().toISOString(),
    };

    if (args.url !== undefined) updates.url = args.url;
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.events !== undefined) updates.events = args.events;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.headers !== undefined) updates.headers = args.headers;
    if (args.retryConfig !== undefined) updates.retryConfig = args.retryConfig;

    await ctx.db.patch(args.webhookId, updates);

    // Log the update
    await ctx.db.insert("auditLogs", {
      userId: securityContext.userId,
      enterpriseId: securityContext.enterpriseId,
      operation: "updateWebhook",
      resourceType: "webhooks",
      resourceId: args.webhookId,
      action: "update",
      status: "success",
      timestamp: new Date().toISOString(),
      changes: updates,
    });

    return { success: true };
  },
});

// Delete webhook
export const deleteWebhook = mutation({
  args: {
    webhookId: v.id("webhooks"),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can manage webhooks
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) {
      throw new ConvexError("Webhook not found");
    }

    if (webhook.enterpriseId !== securityContext.enterpriseId) {
      throw new ConvexError("Access denied: Webhook belongs to different enterprise");
    }

    // Delete related deliveries
    const deliveries = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_webhook", (q) => q.eq("webhookId", args.webhookId))
      .collect();

    for (const delivery of deliveries) {
      await ctx.db.delete(delivery._id);
    }

    await ctx.db.delete(args.webhookId);

    // Log the deletion
    await ctx.db.insert("auditLogs", {
      userId: securityContext.userId,
      enterpriseId: securityContext.enterpriseId,
      operation: "deleteWebhook",
      resourceType: "webhooks",
      resourceId: args.webhookId,
      action: "delete",
      status: "success",
      timestamp: new Date().toISOString(),
      metadata: { url: webhook.url, events: webhook.events }
    });

    return { success: true };
  },
});

// Test webhook
export const testWebhook = action({
  args: {
    webhookId: v.id("webhooks"),
  },
  handler: async (ctx, args) => {
    const webhook = await ctx.runQuery(api.integrations.webhooks.getWebhook, {
      webhookId: args.webhookId,
    });

    if (!webhook) {
      throw new ConvexError("Webhook not found");
    }

    // Create test payload
    const testPayload = {
      event: "webhook.test",
      timestamp: new Date().toISOString(),
      data: {
        message: "This is a test webhook delivery",
        webhookId: args.webhookId,
        webhookName: webhook.name,
      },
    };

    // Send test webhook
    const result = await sendWebhook(webhook, testPayload);

    // Record the test delivery
    await ctx.runMutation(api.integrations.webhooks.recordDelivery, {
      webhookId: args.webhookId,
      event: "webhook.test",
      payload: testPayload,
      response: result.response,
      statusCode: result.statusCode,
      success: result.success,
      error: result.error,
      duration: result.duration,
    });

    return result;
  },
});

// Record webhook delivery (internal)
export const recordDelivery = mutation({
  args: {
    webhookId: v.id("webhooks"),
    event: v.string(),
    payload: v.any(),
    response: v.optional(v.string()),
    statusCode: v.optional(v.number()),
    success: v.boolean(),
    error: v.optional(v.string()),
    duration: v.number(),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("webhookDeliveries", {
      webhookId: args.webhookId,
      event: args.event,
      payload: args.payload,
      response: args.response,
      statusCode: args.statusCode,
      success: args.success,
      error: args.error,
      duration: args.duration,
      retryCount: args.retryCount || 0,
      deliveredAt: new Date().toISOString(),
    });

    // Update webhook stats
    const webhook = await ctx.db.get(args.webhookId);
    if (webhook) {
      if (args.success) {
        await ctx.db.patch(args.webhookId, {
          successCount: webhook.successCount + 1,
          lastTriggeredAt: new Date().toISOString(),
          failureCount: 0, // Reset consecutive failures
        });
      } else {
        await ctx.db.patch(args.webhookId, {
          failureCount: webhook.failureCount + 1,
          lastTriggeredAt: new Date().toISOString(),
        });

        // Disable webhook after too many failures
        if (webhook.failureCount >= 10) {
          await ctx.db.patch(args.webhookId, {
            isActive: false,
          });
        }
      }
    }
  },
});

// Trigger webhook for an event (internal use)
export const triggerWebhook = action({
  args: {
    event: v.string(),
    data: v.any(),
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    // Get all active webhooks for this event
    const webhooks = await ctx.runQuery(api.integrations.webhooks.getWebhooksForEvent, {
      event: args.event,
      enterpriseId: args.enterpriseId,
    });

    const results = await Promise.all(
      webhooks.map(async (webhook) => {
        const payload = {
          event: args.event,
          timestamp: new Date().toISOString(),
          data: args.data,
          enterprise: {
            id: args.enterpriseId,
          },
        };

        const result = await sendWebhookWithRetry(webhook, payload);

        // Record delivery
        await ctx.runMutation(api.integrations.webhooks.recordDelivery, {
          webhookId: webhook._id,
          event: args.event,
          payload,
          response: result.response,
          statusCode: result.statusCode,
          success: result.success,
          error: result.error,
          duration: result.duration,
          retryCount: result.retryCount,
        });

        return result;
      })
    );

    return results;
  },
});

// Get webhooks for a specific event (internal)
export const getWebhooksForEvent = query({
  args: {
    event: v.string(),
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const webhooks = await ctx.db
      .query("webhooks")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return webhooks.filter(w => w.events.includes(args.event));
  },
});

// Get webhook delivery statistics
export const getWebhookStats = query({
  args: {
    webhookId: v.optional(v.id("webhooks")),
    timeRange: v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d")
    ),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only admins can view stats
    if (!["owner", "admin"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Admin access required");
    }

    const timeRanges = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    const startTime = new Date(Date.now() - timeRanges[args.timeRange]);

    let deliveries;
    if (args.webhookId) {
      const webhook = await ctx.db.get(args.webhookId);
      if (!webhook || webhook.enterpriseId !== securityContext.enterpriseId) {
        throw new ConvexError("Webhook not found or access denied");
      }

      deliveries = await ctx.db
        .query("webhookDeliveries")
        .withIndex("by_webhook", (q) => q.eq("webhookId", args.webhookId!))
        .filter((q) => q.gte(q.field("deliveredAt"), startTime.toISOString()))
        .collect();
    } else {
      // Get all webhooks for the enterprise
      const webhooks = await ctx.db
        .query("webhooks")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
        .collect();

      const webhookIds = webhooks.map(w => w._id);
      
      deliveries = await Promise.all(
        webhookIds.map(async (id) => {
          const dels = await ctx.db
            .query("webhookDeliveries")
            .withIndex("by_webhook", (q) => q.eq("webhookId", id))
            .filter((q) => q.gte(q.field("deliveredAt"), startTime.toISOString()))
            .collect();
          return dels;
        })
      ).then(results => results.flat());
    }

    // Calculate statistics
    const totalDeliveries = deliveries.length;
    const successfulDeliveries = deliveries.filter(d => d.success).length;
    const failedDeliveries = totalDeliveries - successfulDeliveries;
    const avgDuration = deliveries.length > 0
      ? deliveries.reduce((sum, d) => sum + d.duration, 0) / deliveries.length
      : 0;

    // Group by event type
    const eventBreakdown = deliveries.reduce((acc, d) => {
      if (!acc[d.event]) {
        acc[d.event] = { total: 0, success: 0, failed: 0 };
      }
      acc[d.event].total++;
      if (d.success) {
        acc[d.event].success++;
      } else {
        acc[d.event].failed++;
      }
      return acc;
    }, {} as Record<string, { total: number; success: number; failed: number }>);

    // Get error breakdown
    const errorBreakdown = deliveries
      .filter(d => !d.success && d.error)
      .reduce((acc, d) => {
        const errorType = d.error!.split(':')[0] || 'Unknown';
        acc[errorType] = (acc[errorType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return {
      timeRange: args.timeRange,
      summary: {
        totalDeliveries,
        successfulDeliveries,
        failedDeliveries,
        successRate: totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0,
        avgDuration: Math.round(avgDuration),
      },
      eventBreakdown: Object.entries(eventBreakdown).map(([event, stats]) => ({
        event,
        ...(stats as any),
        successRate: (stats as any).total > 0 ? ((stats as any).success / (stats as any).total) * 100 : 0,
      })),
      errorBreakdown: Object.entries(errorBreakdown).map(([error, count]) => ({
        error,
        count,
      })),
      recentDeliveries: deliveries
        .sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt))
        .slice(0, 10),
    };
  },
});

// Helper function to generate webhook secret
function generateWebhookSecret(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let secret = 'whsec_';
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

// Helper function to send webhook
async function sendWebhook(webhook: any, payload: any): Promise<any> {
  const startTime = Date.now();
  
  try {
    // Create signature
    const signature = createWebhookSignature(webhook.secret, JSON.stringify(payload));
    
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': new Date().toISOString(),
      ...webhook.headers,
    };

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const responseText = await response.text();
    const duration = Date.now() - startTime;

    return {
      success: response.ok,
      statusCode: response.status,
      response: responseText.substring(0, 1000), // Limit response size
      duration,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration,
    };
  }
}

// Helper function to send webhook with retry
async function sendWebhookWithRetry(webhook: any, payload: any): Promise<any> {
  let lastResult;
  let retryCount = 0;
  const maxRetries = webhook.retryConfig?.maxRetries || 3;
  let delay = webhook.retryConfig?.initialDelay || 1000;
  const maxDelay = webhook.retryConfig?.maxDelay || 60000;

  for (let i = 0; i <= maxRetries; i++) {
    if (i > 0) {
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
      // Exponential backoff
      delay = Math.min(delay * 2, maxDelay);
      retryCount = i;
    }

    lastResult = await sendWebhook(webhook, payload);
    
    if (lastResult.success) {
      lastResult.retryCount = retryCount;
      return lastResult;
    }
    
    // Don't retry on client errors (4xx)
    if (lastResult.statusCode && lastResult.statusCode >= 400 && lastResult.statusCode < 500) {
      break;
    }
  }

  lastResult.retryCount = retryCount;
  return lastResult;
}

// Helper function to create webhook signature
function createWebhookSignature(secret: string, payload: string): string {
  // In a real implementation, use crypto library for HMAC-SHA256
  // This is a simplified version
  return `sha256=${Buffer.from(secret + payload).toString('base64')}`;
}