import { query as baseQuery, mutation as baseMutation, action as baseAction, QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { getSecurityContext, SecurityContext, hasPermission, SecureQuery, SecureMutation } from "./rowLevelSecurity";
import { checkRateLimit } from "./rateLimiting";
import { logAuditEvent } from "../auditLogging";
import { api } from "../_generated/api";

/**
 * Actions in Convex should use the built-in auth system instead of manual JWT validation.
 * This function is deprecated and will be removed.
 * 
 * For actions that need authentication, they should be called from authenticated
 * queries/mutations that already have access to ctx.auth.getUserIdentity().
 * 
 * If you need to validate external tokens, use Convex's HTTP endpoints instead.
 */
async function validateClerkToken(token: string): Promise<{ sub: string } | null> {
  // Direct JWT validation in actions is deprecated. Use Convex auth system instead.
  return null;
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
export function createSecureQuery<Args, Output>(
  args: any,
  options: SecureOptions,
  handler: (ctx: QueryCtx, args: Args, security: SecurityContext) => Promise<Output>
) {
  return baseQuery({
    args,
    handler: async (ctx, args) => {
      // Get security context
      const securityContext = await getSecurityContext(ctx);
      
      // Check rate limit
      if (options.rateLimit) {
        const rateLimitOptions: {
          userId?: any;
          cost?: number;
        } = {};
        
        if (securityContext.userId !== undefined) rateLimitOptions.userId = securityContext.userId;
        if (options.rateLimit.cost !== undefined) rateLimitOptions.cost = options.rateLimit.cost;
        
        const rateLimitResult = await checkRateLimit(ctx, 
          options.rateLimit.operation || "query.default",
          rateLimitOptions
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
export function createSecureMutation<Args, Output>(
  args: any,
  options: SecureOptions,
  handler: (ctx: MutationCtx, args: Args, security: SecurityContext, secure: SecureMutation) => Promise<Output>
) {
  return baseMutation({
    args,
    handler: async (ctx, args) => {
      // Get security context
      const securityContext = await getSecurityContext(ctx);
      
      // Check rate limit
      if (options.rateLimit) {
        const rateLimitOptions: {
          userId?: any;
          cost?: number;
        } = {};
        
        if (securityContext.userId !== undefined) rateLimitOptions.userId = securityContext.userId;
        if (options.rateLimit.cost !== undefined) rateLimitOptions.cost = options.rateLimit.cost;
        
        const rateLimitResult = await checkRateLimit(ctx, 
          options.rateLimit.operation || "mutation.default",
          rateLimitOptions
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
 * Create a secure action that requires authentication context
 * 
 * IMPORTANT: Actions in Convex cannot access ctx.auth directly.
 * Authentication must be passed from the calling query/mutation.
 * 
 * Best practice: Call actions from authenticated mutations that pass
 * the security context as an argument.
 */
export function createSecureAction<Args extends { userId: string; enterpriseId: string }, Output>(
  args: any,
  options: SecureOptions,
  handler: (ctx: ActionCtx, args: Args, security: SecurityContext) => Promise<Output>
) {
  return baseAction({
    args: {
      ...args,
      // These are required for all secure actions
      userId: v.id("users"),
      enterpriseId: v.id("enterprises"),
      userRole: v.string(),
    },
    handler: async (ctx, args) => {
      // Verify required auth parameters
      if (!args.userId || !args.enterpriseId || !args.userRole) {
        throw new ConvexError("Authentication required: Actions must be called with userId, enterpriseId, and userRole.");
      }
      
      // Get user to verify they still exist and are active
      let securityContext: SecurityContext;
      
      try {
        const user = await ctx.runQuery(api.coreUsers.getUserById, { userId: args.userId });
        if (!user || !user.isActive) {
          throw new ConvexError("User not found or inactive");
        }
        
        // Verify the provided enterpriseId matches the user's enterprise
        if (user.enterpriseId !== args.enterpriseId) {
          throw new ConvexError("Enterprise mismatch");
        }
        
        securityContext = {
          userId: user._id,
          enterpriseId: user.enterpriseId,
          role: user.role,
          permissions: ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || []
        };
      } catch (error) {
        console.error("Action authentication failed:", error);
        throw new ConvexError("Authentication failed: User verification failed");
      }
      
      // Check rate limit (with simplified tracking for actions)
      if (options.rateLimit) {
        // For actions, we'll implement a simpler rate limiting approach
        // In a production system, you might use Redis or external storage
        // Rate limiting not fully implemented for actions yet
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
            await ctx.runMutation(api.auditLogging.logEvent, {
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
            await ctx.runMutation(api.auditLogging.logEvent, {
              userId: securityContext.userId,
              operation: options.audit.operation,
              resourceType: options.audit.resourceType,
              action: options.audit.action,
              status: "failure",
              ...(error instanceof Error ? { errorMessage: error.message } : {}),
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