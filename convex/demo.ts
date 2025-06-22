// convex/demo.ts - Demo Account Setup with Mock Data
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api";
import { VendorCategory } from "./schema";
import { Doc } from "./_generated/dataModel";

// Type definitions
type DemoContract = {
  title: string;
  status: "draft" | "pending_analysis" | "active" | "expired" | "terminated" | "archived";
  contractType: "nda" | "msa" | "sow" | "saas" | "lease" | "employment" | "partnership" | "other";
  extractedStartDate: string;
  extractedEndDate: string;
  extractedPricing: string;
  extractedPaymentSchedule: string;
  extractedScope: string;
  analysisStatus: "completed";
  fileName: string;
  fileType: string;
  vendorId: Id<"vendors"> | null;
  extractedParties: string[];
  notes: string;
};

// Demo data constants
const DEMO_VENDOR_COUNT = 25;
const DEMO_CONTRACT_COUNT = 120;
const UNMATCHED_CONTRACT_PERCENTAGE = 0.15; // 15% of contracts will not have vendors

// Vendor categories from schema
const vendorCategories = [
  "technology", "marketing", "legal", "finance", "hr",
  "facilities", "logistics", "manufacturing", "consulting", "other"
] as const;

// Contract types from schema
const contractTypes = [
  "nda", "msa", "sow", "saas", "lease", "employment", "partnership", "other"
] as const;

// Contract statuses from schema
const contractStatuses = [
  "draft", "pending_analysis", "active", "expired", "terminated", "archived"
] as const;

// Demo vendor data
const DEMO_VENDORS = [
  // Technology (5)
  { name: "TechCorp Solutions", category: "technology", contactEmail: "contact@techcorp.com", website: "https://techcorp.com", contactPhone: "+1-555-0101" },
  { name: "CloudSync Inc", category: "technology", contactEmail: "sales@cloudsync.io", website: "https://cloudsync.io", contactPhone: "+1-555-0102" },
  { name: "DataFlow Systems", category: "technology", contactEmail: "info@dataflow.net", website: "https://dataflow.net", contactPhone: "+1-555-0103" },
  { name: "SecureNet Technologies", category: "technology", contactEmail: "security@securenet.com", website: "https://securenet.com", contactPhone: "+1-555-0104" },
  { name: "AI Innovations LLC", category: "technology", contactEmail: "hello@aiinnovations.ai", website: "https://aiinnovations.ai", contactPhone: "+1-555-0105" },
  
  // Marketing (3)
  { name: "Digital Media Partners", category: "marketing", contactEmail: "campaigns@digitalmp.com", website: "https://digitalmp.com", contactPhone: "+1-555-0201" },
  { name: "BrandBoost Agency", category: "marketing", contactEmail: "growth@brandboost.co", website: "https://brandboost.co", contactPhone: "+1-555-0202" },
  { name: "Creative Solutions Hub", category: "marketing", contactEmail: "creative@creativehub.agency", website: "https://creativehub.agency", contactPhone: "+1-555-0203" },
  
  // Legal (3)
  { name: "Corporate Law Associates", category: "legal", contactEmail: "partners@corplaw.com", website: "https://corplaw.com", contactPhone: "+1-555-0301" },
  { name: "Intellectual Property Group", category: "legal", contactEmail: "ip@ipgroup.legal", website: "https://ipgroup.legal", contactPhone: "+1-555-0302" },
  { name: "Contract Specialists LLP", category: "legal", contactEmail: "contracts@contractspec.law", website: "https://contractspec.law", contactPhone: "+1-555-0303" },
  
  // Finance (3)
  { name: "Strategic Financial Advisors", category: "finance", contactEmail: "advisors@strategicfa.com", website: "https://strategicfa.com", contactPhone: "+1-555-0401" },
  { name: "Accounting Excellence Inc", category: "finance", contactEmail: "accounting@accexcel.com", website: "https://accexcel.com", contactPhone: "+1-555-0402" },
  { name: "Tax & Audit Partners", category: "finance", contactEmail: "services@taxaudit.pro", website: "https://taxaudit.pro", contactPhone: "+1-555-0403" },
  
  // HR (2)
  { name: "Talent Acquisition Pros", category: "hr", contactEmail: "talent@tapros.com", website: "https://tapros.com", contactPhone: "+1-555-0501" },
  { name: "Workforce Solutions Group", category: "hr", contactEmail: "hr@workforcesg.com", website: "https://workforcesg.com", contactPhone: "+1-555-0502" },
  
  // Facilities (2)
  { name: "Office Space Management", category: "facilities", contactEmail: "facilities@osm.com", website: "https://osm.com", contactPhone: "+1-555-0601" },
  { name: "Building Maintenance Co", category: "facilities", contactEmail: "maintenance@buildmaint.com", website: "https://buildmaint.com", contactPhone: "+1-555-0602" },
  
  // Logistics (2)
  { name: "Global Shipping Partners", category: "logistics", contactEmail: "shipping@globalsp.com", website: "https://globalsp.com", contactPhone: "+1-555-0701" },
  { name: "Supply Chain Solutions", category: "logistics", contactEmail: "supply@scchain.net", website: "https://scchain.net", contactPhone: "+1-555-0702" },
  
  // Manufacturing (2)
  { name: "Industrial Components Inc", category: "manufacturing", contactEmail: "components@indcomp.com", website: "https://indcomp.com", contactPhone: "+1-555-0801" },
  { name: "Production Systems LLC", category: "manufacturing", contactEmail: "production@prodsys.com", website: "https://prodsys.com", contactPhone: "+1-555-0802" },
  
  // Consulting (2)
  { name: "Strategic Consulting Group", category: "consulting", contactEmail: "strategy@stratcg.com", website: "https://stratcg.com", contactPhone: "+1-555-0901" },
  { name: "Business Transformation Co", category: "consulting", contactEmail: "transform@biztrans.co", website: "https://biztrans.co", contactPhone: "+1-555-0902" },
  
  // Other (1)
  { name: "Miscellaneous Services Ltd", category: "other", contactEmail: "services@miscserv.ltd", website: "https://miscserv.ltd", contactPhone: "+1-555-1001" },
];

