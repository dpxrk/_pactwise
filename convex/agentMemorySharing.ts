// convex/agentMemorySharing.ts
import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

// ============================================================================
// CROSS-AGENT MEMORY SHARING MECHANISMS
// ============================================================================

// Memory sharing policies
const sharingPolicies = {
  broadcast: "broadcast",           // Share with all agents
  selective: "selective",           // Share with specific agents
  needToKnow: "needToKnow",        // Share based on relevance
  hierarchical: "hierarchical",     // Manager agent controls sharing
  collaborative: "collaborative",   // Agents request/grant access
} as const;

// Memory access levels
const accessLevels = {
  full: "full",                    // Complete access to memory
  read: "read",                    // Read-only access
  summary: "summary",              // Only summary/keywords
  metadata: "metadata",            // Only metadata, no content
  none: "none",                    // No access
} as const;

// Agent memory profiles - what each agent needs
const agentMemoryProfiles = {
  manager: {
    needs: ["task_history", "process_knowledge", "feedback", "entity_relation"],
    provides: ["process_knowledge", "task_history"],
    accessLevel: "full",
  },
  financial: {
    needs: ["domain_knowledge", "entity_relation", "task_history"],
    provides: ["domain_knowledge", "entity_relation"],
    accessLevel: "full",
  },
  legal: {
    needs: ["domain_knowledge", "entity_relation", "process_knowledge"],
    provides: ["domain_knowledge", "process_knowledge"],
    accessLevel: "full",
  },
  secretary: {
    needs: ["interaction_pattern", "user_preference", "task_history"],
    provides: ["interaction_pattern", "task_history"],
    accessLevel: "read",
  },
  analytics: {
    needs: ["domain_knowledge", "interaction_pattern", "entity_relation", "task_history"],
    provides: ["domain_knowledge", "interaction_pattern"],
    accessLevel: "read",
  },
  notifications: {
    needs: ["user_preference", "feedback", "interaction_pattern"],
    provides: ["feedback"],
    accessLevel: "summary",
  },
  vendor: {
    needs: ["entity_relation", "domain_knowledge", "feedback"],
    provides: ["entity_relation", "domain_knowledge"],
    accessLevel: "full",
  },
};

// Helper function to share memory
async function shareMemoryInternal(
  ctx: any,
  args: {
    memoryId: Id<"longTermMemory">;
    fromAgentType: string;
    toAgentType: string;
    reason: string;
    accessLevel: "full" | "read" | "summary" | "metadata";
  }
) {
  const memory = await ctx.db.get(args.memoryId);
  if (!memory) throw new Error("Memory not found");
  
  // Check if sharing is allowed based on profiles
  const fromProfile = agentMemoryProfiles[args.fromAgentType as keyof typeof agentMemoryProfiles];
  const toProfile = agentMemoryProfiles[args.toAgentType as keyof typeof agentMemoryProfiles];
  
  if (!fromProfile || !toProfile) {
    throw new Error("Unknown agent type");
  }
  
  // Check if the memory type is something the receiving agent needs
  if (!toProfile.needs.includes(memory.memoryType)) {
    return { shared: false, reason: "Agent doesn't need this memory type" };
  }
  
  // Create sharing record
  const sharingId = await ctx.db.insert("memorySharing", {
    memoryId: args.memoryId,
    fromAgentType: args.fromAgentType,
    toAgentType: args.toAgentType,
    accessLevel: args.accessLevel,
    reason: args.reason,
    sharedAt: new Date().toISOString(),
    isActive: true,
  });
  
  // Log the sharing event
  await ctx.db.insert("memorySharingLogs", {
    sharingId,
    event: "shared",
    timestamp: new Date().toISOString(),
    metadata: {
      memoryType: memory.memoryType,
      importance: memory.importance,
    },
  });
  
  return { shared: true, sharingId };
}

// Share memory between agents
export const shareMemoryWithAgent = internalMutation({
  args: {
    memoryId: v.id("longTermMemory"),
    fromAgentType: v.string(),
    toAgentType: v.string(),
    reason: v.string(),
    accessLevel: v.union(
      v.literal("full"),
      v.literal("read"),
      v.literal("summary"),
      v.literal("metadata")
    ),
  },
  handler: async (ctx, args) => {
    return await shareMemoryInternal(ctx, args);
  },
});

