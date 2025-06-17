import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { AgentTask } from "../agent_types";

// Vendor matching threshold for fuzzy matching
const MATCH_THRESHOLD = 0.85;

// Helper function to normalize vendor names for comparison
function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\b(inc|incorporated|llc|ltd|limited|corp|corporation|company|co)\b/g, "")
    .trim();
}

// Calculate similarity between two strings (Jaro-Winkler distance)
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0 || len2 === 0) return 0;
  
  const maxDist = Math.floor(Math.max(len1, len2) / 2) - 1;
  let matches = 0;
  let transpositions = 0;
  
  const str1Matches = new Array(len1).fill(false);
  const str2Matches = new Array(len2).fill(false);
  
  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - maxDist);
    const end = Math.min(i + maxDist + 1, len2);
    
    for (let j = start; j < end; j++) {
      if (str2Matches[j] || str1[i] !== str2[j]) continue;
      str1Matches[i] = true;
      str2Matches[j] = true;
      matches++;
      break;
    }
  }
  
  if (matches === 0) return 0;
  
  // Count transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!str1Matches[i]) continue;
    while (!str2Matches[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }
  
  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  
  // Jaro-Winkler modification
  let prefixLen = 0;
  for (let i = 0; i < Math.min(len1, len2, 4); i++) {
    if (str1[i] === str2[i]) prefixLen++;
    else break;
  }
  
  return jaro + prefixLen * 0.1 * (1 - jaro);
}

// Find matching vendor by name
const findMatchingVendor = async (
  ctx: any,
  args: {
    enterpriseId: Id<"enterprises">;
    vendorName: string;
    extractedAddress?: string | undefined;
  }
) => {
    const normalizedSearchName = normalizeVendorName(args.vendorName);
    
    // Get all vendors for the enterprise
    const vendors = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q: any) => q.eq("enterpriseId", args.enterpriseId))
      .collect();
    
    let bestMatch: typeof vendors[0] | null = null;
    let bestScore = 0;
    
    for (const vendor of vendors) {
      const normalizedVendorName = normalizeVendorName(vendor.name);
      const similarity = calculateSimilarity(normalizedSearchName, normalizedVendorName);
      
      if (similarity > bestScore && similarity >= MATCH_THRESHOLD) {
        bestScore = similarity;
        bestMatch = vendor;
      }
    }
    
    return {
      matchFound: bestMatch !== null,
      vendor: bestMatch,
      matchScore: bestScore,
    };
};

