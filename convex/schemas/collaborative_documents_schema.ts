// convex/collaborative-documents-schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ============================================================================
// COLLABORATIVE DOCUMENTS SCHEMA EXTENSION
// ============================================================================

export const collaborativeDocumentsSchema = {
  // Collaborative Documents
  collaborativeDocuments: defineTable({
    // Basic document info
    title: v.string(),
    contractId: v.optional(v.id("contracts")),
    
    // Document ownership and permissions
    ownerId: v.id("users"),
    collaborators: v.array(v.id("users")),
    permissions: v.object({
      read: v.array(v.id("users")),
      write: v.array(v.id("users")),
      comment: v.array(v.id("users")),
      admin: v.array(v.id("users"))
    }),
    
    // Document state
    state: v.object({
      content: v.string(),
      operations: v.array(v.object({
        type: v.union(v.literal("insert"), v.literal("delete"), v.literal("retain"), v.literal("format")),
        position: v.number(),
        userId: v.id("users"),
        timestamp: v.number(),
        id: v.string(),
        // Operation-specific fields
        content: v.optional(v.string()), // for insert
        length: v.optional(v.number()), // for delete/retain/format
        attributes: v.optional(v.any()) // for formatting
      })),
      version: v.number(),
      lastModified: v.number(),
      spans: v.array(v.object({
        content: v.string(),
        attributes: v.optional(v.any()),
        start: v.number(),
        end: v.number()
      }))
    }),
    
    // Locking mechanism
    isLocked: v.boolean(),
    lockedBy: v.optional(v.id("users")),
    lockTimestamp: v.optional(v.number()),
    
    // Metadata
    createdAt: v.number(),
    updatedAt: v.optional(v.number())
  })
  .index("by_contract", ["contractId"])
  .index("by_owner", ["ownerId"])
  .index("by_collaborator", ["collaborators"])
  .index("by_lock_status", ["isLocked", "lockedBy"]),

  // Real-time collaboration sessions
  collaborativeSessions: defineTable({
    documentId: v.id("collaborativeDocuments"),
    users: v.array(v.object({
      userId: v.id("users"),
      userName: v.string(),
      userColor: v.string(),
      cursor: v.object({
        position: v.number(),
        isVisible: v.boolean()
      }),
      selection: v.optional(v.object({
        start: v.number(),
        end: v.number(),
        direction: v.union(v.literal("forward"), v.literal("backward"))
      })),
      lastSeen: v.number(),
      isActive: v.boolean()
    })),
    lastActivity: v.number(),
    isActive: v.boolean()
  })
  .index("by_document", ["documentId"])
  .index("by_activity", ["lastActivity"])
  .index("by_active", ["isActive"]),

  // Document comments
  documentComments: defineTable({
    documentId: v.id("collaborativeDocuments"),
    userId: v.id("users"),
    userName: v.string(),
    content: v.string(),
    position: v.number(),
    length: v.number(),
    status: v.union(v.literal("active"), v.literal("resolved"), v.literal("deleted")),
    parentCommentId: v.optional(v.id("documentComments")),
    replies: v.array(v.id("documentComments")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.id("users")),
    resolvedAt: v.optional(v.number())
  })
  .index("by_document", ["documentId"])
  .index("by_user", ["userId"])
  .index("by_status", ["status"])
  .index("by_parent", ["parentCommentId"])
  .index("by_position", ["documentId", "position"]),

  // Document suggestions
  documentSuggestions: defineTable({
    documentId: v.id("collaborativeDocuments"),
    userId: v.id("users"),
    userName: v.string(),
    type: v.union(v.literal("insert"), v.literal("delete"), v.literal("replace")),
    position: v.number(),
    length: v.number(),
    originalContent: v.string(),
    suggestedContent: v.string(),
    reason: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected"), v.literal("outdated")),
    createdAt: v.number(),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    reviewComment: v.optional(v.string())
  })
  .index("by_document", ["documentId"])
  .index("by_user", ["userId"])
  .index("by_status", ["status"])
  .index("by_reviewer", ["reviewedBy"])
  .index("by_position", ["documentId", "position"]),

  // Document version snapshots
  documentSnapshots: defineTable({
    documentId: v.id("collaborativeDocuments"),
    version: v.number(),
    state: v.object({
      content: v.string(),
      operations: v.array(v.any()),
      version: v.number(),
      lastModified: v.number(),
      spans: v.array(v.any())
    }),
    createdBy: v.id("users"),
    createdAt: v.number(),
    description: v.optional(v.string()),
    isAutoSnapshot: v.boolean()
  })
  .index("by_document", ["documentId"])
  .index("by_version", ["documentId", "version"])
  .index("by_creator", ["createdBy"])
  .index("by_auto", ["isAutoSnapshot"])
  .index("by_date", ["createdAt"]),

  // Operational transform conflicts
  documentConflicts: defineTable({
    documentId: v.id("collaborativeDocuments"),
    conflictId: v.string(),
    operation1: v.any(),
    operation2: v.any(),
    resolution: v.optional(v.union(
      v.literal("accept_local"),
      v.literal("accept_remote"), 
      v.literal("merge"),
      v.literal("manual")
    )),
    resolvedBy: v.optional(v.id("users")),
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
    isResolved: v.boolean()
  })
  .index("by_document", ["documentId"])
  .index("by_resolved", ["isResolved"])
  .index("by_resolver", ["resolvedBy"])
  .index("by_conflict_id", ["conflictId"])
};

// Export the schema tables to be merged with the main schema
export default collaborativeDocumentsSchema;