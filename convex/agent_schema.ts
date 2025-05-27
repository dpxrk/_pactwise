// convex/agent-schema.ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

// Agent system status
const agentSystemStatusOptions = [ // Renamed for clarity with other options arrays
  "stopped", "starting", "running", "paused", "error"
] as const;

// Agent status options
const agentStatusOptions = [ // Renamed
  "inactive", "active", "busy", "error", "disabled"
] as const;

// Agent types - **MAKE THIS LIST COMPREHENSIVE based on agents.types.ts**
const agentTypeOptions = [ // Renamed and ensure this matches your full list
  "manager", "secretary", "financial", "notifications", "legal",
  "analytics", "workflow", "compliance", "risk", "audit",
  "integration", "scheduler", "backup", "monitor" // Added missing types
] as const;

// Insight types - **MAKE THIS LIST COMPREHENSIVE**
const insightTypeOptions = [ // Renamed and ensure this matches your full list
  "contract_analysis", "financial_risk", "expiration_warning",
  "legal_review", "compliance_alert", "performance_metric",
  "cost_optimization", "vendor_risk", "renewal_opportunity", // Added examples
  "negotiation_insight", "audit_finding", "anomaly_detection",
  "trend_analysis", "recommendation", "alert", "report"
] as const;

// Task status - **MAKE THIS LIST COMPREHENSIVE**
const taskStatusOptions = [ // Renamed and ensure this matches your full list
  "pending", "in_progress", "completed", "failed", "cancelled", "timeout" // Added timeout
] as const;

// Task priority
const taskPriorityOptions = [ // Renamed
  "low", "medium", "high", "critical"
] as const;

// Log levels - Add this if not already present, for agentLogs.level
const logLevelOptions = [
  "debug", "info", "warn", "error", "critical"
] as const;


