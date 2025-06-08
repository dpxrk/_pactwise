// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { agentTables } from "./agent_schema";
import { notificationTables } from "./notification_schema";
import { rateLimitTables } from "./security/rateLimiting";
import { auditTables } from "./security/auditLogging";

// ============================================================================
// OPTIONS / ENUMS
// ============================================================================

const contractStatusOptions = [
  "draft", "pending_analysis", "active", "expired", "terminated", "archived",
] as const;


const analysisStatusOptions = [
    "pending", "processing", "completed", "failed",
] as const;

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

export type ContractTypeEnum = typeof contractTypeOptions[number];

// User role options - Aligned with ROLE_PERMISSIONS.md
export const userRoleOptions = [
  "owner",   // Level 5
  "admin",   // Level 4
  "manager", // Level 3
  "user",    // Level 2
  "viewer",  // Level 1
] as const;

export type UserRole = typeof userRoleOptions[number];


// ============================================================================
// SCHEMA DEFINITION
// ============================================================================
export default defineSchema({
  // ===== ENTERPRISES =====
  enterprises: defineTable({
    name: v.string(),
    domain: v.optional(v.string()),
    industry: v.optional(v.string()),
    size: v.optional(v.union(
      v.literal("1-10"),
      v.literal("11-50"),
      v.literal("51-200"),
      v.literal("201-500"),
      v.literal("501-1000"),
      v.literal("1000+")
    )),
    contractVolume: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("enterprise")
    )),
    primaryUseCase: v.optional(v.array(v.string())),
  })
    .index("by_name", ["name"])
    .index("by_domain", ["domain"]),

 // ===== USERS =====
 users: defineTable({
  clerkId: v.string(),
  email: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  enterpriseId: v.id("enterprises"),
  role: v.union(...userRoleOptions.map(option => v.literal(option))),
  isActive: v.optional(v.boolean()),
  lastLoginAt: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.optional(v.string()),
  phoneNumber: v.optional(v.string()),
  department: v.optional(v.string()),
  title: v.optional(v.string()),
})
.index("by_clerkId", ["clerkId"])
.index("by_enterprise", ["enterpriseId"])
.index("by_email", ["email"]),

  // ===== VENDORS =====
  vendors: defineTable({
    enterpriseId: v.id("enterprises"),
    name: v.string(),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    website: v.optional(v.string()),
    category: v.optional(
      v.union(
        ...vendorCategoryOptions.map(option => v.literal(option))
      )
    ),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    createdAt: v.string(),
  })
  .index("by_name", ["name"])
  .index("by_enterprise", ["enterpriseId"])
  .index("by_enterpriseId", ["enterpriseId"])
  .index("by_category_and_enterpriseId", ["enterpriseId", "category"]),

  // ===== CONTRACTS =====
  contracts: defineTable({
    enterpriseId: v.id("enterprises"),
    vendorId: v.id("vendors"),
    title: v.string(),
    status: v.union(
        ...contractStatusOptions.map(option => v.literal(option))
    ),
    contractType: v.optional(
      v.union(
        ...contractTypeOptions.map(option => v.literal(option))
      )
    ),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    // User-provided contract details
    value: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    // AI-extracted data
    extractedParties: v.optional(v.array(v.string())),
    extractedStartDate: v.optional(v.string()),
    extractedEndDate: v.optional(v.string()),
    extractedPaymentSchedule: v.optional(v.string()),
    extractedPricing: v.optional(v.string()),
    extractedScope: v.optional(v.string()),
    analysisStatus: v.optional(v.union(
        ...analysisStatusOptions.map(option => v.literal(option))
    )),
    analysisError: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.string(),
  })
  .index("by_enterprise", ["enterpriseId"])
  .index("by_vendorId_and_enterpriseId", ["enterpriseId", "vendorId"])
  .index("by_status_and_enterpriseId", ["enterpriseId", "status"])
  .index("by_analysisStatus_and_enterpriseId", ["enterpriseId", "analysisStatus"])
  .index("by_contractType_and_enterpriseId", ["enterpriseId", "contractType"]),

  invitations: defineTable({
    enterpriseId: v.id("enterprises"),
    email: v.string(),
    role: v.union(...userRoleOptions.map(r => v.literal(r))),
    invitedBy: v.id("users"),
    token: v.string(),
    expiresAt: v.string(),
    acceptedAt: v.optional(v.string()),
  })
  .index("by_email", ["email"])
  .index("by_token", ["token"])
  .index("by_enterprise", ["enterpriseId"]),

  // ======USER ONBOARDING=========
  userOnboarding: defineTable({
    userId: v.id("users"),
    enterpriseId: v.id("enterprises"),
    currentStep: v.string(),
    completedSteps: v.optional(v.array(v.string())),
    startedAt: v.string(),
    completedAt: v.optional(v.string()),
    skippedAt: v.optional(v.string()),
    skipReason: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
    metadata: v.optional(v.any()),
  })
    .index("by_userId", ["userId"])
    .index("by_enterpriseId", ["enterpriseId"]),

  // ===== PRESENCE SYSTEM =====
  userPresence: defineTable({
    userId: v.id("users"),
    enterpriseId: v.id("enterprises"),
    lastSeen: v.string(),
    isOnline: v.boolean(),
    activity: v.optional(v.object({
      type: v.union(
        v.literal("viewing_contract"),
        v.literal("editing_contract"), 
        v.literal("viewing_vendor"),
        v.literal("dashboard"),
        v.literal("idle")
      ),
      resourceId: v.optional(v.string()),
      resourceTitle: v.optional(v.string()),
    })),
  })
    .index("by_user", ["userId"])
    .index("by_enterprise", ["enterpriseId"])
    .index("by_last_seen", ["lastSeen"]),

  // ===== REAL-TIME EVENTS =====
  realtimeEvents: defineTable({
    enterpriseId: v.id("enterprises"),
    userId: v.id("users"),
    eventType: v.union(
      v.literal("contract_updated"),
      v.literal("contract_created"),
      v.literal("contract_deleted"),
      v.literal("vendor_updated"),
      v.literal("vendor_created"),
      v.literal("analysis_completed"),
      v.literal("notification_created"),
      v.literal("user_joined"),
      v.literal("user_left"),
      v.literal("system_alert")
    ),
    resourceId: v.optional(v.string()),
    resourceType: v.optional(v.string()),
    data: v.optional(v.any()),
    targetUsers: v.optional(v.array(v.id("users"))),
    timestamp: v.string(),
    processed: v.boolean(),
  })
    .index("by_enterprise_timestamp", ["enterpriseId", "timestamp"])
    .index("by_user", ["userId"])
    .index("by_processed", ["processed"]),

  // ===== TYPING INDICATORS =====
  typingIndicators: defineTable({
    userId: v.id("users"),
    enterpriseId: v.id("enterprises"),
    resourceId: v.string(),
    resourceType: v.string(),
    field: v.optional(v.string()),
    lastTyped: v.string(),
  })
    .index("by_resource", ["resourceId", "resourceType"])
    .index("by_user_resource", ["userId", "resourceId", "resourceType"])
    .index("by_enterprise", ["enterpriseId"]),

  ...agentTables,
  ...notificationTables,
  ...rateLimitTables,
  ...auditTables
});