// Demo contract templates
const CONTRACT_TEMPLATES = [
  // Technology contracts
  { title: "Software License Agreement - TechCorp", type: "saas" as const, status: "active" as const, pricing: "$2,500/month", schedule: "Monthly recurring", scope: "Enterprise software licensing and support", category: "technology" },
  { title: "Cloud Infrastructure Services - CloudSync", type: "saas" as const, status: "active" as const, pricing: "$8,500/month", schedule: "Monthly recurring", scope: "Cloud hosting and infrastructure management", category: "technology" },
  { title: "Data Analytics Platform - DataFlow", type: "saas" as const, status: "active" as const, pricing: "$5,200/month", schedule: "Monthly recurring", scope: "Data processing and analytics platform", category: "technology" },
  { title: "Cybersecurity Services - SecureNet", type: "msa" as const, status: "active" as const, pricing: "$12,000/month", schedule: "Monthly retainer", scope: "Comprehensive cybersecurity monitoring and response", category: "technology" },
  { title: "AI Development Contract - AI Innovations", type: "sow" as const, status: "active" as const, pricing: "$75,000", schedule: "50% upfront, 50% on completion", scope: "Custom AI model development and integration", category: "technology" },
  
  // Marketing contracts
  { title: "Digital Marketing Campaign - Digital Media", type: "sow" as const, status: "active" as const, pricing: "$35,000", schedule: "Monthly payments over 6 months", scope: "Comprehensive digital marketing campaign", category: "marketing" },
  { title: "Brand Development - BrandBoost", type: "msa" as const, status: "active" as const, pricing: "$4,500/month", schedule: "Monthly retainer", scope: "Ongoing brand development and management", category: "marketing" },
  { title: "Creative Services Agreement - Creative Hub", type: "msa" as const, status: "active" as const, pricing: "$6,800/month", schedule: "Monthly retainer", scope: "Creative design and content production", category: "marketing" },
  
  // Legal contracts
  { title: "General Legal Counsel - Corporate Law", type: "msa" as const, status: "active" as const, pricing: "$15,000/month", schedule: "Monthly retainer", scope: "General corporate legal counsel and advisory", category: "legal" },
  { title: "IP Protection Services - IP Group", type: "msa" as const, status: "active" as const, pricing: "$8,500/month", schedule: "Monthly retainer", scope: "Intellectual property protection and management", category: "legal" },
  { title: "Contract Review Services - Contract Specialists", type: "msa" as const, status: "active" as const, pricing: "$3,200/month", schedule: "Monthly retainer", scope: "Ongoing contract review and negotiation support", category: "legal" },
  
  // Finance contracts
  { title: "Financial Advisory Services - Strategic FA", type: "msa" as const, status: "active" as const, pricing: "$7,500/month", schedule: "Monthly retainer", scope: "Strategic financial planning and advisory", category: "finance" },
  { title: "Accounting Services - Accounting Excellence", type: "msa" as const, status: "active" as const, pricing: "$4,200/month", schedule: "Monthly service fee", scope: "Monthly accounting and financial reporting", category: "finance" },
  { title: "Tax Preparation Services - Tax & Audit", type: "sow" as const, status: "active" as const, pricing: "$12,500", schedule: "Annual payment", scope: "Corporate tax preparation and filing", category: "finance" },
  
  // HR contracts
  { title: "Recruitment Services - Talent Acquisition", type: "msa" as const, status: "active" as const, pricing: "$25,000", schedule: "Per successful hire", scope: "Executive and technical recruitment services", category: "hr" },
  { title: "HR Consulting - Workforce Solutions", type: "msa" as const, status: "active" as const, pricing: "$5,500/month", schedule: "Monthly retainer", scope: "HR strategy and workforce optimization", category: "hr" },
  
  // Facilities contracts
  { title: "Office Space Lease - Office Space Management", type: "lease" as const, status: "active" as const, pricing: "$25,000/month", schedule: "Monthly rent", scope: "Commercial office space rental", category: "facilities" },
  { title: "Building Maintenance - Building Maintenance Co", type: "msa" as const, status: "active" as const, pricing: "$3,800/month", schedule: "Monthly service fee", scope: "Building maintenance and janitorial services", category: "facilities" },
  
  // Additional contract variations with different statuses
  { title: "Employee Handbook Review", type: "sow" as const, status: "draft" as const, pricing: "$8,500", schedule: "Upon completion", scope: "Comprehensive employee handbook review and update", category: "legal" },
  { title: "Network Infrastructure Upgrade", type: "sow" as const, status: "pending_analysis" as const, pricing: "$45,000", schedule: "Milestone-based payments", scope: "Complete network infrastructure overhaul", category: "technology" },
  { title: "Marketing Analytics Platform", type: "saas" as const, status: "expired" as const, pricing: "$1,200/month", schedule: "Monthly subscription", scope: "Marketing performance analytics and reporting", category: "marketing" },
];

