// convex/files.ts
import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { ConvexError } from "convex/values";
import { getUser, requireUser } from "./auth";
import { StorageId } from "convex/server";

/**
 * Generate a URL for file upload to Convex Storage
 * 
 * @returns An object with the upload URL and a StorageId to reference the file
 */
export const generateUploadUrl = mutation({
  args: {
    // Optional file type restriction
    contentType: v.optional(v.string()),
    // Optional file size limit in bytes (default to 10MB)
    maxSize: v.optional(v.number()),
    // Optional file name for reference
    fileName: v.optional(v.string()),
    // What table the file is associated with (e.g., "contracts", "vendors")
    associatedTable: v.optional(v.string()),
    // Optional metadata to associate with file
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Check authentication
    const user = await requireUser(ctx);

    // Validate args
    const maxSize = args.maxSize || 10 * 1024 * 1024; // Default 10MB limit
    if (maxSize > 100 * 1024 * 1024) {
      throw new ConvexError("File size limit cannot exceed 100MB");
    }
    // Create an upload URL with specified parameters
    const storageId = await ctx.storage.generateUploadUrl();
    

    return { storageId, uploadUrl: await ctx.storage.getUrl(storageId) };
  },
});

/**
 * Save file metadata after it has been uploaded
 */
export const saveFileMetadata = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    associatedEntityId: v.optional(v.string()),
    associatedEntityType: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isPublic: v.optional(v.boolean()),
    customMetadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Check authentication
    const user = await requireUser(ctx);

    // Check if the file actually exists in storage
    const exists = await ctx.storage.getUrl(args.storageId) !== null;
    if (!exists) {
      throw new ConvexError("File not found in storage");
    }

    // Find the upload request record
    const uploadRequest = await ctx.db
      .query("fileUploadRequests")
      .withIndex("by_storage_id", (q) => q.eq("storageId", args.storageId))
      .first();

    // Create file record
    const fileId = await ctx.db.insert("files", {
      storageId: args.storageId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      uploadedBy: user._id,
      uploadedAt: new Date().toISOString(),
      associatedEntityId: args.associatedEntityId,
      associatedEntityType: args.associatedEntityType,
      description: args.description || "",
      tags: args.tags || [],
      isPublic: args.isPublic || false,
      customMetadata: args.customMetadata || {},
      isDeleted: false,
      accessCount: 0,
      lastAccessedAt: null,
    });

    // Update the upload request status if it exists
    if (uploadRequest) {
      await ctx.db.patch(uploadRequest._id, {
        status: "uploaded",
        completedAt: new Date().toISOString(),
        fileId,
      });
    }

    // Return the created file record ID
    return fileId;
  },
});

/**
 * Get a URL to download or view a file
 */
export const getFileUrl = query({
  args: {
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    // Get current user (optional - for access control)
    const user = await getUser(ctx);
    
    // Get the file record
    const file = await ctx.db.get(args.fileId);
    
    if (!file || file.isDeleted) {
      throw new ConvexError("File not found");
    }
    
    // Check access permissions (simplified example)
    const canAccess = file.isPublic || 
                      (user && file.uploadedBy === user._id) ||
                      (user && await hasFileAccess(ctx, user._id, args.fileId));
    
    if (!canAccess) {
      throw new ConvexError("You don't have permission to access this file");
    }
    
    // Update access statistics (in a real app, you might want to throttle this)
    await ctx.db.patch(args.fileId, {
      accessCount: (file.accessCount || 0) + 1,
      lastAccessedAt: new Date().toISOString(),
    });
    
    // Generate URL with appropriate expiry time
    return {
      url: await ctx.storage.getUrl(file.storageId),
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
    };
  },
});

/**
 * Delete a file (mark as deleted)
 */
export const deleteFile = mutation({
  args: {
    fileId: v.id("files"),
    // Whether to actually remove the file from storage or just mark as deleted
    permanent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Check authentication
    const user = await requireUser(ctx);
    
    // Get the file record
    const file = await ctx.db.get(args.fileId);
    
    if (!file || file.isDeleted) {
      throw new ConvexError("File not found");
    }
    
    // Check permissions (simplified example, customize as needed)
    const canDelete = file.uploadedBy === user._id || await isAdmin(ctx, user._id);
    
    if (!canDelete) {
      throw new ConvexError("You don't have permission to delete this file");
    }
    
    if (args.permanent) {
      // Permanently delete from storage
      await ctx.storage.delete(file.storageId);
      // Delete DB record
      await ctx.db.delete(args.fileId);
    } else {
      // Soft delete (mark as deleted)
      await ctx.db.patch(args.fileId, {
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: user._id,
      });
    }
    
    return { success: true };
  },
});

