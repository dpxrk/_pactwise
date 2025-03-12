import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";


// ==== CONTRACT QUERIES ====

// Get all contracts for an enterprise with pagination
export const listContracts = query({
  args: {
    enterpriseId: v.id("enterprises"),
    status: v.optional(v.string()),
    contractType: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { enterpriseId, status, contractType, limit = 10, cursor } = args;
    
    // Build the query step by step
    let contractsQuery = ctx.db
      .query("contracts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
      .order("desc");
      
        
   

    // Apply filters
    if (status) {
      contractsQuery = contractsQuery.filter((q) => q.eq(q.field("status"), status));
    }
    
    if (contractType) {
      contractsQuery = contractsQuery.filter((q) => q.eq(q.field("contractType"), contractType));
    }
    
    // Apply limit and fetch contracts
    const contracts = await contractsQuery.take(limit);
    
    // Fetch related data for each contract
    const contractsWithRelations = await Promise.all(
      contracts.map(async (contract) => {
        const vendor = await ctx.db.get(contract.vendorId);
        const createdBy = await ctx.db.get(contract.createdById);
        
        return {
          ...contract,
          vendor: vendor ? { 
            name: vendor.name, 
            id: vendor._id 
          } : null,
          createdBy: createdBy ? { 
            name: `${createdBy.firstName || ''} ${createdBy.lastName || ''}`.trim(), 
            id: createdBy._id 
          } : null,
        };
      })
    );
    
    return contractsWithRelations;
  },
});

// Get a single contract by ID with all related data
export const getContract = query({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    const contract = await ctx.db.get(args.contractId);
    
    if (!contract) {
      return null;
    }
    
    // Get vendor details
    const vendor = contract.vendorId ? await ctx.db.get(contract.vendorId) : null;
    
    // Get creator details
    const createdBy = contract.createdById ? await ctx.db.get(contract.createdById) : null;
    
    // Get department if it exists
    let department = null;
    if (contract.departmentId) {
      department = await ctx.db.get(contract.departmentId);
    }
    
    // Get template if it exists
    let template = null;
    if (contract.templateId) {
      template = await ctx.db.get(contract.templateId);
    }
    
    // Get contract revisions
    const revisions = await ctx.db
      .query("contractRevisions")
      .withIndex("by_contract", (q) => q.eq("contractId", contract._id))
      .collect();
    
    // Get signatures
    const signatures = await ctx.db
      .query("signatures")
      .withIndex("by_contract", (q) => q.eq("contractId", contract._id))
      .collect();
    
    // Get approvers
    const approvers = await ctx.db
      .query("contractApprovers")
      .withIndex("by_contract", (q) => q.eq("contractId", contract._id))
      .collect();
    
    // Get approver user details
    const approverDetails = await Promise.all(
      approvers.map(async (approver) => {
        const user = approver.userId ? await ctx.db.get(approver.userId) : null;
        return {
          ...approver,
          user: user ? {
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            email: user.email,
            id: user._id,
          } : null,
        };
      })
    );
    
    return {
      ...contract,
      vendor,
      createdBy: createdBy ? {
        name: `${createdBy.firstName || ''} ${createdBy.lastName || ''}`.trim(),
        email: createdBy.email,
        id: createdBy._id,
      } : null,
      department,
      template,
      revisions,
      signatures,
      approvers: approverDetails,
    };
  },
});

// Get expiring contracts
export const getExpiringContracts = query({
  args: {
    enterpriseId: v.id("enterprises"),
    daysThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { enterpriseId, daysThreshold = 30 } = args;
    
    // Calculate the date threshold
    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(now.getDate() + daysThreshold);
    
    const thresholdISOString = thresholdDate.toISOString();
    
    // Query contracts that are expiring soon
    const expiringContracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
      .filter((q) => 
        q.and(
          q.gt(q.field("expiresAt"), now.toISOString()),
          q.lt(q.field("expiresAt"), thresholdISOString),
          q.neq(q.field("status"), "terminated"),
          q.neq(q.field("status"), "cancelled"),
          q.neq(q.field("status"), "expired")
        )
      )
      .collect();
    
    // Fetch vendors for the contracts
    const contractsWithVendors = await Promise.all(
      expiringContracts.map(async (contract) => {
        const vendor = contract.vendorId ? await ctx.db.get(contract.vendorId) : null;
        return {
          ...contract,
          vendor: vendor ? { name: vendor.name, id: vendor._id } : null,
        };
      })
    );
    
    return contractsWithVendors;
  },
});

