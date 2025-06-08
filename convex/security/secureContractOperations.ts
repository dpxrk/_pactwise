import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import { secureQuery, secureMutation, secureAction } from "./secureWrapper";
import { SecureQuery, SecureMutation } from "./rowLevelSecurity";
import { logAuditEvent } from "./auditLogging";

/**
 * Example implementation of secure contract operations
 * Shows how to use the security framework
 */

// Secure contract creation
export const createSecureContract = secureMutation(
  {
    rateLimit: { operation: "mutation.create", cost: 2 },
    audit: {
      operation: "createContract",
      resourceType: "contracts",
      action: "create"
    },
    permission: "contracts.create"
  },
  async (ctx, args: {
    vendorId: Id<"vendors">;
    title: string;
    storageId: Id<"_storage">;
    fileName: string;
    fileType: string;
    contractType?: string;
    notes?: string;
  }, security, secure) => {
    // Validate vendor belongs to enterprise
    const vendor = await secure.byId("vendors", args.vendorId);
    if (!vendor) {
      throw new ConvexError("Vendor not found");
    }
    
    // Create contract with automatic enterprise ID
    const contractId = await secure.insert("contracts", {
      vendorId: args.vendorId,
      title: args.title.trim(),
      status: "draft",
      contractType: args.contractType,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      analysisStatus: "pending",
      notes: args.notes?.trim(),
    }, "contracts.create");
    
    // Update audit log with created resource
    await logAuditEvent(ctx, security, {
      operation: "createContract",
      resourceType: "contracts",
      resourceId: contractId,
      action: "create",
      status: "success",
      metadata: { title: args.title, vendorId: args.vendorId }
    });
    
    return contractId;
  }
);

// Secure contract query with automatic filtering
export const getSecureContracts = secureQuery(
  {
    rateLimit: { operation: "query.default" },
    permission: "contracts.read"
  },
  async (ctx, args: {
    status?: string;
    contractType?: string;
    limit?: number;
  }, security) => {
    const secureQuery = new SecureQuery(ctx, "contracts", security);
    
    // Build filters
    const filters: Array<(q: any) => any> = [];
    if (args.status) {
      filters.push((q: any) => q.eq(q.field("status"), args.status));
    }
    if (args.contractType) {
      filters.push((q: any) => q.eq(q.field("contractType"), args.contractType));
    }
    
    // Query with automatic enterprise filtering
    const contracts = await secureQuery.where((q: any) => {
      if (filters.length === 0) return true;
      if (filters.length === 1) return filters[0](q);
      return q.and(...filters.map((f: any) => f(q)));
    });
    
    // Apply limit
    const limited = args.limit ? contracts.slice(0, args.limit) : contracts;
    
    // Enrich with vendor data
    const enriched = await Promise.all(
      limited.map(async (contract) => {
        const vendor = await ctx.db.get(contract.vendorId);
        return {
          ...contract,
          vendor: vendor ? {
            _id: vendor._id,
            name: vendor.name,
            category: vendor.category,
          } : null,
        };
      })
    );
    
    return enriched;
  }
);

// Secure contract update with change tracking
export const updateSecureContract = secureMutation(
  {
    rateLimit: { operation: "mutation.update" },
    audit: {
      operation: "updateContract",
      resourceType: "contracts",
      action: "update"
    },
    permission: "contracts.update"
  },
  async (ctx, args: {
    contractId: Id<"contracts">;
    updates: {
      title?: string;
      status?: string;
      contractType?: string;
      notes?: string;
    };
  }, security, secure) => {
    // Get existing contract to track changes
    const existing = await secure.byId("contracts", args.contractId);
    if (!existing) {
      throw new ConvexError("Contract not found");
    }
    
    // Track changes for audit
    const changes: any = {};
    Object.entries(args.updates).forEach(([key, value]) => {
      if (value !== undefined && existing[key as keyof typeof existing] !== value) {
        changes[key] = {
          old: existing[key as keyof typeof existing],
          new: value
        };
      }
    });
    
    // Update contract
    await secure.update(args.contractId, args.updates, "contracts.update");
    
    // Log with changes
    await logAuditEvent(ctx, security, {
      operation: "updateContract",
      resourceType: "contracts",
      resourceId: args.contractId,
      action: "update",
      changes,
      status: "success",
      metadata: { title: existing.title }
    });
    
    return { success: true };
  }
);

