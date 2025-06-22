// convex/collaborativeDocuments.ts
import { v } from "convex/values";
import { query, mutation, internalMutation } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";

// Type definitions for document data
type DocumentInsertData = {
  title: string;
  contractId?: Id<"contracts">;
  ownerId: Id<"users">;
  collaborators: Id<"users">[];
  permissions: {
    read: Id<"users">[];
    write: Id<"users">[];
    comment: Id<"users">[];
    admin: Id<"users">[];
  };
  state: {
    content: string;
    operations: Array<{
      type: "insert" | "delete" | "retain" | "format";
      position: number;
      userId: Id<"users">;
      timestamp: number;
      id: string;
      content?: string;
      length?: number;
      attributes?: unknown;
    }>;
    version: number;
    lastModified: number;
    spans: Array<{
      content: string;
      attributes?: unknown;
      start: number;
      end: number;
    }>;
  };
  isLocked: boolean;
  createdAt: number;
};

type SuggestionInsertData = {
  documentId: Id<"collaborativeDocuments">;
  userId: Id<"users">;
  userName: string;
  type: "delete" | "insert" | "replace";
  position: number;
  length: number;
  originalContent: string;
  suggestedContent: string;
  reason?: string;
  status: "pending";
  createdAt: number;
};

type SuggestionPatchData = {
  status: "accepted" | "rejected";
  reviewedBy: Id<"users">;
  reviewedAt: number;
  reviewComment?: string;
};

// ============================================================================
// QUERIES
// ============================================================================

export const getDocument = query({
  args: { documentId: v.id("collaborativeDocuments") },
  handler: async (ctx, { documentId }) => {
    const document = await ctx.db.get(documentId);
    if (!document) return null;

    return document;
  }
});

export const getDocumentByContract = query({
  args: { 
    contractId: v.id("contracts"),
    enterpriseId: v.id("enterprises")
  },
  handler: async (ctx, { contractId, enterpriseId }) => {
    // First check if a collaborative document exists for this contract
    const existingDoc = await ctx.db
      .query("collaborativeDocuments")
      .withIndex("by_contract", (q) => q.eq("contractId", contractId))
      .first();

    if (existingDoc) {
      return existingDoc;
    }

    // If no collaborative document exists, we could create one here
    // or return null to let the frontend handle creation
    return null;
  }
});

export const getPresence = query({
  args: { documentId: v.id("collaborativeDocuments") },
  handler: async (ctx, { documentId }) => {
    const session = await ctx.db
      .query("collaborativeSessions")
      .withIndex("by_document", (q) => q.eq("documentId", documentId))
      .first();

    return session?.users.filter(user => user.isActive) || [];
  }
});

export const getUserDocuments = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // Get all documents and filter in memory
    // (Convex doesn't support arrayContains in queries yet)
    const allDocuments = await ctx.db
      .query("collaborativeDocuments")
      .order("desc")
      .collect();

    // Filter documents where user is owner or collaborator
    const userDocuments = allDocuments.filter(doc => 
      doc.ownerId === userId || doc.collaborators.includes(userId)
    );

    // Return the most recent 10
    return userDocuments.slice(0, 10);
  }
});

export const getComments = query({
  args: { documentId: v.id("collaborativeDocuments") },
  handler: async (ctx, { documentId }) => {
    const comments = await ctx.db
      .query("documentComments")
      .withIndex("by_document", (q) => q.eq("documentId", documentId))
      .collect();

    return comments.sort((a, b) => a.position - b.position);
  }
});

export const getSuggestions = query({
  args: { documentId: v.id("collaborativeDocuments") },
  handler: async (ctx, { documentId }) => {
    const suggestions = await ctx.db
      .query("documentSuggestions")
      .withIndex("by_document", (q) => q.eq("documentId", documentId))
      .collect();

    return suggestions.sort((a, b) => b.createdAt - a.createdAt);
  }
});

export const getVersionHistory = query({
  args: { documentId: v.id("collaborativeDocuments") },
  handler: async (ctx, { documentId }) => {
    const snapshots = await ctx.db
      .query("documentSnapshots")
      .withIndex("by_document", (q) => q.eq("documentId", documentId))
      .collect();

    return snapshots.sort((a, b) => b.version - a.version);
  }
});

