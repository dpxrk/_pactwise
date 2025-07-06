// convex/ai/workingMemory.ts
import { mutation, query, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";

// ============================================================================
// WORKING MEMORY SYSTEM - INSPIRED BY COGNITIVE PSYCHOLOGY
// ============================================================================

/**
 * Working memory has limited capacity (7±2 items) and decays over time
 * This system implements a cognitive model for more human-like AI behavior
 */

interface WorkingMemoryItem {
  id: string;
  content: string;
  type: "concept" | "entity" | "task" | "preference" | "context";
  activation: number; // 0-1, decays over time
  lastAccessed: string;
  accessCount: number;
  associations: string[]; // IDs of related items
  source: "chat" | "memory" | "inference";
  metadata?: Record<string, any>;
}

interface WorkingMemoryState {
  userId: Id<"users">;
  sessionId: string;
  items: WorkingMemoryItem[];
  capacity: number; // Default 7
  focusItem?: string; // ID of current focus
  lastUpdate: string;
}

// Cognitive constants based on research
const WORKING_MEMORY_CAPACITY = 7;
const CAPACITY_VARIANCE = 2;
const DECAY_RATE = 0.1; // Per minute
const REHEARSAL_BOOST = 0.3;
const ASSOCIATION_STRENGTH = 0.2;

/**
 * Initialize or get working memory for a session
 */
export const initializeWorkingMemory = mutation({
  args: {
    sessionId: v.string(),
    capacity: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) throw new Error("User not found");

    // Check if working memory already exists
    const existing = await ctx.db
      .query("workingMemory")
      .withIndex("by_session", (q) => 
        q.eq("userId", user._id).eq("sessionId", args.sessionId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    // Create new working memory
    const workingMemoryId = await ctx.db.insert("workingMemory", {
      userId: user._id,
      sessionId: args.sessionId,
      items: [],
      capacity: args.capacity || WORKING_MEMORY_CAPACITY,
      lastUpdate: new Date().toISOString()
    });

    return workingMemoryId;
  }
});

/**
 * Add item to working memory with cognitive constraints
 */
export const addToWorkingMemory = mutation({
  args: {
    sessionId: v.string(),
    item: v.object({
      content: v.string(),
      type: v.union(
        v.literal("concept"),
        v.literal("entity"),
        v.literal("task"),
        v.literal("preference"),
        v.literal("context")
      ),
      source: v.union(
        v.literal("chat"),
        v.literal("memory"),
        v.literal("inference")
      ),
      associations: v.optional(v.array(v.string())),
      metadata: v.optional(v.any())
    })
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) throw new Error("User not found");

    const workingMemory = await ctx.db
      .query("workingMemory")
      .withIndex("by_session", (q) => 
        q.eq("userId", user._id).eq("sessionId", args.sessionId)
      )
      .first();

    if (!workingMemory) {
      throw new Error("Working memory not initialized");
    }

    // Apply decay to existing items
    const decayedItems = applyDecay(workingMemory.items, workingMemory.lastUpdate);

    // Create new item
    const newItem: WorkingMemoryItem = {
      id: crypto.randomUUID(),
      content: args.item.content,
      type: args.item.type,
      activation: 1.0, // New items start with full activation
      lastAccessed: new Date().toISOString(),
      accessCount: 1,
      associations: args.item.associations || [],
      source: args.item.source,
      metadata: args.item.metadata
    };

    // Check capacity constraints
    let updatedItems = [...decayedItems, newItem];
    
    if (updatedItems.length > workingMemory.capacity) {
      // Remove least activated items (forgetting)
      updatedItems = enforceCapacityLimit(updatedItems, workingMemory.capacity);
      
      // Store displaced items in long-term memory if important
      const displaced = decayedItems.filter(
        item => !updatedItems.find(i => i.id === item.id) && item.activation > 0.5
      );
      
      for (const item of displaced) {
        await consolidateToLongTermMemory(ctx, user._id, args.sessionId, item);
      }
    }

    // Update associations (spreading activation)
    updatedItems = updateAssociations(updatedItems, newItem.id);

    // Update working memory
    await ctx.db.patch(workingMemory._id, {
      items: updatedItems,
      focusItem: newItem.id,
      lastUpdate: new Date().toISOString()
    });

    return newItem.id;
  }
});

/**
 * Retrieve and refresh working memory
 */
export const getWorkingMemory = query({
  args: {
    sessionId: v.string(),
    includeAssociations: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) return null;

    const workingMemory = await ctx.db
      .query("workingMemory")
      .withIndex("by_session", (q) => 
        q.eq("userId", user._id).eq("sessionId", args.sessionId)
      )
      .first();

    if (!workingMemory) return null;

    // Apply decay
    const decayedItems = applyDecay(workingMemory.items, workingMemory.lastUpdate);

    // Build association graph if requested
    let associationGraph = null;
    if (args.includeAssociations) {
      associationGraph = buildAssociationGraph(decayedItems);
    }

    return {
      items: decayedItems.filter(item => item.activation > 0.1), // Filter out decayed items
      capacity: workingMemory.capacity,
      utilization: decayedItems.length / workingMemory.capacity,
      focusItem: workingMemory.focusItem,
      associationGraph
    };
  }
});

/**
 * Focus attention on a specific item (rehearsal)
 */
