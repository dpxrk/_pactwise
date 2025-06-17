import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Initialize the Vendor Agent
 * This function creates the vendor agent in the database with default configuration
 */
export const initializeVendorAgent = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // Check if vendor agent already exists
    const existingAgent = await ctx.db
      .query("agents")
      .withIndex("by_type", (q) => q.eq("type", "vendor"))
      .first();

    if (existingAgent) {
      return {
        success: true,
        message: "Vendor agent already exists",
        agentId: existingAgent._id,
      };
    }

    // Create vendor agent configuration
    const vendorAgentConfig = {
      runIntervalMinutes: 5,
      retryAttempts: 3,
      timeoutMinutes: 15,
      enabled: true,
      priority: "medium" as const,
    };

    const vendorAgentMetrics = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      averageRunTime: 0,
      // Vendor-specific metrics
      vendorsCreated: 0,
      vendorsMatched: 0,
      contractsProcessed: 0,
      duplicatesDetected: 0,
    };

    // Create the vendor agent
    const agentId = await ctx.db.insert("agents", {
      name: "Vendor Agent",
      type: "vendor",
      status: "inactive",
      description: "Automatically identifies and creates vendor profiles from contract data. Matches extracted vendor names to existing vendors or creates new ones when needed.",
      isEnabled: true,
      runCount: 0,
      errorCount: 0,
      config: vendorAgentConfig,
      metrics: vendorAgentMetrics,
      createdAt: new Date().toISOString(),
    });

    // Log the initialization
    await ctx.db.insert("agentLogs", {
      agentId,
      level: "info",
      message: "Vendor agent initialized successfully",
      timestamp: new Date().toISOString(),
      category: "agent_lifecycle",
      data: {
        initializedBy: identity.email || identity.nickname || identity.subject,
        config: vendorAgentConfig,
      },
    });

    return {
      success: true,
      message: "Vendor agent initialized successfully",
      agentId,
    };
  },
});