// convex/enhancedMemoryIntegration.ts
import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

// ============================================================================
// ENHANCED MEMORY INTEGRATION FOR SENTIENT AGENTS
// ============================================================================

// Agent cognitive states for memory processing
const COGNITIVE_STATES = {
  learning: "learning",
  reasoning: "reasoning",
  recalling: "recalling",
  reflecting: "reflecting",
  creating: "creating",
} as const;

// Initialize agent with enhanced memory capabilities
export const initializeAgentMemory = internalMutation({
  args: {
    agentType: v.string(),
    userId: v.id("users"),
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    // Create agent memory profile
    const profileId = await ctx.db.insert("agentMemoryProfiles", {
      agentType: args.agentType,
      userId: args.userId,
      enterpriseId: args.enterpriseId,
      initialized: new Date().toISOString(),
      cognitiveCapabilities: getAgentCognitiveCapabilities(args.agentType),
      memoryConfig: {
        workingMemorySize: 20,
        learningRate: 0.1,
        forgettingRate: 0.01,
        associationThreshold: 0.7,
        compressionEnabled: true,
        episodicMemoryEnabled: true,
      },
      stats: {
        totalMemoriesProcessed: 0,
        insightsGenerated: 0,
        learningCycles: 0,
        averageRelevanceScore: 0,
      },
    });
    
    // Warm up memory cache
    await ctx.runMutation(api.memoryOptimization.warmMemoryCache, {
      userId: args.userId,
    });
    
    return { profileId };
  },
});

// Enhanced memory retrieval with cognitive context
export const retrieveMemoriesWithContext = internalQuery({
  args: {
    agentType: v.string(),
    cognitiveState: v.union(...Object.values(COGNITIVE_STATES).map(s => v.literal(s))),
    query: v.string(),
    context: v.object({
      taskType: v.optional(v.string()),
      entities: v.optional(v.array(v.object({
        type: v.string(),
        id: v.string(),
      }))),
      timeContext: v.optional(v.union(
        v.literal("recent"),
        v.literal("thisWeek"),
        v.literal("thisMonth"),
        v.literal("historical")
      )),
      emotionalValence: v.optional(v.number()),
    }),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    
    // Phase 1: Semantic search with embeddings
    const semanticResults = await ctx.runQuery(api.vectorEmbeddings.semanticMemorySearch, {
      query: args.query,
      memoryTypes: getRelevantMemoryTypesForCognitiveState(args.cognitiveState),
      limit: limit * 2,
    });
    
    // Phase 2: Context filtering
    let filteredMemories = semanticResults;
    
    // Filter by time context
    if (args.context.timeContext) {
      const cutoffTime = getTimeContextCutoff(args.context.timeContext);
      filteredMemories = filteredMemories.filter(m => 
        new Date(m.createdAt).getTime() > cutoffTime
      );
    }
    
    // Phase 3: Cognitive state scoring
    const scoredMemories = filteredMemories.map(memory => {
      const cognitiveScore = calculateCognitiveRelevance(
        memory,
        args.cognitiveState,
        args.context
      );
      
      const emotionalAlignment = args.context.emotionalValence !== undefined ?
        calculateEmotionalAlignment(memory, args.context.emotionalValence) : 1;
      
      const finalScore = (memory.similarity || 1) * cognitiveScore * emotionalAlignment;
      
      return {
        ...memory,
        cognitiveScore,
        emotionalAlignment,
        finalScore,
      };
    });
    
    // Sort by final score and limit
    const topMemories = scoredMemories
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);
    
    return topMemories;
  },
});

// Agent learning from experience
export const agentLearnFromExperience = internalMutation({
  args: {
    agentType: v.string(),
    experience: v.object({
      taskId: v.optional(v.id("agentTasks")),
      outcome: v.union(v.literal("success"), v.literal("failure"), v.literal("partial")),
      observations: v.array(v.string()),
      insights: v.optional(v.array(v.object({
        type: v.string(),
        description: v.string(),
        confidence: v.number(),
      }))),
      emotionalResponse: v.optional(v.object({
        valence: v.number(),
        arousal: v.number(),
      })),
    }),
  },
  handler: async (ctx, args) => {
    // Create memories from observations
    const memoryIds: Id<"shortTermMemory">[] = [];
    
    for (const observation of args.experience.observations) {
      const importance = determineObservationImportance(
        observation,
        args.experience.outcome
      );
      
      const memoryId = await ctx.runMutation(api.memoryShortTerm.store, {
        sessionId: `agent_${args.agentType}_${Date.now()}`,
        memoryType: "task_history",
        content: observation,
        structuredData: {
          agentType: args.agentType,
          taskId: args.experience.taskId,
          outcome: args.experience.outcome,
          timestamp: new Date().toISOString(),
        },
        context: {
          taskId: args.experience.taskId,
          agentId: args.agentType,
        },
        importance,
        confidence: args.experience.outcome === "success" ? 0.9 : 0.7,
        source: "task_outcome",
      });
      
      memoryIds.push(memoryId);
    }
    
    // Process insights
    if (args.experience.insights) {
      for (const insight of args.experience.insights) {
        if (insight.confidence > 0.7) {
          // Create long-term memory for high-confidence insights
          await ctx.runMutation(api.memoryLongTerm.store, {
            memoryType: "domain_knowledge",
            content: insight.description,
            structuredData: {
              agentType: args.agentType,
              insightType: insight.type,
              taskId: args.experience.taskId,
              learnedAt: new Date().toISOString(),
            },
            summary: `${insight.type}: ${insight.description}`,
            keywords: extractKeywordsFromInsight(insight.description),
            context: {
              domain: mapInsightTypeToDomain(insight.type),
              tags: [args.agentType, insight.type, "learned"],
            },
            importance: insight.confidence > 0.9 ? "high" : "medium",
            confidence: insight.confidence,
            source: "implicit_learning",
          });
        }
      }
    }
    
    // Trigger memory consolidation if needed
    if (memoryIds.length > 5) {
      await ctx.runMutation(api.memoryCompression.compressMemories, {
        memoryIds,
        strategy: "pattern",
        technique: "abstractive",
      });
    }
    
    return { memoriesCreated: memoryIds.length };
  },
});

