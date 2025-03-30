// convex/auth.ts
import { ConvexError, v } from "convex/values";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Get the current authenticated user
export async function getUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  // Look up user by authId (from identity.subject)
  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
    .first();

  return user;
}

// Verify user is authenticated, throw error if not
export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await getUser(ctx);
  if (!user) {
    throw new ConvexError("Not authenticated");
  }
  
  // Check if user account is active
  if (!user.isActive) {
    throw new ConvexError("User account is inactive");
  }
  
  return user;
}

// Log an authentication event
export async function logAuthEvent(
  ctx: MutationCtx,
  eventType: string,
  userId?: Id<"users">,
  success: boolean = true,
  errorMessage?: string,
  metadata?: any,
) {
  //@ts-expect-error
  const ipAddress = ctx.headers?.["x-forwarded-for"] || "unknown";
   //@ts-expect-error
  const userAgent = ctx.headers?.["user-agent"] || "unknown";

  return await ctx.db.insert("authEvents", {
    userId,
    eventType,
    timestamp: new Date().toISOString(),
    ipAddress,
    userAgent,
    success,
    errorMessage,
    metadata,
  });
}

// Check if user has specific role
export async function hasRole(ctx: QueryCtx | MutationCtx, role: string) {
  const user = await requireUser(ctx);
  
  // First check direct role assignment
  if (user.role === role) {
    return true;
  }
  
  // Then check role assignments through userRoles table
  const userRole = await ctx.db
    .query("userRoles")
    .withIndex("by_user", q => q.eq("userId", user._id))
    .filter(q =>
      q.eq(
        q.field("roleId"),
         //@ts-expect-error
        q.subquery(
          ctx.db
            .query("roles")
            .withIndex("by_name", r => r.eq("name", role))
            .first()
             //@ts-expect-error
            ._id
        )
      )
    )
    .first();

  return !!userRole;
}

// Require user to have specific role
export async function requireRole(ctx: QueryCtx | MutationCtx, role: string) {
  const user = await requireUser(ctx);
  const hasRequiredRole = await hasRole(ctx, role);
  
  if (!hasRequiredRole) {
    throw new ConvexError(`Access denied: requires ${role} role`);
  }
  
  return user;
}

// Check if user has specific permission
export async function hasPermission(ctx: QueryCtx | MutationCtx, permission: string) {
  const user = await requireUser(ctx);
  
  // First check direct permissions list
  if (user.permissions.includes(permission)) {
    return true;
  }
  
  // Then check permissions through roles
  const userRoles = await ctx.db
    .query("userRoles")
    .withIndex("by_user", q => q.eq("userId", user._id))
    .collect();
  
  // Get all role IDs assigned to the user
  const roleIds = userRoles.map(ur => ur.roleId);
  
  // Check if any of these roles has the required permission
  for (const roleId of roleIds) {
    const role = await ctx.db.get(roleId);
    if (role && role.permissions.includes(permission)) {
      return true;
    }
  }
  
  return false;
}

// Require user to have specific permission
export async function requirePermission(ctx: QueryCtx | MutationCtx, permission: string) {
  const user = await requireUser(ctx);
  const hasRequiredPermission = await hasPermission(ctx, permission);
  
  if (!hasRequiredPermission) {
    throw new ConvexError(`Access denied: requires ${permission} permission`);
  }
  
  return user;
}

// Check if user belongs to an organization
export async function isOrgMember(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">
) {
  const user = await requireUser(ctx);
  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_org_user", (q) => 
      q.eq("organizationId", organizationId).eq("userId", user._id)
    )
    .first();
  
  return !!membership;
}

// Require user to be a member of an organization
export async function requireOrgMember(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">
) {
  const user = await requireUser(ctx);
  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_org_user", (q) => 
      q.eq("organizationId", organizationId).eq("userId", user._id)
    )
    .first();
  
  if (!membership || !membership.isActive) {
    throw new ConvexError("Access denied: not an active member of this organization");
  }
  
  return { user, membership };
}