export const agentTables = {
  // Agent system configuration and status
  agentSystem: defineTable({
    isRunning: v.boolean(),
    status: v.union(...agentSystemStatusOptions.map(s => v.literal(s))),
    lastStarted: v.optional(v.string()), // ISO 8601
    lastStopped: v.optional(v.string()), // ISO 8601
    errorMessage: v.optional(v.string()),
    // For more type safety than v.any():
    config: v.optional(v.object({
        maxConcurrentTasks: v.number(),
        taskTimeoutMinutes: v.number(),
        logRetentionDays: v.number(),
        insightRetentionDays: v.optional(v.number()),
        healthCheckIntervalMinutes: v.optional(v.number()),
        autoRestartOnFailure: v.optional(v.boolean()),
        maxRetryAttempts: v.optional(v.number()),
        enabledFeatures: v.optional(v.array(v.string())),
        notifications: v.optional(v.object({
            emailEnabled: v.boolean(),
            slackEnabled: v.boolean(),
            webhookEnabled: v.boolean(),
        })),
    })),
    metrics: v.optional(v.object({
        totalTasksProcessed: v.number(),
        totalInsightsGenerated: v.number(),
        systemUptime: v.number(), // in seconds
        averageTaskDuration: v.optional(v.number()), // in milliseconds
        errorRate: v.optional(v.number()), // 0-1
        lastHealthCheck: v.optional(v.string()), // ISO 8601
        performanceScore: v.optional(v.number()),
    })),
  }),

  // Individual agent configurations and status
  agents: defineTable({
    name: v.string(),
    type: v.union(...agentTypeOptions.map(t => v.literal(t))),
    status: v.union(...agentStatusOptions.map(s => v.literal(s))),
    description: v.optional(v.string()),
    isEnabled: v.boolean(),
    lastRun: v.optional(v.string()), // ISO 8601
    lastSuccess: v.optional(v.string()), // ISO 8601
    runCount: v.number(),
    errorCount: v.number(),
    lastError: v.optional(v.string()),
    // config: v.optional(v.any()), // Consider defining specific structures if possible
    // Example for a more typed config, AgentConfig base + allowing others via v.any() for extensions
    config: v.optional(v.object({
        runIntervalMinutes: v.optional(v.number()),
        retryAttempts: v.optional(v.number()),
        timeoutMinutes: v.optional(v.number()),
        enabled: v.optional(v.boolean()),
        priority: v.optional(v.union(...taskPriorityOptions.map(p => v.literal(p)))),
        dependencies: v.optional(v.array(v.id("agents"))),
        // Allow other fields for specific agent configs, though v.any() is simpler if highly variable
        // ... you can add specific known extended fields here or use a more generic approach with v.any() if needed
        // For truly extensible fields, v.any() or a v.record(v.string(), v.any()) might still be used for a sub-property.
    })),
    // metrics: v.optional(v.any()), // Consider defining specific structures
    metrics: v.optional(v.object({
        totalRuns: v.number(),
        successfulRuns: v.number(),
        failedRuns: v.number(),
        averageRunTime: v.number(), // in ms
        lastRunDuration: v.optional(v.number()), // in ms
        dataProcessed: v.optional(v.number()),
        insightsGenerated: v.optional(v.number()),
        // Allow other fields for specific agent metrics
    })),
    createdAt: v.string(), // Your defined ISO 8601 string
    updatedAt: v.optional(v.string()), // Your defined ISO 8601 string
  })
  .index("by_type", ["type"])
  .index("by_status", ["status"]),

  // Agent-generated insights and analysis
  agentInsights: defineTable({
    agentId: v.id("agents"),
    type: v.union(...insightTypeOptions.map(t => v.literal(t))),
    title: v.string(),
    description: v.string(),
    priority: v.union(...taskPriorityOptions.map(p => v.literal(p))),
    contractId: v.optional(v.id("contracts")),
    vendorId: v.optional(v.id("vendors")),
    data: v.optional(v.any()), // Structured insight data - can be v.object with known shapes
    actionRequired: v.boolean(),
    actionTaken: v.boolean(),
    actionDetails: v.optional(v.string()),
    isRead: v.boolean(),
    expiresAt: v.optional(v.string()), // ISO 8601
    createdAt: v.string(), // Your defined ISO 8601 string
    readAt: v.optional(v.string()), // ISO 8601
    tags: v.optional(v.array(v.string())), // Added from agents.types.ts
    confidence: v.optional(v.number()), // Added from agents.types.ts
  })
  .index("by_agent", ["agentId"])
  .index("by_type", ["type"])
  .index("by_priority", ["priority"])
  .index("by_contract", ["contractId"])
  .index("by_vendor", ["vendorId"]) // Added for consistency if you query by vendorId
  .index("by_unread_and_createdAt", ["isRead", "createdAt"]) // Composite for sorting unread
  .index("by_createdAt", ["createdAt"]), // For querying by your string createdAt

  // Task queue for agent coordination
  agentTasks: defineTable({
    assignedAgentId: v.id("agents"),
    createdByAgentId: v.optional(v.id("agents")),
    taskType: v.string(), // Could be a union if you have a known set of task types
    status: v.union(...taskStatusOptions.map(s => v.literal(s))),
    priority: v.union(...taskPriorityOptions.map(p => v.literal(p))),
    title: v.string(),
    description: v.optional(v.string()),
    contractId: v.optional(v.id("contracts")),
    vendorId: v.optional(v.id("vendors")),
    data: v.optional(v.any()), // Task-specific data
    result: v.optional(v.any()), // Task execution result
    errorMessage: v.optional(v.string()),
    scheduledFor: v.optional(v.string()), // ISO 8601
    startedAt: v.optional(v.string()), // ISO 8601
    completedAt: v.optional(v.string()), // ISO 8601
    createdAt: v.string(), // Your defined ISO 8601 string
    dependencies: v.optional(v.array(v.id("agentTasks"))), // Added from agents.types.ts
    retryCount: v.optional(v.number()), // Added from agents.types.ts
    maxRetries: v.optional(v.number()), // Added from agents.types.ts
  })
  .index("by_assigned_agent", ["assignedAgentId"])
  .index("by_status", ["status"])
  .index("by_priority", ["priority"])
  .index("by_scheduled_and_status", ["scheduledFor", "status"]) // For querying scheduled tasks by status
  .index("by_createdAt", ["createdAt"]), // For querying by your string createdAt

  // Agent execution logs
  agentLogs: defineTable({
    agentId: v.id("agents"), // Or v.string() if it can be non-agent system ID
    level: v.union(...logLevelOptions.map(l => v.literal(l))), // Use the new comprehensive list
    message: v.string(),
    data: v.optional(v.any()), // Can be v.object with known shapes
    taskId: v.optional(v.id("agentTasks")),
    timestamp: v.string(), // Your defined ISO 8601 string for event time
    category: v.optional(v.string()), // Added from manager.ts usage
    source: v.optional(v.string()), // Added from agents.types.ts
    userId: v.optional(v.string()), // Added from agents.types.ts
  })
  .index("by_agent", ["agentId"])
  .index("by_level", ["level"])
  .index("by_timestamp", ["timestamp"]) // Index for your event timestamp
  .index("by_agent_and_level", ["agentId", "level"])
  .index("by_category", ["category"]), // Index if you query by category
};