import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getUser, requireUser, logAuthEvent } from "./auth";
import { Id } from "./_generated/dataModel";

// ==== AUTH RELATED MUTATIONS ====

// Create or update a user when they log in through an auth provider
export const createOrUpdateUserFromAuth = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.string(),
    pictureUrl: v.optional(v.string()),
    provider: v.string(), // "google", "microsoft", etc.
  },
  handler: async (ctx, args) => {
    // Get the user identity from the auth context
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Called createOrUpdateUserFromAuth without authentication");
    }

    const now = new Date().toISOString();
    
    // Check if user already exists
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first();

    if (user) {
      // User exists, update their information
      await ctx.db.patch(user._id, {
        firstName: args.name?.split(' ')[0] ?? user.firstName,
        lastName: args.name?.split(' ').slice(1).join(' ') ?? user.lastName,
        email: args.email || user.email,
        lastLogin: now,
        updatedAt: now,
      });
      // Log login event
      await logAuthEvent(ctx, "LOGIN", user._id, true);
      
      return { userId: user._id, isNewUser: false };
    } else {
      // Look up enterprise based on email domain
      const emailDomain = args.email.split('@')[1];
      const enterprise = await ctx.db
        .query("enterprises")
        .withIndex("by_domain", (q) => q.eq("domain", emailDomain))
        .first();
      
      if (!enterprise) {
        throw new ConvexError("No enterprise found for this email domain");
      }
      
      // Create a new user account
      const nameParts = args.name ? args.name.split(' ') : ['New', 'User'];
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const userId = await ctx.db.insert("users", {
        email: args.email,
        firstName,
        lastName,
        title: "",
        role: "contract_viewer", // Default role for new users
        status: "active",
        isActive: true,
        isEmailVerified: identity.emailVerified || false,
        authId: identity.subject,
        authType: "oauth",
        authProvider: args.provider,
        enterpriseId: enterprise._id,
        language: "en-US",
        timezone: "UTC",
        dateFormat: "MM/DD/YYYY",
        notificationPreferences: {
          emailEnabled: true,
          inAppEnabled: true,
          smsEnabled: false,
          contractNotifications: true,
          approvalNotifications: true,
          signatureNotifications: true,
          analyticsNotifications: false,
        },
        securityPreferences: {
          mfaEnabled: false,
         
          sessionTimeout: 60,
        },
        failedLoginAttempts: 0,
        permissions: [],
        accessibleContracts: [],
        accessibleTemplates: [],
        accessibleDepartments: [],
        contractsCreated: 0,
        contractsSigned: 0,
        templatesCreated: 0,
        activeSessions: 1,
        createdAt: now,
        updatedAt: now,
        lastLogin: now,
      });
      
      // Create identity provider link
      await ctx.db.insert("identityProviderLinks", {
        userId,
        provider: args.provider,
        providerUserId: identity.subject,
        email: args.email,
        profile: {
          name: args.name,
          picture: args.pictureUrl,
        },
        isVerified: identity.emailVerified || false,
        isActive: true,
        createdAt: now,
        lastUsedAt: now,
      });
      
      // Log user creation and login events
      await logAuthEvent(ctx, "SIGNUP", userId, true, undefined, { provider: args.provider });
      await logAuthEvent(ctx, "LOGIN", userId, true);
      
      return { userId, isNewUser: true };
    }
  },
});

// Handle user logout
export const logout = mutation({
  handler: async (ctx) => {
    const user = await getUser(ctx);
    if (!user) {
      return { success: true }; // Already logged out
    }
    
    // Get session info from headers if available
    //@ts-expect-error
    const headers = ctx.request?.headers;
    const sessionId = headers?.get("x-session-id");
    
    // Log the logout event
    await logAuthEvent(ctx, "LOGOUT", user._id);
    
    // If we have a session ID, end that specific session
    if (sessionId) {
      const session = await ctx.db
        .query("userSessions")
        .withIndex("by_session", q => q.eq("sessionId", sessionId))
        .first();
      
      if (session) {
        await ctx.db.patch(session._id, {
          isActive: false,
          lastActiveAt: new Date().toISOString(),
        });
        
        // Update user's active session count
        await ctx.db.patch(user._id, {
          activeSessions: Math.max(0, (user.activeSessions || 1) - 1),
        });
      }
    }
    
    return { success: true };
  },
});

