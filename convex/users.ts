import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";

// ==== USER QUERIES ====

export const getCurrentUser = query({
  handler: async (ctx) => {
    const  identity  = await ctx.auth.getUserIdentity();
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
      //@ts-expect-error
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

export const listUsers = query({
  args: {
    enterpriseId: v.id("enterprises"),
    role: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { enterpriseId, role, status, limit = 100 } = args;
    
    let usersQuery = ctx.db
      .query("users")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))     
    
    if (role) {
      usersQuery = usersQuery.filter((q) => q.eq(q.field("role"), role));
    }
    
    if (status) {
      usersQuery = usersQuery.filter((q) => q.eq(q.field("status"), status));
    }
    
    return await usersQuery.take(limit);
  },
});

export const getUserNotifications = query({
  args: {
    isRead: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { isRead, limit = 20 } = args;
    
    const  identity  = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    
    const userId = identity.subject;
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("authId"), userId))
      .first();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    let notificationsQuery = ctx.db
      .query("userNotifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      
    
    if (isRead !== undefined) {
      notificationsQuery = notificationsQuery.filter((q) => 
        q.eq(q.field("isRead"), isRead)
      );
    }
    
    return await notificationsQuery.take(limit);
  },
});

export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    
    if (!user) {
      return null;
    }
    
    // Get user's accessible departments
    let departments:any[] = [];
    if (user.accessibleDepartments && user.accessibleDepartments.length > 0) {
      departments = await Promise.all(
        user.accessibleDepartments.map(async (departmentId) => {
          const department = await ctx.db.get(departmentId);
          return department;
        })
      );
      // Filter out any null values (in case any departments were deleted)
      departments = departments.filter(Boolean);
    }
    
    // Get primary department from user's department field if it exists
    let primaryDepartment = null;
    if (user.department) {
      // Check if it's a reference or a string value
      if (typeof user.department === 'string') {
        // If it's a department name, we can return it directly
        primaryDepartment = { name: user.department };
      } else {
        // Otherwise try to fetch the department object
        const departmentId = user.department;
        primaryDepartment = await ctx.db.get(departmentId);
      }
    }
    
    return {
      ...user,
      departments,
      primaryDepartment,
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