// Secure contract deletion
export const deleteSecureContract = secureMutation(
  {
    rateLimit: { operation: "mutation.delete", cost: 3 },
    audit: {
      operation: "deleteContract",
      resourceType: "contracts",
      action: "delete"
    },
    permission: "contracts.delete"
  },
  async (ctx, args: {
    contractId: Id<"contracts">;
  }, security, secure) => {
    // Get contract details for audit
    const contract = await secure.byId("contracts", args.contractId);
    if (!contract) {
      throw new ConvexError("Contract not found");
    }
    
    // Delete associated file
    try {
      await ctx.storage.delete(contract.storageId);
    } catch (error) {
      console.warn(`Failed to delete file for contract ${args.contractId}:`, error);
    }
    
    // Delete contract
    await secure.delete(args.contractId, "contracts.delete");
    
    // Log deletion with contract details
    await logAuditEvent(ctx, security, {
      operation: "deleteContract",
      resourceType: "contracts",
      resourceId: args.contractId,
      action: "delete",
      status: "success",
      metadata: { 
        title: contract.title,
        vendorId: contract.vendorId,
        value: contract.extractedPricing
      }
    });
    
    return { success: true };
  }
);

// Secure bulk export with special auditing
export const exportSecureContracts = secureAction(
  {
    rateLimit: { operation: "action.export", cost: 5 },
    audit: {
      operation: "exportContracts",
      resourceType: "contracts",
      action: "export"
    },
    permission: "contracts.export"
  },
  async (ctx, args: {
    format: "csv" | "json" | "xlsx";
    filters?: {
      status?: string;
      startDate?: string;
      endDate?: string;
    };
  }, security) => {
    // Query contracts with filters
    const contracts = await ctx.runQuery(async (q: any) => {
      const secureQuery = new SecureQuery(q, "contracts", security);
      return await secureQuery.all();
    });
    
    // Apply additional filters
    let filtered = contracts;
    if (args.filters) {
      if (args.filters.status) {
        filtered = filtered.filter((c: any) => c.status === args.filters!.status);
      }
      if (args.filters.startDate) {
        filtered = filtered.filter((c: any) => c._creationTime >= new Date(args.filters!.startDate!).getTime());
      }
      if (args.filters.endDate) {
        filtered = filtered.filter((c: any) => c._creationTime <= new Date(args.filters!.endDate!).getTime());
      }
    }
    
    // Log export with details
    await ctx.runMutation(async (m: any) => {
      await logAuditEvent(m, security, {
        operation: "exportContracts",
        resourceType: "contracts",
        action: "export",
        status: "success",
        metadata: {
          format: args.format,
          count: filtered.length,
          filters: args.filters
        }
      });
    });
    
    // Generate export (simplified - would use actual export libraries)
    let exportData: string;
    switch (args.format) {
      case "csv":
        exportData = generateCSV(filtered);
        break;
      case "json":
        exportData = JSON.stringify(filtered, null, 2);
        break;
      case "xlsx":
        exportData = generateXLSX(filtered);
        break;
    }
    
    // Return download URL (would upload to storage in practice)
    return {
      format: args.format,
      count: filtered.length,
      data: exportData,
      timestamp: new Date().toISOString()
    };
  }
);

// Helper functions for export
function generateCSV(contracts: any[]): string {
  const headers = ["Title", "Status", "Type", "Vendor", "Value", "Start Date", "End Date"];
  const rows = contracts.map((c: any) => [
    c.title,
    c.status,
    c.contractType || "",
    c.vendor?.name || "",
    c.extractedPricing || "",
    c.extractedStartDate || "",
    c.extractedEndDate || ""
  ]);
  
  return [headers, ...rows].map((row: any) => row.join(",")).join("\n");
}

function generateXLSX(contracts: any[]): string {
  // Simplified - would use actual XLSX library
  return generateCSV(contracts);
}