// Require user to have specific role in an organization
export async function requireOrgRole(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  role: string
) {
  const { user, membership } = await requireOrgMember(ctx, organizationId);
  
  if (membership.role !== role) {
    throw new ConvexError(`Access denied: requires ${role} role in this organization`);
  }
  
  return { user, membership };
}

// Check if user belongs to an enterprise
export async function isEnterpriseUser(
  ctx: QueryCtx | MutationCtx,
  enterpriseId: Id<"enterprises">
) {
  const user = await requireUser(ctx);
  return user.enterpriseId === enterpriseId;
}

// Require user to belong to an enterprise
export async function requireEnterpriseUser(
  ctx: QueryCtx | MutationCtx,
  enterpriseId: Id<"enterprises">
) {
  const user = await requireUser(ctx);
  
  if (user.enterpriseId !== enterpriseId) {
    throw new ConvexError("Access denied: not a member of this enterprise");
  }
  
  return user;
}

// Create a session for a user
export async function createSession(
  ctx: MutationCtx, 
  userId: Id<"users">,
  deviceInfo?: any
) {
  const now = new Date().toISOString();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14); // 14 days default session length
  
   //@ts-expect-error
  const headers = ctx.request?.headers;
  const ipAddress = headers?.get("x-forwarded-for") || "unknown";
  const userAgent = headers?.get("user-agent") || "unknown";
  
  // Generate a unique session ID
  const sessionId = generateSecureId();
  
  // Create the session
  const sessionToken = await ctx.db.insert("userSessions", {
    userId,
    sessionId,
    token: generateSecureToken(),
    expiresAt: expiresAt.toISOString(),
    ipAddress,
    userAgent,
    deviceInfo,
    isActive: true,
    createdAt: now,
    lastActiveAt: now,
  });
  
  // Create refresh token if needed
  const refreshToken = await ctx.db.insert("refreshTokens", {
    userId,
    token: generateSecureToken(),
    expiresAt: new Date(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // +7 days from session expiry
    isRevoked: false,
    createdAt: now,
    createdByIp: ipAddress,
    createdByUserAgent: userAgent,
    sessionId,
  });
  
  // Update user's last login time
  await ctx.db.patch(userId, {
    lastLogin: now,
     //@ts-expect-error
    activeSessions: (await ctx.db.get(userId))?.activeSessions + 1 || 1,
  });
  
  // Log the auth event
  await logAuthEvent(ctx, "LOGIN", userId, true, undefined, { sessionId });
  
  return { sessionToken, refreshToken };
}

// End a user session
export async function endSession(ctx: MutationCtx, sessionId: string) {
  const session = await ctx.db
    .query("userSessions")
    .withIndex("by_session", q => q.eq("sessionId", sessionId))
    .first();
  
  if (!session) {
    throw new ConvexError("Session not found");
  }
  
  // Deactivate the session
  await ctx.db.patch(session._id, {
    isActive: false,
  });
  
  // Revoke all refresh tokens for this session
  const refreshTokens = await ctx.db
    .query("refreshTokens")
    .withIndex("by_session", q => q.eq("sessionId", sessionId))
    .filter(q => q.eq(q.field("isRevoked"), false))
    .collect();
  
  for (const token of refreshTokens) {
    await ctx.db.patch(token._id, {
      isRevoked: true,
      revokedAt: new Date().toISOString(),
    });
  }
  
  // Update user's active session count
  const user = await ctx.db.get(session.userId);
  if (user) {
    await ctx.db.patch(user._id, {
      activeSessions: Math.max(0, (user.activeSessions || 1) - 1),
    });
  }
  
  // Log the logout event
  await logAuthEvent(ctx, "LOGOUT", session.userId, true, undefined, { sessionId });
  
  return true;
}

