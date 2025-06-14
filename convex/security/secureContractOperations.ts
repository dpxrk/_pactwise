import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import { createSecureQuery, createSecureMutation, createSecureAction } from "./secureWrapper";
import { SecureQuery } from "./rowLevelSecurity";
import { logAuditEvent } from "./auditLogging";
import { api } from "../_generated/api";
import { ContractEntity, ContractCSVRow } from "../../src/types/core-entities";

/**
 * Example implementation of secure contract operations
 * Shows how to use the security framework
 */

// Secure contract creation
export const createSecureContract = createSecureMutation(
  v.object({
    vendorId: v.id("vendors"),
    title: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    contractType: v.optional(v.string()),
    notes: v.optional(v.string()),
  }),
  {
    rateLimit: { operation: "mutation.create", cost: 2 },
    audit: {
      operation: "createContract",
      resourceType: "contracts",
      action: "create"
    },
    permission: "contracts.create"
  },
  async (ctx, args, security, secure) => {
    // Validate vendor belongs to enterprise
    const vendor = await secure.byId("vendors", (args as any).vendorId);
    if (!vendor) {
      throw new ConvexError("Vendor not found");
    }
    
    // Create contract with automatic enterprise ID
    const contractId = await secure.insert("contracts", {
      vendorId: (args as any).vendorId,
      title: (args as any).title.trim(),
      status: "draft",
      contractType: (args as any).contractType,
      storageId: (args as any).storageId,
      fileName: (args as any).fileName,
      fileType: (args as any).fileType,
      analysisStatus: "pending",
      notes: (args as any).notes?.trim(),
      createdAt: new Date().toISOString(),
    }, "contracts.create");
    
    // Update audit log with created resource
    await logAuditEvent(ctx, security, {
      operation: "createContract",
      resourceType: "contracts",
      resourceId: contractId,
      action: "create",
      status: "success",
      metadata: { title: (args as any).title, vendorId: (args as any).vendorId }
    });
    
    return contractId;
  }
);