// Get contract analytics
export const getContractAnalytics = query({
  args: { enterpriseId: v.id("enterprises") },
  handler: async (ctx, args) => {
    const { enterpriseId } = args;
    
    // Get all contracts for the enterprise
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
      .collect();
    
    // Get contract counts by status
    const statusCounts = contracts.reduce((acc: Record<string, number>, contract) => {
      acc[contract.status] = (acc[contract.status] || 0) + 1;
      return acc;
    }, {});
    
    // Get contract counts by type
    const typeCounts = contracts.reduce((acc: Record<string, number>, contract) => {
      acc[contract.contractType] = (acc[contract.contractType] || 0) + 1;
      return acc;
    }, {});
    
    // Calculate total value by currency
    const valueByRrency = contracts.reduce((acc: Record<string, number>, contract) => {
      if (contract.value && contract.currency) {
        acc[contract.currency] = (acc[contract.currency] || 0) + contract.value;
      }
      return acc;
    }, {});
    
    // Calculate expiring soon contracts
    const now = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(now.getDate() + 30);
    
    const expiringSoon = contracts.filter(contract => {
      if (!contract.expiresAt) return false;
      
      const expiryDate = new Date(contract.expiresAt);
      return expiryDate > now && expiryDate < thirtyDaysLater;
    }).length;
    
    // Calculate average time metrics
    let totalTimeToSign = 0;
    let timeToSignCount = 0;
    let totalTimeToApprove = 0;
    let timeToApproveCount = 0;
    
    contracts.forEach(contract => {
      if (contract.timeToSign) {
        totalTimeToSign += contract.timeToSign;
        timeToSignCount++;
      }
      
      if (contract.timeToApprove) {
        totalTimeToApprove += contract.timeToApprove;
        timeToApproveCount++;
      }
    });
    
    const avgTimeToSign = timeToSignCount > 0 ? totalTimeToSign / timeToSignCount : 0;
    const avgTimeToApprove = timeToApproveCount > 0 ? totalTimeToApprove / timeToApproveCount : 0;
    
    return {
      totalContracts: contracts.length,
      statusCounts,
      typeCounts,
      valueByRrency,
      expiringSoon,
      avgTimeToSign,
      avgTimeToApprove,
    };
  },
});

// ==== CONTRACT MUTATIONS ====

// Create a new contract
export const createContract = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    contractType: v.string(),
    vendorId: v.id("vendors"),
    enterpriseId: v.id("enterprises"),
    departmentId: v.optional(v.id("departments")),
    templateId: v.optional(v.id("templates")),
    effectiveDate: v.optional(v.string()),
    expiresAt: v.optional(v.string()),
    autoRenewal: v.optional(v.boolean()),
    currency: v.optional(v.string()),
    value: v.optional(v.number()),
    customFields: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
   
    const identity = await ctx.auth.getUserIdentity();
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
    
    // Generate a contract number
    const contractNumber = generateContractNumber();
    
    // Default values
    const now = new Date().toISOString();
    
    const contractId = await ctx.db.insert("contracts", {
      title: args.title,
      description: args.description || "",
      contractNumber,
      status: "draft", // Initial status
      contractType: args.contractType,
      enterpriseId: args.enterpriseId,
      vendorId: args.vendorId,
      departmentId: args.departmentId,
      templateId: args.templateId,
      createdById: user._id,
      effectiveDate: args.effectiveDate,
      expiresAt: args.expiresAt,
      autoRenewal: args.autoRenewal || false,
      currency: args.currency || "USD",
      value: args.value,
      customFields: args.customFields,
      isPublic: false,
      watermark: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      modificationCount: 0,
      approvalReminderSent: false,
    });
    
    // Create initial contract revision
    await ctx.db.insert("contractRevisions", {
      contractId,
      version: 1,
      changesSummary: "Initial version",
      createdById: user._id,
      createdAt: now,
    });
    
    // Log contract creation in user activity
    await ctx.db.insert("userActivityLog", {
      userId: user._id,
      action: "create_contract",
      resourceType: "contract",
      resourceId: contractId,
      details: { contractTitle: args.title, contractType: args.contractType },
      timestamp: now,
    });
    
    return contractId;
  },
});

