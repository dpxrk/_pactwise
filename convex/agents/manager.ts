import { query, mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel"; // Keep for potential explicit Id type usage

// ============================================================================
// AGENT SYSTEM MANAGEMENT
// ============================================================================

const taskPriorityOptions = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

const insightTypeOptions = [
    "contract_analysis",    // Contract content analysis
    "financial_risk",       // Financial risk assessment
    "expiration_warning",   // Contract expiration alerts
    "legal_review",         // Legal compliance issues
    "compliance_alert",     // Regulatory compliance warnings
    "performance_metric",   // Performance and KPI insights
    "cost_optimization",    // Cost-saving opportunities
    "vendor_risk",          // Vendor risk assessment
    "renewal_opportunity",  // Contract renewal suggestions
    "negotiation_insight",  // Contract negotiation recommendations
    "audit_finding",        // Audit-related discoveries
    "anomaly_detection",    // Unusual patterns or outliers
    "trend_analysis",       // Historical trend insights
    "recommendation",       // General recommendations
    "alert",                // General system alerts
    "report",               // Automated reports
] as const;


export const initializeAgentSystem = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required: No user identity found.");
    }

    // Check if system already exists
    const existingSystem = await ctx.db.query("agentSystem").first();
    if (existingSystem) {
      return { success: true, message: "Agent system already initialized.", systemId: existingSystem._id };
    }

    // Create the agent system record
    const systemId = await ctx.db.insert("agentSystem", {
      isRunning: false,
      status: "stopped",
      config: {
        maxConcurrentTasks: 10,
        taskTimeoutMinutes: 30,
        logRetentionDays: 30,
        // Add other AgentSystemConfig defaults as needed
      },
      metrics: {
        totalTasksProcessed: 0,
        totalInsightsGenerated: 0,
        systemUptime: 0,
        // Add other AgentSystemMetrics defaults as needed
      },
    });

    // Create the default manager agent
    const managerAgentConfig = { // Explicitly defining for clarity, matches ManagerAgentConfig
      runIntervalMinutes: 5, // Default for manager specific config
      retryAttempts: 3,
      timeoutMinutes: 10,
      healthCheckIntervalMinutes: 5,
      taskCleanupHours: 24,
      logCleanupDays: 30,
      agentRestartThreshold: 3,
      systemMetricsCollectionInterval: 15,
    };

    const managerAgentMetrics = { // Matches AgentMetrics with custom fields for manager
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        averageRunTime: 0,
        // Manager-specific metrics below
        agentsManaged: 0, // This would be dynamically updated
        tasksCoordinated: 0,
        healthChecksPerformed: 0,
    };

    const managerId = await ctx.db.insert("agents", {
      name: "System Manager",
      type: "manager", // Make sure "manager" is in your agentTypeOptions in agent-schema.ts
      status: "inactive",
      description: "Coordinates and manages all other agents in the system.",
      isEnabled: true,
      runCount: 0,
      errorCount: 0,
      config: managerAgentConfig,
      metrics: managerAgentMetrics,
      createdAt: new Date().toISOString(), // Aligns with your schema defining createdAt: v.string()
    });

    // Log the initialization
    await ctx.db.insert("agentLogs", {
      agentId: managerId,
      level: "info", // Make sure "info" is in your logLevelOptions in agent-schema.ts
      message: "Agent system initialized successfully.",
      data: { systemId: systemId.toString(), newManagerId: managerId.toString() },
      timestamp: new Date().toISOString(),
      category: "system_lifecycle", // Ensure 'category' field exists in agentLogs schema
    });

    return {
      success: true,
      message: "Agent system initialized successfully.",
      systemId,
      managerId,
    };
  },
});

/**
 * Start the agent system.
 */
