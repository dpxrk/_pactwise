// convex/schemas/memory_sharing_schema.ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

// ============================================================================
// MEMORY SHARING SCHEMA
// ============================================================================

export const memorySharingTables = {
  // ===== MEMORY SHARING =====
  // Records of memories shared between agents
  memorySharing: defineTable({
    memoryId: v.id("longTermMemory"),
    fromAgentType: v.string(),
    toAgentType: v.string(),
    accessLevel: v.union(
      v.literal("full"),
      v.literal("read"),
      v.literal("summary"),
      v.literal("metadata")
    ),
    reason: v.string(),
    sharedAt: v.string(),
    expiresAt: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_memory", ["memoryId"])
    .index("by_sender", ["fromAgentType"])
    .index("by_recipient", ["toAgentType", "isActive"])
    .index("by_expiry", ["expiresAt"]),
  
  // ===== MEMORY SHARING LOGS =====
  // Audit trail for memory sharing
  memorySharingLogs: defineTable({
    sharingId: v.id("memorySharing"),
    event: v.string(),
    timestamp: v.string(),
    metadata: v.optional(v.any()),
  })
    .index("by_sharing", ["sharingId"])
    .index("by_timestamp", ["timestamp"]),
  
  // ===== MEMORY ACCESS REQUESTS =====
  // Requests for memory access between agents
  memoryAccessRequests: defineTable({
    memoryId: v.id("longTermMemory"),
    requestingAgentType: v.string(),
    ownerAgentType: v.string(),
    reason: v.string(),
    requestedAccessLevel: v.union(
      v.literal("full"),
      v.literal("read"),
      v.literal("summary")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("denied")
    ),
    requestedAt: v.string(),
    decidedAt: v.optional(v.string()),
    decision: v.optional(v.object({
      by: v.string(),
      reason: v.optional(v.string()),
    })),
  })
    .index("by_memory", ["memoryId"])
    .index("by_requester", ["requestingAgentType"])
    .index("by_status", ["status"])
    .index("by_requested_at", ["requestedAt"]),
  
  // ===== MEMORY POOLS =====
  // Shared memory pools for collaborative agent learning
  memoryPools: defineTable({
    name: v.string(),
    description: v.string(),
    participatingAgents: v.array(v.string()),
    memoryTypes: v.array(v.string()),
    sharingPolicy: v.union(
      v.literal("open"),
      v.literal("moderated"),
      v.literal("curated")
    ),
    createdAt: v.string(),
    isActive: v.boolean(),
    stats: v.object({
      memoryCount: v.number(),
      contributionsByAgent: v.record(v.string(), v.number()),
      lastActivityAt: v.string(),
    }),
  })
    .index("by_name", ["name"])
    .index("by_active", ["isActive"])
    .index("by_activity", ["stats.lastActivityAt"]),
  
  // ===== MEMORY POOL ENTRIES =====
  // Individual memories in pools
  memoryPoolEntries: defineTable({
    poolId: v.id("memoryPools"),
    memoryId: v.id("longTermMemory"),
    contributedBy: v.string(),
    contributedAt: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("rejected")
    ),
  })
    .index("by_pool", ["poolId"])
    .index("by_pool_status", ["poolId", "status"])
    .index("by_memory", ["memoryId"])
    .index("by_contributor", ["contributedBy"]),
  
  // ===== MEMORY SYNC SESSIONS =====
  // Bidirectional memory synchronization sessions
  memorySyncSessions: defineTable({
    agent1Type: v.string(),
    agent2Type: v.string(),
    syncType: v.union(
      v.literal("full"),
      v.literal("differential"),
      v.literal("selective")
    ),
    startedAt: v.string(),
    completedAt: v.optional(v.string()),
    status: v.union(
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("failed")
    ),
    stats: v.object({
      agent1ToAgent2: v.number(),
      agent2ToAgent1: v.number(),
      conflicts: v.number(),
      errors: v.number(),
    }),
    error: v.optional(v.string()),
  })
    .index("by_agents", ["agent1Type", "agent2Type"])
    .index("by_status", ["status"])
    .index("by_started", ["startedAt"]),
};