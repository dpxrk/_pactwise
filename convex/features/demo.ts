import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";

// Demo vendor data
const DEMO_VENDORS = [
  // Technology
  { name: "CloudTech Solutions", category: "technology", contact: { name: "Sarah Chen", email: "sarah@cloudtech.com", phone: "+1-555-0101" } },
  { name: "DataStream Analytics", category: "technology", contact: { name: "Mike Johnson", email: "mike@datastream.com", phone: "+1-555-0102" } },
  { name: "SecureNet Systems", category: "technology", contact: { name: "Lisa Wang", email: "lisa@securenet.com", phone: "+1-555-0103" } },
  { name: "AI Innovations Inc", category: "technology", contact: { name: "David Kim", email: "david@aiinnovations.com", phone: "+1-555-0104" } },
  { name: "DevOps Masters", category: "technology", contact: { name: "Tom Brown", email: "tom@devopsmasters.com", phone: "+1-555-0105" } },
  
  // Legal
  { name: "Smith & Associates Law Firm", category: "legal", contact: { name: "Jennifer Smith", email: "jsmith@smithlaw.com", phone: "+1-555-0201" } },
  { name: "Corporate Legal Solutions", category: "legal", contact: { name: "Robert Jones", email: "rjones@corplegalsol.com", phone: "+1-555-0202" } },
  { name: "Intellectual Property Experts", category: "legal", contact: { name: "Patricia Lee", email: "plee@ipexperts.com", phone: "+1-555-0203" } },
  
  // Finance
  { name: "Financial Advisory Group", category: "finance", contact: { name: "Mark Thompson", email: "mthompson@finadvgroup.com", phone: "+1-555-0301" } },
  { name: "Tax Consultants Plus", category: "finance", contact: { name: "Emily Davis", email: "edavis@taxconsult.com", phone: "+1-555-0302" } },
  { name: "Audit & Compliance Corp", category: "finance", contact: { name: "James Wilson", email: "jwilson@auditcorp.com", phone: "+1-555-0303" } },
  
  // Marketing
  { name: "Creative Marketing Agency", category: "marketing", contact: { name: "Amanda Garcia", email: "agarcia@creativeagency.com", phone: "+1-555-0401" } },
  { name: "Digital Reach Marketing", category: "marketing", contact: { name: "Chris Martinez", email: "cmartinez@digitalreach.com", phone: "+1-555-0402" } },
  { name: "Brand Strategy Partners", category: "marketing", contact: { name: "Nicole Anderson", email: "nanderson@brandstrategy.com", phone: "+1-555-0403" } },
  
  // HR
  { name: "Talent Acquisition Pros", category: "hr", contact: { name: "Rachel Green", email: "rgreen@talentpros.com", phone: "+1-555-0501" } },
  { name: "HR Solutions International", category: "hr", contact: { name: "Brian Taylor", email: "btaylor@hrsolutions.com", phone: "+1-555-0502" } },
  { name: "Employee Benefits Advisors", category: "hr", contact: { name: "Karen White", email: "kwhite@benefitsadv.com", phone: "+1-555-0503" } },
  
  // Facilities
  { name: "Office Space Management", category: "facilities", contact: { name: "Steve Miller", email: "smiller@officespacemgmt.com", phone: "+1-555-0601" } },
  { name: "Facility Maintenance Corp", category: "facilities", contact: { name: "Linda Brown", email: "lbrown@facilitymaint.com", phone: "+1-555-0602" } },
  
  // Logistics
  { name: "Global Shipping Solutions", category: "logistics", contact: { name: "Carlos Rodriguez", email: "crodriguez@globalship.com", phone: "+1-555-0701" } },
  { name: "Supply Chain Experts", category: "logistics", contact: { name: "Maria Lopez", email: "mlopez@supplychain.com", phone: "+1-555-0702" } },
  
  // Manufacturing
  { name: "Precision Manufacturing Ltd", category: "manufacturing", contact: { name: "John Park", email: "jpark@precisionmfg.com", phone: "+1-555-0801" } },
  { name: "Industrial Components Inc", category: "manufacturing", contact: { name: "Susan Chang", email: "schang@indcomponents.com", phone: "+1-555-0802" } },
  
  // Consulting
  { name: "Strategic Business Consultants", category: "consulting", contact: { name: "William Foster", email: "wfoster@stratconsult.com", phone: "+1-555-0901" } },
  { name: "Management Advisory Services", category: "consulting", contact: { name: "Laura Bennett", email: "lbennett@mgmtadvisory.com", phone: "+1-555-0902" } },
];