export const getActiveConflicts = query({
  args: { documentId: v.id("collaborativeDocuments") },
  handler: async (ctx, { documentId }) => {
    const conflicts = await ctx.db
      .query("documentConflicts")
      .withIndex("by_document", (q) => q.eq("documentId", documentId))
      .filter((q) => q.eq(q.field("isResolved"), false))
      .collect();

    return conflicts;
  }
});

// ============================================================================
// MUTATIONS
// ============================================================================

export const createDocument = mutation({
  args: {
    title: v.string(),
    contractId: v.optional(v.id("contracts")),
    initialContent: v.optional(v.string()),
    ownerId: v.id("users"),
    collaborators: v.array(v.id("users")),
    permissions: v.object({
      read: v.array(v.id("users")),
      write: v.array(v.id("users")),
      comment: v.array(v.id("users")),
      admin: v.array(v.id("users"))
    })
  },
  handler: async (ctx, args) => {
    try {
      const documentData: DocumentInsertData = {
        title: args.title,
        ownerId: args.ownerId,
        collaborators: args.collaborators,
        permissions: args.permissions,
        state: {
          content: args.initialContent || "",
          operations: [],
          version: 1,
          lastModified: Date.now(),
          spans: []
        },
        isLocked: false,
        createdAt: Date.now()
      };
      
      if (args.contractId !== undefined) {
        documentData.contractId = args.contractId;
      }
      
      const documentId = await ctx.db.insert("collaborativeDocuments", documentData);

      // Create initial snapshot
      await ctx.db.insert("documentSnapshots", {
        documentId,
        version: 1,
        state: {
          content: args.initialContent || "",
          operations: [],
          version: 1,
          lastModified: Date.now(),
          spans: []
        },
        createdBy: args.ownerId,
        createdAt: Date.now(),
        description: "Initial document version",
        isAutoSnapshot: true
      });

      return { success: true, documentId };
    } catch (error) {
      console.error("Error creating document:", error);
      return { success: false, error: "Failed to create document" };
    }
  }
});

