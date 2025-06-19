// convex/memory/conversationThread.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { storeShortTermMemory } from "./memoryHelpers";

// ============================================================================
// CONVERSATION THREAD MANAGEMENT
// ============================================================================

// Create a new conversation thread
export const createThread = mutation({
  args: {
    title: v.optional(v.string()),
    initialMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) throw new Error("User not found");

    const now = new Date().toISOString();

    // Create the thread
    const threadId = await ctx.db.insert("conversationThreads", {
      userId: user._id,
      enterpriseId: user.enterpriseId,
      title: args.title || "New Conversation",
      status: "active",
      startedAt: now,
      lastMessageAt: now,
      messageCount: args.initialMessage ? 1 : 0,
    });

    // Add initial message if provided
    if (args.initialMessage) {
      await ctx.db.insert("conversationMessages", {
        threadId,
        userId: user._id,
        enterpriseId: user.enterpriseId,
        role: "user",
        content: args.initialMessage,
        timestamp: now,
        isProcessed: false,
      });
    }

    return { threadId, created: true };
  },
});

// Add a message to a conversation thread
export const addMessage = mutation({
  args: {
    threadId: v.id("conversationThreads"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    agentId: v.optional(v.string()),
    agentTaskId: v.optional(v.id("agentTasks")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) throw new Error("User not found");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (thread.userId !== user._id) throw new Error("Unauthorized");

    const now = new Date().toISOString();

    // Create the message
    const messageId = await ctx.db.insert("conversationMessages", {
      threadId: args.threadId,
      userId: user._id,
      enterpriseId: user.enterpriseId,
      role: args.role,
      content: args.content,
      timestamp: now,
      isProcessed: false,
      ...(args.agentId && { agentId: args.agentId }),
      ...(args.agentTaskId && { agentTaskId: args.agentTaskId }),
    });

    // Update thread
    await ctx.db.patch(args.threadId, {
      lastMessageAt: now,
      messageCount: thread.messageCount + 1,
      status: "active",
    });

    // Process the message for memory storage
    if (args.role === "user") {
      await processUserMessage(ctx, messageId, args.content, user._id, thread);
    } else if (args.role === "assistant") {
      await processAssistantMessage(ctx, messageId, args.content, user._id, thread);
    }

    return { messageId, processed: true };
  },
});

// Get conversation threads for the current user
export const getThreads = query({
  args: {
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("archived")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) return [];

    let query = ctx.db
      .query("conversationThreads")
      .withIndex("by_user", (q) => q.eq("userId", user._id));

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status));
    }

    const threads = await query
      .order("desc")
      .take(args.limit || 20);

    return threads;
  },
});

// Get messages in a thread
export const getMessages = query({
  args: {
    threadId: v.id("conversationThreads"),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) return [];

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== user._id) return [];

    const messages = await ctx.db
      .query("conversationMessages")
      .withIndex("by_thread_timestamp", (q) => 
        q.eq("threadId", args.threadId)
      )
      .order("asc")
      .collect();

    // Apply offset and limit
    const start = args.offset || 0;
    const end = start + (args.limit || messages.length);
    
    return messages.slice(start, end);
  },
});

