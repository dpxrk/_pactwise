// convex/enterprises.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

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

    // Create enterprise
    const enterpriseId = await ctx.db.insert("enterprises", {
      name: args.enterpriseName,
      domain: args.domain,
    });

    // Create user as owner
    await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email || "",
      firstName: identity.given_name || undefined,
      lastName: identity.family_name || undefined,
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

    // Generate unique token
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await ctx.db.insert("invitations", {
      enterpriseId: currentUser.enterpriseId,
      email: args.email,
      role: args.role,
      invitedBy: currentUser._id,
      token,
      expiresAt: expiresAt.toISOString(),
    });

    return { token, invitationUrl: `/invite/${token}` };
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

    if (invitation.email !== identity.email) {
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
      return awa