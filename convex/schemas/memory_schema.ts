// convex/memory_schema.ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { memoryStructuredDataValidator } from "../types/schema_types";

// ============================================================================
// MEMORY SYSTEM SCHEMA
// ============================================================================

// Memory types for categorization
const memoryTypeOptions = [
  "user_preference",      // User preferences and settings
  "interaction_pattern",  // How the user interacts with the system
  "domain_knowledge",     // Business/contract domain specific info
  "conversation_context", // Recent conversation context
  "task_history",        // Previous tasks and outcomes
  "feedback",            // User feedback and corrections
  "entity_relation",     // Relationships between entities
  "process_knowledge",   // Learned workflows and processes
] as const;

// Importance levels for memory prioritization
const importanceLevelOptions = [
  "critical",    // Must never forget (e.g., critical preferences)
  "high",        // Important for personalization
  "medium",      // Useful context
  "low",         // Nice to have
  "temporary",   // Can be forgotten after consolidation
] as const;

// Memory source to track origin
const memorySourceOptions = [
  "explicit_feedback",    // User directly told the system
  "implicit_learning",    // Learned from user behavior
  "task_outcome",        // Result of completed tasks
  "error_correction",    // Learned from mistakes
  "conversation",        // Extracted from conversations
  "system_observation",  // System-detected patterns
] as const;

