import { QueryCtx, MutationCtx, DatabaseReader, DatabaseWriter } from "../_generated/server";
import { Id, Doc, TableNames } from "../_generated/dataModel";
import { ConvexError } from "convex/values";

/**
 * Row-Level Security Implementation
 * 
 * This module provides secure database access functions that automatically
 * enforce enterprise-level data isolation and role-based permissions
 */

export interface SecurityContext {
  userId: Id<"users">;
  enterpriseId: Id<"enterprises">;
  role: "owner" | "admin" | "manager" | "user" | "viewer";
  permissions: string[];
}

// Permission definitions based on roles
const ROLE_PERMISSIONS = {
  owner: ["*"], // All permissions
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
 * Get security context for the current user
 */
export async function getSecurityContext(
  ctx: QueryCtx | MutationCtx
): Promise<SecurityContext> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user || !user.isActive) {
    throw new ConvexError("User not found or inactive");
  }

  return {
    userId: user._id,
    enterpriseId: user.enterpriseId,
    role: user.role,
    permissions: ROLE_PERMISSIONS[user.role] || []
  };
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  context: SecurityContext,
  permission: string
): boolean {
  if (context.permissions.includes("*")) return true;
  return context.permissions.includes(permission);
}

/**
 * Secure query builder that automatically filters by enterprise
 */
export class SecureQuery<T extends TableNames> {
  constructor(
    private ctx: QueryCtx | MutationCtx,
    private table: T,
    private securityContext: SecurityContext
  ) {}

  async all(): Promise<Doc<T>[]> {
    const results = await this.ctx.db
      .query(this.table)
      .filter((q) => q.eq(q.field("enterpriseId"), this.securityContext.enterpriseId as any))
      .collect();
    return results as Doc<T>[];
  }

  async byId(id: Id<T>): Promise<Doc<T> | null> {
    const doc = await this.ctx.db.get(id);
    if (!doc) return null;
    
    // Verify enterprise access
    if ((doc as any)?.enterpriseId !== this.securityContext.enterpriseId) {
      throw new ConvexError("Access denied: Document belongs to different enterprise");
    }
    
    return doc;
  }

  async where(filter: (q: any) => any): Promise<Doc<T>[]> {
    return await this.ctx.db
      .query(this.table)
      .filter((q) => 
        q.and(
          q.eq(q.field("enterpriseId"), this.securityContext.enterpriseId as any),
          filter(q)
        )
      )
      .collect();
  }
}

/**
 * Secure mutation operations
 */
export class SecureMutation {
  constructor(
    private ctx: MutationCtx,
    private securityContext: SecurityContext
  ) {}

  async insert<T extends TableNames>(
    table: T,
    data: Omit<Doc<T>, "_id" | "_creationTime" | "enterpriseId">,
    permission?: string
  ): Promise<Id<T>> {
    // Check permission if specified
    if (permission && !hasPermission(this.securityContext, permission)) {
      throw new ConvexError(`Permission denied: ${permission}`);
    }

    // Automatically add enterprise ID
    const secureData = {
      ...data,
      enterpriseId: this.securityContext.enterpriseId
    } as any;

    return await this.ctx.db.insert(table as any, secureData) as Id<T>;
  }

  async update<T extends TableNames>(
    id: Id<T>,
    data: Partial<Omit<Doc<T>, "_id" | "_creationTime" | "enterpriseId">>,
    permission?: string
  ): Promise<void> {
    // Check permission if specified
    if (permission && !hasPermission(this.securityContext, permission)) {
      throw new ConvexError(`Permission denied: ${permission}`);
    }

    // Verify document belongs to user's enterprise
    const existing = await this.ctx.db.get(id);
    if (!existing) {
      throw new ConvexError("Document not found");
    }

    if ((existing as any)?.enterpriseId !== this.securityContext.enterpriseId) {
      throw new ConvexError("Access denied: Cannot update document from different enterprise");
    }

    // Remove enterprise ID from updates to prevent tampering
    const { enterpriseId, ...safeData } = data as Partial<Doc<T> & { enterpriseId: any }>;
    
    await this.ctx.db.patch(id, safeData as any);
  }

  async delete<T extends TableNames>(
    id: Id<T>,
    permission?: string
  ): Promise<void> {
    // Check permission if specified
    if (permission && !hasPermission(this.securityContext, permission)) {
      throw new ConvexError(`Permission denied: ${permission}`);
    }

    // Verify document belongs to user's enterprise
    const existing = await this.ctx.db.get(id);
    if (!existing) {
      throw new ConvexError("Document not found");
    }

    if ((existing as any)?.enterpriseId !== this.securityContext.enterpriseId) {
      throw new ConvexError("Access denied: Cannot delete document from different enterprise");
    }

    await this.ctx.db.delete(id);
  }

  // Helper method for byId that's used in secureContractOperations.ts
  async byId<T extends TableNames>(
    table: T, 
    id: Id<T>
  ): Promise<Doc<T> | null> {
    const doc = await this.ctx.db.get(id);
    if (!doc) return null;
    
    // Verify enterprise access
    if ((doc as any)?.enterpriseId !== this.securityContext.enterpriseId) {
      throw new ConvexError("Access denied: Document belongs to different enterprise");
    }
    
    return doc;
  }
}