// Refresh a session using a refresh token
export async function refreshSession(
  ctx: MutationCtx,
  refreshTokenValue: string
) {
  // Find the refresh token
  const refreshToken = await ctx.db
    .query("refreshTokens")
    .withIndex("by_token", q => q.eq("token", refreshTokenValue))
    .first();
  
  if (!refreshToken || refreshToken.isRevoked) {
    throw new ConvexError("Invalid refresh token");
  }
  
  // Check if the token is expired
  if (new Date(refreshToken.expiresAt) < new Date()) {
    throw new ConvexError("Refresh token expired");
  }
  
  // Get the associated session
  const session = await ctx.db
    .query("userSessions")
    .withIndex("by_session", q => q.eq("sessionId", refreshToken.sessionId))
    .first();
  
  if (!session || !session.isActive) {
    throw new ConvexError("Session not found or inactive");
  }
  
  // Get the user
  const user = await ctx.db.get(refreshToken.userId);
  if (!user || !user.isActive) {
    throw new ConvexError("User not found or inactive");
  }
  
  const now = new Date().toISOString();
  
  // Revoke the current refresh token (token rotation)
  await ctx.db.patch(refreshToken._id, {
    isRevoked: true,
    revokedAt: now,
  });
  
  // Calculate new expiry times
  const sessionExpiryDate = new Date();
  sessionExpiryDate.setDate(sessionExpiryDate.getDate() + 14); // 14 days session
  
  const refreshTokenExpiryDate = new Date(sessionExpiryDate);
  refreshTokenExpiryDate.setDate(refreshTokenExpiryDate.getDate() + 7); // +7 days
  
  // Update the session
  await ctx.db.patch(session._id, {
    expiresAt: sessionExpiryDate.toISOString(),
    lastRefreshAt: now,
    refreshCount: (session.refreshCount || 0) + 1,
  });
  
  // Create a new refresh token
   //@ts-expect-error
  const headers = ctx.request?.headers;
  const ipAddress = headers?.get("x-forwarded-for") || "unknown";
  const userAgent = headers?.get("user-agent") || "unknown";
  
  const newRefreshToken = await ctx.db.insert("refreshTokens", {
    userId: refreshToken.userId,
    token: generateSecureToken(),
    expiresAt: refreshTokenExpiryDate.toISOString(),
    isRevoked: false,
    createdAt: now,
    createdByIp: ipAddress,
    createdByUserAgent: userAgent,
    sessionId: refreshToken.sessionId,
  });
  
  // Log the event
  await logAuthEvent(
    ctx, 
    "SESSION_REFRESH", 
    refreshToken.userId, 
    true, 
    undefined, 
    { sessionId: refreshToken.sessionId }
  );
  
  return { 
    sessionId: session.sessionId,
    newRefreshToken,
    expiresAt: sessionExpiryDate.toISOString() 
  };
}

// Helper function to generate a secure token
function generateSecureToken(): string {
  // In a real implementation, use a secure random generator
  // This is a simplified example
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Helper function to generate a secure ID
function generateSecureId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// Check password against security policy
export async function validatePasswordStrength(
  ctx: QueryCtx,
  password: string,
  enterpriseId: Id<"enterprises">
) {
  // Get the enterprise security settings
  const securitySettings = await ctx.db
    .query("securitySettings")
    .withIndex("by_enterprise", q => q.eq("enterpriseId", enterpriseId))
    .first();
  
  if (!securitySettings) {
    // Default policy if no settings found
    return validatePasswordWithPolicy(password, {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
    });
  }
  
  return validatePasswordWithPolicy(password, securitySettings.passwordPolicy);
}

// Password validation helper
function validatePasswordWithPolicy(
  password: string, 
  policy: {
    minLength: number,
    requireUppercase: boolean,
    requireLowercase: boolean,
    requireNumbers: boolean,
    requireSpecialChars: boolean
  }
) {
  const errors = [];
  
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  }
  
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  
  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  
  if (policy.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}