export const startAgentSystem = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }

    const system = await ctx.db.query("agentSystem").first();
    if (!system) {
      throw new Error("Agent system not initialized. Please initialize first.");
    }

    if (system.isRunning && system.status === "running") {
      return { success: true, message: "Agent system is already running." };
    }

    await ctx.db.patch(system._id, {
      isRunning: true,
      status: "running",
      lastStarted: new Date().toISOString(),
    });

    const manager = await ctx.db
      .query("agents")
      .withIndex("by_type", (q) => q.eq("type", "manager"))
      .first();

    if (manager) {
      await ctx.db.patch(manager._id, {
        status: "active",
        lastRun: new Date().toISOString(),
        // updatedAt: new Date().toISOString(), // If you manually manage a string updatedAt field
      });

      await ctx.db.insert("agentLogs", {
        agentId: manager._id,
        level: "info",
        message: "Agent system started successfully.",
        timestamp: new Date().toISOString(),
        category: "system_lifecycle",
      });
    } else {
        console.warn("StartAgentSystem: Manager agent not found during startup.");
         await ctx.db.insert("agentLogs", {
            agentId: system._id as unknown as Id<"agents">, // This cast might be problematic if agentSystem._id can't be an agentId
                                                 // Consider a dedicated system/log agent ID or null if schema allows
            level: "warn",
            message: "Agent system started, but Manager agent not found.",
            timestamp: new Date().toISOString(),
            category: "system_lifecycle",
         });
    }

    return { success: true, message: "Agent system started successfully." };
  },
});

/**
 * Stop the agent system.
 */
export const stopAgentSystem = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }

    const system = await ctx.db.query("agentSystem").first();
    if (!system) {
      return { success: true, message: "Agent system not found or not initialized." };
    }

    if (!system.isRunning && system.status === "stopped") {
        return { success: true, message: "Agent system is already stopped."};
    }

    await ctx.db.patch(system._id, {
      isRunning: false,
      status: "stopped",
      lastStopped: new Date().toISOString(),
    });

    const activeAgents = await ctx.db.query("agents").filter(q => q.eq(q.field("status"), "active")).collect();
    for (const agent of activeAgents) {
      await ctx.db.patch(agent._id, {
        status: "inactive",
      
      });
    }

    const manager = await ctx.db
      .query("agents")
      .withIndex("by_type", (q) => q.eq("type", "manager"))
      .first();

    if (manager) {
      await ctx.db.insert("agentLogs", {
        agentId: manager._id,
        level: "info",
        message: "Agent system stopped.",
        timestamp: new Date().toISOString(),
        category: "system_lifecycle",
      });
    } else {
         await ctx.db.insert("agentLogs", {
            agentId: system._id as unknown as Id<"agents">, 
            level: "info",
            message: "Agent system stopped. Manager agent not found for detailed logging.",
            timestamp: new Date().toISOString(),
            category: "system_lifecycle",
         });
    }

    return { success: true, message: "Agent system stopped successfully." };
  },
});

/**
 * Get the overall status of the agent system, all agents, and basic statistics.
 */
export const getAgentSystemStatus = query({
  args: {
    refreshKey: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) { throw new Error("Authentication required."); }

    const system = await ctx.db.query("agentSystem").first();
    const allAgents = await ctx.db.query("agents").collect();

    const twentyFourHoursAgoISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentInsights = await ctx.db
      .query("agentInsights")
      // Ensure "by_createdAt" index exists on agentInsights for "createdAt" (string) field
      .withIndex("by_createdAt", q => q.gt("createdAt", twentyFourHoursAgoISO))
      .collect();

    const pendingTasks = await ctx.db
      .query("agentTasks")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const inProgressTasks = await ctx.db
      .query("agentTasks")
      .withIndex("by_status", (q) => q.eq("status", "in_progress"))
      .collect();

       return {
      system: system || null,
      agents: allAgents || [],
      stats: {
        totalAgents: allAgents.length,
        activeAgents: allAgents.filter(a => a.status === "active").length,
        recentInsights: recentInsights.length,
        pendingTasks: pendingTasks.length,
        activeTasks: inProgressTasks.length,
      },
    };
  },
});

