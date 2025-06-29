// convex/coreUsers.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { UserRole, userRoleOptions } from "./schema"; // Import from schema

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * Get user from Clerk authentication. Returns the user document or null if not found/not authenticated.
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null; // Not authenticated
    }

    // Look for existing user by Clerk ID
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    return existingUser; // Returns user document or null
  },
});

/**
 * Get user by ID
 */
export const getById = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user;
  },
});

/**
 * Get user by Clerk ID (for secure action authentication)
 */
export const getByClerkId = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    return user;
  },
});

/**
 * Get all users for an enterprise (admin only)
 */
export const getEnterpriseUsers = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required to view users.");
    }

    // Check if current user is admin or owner of the enterprise
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser || currentUser.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied: You can only view users from your enterprise.");
    }

    if (!["owner", "admin"].includes(currentUser.role)) {
      throw new ConvexError("Access denied: Only owners and admins can view all users.");
    }

    // Get all users for the enterprise
    const users = await ctx.db
      .query("users")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .collect();

    // Return users with sensitive info filtered
    return users.map(user => ({
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      department: user.department,
      title: user.title,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  },
});

/**
 * Create or update user from Clerk data.
 * This function is typically called after a user signs in or signs up.
 */
export const upsertUser = mutation({
  args: {
    // enterpriseId might be passed if a user is joining a specific enterprise directly,
    // e.g. after creating it or if determined by another flow.
    enterpriseId: v.optional(v.id("enterprises")),
    invitationToken: v.optional(v.string()), // For joining via invitation
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: No user identity found.");
    }

    // Check for existing user by Clerk ID
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (existingUser) {
      const updateData: any = {
        lastLoginAt: new Date().toISOString(),
        email: identity.email || existingUser.email,
      };
      
      if (typeof identity.given_name === "string") {
        updateData.firstName = identity.given_name;
      }
      if (typeof identity.family_name === "string") {
        updateData.lastName = identity.family_name;
      }
      
      await ctx.db.patch(existingUser._id, updateData);
      return existingUser._id;
    }

    // New user: Determine enterprise and role
    let resolvedEnterpriseId = args.enterpriseId;
    let resolvedRole: UserRole = "user"; // Default role as per ROLE_PERMISSIONS.md

    // 1. Process invitation token if provided
    if (args.invitationToken) {
      const invitationToken = args.invitationToken as string;
      const invitation = await ctx.db
        .query("invitations")
        .withIndex("by_token", (q) => q.eq("token", invitationToken))
        .filter(q => q.eq(q.field("email"), identity.email)) // Match email
        .filter(q => q.eq(q.field("acceptedAt"), undefined)) // Not yet accepted
        .filter(q => q.gt(q.field("expiresAt"), new Date().toISOString())) // Not expired
        .first();
      
      if (invitation) {
        resolvedEnterpriseId = invitation.enterpriseId;
        resolvedRole = invitation.role;
        
        // Mark invitation as accepted
        await ctx.db.patch(invitation._id, {
          acceptedAt: new Date().toISOString(),
        });
      } else {
        // Optional: Handle invalid/expired token explicitly, or let it fall through
        // Invalid or expired invitation token
      }
    }

    // 2. If no enterprise from invitation or args, try domain matching
    if (!resolvedEnterpriseId && identity.email) {
      const domain = identity.email.split('@')[1];
      if (domain) {
        const enterpriseByDomain = await ctx.db
          .query("enterprises")
          .withIndex("by_domain", (q) => q.eq("domain", domain))
          .first();
        
        if (enterpriseByDomain) {
          resolvedEnterpriseId = enterpriseByDomain._id;
          // Users joining via domain match typically get 'user' role by default
          // unless specific logic dictates otherwise.
        }
      }
    }

    // 3. Enterprise ID is crucial. If still not resolved, it's an issue.
    // This scenario implies the user needs to create an enterprise or be explicitly added to one.
    // `createEnterpriseWithOwner` handles the first user/owner case.
    if (!resolvedEnterpriseId) {
      // This could happen if a user signs up without an invitation and their domain doesn't match an existing enterprise.
      // The frontend flow should guide them to create an enterprise or request access.
      throw new ConvexError(
        "Enterprise not found. Please create an enterprise or use a valid invitation."
      );
    }

    // Create the new user document
    const userData: any = {
      clerkId: identity.subject,
      email: identity.email || "", // Ensure email is always set
      enterpriseId: resolvedEnterpriseId,
      role: resolvedRole,
      isActive: true, // New users are active by default
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    
    if (typeof identity.given_name === "string") {
      userData.firstName = identity.given_name;
    }
    if (typeof identity.family_name === "string") {
      userData.lastName = identity.family_name;
    }
    
    const userId = await ctx.db.insert("users", userData);

    return userId;
  },
});

