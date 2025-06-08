// convex/enterprises.ts
import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { UserRole, userRoleOptions } from "./schema";

// ============================================================================
// ENTERPRISE CREATION & ONBOARDING
// ============================================================================

/**
 * Create a new enterprise with the current user as owner
 */
export const createEnterpriseWithOwner = mutation({
  args: {
    enterpriseName: v.string(),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    // Check if user already belongs to an enterprise
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (existingUser) {
      throw new ConvexError("You already belong to an enterprise");
    }

    // Validate enterprise name
    if (!args.enterpriseName || args.enterpriseName.trim().length < 2) {
      throw new ConvexError("Enterprise name must be at least 2 characters long");
    }

    // Create enterprise
    const enterpriseId = await ctx.db.insert("enterprises", {
      name: args.enterpriseName.trim(),
      domain: args.domain,
    });

    // Create user as owner
    await ctx.db.insert("users", {
      clerkId: String(identity.subject),
      email: typeof identity.email === "string" ? identity.email : "",
      firstName: typeof identity.given_name === "string" ? identity.given_name : undefined,
      lastName: typeof identity.family_name === "string" ? identity.family_name : undefined,
      enterpriseId,
      role: "owner",
      isActive: true,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    return enterpriseId;
  },
});

/**
 * Check if the current user can create an enterprise
 */
export const canCreateEnterprise = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    return !existingUser; // Can create if no existing user record
  },
});

// ============================================================================
// ENTERPRISE QUERIES
// ============================================================================

/**
 * Get enterprise details for the current user
 */
export const getMyEnterprise = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return null;

    const enterprise = await ctx.db.get(user.enterpriseId);
    if (!enterprise) return null;

    // Get member count
    const members = await ctx.db
      .query("users")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", user.enterpriseId))
      .collect();

    // Get basic stats
    const [contracts, vendors] = await Promise.all([
      ctx.db
        .query("contracts")
        .withIndex("by_status_and_enterpriseId", (q) => 
          q.eq("enterpriseId", user.enterpriseId)
        )
        .collect(),
      ctx.db
        .query("vendors")
        .withIndex("by_enterprise", (q) => 
          q.eq("enterpriseId", user.enterpriseId)
        )
        .collect(),
    ]);

    return {
      ...enterprise,
      memberCount: members.length,
      contractCount: contracts.length,
      vendorCount: vendors.length,
      currentUserRole: user.role,
    };
  },
});

/**
 * Get enterprise by ID (with permission check)
 */
export const getEnterpriseById = query({
  args: { 
    enterpriseId: v.id("enterprises") 
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || user.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied");
    }

    return await ctx.db.get(args.enterpriseId);
  },
});

/**
 * Get enterprise by email domain
 */
export const getEnterpriseByDomain = query({
  args: { 
    domain: v.string() 
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("enterprises")
      .withIndex("by_domain", (q) => q.eq("domain", args.domain))
      .first();
  },
});

// ============================================================================
// ENTERPRISE MANAGEMENT
// ============================================================================

/**
 * Update enterprise settings
 */
export const updateEnterprise = mutation({
  args: {
    enterpriseId: v.id("enterprises"),
    name: v.optional(v.string()),
    domain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    // Get current user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser || currentUser.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied");
    }

    // Only owners and admins can update enterprise
    if (currentUser.role !== "owner" && currentUser.role !== "admin") {
      throw new ConvexError("Only owners and admins can update enterprise settings");
    }

    const updates: any = {};
    
    if (args.name !== undefined) {
      if (args.name.trim().length < 2) {
        throw new ConvexError("Enterprise name must be at least 2 characters long");
      }
      updates.name = args.name.trim();
    }

    if (args.domain !== undefined) {
      updates.domain = args.domain;
    }

    if (Object.keys(updates).length === 0) {
      return { success: false, message: "No updates provided" };
    }

    await ctx.db.patch(args.enterpriseId, updates);
    return { success: true };
  },
});

// ============================================================================
// TEAM MANAGEMENT - INVITATIONS
// ============================================================================

/**
 * Create invitation for new user
 */