/**
 * Generate random demo contract
 */
function generateRandomContract(vendors: Array<{ name: string; category: VendorCategory | "other"; contactEmail: string; website: string; contactPhone: string; _id: Id<"vendors"> }>, index: number): DemoContract {
  const templates = CONTRACT_TEMPLATES;
  const template = templates[index % templates.length];
  if (!template) {
    throw new Error(`Template not found for index ${index}`);
  }
  
  // Create variations of the base template
  const contractNumber = Math.floor(index / templates.length) + 1;
  const title = contractNumber > 1 ? `${template!.title} - Phase ${contractNumber}` : template!.title;
  
  // Randomize some properties
  const statuses = ["active", "draft", "pending_analysis", "expired"] as const;
  const statusIndex = Math.floor(Math.random() * statuses.length);
  const status: "draft" | "pending_analysis" | "active" | "expired" | "terminated" | "archived" = Math.random() < 0.7 ? "active" : statuses[statusIndex]!;
  
  // Generate random dates
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 365));
  
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1 + Math.floor(Math.random() * 2));
  
  // Find matching vendor by category
  let assignedVendor: {
    name:string,category:VendorCategory | "other", contactEmail:string,contactPhone:string, website:string, _id:Id<"vendors">
  } | null = null;

  if (Math.random() > UNMATCHED_CONTRACT_PERCENTAGE) {
    const categoryVendors = vendors.filter((v: any) => v.category === template!.category);
    if (categoryVendors.length > 0) {
      assignedVendor = categoryVendors[Math.floor(Math.random() * categoryVendors.length)]!;
    } else {
      assignedVendor = null;
    }
  }
  
  return {
    title,
    status,
    contractType: template!.type,
    extractedStartDate: startDate.toISOString().split('T')[0]!,
    extractedEndDate: endDate.toISOString().split('T')[0]!,
    extractedPricing: template!.pricing,
    extractedPaymentSchedule: template!.schedule,
    extractedScope: template!.scope,
    analysisStatus: "completed",
    fileName: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    fileType: "application/pdf",
    vendorId: assignedVendor ? assignedVendor._id : null,
    extractedParties: assignedVendor ? ["Your Company", assignedVendor.name] : ["Your Company", "Unknown Vendor"],
    notes: `Demo contract #${index + 1} - ${template!.scope}`,
  };
}

