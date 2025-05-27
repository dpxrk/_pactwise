// convex/agent-schema.ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

// Agent system status
const agentSystemStatus = [
  "stopped", "starting", "running", "paused", "error"
] as const;

// Agent status options
const agentStatus = [
  "inactive", "active", "busy", "error", "disabled"
] as const;

// Agent types
const agentTypes = [
  "manager", "secretary", "financial", "notifications", "legal"
] as const;

// Insight types
const insightTypes = [
  "contract_analysis", "financial_risk", "expiration_warning", 
  "legal_review", "compliance_alert", "performance_metric"
] as const;

// Task status
const taskStatus = [
  "pending", "in_progress", "completed", "failed", "cancelled"
] as const;

// Task priority
const taskPriority = [
  "low", "medium", "high", "critical"
] as const;

export const agentTables = {
  // Agent system configuration and status
  agentSystem: defineTable({
    isRunning: v.boolean(),
    status: v.union(...agentSystemStatus.map(s => v.literal(s))),
    lastStarted: v.optional(v.string()),
    lastStopped: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    config: v.optional(v.any()), // System-wide configuration
    metrics: v.optional(v.any()), // System performance metrics
  }),

  // Individual agent configurations and status
  agents: defineTable({
    name: v.string(),
    type: v.union(...agentTypes.map(t => v.literal(t))),
    status: v.union(...agentStatus.map(s => v.literal(s))),
    description: v.optional(v.string()),
    isEnabled: v.boolean(),
    lastRun: v.optional(v.string()),
    lastSuccess: v.optional(v.string()),
    runCount: v.number(),
    errorCount: v.number(),
    lastError: v.optional(v.string()),
    config: v.optional(v.any()), // Agent-specific configuration
    metrics: v.optional(v.any()), // Agent performance metrics
    createdAt: v.string(),
    updatedAt: v.optional(v.string()),
  })
  .index("by_type", ["type"])
  .index("by_status", ["status"]),

  // Agent-generated insights and analysis
  agentInsights: defineTable({
    agentId: v.id("agents"),
    type: v.union(...insightTypes.map(t => v.literal(t))),
    title: v.string(),
    description: v.string(),
    priority: v.union(...taskPriority.map(p => v.literal(p))),
    contractId: v.optional(v.id("contracts")),
    vendorId: v.optional(v.id("vendors")),
    data: v.optional(v.any()), // Structured insight data
    actionRequired: v.boolean(),
    actionTaken: v.boolean(),
    actionDetails: v.optional(v.string()),
    isRead: v.boolean(),
    expiresAt: v.optional(v.string()),
    createdAt: v.string(),
    readAt: v.optional(v.string()),
  })
  .index("by_agent", ["agentId"])
  .index("by_type", ["type"])
  .index("by_priority", ["priority"])
  .index("by_contract", ["contractId"])
  .index("by_unread", ["isRead"]),

  // Task queue for agent coordination
  agentTasks: defineTable({
    assignedAgentId: v.id("agents"),
    createdByAgentId: v.optional(v.id("agents")),
    taskType: v.string(),
    status: v.union(...taskStatus.map(s => v.literal(s))),
    priority: v.union(...taskPriority.map(p => v.literal(p))),
    title: v.string(),
    description: v.optional(v.string()),
    contractId: v.optional(v.id("contracts")),
    vendorId: v.optional(v.id("vendors")),
    data: v.optional(v.any()), // Task-specific data
    result: v.optional(v.any()), // Task execution result
    errorMessage: v.optional(v.string()),
    scheduledFor: v.optional(v.string()),
    startedAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    createdAt: v.string(),
  })
  .index("by_assigned_agent", ["assignedAgentId"])
  .index("by_status", ["status"])
  .index("by_priority", ["priority"])
  .index("by_scheduled", ["scheduledFor"]),

  // Agent execution logs
  agentLogs: defineTable({
    agentId: v.id("agents"),
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error"), v.literal("debug")),
    message: v.string(),
    data: v.optional(v.any()),
    taskId: v.optional(v.id("agentTasks")),
    timestamp: v.string(),
  })
  .index("by_agent", ["agentId"])
  .index("by_level", ["level"])
  .index("by_timestamp", ["timestamp"])
  .index("by_agent_and_level", ["agentId", "level"]), // Composite index for better performance
};