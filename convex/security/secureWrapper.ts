import { query as baseQuery, mutation as baseMutation, action as baseAction } from "../_generated/server";
import { ConvexError } from "convex/values";
import { getSecurityContext, SecurityContext, hasPermission, SecureQuery, SecureMutation } from "./rowLevelSecurity";
import { checkRateLimit } from "./rateLimiting";
import { logAuditEvent } from "./auditLogging";

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
 * Secure query wrapper
 */
export function secureQuery<Args extends Record<string, any>, Output>(
  options: SecureOptions,
  handler: (ctx: any, args: Args, security: SecurityContext) => Promise<Output>
) {
  return baseQuery({
    args: {} as any,
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
 * Secure mutation wrapper
 */
export function secureMutation<Args extends Record<string, any>, Output>(
  options: SecureOptions,
  handler: (ctx: any, args: Args, security: SecurityContext, secure: SecureMutation) => Promise<Output>
) {
  return baseMutation({
    args: {} as any,
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
 * Secure action wrapper (simplified for now due to context limitations)
 */
export function secureAction<Args extends Record<string, any>, Output>(
  options: SecureOptions,
  handler: (ctx: any, args: Args, security: SecurityContext) => Promise<Output>
) {
  return baseAction({
    args: {} as any,
    handler: async (ctx, args: Args) => {
      // Note: Actions have different context handling in Convex
      // Security would need to be implemented differently
      const mockSecurityContext = {
        userId: "action-user" as any,
        enterpriseId: "action-enterprise" as any,
        role: "user" as any,
        permissions: ["*"]
      };
      
      try {
        // Execute handler with mock context for now
        const result = await handler(ctx, args, mockSecurityContext);
        return result;
      } catch (error) {
        throw error;
      }
    },
  });
}