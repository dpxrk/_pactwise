// convex/agents/manager.ts
import { query, mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

// ============================================================================
// AGENT SYSTEM MANAGEMENT
// ============================================================================

/**
 * Initialize the agent system - creates the system record and default agents
 */
export const initializeAgentSystem = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // Check if system already exists
    const existingSystem = await ctx.db.query("agentSystem").first();
    if (existingSystem) {
      return { success: true, message: "Agent system already initialized" };
    }

    // Create the agent system record
    const systemId = await ctx.db.insert("agentSystem", {
      isRunning: false,
      status: "stopped",
      config: {
        maxConcurrentTasks: 10,
        taskTimeoutMinutes: 30,
        logRetentionDays: 30,
      },
      metrics: {
        totalTasksProcessed: 0,
        totalInsightsGenerated: 0,
        systemUptime: 0,
      },
    });

    // Create the manager agent
    const managerId = await ctx.db.insert("agents", {
      name: "System Manager",
      type: "manager",
      status: "inactive",
      description: "Coordinates and manages all other agents in the system",
      isEnabled: true,
      runCount: 0,
      errorCount: 0,
      config: {
        healthCheckIntervalMinutes: 5,
        taskCleanupHours: 24,
        logCleanupDays: 30,
      },
      metrics: {
        agentsManaged: 0,
        tasksCoordinated: 0,
        healthChecksPerformed: 0,
      },
      createdAt: new Date().toISOString(),
    });

    // Log the initialization
    await ctx.db.insert("agentLogs", {
      agentId: managerId,
      level: "info",
      message: "Agent system initialized successfully",
      data: { systemId, managerId },
      timestamp: new Date().toISOString(),
    });

    return { 
      success: true, 
      message: "Agent system initialized successfully",
      systemId,
      managerId 
    };
  },
});

/**
 * Start the agent system
 */
export const startAgentSystem = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const system = await ctx.db.query("agentSystem").first();
    if (!system) {
      throw new Error("Agent system not initialized. Please initialize first.");
    }

    if (system.isRunning) {
      return { success: true, message: "Agent system is already running" };
    }

    // Update system status
    await ctx.db.patch(system._id, {
      isRunning: true,
      status: "running",
      lastStarted: new Date().toISOString(),
      errorMessage: undefined,
    });

    // Activate the manager agent
    const manager = await ctx.db
      .query("agents")
      .withIndex("by_type", (q) => q.eq("type", "manager"))
      .first();

    if (manager) {
      await ctx.db.patch(manager._id, {
        status: "active",
        lastRun: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Log the startup
      await ctx.db.insert("agentLogs", {
        agentId: manager._id,
        level: "info",
        message: "Agent system started successfully",
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, message: "Agent system started successfully" };
  },
});

/**
 * Stop the agent system
 */
export const stopAgentSystem = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const system = await ctx.db.query("agentSystem").first();
    if (!system) {
      throw new Error("Agent system not found");
    }

    // Update system status
    await ctx.db.patch(system._id, {
      isRunning: false,
      status: "stopped",
      lastStopped: new Date().toISOString(),
    });

    // Deactivate all agents
    const agents = await ctx.db.query("agents").collect();
    for (const agent of agents) {
      await ctx.db.patch(agent._id, {
        status: "inactive",
        updatedAt: new Date().toISOString(),
      });
    }

    // Log the shutdown
    const manager = await ctx.db
      .query("agents")
      .withIndex("by_type", (q) => q.eq("type", "manager"))
      .first();

    if (manager) {
      await ctx.db.insert("agentLogs", {
        agentId: manager._id,
        level: "info",
        message: "Agent system stopped",
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, message: "Agent system stopped successfully" };
  },
});

/**
 * Get agent system status and all agents
 */