export const createInvitation = mutation({
  args: {
    email: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("manager"),
      v.literal("user"),
      v.literal("viewer")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    // Get current user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser) {
      throw new ConvexError("User not found");
    }

    // Check permissions (only owner and admin can invite)
    if (currentUser.role !== "owner" && currentUser.role !== "admin") {
      throw new ConvexError("Only owners and admins can invite users");
    }

    // Admins cannot invite owners
    if (currentUser.role === "admin" && args.role === "owner") {
      throw new ConvexError("Admins cannot invite users with owner role");
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser && existingUser.enterpriseId === currentUser.enterpriseId) {
      throw new ConvexError("User already exists in this enterprise");
    }

    // Check for pending invitation
    const pendingInvitation = await ctx.db
      .query("invitations")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter(q => 
        q.and(
          q.eq(q.field("enterpriseId"), currentUser.enterpriseId),
          q.eq(q.field("acceptedAt"), undefined)
        )
      )
      .first();

    if (pendingInvitation) {
      throw new ConvexError("An invitation for this email already exists");
    }

    // Generate unique token
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitationId = await ctx.db.insert("invitations", {
      enterpriseId: currentUser.enterpriseId,
      email: args.email.toLowerCase(),
      role: args.role,
      invitedBy: currentUser._id,
      token,
      expiresAt: expiresAt.toISOString(),
    });

    return { 
      invitationId,
      token, 
      invitationUrl: `/invite/${token}`,
      email: args.email 
    };
  },
});

/**
 * Get pending invitations for the enterprise
 */
export const getPendingInvitations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser) {
      throw new ConvexError("User not found");
    }

    // Only owners and admins can view invitations
    if (currentUser.role !== "owner" && currentUser.role !== "admin") {
      throw new ConvexError("Access denied");
    }

    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", currentUser.enterpriseId))
      .filter(q => q.eq(q.field("acceptedAt"), undefined))
      .collect();

    // Filter out expired invitations and enrich with inviter info
    const now = new Date();
    const validInvitations = await Promise.all(
      invitations
        .filter(inv => new Date(inv.expiresAt) > now)
        .map(async (inv) => {
          const inviter = await ctx.db.get(inv.invitedBy);
          return {
            ...inv,
            inviterName: inviter 
              ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || inviter.email
              : 'Unknown',
          };
        })
    );

    return validInvitations;
  },
});

/**
 * Cancel/revoke an invitation
 */
export const cancelInvitation = mutation({
  args: {
    invitationId: v.id("invitations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser) {
      throw new ConvexError("User not found");
    }

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new ConvexError("Invitation not found");
    }

    if (invitation.enterpriseId !== currentUser.enterpriseId) {
      throw new ConvexError("Access denied");
    }

    // Only owners, admins, or the original inviter can cancel
    if (
      currentUser.role !== "owner" && 
      currentUser.role !== "admin" && 
      invitation.invitedBy !== currentUser._id
    ) {
      throw new ConvexError("You don't have permission to cancel this invitation");
    }

    await ctx.db.delete(args.invitationId);
    return { success: true };
  },
});

/**
 * Get invitation by token (for preview before accepting)
 */
