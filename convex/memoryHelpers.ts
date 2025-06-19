// convex/memoryHelpers.ts
import { Id, Doc } from "./_generated/dataModel";
import { MutationCtx } from "./_generated/server";

// Helper function to store short-term memory directly
export async function storeShortTermMemory(
  ctx: MutationCtx,
  args: {
    sessionId: string;
    memoryType: "user_preference" | "interaction_pattern" | "domain_knowledge" | "conversation_context" | "task_history" | "feedback" | "entity_relation" | "process_knowledge";
    content: string;
    structuredData?: any;
    context: {
      conversationId?: string;
      taskId?: Id<"agentTasks">;
      contractId?: Id<"contracts">;
      vendorId?: Id<"vendors">;
      agentId?: string;
      relatedEntities?: Array<{
        type: string;
        id: string;
        name?: string;
      }>;
    };
    importance: "critical" | "high" | "medium" | "low" | "temporary";
    confidence: number;
    source: "explicit_feedback" | "implicit_learning" | "task_outcome" | "error_correction" | "conversation" | "system_observation";
    sourceMetadata?: any;
    expiresAt?: string;
  }
): Promise<Id<"shortTermMemory">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  // Get user and enterprise info
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();
  
  if (!user) throw new Error("User not found");

  const now = new Date().toISOString();
  
  // Calculate expiry if not provided
  const expiresAt = args.expiresAt || calculateExpiry(args.importance);

  // Check for similar existing memories to avoid duplicates
  const existingMemories = await ctx.db
    .query("shortTermMemory")
    .withIndex("by_user_session", (q) => 
      q.eq("userId", user._id).eq("sessionId", args.sessionId)
    )
    .filter((q) => 
      q.and(
        q.eq(q.field("memoryType"), args.memoryType),
        q.eq(q.field("content"), args.content)
      )
    )
    .first();

  if (existingMemories) {
    // Update access count and timestamp for existing memory
    await ctx.db.patch(existingMemories._id, {
      accessCount: existingMemories.accessCount + 1,
      lastAccessedAt: now,
      importance: args.importance, // Update importance if changed
      confidence: Math.max(existingMemories.confidence, args.confidence),
    });
    return existingMemories._id;
  }

  // Store new memory
  const memoryId = await ctx.db.insert("shortTermMemory", {
    userId: user._id,
    enterpriseId: user.enterpriseId,
    sessionId: args.sessionId,
    memoryType: args.memoryType,
    content: args.content,
    structuredData: args.structuredData,
    context: args.context,
    importance: args.importance,
    confidence: args.confidence,
    accessCount: 1,
    lastAccessedAt: now,
    createdAt: now,
    expiresAt,
    isProcessed: false,
    shouldConsolidate: args.importance === "critical" || args.importance === "high",
    source: args.source,
    sourceMetadata: args.sourceMetadata,
  });

  return memoryId;
}

// Helper function to calculate expiry based on importance
function calculateExpiry(importance: string): string {
  const now = new Date();
  
  switch (importance) {
    case "critical":
      // Never expires (return far future date)
      return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
    case "high":
      // Expires in 7 days
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    case "medium":
      // Expires in 24 hours
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case "low":
      // Expires in 4 hours
      return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
    case "temporary":
      // Expires in 30 minutes
      return new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    default:
      // Default to 24 hours
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }
}