// Get memories shared with a specific agent
export const getSharedMemories = internalQuery({
  args: {
    agentType: v.string(),
    memoryTypes: v.optional(v.array(v.string())),
    minImportance: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get active sharing records for this agent
    const sharingRecords = await ctx.db
      .query("memorySharing")
      .withIndex("by_recipient", (q) => 
        q.eq("toAgentType", args.agentType).eq("isActive", true)
      )
      .collect();
    
    // Get the actual memories
    const memories = await Promise.all(
      sharingRecords.map(async (record) => {
        const memory = await ctx.db.get(record.memoryId);
        if (!memory) return null;
        
        // Apply access level restrictions
        const filteredMemory = applyAccessLevelFilter(memory, record.accessLevel);
        
        return {
          ...filteredMemory,
          sharingInfo: {
            sharedBy: record.fromAgentType,
            accessLevel: record.accessLevel,
            reason: record.reason,
            sharedAt: record.sharedAt,
          },
        };
      })
    );
    
    let validMemories = memories.filter(m => m !== null);
    
    // Apply filters
    if (args.memoryTypes) {
      validMemories = validMemories.filter(m => 
        args.memoryTypes!.includes(m.memoryType)
      );
    }
    
    if (args.minImportance) {
      const importanceLevels = ["critical", "high", "medium", "low", "temporary"];
      const minIndex = importanceLevels.indexOf(args.minImportance);
      validMemories = validMemories.filter(m => 
        importanceLevels.indexOf(m.importance) <= minIndex
      );
    }
    
    // Sort by importance and recency
    validMemories.sort((a, b) => {
      const importanceCompare = compareImportance(a.importance, b.importance);
      if (importanceCompare !== 0) return importanceCompare;
      
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    return validMemories.slice(0, args.limit || 50);
  },
});

// Broadcast important memories to relevant agents
export const broadcastMemory = internalMutation({
  args: {
    memoryId: v.id("longTermMemory"),
    sourceAgentType: v.string(),
    policy: v.union(
      v.literal("broadcast"),
      v.literal("selective"),
      v.literal("needToKnow")
    ),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.memoryId);
    if (!memory) throw new Error("Memory not found");
    
    // Only broadcast high importance memories
    if (memory.importance !== "critical" && memory.importance !== "high") {
      return { broadcasted: false, reason: "Memory not important enough" };
    }
    
    const recipientAgents = determineRecipients(
      memory,
      args.sourceAgentType,
      args.policy
    );
    
    const sharingResults = await Promise.all(
      recipientAgents.map(async (agentType) => 
        await shareMemoryInternal(ctx, {
          memoryId: args.memoryId,
          fromAgentType: args.sourceAgentType,
          toAgentType: agentType,
          reason: `Broadcasted ${args.policy} policy: ${memory.importance} importance`,
          accessLevel: determineAccessLevel(agentType, memory),
        })
      )
    );
    
    return {
      broadcasted: true,
      recipientCount: sharingResults.filter(r => r.shared).length,
      recipients: recipientAgents,
    };
  },
});

// Request memory access from another agent
export const requestMemoryAccess = internalMutation({
  args: {
    requestingAgentType: v.string(),
    memoryId: v.id("longTermMemory"),
    reason: v.string(),
    requestedAccessLevel: v.union(
      v.literal("full"),
      v.literal("read"),
      v.literal("summary")
    ),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.memoryId);
    if (!memory) throw new Error("Memory not found");
    
    // Create access request
    const requestId = await ctx.db.insert("memoryAccessRequests", {
      memoryId: args.memoryId,
      requestingAgentType: args.requestingAgentType,
      ownerAgentType: "manager", // Default owner, could be determined differently
      reason: args.reason,
      requestedAccessLevel: args.requestedAccessLevel,
      status: "pending",
      requestedAt: new Date().toISOString(),
      // decidedAt: undefined,
      // decision: undefined,
    });
    
    // Auto-approve based on agent profiles and memory importance
    const shouldAutoApprove = evaluateAccessRequest(
      args.requestingAgentType,
      memory,
      args.requestedAccessLevel
    );
    
    if (shouldAutoApprove) {
      await processAccessRequestInternal(ctx, {
        requestId,
        decision: "approved",
        processedBy: "system",
      });
    }
    
    return { requestId, autoApproved: shouldAutoApprove };
  },
});