/**
 * List files with filtering and pagination
 */
export const listFiles = query({
  args: {
    // Pagination
    limit: v.optional(v.number()),
    cursor: v.optional(v.id("files")),
    // Filtering
    associatedEntityType: v.optional(v.string()),
    associatedEntityId: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    uploadedBy: v.optional(v.id("users")),
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Check authentication
    const user = await getUser(ctx);
    
    // Build query
    let query = ctx.db
      .query("files")
      .order("desc");
    
    // Apply filters if provided
    if (args.associatedEntityType) {
      query = query.filter((q) => 
        q.eq(q.field("associatedEntityType"), args.associatedEntityType)
      );
    }
    
    if (args.associatedEntityId) {
      query = query.filter((q) => 
        q.eq(q.field("associatedEntityId"), args.associatedEntityId)
      );
    }
    
    if (args.mimeType) {
      query = query.filter((q) => 
        q.eq(q.field("mimeType"), args.mimeType)
      );
    }
    
    if (args.uploadedBy) {
      query = query.filter((q) => 
        q.eq(q.field("uploadedBy"), args.uploadedBy)
      );
    }
    
    // Filter out deleted files unless explicitly requested
    if (!args.includeDeleted) {
      query = query.filter((q) => 
        q.eq(q.field("isDeleted"), false)
      );
    }
    
    // Filter by permissions (only show public files or files uploaded by the current user)
    if (user) {
      query = query.filter((q) =>
        q.or(
          q.eq(q.field("isPublic"), true),
          q.eq(q.field("uploadedBy"), user._id)
        )
      );
    } else {
      // If no user, only show public files
      query = query.filter((q) => q.eq(q.field("isPublic"), true));
    }
    
    // Handle tags filtering if provided (match any tag in the array)
    if (args.tags && args.tags.length > 0) {
      query = query.filter((q) => {
        const conditions = args.tags!.map(tag => 
          q.contains(q.field("tags"), tag)
        );
        return q.or(...conditions);
      });
    }
    
    // Apply pagination
    if (args.cursor) {
      query = query.cursor(args.cursor);
    }
    
    // Execute query with limit
    const files = await query.take(args.limit || 50);
    
    // Get uploader information for each file
    const filesWithUsers = await Promise.all(
      files.map(async (file) => {
        let uploader = null;
        try {
          uploader = await ctx.db.get(file.uploadedBy);
        } catch (e) {
          // User might have been deleted
        }
        
        return {
          ...file,
          uploader: uploader ? {
            id: uploader._id,
            name: `${uploader.firstName || ''} ${uploader.lastName || ''}`.trim(),
            email: uploader.email,
          } : null,
          // Don't expose the direct storage ID to the client
          url: await ctx.storage.getUrl(file.storageId),
        };
      })
    );
    
    // Return files and pagination info
    return {
      files: filesWithUsers,
      hasMore: files.length === (args.limit || 50),
      cursor: files.length > 0 ? files[files.length - 1]._id : null,
    };
  },
});

/**
 * Process an uploaded file (e.g., scan, analyze, generate thumbnail)
 * This is an async action that can be called after upload
 */
export const processFile = action({
  args: {
    fileId: v.id("files"),
    operations: v.array(v.string()), // e.g., ["scan", "thumbnail", "metadata"]
  },
  handler: async (ctx, args) => {
    // Get file info from database
    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new ConvexError("File not found");
    }
    
    // Get the file URL for processing
    const url = await ctx.storage.getUrl(file.storageId);
    const results = {};
    
    // Process each requested operation
    for (const operation of args.operations) {
      switch (operation) {
        case "scan":
          // Example: Scan file for malware/viruses (would integrate with a service)
          results.scan = { status: "passed", scannedAt: new Date().toISOString() };
          break;
          
        case "thumbnail":
          // Example: Generate thumbnail for image files
          if (file.mimeType.startsWith("image/")) {
            // In a real implementation, you'd call a service to generate a thumbnail
            // and upload it back to Convex storage
            results.thumbnail = { generated: true };
          } else {
            results.thumbnail = { generated: false, reason: "Not an image" };
          }
          break;
          
        case "metadata":
          // Example: Extract metadata from file (e.g., EXIF data from images)
          results.metadata = { extracted: true, data: {} };
          break;
          
        default:
          results[operation] = { error: "Unsupported operation" };
      }
    }
    
    // Update file record with processing results
    await ctx.db.patch(args.fileId, {
      processingResults: results,
      processedAt: new Date().toISOString(),
    });
    
    return results;
  },
});

