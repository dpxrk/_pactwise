// convex/agents/secretary.ts
import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

/**
 * Secretary Agent
 * 
 * Responsibilities:
 * - Monitor new contract uploads and trigger analysis
 * - Create tasks for other agents based on contract data
 * - Coordinate initial contract processing workflow
 * - Generate insights about contract intake patterns
 * - Manage task distribution based on agent availability
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const SECRETARY_CONFIG = {
  // Processing intervals
  checkIntervalMinutes: 2,
  batchSize: 10,
  
  // Task creation rules
  taskPriority: {
    expiringSoon: "high" as const,
    highValue: "medium" as const,
    standard: "low" as const,
  },
  
  // Thresholds
  lowValueThreshold: 10000,
  mediumValueThreshold: 50000,
  highValueThreshold: 250000, // Currency units
  expirationWarningDays: 30,
  
  // Analysis triggers
  analysisRequiredStatuses: ["pending_analysis", "draft"] as const,
};

// ============================================================================
// MAIN EXECUTION
// ============================================================================

/**
 * Main run function for the Secretary Agent
 * Called periodically by the manager agent
 */
export const run = internalMutation({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    
    try {
      // Log start
      await ctx.db.insert("agentLogs", {
        agentId: args.agentId,
        level: "info",
        message: "Secretary agent starting run",
        timestamp: new Date().toISOString(),
        category: "agent_execution",
      });

      // Update agent status
      await ctx.db.patch(args.agentId, {
        status: "busy",
        lastRun: new Date().toISOString(),
      });

      // Process new contracts
      const newContractsProcessed = await processNewContracts(ctx, args.agentId);
      
      // Check for expiring contracts
      const expiringContractsFound = await checkExpiringContracts(ctx, args.agentId);
      
      // Monitor task queue health
      const queueHealth = await monitorTaskQueue(ctx, args.agentId);
      
      // Generate intake insights
      await generateIntakeInsights(ctx, args.agentId);

      // Update agent metrics
      const agent = await ctx.db.get(args.agentId);
      if (agent) {
        const runTime = Date.now() - startTime;
        const metrics = agent.metrics || {
          totalRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
          averageRunTime: 0,
        };

        await ctx.db.patch(args.agentId, {
          status: "active",
          lastSuccess: new Date().toISOString(),
          runCount: agent.runCount + 1,
          metrics: {
            ...metrics,
            totalRuns: metrics.totalRuns + 1,
            successfulRuns: metrics.successfulRuns + 1,
            averageRunTime: 
              (metrics.averageRunTime * metrics.totalRuns + runTime) / 
              (metrics.totalRuns + 1),
            // Secretary-specific metrics
            contractsProcessed: (metrics as any).contractsProcessed 
              ? (metrics as any).contractsProcessed + newContractsProcessed 
              : newContractsProcessed,
            expiringContractsFound: (metrics as any).expiringContractsFound 
              ? (metrics as any).expiringContractsFound + expiringContractsFound
              : expiringContractsFound,
          },
        });
      }

      return { 
        success: true, 
        contractsProcessed: newContractsProcessed,
        expiringContractsFound,
        queueHealth,
      };

    } catch (error) {
      // Log error
      await ctx.db.insert("agentLogs", {
        agentId: args.agentId,
        level: "error",
        message: "Secretary agent failed",
        data: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date().toISOString(),
        category: "agent_execution",
      });

      // Update agent with error
      const agent = await ctx.db.get(args.agentId);
      if (agent) {
        await ctx.db.patch(args.agentId, {
          status: "error",
          errorCount: agent.errorCount + 1,
          lastError: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    }
  },
});

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Process new contracts that need analysis
 */
async function processNewContracts(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  // Get contracts pending analysis
  const contractsPending = await ctx.db
    .query("contracts")
    .withIndex("by_analysisStatus_and_enterpriseId")
    .filter((q: any) => 
      q.or(
        q.eq(q.field("analysisStatus"), "pending"),
        q.eq(q.field("analysisStatus"), undefined)
      )
    )
    .take(SECRETARY_CONFIG.batchSize);

  let processed = 0;

  for (const contract of contractsPending) {
    try {
      // Create analysis task for financial agent
      await ctx.db.insert("agentTasks", {
        assignedAgentId: await getAgentId(ctx, "financial"),
        createdByAgentId: agentId,
        taskType: "contract_analysis",
        status: "pending",
        priority: determineContractPriority(contract),
        title: `Analyze contract: ${contract.title}`,
        description: `Perform financial analysis on contract ${contract._id}`,
        contractId: contract._id,
        vendorId: contract.vendorId,
        data: {
          contractType: contract.contractType,
          fileName: contract.fileName,
          storageId: contract.storageId,
        },
        createdAt: new Date().toISOString(),
      });

      // Update contract status
      await ctx.db.patch(contract._id, {
        analysisStatus: "processing",
      });

      processed++;

      // Log the task creation
      await ctx.db.insert("agentLogs", {
        agentId,
        level: "info",
        message: `Created analysis task for contract ${contract.title}`,
        data: { contractId: contract._id },
        timestamp: new Date().toISOString(),
        category: "task_creation",
      });

    } catch (error) {
      await ctx.db.insert("agentLogs", {
        agentId,
        level: "error",
        message: `Failed to process contract ${contract._id}`,
        data: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date().toISOString(),
        category: "contract_processing",
      });
    }
  }

  return processed;
}

/**
 * Check for contracts expiring soon
 */
async function checkExpiringContracts(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + SECRETARY_CONFIG.expirationWarningDays);
  const warningDateStr = warningDate.toISOString();

  // Query contracts expiring within warning period
  const expiringContracts = await ctx.db
    .query("contracts")
    .filter((q: any) => 
      q.and(
        q.eq(q.field("status"), "active"),
        q.lt(q.field("extractedEndDate"), warningDateStr),
        q.gt(q.field("extractedEndDate"), new Date().toISOString())
      )
    )
    .collect();

  for (const contract of expiringContracts) {
    // Check if we already have an expiration insight
    const existingInsight = await ctx.db
      .query("agentInsights")
      .withIndex("by_contract")
      .filter((q: any) => 
        q.and(
          q.eq(q.field("contractId"), contract._id),
          q.eq(q.field("type"), "expiration_warning")
        )
      )
      .first();

    if (!existingInsight) {
      // Create expiration warning insight
      await ctx.db.insert("agentInsights", {
        agentId,
        type: "expiration_warning",
        title: `Contract Expiring Soon: ${contract.title}`,
        description: `This contract expires on ${contract.extractedEndDate}. Action may be required.`,
        priority: "high",
        contractId: contract._id,
        vendorId: contract.vendorId,
        actionRequired: true,
        actionTaken: false,
        isRead: false,
        createdAt: new Date().toISOString(),
        data: {
          expirationDate: contract.extractedEndDate,
          daysUntilExpiration: Math.ceil(
            (new Date(contract.extractedEndDate).getTime() - Date.now()) / 
            (1000 * 60 * 60 * 24)
          ),
        },
      });

      // Create task for notifications agent
      await ctx.db.insert("agentTasks", {
        assignedAgentId: await getAgentId(ctx, "notifications"),
        createdByAgentId: agentId,
        taskType: "send_notification",
        status: "pending",
        priority: "high",
        title: `Notify: Contract ${contract.title} expiring`,
        contractId: contract._id,
        data: {
          notificationType: "contract_expiration",
          urgency: "high",
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return expiringContracts.length;
}

/**
 * Monitor task queue health
 */
async function monitorTaskQueue(
  ctx: any,
  agentId: Id<"agents">
): Promise<any> {
  const pendingTasks = await ctx.db
    .query("agentTasks")
    .withIndex("by_status")
    .filter((q: any) => q.eq(q.field("status"), "pending"))
    .collect();

  const inProgressTasks = await ctx.db
    .query("agentTasks")
    .withIndex("by_status")
    .filter((q: any) => q.eq(q.field("status"), "in_progress"))
    .collect();

  const stuckTasks = inProgressTasks.filter(task => {
    if (!task.startedAt) return false;
    const runTime = Date.now() - new Date(task.startedAt).getTime();
    return runTime > 30 * 60 * 1000; // 30 minutes
  });

  if (stuckTasks.length > 0) {
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "alert",
      title: "Stuck Tasks Detected",
      description: `${stuckTasks.length} tasks have been running for over 30 minutes`,
      priority: "high",
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: {
        stuckTaskIds: stuckTasks.map(t => t._id),
      },
    });
  }

  return {
    pending: pendingTasks.length,
    inProgress: inProgressTasks.length,
    stuck: stuckTasks.length,
  };
}

/**
 * Generate insights about contract intake patterns
 */
async function generateIntakeInsights(
  ctx: any,
  agentId: Id<"agents">
): Promise<void> {
  // Get contracts from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentContracts = await ctx.db
    .query("contracts")
    .filter((q: any) => 
      q.gte(q.field("_creationTime"), thirtyDaysAgo.getTime())
    )
    .collect();

  if (recentContracts.length >= 10) {
    // Group by contract type
    const byType = recentContracts.reduce((acc: any, contract) => {
      const type = contract.contractType || "other";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Find most common type
    const mostCommonType = Object.entries(byType)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0];

    await ctx.db.insert("agentInsights", {
      agentId,
      type: "trend_analysis",
      title: "Contract Intake Pattern",
      description: `${recentContracts.length} contracts processed in last 30 days. Most common type: ${mostCommonType[0]} (${mostCommonType[1]} contracts)`,
      priority: "low",
      actionRequired: false,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: {
        totalContracts: recentContracts.length,
        contractsByType: byType,
        period: "30_days",
      },
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine contract priority based on various factors
 */
function determineContractPriority(contract: any): "low" | "medium" | "high" | "critical" {
  // High value contracts
  if (contract.extractedPricing) {
    const value = parseFloat(contract.extractedPricing.replace(/[^0-9.-]+/g, ""));
    if (value > SECRETARY_CONFIG.highValueThreshold) {
      return "high";
    }
  }

  // Expiring soon
  if (contract.extractedEndDate) {
    const daysUntilExpiration = Math.ceil(
      (new Date(contract.extractedEndDate).getTime() - Date.now()) / 
      (1000 * 60 * 60 * 24)
    );
    if (daysUntilExpiration < SECRETARY_CONFIG.expirationWarningDays) {
      return "high";
    }
  }

  // Contract type priorities
  if (contract.contractType === "msa" || contract.contractType === "partnership") {
    return "medium";
  }

  return "low";
}

/**
 * Get agent ID by type
 */
async function getAgentId(ctx: any, type: string): Promise<Id<"agents">> {
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_type")
    .filter((q: any) => q.eq(q.field("type"), type))
    .first();

  if (!agent) {
    throw new Error(`Agent of type ${type} not found`);
  }

  return agent._id;
}

// ============================================================================
// INTERNAL QUERIES (for other agents to use)
// ============================================================================

/**
 * Get pending contracts count
 */
export const getPendingContractsCount = internalQuery({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("contracts")
      .filter((q: any) => 
        q.or(
          q.eq(q.field("analysisStatus"), "pending"),
          q.eq(q.field("analysisStatus"), undefined)
        )
      )
      .collect();
    
    return pending.length;
  },
});