// Demo contract templates
const CONTRACT_TEMPLATES = [
  { type: "saas", title: "Software as a Service Agreement", baseValue: 50000, duration: 12 },
  { type: "msa", title: "Master Service Agreement", baseValue: 100000, duration: 24 },
  { type: "sow", title: "Statement of Work", baseValue: 25000, duration: 6 },
  { type: "nda", title: "Non-Disclosure Agreement", baseValue: 0, duration: 36 },
  { type: "other", title: "Consulting Services Agreement", baseValue: 75000, duration: 12 },
  { type: "other", title: "Technical Support Agreement", baseValue: 30000, duration: 12 },
  { type: "other", title: "Software License Agreement", baseValue: 40000, duration: 12 },
  { type: "other", title: "Marketing Services Agreement", baseValue: 60000, duration: 9 },
  { type: "employment", title: "Employment Agreement", baseValue: 120000, duration: 24 },
  { type: "other", title: "Independent Contractor Agreement", baseValue: 80000, duration: 12 },
];

/**
 * Check if demo data exists
 */
export const checkDemoDataExists = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    // Get all vendors for this enterprise that are marked as demo
    const demoVendors = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .filter((q) => q.eq(q.field("isDemo"), true))
      .collect();

    // Get all contracts for this enterprise that are marked as demo
    const demoContracts = await ctx.db
      .query("contracts")
      .withIndex("by_status_and_enterpriseId", (q) => 
        q.eq("enterpriseId", args.enterpriseId)
      )
      .filter((q) => q.eq(q.field("isDemo"), true))
      .collect();

    return {
      hasExistingDemoData: demoVendors.length > 0 || demoContracts.length > 0,
      existingDemoVendors: demoVendors.length,
      existingDemoContracts: demoContracts.length,
    };
  },
});

/**
 * Get demo data statistics
 */
export const getDemoDataStats = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    const demoVendors = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .filter((q) => q.eq(q.field("isDemo"), true))
      .collect();

    const demoContracts = await ctx.db
      .query("contracts")
      .withIndex("by_status_and_enterpriseId", (q) => 
        q.eq("enterpriseId", args.enterpriseId)
      )
      .filter((q) => q.eq(q.field("isDemo"), true))
      .collect();

    const matchedContracts = demoContracts.filter(c => c.vendorId).length;
    const unmatchedContracts = demoContracts.length - matchedContracts;

    const contractsByStatus = demoContracts.reduce((acc, contract) => {
      acc[contract.status] = (acc[contract.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      isDemoDataPresent: demoVendors.length > 0 || demoContracts.length > 0,
      totalVendors: demoVendors.length,
      totalContracts: demoContracts.length,
      matchedContracts,
      unmatchedContracts,
      contractsByStatus,
    };
  },
});

/**
 * Setup demo account with sample data
 */