// Link a new identity provider to an existing user
export const linkIdentityProvider = mutation({
  args: {
    provider: v.string(),
    providerUserId: v.string(),
    email: v.string(),
    profile: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    
    // Check if this provider is already linked to another account
    const existingLink = await ctx.db
      .query("identityProviderLinks")
      .withIndex("by_provider_id", (q) => 
        q.eq("provider", args.provider).eq("providerUserId", args.providerUserId)
      )
      .first();
    
    if (existingLink && existingLink.userId !== user._id) {
      throw new ConvexError("This provider account is already linked to another user");
    }
    
    // Check if this provider is already linked to this user
    const userLink = await ctx.db
      .query("identityProviderLinks")
      .withIndex("by_email_provider", (q) => 
        q.eq("email", args.email).eq("provider", args.provider)
      )
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();
    
    if (userLink) {
      // Update the existing link
      await ctx.db.patch(userLink._id, {
        providerUserId: args.providerUserId,
        profile: args.profile,
        lastUsedAt: new Date().toISOString(),
      });
    } else {
      // Create a new link
      await ctx.db.insert("identityProviderLinks", {
        userId: user._id,
        provider: args.provider,
        providerUserId: args.providerUserId,
        email: args.email,
        profile: args.profile,
        isVerified: true, // Since we already have an authenticated user
        isActive: true,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      });
    }
    
    // Log the event
    await logAuthEvent(
      ctx, 
      "ACCOUNT_LINKED", 
      user._id, 
      true, 
      undefined, 
      { provider: args.provider }
    );
    
    return { success: true };
  },
});

// Unlink an identity provider from a user
export const unlinkIdentityProvider = mutation({
  args: {
    provider: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    
    // Count how many active identity providers the user has
    const providerLinks = await ctx.db
      .query("identityProviderLinks")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();
    
    if (providerLinks.length <= 1) {
      throw new ConvexError("Cannot remove the last authentication method");
    }
    
    // Find the specific link to remove
    const linkToRemove = providerLinks.find(link => 
      link.provider === args.provider && link.isActive
    );
    
    if (!linkToRemove) {
      throw new ConvexError(`No active ${args.provider} account linked to this user`);
    }
    
    // Deactivate the link (don't delete to maintain audit history)
    await ctx.db.patch(linkToRemove._id, {
      isActive: false,
    });
    
    // Log the event
    await logAuthEvent(
      ctx, 
      "ACCOUNT_UNLINKED", 
      user._id, 
      true, 
      undefined, 
      { provider: args.provider }
    );
    
    return { success: true };
  },
});

// Get the user's connected identity providers
export const getConnectedProviders = query({
  handler: async (ctx) => {
    const user = await getUser(ctx);
    if (!user) {
      return [];
    }
    
    const providerLinks = await ctx.db
      .query("identityProviderLinks")
      .filter((q) => 
        q.and(
          q.eq(q.field("userId"), user._id),
          q.eq(q.field("isActive"), true)
        )
      )
      .collect();
    
    return providerLinks.map(link => ({
      provider: link.provider,
      email: link.email,
      connectedAt: link.createdAt,
      lastUsed: link.lastUsedAt,
    }));
  },
});

// Change user email (with verification)
export const initiateEmailChange = mutation({
  args: {
    newEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    
    // Check if email is already in use
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.newEmail))
      .first();
    
    if (existingUser && existingUser._id !== user._id) {
      throw new ConvexError("This email is already in use");
    }
    
    const now = new Date().toISOString();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry
    
    // Generate a token
    const token = Math.random().toString(36).substring(2, 15) + 
                 Math.random().toString(36).substring(2, 15);
    
    // Store the verification token
    await ctx.db.insert("emailVerificationTokens", {
      userId: user._id,
      email: args.newEmail,
      token,
      expiresAt: expiresAt.toISOString(),
      isUsed: false,
      createdAt: now,
       //@ts-expect-error
      ipRequested: ctx.request?.headers?.get("x-forwarded-for") || "unknown",
    });
    
    // In a real app, you would send an email with the verification link here
    
    // Log the event
    await logAuthEvent(
      ctx, 
      "EMAIL_CHANGE_REQUESTED", 
      user._id, 
      true, 
      undefined, 
      { newEmail: args.newEmail }
    );
    
    return { 
      success: true,
      // Only for development/testing - in production, this would not be returned
      verificationToken: token 
    };
  },
});