/**
 * Helper function to check if user has access to a file
 */
async function hasFileAccess(
  ctx: any,
  userId: Id<"users">,
  fileId: Id<"files">
): Promise<boolean> {
  // This is a simplified example - replace with your actual access control logic
  // For example, check if user is a member of the same team, department, etc.
  return true;
}

/**
 * Helper function to check if user is an admin
 */
async function isAdmin(ctx: any, userId: Id<"users">): Promise<boolean> {
  // Check user role or permissions
  const user = await ctx.db.get(userId);
  return user?.role === "admin" || user?.role === "system_admin";
}

/**
 * Get file statistics
 */
export const getFileStats = query({
  args: {
    userId: v.optional(v.id("users")),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check authentication
    const currentUser = await requireUser(ctx);
    
    // Default to current user if no userId specified
    const userId = args.userId || currentUser._id;
    
    // Check permission (only admin or the user themselves can see stats)
    if (userId !== currentUser._id) {
      const isUserAdmin = await isAdmin(ctx, currentUser._id);
      if (!isUserAdmin) {
        throw new ConvexError("Permission denied");
      }
    }
    
    // Build base query for user's files
    let query = ctx.db
      .query("files")
      .filter((q) => q.eq(q.field("uploadedBy"), userId));
    
    // Apply date filters if provided
    if (args.startDate) {
      query = query.filter((q) => 
        q.gte(q.field("uploadedAt"), args.startDate!)
      );
    }
    
    if (args.endDate) {
      query = query.filter((q) => 
        q.lte(q.field("uploadedAt"), args.endDate!)
      );
    }
    
    // Get all matching files
    const files = await query.collect();
    
    // Calculate statistics
    const totalFiles = files.length;
    const totalSize = files.reduce((sum, file) => sum + file.fileSize, 0);
    const deletedFiles = files.filter(f => f.isDeleted).length;
    
    // Group by mime type
    const mimeTypes = {};
    files.forEach(file => {
      mimeTypes[file.mimeType] = (mimeTypes[file.mimeType] || 0) + 1;
    });
    
    // Calculate upload frequency
    const uploadsByDate = {};
    files.forEach(file => {
      const date = file.uploadedAt.split('T')[0]; // Get just the date portion
      uploadsByDate[date] = (uploadsByDate[date] || 0) + 1;
    });
    
    return {
      totalFiles,
      totalSize,
      deletedFiles,
      activeFiles: totalFiles - deletedFiles,
      averageFileSize: totalFiles > 0 ? totalSize / totalFiles : 0,
      mimeTypes,
      uploadsByDate,
    };
  },
});

/**
 * Schema definition helper
 * Add this to your schema.ts file to define the file-related tables
 */
export const fileTableDefinitions = `
// File upload requests track pending uploads
export const fileUploadRequests = defineTable({
  userId: v.id("users"),
  storageId: v.id("_storage"),
  requested: v.string(), // ISO date
  fileName: v.optional(v.string()),
  associatedTable: v.optional(v.string()),
  metadata: v.optional(v.any()),
  status: v.string(), // "pending_upload", "uploaded", "failed"
  completedAt: v.optional(v.string()),
  fileId: v.optional(v.id("files")),
}).index("by_storage_id", ["storageId"]);

// Files table for tracking uploaded files
export const files = defineTable({
  storageId: v.id("_storage"),
  fileName: v.string(),
  fileSize: v.number(),
  mimeType: v.string(),
  uploadedBy: v.id("users"),
  uploadedAt: v.string(), // ISO date
  associatedEntityId: v.optional(v.string()),
  associatedEntityType: v.optional(v.string()),
  description: v.optional(v.string()),
  tags: v.array(v.string()),
  isPublic: v.boolean(),
  customMetadata: v.optional(v.any()),
  isDeleted: v.boolean(),
  deletedAt: v.optional(v.string()),
  deletedBy: v.optional(v.id("users")),
  accessCount: v.number(),
  lastAccessedAt: v.optional(v.string()),
  processingResults: v.optional(v.any()),
  processedAt: v.optional(v.string()),
}).index("by_entity", ["associatedEntityType", "associatedEntityId"])
  .index("by_uploader", ["uploadedBy"])
  .index("by_mime", ["mimeType"]);
`;