// Helper function to process access request
async function processAccessRequestInternal(
  ctx: any,
  args: {
    requestId: Id<"memoryAccessRequests">;
    decision: "approved" | "denied";
    processedBy: string;
    reason?: string;
  }
) {
  const request = await ctx.db.get(args.requestId);
  if (!request || request.status !== "pending") {
    throw new Error("Invalid request");
  }
  
  // Update request
  await ctx.db.patch(args.requestId, {
    status: args.decision,
    decidedAt: new Date().toISOString(),
    decision: {
      by: args.processedBy,
      reason: args.reason,
    },
  });
  
  // If approved, create sharing record
  if (args.decision === "approved") {
    await shareMemoryInternal(ctx, {
      memoryId: request.memoryId,
      fromAgentType: request.ownerAgentType,
      toAgentType: request.requestingAgentType,
      reason: `Access request approved: ${request.reason}`,
      accessLevel: request.requestedAccessLevel,
    });
  }
  
  return { processed: true };
}

// Process memory access request
export const processAccessRequest = internalMutation({
  args: {
    requestId: v.id("memoryAccessRequests"),
    decision: v.union(v.literal("approved"), v.literal("denied")),
    processedBy: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await processAccessRequestInternal(ctx, args);
  },
});

// Create agent memory pool for collaborative learning
export const createMemoryPool = internalMutation({
  args: {
    name: v.string(),
    description: v.string(),
    participatingAgents: v.array(v.string()),
    memoryTypes: v.array(v.string()),
    sharingPolicy: v.union(
      v.literal("open"),      // Any participant can add/access
      v.literal("moderated"), // Additions need approval
      v.literal("curated")    // Only approved memories
    ),
  },
  handler: async (ctx, args) => {
    const poolId = await ctx.db.insert("memoryPools", {
      name: args.name,
      description: args.description,
      participatingAgents: args.participatingAgents,
      memoryTypes: args.memoryTypes,
      sharingPolicy: args.sharingPolicy,
      createdAt: new Date().toISOString(),
      isActive: true,
      stats: {
        memoryCount: 0,
        contributionsByAgent: {},
        lastActivityAt: new Date().toISOString(),
      },
    });
    
    return { poolId };
  },
});

// Add memory to pool
export const addMemoryToPool = internalMutation({
  args: {
    poolId: v.id("memoryPools"),
    memoryId: v.id("longTermMemory"),
    contributingAgent: v.string(),
  },
  handler: async (ctx, args) => {
    const pool = await ctx.db.get(args.poolId);
    const memory = await ctx.db.get(args.memoryId);
    
    if (!pool || !memory) {
      throw new Error("Pool or memory not found");
    }
    
    // Check if agent is participant
    if (!pool.participatingAgents.includes(args.contributingAgent)) {
      throw new Error("Agent not authorized for this pool");
    }
    
    // Check if memory type is allowed
    if (!pool.memoryTypes.includes(memory.memoryType)) {
      throw new Error("Memory type not allowed in this pool");
    }
    
    // Add to pool
    const poolMemoryId = await ctx.db.insert("memoryPoolEntries", {
      poolId: args.poolId,
      memoryId: args.memoryId,
      contributedBy: args.contributingAgent,
      contributedAt: new Date().toISOString(),
      status: pool.sharingPolicy === "open" ? "active" : "pending",
    });
    
    // Update pool stats
    const contributionStats = { ...pool.stats.contributionsByAgent };
    contributionStats[args.contributingAgent] = 
      (contributionStats[args.contributingAgent] || 0) + 1;
    
    await ctx.db.patch(args.poolId, {
      stats: {
        memoryCount: pool.stats.memoryCount + 1,
        contributionsByAgent: contributionStats,
        lastActivityAt: new Date().toISOString(),
      },
    });
    
    return { poolMemoryId };
  },
});