// Verify email change token and update the email
export const verifyEmailChange = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the token
    const verification = await ctx.db
      .query("emailVerificationTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    
    if (!verification) {
      throw new ConvexError("Invalid verification token");
    }
    
    if (verification.isUsed) {
      throw new ConvexError("Token has already been used");
    }
    
    // Check if token is expired
    if (new Date(verification.expiresAt) < new Date()) {
      throw new ConvexError("Verification token has expired");
    }
    
    const now = new Date().toISOString();
    
    // Mark token as used
    await ctx.db.patch(verification._id, {
      isUsed: true,
      usedAt: now,
       //@ts-expect-error
      ipUsed: ctx.request?.headers?.get("x-forwarded-for") || "unknown",
    });
    
    // Update user's email
    await ctx.db.patch(verification.userId, {
      email: verification.email,
      isEmailVerified: true,
      emailVerifiedAt: now,
      updatedAt: now,
    });
    
    // Update email in linked providers
    const providerLinks = await ctx.db
      .query("identityProviderLinks")
      .filter((q) => q.eq(q.field("userId"), verification.userId))
      .collect();
    
    for (const link of providerLinks) {
      await ctx.db.patch(link._id, {
        email: verification.email,
      });
    }
    
    // Log the event
    await logAuthEvent(
      ctx, 
      "EMAIL_CHANGED", 
      verification.userId, 
      true, 
      undefined, 
      { newEmail: verification.email }
    );
    
    return { success: true };
  },
});

// Enable Multi-Factor Authentication
export const enableMFA = mutation({
  args: {
    mfaType: v.string(), // "app", "sms", etc.
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    
    // In a real implementation, you would:
    // 1. Generate MFA secret (for authenticator apps)
    // 2. Store the secret
    // 3. Generate and return QR code URL or setup instructions
    
    const mfaSecret = "DEMO_SECRET_" + Math.random().toString(36).substring(2, 10);
    
    // Update user's security preferences
    await ctx.db.patch(user._id, {
      securityPreferences: {
        ...user.securityPreferences,
        mfaEnabled: true,
        mfaType: args.mfaType,
      },
      mfaSecret,
      updatedAt: new Date().toISOString(),
    });
    
    // Generate recovery codes
    const recoveryCodes = [];
    for (let i = 0; i < 8; i++) {
      const code = Math.random().toString(36).substring(2, 8) + "-" + 
                   Math.random().toString(36).substring(2, 8);
      recoveryCodes.push(code);
      
      // Store hashed recovery codes
      await ctx.db.insert("mfaRecoveryCodes", {
        userId: user._id,
        code, // In production, this would be hashed
        isUsed: false,
        createdAt: new Date().toISOString(),
      });
    }
    
    // Log the event
    await logAuthEvent(
      ctx, 
      "MFA_ENABLED", 
      user._id, 
      true, 
      undefined, 
      { mfaType: args.mfaType }
    );
    
    return { 
      success: true,
      // In production, return QR code URL or setup instructions
      secretKey: mfaSecret, 
      recoveryCodes,
    };
  },
});

// Disable Multi-Factor Authentication
export const disableMFA = mutation({
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    
    // Update user's security preferences
    await ctx.db.patch(user._id, {
      securityPreferences: {
        ...user.securityPreferences,
        mfaEnabled: false,
       
      },
  
      updatedAt: new Date().toISOString(),
    });
    
    // Delete recovery codes (or mark as inactive)
    const recoveryCodes = await ctx.db
      .query("mfaRecoveryCodes")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();
    
    for (const code of recoveryCodes) {
      await ctx.db.delete(code._id);
    }
    
    // Log the event
    await logAuthEvent(ctx, "MFA_DISABLED", user._id);
    
    return { success: true };
  },
});