// Update a contract
export const updateContract = mutation({
  args: {
    contractId: v.id("contracts"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    contractType: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
    effectiveDate: v.optional(v.string()),
    expiresAt: v.optional(v.string()),
    autoRenewal: v.optional(v.boolean()),
    currency: v.optional(v.string()),
    value: v.optional(v.number()),
    customFields: v.optional(v.any()),
    notes: v.optional(v.string()),
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
    
    // Get the existing contract
    const contract = await ctx.db.get(args.contractId);
    if (!contract) {
      throw new Error("Contract not found");
    }
    
    // Create update object with only the fields being changed
    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(args)) {
      if (key !== "contractId" && value !== undefined) {
        updates[key] = value;
      }
    }
    
    // Add updated timestamp
    updates.updatedAt = new Date().toISOString();
    
    // Increment modification count
    updates.modificationCount = (contract.modificationCount || 0) + 1;
    
    // Update the contract
    await ctx.db.patch(args.contractId, updates);
    
    // Create a new revision if significant fields changed
    const significantFieldsChanged = ["title", "description", "status", "contractType", 
      "effectiveDate", "expiresAt", "value"].some(field => field in updates);
    
    if (significantFieldsChanged) {
      await ctx.db.insert("contractRevisions", {
        contractId: args.contractId,
        version: (contract.version || 1) + 1,
        changesSummary: `Updated contract details`,
        modifiedSections: Object.keys(updates),
        createdById: user._id,
        createdAt: updates.updatedAt,
      });
      
      // Update the contract version
      await ctx.db.patch(args.contractId, {
        version: (contract.version || 1) + 1,
      });
    }
    
    // Log contract update in user activity
    await ctx.db.insert("userActivityLog", {
      userId: user._id,
      action: "update_contract",
      resourceType: "contract",
      resourceId: args.contractId,
      details: { updatedFields: Object.keys(updates) },
      timestamp: updates.updatedAt,
    });
    
    return args.contractId;
  },
});