// Create new vendor from extracted data
const createVendorFromContract = async (
  ctx: any,
  args: {
    enterpriseId: Id<"enterprises">;
    vendorName: string;
    extractedAddress?: string | undefined;
    contractId: Id<"contracts">;
  }
) => {
    // Check if vendor already exists (defensive check)
    const existingMatch = await findMatchingVendor(ctx, {
      enterpriseId: args.enterpriseId,
      vendorName: args.vendorName,
      extractedAddress: args.extractedAddress,
    });
    
    if (existingMatch.matchFound && existingMatch.vendor) {
      return existingMatch.vendor._id;
    }
    
    // Create new vendor
    const vendorId = await ctx.db.insert("vendors", {
      enterpriseId: args.enterpriseId,
      name: args.vendorName,
      category: "other" as const,
      status: "active" as const,
      createdBy: "system",
      updatedAt: Date.now(),
      address: args.extractedAddress,
      notes: `Auto-created from contract ${args.contractId}`,
      metadata: {
        source: "vendor_agent",
        contractId: args.contractId,
        createdAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    });
    
    // Activity logs can be added later if the table exists
    
    return vendorId;
};

// Process contracts without vendors
export const processUnassignedContracts = internalMutation({
  args: {
    taskId: v.id("agentTasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    
    // Update task status
    await ctx.db.patch(args.taskId, {
      status: "in_progress",
    });
    
    try {
      const enterpriseId = (task as any).metadata?.enterpriseId as Id<"enterprises">;
      if (!enterpriseId) throw new Error("Enterprise ID not found in task metadata");
      
      // Find contracts with extracted parties but no vendor
      const contracts = await ctx.db
        .query("contracts")
        .withIndex("by_enterprise", (q: any) => q.eq("enterpriseId", enterpriseId))
        .filter((q) => 
          q.and(
            q.neq(q.field("extractedParties"), undefined),
            q.or(
              q.eq(q.field("vendorId"), undefined),
              q.eq(q.field("vendorId"), null)
            )
          )
        )
        .collect();
      
      let processedCount = 0;
      let vendorsCreated = 0;
      let vendorsMatched = 0;
      
      for (const contract of contracts) {
        if (!contract.extractedParties || contract.extractedParties.length === 0) continue;
        
        // Process first extracted party as primary vendor
        const primaryVendorName = contract.extractedParties[0];
        if (!primaryVendorName) continue;
        
        // Try to find matching vendor
        const match = await findMatchingVendor(ctx, {
          enterpriseId,
          vendorName: primaryVendorName,
          extractedAddress: contract.extractedAddress ? contract.extractedAddress : undefined,
        });
        
        let vendorId: Id<"vendors">;
        
        if (match.matchFound && match.vendor) {
          vendorId = match.vendor._id;
          vendorsMatched++;
        } else {
          // Create new vendor
          vendorId = await createVendorFromContract(ctx, {
            enterpriseId,
            vendorName: primaryVendorName,
            extractedAddress: contract.extractedAddress ? contract.extractedAddress : undefined,
            contractId: contract._id,
          });
          vendorsCreated++;
        }
        
        // Update contract with vendor ID
        await ctx.db.patch(contract._id, {
          vendorId,
          updatedAt: Date.now(),
        });
        
        processedCount++;
      }
      
      // Create insight about vendor processing
      // Get vendor agent for agentId
      const vendorAgent = await ctx.db.query("agents").withIndex("by_type", (q: any) => q.eq("type", "vendor")).first();
      if (vendorAgent) {
        await ctx.db.insert("agentInsights", {
          agentId: vendorAgent._id,
          type: "vendor_assignment" as const,
          title: "Vendor Assignment Completed",
          description: `Processed ${processedCount} contracts: ${vendorsCreated} new vendors created, ${vendorsMatched} existing vendors matched`,
          priority: "low" as const,
          actionRequired: false,
          actionTaken: true,
          isRead: false,
          data: {
            processedCount,
            vendorsCreated,
            vendorsMatched,
            taskId: args.taskId,
          },
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
      
      // Update task as completed
      await ctx.db.patch(args.taskId, {
        status: "completed",
        result: {
          success: true,
          output: {
            processedCount: processedCount.toString(),
            vendorsCreated: vendorsCreated.toString(),
            vendorsMatched: vendorsMatched.toString(),
          },
        },
        completedAt: new Date().toISOString(),
      });
      
    } catch (error) {
      // Update task as failed
      await ctx.db.patch(args.taskId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      
      throw error;
    }
  },
});

// Check for duplicate vendors
const checkDuplicateVendors = async (
  ctx: any,
  args: {
    enterpriseId: Id<"enterprises">;
  }
) => {
    const vendors = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q: any) => q.eq("enterpriseId", args.enterpriseId))
      .collect();
    
    const duplicates: Array<{
      vendor1: typeof vendors[0];
      vendor2: typeof vendors[0];
      similarity: number;
    }> = [];
    
    // Compare each vendor with others
    for (let i = 0; i < vendors.length; i++) {
      for (let j = i + 1; j < vendors.length; j++) {
        const norm1 = normalizeVendorName(vendors[i].name);
        const norm2 = normalizeVendorName(vendors[j].name);
        const similarity = calculateSimilarity(norm1, norm2);
        
        if (similarity >= MATCH_THRESHOLD) {
          duplicates.push({
            vendor1: vendors[i],
            vendor2: vendors[j],
            similarity,
          });
        }
      }
    }
    
    return duplicates;
};

// Merge duplicate vendors
export const mergeDuplicateVendors = internalMutation({
  args: {
    enterpriseId: v.id("enterprises"),
    primaryVendorId: v.id("vendors"),
    duplicateVendorId: v.id("vendors"),
  },
  handler: async (ctx, args) => {
    // Update all contracts from duplicate vendor to primary vendor
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_vendorId_and_enterpriseId", (q) => 
        q.eq("enterpriseId", args.enterpriseId).eq("vendorId", args.duplicateVendorId)
      )
      .collect();
    
    for (const contract of contracts) {
      await ctx.db.patch(contract._id, {
        vendorId: args.primaryVendorId,
        updatedAt: Date.now(),
      });
    }
    
    // Mark duplicate vendor as inactive
    await ctx.db.patch(args.duplicateVendorId, {
      status: "inactive" as const,
      notes: `Merged into vendor ${args.primaryVendorId}`,
      updatedAt: Date.now(),
    });
    
    // Activity logs can be added later if the table exists
    
    return {
      contractsUpdated: contracts.length,
    };
  },
});

// Run vendor agent - called by manager
export const runVendorAgent = internalMutation({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    // Get the vendor agent
    const vendorAgent = await ctx.db.query("agents").withIndex("by_type", (q: any) => q.eq("type", "vendor")).first();
    if (!vendorAgent) throw new Error("Vendor agent not found");
    
    // Create a task for processing unassigned contracts
    const taskId = await ctx.db.insert("agentTasks", {
      assignedAgentId: vendorAgent._id,
      taskType: "vendor_assignment",
      status: "pending",
      priority: "medium" as const,
      title: "Process Unassigned Contracts",
      data: {
        context: {
          triggerType: "scheduled",
          triggerSource: "manager_agent",
          relatedEntities: [{
            type: "enterprise",
            id: args.enterpriseId,
          }],
        },
      },
      createdAt: new Date().toISOString(),
    });
    
    // Process the task inline since we can't call internal mutations
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    
    // Update task status
    await ctx.db.patch(taskId, {
      status: "in_progress",
    });
    
    try {
      const enterpriseId = args.enterpriseId;
      
      // Find contracts with extracted parties but no vendor
      const contracts = await ctx.db
        .query("contracts")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
        .filter((q) => 
          q.and(
            q.neq(q.field("extractedParties"), undefined),
            q.or(
              q.eq(q.field("vendorId"), undefined),
              q.eq(q.field("vendorId"), null)
            )
          )
        )
        .collect();
      
      let processedCount = 0;
      let vendorsCreated = 0;
      let vendorsMatched = 0;
      
      for (const contract of contracts) {
        if (!contract.extractedParties || contract.extractedParties.length === 0) continue;
        
        // Process first extracted party as primary vendor
        const primaryVendorName = contract.extractedParties[0];
        if (!primaryVendorName) continue;
        
        // Try to find matching vendor
        const match = await findMatchingVendor(ctx, {
          enterpriseId,
          vendorName: primaryVendorName,
          extractedAddress: contract.extractedAddress ? contract.extractedAddress : undefined,
        });
        
        let vendorId: Id<"vendors">;
        
        if (match.matchFound && match.vendor) {
          vendorId = match.vendor._id;
          vendorsMatched++;
        } else {
          // Create new vendor
          vendorId = await createVendorFromContract(ctx, {
            enterpriseId,
            vendorName: primaryVendorName,
            extractedAddress: contract.extractedAddress ? contract.extractedAddress : undefined,
            contractId: contract._id,
          });
          vendorsCreated++;
        }
        
        // Update contract with vendor ID
        await ctx.db.patch(contract._id, {
          vendorId,
          updatedAt: Date.now(),
        });
        
        processedCount++;
      }
      
      // Create insight about vendor processing
      await ctx.db.insert("agentInsights", {
        agentId: vendorAgent._id,
        type: "vendor_assignment" as const,
        title: "Vendor Assignment Completed",
        description: `Processed ${processedCount} contracts: ${vendorsCreated} new vendors created, ${vendorsMatched} existing vendors matched`,
        priority: "low" as const,
        actionRequired: false,
        actionTaken: true,
        isRead: false,
        data: {
          processedCount,
          vendorsCreated,
          vendorsMatched,
          taskId,
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      
      // Update task as completed
      await ctx.db.patch(taskId, {
        status: "completed",
        result: {
          success: true,
          output: {
            processedCount: processedCount.toString(),
            vendorsCreated: vendorsCreated.toString(),
            vendorsMatched: vendorsMatched.toString(),
          },
        },
        completedAt: new Date().toISOString(),
      });
      
    } catch (error) {
      // Update task as failed
      await ctx.db.patch(taskId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      
      throw error;
    }
    
    // Check for duplicates
    const duplicates = await checkDuplicateVendors(ctx, { enterpriseId: args.enterpriseId });
    
    if (duplicates.length > 0) {
      // Create insight about potential duplicates
      await ctx.db.insert("agentInsights", {
        agentId: vendorAgent._id,
        type: "duplicate_vendors" as const,
        title: "Potential Duplicate Vendors Detected",
        description: `Found ${duplicates.length} potential duplicate vendor pairs that may need merging`,
        priority: "medium" as const,
        actionRequired: true,
        actionTaken: false,
        isRead: false,
        data: {
          duplicateCount: duplicates.length,
          duplicates: duplicates.map(d => ({
            vendor1: { id: d.vendor1._id, name: d.vendor1.name },
            vendor2: { id: d.vendor2._id, name: d.vendor2.name },
            similarity: d.similarity,
          })),
        },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    
    return {
      taskId,
      duplicatesFound: duplicates.length,
    };
  },
});