// Get current user's auth status and session info
export const getAuthStatus = query({
  handler: async (ctx) => {
    const user = await getUser(ctx);
    if (!user) {
      return {
        isAuthenticated: false,
        user: null,
      };
    }
    
    // Get user's active sessions
    const sessions = await ctx.db
      .query("userSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    // Get connected providers
    const providers = await ctx.db
      .query("identityProviderLinks")
      .filter((q) => 
        q.and(
          q.eq(q.field("userId"), user._id),
          q.eq(q.field("isActive"), true)
        )
      )
      .collect();
    
    return {
      isAuthenticated: true,
      user: {
        id: user._id,
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        role: user.role,
        mfaEnabled: user.securityPreferences?.mfaEnabled || false,
      },
      sessions: sessions.map(s => ({
        id: s.sessionId,
        createdAt: s.createdAt,
        lastActive: s.lastActiveAt,
        device: s.deviceInfo,
        ipAddress: s.ipAddress,
      })),
      providers: providers.map(p => p.provider),
    };
  },
});

// ==== YOUR EXISTING USER QUERIES AND MUTATIONS ====

export const getCurrentUser = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    
    const userId = identity.subject;
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("authId"), userId))
      .first();
    
    if (!user) {
      return null;
    }
    
    // Get enterprise info
    const enterprise = await ctx.db.get(user.enterpriseId);
    
    // Get user's notifications (unread count)
    const unreadNotificationCount = await ctx.db
      .query("userNotifications")
      .withIndex("by_user_and_read", (q) => 
        q.eq("userId", user._id).eq("isRead", false)
      )
      // @ts-expect-error
      .count();
    
    return {
      ...user,
      enterprise: enterprise ? {
        name: enterprise.name,
        logo: enterprise.logo,
        primaryColor: enterprise.primaryColor,
        secondaryColor: enterprise.secondaryColor,
      } : null,
      unreadNotificationCount,
    };
  },
});


// ==== USER MUTATIONS ====

export const markNotificationRead = mutation({
  args: {
    notificationId: v.id("userNotifications"),
  },
  handler: async (ctx, args) => {
    const identity  = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    const userId = identity.subject;
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("authId"), userId))
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // Get the notification
    const notification = await ctx.db.get(args.notificationId);
    
    if (!notification) {
      throw new Error("Notification not found");
    }
    
    // Check if the notification belongs to this user
    if (notification.userId !== user._id) {
      throw new Error("Not authorized to access this notification");
    }
    
    // Mark as read
    await ctx.db.patch(args.notificationId, {
      isRead: true,
      readAt: new Date().toISOString(),
    });
    
    return { success: true };
  },
});

export const markAllNotificationsRead = mutation({
  handler: async (ctx) => {
    const  identity  = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    const userId = identity.subject;
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("authId"), userId))
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // Get all unread notifications for this user
    const unreadNotifications = await ctx.db
      .query("userNotifications")
      .withIndex("by_user_and_read", (q) => 
        q.eq("userId", user._id).eq("isRead", false)
      )
      .collect();
    
    // Mark all as read
    const now = new Date().toISOString();
    for (const notification of unreadNotifications) {
      await ctx.db.patch(notification._id, {
        isRead: true,
        readAt: now,
      });
    }
    
    return { 
      success: true,
      count: unreadNotifications.length 
    };
  },
});

export const updateUserProfile = mutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    title: v.optional(v.string()),
    department: v.optional(v.string()),
    language: v.optional(v.string()),
    timezone: v.optional(v.string()),
    dateFormat: v.optional(v.string()),
    notificationPreferences: v.optional(v.object({
      emailEnabled: v.boolean(),
      inAppEnabled: v.boolean(),
      smsEnabled: v.boolean(),
      contractNotifications: v.boolean(),
      approvalNotifications: v.boolean(),
      signatureNotifications: v.boolean(),
      analyticsNotifications: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    const  identity  = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    const userId = identity.subject;
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("authId"), userId))
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // Create update object with only the fields being changed
    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }
    
    // Add updated timestamp
    updates.updatedAt = new Date().toISOString();
    
    // Update the user
    await ctx.db.patch(user._id, updates);
    
    return { success: true };
  },
});

