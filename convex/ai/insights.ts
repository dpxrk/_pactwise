// convex/ai/insights.ts
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

// ============================================================================
// AI INSIGHTS GENERATION
// ============================================================================

// Import OpenAI helpers
import { getChatCompletion } from "./openai-config";

/**
 * Get AI insights for contracts and vendors
 */
export const getInsights = query({
  args: {
    enterpriseId: v.id("enterprises"),
    contractId: v.optional(v.id("contracts")),
    vendorId: v.optional(v.id("vendors")),
    category: v.optional(v.string()),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get all insights and filter by enterprise through contracts/vendors
    const allInsights = await ctx.db.query("agentInsights").collect();
    
    // Filter insights by enterprise through contracts and vendors
    const enterpriseInsights = await Promise.all(
      allInsights.map(async (insight) => {
        // Check if insight is related to enterprise through contract
        if (insight.contractId) {
          const contract = await ctx.db.get(insight.contractId);
          if (contract && contract.enterpriseId === args.enterpriseId) {
            return insight;
          }
        }
        
        // Check if insight is related to enterprise through vendor
        if (insight.vendorId) {
          const vendor = await ctx.db.get(insight.vendorId);
          if (vendor && vendor.enterpriseId === args.enterpriseId) {
            return insight;
          }
        }
        
        return null;
      })
    );
    
    const insights = enterpriseInsights.filter(i => i !== null) as typeof allInsights;
    
    let filtered = insights;
    
    if (args.contractId) {
      filtered = filtered.filter(i => i.contractId === args.contractId);
    }
    
    if (args.vendorId) {
      filtered = filtered.filter(i => i.vendorId === args.vendorId);
    }
    
    if (args.category) {
      filtered = filtered.filter(i => i.type === args.category);
    }

    // Sort by priority and creation date
    filtered.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Apply limit
    if (args.limit) {
      filtered = filtered.slice(0, args.limit);
    }

    // Enhance insights with agent names
    const agents = await ctx.db.query("agents").collect();
    const agentMap = new Map(agents.map(a => [a._id, a]));

    return filtered.map(insight => ({
      ...insight,
      agentName: agentMap.get(insight.agentId)?.name || "Unknown Agent"
    }));
  }
});

/**
 * Generate new AI insights
 */