/**
 * Get recent agent insights, optionally enriched with agent information.
 */
export const getRecentInsights = query({
  args: {
    limit: v.optional(v.number()),
    refreshKey: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity(); // Added auth check for consistency
    if (!identity) { throw new Error("Authentication required."); }

    // Orders by _creationTime descending by default.
    // If you need to order by your string `createdAt` field, ensure it's indexed
    // and use .withIndex("by_createdAt").order("desc") if "by_createdAt" is just ["createdAt"]
    // or simply .order("desc") if relying on _creationTime.
    const insights = await ctx.db
      .query("agentInsights")
      .order("desc")
      .take(args.limit || 10);

    const enrichedInsights = await Promise.all(
      insights.map(async (insight) => {
        const agent = await ctx.db.get(insight.agentId);
        return {
          ...insight,
          agentName: agent?.name || "Unknown Agent",
          agentType: agent?.type,
        };
      })
    );
    return enrichedInsights;
  },
});

/**
 * Get agent logs with optional filtering by agent ID and log level.
 */
export const getAgentLogs = query({
  args: {
    agentId: v.optional(v.id("agents")),
    level: v.optional(
      v.union( // This union should match logLevelOptions in your agent-schema.ts
        v.literal("debug"),
        v.literal("info"),
        v.literal("warn"),
        v.literal("error"),
        v.literal("critical")
      )
    ),
    limit: v.optional(v.number()),
    refreshKey: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity(); // Added auth check
    if (!identity) { throw new Error("Authentication required."); }

    const limit = args.limit || 50;
    let queryChain = ctx.db.query("agentLogs");

    if (args.agentId && args.level) {
      //@ts-ignore
      queryChain = queryChain.withIndex("by_agent_and_level", (q) =>
        q.eq("agentId", args.agentId!).eq("level", args.level!)
      );
    } else if (args.agentId) {
       //@ts-ignore
      queryChain = queryChain.withIndex("by_agent", (q) =>
        q.eq("agentId", args.agentId!)
      );
    } else if (args.level) {
       //@ts-ignore
      queryChain = queryChain.withIndex("by_level", (q) =>
        q.eq("level", args.level!)
      );
    }
    // Orders by _creationTime descending if no other order on index specified
    const logs = await queryChain.order("desc").take(limit);

    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        const agent = log.agentId ? await ctx.db.get(log.agentId) : null;
        return {
          ...log,
          agentName: agent?.name || "System Log",
          agentType: agent?.type,
        };
      })
    );
    return enrichedLogs;
  },
});

/**
 * Enable or disable a specific agent.
 */
export const toggleAgent = mutation({
  args: {
    agentId: v.id("agents"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }

    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new Error("Agent not found.");
    }

    await ctx.db.patch(args.agentId, {
      isEnabled: args.enabled,
      status: args.enabled ? "inactive" : "disabled",
      // updatedAt: new Date().toISOString(), // If you manually manage a string updatedAt field
    });

    await ctx.db.insert("agentLogs", {
      agentId: args.agentId,
      level: "info",
      message: `Agent ${agent.name} ${args.enabled ? "enabled" : "disabled"} by user ${identity.nickname || identity.subject}.`,
      timestamp: new Date().toISOString(),
      data: { agentId: args.agentId.toString(), enabled: args.enabled, userId: identity.subject },
      category: "agent_management", // Ensure 'category' field exists in agentLogs schema
    });

    return { success: true, message: `Agent ${args.enabled ? "enabled" : "disabled"}.` };
  },
});

/**
 * Create a test insight (for development/testing purposes).
 */
