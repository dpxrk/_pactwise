// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { agentTables } from "./schemas/agent_schema";
import { notificationTables } from "./schemas/notification_schema";
import { rateLimitTables } from "./security/rateLimiting";
import { auditTables } from "./auditLogging";
import { memoryTables } from "./schemas/memory_schema";
import { episodicMemoryTables } from "./schemas/episodic_memory_schema";
import { memorySharingTables } from "./schemas/memory_sharing_schema";
import { collaborativeDocumentsSchema } from "./schemas/collaborative_documents_schema";
import { 
  onboardingMetadataValidator,
  analyticsEventPropertiesValidator,
  errorReportContextValidator,
  realtimeEventDataValidator 
} from "./types/schema_types";

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
    // Hierarchical organization support
    parentEnterpriseId: v.optional(v.id("enterprises")), // Parent company
    isParentOrganization: v.optional(v.boolean()), // True if this is a parent company
    // PIN-based access control
    accessPin: v.optional(v.string()), // Hashed PIN for joining the organization
    allowChildOrganizations: v.optional(v.boolean()), // Whether this org allows child orgs
    // Metadata
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  })
    .index("by_name", ["name"])
    .index("by_domain", ["domain"])
    .index("by_parent", ["parentEnterpriseId"])
    .index("by_is_parent", ["isParentOrganization"]),

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
    createdBy: v.optional(v.string()), // User ID or "system" for auto-created
    metadata: v.optional(v.any()), // Additional data for vendor agent
    createdAt: v.string(),
    updatedAt: v.optional(v.number()), // Track last update
  })
  // Basic indexes
  .index("by_name", ["name"])
  .index("by_enterprise", ["enterpriseId"])
  .index("by_category_and_enterpriseId", ["enterpriseId", "category"])
  // Performance-optimized indexes
  .index("by_enterprise_name_category", ["enterpriseId", "name", "category"])
  .index("by_enterprise_status_created", ["enterpriseId", "status"])
  .index("by_enterprise_category_status", ["enterpriseId", "category", "status"]),

  // ===== CONTRACTS =====
  contracts: defineTable({
    enterpriseId: v.id("enterprises"),
    vendorId: v.optional(v.id("vendors")), // Made optional for vendor agent to assign
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
    extractedAddress: v.optional(v.string()), // Added for vendor matching
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
    // Ownership and tracking fields
    ownerId: v.optional(v.id("users")), // User responsible for the contract
    departmentId: v.optional(v.string()), // Department managing the contract
    createdBy: v.optional(v.id("users")), // User who created the contract
    lastModifiedBy: v.optional(v.id("users")), // User who last modified
    createdAt: v.string(),
    updatedAt: v.optional(v.number()), // Added for tracking updates
  })
  // Basic indexes
  .index("by_enterprise", ["enterpriseId"])
  .index("by_vendorId_and_enterpriseId", ["enterpriseId", "vendorId"])
  .index("by_status_and_enterpriseId", ["enterpriseId", "status"])
  .index("by_owner", ["ownerId"])
  .index("by_enterprise_owner", ["enterpriseId", "ownerId"])
  .index("by_department", ["enterpriseId", "departmentId"])
  .index("by_analysisStatus_and_enterpriseId", ["enterpriseId", "analysisStatus"])
  .index("by_contractType_and_enterpriseId", ["enterpriseId", "contractType"])
  // Performance-critical indexes for analytics and time-based queries
  .index("by_enterprise_status_endDate", ["enterpriseId", "status", "extractedEndDate"])
  .index("by_enterprise_vendor_status", ["enterpriseId", "vendorId", "status"])
  .index("by_enterprise_title_status", ["enterpriseId", "title", "status"])
  // Search optimization indexes
  .index("by_enterprise_fileName", ["enterpriseId", "fileName"])
  .index("by_enterprise_contractType_status", ["enterpriseId", "contractType", "status"]),

  // ===== CONTRACT ASSIGNMENTS =====
  contractAssignments: defineTable({
    contractId: v.id("contracts"),
    userId: v.id("users"),
    assignedBy: v.id("users"),
    assignmentType: v.union(
      v.literal("owner"), // Primary owner
      v.literal("reviewer"), // Can review and comment
      v.literal("approver"), // Can approve changes
      v.literal("watcher") // Gets notifications
    ),
    assignedAt: v.string(),
    unassignedAt: v.optional(v.string()),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
  })
  .index("by_contract", ["contractId"])
  .index("by_user", ["userId"])
  .index("by_contract_active", ["contractId", "isActive"])
  .index("by_user_active", ["userId", "isActive"]),

  // ===== CONTRACT STATUS HISTORY =====
  contractStatusHistory: defineTable({
    contractId: v.id("contracts"),
    previousStatus: v.union(
      ...contractStatusOptions.map(option => v.literal(option))
    ),
    newStatus: v.union(
      ...contractStatusOptions.map(option => v.literal(option))
    ),
    changedBy: v.id("users"),
    changedAt: v.string(),
    reason: v.optional(v.string()),
    metadata: v.optional(v.object({
      approvedBy: v.optional(v.id("users")),
      rejectionReason: v.optional(v.string()),
      comments: v.optional(v.string()),
    })),
  })
  .index("by_contract", ["contractId"])
  .index("by_contract_time", ["contractId", "changedAt"])
  .index("by_user", ["changedBy"]),

  // ===== CONTRACT APPROVALS =====
  contractApprovals: defineTable({
    contractId: v.id("contracts"),
    approvalType: v.union(
      v.literal("new_contract"),
      v.literal("renewal"),
      v.literal("amendment"),
      v.literal("termination"),
      v.literal("budget_exceed")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("escalated")
    ),
    requestedBy: v.id("users"),
    requestedAt: v.string(),
    requiredRole: v.union(...userRoleOptions.map(option => v.literal(option))),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.string()),
    comments: v.optional(v.string()),
    metadata: v.optional(v.object({
      previousValue: v.optional(v.number()),
      newValue: v.optional(v.number()),
      reason: v.optional(v.string()),
    })),
  })
  .index("by_contract", ["contractId"])
  .index("by_status", ["status"])
  .index("by_contract_status", ["contractId", "status"]),

  // ===== COMPLIANCE TRACKING =====
  complianceChecks: defineTable({
    contractId: v.id("contracts"),
    checkType: v.union(
      v.literal("regulatory"),
      v.literal("internal_policy"),
      v.literal("security"),
      v.literal("data_privacy"),
      v.literal("financial"),
      v.literal("operational")
    ),
    status: v.union(
      v.literal("compliant"),
      v.literal("non_compliant"),
      v.literal("pending_review"),
      v.literal("remediation_required")
    ),
    checkedAt: v.string(),
    checkedBy: v.optional(v.id("users")),
    nextCheckDue: v.optional(v.string()),
    issues: v.optional(v.array(v.object({
      description: v.string(),
      severity: v.union(v.literal("critical"), v.literal("high"), v.literal("medium"), v.literal("low")),
      remediationRequired: v.boolean(),
      resolvedAt: v.optional(v.string()),
    }))),
    notes: v.optional(v.string()),
  })
  .index("by_contract", ["contractId"])
  .index("by_status", ["status"])
  .index("by_next_check", ["nextCheckDue"]),

  // ===== BUDGET TRACKING =====
  budgets: defineTable({
    enterpriseId: v.id("enterprises"),
    name: v.string(),
    budgetType: v.union(
      v.literal("annual"),
      v.literal("quarterly"),
      v.literal("monthly"),
      v.literal("project"),
      v.literal("department")
    ),
    departmentId: v.optional(v.string()),
    totalBudget: v.number(),
    allocatedAmount: v.number(),
    spentAmount: v.number(),
    committedAmount: v.number(), // Future committed spend from contracts
    startDate: v.string(),
    endDate: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("exceeded"),
      v.literal("at_risk"), // >80% spent
      v.literal("healthy"),
      v.literal("closed")
    ),
    ownerId: v.id("users"),
    createdAt: v.string(),
    updatedAt: v.optional(v.string()),
    alerts: v.optional(v.array(v.object({
      type: v.union(v.literal("threshold_reached"), v.literal("exceeded"), v.literal("forecast_exceed")),
      threshold: v.number(),
      triggeredAt: v.string(),
      acknowledged: v.boolean(),
    }))),
  })
  .index("by_enterprise", ["enterpriseId"])
  .index("by_status", ["status"])
  .index("by_department", ["enterpriseId", "departmentId"]),

  // ===== CONTRACT-BUDGET ALLOCATIONS =====
  contractBudgetAllocations: defineTable({
    contractId: v.id("contracts"),
    budgetId: v.id("budgets"),
    allocatedAmount: v.number(),
    allocationType: v.union(
      v.literal("full"), // Full contract value
      v.literal("prorated"), // Prorated for budget period
      v.literal("custom") // Custom allocation
    ),
    startDate: v.string(),
    endDate: v.string(),
    createdAt: v.string(),
  })
  .index("by_contract", ["contractId"])
  .index("by_budget", ["budgetId"]),

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
    metadata: v.optional(onboardingMetadataValidator),
  })
    .index("by_userId", ["userId"])
    .index("by_enterprise", ["enterpriseId"]),

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
    data: v.optional(realtimeEventDataValidator),
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

  // ===== MONITORING & ANALYTICS =====
  analytics_events: defineTable({
    event: v.string(),
    timestamp: v.number(),
    url: v.string(),
    userId: v.optional(v.string()),
    properties: v.optional(analyticsEventPropertiesValidator),
    sessionId: v.string(),
    userAgent: v.optional(v.string()),
    ip: v.optional(v.string()),
    authenticatedUserId: v.optional(v.id("users")),
    enterpriseId: v.optional(v.id("enterprises")),
    serverTimestamp: v.number(),
    createdAt: v.string(),
  })
    .index("by_enterprise", ["enterpriseId"])
    .index("by_user", ["authenticatedUserId"])
    .index("by_event", ["event"])
    .index("by_timestamp", ["timestamp"])
    .index("by_session", ["sessionId"])
    .index("by_enterprise_event", ["enterpriseId", "event"])
    .index("by_enterprise_timestamp", ["enterpriseId", "timestamp"]),

  error_reports: defineTable({
    message: v.string(),
    stack: v.optional(v.string()),
    timestamp: v.number(),
    url: v.string(),
    userId: v.optional(v.string()),
    sessionId: v.string(),
    userAgent: v.string(),
    context: v.optional(errorReportContextValidator),
    authenticatedUserId: v.optional(v.id("users")),
    enterpriseId: v.optional(v.id("enterprises")),
    serverTimestamp: v.number(),
    createdAt: v.string(),
  })
    .index("by_enterprise", ["enterpriseId"])
    .index("by_user", ["authenticatedUserId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_session", ["sessionId"])
    .index("by_enterprise_timestamp", ["enterpriseId", "timestamp"]),

  health_checks: defineTable({
    timestamp: v.number(),
    status: v.string(),
    createdAt: v.string(),
  })
    .index("by_timestamp", ["timestamp"]),

  user_events: defineTable({
    event: v.string(),
    timestamp: v.number(),
    url: v.string(),
    userId: v.optional(v.string()),
    properties: v.optional(analyticsEventPropertiesValidator),
    sessionId: v.string(),
    userAgent: v.optional(v.string()),
    authenticatedUserId: v.optional(v.id("users")),
    enterpriseId: v.optional(v.id("enterprises")),
    serverTimestamp: v.number(),
    createdAt: v.string(),
  })
    .index("by_enterprise", ["enterpriseId"])
    .index("by_user", ["authenticatedUserId"])
    .index("by_event", ["event"])
    .index("by_timestamp", ["timestamp"])
    .index("by_session", ["sessionId"]),

  dashboardPreferences: defineTable({
    userId: v.id("users"),
    enabledMetrics: v.array(v.string()),
    metricOrder: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  ...agentTables,
  ...notificationTables,
  ...rateLimitTables,
  ...auditTables,
  ...memoryTables,
  ...episodicMemoryTables,
  ...memorySharingTables,
  ...collaborativeDocumentsSchema
});