/**
 * Check if demo data already exists for enterprise
 */
export const checkDemoDataExists = query({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || user.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied");
    }

    const vendorCount = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .collect()
      .then(vendors => vendors.filter(v => v.name.includes("Demo") || DEMO_VENDORS.some(dv => dv.name === v.name)).length);

    const contractCount = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .collect()
      .then(contracts => contracts.filter(c => c.notes?.includes("Demo contract")).length);

    return {
      hasExistingDemoData: vendorCount > 0 || contractCount > 0,
      existingDemoVendors: vendorCount,
      existingDemoContracts: contractCount,
    };
  },
});

/**
 * Clean up existing demo data
 */
export const cleanupDemoData = mutation({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || user.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied");
    }

    // Check if user has permission to clean up data
    if (user.role !== "owner" && user.role !== "admin") {
      throw new ConvexError("Permission denied: Only owners and admins can clean up demo data");
    }

    let deletedContracts = 0;
    let deletedVendors = 0;

    // Delete demo contracts first (to avoid foreign key constraints)
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .collect();

    for (const contract of contracts) {
      if (contract.notes?.includes("Demo contract")) {
        await ctx.db.delete(contract._id);
        deletedContracts++;
      }
    }

    // Delete demo vendors
    const vendors = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .collect();

    for (const vendor of vendors) {
      if (DEMO_VENDORS.some(dv => dv.name === vendor.name)) {
        await ctx.db.delete(vendor._id);
        deletedVendors++;
      }
    }

    return {
      success: true,
      deletedContracts,
      deletedVendors,
    };
  },
});

/**
 * Setup demo account with mock data
 */
