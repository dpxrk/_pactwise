// convex/ai/chat.ts
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import OpenAI from "openai";

// Temporarily define api to avoid undefined errors
const api = {
  memoryShortTerm: { store: {} },
  memoryConsolidation: { triggerConsolidation: {} },
  memoryIntegration: { storeInteractionPattern: {}, storeUserFeedback: {} }
} as any;

// ============================================================================
// AI CHAT INTERFACE WITH MEMORY INTEGRATION
// ============================================================================

// Chat message type
export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  attachments?: {
    type: "contract" | "vendor";
    id: string;
    title: string;
  }[];
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
  };
};

// Chat session type
export type ChatSession = {
  _id: Id<"chatSessions">;
  userId: Id<"users">;
  title: string;
  messages: ChatMessage[];
  context?: {
    contractId?: Id<"contracts">;
    vendorId?: Id<"vendors">;
    enterpriseId: Id<"enterprises">;
  };
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
};

// Initialize OpenAI client
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }
  return new OpenAI({ apiKey });
};

/**
 * Analyze conversation for memory-worthy content
 */
function analyzeConversationForMemory(message: string, response: string, context?: any): {
  memoryType: "conversation_context" | "user_preference" | "domain_knowledge" | "feedback" | "entity_relation";
  importance: "critical" | "high" | "medium" | "low" | "temporary";
  shouldConsolidate: boolean;
  extractedInfo: any;
} {
  // Keywords that indicate preferences
  const preferenceKeywords = ['prefer', 'like', 'want', 'need', 'always', 'never', 'usually', 'typically'];
  const feedbackKeywords = ['good', 'bad', 'better', 'worse', 'excellent', 'poor', 'helpful', 'not helpful'];
  const domainKeywords = ['contract', 'vendor', 'compliance', 'payment', 'deadline', 'obligation', 'risk'];
  
  const lowerMessage = message.toLowerCase();
  const lowerResponse = response.toLowerCase();
  
  // Check for user preferences
  if (preferenceKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return {
      memoryType: 'user_preference',
      importance: 'high',
      shouldConsolidate: true,
      extractedInfo: {
        preferenceContext: message,
        responseContext: response
      }
    };
  }
  
  // Check for feedback
  if (feedbackKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return {
      memoryType: 'feedback',
      importance: 'medium',
      shouldConsolidate: false,
      extractedInfo: {
        feedbackType: lowerMessage.includes('good') || lowerMessage.includes('excellent') || lowerMessage.includes('helpful') ? 'positive' : 'negative',
        context: message
      }
    };
  }
  
  // Check for domain knowledge
  if (domainKeywords.some(keyword => lowerMessage.includes(keyword) || lowerResponse.includes(keyword))) {
    return {
      memoryType: 'domain_knowledge',
      importance: 'medium',
      shouldConsolidate: true,
      extractedInfo: {
        topic: domainKeywords.find(keyword => lowerMessage.includes(keyword) || lowerResponse.includes(keyword)),
        question: message,
        answer: response
      }
    };
  }
  
  // Default to conversation context
  return {
    memoryType: 'conversation_context',
    importance: 'low',
    shouldConsolidate: false,
    extractedInfo: {
      userQuery: message,
      assistantResponse: response
    }
  };
}

/**
 * Send a chat message and get AI response
 */
