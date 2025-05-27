// convex/agents/secretary.ts
import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
// Removed: import { internal } from "../_generated/api"; // Not used in the provided snippet

/**
 * Secretary Agent
 * * Responsibilities:
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
  highValueThreshold: 250000, 
  expirationWarningDays: 30,
  
  // Analysis triggers
  analysisRequiredStatuses: ["pending_analysis", "draft"] as const,
};

// Define an extended metrics type for the secretary agent
// This helps TypeScript understand the expected shape of metrics for this specific agent.
interface SecretaryAgentMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageRunTime: number;
  lastRunDuration?: number;
  dataProcessed?: number;
  insightsGenerated?: number;
  // Secretary-specific metrics
  contractsProcessed?: number;
  expiringContractsFound?: number;
  // Allow other dynamic fields if your schema/logic relies on them
  // [key: string]: any; // Uncomment if you have other dynamic metric fields not listed
}

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

        // Cast agent.metrics to our specific SecretaryAgentMetrics type,
        // or provide a default object that conforms to it, initializing specific fields.
        const existingMetrics: SecretaryAgentMetrics = (agent.metrics as SecretaryAgentMetrics) || {
          totalRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
          averageRunTime: 0,
          contractsProcessed: 0, // Initialize if not present
          expiringContractsFound: 0, // Initialize if not present
        };

        // Ensure all base metric fields are initialized if they were somehow missing from existingMetrics
        const newMetrics: SecretaryAgentMetrics = {
          ...existingMetrics, // Spread all fields from existingMetrics first
          totalRuns: (existingMetrics.totalRuns || 0) + 1,
          successfulRuns: (existingMetrics.successfulRuns || 0) + 1,
          failedRuns: existingMetrics.failedRuns || 0, 
          averageRunTime: 
            (((existingMetrics.averageRunTime || 0) * (existingMetrics.totalRuns || 0)) + runTime) / 
            ((existingMetrics.totalRuns || 0) + 1 || 1), // Avoid division by zero if totalRuns was 0
          lastRunDuration: runTime,
          // Now, safely access and update secretary-specific metrics
          contractsProcessed: (existingMetrics.contractsProcessed || 0) + newContractsProcessed,
          expiringContractsFound: (existingMetrics.expiringContractsFound || 0) + expiringContractsFound,
        };

        await ctx.db.patch(args.agentId, {
          status: "active",
          lastSuccess: new Date().toISOString(),
          runCount: (agent.runCount || 0) + 1, // Ensure agent.runCount is treated as a number
          // errorCount remains unchanged unless an error occurred in this run
          metrics: newMetrics, 
          // If you have an updatedAt field in your 'agents' schema, uncomment and set it:
          // updatedAt: new Date().toISOString(), 
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
          errorCount: (agent.errorCount || 0) + 1, // Ensure agent.errorCount is treated as a number
          lastError: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    }
  },
});

// ============================================================================
// CORE FUNCTIONS (processNewContracts, checkExpiringContracts, etc.)
// ... (rest of your existing functions remain unchanged) ...
// ============================================================================
async function processNewContracts(
  ctx: any, // Consider using MutationCtx from "../_generated/server" for better typing
  agentId: Id<"agents">
): Promise<number> {
  // Get contracts pending analysis
  const contractsPending = await ctx.db
    .query("contracts")
    .withIndex("by_analysisStatus_and_enterpriseId") // Ensure this index exists and matches your query needs
    .filter((q: any) => 
      q.or(
        q.eq(q.field("analysisStatus"), "pending"),
        q.eq(q.field("analysisStatus"), undefined) // Include contracts where analysisStatus might not be set
      )
    )
    // Add enterpriseId filter if contracts are enterprise-specific
    // .filter((q: any) => q.eq(q.field("enterpriseId"), someEnterpriseId)) 
    .take(SECRETARY_CONFIG.batchSize);

  let processed = 0;

  for (const contract of contractsPending) {
    try {
      // Determine financial agent ID
      const financialAgent = await ctx.db
        .query("agents")
        .withIndex("by_type", (q: any) => q.eq("type", "financial"))
        .first();

      if (!financialAgent) {
        console.warn("Financial agent not found. Cannot create analysis task.");
        // Optionally, log this as a system warning or create a placeholder task
        continue; 
      }

      // Create analysis task for financial agent
      await ctx.db.insert("agentTasks", {
        assignedAgentId: financialAgent._id, // Use the fetched financial agent's ID
        createdByAgentId: agentId,
        taskType: "contract_analysis",
        status: "pending",
        priority: determineContractPriority(contract),
        title: `Analyze contract: ${contract.title || contract._id.toString()}`, // Fallback title
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
        message: `Created analysis task for contract ${contract.title || contract._id.toString()}`,
        data: { contractId: contract._id.toString(), assignedAgentId: financialAgent._id.toString() },
        timestamp: new Date().toISOString(),
        category: "task_creation",
      });

    } catch (error) {
      await ctx.db.insert("agentLogs", {
        agentId,
        level: "error",
        message: `Failed to process contract ${contract._id}`,
        data: { contractId: contract._id.toString(), error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date().toISOString(),
        category: "contract_processing",
      });
    }
  }

  return processed;
}

async function checkExpiringContracts(
  ctx: any, // Consider MutationCtx
  agentId: Id<"agents">
): Promise<number> {
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + SECRETARY_CONFIG.expirationWarningDays);
  const warningDateStr = warningDate.toISOString();

  // Query contracts expiring within warning period
  const expiringContracts = await ctx.db
    .query("contracts")
    // Add appropriate index if you filter by status and extractedEndDate frequently
    .filter((q: any) => 
      q.and(
        q.eq(q.field("status"), "active"), // Only active contracts
        q.lt(q.field("extractedEndDate"), warningDateStr), // Ends before warning date
        q.gt(q.field("extractedEndDate"), new Date().toISOString()) // But not already past
      )
    )
    // Add enterpriseId filter if applicable
    // .filter((q: any) => q.eq(q.field("enterpriseId"), someEnterpriseId))
    .collect();

  let newWarningsCreated = 0;

  for (const contract of expiringContracts) {
    // Check if we already have an active (non-actioned or unread) expiration insight
    const existingInsight = await ctx.db
      .query("agentInsights")
      .withIndex("by_contract", (q: any) => q.eq("contractId", contract._id)) // Ensure index exists
      .filter((q: any) => 
          q.and(
            q.eq(q.field("type"), "expiration_warning"),
            q.or(
                q.eq(q.field("actionTaken"), false), // If action not yet taken
                q.eq(q.field("isRead"), false)      // Or if it's unread (maybe action was taken but needs acknowledgement)
            )
          )
      )
      .first();

    if (!existingInsight) {
      newWarningsCreated++;
      // Create expiration warning insight
      await ctx.db.insert("agentInsights", {
        agentId, // Secretary agent ID
        type: "expiration_warning",
        title: `Contract Expiring Soon: ${contract.title || contract._id.toString()}`,
        description: `This contract expires on ${contract.extractedEndDate ? new Date(contract.extractedEndDate).toLocaleDateString() : 'N/A'}. Action may be required.`,
        priority: "high",
        contractId: contract._id,
        vendorId: contract.vendorId,
        actionRequired: true,
        actionTaken: false,
        isRead: false,
        createdAt: new Date().toISOString(),
        data: {
          expirationDate: contract.extractedEndDate,
          daysUntilExpiration: contract.extractedEndDate ? Math.ceil(
            (new Date(contract.extractedEndDate).getTime() - Date.now()) / 
            (1000 * 60 * 60 * 24)
          ) : undefined,
        },
      });

      // Create task for notifications agent
      const notificationsAgent = await ctx.db
        .query("agents")
        .withIndex("by_type", (q: any) => q.eq("type", "notifications"))
        .first();

      if (notificationsAgent) {
        await ctx.db.insert("agentTasks", {
          assignedAgentId: notificationsAgent._id,
          createdByAgentId: agentId,
          taskType: "send_notification",
          status: "pending",
          priority: "high",
          title: `Notify: Contract ${contract.title || contract._id.toString()} expiring`,
          contractId: contract._id,
          data: {
            notificationType: "contract_expiration",
            urgency: "high",
            recipient: "contract_owner_or_manager", // Define how recipient is determined
            message: `Contract '${contract.title || contract._id.toString()}' is expiring on ${contract.extractedEndDate ? new Date(contract.extractedEndDate).toLocaleDateString() : 'N/A'}.`,
          },
          createdAt: new Date().toISOString(),
        });
      } else {
        console.warn("Notifications agent not found. Cannot create notification task for expiring contract.");
      }
    }
  }
  // Return the count of *new* warnings created in this run, or total expiring if that's more relevant
  return newWarningsCreated; 
}

async function monitorTaskQueue(
  ctx: any, // Consider MutationCtx
  agentId: Id<"agents">
): Promise<any> {
  const pendingTasks = await ctx.db
    .query("agentTasks")
    .withIndex("by_status", (q: any) => q.eq(q.field("status"), "pending")) // Ensure index exists
    .collect();

  const inProgressTasks = await ctx.db
    .query("agentTasks")
    .withIndex("by_status", (q: any) => q.eq(q.field("status"), "in_progress")) // Ensure index exists
    .collect();
  
  const taskTimeoutMinutes = (SECRETARY_CONFIG as any).taskTimeoutMinutes || 30; // Fallback if not in config

  const stuckTasks = inProgressTasks.filter((task:any) => {
    if (!task.startedAt) return false;
    const runTimeMinutes = (Date.now() - new Date(task.startedAt).getTime()) / (1000 * 60);
    return runTimeMinutes > taskTimeoutMinutes; 
  });

  if (stuckTasks.length > 0) {
     // Check if a similar "Stuck Tasks" alert already exists and is recent/unactioned
    const existingAlert = await ctx.db.query("agentInsights")
      .filter((q:any) => q.and(
        q.eq(q.field("type"), "alert"),
        q.eq(q.field("title"), "Stuck Tasks Detected"),
        q.eq(q.field("actionTaken"), false), // Or based on createdAt time
        q.gt(q.field("createdAt"), new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()) // e.g., only one such alert per hour
      ))
      .first();

    if (!existingAlert) {
        await ctx.db.insert("agentInsights", {
            agentId, // Secretary agent ID
            type: "alert",
            title: "Stuck Tasks Detected",
            description: `${stuckTasks.length} task(s) appear to be stuck (running longer than ${taskTimeoutMinutes} minutes).`,
            priority: "high",
            actionRequired: true,
            actionTaken: false,
            isRead: false,
            createdAt: new Date().toISOString(),
            data: {
            stuckTaskIds: stuckTasks.map((t:any) => t._id.toString()),
            count: stuckTasks.length,
            timeoutThresholdMinutes: taskTimeoutMinutes
            },
        });
    }
  }

  return {
    pending: pendingTasks.length,
    inProgress: inProgressTasks.length,
    stuck: stuckTasks.length,
  };
}

async function generateIntakeInsights(
  ctx: any, // Consider MutationCtx
  agentId: Id<"agents">
): Promise<void> {
  const thirtyDaysAgoTimestamp = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  const recentContracts = await ctx.db
    .query("contracts")
    // Assuming _creationTime is indexed or you have a createdAt string field that is indexed
    .filter((q: any) => 
      q.gte(q.field("_creationTime"), thirtyDaysAgoTimestamp)
    )
    // Add enterpriseId filter if applicable
    // .filter((q: any) => q.eq(q.field("enterpriseId"), someEnterpriseId))
    .collect();

  if (recentContracts.length >= 10) { // Only generate insight if there's a reasonable amount of data
    const byType = recentContracts.reduce((acc: { [key: string]: number }, contract: any) => {
      const type = contract.contractType || "other";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const mostCommonTypeEntry = Object.entries(byType)
      .sort(([, a]:any, [, b]:any) => b - a)[0];
    
    const mostCommonType = mostCommonTypeEntry ? `${mostCommonTypeEntry[0]} (${mostCommonTypeEntry[1]} contracts)` : "N/A";

     // Avoid duplicate insights if one was generated recently
    const lastWeekTimestamp = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const existingTrendInsight = await ctx.db.query("agentInsights")
        .filter((q:any) => q.and(
            q.eq(q.field("type"), "trend_analysis"),
            q.eq(q.field("title"), "Contract Intake Pattern (Last 30 Days)"),
            q.gt(q.field("createdAt"), lastWeekTimestamp) 
        )).first();

    if (!existingTrendInsight) {
        await ctx.db.insert("agentInsights", {
            agentId, // Secretary agent ID
            type: "trend_analysis",
            title: "Contract Intake Pattern (Last 30 Days)",
            description: `${recentContracts.length} contracts processed in the last 30 days. Most common type: ${mostCommonType}.`,
            priority: "low",
            actionRequired: false,
            actionTaken: false,
            isRead: false,
            createdAt: new Date().toISOString(),
            data: {
            totalContracts: recentContracts.length,
            contractsByType: byType,
            periodDays: 30,
            },
        });
    }
  }
}

function determineContractPriority(contract: any): "low" | "medium" | "high" | "critical" {
  if (contract.extractedPricing) {
    const valueString = String(contract.extractedPricing).replace(/[^0-9.-]+/g, "");
    const value = parseFloat(valueString);
    if (!isNaN(value) && value > SECRETARY_CONFIG.highValueThreshold) {
      return "high";
    }
  }

  if (contract.extractedEndDate) {
    try {
      const daysUntilExpiration = Math.ceil(
        (new Date(contract.extractedEndDate).getTime() - Date.now()) / 
        (1000 * 60 * 60 * 24)
      );
      if (daysUntilExpiration < SECRETARY_CONFIG.expirationWarningDays) {
        return "high";
      }
    } catch (e) {
      console.warn("Could not parse contract extractedEndDate:", contract.extractedEndDate);
    }
  }

  const highPriorityTypes = ["msa", "partnership", "saas"]; // Example
  if (contract.contractType && highPriorityTypes.includes(contract.contractType.toLowerCase())) {
    return "medium";
  }

  return "low";
}

async function getAgentId(ctx: any, type: string): Promise<Id<"agents">> {
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_type", (q: any) => q.eq(q.field("type"), type)) // Ensure index exists
    .filter((q: any) => q.eq(q.field("isEnabled"), true)) // Prefer enabled agents
    .first();

  if (!agent) {
    // Fallback or specific error handling if no *enabled* agent of the type is found
    const anyAgentOfType = await ctx.db
        .query("agents")
        .withIndex("by_type", (q: any) => q.eq(q.field("type"), type))
        .first();
    if (anyAgentOfType) {
        console.warn(`Agent of type ${type} found but is not enabled. Using it anyway or consider erroring.`);
        return anyAgentOfType._id;
    }
    throw new Error(`No agent (enabled or otherwise) of type '${type}' found.`);
  }

  return agent._id;
}

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
      // Add enterpriseId filter if applicable
      // .filter((q: any) => q.eq(q.field("enterpriseId"), someEnterpriseId))
      .collect();
    
    return pending.length;
  },
});