export const applyOperation = mutation({
  args: {
    documentId: v.id("collaborativeDocuments"),
    operation: v.object({
      type: v.union(v.literal("insert"), v.literal("delete"), v.literal("retain"), v.literal("format")),
      position: v.number(),
      userId: v.id("users"),
      timestamp: v.number(),
      id: v.string(),
      content: v.optional(v.string()),
      length: v.optional(v.number()),
      attributes: v.optional(v.any())
    })
  },
  handler: async (ctx, { documentId, operation }) => {
    try {
      const document = await ctx.db.get(documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      // Check if document is locked
      if (document.isLocked && document.lockedBy !== operation.userId) {
        throw new Error("Document is locked by another user");
      }

      // Apply operation to document state
      const newState = { ...document.state };
      
      // Apply the operation to content
      switch (operation.type) {
        case "insert":
          if (operation.content) {
            newState.content = 
              newState.content.slice(0, operation.position) +
              operation.content +
              newState.content.slice(operation.position);
          }
          break;
        case "delete":
          if (operation.length) {
            newState.content = 
              newState.content.slice(0, operation.position) +
              newState.content.slice(operation.position + operation.length);
          }
          break;
      }

      // Add operation to history
      newState.operations.push(operation);
      newState.version += 1;
      newState.lastModified = Date.now();

      // Update document
      await ctx.db.patch(documentId, {
        state: newState,
        updatedAt: Date.now()
      });

      // Create auto-snapshot every 10 operations
      if (newState.operations.length % 10 === 0) {
        await ctx.db.insert("documentSnapshots", {
          documentId,
          version: newState.version,
          state: newState,
          createdBy: operation.userId,
          createdAt: Date.now(),
          description: `Auto-snapshot at version ${newState.version}`,
          isAutoSnapshot: true
        });
      }

      return { 
        success: true, 
        newVersion: newState.version,
        transformedOperation: operation
      };
    } catch (error) {
      console.error("Error applying operation:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
});

export const updatePresence = mutation({
  args: {
    documentId: v.id("collaborativeDocuments"),
    userId: v.id("users"),
    cursor: v.object({
      position: v.number(),
      isVisible: v.boolean()
    }),
    selection: v.optional(v.object({
      start: v.number(),
      end: v.number(),
      direction: v.union(v.literal("forward"), v.literal("backward"))
    }))
  },
  handler: async (ctx, { documentId, userId, cursor, selection }) => {
    try {
      // Get or create session
      let session = await ctx.db
        .query("collaborativeSessions")
        .withIndex("by_document", (q) => q.eq("documentId", documentId))
        .first();

      if (!session) {
        session = {
          _id: await ctx.db.insert("collaborativeSessions", {
            documentId,
            users: [],
            lastActivity: Date.now(),
            isActive: true
          }),
          documentId,
          users: [],
          lastActivity: Date.now(),
          isActive: true,
          _creationTime: Date.now()
        };
      }

      // Update user presence
      const userIndex = session.users.findIndex(u => u.userId === userId);
      // Get user data
      const user = await ctx.db.get(userId);
      const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : "User";
      
      // Assign user color based on user ID (deterministic)
      const userColors = [
        "#3B82F6", // Blue
        "#10B981", // Green
        "#F59E0B", // Yellow
        "#EF4444", // Red
        "#8B5CF6", // Purple
        "#EC4899", // Pink
        "#14B8A6", // Teal
        "#F97316", // Orange
      ];
      const colorIndex = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % userColors.length;
      const userColor = userColors[colorIndex]!;
      
      const userPresence = {
        userId,
        userName,
        userColor,
        cursor,
        selection,
        lastSeen: Date.now(),
        isActive: true
      };

      if (userIndex >= 0) {
        session.users[userIndex] = userPresence;
      } else {
        session.users.push(userPresence);
      }

      // Update session
      await ctx.db.patch(session._id, {
        users: session.users,
        lastActivity: Date.now()
      });

      return { success: true };
    } catch (error) {
      console.error("Error updating presence:", error);
      return { success: false, error: "Failed to update presence" };
    }
  }
});

export const addComment = mutation({
  args: {
    documentId: v.id("collaborativeDocuments"),
    content: v.string(),
    position: v.number(),
    length: v.number(),
    userId: v.id("users"),
    userName: v.string()
  },
  handler: async (ctx, args) => {
    try {
      const commentId = await ctx.db.insert("documentComments", {
        documentId: args.documentId,
        userId: args.userId,
        userName: args.userName,
        content: args.content,
        position: args.position,
        length: args.length,
        status: "active",
        replies: [],
        createdAt: Date.now()
      });

      return { success: true, commentId };
    } catch (error) {
      console.error("Error adding comment:", error);
      return { success: false, error: "Failed to add comment" };
    }
  }
});

export const addSuggestion = mutation({
  args: {
    documentId: v.id("collaborativeDocuments"),
    type: v.union(v.literal("insert"), v.literal("delete"), v.literal("replace")),
    position: v.number(),
    length: v.number(),
    originalContent: v.string(),
    suggestedContent: v.string(),
    reason: v.optional(v.string()),
    userId: v.id("users"),
    userName: v.string()
  },
  handler: async (ctx, args) => {
    try {
      const suggestionData: SuggestionInsertData = {
        documentId: args.documentId,
        userId: args.userId,
        userName: args.userName,
        type: args.type,
        position: args.position,
        length: args.length,
        originalContent: args.originalContent,
        suggestedContent: args.suggestedContent,
        status: "pending",
        createdAt: Date.now()
      };
      
      if (args.reason !== undefined) {
        suggestionData.reason = args.reason;
      }
      
      const suggestionId = await ctx.db.insert("documentSuggestions", suggestionData);

      return { success: true, suggestionId };
    } catch (error) {
      console.error("Error adding suggestion:", error);
      return { success: false, error: "Failed to add suggestion" };
    }
  }
});

export const lockDocument = mutation({
  args: {
    documentId: v.id("collaborativeDocuments"),
    lockedBy: v.id("users")
  },
  handler: async (ctx, { documentId, lockedBy }) => {
    try {
      await ctx.db.patch(documentId, {
        isLocked: true,
        lockedBy,
        lockTimestamp: Date.now()
      });

      return { success: true };
    } catch (error) {
      console.error("Error locking document:", error);
      return { success: false, error: "Failed to lock document" };
    }
  }
});

export const unlockDocument = mutation({
  args: { documentId: v.id("collaborativeDocuments") },
  handler: async (ctx, { documentId }) => {
    try {
      await ctx.db.patch(documentId, {
        isLocked: false
      });

      return { success: true };
    } catch (error) {
      console.error("Error unlocking document:", error);
      return { success: false, error: "Failed to unlock document" };
    }
  }
});

// Production-ready mutations for collaborative functionality
export const replyToComment = mutation({
  args: {
    commentId: v.id("documentComments"),
    content: v.string(),
    userId: v.id("users"),
    userName: v.string()
  },
  handler: async (ctx, args) => {
    try {
      const parentComment = await ctx.db.get(args.commentId);
      if (!parentComment) {
        throw new Error("Parent comment not found");
      }

      // Create reply comment
      const replyId = await ctx.db.insert("documentComments", {
        documentId: parentComment.documentId,
        userId: args.userId,
        userName: args.userName,
        content: args.content,
        position: parentComment.position,
        length: parentComment.length,
        status: "active",
        parentCommentId: args.commentId,
        replies: [],
        createdAt: Date.now()
      });

      // Update parent comment's replies array
      const updatedReplies = [...parentComment.replies, replyId];
      await ctx.db.patch(args.commentId, {
        replies: updatedReplies
      });

      return { success: true, replyId };
    } catch (error) {
      console.error("Error replying to comment:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
});

export const resolveComment = mutation({
  args: {
    commentId: v.id("documentComments"),
    resolvedBy: v.id("users")
  },
  handler: async (ctx, args) => {
    try {
      await ctx.db.patch(args.commentId, {
        status: "resolved",
        resolvedBy: args.resolvedBy,
        resolvedAt: Date.now(),
        updatedAt: Date.now()
      });

      return { success: true };
    } catch (error) {
      console.error("Error resolving comment:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
});

export const deleteComment = mutation({
  args: { commentId: v.id("documentComments") },
  handler: async (ctx, args) => {
    try {
      // Mark comment as deleted instead of actually deleting
      await ctx.db.patch(args.commentId, {
        status: "deleted",
        updatedAt: Date.now()
      });

      return { success: true };
    } catch (error) {
      console.error("Error deleting comment:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
});

export const reviewSuggestion = mutation({
  args: {
    suggestionId: v.id("documentSuggestions"),
    status: v.union(v.literal("accepted"), v.literal("rejected")),
    reviewedBy: v.id("users"),
    reviewComment: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    try {
      const patchData: SuggestionPatchData = {
        status: args.status,
        reviewedBy: args.reviewedBy,
        reviewedAt: Date.now()
      };
      
      if (args.reviewComment !== undefined) {
        patchData.reviewComment = args.reviewComment;
      }
      
      await ctx.db.patch(args.suggestionId, patchData);

      return { success: true };
    } catch (error) {
      console.error("Error reviewing suggestion:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
});

export const createSnapshot = mutation({
  args: {
    documentId: v.id("collaborativeDocuments"),
    description: v.string(),
    createdBy: v.id("users")
  },
  handler: async (ctx, args) => {
    try {
      const document = await ctx.db.get(args.documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      const snapshotId = await ctx.db.insert("documentSnapshots", {
        documentId: args.documentId,
        version: document.state.version,
        state: document.state,
        createdBy: args.createdBy,
        createdAt: Date.now(),
        description: args.description,
        isAutoSnapshot: false
      });

      return { success: true, snapshotId };
    } catch (error) {
      console.error("Error creating snapshot:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
});

export const restoreVersion = mutation({
  args: {
    documentId: v.id("collaborativeDocuments"),
    targetVersion: v.number(),
    restoredBy: v.id("users")
  },
  handler: async (ctx, args) => {
    try {
      // Find the snapshot with the target version
      const targetSnapshot = await ctx.db
        .query("documentSnapshots")
        .withIndex("by_version", (q) => 
          q.eq("documentId", args.documentId).eq("version", args.targetVersion)
        )
        .first();

      if (!targetSnapshot) {
        throw new Error(`Snapshot for version ${args.targetVersion} not found`);
      }

      // Create a backup snapshot of current state before restoring
      const currentDocument = await ctx.db.get(args.documentId);
      if (currentDocument) {
        await ctx.db.insert("documentSnapshots", {
          documentId: args.documentId,
          version: currentDocument.state.version,
          state: currentDocument.state,
          createdBy: args.restoredBy,
          createdAt: Date.now(),
          description: `Backup before restoring to version ${args.targetVersion}`,
          isAutoSnapshot: true
        });

        // Restore the document state
        const restoredState = {
          ...targetSnapshot.state,
          version: currentDocument.state.version + 1,
          lastModified: Date.now()
        };

        await ctx.db.patch(args.documentId, {
          state: restoredState,
          updatedAt: Date.now()
        });
      }

      return { success: true, newVersion: currentDocument ? currentDocument.state.version + 1 : args.targetVersion };
    } catch (error) {
      console.error("Error restoring version:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
});

export const resolveConflict = mutation({
  args: {
    conflictId: v.string(),
    resolution: v.union(v.literal("accept_local"), v.literal("accept_remote"), v.literal("merge")),
    resolvedBy: v.id("users")
  },
  handler: async (ctx, args) => {
    try {
      // Find the conflict
      const conflict = await ctx.db
        .query("documentConflicts")
        .withIndex("by_conflict_id", (q) => q.eq("conflictId", args.conflictId))
        .first();

      if (!conflict) {
        throw new Error("Conflict not found");
      }

      // Mark conflict as resolved
      await ctx.db.patch(conflict._id, {
        resolution: args.resolution,
        resolvedBy: args.resolvedBy,
        resolvedAt: Date.now(),
        isResolved: true
      });

      return { success: true };
    } catch (error) {
      console.error("Error resolving conflict:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
});

export const shareDocument = mutation({
  args: { documentId: v.id("collaborativeDocuments") },
  handler: async (ctx, args) => {
    // Implementation would generate shareable link
    return `${process.env.SITE_URL}/collaborative-editor/${args.documentId}`;
  }
});

export const updateDocument = mutation({
  args: {
    documentId: v.id("collaborativeDocuments"),
    content: v.string(),
    spans: v.array(v.any())
  },
  handler: async (ctx, args) => {
    try {
      const document = await ctx.db.get(args.documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      const newState = {
        ...document.state,
        content: args.content,
        spans: args.spans,
        version: document.state.version + 1,
        lastModified: Date.now()
      };

      await ctx.db.patch(args.documentId, {
        state: newState,
        updatedAt: Date.now()
      });

      return { success: true, newVersion: newState.version };
    } catch (error) {
      console.error("Error updating document:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
});

export const saveDocument = mutation({
  args: {
    documentId: v.id("collaborativeDocuments"),
    content: v.string(),
    spans: v.array(v.any())
  },
  handler: async (ctx, args) => {
    try {
      const document = await ctx.db.get(args.documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      const newState = {
        ...document.state,
        content: args.content,
        spans: args.spans,
        version: document.state.version + 1,
        lastModified: Date.now()
      };

      await ctx.db.patch(args.documentId, {
        state: newState,
        updatedAt: Date.now()
      });

      // Create auto-save snapshot
      await ctx.db.insert("documentSnapshots", {
        documentId: args.documentId,
        version: newState.version,
        state: newState,
        createdBy: document.ownerId,
        createdAt: Date.now(),
        description: `Auto-save at version ${newState.version}`,
        isAutoSnapshot: true
      });

      return { success: true, newVersion: newState.version };
    } catch (error) {
      console.error("Error saving document:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
});