// Helper functions

function getAgentCognitiveCapabilities(agentType: string): string[] {
  const capabilities: Record<string, string[]> = {
    manager: ["reasoning", "planning", "delegating", "monitoring"],
    financial: ["analyzing", "calculating", "forecasting", "optimizing"],
    legal: ["interpreting", "evaluating", "advising", "documenting"],
    secretary: ["organizing", "scheduling", "coordinating", "summarizing"],
    analytics: ["analyzing", "visualizing", "predicting", "reporting"],
    notifications: ["monitoring", "alerting", "prioritizing", "communicating"],
    vendor: ["evaluating", "comparing", "negotiating", "tracking"],
  };
  
  return capabilities[agentType] || ["learning", "processing"];
}

function getRelevantMemoryTypesForCognitiveState(
  state: keyof typeof COGNITIVE_STATES
): Array<"user_preference" | "interaction_pattern" | "domain_knowledge" | 
  "conversation_context" | "task_history" | "feedback" | 
  "entity_relation" | "process_knowledge"> {
  const stateMemoryMap = {
    learning: ["task_history", "feedback", "process_knowledge"],
    reasoning: ["domain_knowledge", "entity_relation", "process_knowledge"],
    recalling: ["conversation_context", "task_history", "user_preference"],
    reflecting: ["task_history", "feedback", "process_knowledge"],
    creating: ["domain_knowledge", "interaction_pattern", "entity_relation"],
  };
  
  return stateMemoryMap[state] as any || ["domain_knowledge"];
}

function getTimeContextCutoff(timeContext: string): number {
  const now = Date.now();
  const cutoffs: Record<string, number> = {
    recent: now - 24 * 60 * 60 * 1000,
    thisWeek: now - 7 * 24 * 60 * 60 * 1000,
    thisMonth: now - 30 * 24 * 60 * 60 * 1000,
    historical: 0,
  };
  
  return cutoffs[timeContext] || 0;
}

function calculateCognitiveRelevance(
  memory: any,
  cognitiveState: string,
  context: any
): number {
  let relevance = 1.0;
  
  // Boost relevance based on cognitive state
  switch (cognitiveState) {
    case "learning":
      if (memory.source === "explicit_feedback" || memory.source === "error_correction") {
        relevance *= 1.5;
      }
      break;
      
    case "reasoning":
      if (memory.memoryType === "domain_knowledge" || memory.memoryType === "entity_relation") {
        relevance *= 1.3;
      }
      break;
      
    case "reflecting":
      if (memory.memoryType === "task_history" && memory.structuredData?.outcome) {
        relevance *= 1.4;
      }
      break;
  }
  
  // Context-based adjustments
  if (context.taskType && memory.content.toLowerCase().includes(context.taskType.toLowerCase())) {
    relevance *= 1.2;
  }
  
  return relevance;
}

function calculateEmotionalAlignment(memory: any, targetValence: number): number {
  // Simple sentiment analysis based on keywords
  const positiveWords = ["success", "achieved", "improved", "excellent", "great"];
  const negativeWords = ["failed", "error", "problem", "issue", "wrong"];
  
  let memoryValence = 0;
  const content = memory.content.toLowerCase();
  
  positiveWords.forEach(word => {
    if (content.includes(word)) memoryValence += 0.2;
  });
  
  negativeWords.forEach(word => {
    if (content.includes(word)) memoryValence -= 0.2;
  });
  
  memoryValence = Math.max(-1, Math.min(1, memoryValence));
  
  // Calculate alignment (1 = perfect match, 0 = opposite)
  const alignment = 1 - Math.abs(targetValence - memoryValence) / 2;
  
  return alignment;
}

function determineObservationImportance(
  observation: string,
  outcome: string
): "critical" | "high" | "medium" | "low" | "temporary" {
  // Failures are more important for learning
  if (outcome === "failure") {
    return observation.includes("error") || observation.includes("critical") ? "critical" : "high";
  }
  
  // Success patterns
  if (outcome === "success") {
    return observation.includes("breakthrough") || observation.includes("optimal") ? "high" : "medium";
  }
  
  return "medium";
}

function extractKeywordsFromInsight(insight: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'
  ]);
  
  return insight.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 5);
}

function mapInsightTypeToDomain(insightType: string): string {
  const domainMap: Record<string, string> = {
    optimization: "performance",
    error_pattern: "reliability",
    user_behavior: "interaction",
    system_limit: "capacity",
    workflow: "process",
  };
  
  return domainMap[insightType] || "general";
}

// Export agent memory profile table schema
export const agentMemoryProfileSchema = {
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
};