export const setupDemoAccount = mutation({
  args: {
    enterpriseId: v.id("enterprises"),
    cleanupFirst: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    // Get current user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser || currentUser.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied.");
    }

    // Cleanup existing demo data if requested
    if (args.cleanupFirst) {
      const existingVendors = await ctx.db
        .query("vendors")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
        .filter((q) => q.eq(q.field("isDemo"), true))
        .collect();

      const existingContracts = await ctx.db
        .query("contracts")
        .withIndex("by_status_and_enterpriseId", (q) => 
          q.eq("enterpriseId", args.enterpriseId)
        )
        .filter((q) => q.eq(q.field("isDemo"), true))
        .collect();

      // Delete existing demo data
      for (const vendor of existingVendors) {
        await ctx.db.delete(vendor._id);
      }
      for (const contract of existingContracts) {
        await ctx.db.delete(contract._id);
      }
    }

    const errors: string[] = [];
    const vendorMap = new Map<string, Id<"vendors">>();

    // Create demo vendors
    for (const vendorData of DEMO_VENDORS) {
      try {
        const vendorId = await ctx.db.insert("vendors", {
          enterpriseId: args.enterpriseId,
          name: vendorData.name,
          category: vendorData.category as any,
          contactName: vendorData.contact.name,
          contactEmail: vendorData.contact.email,
          contactPhone: vendorData.contact.phone,
          status: "active",
          performanceScore: Math.floor(Math.random() * 30) + 70, // 70-100
          totalContractValue: 0,
          activeContracts: 0,
          complianceScore: Math.floor(Math.random() * 20) + 80, // 80-100
          createdAt: new Date().toISOString(),
          isDemo: true,
        });
        vendorMap.set(vendorData.name, vendorId);
      } catch (error) {
        errors.push(`Failed to create vendor ${vendorData.name}: ${error}`);
      }
    }

    // Create demo contracts
    let contractsCreated = 0;
    let contractsMatched = 0;
    let contractsUnmatched = 0;

    const vendorIds = Array.from(vendorMap.values());
    const statuses = ["active", "draft", "expired", "pending", "terminated"];
    
    // Create 5 contracts per vendor on average
    for (let i = 0; i < vendorIds.length * 5; i++) {
      const template = CONTRACT_TEMPLATES[Math.floor(Math.random() * CONTRACT_TEMPLATES.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const shouldMatch = Math.random() > 0.15; // 85% matched
      
      // Generate dates based on status
      const now = new Date();
      let startDate = new Date();
      let endDate = new Date();
      
      if (status === "active") {
        startDate = new Date(now.getTime() - Math.random() * 180 * 24 * 60 * 60 * 1000); // Up to 6 months ago
        endDate = new Date(startDate.getTime() + template.duration * 30 * 24 * 60 * 60 * 1000);
      } else if (status === "expired") {
        startDate = new Date(now.getTime() - (180 + Math.random() * 365) * 24 * 60 * 60 * 1000); // 6-18 months ago
        endDate = new Date(startDate.getTime() + template.duration * 30 * 24 * 60 * 60 * 1000);
      } else if (status === "draft" || status === "pending") {
        startDate = new Date(now.getTime() + Math.random() * 90 * 24 * 60 * 60 * 1000); // Up to 3 months future
        endDate = new Date(startDate.getTime() + template.duration * 30 * 24 * 60 * 60 * 1000);
      } else { // terminated
        startDate = new Date(now.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000); // Up to 1 year ago
        endDate = new Date(startDate.getTime() + (Math.random() * template.duration) * 30 * 24 * 60 * 60 * 1000);
      }

      const contractValue = template.baseValue * (0.8 + Math.random() * 0.4); // ±20% variation

      try {
        // For demo contracts, we'll use a placeholder storage ID
        // In a real scenario, files would be uploaded through the client
        // Since we can't create storage items directly in mutations, we'll use a special demo storage ID
        const demoStorageId = "kd7f6gaxjhn5dzgk5ha7wnr3an74rvw9" as Id<"_storage">; // Placeholder ID for demos
        
        await ctx.db.insert("contracts", {
          enterpriseId: args.enterpriseId,
          title: `${template.title} - Demo ${i + 1}`,
          contractType: template.type as "other" | "nda" | "msa" | "sow" | "saas" | "lease" | "employment" | "partnership",
          vendorId: shouldMatch ? vendorIds[Math.floor(Math.random() * vendorIds.length)] : undefined,
          status: status as any,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          extractedPricing: contractValue > 0 ? `$${contractValue.toFixed(2)}` : undefined,
          notes: `Demo contract for ${template.title}. This is sample data for testing purposes.`,
          createdAt: new Date().toISOString(),
          isDemo: true,
          storageId: demoStorageId,
          fileName: `${template.title.replace(/ /g, '_')}_Demo_${i + 1}.pdf`,
          fileType: 'application/pdf',
        });
        
        contractsCreated++;
        if (shouldMatch) {
          contractsMatched++;
        } else {
          contractsUnmatched++;
        }
      } catch (error) {
        errors.push(`Failed to create contract: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      vendorsCreated: vendorMap.size,
      contractsCreated,
      contractsMatched,
      contractsUnmatched,
      errors,
    };
  },
});

/**
 * Clean up demo data
 */
export const cleanupDemoData = mutation({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required.");
    }

    // Get current user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser || currentUser.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied.");
    }

    // Get all demo vendors
    const demoVendors = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .filter((q) => q.eq(q.field("isDemo"), true))
      .collect();

    // Get all demo contracts
    const demoContracts = await ctx.db
      .query("contracts")
      .withIndex("by_status_and_enterpriseId", (q) => 
        q.eq("enterpriseId", args.enterpriseId)
      )
      .filter((q) => q.eq(q.field("isDemo"), true))
      .collect();

    // Delete all demo data
    for (const vendor of demoVendors) {
      await ctx.db.delete(vendor._id);
    }
    
    for (const contract of demoContracts) {
      await ctx.db.delete(contract._id);
    }

    return {
      deletedVendors: demoVendors.length,
      deletedContracts: demoContracts.length,
    };
  },
});