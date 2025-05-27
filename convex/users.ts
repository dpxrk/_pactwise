// convex/users.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

const userRoleOptions = [
  "owner", "admin", "manager", "viewer"
] as const;

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * Get or create user from Clerk authentication
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Look for existing user
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    return existingUser;
  },
});

/**
 * Create or update user from Clerk data
 */
export const upsertUser = mutation({
  args: {
    enterpriseId: v.id("enterprises"),
    role: v.optional(v.union(...userRoleOptions.map(r => v.literal(r)))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (existingUser && identity) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        email: typeof identity.email === "string" ? identity.email : existingUser.email,
        firstName: typeof identity.given_name === "string" ? identity.given_name : existingUser.firstName,
        lastName: typeof identity.family_name === "string" ? identity.family_name : existingUser.lastName,
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return existingUser._id;
    } else {
      // Create new user
      const userId = await ctx.db.insert("users", {
        clerkId: identity.subject,
        email: typeof identity.email === "string" ? identity.email : "",
        firstName: typeof identity.given_name === "string" ? identity.given_name : undefined,
        lastName: typeof identity.family_name === "string" ? identity.family_name : undefined,
        enterpriseId: args.enterpriseId,
        role: args.role || "viewer",
        isActive: true,
        lastLoginAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      return userId;
    }
  },
});

/**
 * Get users for an enterprise
 */
export const getEnterpriseUsers = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Verify current user has access to this enterprise
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser || currentUser.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied to this enterprise");
    }

    const users = await ctx.db
      .query("users")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .collect();

    return users;
  },
});

/**
 * Update user role (admin only)
 */
export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(...userRoleOptions.map(r => v.literal(r))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Get current user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser) {
      throw new ConvexError("User not found");
    }

    // Check if current user has permission (owner or admin)
    if (currentUser.role !== "owner" && currentUser.role !== "admin") {
      throw new ConvexError("Permission denied: Only owners and admins can update user roles");
    }

    // Get target user
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new ConvexError("Target user not found");
    }

    // Check if target user is in same enterprise
    if (targetUser.enterpriseId !== currentUser.enterpriseId) {
      throw new ConvexError("Cannot update user from different enterprise");
    }

    // Prevent non-owners from changing owner role
    if (targetUser.role === "owner" && currentUser.role !== "owner") {
      throw new ConvexError("Only owners can modify owner roles");
    }

    
    await ctx.db.patch(args.userId, {
      role: args.role,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if current user has permission for an enterprise
 */
export const hasEnterpriseAccess = query({
  args: {
    enterpriseId: v.id("enterprises"),
    requiredRole: v.optional(v.union(...userRoleOptions.map(r => v.literal(r)))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const accessUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!accessUser || accessUser.enterpriseId !== args.enterpriseId) {
      return false;
    }

    if (!args.requiredRole) {
      return true; // Just check enterprise access
    }

    // Check role hierarchy
    const roleHierarchy = { owner: 5, admin: 4, manager: 3, user:2, viewer: 1 };
    const userLevel = roleHierarchy[accessUser.role];
    const requiredLevel = roleHierarchy[args.requiredRole];

    return userLevel >= requiredLevel;
  },
});

/**
 * Get current user's enterprise and role info
 */
export const getUserContext = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return null;
    }

    const enterprise = await ctx.db.get(user.enterpriseId);

    return {
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      enterprise: enterprise ? {
        _id: enterprise._id,
        name: enterprise.name,
      } : null,
    };
  },
});