export const generateInsights = mutation({
  args: {
    contractId: v.optional(v.id("contracts")),
    vendorId: v.optional(v.id("vendors")),
    scope: v.optional(v.union(
      v.literal("contract_analysis"),
      v.literal("vendor_performance"),
      v.literal("risk_assessment"),
      v.literal("cost_optimization"),
      v.literal("compliance_review")
    ))
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }

    const insights: any[] = [];

    // Generate contract insights
    if (args.contractId) {
      const contract = await ctx.db.get(args.contractId);
      if (!contract) {
        throw new Error("Contract not found");
      }

      const prompt = `Analyze this contract and provide actionable insights:
Title: ${contract.title}
Status: ${contract.status}
Value: ${contract.value || "Unknown"}
Start Date: ${contract.startDate}
End Date: ${contract.endDate}
Type: ${contract.contractType || "Unknown"}

Provide 3-5 specific, actionable insights focusing on:
1. Risk areas that need attention
2. Cost optimization opportunities
3. Compliance considerations
4. Performance improvements
5. Strategic recommendations

Format each insight as JSON:
{
  "type": "risk_assessment|cost_optimization|compliance_alert|performance_metric|recommendation",
  "title": "Brief title",
  "description": "Detailed description with specific actions",
  "priority": "low|medium|high|critical",
  "actionRequired": true/false
}`;

      try {
        const messages = [
          {
            role: "system",
            content: "You are a contract analysis expert. Provide specific, actionable insights in JSON format."
          },
          {
            role: "user",
            content: prompt
          }
        ];

        const content = await getChatCompletion(messages, {
          model: "gpt-4-1106-preview",
          temperature: 0.7,
          max_tokens: 1500
        });
        
        if (content) {
          // Parse insights from response
          const lines = content.split('\n');
          for (const line of lines) {
            if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
              try {
                const insight = JSON.parse(line);
                insights.push({
                  ...insight,
                  contractId: args.contractId,
                  enterpriseId: user.enterpriseId
                });
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to generate contract insights:", error);
      }
    }

    // Generate vendor insights
    if (args.vendorId) {
      const vendor = await ctx.db.get(args.vendorId);
      if (!vendor) {
        throw new Error("Vendor not found");
      }

      // Get vendor contracts
      const vendorContracts = await ctx.db
        .query("contracts")
        .withIndex("by_vendorId_and_enterpriseId", (q) => 
          q.eq("enterpriseId", user.enterpriseId).eq("vendorId", args.vendorId)
        )
        .collect();

      const totalValue = vendorContracts.reduce((sum, c) => sum + (c.value || 0), 0);

      const prompt = `Analyze this vendor and provide actionable insights:
Vendor: ${vendor.name}
Category: ${vendor.category || "Unknown"}
Status: ${vendor.status}
Performance Score: ${vendor.performanceScore || "Not rated"}
Total Contract Value: $${totalValue.toLocaleString()}
Active Contracts: ${vendor.activeContracts || vendorContracts.length}

Provide 3-5 specific, actionable insights focusing on:
1. Vendor performance and reliability
2. Cost negotiation opportunities
3. Risk factors
4. Alternative vendor considerations
5. Relationship optimization

Format each insight as JSON:
{
  "type": "vendor_risk|cost_optimization|performance_metric|recommendation",
  "title": "Brief title",
  "description": "Detailed description with specific actions",
  "priority": "low|medium|high|critical",
  "actionRequired": true/false
}`;

      try {
        const messages = [
          {
            role: "system",
            content: "You are a vendor management expert. Provide specific, actionable insights in JSON format."
          },
          {
            role: "user",
            content: prompt
          }
        ];

        const content = await getChatCompletion(messages, {
          model: "gpt-4-1106-preview",
          temperature: 0.7,
          max_tokens: 1500
        });
        
        if (content) {
          // Parse insights from response
          const lines = content.split('\n');
          for (const line of lines) {
            if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
              try {
                const insight = JSON.parse(line);
                insights.push({
                  ...insight,
                  vendorId: args.vendorId,
                  enterpriseId: user.enterpriseId
                });
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to generate vendor insights:", error);
      }
    }

    // Get the manager agent
    const managerAgent = await ctx.db
      .query("agents")
      .filter((q) => q.eq(q.field("type"), "manager"))
      .first();

    if (!managerAgent) {
      throw new Error("Manager agent not found");
    }

    // Store insights in database
    const createdInsights: Id<"agentInsights">[] = [];
    for (const insight of insights) {
      const id = await ctx.db.insert("agentInsights", {
        agentId: managerAgent._id,
        type: insight.type || "recommendation",
        title: insight.title,
        description: insight.description,
        priority: insight.priority || "medium",
        contractId: insight.contractId,
        vendorId: insight.vendorId,
        actionRequired: insight.actionRequired || false,
        actionTaken: false,
        isRead: false,
        createdAt: new Date().toISOString(),
        confidence: 0.8
      });
      createdInsights.push(id);
    }

    return {
      success: true,
      insightsGenerated: createdInsights.length,
      insightIds: createdInsights
    };
  }
});

/**
 * Update insight status
 */
export const updateInsightStatus = mutation({
  args: {
    insightId: v.id("agentInsights"),
    status: v.object({
      isRead: v.optional(v.boolean()),
      actionTaken: v.optional(v.boolean()),
      actionDetails: v.optional(v.string())
    })
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not authenticated");
    }

    const insight = await ctx.db.get(args.insightId);
    if (!insight) {
      throw new Error("Insight not found");
    }

    const updates: any = {};
    
    if (args.status.isRead !== undefined) {
      updates.isRead = args.status.isRead;
      if (args.status.isRead && !insight.readAt) {
        updates.readAt = new Date().toISOString();
      }
    }
    
    if (args.status.actionTaken !== undefined) {
      updates.actionTaken = args.status.actionTaken;
    }
    
    if (args.status.actionDetails !== undefined) {
      updates.actionDetails = args.status.actionDetails;
    }

    await ctx.db.patch(args.insightId, updates);

    return { success: true };
  }
});

/**
 * Provide feedback on an insight
 */
export const provideInsightFeedback = mutation({
  args: {
    insightId: v.id("agentInsights"),
    feedback: v.union(v.literal("helpful"), v.literal("not_helpful"), v.literal("incorrect")),
    comment: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not authenticated");
    }

    const insight = await ctx.db.get(args.insightId);
    if (!insight) {
      throw new Error("Insight not found");
    }

    // Store feedback for analytics and agent improvement
    await ctx.db.insert("insightFeedback", {
      insightId: args.insightId,
      agentId: insight.agentId,
      feedback: args.feedback,
      comment: args.comment,
      userId: identity.subject,
      createdAt: new Date().toISOString()
    });

    // Update agent performance metrics based on feedback
    const agent = await ctx.db.get(insight.agentId);
    if (agent && agent.metrics) {
      const metrics = { ...agent.metrics };
      
      if (args.feedback === "helpful") {
        metrics.successfulRuns = (metrics.successfulRuns || 0) + 1;
        metrics.insightsGenerated = (metrics.insightsGenerated || 0) + 1;
      } else {
        metrics.failedRuns = (metrics.failedRuns || 0) + 1;
      }
      
      metrics.totalRuns = (metrics.successfulRuns || 0) + (metrics.failedRuns || 0);
      
      await ctx.db.patch(agent._id, { metrics });
    }

    return { success: true };
  }
});

/**
 * Get insight statistics
 */
export const getInsightStats = query({
  args: {
    enterpriseId: v.id("enterprises"),
    timeRange: v.optional(v.union(
      v.literal("24h"),
      v.literal("7d"),
      v.literal("30d"),
      v.literal("all")
    ))
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Get all insights and filter by enterprise through contracts/vendors
    const allInsights = await ctx.db.query("agentInsights").collect();
    
    // Filter insights by enterprise through contracts and vendors
    const enterpriseInsights = await Promise.all(
      allInsights.map(async (insight) => {
        // Check if insight is related to enterprise through contract
        if (insight.contractId) {
          const contract = await ctx.db.get(insight.contractId);
          if (contract && contract.enterpriseId === args.enterpriseId) {
            return insight;
          }
        }
        
        // Check if insight is related to enterprise through vendor
        if (insight.vendorId) {
          const vendor = await ctx.db.get(insight.vendorId);
          if (vendor && vendor.enterpriseId === args.enterpriseId) {
            return insight;
          }
        }
        
        return null;
      })
    );
    
    const insights = enterpriseInsights.filter(i => i !== null) as typeof allInsights;

    // Filter by time range
    let filtered = insights;
    if (args.timeRange && args.timeRange !== "all") {
      const now = new Date();
      const cutoff = new Date();
      
      switch (args.timeRange) {
        case "24h":
          cutoff.setHours(now.getHours() - 24);
          break;
        case "7d":
          cutoff.setDate(now.getDate() - 7);
          break;
        case "30d":
          cutoff.setDate(now.getDate() - 30);
          break;
      }
      
      filtered = insights.filter(i => new Date(i.createdAt) > cutoff);
    }

    // Calculate statistics
    const stats = {
      total: filtered.length,
      unread: filtered.filter(i => !i.isRead).length,
      actionRequired: filtered.filter(i => i.actionRequired && !i.actionTaken).length,
      byType: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      recentActivity: filtered
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
    };

    // Count by type
    filtered.forEach(insight => {
      stats.byType[insight.type] = (stats.byType[insight.type] || 0) + 1;
      stats.byPriority[insight.priority] = (stats.byPriority[insight.priority] || 0) + 1;
    });

    return stats;
  }
});