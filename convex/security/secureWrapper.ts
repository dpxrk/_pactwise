import { query as baseQuery, mutation as baseMutation, action as baseAction, QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { getSecurityContext, SecurityContext, hasPermission, SecureQuery, SecureMutation } from "./rowLevelSecurity";
import { checkRateLimit } from "./rateLimiting";
import { logAuditEvent } from "./auditLogging";
import { api } from "../_generated/api";
import { Values } from "convex/values";

/**
 * Validate Clerk JWT token
 */
async function validateClerkToken(token: string): Promise<{ sub: string } | null> {
  try {
    // In a real implementation, you would verify the JWT signature using Clerk's public key
    // For now, we'll use Clerk's API to validate the token
    const response = await fetch(`${process.env.CLERK_API_URL}/sessions/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    
    if (!response.ok) {
      console.error('Clerk token validation failed:', response.statusText);
      return null;
    }
    
    const result = await response.json();
    return result.user ? { sub: result.user.id } : null;
  } catch (error) {
    console.error('Error validating Clerk token:', error);
    return null;
  }
}

// Role permissions for action authentication
const ROLE_PERMISSIONS = {
  owner: ["*"],
  admin: [
    "contracts.create", "contracts.read", "contracts.update", "contracts.delete",
    "vendors.create", "vendors.read", "vendors.update", "vendors.delete",
    "users.read", "users.update", "users.invite",
    "analytics.read", "settings.read", "settings.update"
  ],
  manager: [
    "contracts.create", "contracts.read", "contracts.update",
    "vendors.create", "vendors.read", "vendors.update",
    "users.read", "analytics.read"
  ],
  user: [
    "contracts.create", "contracts.read", "contracts.update",
    "vendors.create", "vendors.read", "vendors.update",
    "analytics.read"
  ],
  viewer: [
    "contracts.read", "vendors.read", "users.read", "analytics.read"
  ]
};

/**
 * Secure wrappers for Convex functions that automatically handle:
 * - Authentication and authorization
 * - Rate limiting
 * - Audit logging
 * - Row-level security
 */

interface SecureOptions {
  rateLimit?: {
    operation?: string;
    cost?: number;
  };
  audit?: {
    operation: string;
    resourceType: string;
    action: "create" | "read" | "update" | "delete" | "export" | "share" | "approve" | "reject";
  };
  permission?: string;
}

/**
 * Create a secure query with automatic security checks
 */
export function createSecureQuery<Args extends Values, Output>(
  args: Args,
  options: SecureOptions,
  handler: (ctx: QueryCtx, args: Args, security: SecurityContext) => Promise<Output>
) {
  return baseQuery({
    args,
    handler: async (ctx, args: Args) => {
      // Get security context
      const securityContext = await getSecurityContext(ctx);
      
      // Check rate limit
      if (options.rateLimit) {
        const rateLimitResult = await checkRateLimit(ctx, 
          options.rateLimit.operation || "query.default",
          {
            userId: securityContext.userId,
            cost: options.rateLimit.cost
          }
        );
        
        if (!rateLimitResult.allowed) {
          throw new ConvexError(`Rate limit exceeded. Try again in ${rateLimitResult.resetIn} seconds.`);
        }
      }
      
      // Check permission
      if (options.permission && !hasPermission(securityContext, options.permission)) {
        throw new ConvexError(`Permission denied: ${options.permission}`);
      }
      
      try {
        // Execute handler with security context
        const result = await handler(ctx, args, securityContext);
        
        // Note: Audit logging in queries is optional since they don't modify data
        
        return result;
      } catch (error) {
        throw error;
      }
    },
  });
}

/**
 * Create a secure mutation with automatic security checks
 */
export function createSecureMutation<Args extends Values, Output>(
  args: Args,
  options: SecureOptions,
  handler: (ctx: MutationCtx, args: Args, security: SecurityContext, secure: SecureMutation) => Promise<Output>
) {
  return baseMutation({
    args,
    handler: async (ctx, args: Args) => {
      // Get security context
      const securityContext = await getSecurityContext(ctx);
      
      // Check rate limit
      if (options.rateLimit) {
        const rateLimitResult = await checkRateLimit(ctx, 
          options.rateLimit.operation || "mutation.default",
          {
            userId: securityContext.userId,
            cost: options.rateLimit.cost
          }
        );
        
        if (!rateLimitResult.allowed) {
          throw new ConvexError(`Rate limit exceeded. Try again in ${rateLimitResult.resetIn} seconds.`);
        }
      }
      
      // Check permission
      if (options.permission && !hasPermission(securityContext, options.permission)) {
        throw new ConvexError(`Permission denied: ${options.permission}`);
      }
      
      // Create secure mutation helper
      const secureMutation = new SecureMutation(ctx, securityContext);
      
      try {
        // Execute handler
        const result = await handler(ctx, args, securityContext, secureMutation);
        
        // Log audit event
        if (options.audit) {
          await logAuditEvent(ctx, securityContext, {
            operation: options.audit.operation,
            resourceType: options.audit.resourceType,
            action: options.audit.action,
            status: "success",
          });
        }
        
        return result;
      } catch (error) {
        // Log failed attempt
        if (options.audit) {
          await logAuditEvent(ctx, securityContext, {
            operation: options.audit.operation,
            resourceType: options.audit.resourceType,
            action: options.audit.action,
            status: "failure",
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
        throw error;
      }
    },
  });
}

/**
 * Create a secure action with authentication checks
 */
export function createSecureAction<Args extends Values, Output>(
  args: Args,
  options: SecureOptions,
  handler: (ctx: ActionCtx, args: Args, security: SecurityContext) => Promise<Output>
) {
  return baseAction({
    args,
    handler: async (ctx, args: Args) => {
      // Actions require proper authentication via JWT token
      if (!args.authToken) {
        throw new ConvexError("Authentication required: Actions must include a valid authToken.");
      }
      
      // Validate JWT token and get user information
      let securityContext: SecurityContext;
      
      try {
        // Validate the JWT token using Clerk's API
        const clerkUser = await validateClerkToken(args.authToken);
        if (!clerkUser) {
          throw new ConvexError("Invalid authentication token");
        }
        
        // Get user from database
        const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: clerkUser.sub });
        if (!user || !user.isActive) {
          throw new ConvexError("User not found or inactive");
        }
        
        securityContext = {
          userId: user._id,
          enterpriseId: user.enterpriseId,
          role: user.role,
          permissions: ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || []
        };
      } catch (error) {
        console.error("Action authentication failed:", error);
        throw new ConvexError("Authentication failed: Invalid or expired token");
      }
      
      // Check rate limit (with simplified tracking for actions)
      if (options.rateLimit) {
        // For actions, we'll implement a simpler rate limiting approach
        // In a production system, you might use Redis or external storage
        console.warn("Rate limiting not fully implemented for actions yet");
      }
      
      // Check permission
      if (options.permission && !hasPermission(securityContext, options.permission)) {
        throw new ConvexError(`Permission denied: ${options.permission}`);
      }
      
      try {
        // Execute handler
        const result = await handler(ctx, args, securityContext);
        
        // Log audit event if possible
        if (options.audit) {
          try {
            await ctx.runMutation(api.security.auditLogging.logEvent, {
              userId: securityContext.userId,
              operation: options.audit.operation,
              resourceType: options.audit.resourceType,
              action: options.audit.action,
              status: "success",
            });
          } catch (auditError) {
            console.error("Failed to log audit event:", auditError);
          }
        }
        
        return result;
      } catch (error) {
        // Log failed attempt
        if (options.audit) {
          try {
            await ctx.runMutation(api.security.auditLogging.logEvent, {
              userId: securityContext.userId,
              operation: options.audit.operation,
              resourceType: options.audit.resourceType,
              action: options.audit.action,
              status: "failure",
              errorMessage: error instanceof Error ? error.message : String(error),
            });
          } catch (auditError) {
            console.error("Failed to log audit event:", auditError);
          }
        }
        throw error;
      }
    },
  });
}

// Export the old names for backward compatibility, but mark as deprecated
export const secureQuery = createSecureQuery;
export const secureMutation = createSecureMutation;  
export const secureAction = createSecureAction;