// Update thread summary and analysis
export const analyzeThread = mutation({
  args: {
    threadId: v.id("conversationThreads"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");

    // Get all messages in the thread
    const messages = await ctx.db
      .query("conversationMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    if (messages.length === 0) return { analyzed: false };

    // Analyze conversation
    const analysis = analyzeConversation(messages);

    // Extract related entities
    const relatedContracts = new Set<Id<"contracts">>();
    const relatedVendors = new Set<Id<"vendors">>();
    const relatedTasks = new Set<Id<"agentTasks">>();

    messages.forEach(msg => {
      msg.extractedEntities?.forEach(entity => {
        if (entity.type === "contract") {
          relatedContracts.add(entity.value as Id<"contracts">);
        } else if (entity.type === "vendor") {
          relatedVendors.add(entity.value as Id<"vendors">);
        }
      });
      if (msg.agentTaskId) {
        relatedTasks.add(msg.agentTaskId);
      }
    });

    // Update thread with analysis
    await ctx.db.patch(args.threadId, {
      summary: analysis.summary,
      topics: analysis.topics,
      sentiment: analysis.sentiment,
      relatedContracts: Array.from(relatedContracts),
      relatedVendors: Array.from(relatedVendors),
      relatedTasks: Array.from(relatedTasks),
    });

    return { analyzed: true, analysis };
  },
});

// Archive old threads
export const archiveOldThreads = mutation({
  args: {
    daysOld: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) throw new Error("User not found");

    const daysOld = args.daysOld || 30;
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

    const oldThreads = await ctx.db
      .query("conversationThreads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => 
        q.and(
          q.neq(q.field("status"), "archived"),
          q.lt(q.field("lastMessageAt"), cutoffDate)
        )
      )
      .collect();

    for (const thread of oldThreads) {
      await ctx.db.patch(thread._id, {
        status: "archived",
      });
    }

    return { archived: oldThreads.length };
  },
});

// Helper functions for message processing
async function processUserMessage(
  ctx: any,
  messageId: Id<"conversationMessages">,
  content: string,
  userId: Id<"users">,
  thread: Doc<"conversationThreads">
) {
  // Extract intents and entities
  const extraction = extractIntentsAndEntities(content);
  
  // Update message with extraction
  await ctx.db.patch(messageId, {
    extractedIntents: extraction.intents,
    extractedEntities: extraction.entities,
    isProcessed: true,
  });

  // Store in short-term memory
  const sessionId = `thread-${thread._id}`;
  const memoryId = await storeShortTermMemory(ctx, {
    sessionId,
    memoryType: "conversation_context",
    content: content,
    structuredData: {
      messageId,
      threadId: thread._id,
      intents: extraction.intents,
      entities: extraction.entities,
    },
    context: {
      conversationId: thread._id,
    },
    importance: extraction.intents.includes("question") ? "high" : "medium",
    confidence: 0.8,
    source: "conversation",
  });

  // Update message with created memory
  await ctx.db.patch(messageId, {
    createdMemories: [memoryId],
  });
}

async function processAssistantMessage(
  ctx: any,
  messageId: Id<"conversationMessages">,
  content: string,
  userId: Id<"users">,
  thread: Doc<"conversationThreads">
) {
  // Store assistant responses for learning patterns
  const sessionId = `thread-${thread._id}`;
  
  // Get the previous user message to understand context
  const previousMessages = await ctx.db
    .query("conversationMessages")
    .withIndex("by_thread_timestamp", (q) => q.eq("threadId", thread._id))
    .order("desc")
    .take(2);

  const userMessage = previousMessages.find(m => m.role === "user");
  
  if (userMessage) {
    // Store the interaction pattern
    await storeShortTermMemory(ctx, {
      sessionId,
      memoryType: "process_knowledge",
      content: `Response pattern: User asked "${userMessage.content.substring(0, 100)}..." and system responded with "${content.substring(0, 100)}..."`,
      structuredData: {
        userIntent: userMessage.extractedIntents?.[0],
        responseType: categorizeResponse(content),
        successful: true,
      },
      context: {
        conversationId: thread._id,
      },
      importance: "low",
      confidence: 0.7,
      source: "system_observation",
    });
  }

  await ctx.db.patch(messageId, {
    isProcessed: true,
  });
}

// Analysis helper functions
function analyzeConversation(messages: Doc<"conversationMessages">[]) {
  const userMessages = messages.filter(m => m.role === "user");
  const assistantMessages = messages.filter(m => m.role === "assistant");

  // Extract topics from all messages
  const allText = messages.map(m => m.content).join(" ");
  const topics = extractTopics(allText);

  // Analyze sentiment
  const sentiment = analyzeSentiment(userMessages);

  // Generate summary
  const summary = generateConversationSummary(messages);

  return {
    summary,
    topics,
    sentiment,
    userMessageCount: userMessages.length,
    assistantMessageCount: assistantMessages.length,
  };
}

function extractIntentsAndEntities(text: string): {
  intents: string[];
  entities: Array<{ type: string; value: string; confidence: number }>;
} {
  const intents: string[] = [];
  const entities: Array<{ type: string; value: string; confidence: number }> = [];

  // Simple intent detection
  if (text.includes("?")) intents.push("question");
  if (text.match(/\b(create|add|new)\b/i)) intents.push("create");
  if (text.match(/\b(update|edit|change|modify)\b/i)) intents.push("update");
  if (text.match(/\b(delete|remove)\b/i)) intents.push("delete");
  if (text.match(/\b(show|list|get|find|search)\b/i)) intents.push("query");
  if (text.match(/\b(help|how|what|explain)\b/i)) intents.push("help");

  // Simple entity extraction
  const contractPattern = /\b(contract|agreement)\s+(\w+)/gi;
  const vendorPattern = /\b(vendor|supplier)\s+(\w+)/gi;
  const datePattern = /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})\b/g;

  let match;
  while ((match = contractPattern.exec(text)) !== null) {
    entities.push({ type: "contract_mention", value: match[2], confidence: 0.7 });
  }
  while ((match = vendorPattern.exec(text)) !== null) {
    entities.push({ type: "vendor_mention", value: match[2], confidence: 0.7 });
  }
  while ((match = datePattern.exec(text)) !== null) {
    entities.push({ type: "date", value: match[1], confidence: 0.9 });
  }

  return { intents, entities };
}

