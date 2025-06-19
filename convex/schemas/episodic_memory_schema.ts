// convex/schemas/episodic_memory_schema.ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

// ============================================================================
// EPISODIC MEMORY SCHEMA
// ============================================================================

// Episode types for different interaction contexts
const episodeTypeOptions = [
  "contract_negotiation",
  "vendor_onboarding", 
  "compliance_review",
  "financial_analysis",
  "workflow_execution",
  "problem_resolution",
  "learning_session",
  "system_configuration",
] as const;

// Episode states
const episodeStateOptions = [
  "active",
  "paused",
  "completed",
  "archived",
] as const;

export const episodicMemoryTables = {
  // ===== AGENT MEMORY PROFILES =====
  // Agent-specific memory configurations and capabilities
  agentMemoryProfiles: defineTable({
    agentType: v.string(),
    userId: v.id("users"),
    enterpriseId: v.id("enterprises"),
    initialized: v.string(),
    cognitiveCapabilities: v.array(v.string()),
    memoryConfig: v.object({
      workingMemorySize: v.number(),
      learningRate: v.number(),
      forgettingRate: v.number(),
      associationThreshold: v.number(),
      compressionEnabled: v.boolean(),
      episodicMemoryEnabled: v.boolean(),
    }),
    workingMemory: v.optional(v.array(v.object({
      memoryId: v.union(v.id("shortTermMemory"), v.id("longTermMemory")),
      relevance: v.number(),
      accessTime: v.string(),
    }))),
    stats: v.object({
      totalMemoriesProcessed: v.number(),
      insightsGenerated: v.number(),
      learningCycles: v.number(),
      averageRelevanceScore: v.number(),
    }),
  })
    .index("by_agent_type", ["agentType"])
    .index("by_user", ["userId"])
    .index("by_enterprise", ["enterpriseId"]),
  // ===== EPISODES =====
  // Rich contextual memory episodes
  episodes: defineTable({
    // Core identifiers
    userId: v.id("users"),
    enterpriseId: v.id("enterprises"),
    
    // Episode metadata
    type: v.union(...episodeTypeOptions.map(option => v.literal(option))),
    state: v.union(...episodeStateOptions.map(option => v.literal(option))),
    title: v.string(),
    description: v.optional(v.string()),
    
    // Temporal boundaries
    startTime: v.string(),
    endTime: v.optional(v.string()),
    
    // Context and participants
    context: v.object({
      goal: v.optional(v.string()),
      outcome: v.optional(v.string()),
      participants: v.array(v.object({
        type: v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
        id: v.string(),
        name: v.string(),
        role: v.optional(v.string()),
      })),
      entities: v.array(v.object({
        type: v.string(),
        id: v.string(),
        name: v.string(),
      })),
      tags: v.array(v.string()),
    }),
    
    // Episode timeline
    events: v.array(v.object({
      timestamp: v.string(),
      type: v.string(),
      description: v.string(),
      data: v.optional(v.any()),
      memoryIds: v.optional(v.array(v.id("shortTermMemory"))),
    })),
    
    // Key moments and decisions
    keyMoments: v.array(v.object({
      timestamp: v.string(),
      type: v.union(
        v.literal("decision"),
        v.literal("insight"),
        v.literal("milestone"),
        v.literal("error")
      ),
      description: v.string(),
      impact: v.optional(v.union(
        v.literal("high"),
        v.literal("medium"),
        v.literal("low")
      )),
      memoryId: v.optional(v.id("longTermMemory")),
    })),
    
    // Emotional and cognitive state
    emotionalContext: v.optional(v.object({
      sentiment: v.union(
        v.literal("positive"),
        v.literal("neutral"),
        v.literal("negative"),
        v.literal("mixed")
      ),
      intensity: v.number(), // 0-1
      emotions: v.optional(v.array(v.string())),
    })),
    
    // Learnings and patterns
    learnings: v.array(v.object({
      type: v.union(
        v.literal("pattern"),
        v.literal("preference"),
        v.literal("rule"),
        v.literal("exception")
      ),
      description: v.string(),
      confidence: v.number(),
      applied: v.boolean(),
    })),
    
    // Metrics and performance
    metrics: v.optional(v.object({
      duration: v.optional(v.number()),
      interactionCount: v.optional(v.number()),
      decisionCount: v.optional(v.number()),
      errorCount: v.optional(v.number()),
      successRate: v.optional(v.number()),
      satisfactionScore: v.optional(v.number()),
    })),
  })
    .index("by_user", ["userId"])
    .index("by_user_state", ["userId", "state"])
    .index("by_enterprise_type", ["enterpriseId", "type"])
    .index("by_start_time", ["startTime"])
    .index("by_type_state", ["type", "state"]),
    
  // ===== EPISODE TEMPLATES =====
  // Reusable episode patterns and workflows
  episodeTemplates: defineTable({
    name: v.string(),
    description: v.string(),
    type: v.union(...episodeTypeOptions.map(option => v.literal(option))),
    
    // Template structure
    structure: v.object({
      expectedDuration: v.optional(v.number()), // in minutes
      requiredParticipants: v.array(v.object({
        type: v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
        role: v.string(),
        optional: v.boolean(),
      })),
      expectedEntities: v.array(v.object({
        type: v.string(),
        description: v.string(),
        required: v.boolean(),
      })),
      milestones: v.array(v.object({
        name: v.string(),
        description: v.string(),
        order: v.number(),
        required: v.boolean(),
      })),
    }),
    
    // Success criteria
    successCriteria: v.array(v.object({
      type: v.string(),
      description: v.string(),
      metric: v.optional(v.string()),
      threshold: v.optional(v.number()),
    })),
    
    // Common patterns and pitfalls
    patterns: v.array(v.object({
      type: v.union(v.literal("best_practice"), v.literal("common_error"), v.literal("optimization")),
      description: v.string(),
      recommendation: v.string(),
    })),
    
    // Usage statistics
    usageCount: v.number(),
    successRate: v.number(),
    averageDuration: v.number(),
    lastUsed: v.optional(v.string()),
    
    // Metadata
    createdBy: v.id("users"),
    createdAt: v.string(),
    updatedAt: v.string(),
    isPublic: v.boolean(),
    tags: v.array(v.string()),
  })
    .index("by_type", ["type"])
    .index("by_usage", ["usageCount"])
    .index("by_success_rate", ["successRate"])
    .index("by_public", ["isPublic"]),
    
  // ===== EPISODE CONNECTIONS =====
  // Links between related episodes
  episodeConnections: defineTable({
    fromEpisodeId: v.id("episodes"),
    toEpisodeId: v.id("episodes"),
    connectionType: v.union(
      v.literal("continues"),      // Episode B continues from A
      v.literal("references"),     // Episode B references A
      v.literal("contradicts"),    // Episode B contradicts A
      v.literal("resolves"),       // Episode B resolves issues from A
      v.literal("depends_on"),     // Episode B depends on A
      v.literal("similar_to"),     // Episodes have similar patterns
    ),
    strength: v.number(), // 0-1 connection strength
    description: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_from", ["fromEpisodeId"])
    .index("by_to", ["toEpisodeId"])
    .index("by_type", ["connectionType"]),
};