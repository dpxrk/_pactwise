import { query as baseQuery, mutation as baseMutation, action as baseAction } from "../_generated/server";
import { ConvexError } from "convex/values";
import { getSecurityContext, SecurityContext, hasPermission, SecureQuery, SecureMutation } from "./rowLevelSecurity";
import { checkRateLimit } from "./rateLimiting";
import { logAuditEvent } from "./auditLogging";
import { api } from "../_generated/api";

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
export function createSecureQuery<Args extends Record<string, any>, Output>(
  args: any,
  options: SecureOptions,
  handler: (ctx: any, args: Args, security: SecurityContext) => Promise<Output>
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
export function createSecureMutation<Args extends Record<string, any>, Output>(
  args: any,
  options: SecureOptions,
  handler: (ctx: any, args: Args, security: SecurityContext, secure: SecureMutation) => Promise<Output>
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
export function createSecureAction<Args extends Record<string, any>, Output>(
  args: any,
  options: SecureOptions,
  handler: (ctx: any, args: Args, security: SecurityContext) => Promise<Output>
) {
  return baseAction({
    args,
    handler: async (ctx, args: Args) => {
      // Actions need to authenticate differently in Convex
      // For now, we'll require authentication info to be passed in args
      if (!args.authToken && !args.userId) {
        throw new ConvexError("Authentication required for actions. Pass authToken or userId in args.");
      }
      
      // Get user information to build security context
      let securityContext: SecurityContext;
      
      if (args.userId) {
        // Direct user ID approach (for internal system actions)
        const user = await ctx.runQuery(api.users.getById, { userId: args.userId });
        if (!user || !user.isActive) {
          throw new ConvexError("User not found or inactive");
        }
        
        securityContext = {
          userId: user._id,
          enterpriseId: user.enterpriseId,
          role: user.role,
          permissions: ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || []
        };
      } else {
        throw new ConvexError("Authentication method not supported in actions yet");
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