export const getAgentSystemStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const system = await ctx.db.query("agentSystem").first();
    const agents = await ctx.db.query("agents").collect();

    // Get recent insights count
    const recentInsights = await ctx.db
      .query("agentInsights")
      .filter((q) => 
        q.gt(q.field("createdAt"), new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      )
      .collect();

    // Get active tasks count
    const activeTasks = await ctx.db
      .query("agentTasks")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const inProgressTasks = await ctx.db
      .query("agentTasks")
      .withIndex("by_status", (q) => q.eq("status", "in_progress"))
      .collect();

    return {
      system: system || null,
      agents: agents || [],
      stats: {
        totalAgents: agents.length,
        activeAgents: agents.filter(a => a.status === "active").length,
        recentInsights: recentInsights.length,
        pendingTasks: activeTasks.length,
        activeTasks: inProgressTasks.length,
      },
    };
  },
});

/**
 * Get recent agent insights
 */
export const getRecentInsights = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const insights = await ctx.db
      .query("agentInsights")
      .order("desc")
      .take(args.limit || 10);

    // Enrich with agent information
    const enrichedInsights = await Promise.all(
      insights.map(async (insight) => {
        const agent = await ctx.db.get(insight.agentId);
        return {
          ...insight,
          agentName: agent?.name || "Unknown Agent",
          agentType: agent?.type || "unknown",
        };
      })
    );

    return enrichedInsights;
  },
});

/**
 * Get agent logs
 */
export const getAgentLogs = query({
  args: {
    agentId: v.optional(v.id("agents")),
    level: v.optional(v.union(v.literal("info"), v.literal("warn"), v.literal("error"), v.literal("debug"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const limit = args.limit || 50;
    let logs: Array<any> = [];

    // Use the most efficient index based on provided arguments
    if (args.agentId && args.level) {
      // Use composite index when both are provided
      logs = await ctx.db
        .query("agentLogs")
        .withIndex("by_agent_and_level", (q) => 
          q.eq("agentId", args.agentId!).eq("level", args.level!)
        )
        .order("desc")
        .take(limit);
    } else if (args.agentId) {
      // Use agent index
      let agentLogs = await ctx.db
        .query("agentLogs")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId!))
        .order("desc")
        .collect();
      
      // Filter by level if provided
      if (args.level) {
        agentLogs = agentLogs.filter((log) => log.level === args.level);
      }
      
      // Apply limit
      logs = agentLogs.slice(0, limit);
    } else if (args.level) {
      // Use level index
      logs = await ctx.db
        .query("agentLogs")
        .withIndex("by_level", (q) => q.eq("level", args.level!))
        .order("desc")
        .take(limit);
    } else {
      // No filters - use timestamp index for most recent logs
      logs = await ctx.db
        .query("agentLogs")
        .withIndex("by_timestamp")
        .order("desc")
        .take(limit);
    }

    // Enrich with agent information
    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        const agent = await ctx.db.get(log.agentId);
        return {
          ...log,
          agentName: agent?.name || "Unknown Agent",
          agentType: agent?.type || "unknown",
        };
      })
    );

    return enrichedLogs;
  },
});

/**
 * Enable or disable an agent
 */
export const toggleAgent = mutation({
  args: {
    agentId: v.id("agents"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    await ctx.db.patch(args.agentId, {
      isEnabled: args.enabled,
      status: args.enabled ? "inactive" : "disabled",
      updatedAt: new Date().toISOString(),
    });

    // Log the change
    await ctx.db.insert("agentLogs", {
      agentId: args.agentId,
      level: "info",
      message: `Agent ${args.enabled ? "enabled" : "disabled"}`,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  },
});

/**
 * Create a test insight (for testing purposes)
 */
export const createTestInsight = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const manager = await ctx.db
      .query("agents")
      .withIndex("by_type", (q) => q.eq("type", "manager"))
      .first();

    if (!manager) {
      throw new Error("Manager agent not found");
    }

    const insightId = await ctx.db.insert("agentInsights", {
      agentId: manager._id,
      type: "performance_metric",
      title: "System Health Check",
      description: "All systems are operating normally. No critical issues detected.",
      priority: "low",
      actionRequired: false,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    return { success: true, insightId };
  },
});

/**
 * Mark insight as read
 */
export const markInsightAsRead = mutation({
  args: {
    insightId: v.id("agentInsights"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    await ctx.db.patch(args.insightId, {
      isRead: true,
      readAt: new Date().toISOString(),
    });

    return { success: true };
  },
});