/**
 * Get all users for a specific enterprise.
 * Requires the current user to be part of that enterprise.
 */
export const getEnterpriseUsersSecure = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required: User must be logged in.");
    }

    // Verify current user belongs to the target enterprise to view its users
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser || currentUser.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied: You are not authorized to view users for this enterprise.");
    }

    // Fetch users for the specified enterprise
    const users = await ctx.db
      .query("users")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .collect();

    return users;
  },
});


/**
 * Get enterprise details by email domain.
 * Useful for sign-up flows to suggest an enterprise.
 */
export const getEnterpriseByEmailDomain = query({ // Renamed for clarity
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const domain = args.email.split('@')[1];
    if (!domain) {
        return null; // Or throw new ConvexError("Invalid email format: Domain missing.");
    }
    
    return await ctx.db
      .query("enterprises")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .first();
  },
});

/**
 * Update a user's role within their enterprise.
 * Only callable by 'owner' or 'admin' of the same enterprise.
 * Admins cannot modify Owners.
 */
export const updateUserRole = mutation({
  args: {
    userIdToUpdate: v.id("users"), // ID of the user whose role is being changed
    newRole: v.union(...userRoleOptions.map(r => v.literal(r))), // Use the imported userRoleOptions
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    // Get the current (acting) user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser) {
      throw new ConvexError("Current user not found.");
    }

    // Permission Check: Only 'owner' or 'admin' can update roles
    if (currentUser.role !== "owner" && currentUser.role !== "admin") {
      throw new ConvexError("Permission denied: Only Owners or Admins can update user roles.");
    }

    // Get the target user (the user whose role is to be updated)
    const targetUser = await ctx.db.get(args.userIdToUpdate);
    if (!targetUser) {
      throw new ConvexError("Target user not found.");
    }

    // Ensure both users are in the same enterprise
    if (targetUser.enterpriseId !== currentUser.enterpriseId) {
      throw new ConvexError("Cannot update user roles across different enterprises.");
    }

    // Role-specific restrictions from ROLE_PERMISSIONS.md
    // Admin cannot modify Owner roles
    if (targetUser.role === "owner" && currentUser.role === "admin") {
      throw new ConvexError("Admins cannot modify the roles of Owners.");
    }
    // Owners cannot be demoted by anyone but another Owner (implicitly handled if there's only one owner,
    // but good to be explicit if multiple owners were possible and had different levels)
    // If demoting an Owner, the current user must be an Owner.
    if (targetUser.role === "owner" && args.newRole !== "owner" && currentUser.role !== "owner") {
        throw new ConvexError("Only an Owner can change another Owner's role to a non-Owner role.");
    }


    // Perform the update
    await ctx.db.patch(args.userIdToUpdate, {
      role: args.newRole,
      updatedAt: new Date().toISOString(), // Update timestamp
    });

    return { success: true, message: `User role updated to ${args.newRole}.` };
  },
});

// ============================================================================
// HELPER QUERIES
// ============================================================================

/**
 * Check if the current authenticated user has a specific level of access to an enterprise.
 */