export const focusAttention = mutation({
  args: {
    sessionId: v.string(),
    itemId: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) throw new Error("User not found");

    const workingMemory = await ctx.db
      .query("workingMemory")
      .withIndex("by_session", (q) => 
        q.eq("userId", user._id).eq("sessionId", args.sessionId)
      )
      .first();

    if (!workingMemory) {
      throw new Error("Working memory not initialized");
    }

    // Apply decay
    let items = applyDecay(workingMemory.items, workingMemory.lastUpdate);

    // Find and boost the focused item
    const itemIndex = items.findIndex(item => item.id === args.itemId);
    if (itemIndex !== -1) {
      items[itemIndex].activation = Math.min(1.0, items[itemIndex].activation + REHEARSAL_BOOST);
      items[itemIndex].lastAccessed = new Date().toISOString();
      items[itemIndex].accessCount += 1;

      // Boost associated items slightly
      const associations = items[itemIndex].associations;
      for (const assocId of associations) {
        const assocIndex = items.findIndex(item => item.id === assocId);
        if (assocIndex !== -1) {
          items[assocIndex].activation = Math.min(
            1.0,
            items[assocIndex].activation + ASSOCIATION_STRENGTH
          );
        }
      }
    }

    await ctx.db.patch(workingMemory._id, {
      items,
      focusItem: args.itemId,
      lastUpdate: new Date().toISOString()
    });

    return { success: true };
  }
});

/**
 * Consolidate important items to long-term memory
 */
export const consolidateWorkingMemory = internalMutation({
  args: {
    sessionId: v.string()
  },
  handler: async (ctx, args) => {
    // First, find all working memories with this sessionId
    const allWorkingMemories = await ctx.db
      .query("workingMemory")
      .collect();
    
    const workingMemories = allWorkingMemories.filter(
      wm => wm.sessionId === args.sessionId
    );

    for (const wm of workingMemories) {
      const importantItems = wm.items.filter(
        item => item.activation > 0.7 || item.accessCount > 3
      );

      for (const item of importantItems) {
        await consolidateToLongTermMemory(ctx, wm.userId, args.sessionId, item);
      }

      // Clean up decayed items
      const activeItems = wm.items.filter(item => item.activation > 0.1);
      await ctx.db.patch(wm._id, {
        items: activeItems,
        lastUpdate: new Date().toISOString()
      });
    }
  }
});

// Helper functions

function applyDecay(
  items: WorkingMemoryItem[],
  lastUpdate: string
): WorkingMemoryItem[] {
  const now = new Date();
  const lastUpdateTime = new Date(lastUpdate);
  const minutesElapsed = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60);

  return items.map(item => {
    // Exponential decay with protection for frequently accessed items
    const decayProtection = Math.log(item.accessCount + 1) * 0.1;
    const decay = DECAY_RATE * minutesElapsed * (1 - decayProtection);
    
    return {
      ...item,
      activation: Math.max(0, item.activation - decay)
    };
  });
}

function enforceCapacityLimit(
  items: WorkingMemoryItem[],
  capacity: number
): WorkingMemoryItem[] {
  // Sort by activation level and recency
  return items
    .sort((a, b) => {
      const scoreA = a.activation + (1 / (Date.now() - new Date(a.lastAccessed).getTime() + 1));
      const scoreB = b.activation + (1 / (Date.now() - new Date(b.lastAccessed).getTime() + 1));
      return scoreB - scoreA;
    })
    .slice(0, capacity);
}

function updateAssociations(
  items: WorkingMemoryItem[],
  newItemId: string
): WorkingMemoryItem[] {
  // Find items that should be associated with the new item
  const newItem = items.find(item => item.id === newItemId);
  if (!newItem) return items;

  // Simple association based on type and content similarity
  return items.map(item => {
    if (item.id === newItemId) return item;

    // Check for association criteria
    const shouldAssociate = 
      item.type === newItem.type ||
      hasContentOverlap(item.content, newItem.content);

    if (shouldAssociate && !item.associations.includes(newItemId)) {
      return {
        ...item,
        associations: [...item.associations, newItemId]
      };
    }

    return item;
  });
}

function hasContentOverlap(content1: string, content2: string): boolean {
  const words1 = new Set(content1.toLowerCase().split(/\s+/));
  const words2 = new Set(content2.toLowerCase().split(/\s+/));
  const intersection = new Set(Array.from(words1).filter(x => words2.has(x)));
  
  return intersection.size / Math.min(words1.size, words2.size) > 0.3;
}

function buildAssociationGraph(items: WorkingMemoryItem[]): any {
  const nodes = items.map(item => ({
    id: item.id,
    label: item.content.substring(0, 50),
    type: item.type,
    activation: item.activation
  }));

  const edges: any[] = [];
  for (const item of items) {
    for (const assocId of item.associations) {
      if (items.find(i => i.id === assocId)) {
        edges.push({
          source: item.id,
          target: assocId,
          weight: item.activation * 0.5
        });
      }
    }
  }

  return { nodes, edges };
}

async function consolidateToLongTermMemory(
  ctx: any,
  userId: Id<"users">,
  sessionId: string,
  item: WorkingMemoryItem
): Promise<void> {
  // Map working memory types to long-term memory types
  const memoryTypeMap: Record<string, any> = {
    concept: "domain_knowledge",
    entity: "entity_relation",
    task: "task_history",
    preference: "user_preference",
    context: "conversation_context"
  };

  const memoryType = memoryTypeMap[item.type] || "domain_knowledge";

  try {
    await ctx.runMutation(ctx.api.memoryLongTerm.store, {
      memoryType,
      content: item.content,
      summary: `Consolidated from working memory: ${item.content.substring(0, 100)}`,
      keywords: item.content.toLowerCase().split(/\s+/).slice(0, 10),
      context: {
        sessionId,
        workingMemoryMetadata: {
          accessCount: item.accessCount,
          finalActivation: item.activation,
          associations: item.associations
        }
      },
      importance: item.activation > 0.8 ? "high" : "medium",
      confidence: item.activation,
      source: "working_memory_consolidation"
    });
  } catch (error) {
    console.error("Failed to consolidate to long-term memory:", error);
  }
}