export const setupDemoAccount = mutation({
  args: {
    enterpriseId: v.id("enterprises"),
    cleanupFirst: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || user.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied");
    }

    // Check permissions
    if (user.role !== "owner" && user.role !== "admin") {
      throw new ConvexError("Permission denied: Only owners and admins can setup demo data");
    }

    const results = {
      success: true,
      vendorsCreated: 0,
      contractsCreated: 0,
      contractsMatched: 0,
      contractsUnmatched: 0,
      errors: [] as string[],
    };

    try {
      // Cleanup existing demo data if requested
      if (args.cleanupFirst) {
        // Clean up existing data first - simplified approach
        // Note: cleanupDemoData needs to be accessible from here or implemented differently
      }

      // Create demo vendors
      const createdVendors: Array<{ name: string; category: VendorCategory | "other"; contactEmail: string; website: string; contactPhone: string; _id: Id<"vendors"> }> = [];
      for (const vendorData of DEMO_VENDORS) {
        try {
          const vendorId = await ctx.db.insert("vendors", {
            enterpriseId: args.enterpriseId,
            name: vendorData.name,
            contactEmail: vendorData.contactEmail,
            contactPhone: vendorData.contactPhone,
            website: vendorData.website,
            category: vendorData.category as VendorCategory,
            status: "active",
            createdBy: user._id,
            createdAt: new Date().toISOString(),
          });

          createdVendors.push({
            _id: vendorId,
            ...vendorData,
            category: vendorData.category as VendorCategory,
          });
          results.vendorsCreated++;
        } catch (error: unknown) {
          results.errors.push(`Failed to create vendor ${vendorData.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // For demo purposes, we'll use a placeholder storage ID
      // In production, you would upload actual contract files
      const dummyStorageId = "kg2qmjq8xz7pj8kd6qx5cq2xh56xntfs" as Id<"_storage">;
      
      // Create demo contracts
      for (let i = 0; i < DEMO_CONTRACT_COUNT; i++) {
        try {
          const contractData = generateRandomContract(createdVendors, i);
          
          // Use the dummy storage ID (in production, you'd generate actual PDF files)
          const contractInsertData: Record<string, unknown> = {
            enterpriseId: args.enterpriseId,
            title: contractData.title,
            status: contractData.status,
            contractType: contractData.contractType,
            storageId: dummyStorageId,
            fileName: contractData.fileName,
            fileType: contractData.fileType,
            analysisStatus: contractData.analysisStatus,
            extractedStartDate: contractData.extractedStartDate,
            extractedEndDate: contractData.extractedEndDate,
            extractedPricing: contractData.extractedPricing,
            extractedPaymentSchedule: contractData.extractedPaymentSchedule,
            extractedScope: contractData.extractedScope,
            extractedParties: contractData.extractedParties,
            notes: contractData.notes,
            createdBy: user._id,
            createdAt: new Date().toISOString(),
          };
          
          if (contractData.vendorId !== null) {
            contractInsertData.vendorId = contractData.vendorId;
          }
          
          const contractId = await ctx.db.insert("contracts", contractInsertData as Parameters<typeof ctx.db.insert<"contracts">>[1]);

          results.contractsCreated++;
          if (contractData.vendorId) {
            results.contractsMatched++;
          } else {
            results.contractsUnmatched++;
          }
        } catch (error: unknown) {
          results.errors.push(`Failed to create contract ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return results;
    } catch (error: unknown) {
      return {
        success: false,
        vendorsCreated: results.vendorsCreated,
        contractsCreated: results.contractsCreated,
        contractsMatched: results.contractsMatched,
        contractsUnmatched: results.contractsUnmatched,
        errors: [...results.errors, error instanceof Error ? error.message : String(error)],
      };
    }
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
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || user.enterpriseId !== args.enterpriseId) {
      throw new ConvexError("Access denied");
    }

    const vendors = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .collect();

    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", args.enterpriseId))
      .collect();

    const demoVendors = vendors.filter(v => DEMO_VENDORS.some(dv => dv.name === v.name));
    const demoContracts = contracts.filter(c => c.notes?.includes("Demo contract"));
    const matchedContracts = demoContracts.filter(c => c.vendorId !== null && c.vendorId !== undefined);
    const unmatchedContracts = demoContracts.filter(c => !c.vendorId);

    // Vendor breakdown by category
    const vendorsByCategory = demoVendors.reduce((acc, vendor) => {
      const category = vendor.category || "uncategorized";
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Contract breakdown by status
    const contractsByStatus = demoContracts.reduce((acc, contract) => {
      acc[contract.status] = (acc[contract.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Contract breakdown by type
    const contractsByType = demoContracts.reduce((acc, contract) => {
      const type = contract.contractType || "other";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalVendors: demoVendors.length,
      totalContracts: demoContracts.length,
      matchedContracts: matchedContracts.length,
      unmatchedContracts: unmatchedContracts.length,
      matchingPercentage: demoContracts.length > 0 ? Math.round((matchedContracts.length / demoContracts.length) * 100) : 0,
      vendorsByCategory,
      contractsByStatus,
      contractsByType,
      isDemoDataPresent: demoVendors.length > 0 || demoContracts.length > 0,
    };
  },
});