export const hasEnterpriseAccess = query({
  args: {
    enterpriseId: v.id("enterprises"),
    requiredRole: v.optional(v.union(...userRoleOptions.map(r => v.literal(r)))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false; // Not authenticated
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || user.enterpriseId !== args.enterpriseId) {
      return false; // User not found or does not belong to the specified enterprise
    }

    // If no specific role is required, just belonging to the enterprise is enough
    if (!args.requiredRole) {
      return true;
    }

    // Role hierarchy based on ROLE_PERMISSIONS.md
    // Owner (Level 5), Admin (Level 4), Manager (Level 3), User (Level 2), Viewer (Level 1)
    const roleHierarchy: Record<UserRole, number> = {
      owner: 5,
      admin: 4,
      manager: 3,
      user: 2,
      viewer: 1,
    };

    const userLevel = roleHierarchy[user.role];
    const requiredLevel = roleHierarchy[args.requiredRole];

    return userLevel >= requiredLevel; // User's role level must be greater than or equal to required
  },
});

/**
 * Get user by ID (internal use only - no auth check)
 * This is used by secure wrappers to verify user context
 */
export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Get the current user's context including their enterprise and role information.
 */
export const getUserContext = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null; // User not authenticated
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      // This case implies the user is authenticated with Clerk but doesn't have a corresponding user record in Convex.
      // This might happen if upsertUser hasn't completed or failed.
      // Frontend should ideally handle this by prompting for enterprise creation/joining.
      return { user: null, enterprise: null, message: "User record not found in Convex. Please complete setup." };
    }

    const enterprise = await ctx.db.get(user.enterpriseId);

    return {
      user: {
        _id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
      },
      enterprise: enterprise ? {
        _id: enterprise._id,
        name: enterprise.name,
        domain: enterprise.domain,
      } : null, // Enterprise might be null if ID is stale, though unlikely with proper data integrity.
    };
  },
});


/**
 *  Updating a user's profile
 */
export const updateUserProfile = mutation({
  args: {
    // userId: v.id("users"), // Clerk ID will be used from identity
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    department: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required to update profile.");
    }

    const userToUpdate = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!userToUpdate) {
      throw new ConvexError("User not found.");
    }

    const updates: Partial<typeof userToUpdate> = {};

    if (args.firstName !== undefined) {
      if (args.firstName.trim().length < 1 && userToUpdate.firstName === undefined) { // only error if it was undefined and now it is empty
         // Allow clearing if already set
      } else if (args.firstName.trim().length < 1 && userToUpdate.firstName !== undefined) {
         delete updates.firstName; // Remove from updates to clear
      }
      else if (args.firstName.trim().length > 0) {
        updates.firstName = args.firstName.trim();
      }
    }

    if (args.lastName !== undefined) {
      if (args.lastName.trim().length < 1 && userToUpdate.lastName === undefined) {
        // Allow clearing if already set
      } else if (args.lastName.trim().length < 1 && userToUpdate.lastName !== undefined) {
          delete updates.lastName; // Remove from updates to clear
      }
      else if (args.lastName.trim().length > 0) {
        updates.lastName = args.lastName.trim();
      }
    }


    if (args.phoneNumber !== undefined) {
      const trimmedPhone = args.phoneNumber.trim();
      if (trimmedPhone) {
        updates.phoneNumber = trimmedPhone;
      } else {
        delete updates.phoneNumber;
      }
    }
    if (args.department !== undefined) {
      const trimmedDept = args.department.trim();
      if (trimmedDept) {
        updates.department = trimmedDept;
      } else {
        delete updates.department;
      }
    }
    if (args.title !== undefined) {
      const trimmedTitle = args.title.trim();
      if (trimmedTitle) {
        updates.title = trimmedTitle;
      } else {
        delete updates.title;
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date().toISOString();
      await ctx.db.patch(userToUpdate._id, updates);
    }

    return { success: true, message: "Profile updated successfully." };
  },
});