export const createTestInsight = mutation({
  args: {
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    // Uses the options arrays defined at the top of this file
    priority: v.optional(v.union(...taskPriorityOptions.map(o => v.literal(o)))),
    type: v.optional(v.union(...insightTypeOptions.map(o => v.literal(o)))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }

    const manager = await ctx.db
      .query("agents")
      .withIndex("by_type", (q) => q.eq("type", "manager"))
      .first();

    if (!manager) {
      throw new Error("Manager agent not found. Cannot create test insight.");
    }

    const insightTypeToUse = args.type || "performance_metric";
    if (!insightTypeOptions.includes(insightTypeToUse as any)) { // Type assertion needed due to v.optional
        throw new Error(`Invalid insight type: ${insightTypeToUse}. Must be one of: ${insightTypeOptions.join(", ")}`);
    }

    const priorityToUse = args.priority || "low";
     if (!taskPriorityOptions.includes(priorityToUse as any)) { // Type assertion needed
        throw new Error(`Invalid priority: ${priorityToUse}. Must be one of: ${taskPriorityOptions.join(", ")}`);
    }

    const insightId = await ctx.db.insert("agentInsights", {
      agentId: manager._id,
      type: insightTypeToUse,
      title: args.title || "System Health Check (Test)",
      description: args.description || "All systems are operating normally. No critical issues detected. (Test Insight)",
      priority: priorityToUse,
      actionRequired: false,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(), // This aligns with your schema
      // data: { ... } // Populate based on insightTypeToUse if needed
    });

    await ctx.db.insert("agentLogs", {
        agentId: manager._id,
        level: "debug", // Ensure "debug" is in logLevelOptions in agent-schema.ts
        message: `Test insight created by ${identity.nickname || identity.subject}.`,
        timestamp: new Date().toISOString(),
        data: { insightId: insightId.toString(), userId: identity.subject },
        category: "test_data", // Ensure 'category' field exists in agentLogs schema
    });

    return { success: true, insightId };
  },
});

/**
 * Mark a specific insight as read.
 */
export const markInsightAsRead = mutation({
  args: {
    insightId: v.id("agentInsights"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }

    const insight = await ctx.db.get(args.insightId);
    if (!insight) {
        throw new Error("Insight not found.");
    }

    if (insight.isRead) {
        return { success: true, message: "Insight was already marked as read."};
    }

    await ctx.db.patch(args.insightId, {
      isRead: true,
      readAt: new Date().toISOString(),
    });

    return { success: true, message: "Insight marked as read." };
  },
});

// ============================================================================
// AGENT ORCHESTRATION
// ============================================================================

/**
 * Run all enabled agents for an enterprise
 * This is the main orchestration function called periodically
 */
