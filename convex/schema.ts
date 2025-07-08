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

export const contractStatusOptions = [
  "draft", "pending_analysis", "active", "expired", "terminated", "archived",
] as const;


const analysisStatusOptions = [
    "pending", "processing", "completed", "failed",
] as const;

export const vendorCategoryOptions = [
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

export const contractTypeOptions = [
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
    contactName: v.optional(v.string()),
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
    performanceScore: v.optional(v.number()),
    totalContractValue: v.optional(v.number()),
    activeContracts: v.optional(v.number()),
    complianceScore: v.optional(v.number()),
    createdBy: v.optional(v.string()), // User ID or "system" for auto-created
    metadata: v.optional(v.any()), // Additional data for vendor agent
    createdAt: v.string(),
    updatedAt: v.optional(v.number()), // Track last update
    isDemo: v.optional(v.boolean()), // Flag for demo data
  })
  // Basic indexes
  .index("by_name", ["name"])
  .index("by_enterprise", ["enterpriseId"])
  .index("by_category_and_enterpriseId", ["enterpriseId", "category"])
  // Performance-optimized indexes
  .index("by_enterprise_name_category", ["enterpriseId", "name", "category"])
  .index("by_enterprise_status_created", ["enterpriseId", "status"])
  .index("by_enterprise_category_status", ["enterpriseId", "category", "status"])
  // New performance indexes for vendor analytics
  .index("by_enterprise_performance", ["enterpriseId", "performanceScore"])
  .index("by_enterprise_value", ["enterpriseId", "totalContractValue"])
  .index("by_enterprise_status_performance", ["enterpriseId", "status", "performanceScore"])
  .index("by_enterprise_created", ["enterpriseId", "createdAt"]),

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
    isAutoRenew: v.optional(v.boolean()), // Whether contract auto-renews
    // Ownership and tracking fields
    ownerId: v.optional(v.id("users")), // User responsible for the contract
    departmentId: v.optional(v.string()), // Department managing the contract
    createdBy: v.optional(v.id("users")), // User who created the contract
    lastModifiedBy: v.optional(v.id("users")), // User who last modified
    createdAt: v.string(),
    updatedAt: v.optional(v.number()), // Added for tracking updates
    isDemo: v.optional(v.boolean()), // Flag for demo data
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
  .index("by_enterprise_contractType_status", ["enterpriseId", "contractType", "status"])
  // Additional required indexes
  .index("by_enterprise_created", ["enterpriseId", "createdAt"])
  .index("by_enterprise_status_vendor", ["enterpriseId", "status", "vendorId"])
  // New performance-critical compound indexes
  .index("by_enterprise_endDate", ["enterpriseId", "extractedEndDate"])
  .index("by_enterprise_status_created", ["enterpriseId", "status", "createdAt"])
  .index("by_enterprise_owner_status", ["enterpriseId", "ownerId", "status"])
  .index("by_enterprise_value", ["enterpriseId", "value"])
  .index("by_enterprise_renewal", ["enterpriseId", "isAutoRenew", "extractedEndDate"]),

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
    expiresAt: v.optional(v.number()),
  })
    .index("by_enterprise_timestamp", ["enterpriseId", "timestamp"])
    .index("by_user", ["userId"])
    .index("by_processed", ["processed"])
    .index("by_processed_expires", ["processed", "expiresAt"]),

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

  // Stripe Integration Tables
  stripeCustomers: defineTable({
    enterpriseId: v.id("enterprises"),
    stripeCustomerId: v.string(),
    email: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_enterprise", ["enterpriseId"])
    .index("by_stripe_id", ["stripeCustomerId"]),

  subscriptions: defineTable({
    enterpriseId: v.id("enterprises"),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("incomplete"),
      v.literal("incomplete_expired"),
      v.literal("past_due"),
      v.literal("trialing"),
      v.literal("unpaid")
    ),
    plan: v.union(
      v.literal("starter"),
      v.literal("professional"),
      v.literal("enterprise")
    ),
    billingPeriod: v.union(
      v.literal("monthly"),
      v.literal("annual")
    ),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    canceledAt: v.optional(v.number()),
    trialEnd: v.optional(v.number()),
    metadata: v.optional(v.record(v.string(), v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_enterprise", ["enterpriseId"])
    .index("by_stripe_id", ["stripeSubscriptionId"])
    .index("by_status", ["status"]),

  paymentMethods: defineTable({
    enterpriseId: v.id("enterprises"),
    stripePaymentMethodId: v.string(),
    type: v.string(),
    card: v.optional(v.object({
      brand: v.string(),
      last4: v.string(),
      expMonth: v.number(),
      expYear: v.number(),
    })),
    isDefault: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_enterprise", ["enterpriseId"])
    .index("by_stripe_id", ["stripePaymentMethodId"]),

  invoices: defineTable({
    enterpriseId: v.id("enterprises"),
    stripeInvoiceId: v.string(),
    subscriptionId: v.optional(v.string()),
    status: v.string(),
    amount: v.number(),
    currency: v.string(),
    paid: v.boolean(),
    periodStart: v.number(),
    periodEnd: v.number(),
    dueDate: v.optional(v.number()),
    pdfUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_enterprise", ["enterpriseId"])
    .index("by_stripe_id", ["stripeInvoiceId"])
    .index("by_subscription", ["subscriptionId"]),

  usageRecords: defineTable({
    enterpriseId: v.id("enterprises"),
    subscriptionId: v.string(),
    metric: v.string(),
    quantity: v.number(),
    timestamp: v.number(),
    metadata: v.optional(v.record(v.string(), v.string())),
  })
    .index("by_enterprise", ["enterpriseId"])
    .index("by_subscription", ["subscriptionId"])
    .index("by_metric", ["metric"])
    .index("by_timestamp", ["timestamp"]),

  // ===== AI CHAT TABLES =====
  chatSessions: defineTable({
    userId: v.id("users"),
    enterpriseId: v.id("enterprises"),
    title: v.string(),
    messages: v.array(v.object({
      id: v.string(),
      role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
      content: v.string(),
      timestamp: v.string(),
      attachments: v.optional(v.array(v.object({
        type: v.union(v.literal("contract"), v.literal("vendor")),
        id: v.string(),
        title: v.string()
      }))),
      metadata: v.optional(v.object({
        model: v.optional(v.string()),
        tokens: v.optional(v.number()),
        processingTime: v.optional(v.number())
      }))
    })),
    context: v.optional(v.object({
      contractId: v.optional(v.id("contracts")),
      vendorId: v.optional(v.id("vendors")),
      enterpriseId: v.id("enterprises")
    })),
    createdAt: v.string(),
    updatedAt: v.string(),
    isActive: v.boolean()
  })
    .index("by_user", ["userId"])
    .index("by_enterprise", ["enterpriseId"])
    .index("by_created", ["createdAt"]),

  chatFeedback: defineTable({
    sessionId: v.id("chatSessions"),
    messageId: v.string(),
    userId: v.id("users"),
    feedback: v.union(v.literal("helpful"), v.literal("not_helpful")),
    comment: v.optional(v.string()),
    createdAt: v.string()
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

  // ===== AI INSIGHTS TABLES =====
  insightFeedback: defineTable({
    insightId: v.id("agentInsights"),
    agentId: v.id("agents"),
    feedback: v.union(v.literal("helpful"), v.literal("not_helpful"), v.literal("incorrect")),
    comment: v.optional(v.string()),
    userId: v.string(),
    createdAt: v.string()
  })
    .index("by_insight", ["insightId"])
    .index("by_agent", ["agentId"]),

  // ===== CONTRACT CLAUSES TABLE =====
  contractClauses: defineTable({
    contractId: v.id("contracts"),
    enterpriseId: v.id("enterprises"),
    clauseType: v.string(),
    present: v.boolean(),
    confidence: v.number(),
    extractedText: v.optional(v.string()),
    riskLevel: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    recommendations: v.array(v.string()),
    embedding: v.optional(v.array(v.number())),
    createdAt: v.string(),
    updatedAt: v.optional(v.string())
  })
    .index("by_contract", ["contractId"])
    .index("by_enterprise", ["enterpriseId"])
    .index("by_type", ["clauseType"])
    .index("by_risk", ["riskLevel"]),

  // ===== ANALYTICS CACHE TABLE =====
  analyticsCache: defineTable({
    key: v.string(),
    data: v.any(),
    timestamp: v.number(),
    expiresAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_expires", ["expiresAt"]),

  ...agentTables,
  ...notificationTables,
  ...rateLimitTables,
  ...auditTables,
  ...memoryTables,
  ...episodicMemoryTables,
  ...memorySharingTables,
  ...collaborativeDocumentsSchema,

  // ===== WEBHOOK MANAGEMENT =====
  webhooks: defineTable({
    enterpriseId: v.id("enterprises"),
    url: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    events: v.array(v.string()),
    secret: v.string(),
    isActive: v.boolean(),
    headers: v.record(v.string(), v.string()),
    retryConfig: v.object({
      maxRetries: v.number(),
      initialDelay: v.number(),
      maxDelay: v.number(),
    }),
    createdBy: v.id("users"),
    createdAt: v.string(),
    updatedAt: v.optional(v.string()),
    lastTriggeredAt: v.optional(v.string()),
    failureCount: v.number(),
    successCount: v.number(),
  })
    .index("by_enterprise", ["enterpriseId"])
    .index("by_active", ["isActive"])
    .index("by_enterprise_active", ["enterpriseId", "isActive"]),

  webhookDeliveries: defineTable({
    webhookId: v.id("webhooks"),
    event: v.string(),
    payload: v.any(),
    response: v.optional(v.string()),
    statusCode: v.optional(v.number()),
    success: v.boolean(),
    error: v.optional(v.string()),
    duration: v.number(),
    retryCount: v.number(),
    deliveredAt: v.string(),
  })
    .index("by_webhook", ["webhookId"])
    .index("by_delivered", ["deliveredAt"])
    .index("by_webhook_delivered", ["webhookId", "deliveredAt"]),

  // ===== API KEY MANAGEMENT =====
  apiKeys: defineTable({
    enterpriseId: v.id("enterprises"),
    name: v.string(),
    description: v.optional(v.string()),
    keyHash: v.string(), // Store hashed version
    keyPrefix: v.string(), // First 8 chars for identification
    permissions: v.array(v.string()),
    rateLimit: v.optional(v.object({
      requestsPerMinute: v.number(),
      requestsPerHour: v.number(),
      requestsPerDay: v.number(),
    })),
    expiresAt: v.optional(v.string()),
    lastUsedAt: v.optional(v.string()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.string(),
    revokedAt: v.optional(v.string()),
    revokedBy: v.optional(v.id("users")),
    metadata: v.optional(v.record(v.string(), v.string())),
  })
    .index("by_enterprise", ["enterpriseId"])
    .index("by_prefix", ["keyPrefix"])
    .index("by_active", ["isActive"])
    .index("by_enterprise_active", ["enterpriseId", "isActive"]),

  apiKeyUsage: defineTable({
    apiKeyId: v.id("apiKeys"),
    endpoint: v.string(),
    method: v.string(),
    statusCode: v.number(),
    responseTime: v.number(),
    ipAddress: v.string(),
    userAgent: v.optional(v.string()),
    timestamp: v.string(),
  })
    .index("by_key", ["apiKeyId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_key_timestamp", ["apiKeyId", "timestamp"]),

  // ===== BACKUP & RECOVERY =====
  backups: defineTable({
    enterpriseId: v.id("enterprises"),
    backupType: v.string(),
    status: v.union(
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("failed")
    ),
    description: v.optional(v.string()),
    includeAttachments: v.boolean(),
    selectedTables: v.optional(v.array(v.string())),
    size: v.number(), // in bytes
    recordCount: v.number(),
    storageId: v.optional(v.id("_storage")),
    createdBy: v.id("users"),
    createdAt: v.string(),
    completedAt: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_enterprise", ["enterpriseId"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  backupSchedules: defineTable({
    enterpriseId: v.id("enterprises"),
    schedule: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly")
    ),
    backupType: v.union(
      v.literal("full"),
      v.literal("incremental")
    ),
    time: v.string(), // HH:MM format
    timezone: v.string(),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.string(),
    updatedAt: v.optional(v.string()),
    lastRunAt: v.optional(v.string()),
    nextRunAt: v.optional(v.string()),
  })
    .index("by_enterprise", ["enterpriseId"])
    .index("by_active", ["isActive"])
    .index("by_next_run", ["nextRunAt"]),

  // ===== CONTRACT TEMPLATES =====
  contractTemplates: defineTable({
    enterpriseId: v.id("enterprises"),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    contractType: v.string(),
    content: v.object({
      sections: v.array(v.object({
        id: v.string(),
        title: v.string(),
        content: v.string(),
        isRequired: v.boolean(),
        variables: v.optional(v.array(v.object({
          name: v.string(),
          type: v.union(v.literal("text"), v.literal("date"), v.literal("number"), v.literal("select")),
          defaultValue: v.optional(v.string()),
          options: v.optional(v.array(v.string())),
          required: v.boolean(),
          description: v.optional(v.string()),
        }))),
      })),
      metadata: v.optional(v.object({
        estimatedValue: v.optional(v.number()),
        typicalDuration: v.optional(v.string()),
        requiredApprovals: v.optional(v.array(v.string())),
        tags: v.optional(v.array(v.string())),
      })),
    }),
    variables: v.array(v.object({
      name: v.string(),
      type: v.union(v.literal("text"), v.literal("date"), v.literal("number"), v.literal("select")),
      defaultValue: v.optional(v.string()),
      options: v.optional(v.array(v.string())),
      required: v.boolean(),
      description: v.optional(v.string()),
    })),
    isPublic: v.boolean(),
    isActive: v.boolean(),
    version: v.number(),
    tags: v.array(v.string()),
    usageCount: v.number(),
    createdBy: v.id("users"),
    createdAt: v.string(),
    updatedAt: v.string(),
    updatedBy: v.optional(v.id("users")),
    deletedAt: v.optional(v.string()),
    deletedBy: v.optional(v.id("users")),
    clonedFrom: v.optional(v.id("contractTemplates")),
  })
    .index("by_enterprise", ["enterpriseId"])
    .index("by_category", ["category"])
    .index("by_public", ["isPublic"])
    .index("by_active", ["isActive"]),

  templateVersions: defineTable({
    templateId: v.id("contractTemplates"),
    version: v.number(),
    content: v.any(),
    variables: v.array(v.any()),
    createdAt: v.string(),
    createdBy: v.id("users"),
    changes: v.string(),
  })
    .index("by_template", ["templateId"])
    .index("by_version", ["templateId", "version"]),

  templateUsage: defineTable({
    templateId: v.id("contractTemplates"),
    enterpriseId: v.id("enterprises"),
    userId: v.id("users"),
    contractTitle: v.string(),
    variableValues: v.record(v.string(), v.any()),
    usedAt: v.string(),
  })
    .index("by_template", ["templateId"])
    .index("by_enterprise", ["enterpriseId"])
    .index("by_user", ["userId"])
    .index("by_used", ["usedAt"]),

  // Backup metadata
  backupMetadata: defineTable({
    id: v.string(),
    timestamp: v.string(),
    type: v.union(v.literal("full"), v.literal("incremental")),
    version: v.string(),
    tables: v.array(v.string()),
    recordCount: v.number(),
    size: v.number(),
    location: v.string(),
    checksum: v.string(),
    status: v.union(v.literal("completed"), v.literal("failed"), v.literal("in_progress")),
    error: v.optional(v.string()),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_status", ["status"])
    .index("by_type", ["type"]),

  // Backup data storage (for local backups)
  backupData: defineTable({
    backupId: v.string(),
    data: v.string(), // JSON stringified backup data
    createdAt: v.number(),
  })
    .index("by_backupId", ["backupId"]),

  // Cache table for performance optimization
  cache: defineTable({
    key: v.string(),
    value: v.string(), // JSON stringified cached data
    expiresAt: v.number(),
    tags: v.array(v.string()),
    enterpriseId: v.optional(v.id("enterprises")),
    metadata: v.optional(v.object({
      type: v.string(),
      version: v.number(),
      compressed: v.optional(v.boolean()),
    })),
  })
    .index("by_key", ["key"])
    .index("by_enterprise", ["enterpriseId"])
    .index("by_expiry", ["expiresAt"])
    .index("by_tags", ["tags"]),

  // Query performance metrics
  queryMetrics: defineTable({
    name: v.string(),
    startTime: v.number(),
    duration: v.number(),
    rowsReturned: v.number(),
    cacheHit: v.boolean(),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
    timestamp: v.string(),
  })
    .index("by_name", ["name"])
    .index("by_timestamp", ["timestamp"])
    .index("by_duration", ["duration"])
});