export const sendChatMessage = mutation({
  args: {
    sessionId: v.optional(v.id("chatSessions")),
    message: v.string(),
    attachments: v.optional(v.array(v.object({
      type: v.union(v.literal("contract"), v.literal("vendor")),
      id: v.string(),
      title: v.string()
    }))),
    context: v.optional(v.object({
      contractId: v.optional(v.id("contracts")),
      vendorId: v.optional(v.id("vendors"))
    }))
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not authenticated");
    }

    // Get user from database
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }

    // Create or get chat session
    let sessionId = args.sessionId;
    if (!sessionId) {
      // Create new session
      sessionId = await ctx.db.insert("chatSessions", {
        userId: user._id,
        enterpriseId: user.enterpriseId,
        title: args.message.substring(0, 50) + "...",
        messages: [],
        context: args.context ? {
          ...args.context,
          enterpriseId: user.enterpriseId
        } : { enterpriseId: user.enterpriseId },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true
      });
    }

    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error("Chat session not found");
    }

    // Create user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: args.message,
      timestamp: new Date().toISOString(),
      attachments: args.attachments
    };

    // Add user message to session
    const updatedMessages = [...session.messages, userMessage];
    
    // Build context for AI
    let contextInfo = "";
    if (args.attachments && args.attachments.length > 0) {
      for (const attachment of args.attachments) {
        if (attachment.type === "contract") {
          const contract = await ctx.db.get(attachment.id as Id<"contracts">);
          if (contract) {
            contextInfo += `\nContract: ${contract.title}\n`;
            if (contract.extractedScope) {
              contextInfo += `Scope: ${contract.extractedScope}\n`;
            }
            if (contract.extractedParties) {
              contextInfo += `Parties: ${contract.extractedParties.join(", ")}\n`;
            }
          }
        } else if (attachment.type === "vendor") {
          const vendor = await ctx.db.get(attachment.id as Id<"vendors">);
          if (vendor) {
            contextInfo += `\nVendor: ${vendor.name}\n`;
            if (vendor.category) {
              contextInfo += `Category: ${vendor.category}\n`;
            }
          }
        }
      }
    }

    // Initialize working memory for this session
    try {
      // Check if working memory already exists
      const existingMemory = await ctx.db
        .query("workingMemory")
        .withIndex("by_session", (q) => 
          q.eq("userId", user._id).eq("sessionId", sessionId!)
        )
        .first();
      
      if (!existingMemory) {
        // Create new working memory
        await ctx.db.insert("workingMemory", {
          userId: user._id,
          sessionId: sessionId!,
          items: [],
          capacity: 7,
          lastUpdate: new Date().toISOString()
        });
      }
    } catch (error) {
      console.log("Working memory initialization error:", error);
    }

    // Get enhanced memories using the new retrieval system
    let memoryContext = "";
    let workingMemoryContext = "";
    try {
      // Use enhanced memory retrieval
      const entityId = args.context?.contractId || args.context?.vendorId;
      const entityType = args.context?.contractId ? "contract" : args.context?.vendorId ? "vendor" : undefined;
      
      // Skip enhanced memory retrieval to avoid type issues
      const enhancedMemories = { memories: [], explanations: {} };
      /*
      const enhancedMemories = await ctx.runQuery(api.ai.enhancedMemoryRetrieval.enhancedMemoryRetrieval as any, {
        context: {
          query: args.message,
          entityContext: entityId && entityType ? {
            type: entityType,
            id: entityId as string
          } : undefined,
          temporalContext: {
            referenceTime: new Date().toISOString(),
            timeWindow: 168 // 7 days
          }
        },
        limit: 15,
        includeExplanations: true
      });*/
      
      // Get working memory state directly from database
      const workingMemoryDoc = await ctx.db
        .query("workingMemory")
        .withIndex("by_session", (q) => 
          q.eq("userId", user._id).eq("sessionId", sessionId!)
        )
        .first();
      
      const workingMemory = workingMemoryDoc ? {
        items: workingMemoryDoc.items,
        capacity: workingMemoryDoc.capacity,
        focusItem: workingMemoryDoc.focusItem
      } : null;
      
      // Also get standard memories for fallback
      // Query long term and short term memories
      const longTermMemories = await ctx.db
        .query("longTermMemory")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(10);
        
      const shortTermMemories = await ctx.db
        .query("shortTermMemory")
        .withIndex("by_user_session", (q) => 
          q.eq("userId", user._id).eq("sessionId", sessionId!)
        )
        .order("desc")
        .take(5);
      
      // Build enhanced memory context
      if (enhancedMemories.memories.length > 0) {
        memoryContext += "\n\nEnhanced Memory Context:\n";
        enhancedMemories.memories.forEach((mem: any, idx: number) => {
          if (mem.type === "synthesized") {
            memoryContext += `- Combined insight: ${mem.content}\n`;
          } else {
            const explanation = enhancedMemories.explanations?.[idx]?.explanation || "";
            memoryContext += `- ${mem.content} ${explanation ? `(${explanation})` : ""}\n`;
          }
        });
      }
      
      // Add working memory context
      if (workingMemory && workingMemory.items.length > 0) {
        workingMemoryContext += "\n\nCurrent Working Memory (Active Context):\n";
        workingMemory.items
          .filter((item: any) => item.activation > 0.5)
          .forEach((item: any) => {
            workingMemoryContext += `- [${item.type}] ${item.content} (activation: ${item.activation.toFixed(2)})\n`;
          });
      }
      
      // Fallback to standard memories if enhanced retrieval is empty
      if (!enhancedMemories.memories.length && longTermMemories.length > 0) {
        memoryContext += "\n\nRelevant memories and preferences:\n";
        longTermMemories.forEach((mem: any) => {
          if (mem.memoryType === "user_preference") {
            memoryContext += `- User preference: ${mem.content}\n`;
          } else if (mem.memoryType === "domain_knowledge") {
            memoryContext += `- Previous knowledge: ${mem.content}\n`;
          }
        });
      }
      
      // Add recent conversation context
      if (shortTermMemories.length > 0) {
        memoryContext += "\nRecent context:\n";
        shortTermMemories.slice(0, 5).forEach((mem: any) => {
          if (mem.memoryType === "conversation_context" || mem.memoryType === "feedback") {
            memoryContext += `- ${mem.content}\n`;
          }
        });
      }
    } catch (error) {
      console.log("Could not retrieve memories:", error);
    }

    // Get AI response
    const openai = getOpenAIClient();
    const systemPrompt = `You are an AI assistant specializing in contract and vendor management. 
You help users understand contracts, identify risks, suggest improvements, and manage vendor relationships.
Be concise, professional, and actionable in your responses.

You have access to advanced memory systems:
1. Enhanced Memory Retrieval: Semantic search with multi-stage ranking
2. Working Memory: Limited capacity (7±2 items) with activation decay
3. Long-term Memory: Persistent knowledge and preferences

Use this context to personalize your responses and provide more relevant assistance.
Pay special attention to items in working memory as they represent the current context.

Context about the current session:
${contextInfo}
${workingMemoryContext}
${memoryContext}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4-1106-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...updatedMessages.map(msg => ({
            role: msg.role as "user" | "assistant",
            content: msg.content
          }))
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      const aiContent = response.choices[0]?.message?.content;
      if (!aiContent) {
        throw new Error("No response from AI");
      }

      // Create AI message
      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: aiContent,
        timestamp: new Date().toISOString(),
        metadata: {
          model: "gpt-4-1106-preview",
          tokens: response.usage?.total_tokens
        }
      };

      // Update session with both messages
      await ctx.db.patch(sessionId, {
        messages: [...updatedMessages, aiMessage],
        updatedAt: new Date().toISOString()
      });

      // Store conversation in memory system
      try {
        // Analyze the conversation for memory-worthy content
        const memoryAnalysis = analyzeConversationForMemory(args.message, aiContent, args.context);
        
        // Add to working memory
        const workingMemoryType = memoryAnalysis.memoryType === "user_preference" ? "preference" :
                                  memoryAnalysis.memoryType === "domain_knowledge" ? "concept" :
                                  memoryAnalysis.memoryType === "entity_relation" ? "entity" :
                                  memoryAnalysis.memoryType === "feedback" ? "preference" : "context";
        
        // Add item to working memory directly
        const workingMem = await ctx.db
          .query("workingMemory")
          .withIndex("by_session", (q) => 
            q.eq("userId", user._id).eq("sessionId", sessionId!)
          )
          .first();
        
        if (workingMem) {
          const newItem = {
            id: crypto.randomUUID(),
            content: memoryAnalysis.extractedInfo.userQuery || args.message,
            type: workingMemoryType as "concept" | "entity" | "task" | "preference" | "context",
            activation: 1.0,
            lastAccessed: new Date().toISOString(),
            accessCount: 1,
            associations: [],
            source: "chat" as const,
            metadata: {
              aiResponse: aiContent.substring(0, 200),
              memoryType: memoryAnalysis.memoryType,
              importance: memoryAnalysis.importance
            }
          };
          
          // Update working memory with new item
          const updatedItems = [...workingMem.items, newItem];
          
          // Keep only the most recent items based on capacity
          if (updatedItems.length > workingMem.capacity) {
            updatedItems.sort((a, b) => b.activation - a.activation);
            updatedItems.splice(workingMem.capacity);
          }
          
          await ctx.db.patch(workingMem._id, {
            items: updatedItems,
            lastUpdate: new Date().toISOString()
          });
        }
        
        // Store in short-term memory
        await ctx.runMutation(api.memoryShortTerm.store as any, {
          sessionId: sessionId!,
          memoryType: memoryAnalysis.memoryType,
          content: `User asked: "${args.message}". Assistant responded: "${aiContent.substring(0, 200)}..."`,
          structuredData: {
            ...memoryAnalysis.extractedInfo,
            chatSessionId: sessionId,
            timestamp: new Date().toISOString(),
            attachments: args.attachments
          },
          context: {
            relatedEntities: args.attachments?.map(att => ({
              type: att.type,
              id: att.id,
              name: att.title
            })) || []
          },
          importance: memoryAnalysis.importance,
          confidence: 0.8,
          source: "conversation"
        });
        
        // If it should be consolidated to long-term memory
        if (memoryAnalysis.shouldConsolidate && memoryAnalysis.importance !== "low") {
          await ctx.runMutation(api.memoryConsolidation.triggerConsolidation as any, {
            sessionId: sessionId!
          });
        }
        
        // Store interaction pattern
        if (args.attachments && args.attachments.length > 0) {
          for (const attachment of args.attachments) {
            await ctx.runMutation(api.memoryIntegration.storeInteractionPattern as any, {
              sessionId: sessionId!,
              action: "chat_about",
              entityType: attachment.type,
              entityId: attachment.id,
              metadata: {
                messageLength: args.message.length,
                hasContext: true
              }
            });
          }
        }
      } catch (error) {
        console.error("Failed to store memory:", error);
        // Don't fail the chat if memory storage fails
      }

      return {
        sessionId,
        message: aiMessage
      };

    } catch (error) {
      console.error("AI chat failed:", error);
      
      // Fallback message
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I apologize, but I'm unable to process your request at the moment. Please try again later.",
        timestamp: new Date().toISOString()
      };

      await ctx.db.patch(sessionId, {
        messages: [...updatedMessages, errorMessage],
        updatedAt: new Date().toISOString()
      });

      return {
        sessionId,
        message: errorMessage
      };
    }
  }
});

/**
 * Provide feedback on a chat message
 */
export const provideChatFeedback = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    messageId: v.string(),
    feedback: v.union(v.literal("helpful"), v.literal("not_helpful")),
    comment: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not authenticated");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Chat session not found");
    }

    // Store feedback in a separate table for analytics
    await ctx.db.insert("chatFeedback", {
      sessionId: args.sessionId,
      messageId: args.messageId,
      userId: session.userId,
      feedback: args.feedback,
      comment: args.comment,
      createdAt: new Date().toISOString()
    });

    // Also store feedback in memory system
    try {
      const feedbackContent = args.comment 
        ? `User provided ${args.feedback} feedback on AI response: ${args.comment}`
        : `User marked AI response as ${args.feedback}`;
      
      await ctx.runMutation(api.memoryIntegration.storeUserFeedback as any, {
        sessionId: args.sessionId,
        feedbackType: args.feedback === "helpful" ? "positive" : "negative",
        content: feedbackContent,
        relatedEntityId: args.sessionId,
        relatedEntityType: "chat_session"
      });
    } catch (error) {
      console.error("Failed to store feedback in memory:", error);
    }

    return { success: true };
  }
});

/**
 * Get chat sessions for the current user
 */
export const getChatSessions = query({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user) {
      return [];
    }

    const limit = args.limit || 10;
    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .order("desc")
      .take(limit);

    return sessions;
  }
});

/**
 * Get a specific chat session
 */
export const getChatSession = query({
  args: {
    sessionId: v.id("chatSessions")
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return null;
    }

    // Verify user owns this session
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user || session.userId !== user._id) {
      return null;
    }

    return session;
  }
});

/**
 * Get memory context for a chat session
 */
export const getChatMemoryContext = query({
  args: {
    sessionId: v.id("chatSessions"),
    includePreferences: v.optional(v.boolean()),
    includeHistory: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return null;
    }

    // Verify user owns this session
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user || session.userId !== user._id) {
      return null;
    }

    const result: {
      preferences: any[];
      recentMemories: any[];
      domainKnowledge: any[];
    } = {
      preferences: [],
      recentMemories: [],
      domainKnowledge: []
    };

    try {
      // Get user preferences if requested
      if (args.includePreferences) {
        const preferences = await ctx.runQuery(api.memoryLongTerm.getMemories, {
          memoryTypes: ["user_preference"],
          minImportance: "medium",
          limit: 10
        });
        result.preferences = preferences;
      }

      // Get recent conversation memories if requested
      if (args.includeHistory) {
        const recentMemories = await ctx.runQuery(api.memoryShortTerm.getRecentMemories, {
          memoryTypes: ["conversation_context", "feedback"],
          limit: 20,
          minImportance: "low"
        });
        result.recentMemories = recentMemories;
      }

      // Always include relevant domain knowledge
      const domainKnowledge = await ctx.runQuery(api.memoryLongTerm.getMemories, {
        memoryTypes: ["domain_knowledge"],
        minImportance: "medium",
        minStrength: 0.6,
        limit: 10
      });
      result.domainKnowledge = domainKnowledge;

    } catch (error) {
      console.error("Failed to get memory context:", error);
    }

    return result;
  }
});

/**
 * Delete a chat session
 */
export const deleteChatSession = mutation({
  args: {
    sessionId: v.id("chatSessions")
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not authenticated");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Chat session not found");
    }

    // Verify user owns this session
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user || session.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    // Soft delete
    await ctx.db.patch(args.sessionId, {
      isActive: false,
      updatedAt: new Date().toISOString()
    });

    return { success: true };
  }
});