export const orchestrateAgents = internalMutation({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const system = await ctx.db.query("agentSystem").first();
    if (!system || !system.isRunning) {
      return { success: false, message: "Agent system is not running" };
    }

    const manager = await ctx.db
      .query("agents")
      .withIndex("by_type", (q) => q.eq("type", "manager"))
      .first();

    if (!manager || !manager.isEnabled) {
      return { success: false, message: "Manager agent is not enabled" };
    }

    try {
      // Update manager status
      await ctx.db.patch(manager._id, {
        status: "active",
        runCount: (manager.runCount || 0) + 1,
        lastRun: new Date().toISOString(),
      });

      // Log orchestration start
      await ctx.db.insert("agentLogs", {
        agentId: manager._id,
        level: "info",
        message: `Starting agent orchestration for enterprise ${args.enterpriseId}`,
        timestamp: new Date().toISOString(),
        category: "orchestration",
        data: { enterpriseId: args.enterpriseId },
      });

      // Get all enabled agents
      const enabledAgents = await ctx.db
        .query("agents")
        .filter((q) => q.and(
          q.eq(q.field("isEnabled"), true),
          q.neq(q.field("type"), "manager")
        ))
        .collect();

      const results: Array<{
        agentId: Id<"agents">;
        agentType: string;
        success: boolean;
        result?: any;
        error?: string;
      }> = [];

      // Run each agent based on type
      for (const agent of enabledAgents) {
        try {
          let result;
          
          switch (agent.type) {
            case "secretary":
              // Secretary agent monitors new contracts
              const { run: runSecretary } = await import("./secretary");
              result = await (runSecretary as any)(ctx, { agentId: agent._id });
              break;
              
            case "vendor":
              // Vendor agent processes unassigned contracts
              const { runVendorAgent } = await import("./vendor");
              result = await (runVendorAgent as any)(ctx, { enterpriseId: args.enterpriseId });
              break;
              
            case "financial":
              // Financial agent analyzes contract costs
              // const { runFinancialAgent } = await import("./financial");
              // result = await runFinancialAgent(ctx, { enterpriseId: args.enterpriseId });
              result = { skipped: true, reason: "Financial agent not yet implemented" };
              break;
              
            case "legal":
              // Legal agent checks compliance
              // const { runLegalAgent } = await import("./legal");
              // result = await runLegalAgent(ctx, { enterpriseId: args.enterpriseId });
              result = { skipped: true, reason: "Legal agent not yet implemented" };
              break;
              
            case "analytics":
              // Analytics agent generates insights
              // const { runAnalyticsAgent } = await import("./analytics");
              // result = await runAnalyticsAgent(ctx, { enterpriseId: args.enterpriseId });
              result = { skipped: true, reason: "Analytics agent not yet implemented" };
              break;
              
            case "notifications":
              // Notification agent sends alerts
              // const { runNotificationAgent } = await import("./notification");
              // result = await runNotificationAgent(ctx, { enterpriseId: args.enterpriseId });
              result = { skipped: true, reason: "Notification agent not yet implemented" };
              break;
              
            default:
              result = { skipped: true, reason: `Unknown agent type: ${agent.type}` };
          }
          
          results.push({
            agentId: agent._id,
            agentType: agent.type,
            success: true,
            result,
          });
          
        } catch (error) {
          // Log agent error
          await ctx.db.insert("agentLogs", {
            agentId: agent._id,
            level: "error",
            message: `Error running ${agent.type} agent: ${error instanceof Error ? error.message : "Unknown error"}`,
            timestamp: new Date().toISOString(),
            category: "agent_error",
            data: { error: error instanceof Error ? error.stack : String(error) },
          });
          
          // Update agent error count
          await ctx.db.patch(agent._id, {
            errorCount: (agent.errorCount || 0) + 1,
            lastError: error instanceof Error ? error.message : "Unknown error",
            // lastErrorAt field doesn't exist in schema
          });
          
          results.push({
            agentId: agent._id,
            agentType: agent.type,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Update manager metrics
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      await ctx.db.patch(manager._id, {
        status: "inactive",
        metrics: {
          ...manager.metrics,
          totalRuns: ((manager.metrics as any)?.totalRuns || 0) + 1,
          successfulRuns: ((manager.metrics as any)?.successfulRuns || 0) + (failureCount === 0 ? 1 : 0),
          failedRuns: ((manager.metrics as any)?.failedRuns || 0) + (failureCount > 0 ? 1 : 0),
          averageRunTime: ((manager.metrics as any)?.averageRunTime || 0),
          // agentsManaged: enabledAgents.length, // This field doesn't exist in the base metrics type
          lastRunDuration: manager.lastRun ? Date.now() - new Date(manager.lastRun).getTime() : 0,
        },
      });

      // Log orchestration completion
      await ctx.db.insert("agentLogs", {
        agentId: manager._id,
        level: "info",
        message: `Completed agent orchestration: ${successCount} succeeded, ${failureCount} failed`,
        timestamp: new Date().toISOString(),
        category: "orchestration",
        data: { results, enterpriseId: args.enterpriseId },
      });

      return {
        success: true,
        message: "Agent orchestration completed",
        results,
      };
      
    } catch (error) {
      // Update manager error state
      await ctx.db.patch(manager._id, {
        status: "error",
        errorCount: (manager.errorCount || 0) + 1,
        lastError: error instanceof Error ? error.message : "Unknown error",
        // Remove lastErrorAt as it doesn't exist in schema
      });
      
      throw error;
    }
  },
});