function extractTopics(text: string): string[] {
  // Simple topic extraction based on keywords
  const topics = new Set<string>();
  
  if (text.match(/\b(contract|agreement|terms)\b/i)) topics.add("contracts");
  if (text.match(/\b(vendor|supplier|partner)\b/i)) topics.add("vendors");
  if (text.match(/\b(payment|cost|price|budget)\b/i)) topics.add("financial");
  if (text.match(/\b(compliance|legal|regulation)\b/i)) topics.add("compliance");
  if (text.match(/\b(renew|expire|deadline)\b/i)) topics.add("lifecycle");
  if (text.match(/\b(risk|issue|problem)\b/i)) topics.add("risk_management");

  return Array.from(topics);
}

function analyzeSentiment(
  messages: Doc<"conversationMessages">[]
): "positive" | "neutral" | "negative" | "mixed" {
  if (messages.length === 0) return "neutral";

  let positive = 0;
  let negative = 0;

  messages.forEach(msg => {
    const content = msg.content.toLowerCase();
    
    // Simple sentiment analysis
    if (content.match(/\b(good|great|excellent|happy|satisfied|thank)\b/)) positive++;
    if (content.match(/\b(bad|poor|unhappy|dissatisfied|problem|issue)\b/)) negative++;
  });

  if (positive > negative * 2) return "positive";
  if (negative > positive * 2) return "negative";
  if (positive > 0 && negative > 0) return "mixed";
  return "neutral";
}

function generateConversationSummary(messages: Doc<"conversationMessages">[]): string {
  if (messages.length === 0) return "Empty conversation";
  
  const firstUserMessage = messages.find(m => m.role === "user");
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");
  
  let summary = "Conversation";
  if (firstUserMessage) {
    summary += ` started with: "${firstUserMessage.content.substring(0, 50)}..."`;
  }
  if (lastAssistantMessage) {
    summary += ` Last response: "${lastAssistantMessage.content.substring(0, 50)}..."`;
  }
  
  return summary;
}

function categorizeResponse(content: string): string {
  if (content.match(/\b(created|added|saved)\b/i)) return "creation_confirmation";
  if (content.match(/\b(updated|modified|changed)\b/i)) return "update_confirmation";
  if (content.match(/\b(here is|here are|found|showing)\b/i)) return "information_delivery";
  if (content.match(/\b(error|failed|unable|cannot)\b/i)) return "error_message";
  if (content.match(/\b(help|guide|instructions)\b/i)) return "help_content";
  return "general_response";
}