export const updateUserSecurityPreferences = mutation({
  args: {
    securityPreferences: v.object({
      mfaEnabled: v.boolean(),
      mfaType: v.optional(v.string()),
      ipWhitelist: v.optional(v.array(v.string())),
      allowedDevices: v.optional(v.array(v.string())),
      sessionTimeout: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const  identity  = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    const userId = identity.subject;
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("authId"), userId))
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // Update the user's security preferences
    await ctx.db.patch(user._id, {
      securityPreferences: args.securityPreferences,
      updatedAt: new Date().toISOString(),
    });
    
    return { success: true };
  },
});

export const createUser = mutation({
  args: {
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    title: v.optional(v.string()),
    role: v.string(),
    enterpriseId: v.id("enterprises"),
    departmentId: v.optional(v.id("departments")),
    language: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const  identity  = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    const userId = identity.subject;
    const currentUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("authId"), userId))
      .first();
    
    if (!currentUser) {
      throw new Error("User not found");
    }
    
    // Check if current user has admin permissions
    if (currentUser.role !== "system_admin" && currentUser.role !== "enterprise_admin") {
      throw new Error("You do not have permission to create users");
    }
    
    // Check if email is already used
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    
    if (existingUser) {
      throw new Error("Email is already in use");
    }
    
    const now = new Date().toISOString();
    
    // Create new user
    const newUserId = await ctx.db.insert("users", {
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      title: args.title || "",
      role: args.role,
      status: "pending", // Initial status
      isActive: true,
      isEmailVerified: false,
      authType: "password", // Default auth type
      enterpriseId: args.enterpriseId,
      departmentId: args.departmentId,
      language: args.language || "en-US",
      timezone: args.timezone || "UTC",
      dateFormat: "MM/DD/YYYY",
      notificationPreferences: {
        emailEnabled: true,
        inAppEnabled: true,
        smsEnabled: false,
        contractNotifications: true,
        approvalNotifications: true,
        signatureNotifications: true,
        analyticsNotifications: false,
      },
      securityPreferences: {
        mfaEnabled: false,
        sessionTimeout: 60, // Minutes
      },
      failedLoginAttempts: 0,
      permissions: [],
      accessibleContracts: [],
      accessibleTemplates: [],
      accessibleDepartments: [],
      contractsCreated: 0,
      contractsSigned: 0,
      templatesCreated: 0,
      activeSessions: 0,
      createdAt: now,
      updatedAt: now,
      authId: ""
    });
    
    // Log user creation
    await ctx.db.insert("userActivityLog", {
      userId: currentUser._id,
      action: "create_user",
      resourceType: "user",
      resourceId: newUserId,
      details: { userEmail: args.email, userRole: args.role },
      timestamp: now,
    });
    
    return newUserId;
  },
});

export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    title: v.optional(v.string()),
    role: v.optional(v.string()),
    status: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    departmentId: v.optional(v.id("departments")),
    permissions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const  identity  = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    
    const adminId = identity.subject;
    const admin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("authId"), adminId))
      .first();
    
    if (!admin) {
      throw new Error("Admin user not found");
    }
    
    // Check if admin has permissions
    if (admin.role !== "system_admin" && admin.role !== "enterprise_admin") {
      throw new Error("You do not have permission to update users");
    }
    
    // Get the user to update
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Create update object with only the fields being changed
    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(args)) {
      if (key !== "userId" && value !== undefined) {
        updates[key] = value;
      }
    }
    
    // Add updated timestamp
    updates.updatedAt = new Date().toISOString();
    
    // Update the user
    await ctx.db.patch(args.userId, updates);
    
    // Log user update
    await ctx.db.insert("userActivityLog", {
      userId: admin._id,
      action: "update_user",
      resourceType: "user",
      resourceId: args.userId,
      details: { updatedFields: Object.keys(updates) },
      timestamp: updates.updatedAt,
    });
    
    return args.userId;
  },
});