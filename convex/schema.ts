// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ============================================================================
// OPTIONS / ENUMS
// ============================================================================

const contractStatusOptions = [
  "draft", "pending_analysis", "active", "expired", "terminated", "archived",
] as const;
// You can export this type if you need it in other backend files, though often it's derived where used.
// export type ContractStatus = typeof contractStatusOptions[number];

const analysisStatusOptions = [
    "pending", "processing", "completed", "failed",
] as const;
// export type AnalysisStatus = typeof analysisStatusOptions[number];

const vendorCategoryOptions = [
  "technology",    // e.g., Software providers, IT services
  "marketing",     // e.g., Advertising agencies, SEO services
  "legal",         // e.g., Law firms, legal consultants
  "finance",       // e.g., Accounting firms, financial advisors
  "hr",            // e.g., Recruitment agencies, payroll services
  "facilities",    // e.g., Office supplies, maintenance services
  "logistics",     // e.g., Shipping companies, warehousing
  "manufacturing", // e.g., Component suppliers, OEMs
  "consulting",    // e.g., Management consultants, strategy advisors
  "other"          // For any categories not explicitly listed
] as const;
// Exporting for potential use in other backend files or for clarity
export type VendorCategory = typeof vendorCategoryOptions[number];

const contractTypeOptions = [
  "nda",             // Non-Disclosure Agreement
  "msa",             // Master Service Agreement
  "sow",             // Statement of Work
  "saas",            // Software as a Service Agreement
  "lease",           // Lease Agreement
  "employment",      // Employment Agreement
  "partnership",     // Partnership Agreement
  "other"            // For any types not explicitly listed
] as const;
// Exporting for potential use
export type ContractTypeEnum = typeof contractTypeOptions[number];

// ============================================================================
// SCHEMA DEFINITION
// ============================================================================
export default defineSchema({
  // ===== ENTERPRISES =====
  // Stores basic information about enterprises/organizations.
  enterprises: defineTable({
    name: v.string(), // Name of the enterprise
    // Consider adding:
    // ownerUserId: v.optional(v.string()), // Clerk User ID of the enterprise owner/creator
    // subscriptionPlan: v.optional(v.string()), // e.g., "free", "pro", "enterprise"
    // createdAt: v.optional(v.number()), // Use Convex's _creationTime automatically
  })
  .index("by_name", ["name"]),

  // ===== VENDORS =====
  vendors: defineTable({
    // --- Link to an enterprise ---
    enterpriseId: v.id("enterprises"), // Required: Ensures vendor is scoped to an enterprise

    // --- Core vendor info ---
    name: v.string(),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    website: v.optional(v.string()),

    // --- NEW: Vendor category ---
    category: v.optional(
      v.union(
        ...vendorCategoryOptions.map(option => v.literal(option))
      )
    ),
    // Consider adding more vendor-specific fields from your 'oldcode.txt' or frontend needs, e.g.:
    // taxId: v.optional(v.string()),
    // riskLevel: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    // status: v.optional(v.union(v.literal("active"), v.literal("inactive"))), // If different from contract status
  })
  .index("by_name", ["name"]) // For searching/sorting by name
  .index("by_enterpriseId", ["enterpriseId"]) // For querying vendors by enterprise
  .index("by_category_and_enterpriseId", ["enterpriseId", "category"]), // For filtering by category within an enterprise

  // ===== CONTRACTS =====
  contracts: defineTable({
    // --- Link to an enterprise ---
    enterpriseId: v.id("enterprises"), // Required: Links to the 'enterprises' table

    // --- Core Contract Info ---
    vendorId: v.id("vendors"), // Link to the 'vendors' table
    title: v.string(),
    status: v.union(
        ...contractStatusOptions.map(option => v.literal(option))
    ),
    // --- NEW: Contract Type field ---
    contractType: v.optional(
      v.union(
        ...contractTypeOptions.map(option => v.literal(option))
      )
    ),

    // --- File Information ---
    storageId: v.id("_storage"), // ID of the file in Convex storage
    fileName: v.string(),
    fileType: v.string(), // MIME type

    // --- Extracted Information (populated by analysis action) ---
    extractedParties: v.optional(v.array(v.string())),
    extractedStartDate: v.optional(v.string()), // Store as ISO string or Convex timestamp if preferred
    extractedEndDate: v.optional(v.string()),   // Store as ISO string or Convex timestamp if preferred
    extractedPaymentSchedule: v.optional(v.string()),
    extractedPricing: v.optional(v.string()),
    extractedScope: v.optional(v.string()),

    // --- Analysis Process Tracking ---
    analysisStatus: v.optional(v.union(
        ...analysisStatusOptions.map(option => v.literal(option))
    )),
    analysisError: v.optional(v.string()), // Store error messages if analysis fails

    // --- Optional user notes ---
    notes: v.optional(v.string()),

    // Consider adding more contract-specific fields from 'oldcode.txt' or requirements, e.g.:
    // contractValue: v.optional(v.number()),
    // currency: v.optional(v.string()),
    // renewalTerms: v.optional(v.string()),
    // terminationClause: v.optional(v.string()),
  })
  .index("by_vendorId_and_enterpriseId", ["enterpriseId", "vendorId"]) // Query contracts by vendor within an enterprise
  .index("by_status_and_enterpriseId", ["enterpriseId", "status"]) // Query contracts by status within an enterprise
  .index("by_analysisStatus_and_enterpriseId", ["enterpriseId", "analysisStatus"]) // Query by analysis status within an enterprise
  .index("by_contractType_and_enterpriseId", ["enterpriseId", "contractType"]), // Query by contract type within an enterprise
  // Consider an index on enterpriseId alone if you often list all contracts for an enterprise without other filters
  // .index("by_enterpriseId_only", ["enterpriseId"]) // Redundant if you have more specific enterpriseId indexes
});