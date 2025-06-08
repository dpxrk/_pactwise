import { MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Helper functions to automatically broadcast real-time events
 * when data changes occur
 */

/**
 * Broadcast contract-related events
 */
export async function broadcastContractEvent(
  ctx: MutationCtx,
  eventType: "contract_created" | "contract_updated" | "contract_deleted",
  contractId: Id<"contracts">,
  userId: Id<"users">,
  enterpriseId: Id<"enterprises">,
  additionalData?: any
) {
  await ctx.db.insert("realtimeEvents", {
    enterpriseId,
    userId,
    eventType,
    resourceId: contractId,
    resourceType: "contracts",
    data: additionalData,
    timestamp: new Date().toISOString(),
    processed: false,
  });
}

/**
 * Broadcast vendor-related events
 */
export async function broadcastVendorEvent(
  ctx: MutationCtx,
  eventType: "vendor_created" | "vendor_updated",
  vendorId: Id<"vendors">,
  userId: Id<"users">,
  enterpriseId: Id<"enterprises">,
  additionalData?: any
) {
  await ctx.db.insert("realtimeEvents", {
    enterpriseId,
    userId,
    eventType,
    resourceId: vendorId,
    resourceType: "vendors",
    data: additionalData,
    timestamp: new Date().toISOString(),
    processed: false,
  });
}

/**
 * Broadcast analysis completion events
 */
export async function broadcastAnalysisEvent(
  ctx: MutationCtx,
  contractId: Id<"contracts">,
  userId: Id<"users">,
  enterpriseId: Id<"enterprises">,
  analysisResults: any
) {
  await ctx.db.insert("realtimeEvents", {
    enterpriseId,
    userId,
    eventType: "analysis_completed",
    resourceId: contractId,
    resourceType: "contracts",
    data: {
      analysisStatus: "completed",
      results: analysisResults,
      completedAt: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
    processed: false,
  });
}

/**
 * Broadcast notification events
 */
export async function broadcastNotificationEvent(
  ctx: MutationCtx,
  notificationId: Id<"notifications">,
  targetUserId: Id<"users">,
  enterpriseId: Id<"enterprises">,
  notificationData: any
) {
  await ctx.db.insert("realtimeEvents", {
    enterpriseId,
    userId: targetUserId, // The user who created the action that caused the notification
    eventType: "notification_created",
    resourceId: notificationId,
    resourceType: "notifications",
    data: notificationData,
    targetUsers: [targetUserId], // Only the target user should receive this
    timestamp: new Date().toISOString(),
    processed: false,
  });
}

/**
 * Broadcast user presence events
 */
export async function broadcastUserEvent(
  ctx: MutationCtx,
  eventType: "user_joined" | "user_left",
  userId: Id<"users">,
  enterpriseId: Id<"enterprises">,
  userData?: any
) {
  await ctx.db.insert("realtimeEvents", {
    enterpriseId,
    userId,
    eventType,
    resourceType: "users",
    data: userData,
    timestamp: new Date().toISOString(),
    processed: false,
  });
}

/**
 * Auto-trigger events when contracts are modified
 * Add this to your existing contract mutations
 */
export async function triggerContractEvents(
  ctx: MutationCtx,
  action: "create" | "update" | "delete",
  contractId: Id<"contracts">,
  userId: Id<"users">,
  enterpriseId: Id<"enterprises">,
  changes?: any
) {
  const eventType = `contract_${action}d` as "contract_created" | "contract_updated" | "contract_deleted";
  
  await broadcastContractEvent(
    ctx,
    eventType,
    contractId,
    userId,
    enterpriseId,
    changes
  );
}

/**
 * Auto-trigger events when vendors are modified
 */
export async function triggerVendorEvents(
  ctx: MutationCtx,
  action: "create" | "update",
  vendorId: Id<"vendors">,
  userId: Id<"users">,
  enterpriseId: Id<"enterprises">,
  changes?: any
) {
  const eventType = `vendor_${action}d` as "vendor_created" | "vendor_updated";
  
  await broadcastVendorEvent(
    ctx,
    eventType,
    vendorId,
    userId,
    enterpriseId,
    changes
  );
}