// Add an approver to a contract
export const addContractApprover = mutation({
  args: {
    contractId: v.id("contracts"),
    userId: v.id("users"),
    approvalStep: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { contractId, userId, approvalStep = 1 } = args;
    
    // Check if this approver is already assigned to this contract
    const existingApprover = await ctx.db
      .query("contractApprovers")
      .withIndex("by_contract", (q) => q.eq("contractId", contractId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
    
    if (existingApprover) {
      throw new Error("User is already an approver for this contract");
    }
    
    const now = new Date().toISOString();
    
    // Add the approver
    const approverId = await ctx.db.insert("contractApprovers", {
      contractId,
      userId,
      approvalStatus: "pending",
      approvalStep,
      reminderSent: false,
      reminderCount: 0,
      createdAt: now,
    });
    
    // Update the contract to reflect the approval chain
    const contract = await ctx.db.get(contractId);
    if (contract) {
      // Get all approvers for this contract
      const approvers = await ctx.db
        .query("contractApprovers")
        .withIndex("by_contract", (q) => q.eq("contractId", contractId))
        .collect();
      
      // Update the contract's approval chain
      const approvalChain = approvers.map(a => ({
        userId: a.userId,
        step: a.approvalStep,
        status: a.approvalStatus,
      }));
      
      await ctx.db.patch(contractId, {
        approvalChain,
        updatedAt: now,
      });
      
      // Send notification to the approver
      await ctx.db.insert("userNotifications", {
        userId,
        type: "approval_request",
        title: "Contract Approval Request",
        message: `You have been requested to approve the contract: ${contract.title}`,
        linkUrl: `/contracts/${contractId}`,
        isRead: false,
        createdAt: now,
      });
    }
    
    return approverId;
  },
});

// Approve or reject a contract
export const respondToApproval = mutation({
  args: {
    contractId: v.id("contracts"),
    approved: v.boolean(),
    comments: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { contractId, approved, comments } = args;
    const identity = await ctx.auth.getUserIdentity();
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
    
    // Find this user's approver record
    const approver = await ctx.db
      .query("contractApprovers")
      .withIndex("by_contract", (q) => q.eq("contractId", contractId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();
    
    if (!approver) {
      throw new Error("You are not an approver for this contract");
    }
    
    if (approver.approvalStatus !== "pending") {
      throw new Error("You have already responded to this approval request");
    }
    
    const now = new Date().toISOString();
    
    // Update the approver record
    const updateFields: Record<string, any> = {
      approvalStatus: approved ? "approved" : "rejected",
      comments: comments || "",
    };
    
    if (approved) {
      updateFields.approvedAt = now;
    } else {
      updateFields.rejectedAt = now;
    }
    
    await ctx.db.patch(approver._id, updateFields);
    
    // Get the contract
    const contract = await ctx.db.get(contractId);
    
    // Update the contract status and approvalChain
    if (contract) {
      // Get all approvers to check overall status
      const approvers = await ctx.db
        .query("contractApprovers")
        .withIndex("by_contract", (q) => q.eq("contractId", contractId))
        .collect();
      
      // Update approval chain
      const approvalChain = approvers.map(a => ({
        userId: a.userId,
        step: a.approvalStep,
        status: a.approvalStatus,
      }));
      
      const updates: Record<string, any> = {
        approvalChain,
        updatedAt: now,
      };
      
      // If rejected, update contract status
      if (!approved) {
        updates.status = "pending_review";
      } else {
        // Check if all approvers have approved
        const allApproved = approvers.every(a => a.approvalStatus === "approved");
        
        if (allApproved) {
          updates.status = "approved";
          updates.approvedAt = now;
          
          // Calculate time to approve
          if (contract.createdAt) {
            const createdDate = new Date(contract.createdAt);
            const approvedDate = new Date(now);
            const timeToApprove = Math.floor((approvedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)); // Days
            updates.timeToApprove = timeToApprove;
          }
        }
      }
      
      await ctx.db.patch(contractId, updates);
      
      // Notify the contract creator
      if (contract.createdById) {
        await ctx.db.insert("userNotifications", {
          userId: contract.createdById,
          type: approved ? "contract_approved" : "contract_rejected",
          title: approved ? "Contract Approved" : "Contract Rejected",
          message: approved 
            ? `${user.firstName || ''} ${user.lastName || ''} has approved the contract: ${contract.title}`
            : `${user.firstName || ''} ${user.lastName || ''} has rejected the contract: ${contract.title}`,
          linkUrl: `/contracts/${contractId}`,
          isRead: false,
          metadata: { comments },
          createdAt: now,
        });
      }
    }
    
    return {
      success: true,
      status: approved ? "approved" : "rejected",
    };
  },
});

// ==== SIGNATURE QUERIES & MUTATIONS ====

export const getContractSignatures = query({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    const signatures = await ctx.db
      .query("signatures")
      .withIndex("by_contract", (q) => q.eq("contractId", args.contractId))
      .collect();
    
    // Get user details for each signature where available
    const signaturesWithUsers = await Promise.all(
      signatures.map(async (signature) => {
        let user = null;
        if (signature.userId) {
          user = await ctx.db.get(signature.userId);
        }
        
        return {
          ...signature,
          user: user ? {
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            email: user.email,
            id: user._id,
          } : null,
        };
      })
    );
    
    return signaturesWithUsers;
  },
});

export const addSignatureRequest = mutation({
  args: {
    contractId: v.id("contracts"),
    signerEmail: v.string(),
    signerName: v.string(),
    signerTitle: v.optional(v.string()),
    sequence: v.optional(v.number()),
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
    
    // Get the contract
    const contract = await ctx.db.get(args.contractId);
    if (!contract) {
      throw new Error("Contract not found");
    }
    
    // Check if contract is in a signable state
    if (contract.status !== "approved" && contract.status !== "pending_signature") {
      throw new Error("Contract must be approved before requesting signatures");
    }
    
    // Check if this email already has a signature request
    const existingSignature = await ctx.db
      .query("signatures")
      .withIndex("by_contract", (q) => q.eq("contractId", args.contractId))
      .filter((q) => q.eq(q.field("signerEmail"), args.signerEmail))
      .first();
    
    if (existingSignature) {
      throw new Error("A signature request already exists for this email");
    }
    
    const now = new Date().toISOString();
    
    // If no sequence provided, put at the end
    let sequence = args.sequence;
    if (sequence === undefined) {
      const highestSequence = await ctx.db
        .query("signatures")
        .withIndex("by_contract", (q) => q.eq("contractId", args.contractId))
        .collect()
        .then(signatures => 
          signatures.reduce((max, sig) => Math.max(max, sig.sequence || 0), 0)
        );
      
      sequence = highestSequence + 1;
    }
    
    // Create a signature request
    const signatureId = await ctx.db.insert("signatures", {
      contractId: args.contractId,
      signerEmail: args.signerEmail,
      signerName: args.signerName,
      signerTitle: args.signerTitle || "",
      signatureType: "electronic",
      status: "pending",
      sequence,
      reminderCount: 0,
      createdAt: now,
    });
    
    // Update contract status if needed
    if (contract.status !== "pending_signature") {
      await ctx.db.patch(args.contractId, {
        status: "pending_signature",
        updatedAt: now,
      });
    }
    
    // Log signature request
    await ctx.db.insert("userActivityLog", {
      userId: user._id,
      action: "request_signature",
      resourceType: "contract",
      resourceId: args.contractId,
      details: { signerEmail: args.signerEmail, signerName: args.signerName },
      timestamp: now,
    });
    
    return signatureId;
  },
});

export const submitSignature = mutation({
  args: {
    contractId: v.id("contracts"),
    signerEmail: v.string(),
    signatureData: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the signature request
    const signatureRequest = await ctx.db
      .query("signatures")
      .withIndex("by_contract", (q) => q.eq("contractId", args.contractId))
      .filter((q) => q.eq(q.field("signerEmail"), args.signerEmail))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
    
    if (!signatureRequest) {
      throw new Error("No pending signature request found for this email");
    }
    
    const now = new Date().toISOString();
    
    // Update the signature
    await ctx.db.patch(signatureRequest._id, {
      signatureData: args.signatureData,
      signedAt: now,
      status: "completed",
      //@ts-ignore
      ipAddress: ctx.request?.headers?.get("x-forwarded-for") || "unknown",
    });
    
    // Get the contract
    const contract = await ctx.db.get(args.contractId);
    
    // Check if all signatures are complete
    const pendingSignatures = await ctx.db
      .query("signatures")
      .withIndex("by_contract", (q) => q.eq("contractId", args.contractId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
    
    // If no pending signatures remain, update contract status
    if (!pendingSignatures && contract) {
      const updates: Record<string, any> = {
        status: "signed",
        signatureCompletedAt: now,
        updatedAt: now,
      };
      
      // Calculate time to sign if possible
      if (contract.status === "pending_signature" && contract.updatedAt) {
        const startDate = new Date(contract.updatedAt);
        const endDate = new Date(now);
        const timeToSign = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)); // Days
        updates.timeToSign = timeToSign;
      }
      
      await ctx.db.patch(args.contractId, updates);
    }
    
    return {
      success: true,
      allSignaturesComplete: !pendingSignatures,
    };
  },
});

// ==== SEARCH ====

export const searchContracts = query({
  args: {
    enterpriseId: v.id("enterprises"),
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { enterpriseId, searchTerm, limit = 20 } = args;
    
    // Normalize search term for case-insensitive search
    const normalizedTerm = searchTerm.toLowerCase().trim();
    
    // Get all contracts for the enterprise
    const allContracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
      .collect();
    
    // Filter contracts based on search term
    const matchingContracts = allContracts.filter(contract => 
      (contract.title && contract.title.toLowerCase().includes(normalizedTerm)) ||
      (contract.description && contract.description.toLowerCase().includes(normalizedTerm)) ||
      (contract.contractNumber && contract.contractNumber.toLowerCase().includes(normalizedTerm))
    ).slice(0, limit);
    
    // Get vendor details for matching contracts
    const contractsWithDetails = await Promise.all(
      matchingContracts.map(async (contract) => {
        const vendor = contract.vendorId ? await ctx.db.get(contract.vendorId) : null;
        return {
          ...contract,
          vendor: vendor ? { name: vendor.name, id: vendor._id } : null,
        };
      })
    );
    
    return contractsWithDetails;
  },
});

// Helper function to generate a contract number
function generateContractNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().substr(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  return `CTR-${year}${month}-${randomPart}`;
}