export const getInvitationByToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invitation) {
      return null;
    }

    // Check if expired
    if (new Date(invitation.expiresAt) < new Date()) {
      return { error: "Invitation has expired" };
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return { error: "Invitation has already been accepted" };
    }

    const enterprise = await ctx.db.get(invitation.enterpriseId);
    const inviter = await ctx.db.get(invitation.invitedBy);

    return {
      invitation: {
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
      enterprise: enterprise ? {
        name: enterprise.name,
      } : null,
      inviter: inviter ? {
        name: `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || inviter.email,
        email: inviter.email,
      } : null,
    };
  },
});

/**
 * Accept invitation
 */
export const acceptInvitation = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invitation) {
      throw new ConvexError("Invalid invitation");
    }

    if (invitation.acceptedAt) {
      throw new ConvexError("Invitation already accepted");
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      throw new ConvexError("Invitation expired");
    }

    if (invitation.email.toLowerCase() !== identity.email?.toLowerCase()) {
      throw new ConvexError("Invitation is for a different email address");
    }

    // Mark invitation as accepted
    await ctx.db.patch(invitation._id, {
      acceptedAt: new Date().toISOString(),
    });

    // Create or update user
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (existingUser) {
      // User exists, update their enterprise and role
      await ctx.db.patch(existingUser._id, {
        enterpriseId: invitation.enterpriseId,
        role: invitation.role,
        updatedAt: new Date().toISOString(),
      });
      return existingUser._id;
    } else {
      // Create new user
      return await ctx.db.insert("users", {
        clerkId: identity.subject,
        email: identity.email || "",
        firstName: typeof identity.given_name === "string" ? identity.given_name : undefined,
        lastName: typeof identity.family_name === "string" ? identity.family_name : undefined,
        enterpriseId: invitation.enterpriseId,
        role: invitation.role,
        isActive: true,
        lastLoginAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
  },
});

// ============================================================================
// TEAM MANAGEMENT - USERS
// ============================================================================

/**
 * Remove a user from the enterprise
 */
export const removeUser = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser) {
      throw new ConvexError("User not found");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new ConvexError("Target user not found");
    }

    // Ensure same enterprise
    if (targetUser.enterpriseId !== currentUser.enterpriseId) {
      throw new ConvexError("Cannot remove user from different enterprise");
    }

    // Permission checks
    if (currentUser.role !== "owner" && currentUser.role !== "admin") {
      throw new ConvexError("Only owners and admins can remove users");
    }

    // Cannot remove yourself
    if (currentUser._id === targetUser._id) {
      throw new ConvexError("Cannot remove yourself from the enterprise");
    }

    // Admins cannot remove owners
    if (currentUser.role === "admin" && targetUser.role === "owner") {
      throw new ConvexError("Admins cannot remove owners");
    }

    // Check if this is the last owner
    if (targetUser.role === "owner") {
      const owners = await ctx.db
        .query("users")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", currentUser.enterpriseId))
        .filter(q => q.eq(q.field("role"), "owner"))
        .collect();

      if (owners.length <= 1) {
        throw new ConvexError("Cannot remove the last owner. Transfer ownership first.");
      }
    }

    // Instead of deleting, mark as inactive
    await ctx.db.patch(args.userId, {
      isActive: false,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});

/**
 * Get enterprise statistics/overview
 */
export const getEnterpriseStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const enterpriseId = user.enterpriseId;

    // Get all stats in parallel
    const [
      totalUsers,
      activeUsers,
      totalContracts,
      activeContracts,
      totalVendors,
      pendingInvitations,
    ] = await Promise.all([
      // Total users
      ctx.db
        .query("users")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
        .collect()
        .then(users => users.length),
      
      // Active users
      ctx.db
        .query("users")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
        .filter(q => q.eq(q.field("isActive"), true))
        .collect()
        .then(users => users.length),
      
      // Total contracts
      ctx.db
        .query("contracts")
        .withIndex("by_status_and_enterpriseId", (q) => 
          q.eq("enterpriseId", enterpriseId)
        )
        .collect()
        .then(contracts => contracts.length),
      
      // Active contracts
      ctx.db
        .query("contracts")
        .withIndex("by_status_and_enterpriseId", (q) => 
          q.eq("enterpriseId", enterpriseId).eq("status", "active")
        )
        .collect()
        .then(contracts => contracts.length),
      
      // Total vendors
      ctx.db
        .query("vendors")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
        .collect()
        .then(vendors => vendors.length),
      
      // Pending invitations
      ctx.db
        .query("invitations")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
        .filter(q => q.eq(q.field("acceptedAt"), undefined))
        .collect()
        .then(invitations => 
          invitations.filter(inv => new Date(inv.expiresAt) > new Date()).length
        ),
    ]);

    // Get user breakdown by role
    const users = await ctx.db
      .query("users")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
      .filter(q => q.eq(q.field("isActive"), true))
      .collect();

    const usersByRole = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        byRole: usersByRole,
      },
      contracts: {
        total: totalContracts,
        active: activeContracts,
      },
      vendors: {
        total: totalVendors,
      },
      invitations: {
        pending: pendingInvitations,
      },
    };
  },
});