// Get pool memories for an agent
export const getPoolMemories = internalQuery({
  args: {
    poolId: v.id("memoryPools"),
    agentType: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const pool = await ctx.db.get(args.poolId);
    if (!pool || !pool.participatingAgents.includes(args.agentType)) {
      return [];
    }
    
    // Get active entries
    const entries = await ctx.db
      .query("memoryPoolEntries")
      .withIndex("by_pool_status", (q) => 
        q.eq("poolId", args.poolId).eq("status", "active")
      )
      .take(args.limit || 100);
    
    // Get memories with contributor info
    const memories = await Promise.all(
      entries.map(async (entry) => {
        const memory = await ctx.db.get(entry.memoryId);
        if (!memory) return null;
        
        return {
          ...memory,
          poolInfo: {
            contributedBy: entry.contributedBy,
            contributedAt: entry.contributedAt,
            poolName: pool.name,
          },
        };
      })
    );
    
    return memories.filter(m => m !== null);
  },
});

// Sync agent knowledge - bidirectional memory exchange
export const syncAgentKnowledge = internalMutation({
  args: {
    agent1Type: v.string(),
    agent2Type: v.string(),
    syncType: v.union(
      v.literal("full"),        // Exchange all relevant memories
      v.literal("differential"), // Only new/updated memories
      v.literal("selective")     // Based on specific criteria
    ),
    criteria: v.optional(v.object({
      memoryTypes: v.optional(v.array(v.string())),
      minImportance: v.optional(v.string()),
      afterDate: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const profile1 = agentMemoryProfiles[args.agent1Type as keyof typeof agentMemoryProfiles];
    const profile2 = agentMemoryProfiles[args.agent2Type as keyof typeof agentMemoryProfiles];
    
    if (!profile1 || !profile2) {
      throw new Error("Unknown agent types");
    }
    
    // Determine what each agent can share with the other
    const agent1CanShare = profile1.provides.filter(type => 
      profile2.needs.includes(type)
    );
    const agent2CanShare = profile2.provides.filter(type => 
      profile1.needs.includes(type)
    );
    
    // Create sync session
    const syncSessionId = await ctx.db.insert("memorySyncSessions", {
      agent1Type: args.agent1Type,
      agent2Type: args.agent2Type,
      syncType: args.syncType,
      startedAt: new Date().toISOString(),
      // completedAt: undefined,
      status: "in_progress",
      stats: {
        agent1ToAgent2: 0,
        agent2ToAgent1: 0,
        conflicts: 0,
        errors: 0,
      },
    });
    
    // Perform sync based on type
    let syncStats = {
      agent1ToAgent2: 0,
      agent2ToAgent1: 0,
      conflicts: 0,
      errors: 0,
    };
    
    try {
      // Get memories to sync from agent1 to agent2
      if (agent1CanShare.length > 0) {
        const memories1 = await getMemoriesToSync(
          ctx,
          args.agent1Type,
          agent1CanShare,
          args.syncType,
          args.criteria
        );
        
        for (const memory of memories1) {
          const result = await shareMemoryInternal(ctx, {
            memoryId: memory._id,
            fromAgentType: args.agent1Type,
            toAgentType: args.agent2Type,
            reason: `Knowledge sync: ${args.syncType}`,
            accessLevel: determineAccessLevel(args.agent2Type, memory),
          });
          
          if (result.shared) syncStats.agent1ToAgent2++;
        }
      }
      
      // Get memories to sync from agent2 to agent1
      if (agent2CanShare.length > 0) {
        const memories2 = await getMemoriesToSync(
          ctx,
          args.agent2Type,
          agent2CanShare,
          args.syncType,
          args.criteria
        );
        
        for (const memory of memories2) {
          const result = await shareMemoryInternal(ctx, {
            memoryId: memory._id,
            fromAgentType: args.agent2Type,
            toAgentType: args.agent1Type,
            reason: `Knowledge sync: ${args.syncType}`,
            accessLevel: determineAccessLevel(args.agent1Type, memory),
          });
          
          if (result.shared) syncStats.agent2ToAgent1++;
        }
      }
      
      // Update sync session
      await ctx.db.patch(syncSessionId, {
        completedAt: new Date().toISOString(),
        status: "completed",
        stats: syncStats,
      });
      
    } catch (error) {
      syncStats.errors++;
      
      await ctx.db.patch(syncSessionId, {
        completedAt: new Date().toISOString(),
        status: "failed",
        stats: syncStats,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw error;
    }
    
    return {
      syncSessionId,
      stats: syncStats,
    };
  },
});

// Helper functions

function applyAccessLevelFilter(
  memory: Doc<"longTermMemory">,
  accessLevel: string
): any {
  switch (accessLevel) {
    case "full":
      return memory;
      
    case "read":
      // Remove sensitive fields
      const { embedding, ...readOnlyMemory } = memory;
      return readOnlyMemory;
      
    case "summary":
      // Only return summary and key fields
      return {
        _id: memory._id,
        memoryType: memory.memoryType,
        summary: memory.summary || memory.content.substring(0, 100),
        keywords: memory.keywords,
        importance: memory.importance,
        createdAt: memory.createdAt,
      };
      
    case "metadata":
      // Only metadata
      return {
        _id: memory._id,
        memoryType: memory.memoryType,
        importance: memory.importance,
        strength: memory.strength,
        createdAt: memory.createdAt,
      };
      
    default:
      return null;
  }
}

function compareImportance(imp1: string, imp2: string): number {
  const levels = ["critical", "high", "medium", "low", "temporary"];
  return levels.indexOf(imp1) - levels.indexOf(imp2);
}

function determineRecipients(
  memory: Doc<"longTermMemory">,
  sourceAgent: string,
  policy: string
): string[] {
  const allAgents = Object.keys(agentMemoryProfiles);
  const recipients: string[] = [];
  
  switch (policy) {
    case "broadcast":
      // Send to all agents that need this memory type
      allAgents.forEach(agentType => {
        if (agentType !== sourceAgent) {
          const profile = agentMemoryProfiles[agentType as keyof typeof agentMemoryProfiles];
          if (profile.needs.includes(memory.memoryType)) {
            recipients.push(agentType);
          }
        }
      });
      break;
      
    case "selective":
      // Based on memory content and agent specialization
      if (memory.memoryType === "domain_knowledge") {
        if (memory.content.toLowerCase().includes("financial") ||
            memory.content.toLowerCase().includes("cost")) {
          recipients.push("financial");
        }
        if (memory.content.toLowerCase().includes("legal") ||
            memory.content.toLowerCase().includes("compliance")) {
          recipients.push("legal");
        }
        if (memory.content.toLowerCase().includes("vendor")) {
          recipients.push("vendor");
        }
      }
      
      // Always include manager for high importance
      if (memory.importance === "critical" || memory.importance === "high") {
        recipients.push("manager");
      }
      break;
      
    case "needToKnow":
      // Only agents currently working on related entities
      if (memory.context.contractIds && memory.context.contractIds.length > 0) {
        recipients.push("legal", "financial");
      }
      if (memory.context.vendorIds && memory.context.vendorIds.length > 0) {
        recipients.push("vendor");
      }
      if (memory.memoryType === "user_preference") {
        recipients.push("secretary", "notifications");
      }
      break;
  }
  
  // Remove duplicates and source agent
  return [...new Set(recipients)].filter(a => a !== sourceAgent);
}

function determineAccessLevel(
  agentType: string,
  memory: Doc<"longTermMemory">
): "full" | "read" | "summary" | "metadata" {
  const profile = agentMemoryProfiles[agentType as keyof typeof agentMemoryProfiles];
  if (!profile) return "metadata";
  
  // Critical memories get appropriate access
  if (memory.importance === "critical") {
    return profile.accessLevel === "full" ? "full" : "read";
  }
  
  // Default to profile access level
  return profile.accessLevel as any;
}

function evaluateAccessRequest(
  requestingAgent: string,
  memory: Doc<"longTermMemory">,
  requestedLevel: string
): boolean {
  const profile = agentMemoryProfiles[requestingAgent as keyof typeof agentMemoryProfiles];
  if (!profile) return false;
  
  // Auto-approve if agent needs this memory type
  if (!profile.needs.includes(memory.memoryType)) {
    return false;
  }
  
  // Check if requested level is within agent's allowed level
  const allowedLevels = {
    full: ["full", "read", "summary", "metadata"],
    read: ["read", "summary", "metadata"],
    summary: ["summary", "metadata"],
    metadata: ["metadata"],
  };
  
  const agentAllowedLevels = allowedLevels[profile.accessLevel as keyof typeof allowedLevels] || [];
  if (!agentAllowedLevels.includes(requestedLevel)) {
    return false;
  }
  
  // Auto-approve for low importance memories
  if (memory.importance === "low" || memory.importance === "temporary") {
    return true;
  }
  
  // Auto-approve read/summary access for medium importance
  if (memory.importance === "medium" && 
      (requestedLevel === "read" || requestedLevel === "summary")) {
    return true;
  }
  
  // High/critical memories need manual approval
  return false;
}

async function getMemoriesToSync(
  ctx: any,
  agentType: string,
  memoryTypes: string[],
  syncType: string,
  criteria?: any
): Promise<Doc<"longTermMemory">[]> {
  // This would typically query memories associated with the agent
  // For now, we'll query by memory types
  let memories: Doc<"longTermMemory">[] = [];
  
  for (const memoryType of memoryTypes) {
    const typeMemories = await ctx.db
      .query("longTermMemory")
      .withIndex("by_type_importance", (q: any) => 
        q.eq("memoryType", memoryType)
      )
      .collect();
    
    memories.push(...typeMemories);
  }
  
  // Apply criteria filters
  if (criteria) {
    if (criteria.minImportance) {
      const importanceLevels = ["critical", "high", "medium", "low", "temporary"];
      const minIndex = importanceLevels.indexOf(criteria.minImportance);
      memories = memories.filter(m => 
        importanceLevels.indexOf(m.importance) <= minIndex
      );
    }
    
    if (criteria.afterDate) {
      const afterTime = new Date(criteria.afterDate).getTime();
      memories = memories.filter(m => 
        new Date(m.createdAt).getTime() > afterTime
      );
    }
  }
  
  // For differential sync, only get recent memories
  if (syncType === "differential") {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    memories = memories.filter(m => 
      new Date(m.updatedAt).getTime() > oneDayAgo.getTime()
    );
  }
  
  return memories;
}

// Create memory sharing tables in schema
export const memorySharingTables = {
  memorySharing: {
    memoryId: v.id("longTermMemory"),
    fromAgentType: v.string(),
    toAgentType: v.string(),
    accessLevel: v.union(
      v.literal("full"),
      v.literal("read"),
      v.literal("summary"),
      v.literal("metadata")
    ),
    reason: v.string(),
    sharedAt: v.string(),
    expiresAt: v.optional(v.string()),
    isActive: v.boolean(),
  },
  
  memorySharingLogs: {
    sharingId: v.id("memorySharing"),
    event: v.string(),
    timestamp: v.string(),
    metadata: v.optional(v.any()),
  },
  
  memoryAccessRequests: {
    memoryId: v.id("longTermMemory"),
    requestingAgentType: v.string(),
    ownerAgentType: v.string(),
    reason: v.string(),
    requestedAccessLevel: v.union(
      v.literal("full"),
      v.literal("read"),
      v.literal("summary")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("denied")
    ),
    requestedAt: v.string(),
    decidedAt: v.optional(v.string()),
    decision: v.optional(v.object({
      by: v.string(),
      reason: v.optional(v.string()),
    })),
  },
  
  memoryPools: {
    name: v.string(),
    description: v.string(),
    participatingAgents: v.array(v.string()),
    memoryTypes: v.array(v.string()),
    sharingPolicy: v.union(
      v.literal("open"),
      v.literal("moderated"),
      v.literal("curated")
    ),
    createdAt: v.string(),
    isActive: v.boolean(),
    stats: v.object({
      memoryCount: v.number(),
      contributionsByAgent: v.record(v.string(), v.number()),
      lastActivityAt: v.string(),
    }),
  },
  
  memoryPoolEntries: {
    poolId: v.id("memoryPools"),
    memoryId: v.id("longTermMemory"),
    contributedBy: v.string(),
    contributedAt: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("rejected")
    ),
  },
  
  memorySyncSessions: {
    agent1Type: v.string(),
    agent2Type: v.string(),
    syncType: v.union(
      v.literal("full"),
      v.literal("differential"),
      v.literal("selective")
    ),
    startedAt: v.string(),
    completedAt: v.optional(v.string()),
    status: v.union(
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("failed")
    ),
    stats: v.object({
      agent1ToAgent2: v.number(),
      agent2ToAgent1: v.number(),
      conflicts: v.number(),
      errors: v.number(),
    }),
    error: v.optional(v.string()),
  },
};