export const memoryTables = {
  // ===== SHORT-TERM MEMORY =====
  // Stores recent interactions, temporary context, and working memory
  shortTermMemory: defineTable({
    // Core identifiers
    userId: v.id("users"),
    enterpriseId: v.id("enterprises"),
    sessionId: v.string(), // Links to current session
    
    // Memory content
    memoryType: v.union(...memoryTypeOptions.map(option => v.literal(option))),
    content: v.string(), // The actual memory content
    structuredData: v.optional(memoryStructuredDataValidator), // Structured memory data
    
    // Context and relevance
    context: v.object({
      conversationId: v.optional(v.string()),
      taskId: v.optional(v.id("agentTasks")),
      contractId: v.optional(v.id("contracts")),
      vendorId: v.optional(v.id("vendors")),
      agentId: v.optional(v.string()),
      relatedEntities: v.optional(v.array(v.object({
        type: v.string(),
        id: v.string(),
        name: v.optional(v.string()),
      }))),
    }),
    
    // Memory metadata
    importance: v.union(...importanceLevelOptions.map(option => v.literal(option))),
    confidence: v.number(), // 0-1 confidence score
    accessCount: v.number(), // How many times accessed
    lastAccessedAt: v.string(),
    
    // Lifecycle management
    createdAt: v.string(),
    expiresAt: v.optional(v.string()), // When to remove from short-term
    consolidatedAt: v.optional(v.string()), // When moved to long-term
    
    // Processing flags
    isProcessed: v.boolean(), // Has been analyzed for patterns
    shouldConsolidate: v.boolean(), // Flag for moving to long-term
    
    // Source tracking
    source: v.union(...memorySourceOptions.map(option => v.literal(option))),
    sourceMetadata: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean()))), // Additional source info
  })
    .index("by_user_session", ["userId", "sessionId"])
    .index("by_enterprise_user", ["enterpriseId", "userId"])
    .index("by_type_importance", ["memoryType", "importance"])
    .index("by_expiry", ["expiresAt"])
    .index("by_consolidation", ["shouldConsolidate", "consolidatedAt"])
    .index("by_user_type_created", ["userId", "memoryType", "createdAt"]),

  // ===== LONG-TERM MEMORY =====
  // Persistent memory storage with semantic understanding
  longTermMemory: defineTable({
    // Core identifiers
    userId: v.id("users"),
    enterpriseId: v.id("enterprises"),
    
    // Memory content
    memoryType: v.union(...memoryTypeOptions.map(option => v.literal(option))),
    content: v.string(),
    structuredData: v.optional(memoryStructuredDataValidator),
    summary: v.optional(v.string()), // Condensed version
    
    // Semantic search support
    embedding: v.optional(v.array(v.float64())), // Vector embedding for similarity search
    keywords: v.optional(v.array(v.string())), // Extracted keywords
    
    // Enhanced context
    context: v.object({
      domain: v.optional(v.string()), // Business domain
      relatedMemories: v.optional(v.array(v.id("longTermMemory"))),
      contractIds: v.optional(v.array(v.id("contracts"))),
      vendorIds: v.optional(v.array(v.id("vendors"))),
      tags: v.optional(v.array(v.string())),
    }),
    
    // Memory strength and relevance
    importance: v.union(...importanceLevelOptions.map(option => v.literal(option))),
    strength: v.number(), // 0-1, decreases over time without reinforcement
    reinforcementCount: v.number(), // Times this memory was reinforced
    decayRate: v.number(), // How fast the memory decays
    
    // Usage tracking
    accessCount: v.number(),
    lastAccessedAt: v.string(),
    lastReinforcedAt: v.optional(v.string()),
    
    // Lifecycle
    createdAt: v.string(),
    updatedAt: v.string(),
    consolidatedFrom: v.optional(v.array(v.id("shortTermMemory"))), // Source short-term memories
    
    // Quality and validation
    confidence: v.number(),
    isVerified: v.boolean(), // User confirmed this memory
    contradictedBy: v.optional(v.array(v.id("longTermMemory"))), // Conflicting memories
    
    // Source and lineage
    source: v.union(...memorySourceOptions.map(option => v.literal(option))),
    sourceChain: v.optional(v.array(v.string())), // How this knowledge was derived
  })
    .index("by_user", ["userId"])
    .index("by_enterprise_user", ["enterpriseId", "userId"])
    .index("by_type_importance", ["memoryType", "importance"])
    .index("by_strength", ["strength"])
    .index("by_user_type_strength", ["userId", "memoryType", "strength"])
    .index("by_last_accessed", ["lastAccessedAt"])
    .index("by_keywords", ["keywords"]),

  // ===== MEMORY ASSOCIATIONS =====
  // Links between memories for graph-based retrieval
  memoryAssociations: defineTable({
    fromMemoryId: v.id("longTermMemory"),
    toMemoryId: v.id("longTermMemory"),
    associationType: v.union(
      v.literal("causal"),        // A causes/leads to B
      v.literal("contradicts"),   // A contradicts B
      v.literal("supports"),      // A supports/reinforces B
      v.literal("related"),       // A is related to B
      v.literal("precedes"),      // A comes before B
      v.literal("part_of"),       // A is part of B
      v.literal("similar"),       // A is similar to B
    ),
    strength: v.number(), // Association strength 0-1
    confidence: v.number(),
    createdAt: v.string(),
    lastReinforcedAt: v.string(),
  })
    .index("by_from", ["fromMemoryId"])
    .index("by_to", ["toMemoryId"])
    .index("by_type_strength", ["associationType", "strength"]),

  // ===== CONVERSATION THREADS =====
  // Tracks conversation history for context
  conversationThreads: defineTable({
    userId: v.id("users"),
    enterpriseId: v.id("enterprises"),
    title: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("archived"),
    ),
    startedAt: v.string(),
    lastMessageAt: v.string(),
    messageCount: v.number(),
    
    // Context summary
    summary: v.optional(v.string()),
    topics: v.optional(v.array(v.string())),
    sentiment: v.optional(v.union(
      v.literal("positive"),
      v.literal("neutral"),
      v.literal("negative"),
      v.literal("mixed"),
    )),
    
    // Related entities
    relatedContracts: v.optional(v.array(v.id("contracts"))),
    relatedVendors: v.optional(v.array(v.id("vendors"))),
    relatedTasks: v.optional(v.array(v.id("agentTasks"))),
  })
    .index("by_user", ["userId"])
    .index("by_enterprise_user", ["enterpriseId", "userId"])
    .index("by_status", ["status"])
    .index("by_last_message", ["lastMessageAt"]),

  // ===== CONVERSATION MESSAGES =====
  // Individual messages in conversations
  conversationMessages: defineTable({
    threadId: v.id("conversationThreads"),
    userId: v.id("users"),
    enterpriseId: v.id("enterprises"),
    
    // Message content
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    
    // Message metadata
    timestamp: v.string(),
    
    // Processing status
    isProcessed: v.boolean(),
    extractedIntents: v.optional(v.array(v.string())),
    extractedEntities: v.optional(v.array(v.object({
      type: v.string(),
      value: v.string(),
      confidence: v.number(),
    }))),
    
    // Memory references
    referencedMemories: v.optional(v.array(v.union(
      v.id("shortTermMemory"),
      v.id("longTermMemory"),
    ))),
    createdMemories: v.optional(v.array(v.union(
      v.id("shortTermMemory"),
      v.id("longTermMemory"),
    ))),
    
    // Agent interactions
    agentId: v.optional(v.string()),
    agentTaskId: v.optional(v.id("agentTasks")),
  })
    .index("by_thread", ["threadId"])
    .index("by_thread_timestamp", ["threadId", "timestamp"])
    .index("by_user", ["userId"])
    .index("by_processing", ["isProcessed"]),

  // ===== MEMORY CONSOLIDATION JOBS =====
  // Tracks memory consolidation processes
  memoryConsolidationJobs: defineTable({
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    userId: v.id("users"),
    enterpriseId: v.id("enterprises"),
    
    // Job details
    shortTermMemoryIds: v.array(v.id("shortTermMemory")),
    createdLongTermMemoryIds: v.optional(v.array(v.id("longTermMemory"))),
    
    // Processing metadata
    startedAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    error: v.optional(v.string()),
    
    // Statistics
    memoriesProcessed: v.optional(v.number()),
    memoriesConsolidated: v.optional(v.number()),
    patternsFound: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"]),
};