// Secure contract query with automatic filtering
export const getSecureContracts = createSecureQuery(
  {
    status: v.optional(v.string()),
    contractType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  {
    rateLimit: { operation: "query.default" },
    permission: "contracts.read"
  },
  async (ctx, args, security) => {
    const secureQuery = new SecureQuery(ctx, "contracts", security);
    
    // Build filters
    const filters: Array<(q: any) => any> = [];
    if ((args as any).status) {
      filters.push((q: any) => q.eq(q.field("status"), (args as any).status));
    }
    if ((args as any).contractType) {
      filters.push((q: any) => q.eq(q.field("contractType"), (args as any).contractType));
    }
    
    // Query with automatic enterprise filtering
    const contracts = await secureQuery.where((q: any) => {
      if (filters.length === 0) return true;
      if (filters.length === 1) return filters[0](q);
      return q.and(...filters.map((f: any) => f(q)));
    });
    
    // Apply limit
    const limited = (args as any).limit ? contracts.slice(0, (args as any).limit) : contracts;
    
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
export const updateSecureContract = createSecureMutation(
  v.object({
    contractId: v.id("contracts"),
    updates: v.object({
      title: v.optional(v.string()),
      status: v.optional(v.string()),
      contractType: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
  }),
  {
    rateLimit: { operation: "mutation.update" },
    audit: {
      operation: "updateContract",
      resourceType: "contracts",
      action: "update"
    },
    permission: "contracts.update"
  },
  async (ctx, args, security, secure) => {
    // Get existing contract to track changes
    const existing = await secure.byId("contracts", (args as any).contractId);
    if (!existing) {
      throw new ConvexError("Contract not found");
    }
    
    // Track changes for audit
    const changes: any = {};
    Object.entries((args as any).updates).forEach(([key, value]) => {
      if (value !== undefined && existing[key as keyof typeof existing] !== value) {
        changes[key] = {
          old: existing[key as keyof typeof existing],
          new: value
        };
      }
    });
    
    // Update contract
    await secure.update((args as any).contractId, (args as any).updates, "contracts.update");
    
    // Log with changes
    await logAuditEvent(ctx, security, {
      operation: "updateContract",
      resourceType: "contracts",
      resourceId: (args as any).contractId,
      action: "update",
      changes,
      status: "success",
      metadata: { title: existing.title }
    });
    
    return { success: true };
  }
);

// Secure contract deletion
export const deleteSecureContract = createSecureMutation(
  v.object({
    contractId: v.id("contracts"),
  }),
  {
    rateLimit: { operation: "mutation.delete", cost: 3 },
    audit: {
      operation: "deleteContract",
      resourceType: "contracts",
      action: "delete"
    },
    permission: "contracts.delete"
  },
  async (ctx, args, security, secure) => {
    // Get contract details for audit
    const contract = await secure.byId("contracts", (args as any).contractId);
    if (!contract) {
      throw new ConvexError("Contract not found");
    }
    
    // Delete associated file
    try {
      await ctx.storage.delete(contract.storageId);
    } catch (error) {
      console.warn(`Failed to delete file for contract ${(args as any).contractId}:`, error);
    }
    
    // Delete contract
    await secure.delete((args as any).contractId, "contracts.delete");
    
    // Log deletion with contract details
    await logAuditEvent(ctx, security, {
      operation: "deleteContract",
      resourceType: "contracts",
      resourceId: (args as any).contractId,
      action: "delete",
      status: "success",
      metadata: { 
        title: contract.title,
        vendorId: contract.vendorId,
        value: contract.value || contract.extractedPricing
      }
    });
    
    return { success: true };
  }
);

// Secure bulk export with special auditing
// Note: Changed to mutation since actions require complex authentication setup
export const exportSecureContracts = createSecureMutation(
  v.object({
    format: v.union(v.literal("csv"), v.literal("json"), v.literal("xlsx")),
    filters: v.optional(v.object({
      status: v.optional(v.string()),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
    })),
  }),
  {
    rateLimit: { operation: "mutation.export", cost: 5 },
    audit: {
      operation: "exportContracts",
      resourceType: "contracts",
      action: "export"
    },
    permission: "contracts.export"
  },
  async (ctx, args, security, secure) => {
    // Use SecureQuery to get contracts with proper enterprise filtering
    const secureQuery = new SecureQuery(ctx, "contracts", security);
    let contracts = await secureQuery.all();
    
    // Apply additional filters
    if ((args as any).filters) {
      if ((args as any).filters.status) {
        contracts = contracts.filter((c: any) => c.status === (args as any).filters.status);
      }
      if ((args as any).filters.startDate) {
        contracts = contracts.filter((c: any) => c._creationTime >= new Date((args as any).filters.startDate!).getTime());
      }
      if ((args as any).filters.endDate) {
        contracts = contracts.filter((c: any) => c._creationTime <= new Date((args as any).filters.endDate!).getTime());
      }
    }
    
    // Generate export - initialize with empty string or add default case
    let exportData: string;
    switch ((args as any).format) {
      case "csv":
        exportData = generateCSV(contracts);
        break;
      case "json":
        exportData = JSON.stringify(contracts, null, 2);
        break;
      case "xlsx":
        exportData = generateXLSX(contracts);
        break;
      default:
        // This should never happen due to validation, but TypeScript needs it
        throw new Error(`Unsupported format: ${(args as any).format}`);
    }
    
    // Return download URL (would upload to storage in practice)
    return {
      format: (args as any).format,
      count: contracts.length,
      data: exportData,
      timestamp: new Date().toISOString()
    };
  }
);

// Helper functions for export
function generateCSV(contracts: ContractEntity[]): string {
  const headers = ["Title", "Status", "Type", "Vendor", "Value", "Start Date", "End Date"];
  const rows = contracts.map((c: ContractEntity): string[] => [
    c.title,
    c.status,
    c.contractType || "",
    "", // vendor name would need to be resolved separately
    c.value?.toString() || c.extractedPricing || "",
    c.startDate || c.extractedStartDate || "",
    c.endDate || c.extractedEndDate || ""
  ]);
  
  return [headers, ...rows].map((row: string[]) => row.join(",")).join("\n");
}

function generateXLSX(contracts: ContractEntity[]): string {
  // Simplified - would use actual XLSX library
  return generateCSV(contracts);
}