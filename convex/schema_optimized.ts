// convex/schema_optimized.ts
// This file contains the optimized schema with consolidated indexes
// It should replace the current schema.ts after testing

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
  "technology",    
  "marketing",     
  "legal",         
  "finance",       
  "hr",            
  "facilities",    
  "logistics",     
  "manufacturing", 
  "consulting",    
  "other"          
] as const;

export type VendorCategory = typeof vendorCategoryOptions[number];

const contractTypeOptions = [
  "nda",             
  "msa",             
  "sow",             
  "saas",            
  "lease",           
  "employment",      
  "partnership",     
  "other"            
] as const;

export type ContractTypeEnum = typeof contractTypeOptions[number];

export const userRoleOptions = [
  "owner",   
  "admin",   
  "manager", 
  "user",    
  "viewer",  
] as const;

export type UserRole = typeof userRoleOptions[number];

// ============================================================================
// OPTIMIZED SCHEMA DEFINITION
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
    parentEnterpriseId: v.optional(v.id("enterprises")),
    isParentOrganization: v.optional(v.boolean()),
    accessPin: v.optional(v.string()),
    allowChildOrganizations: v.optional(v.boolean()),
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

  // ===== VENDORS (OPTIMIZED) =====
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
    createdBy: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.string(),
    updatedAt: v.optional(v.number()),
    isDemo: v.optional(v.boolean()),
  })
    // Consolidated indexes for vendors
    .index("by_enterprise_status_created", ["enterpriseId", "status", "createdAt"])
    .index("by_enterprise_name", ["enterpriseId", "name"])
    .index("by_enterprise_category", ["enterpriseId", "category"]),

  // ===== CONTRACTS (HEAVILY OPTIMIZED) =====
  contracts: defineTable({
    enterpriseId: v.id("enterprises"),
    vendorId: v.optional(v.id("vendors")),
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
    value: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    extractedParties: v.optional(v.array(v.string())),
    extractedAddress: v.optional(v.string()),
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
    ownerId: v.optional(v.id("users")),
    departmentId: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    lastModifiedBy: v.optional(v.id("users")),
    createdAt: v.string(),
    updatedAt: v.optional(v.number()),
    isDemo: v.optional(v.boolean()),
  })
    // OPTIMIZED: Reduced from 14 to 6 composite indexes
    .index("by_enterprise_status_vendor", ["enterpriseId", "status", "vendorId"])
    .index("by_enterprise_created", ["enterpriseId", "createdAt"])
    .index("by_enterprise_type", ["enterpriseId", "contractType"])
    .index("by_enterprise_analysis", ["enterpriseId", "analysisStatus"])
    .index("by_enterprise_owner", ["enterpriseId", "ownerId"])
    .index("by_enterprise_endDate", ["enterpriseId", "extractedEndDate"]),

  // ===== CONTRACT ASSIGNMENTS =====
  contractAssignments: defineTable({
    contractId: v.id("contracts"),
    userId: v.id("users"),
    assignedBy: v.id("users"),
    assignmentType: v.union(
      v.literal("owner"),
      v.literal("reviewer"),
      v.literal("approver"),
      v.literal("watcher")
    ),
    assignedAt: v.string(),
    unassignedAt: v.optional(v.string()),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
  })
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
    .index("by_contract_time", ["contractId", "changedAt"]),

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
    .index("by_next_check", ["nextCheckDue"]),

  // ===== BUDGETS =====
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
    committedAmount: v.number(),
    startDate: v.string(),
    endDate: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("exceeded"),
      v.literal("at_risk"),
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
    .index("by_enterprise_status", ["enterpriseId", "status"]),

  // ===== CONTRACT-BUDGET ALLOCATIONS =====
  contractBudgetAllocations: defineTable({
    contractId: v.id("contracts"),
    budgetId: v.id("budgets"),
    allocatedAmount: v.number(),
    allocationType: v.union(
      v.literal("full"),
      v.literal("prorated"),
      v.literal("custom")
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

  // ===== PRESENCE SYSTEM (OPTIMIZED) =====
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
    .index("by_enterprise_online", ["enterpriseId", "isOnline"]),

  // ===== REAL-TIME EVENTS (OPTIMIZED) =====
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
    // Add TTL field for automatic cleanup
    expiresAt: v.optional(v.number()),
  })
    .index("by_enterprise_timestamp", ["enterpriseId", "timestamp"])
    .index("by_processed_expires", ["processed", "expiresAt"]),

  // ===== TYPING INDICATORS (OPTIMIZED) =====
  typingIndicators: defineTable({
    userId: v.id("users"),
    enterpriseId: v.id("enterprises"),
    resourceId: v.string(),
    resourceType: v.string(),
    field: v.optional(v.string()),
    lastTyped: v.string(),
  })
    .index("by_resource", ["resourceId", "resourceType"]),

  // ===== MONITORING & ANALYTICS (OPTIMIZED) =====
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
    // Add TTL for automatic cleanup
    expiresAt: v.optional(v.number()),
  })
    .index("by_enterprise_event_time", ["enterpriseId", "event", "timestamp"]),

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
    // Add TTL for automatic cleanup
    expiresAt: v.optional(v.number()),
  })
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
    .index("by_enterprise_event", ["enterpriseId", "event"])
    .index("by_user_timestamp", ["authenticatedUserId", "timestamp"]),

  dashboardPreferences: defineTable({
    userId: v.id("users"),
    enabledMetrics: v.array(v.string()),
    metricOrder: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // ===== STRIPE TABLES (keeping as-is) =====
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
    .index("by_enterprise_metric", ["enterpriseId", "metric"])
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
    .index("by_user_active", ["userId", "isActive"])
    .index("by_enterprise", ["enterpriseId"]),

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
    .index("by_enterprise_type", ["enterpriseId", "clauseType"])
    .index("by_risk", ["riskLevel"]),

  // ===== ANALYTICS CACHE TABLE (NEW) =====
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
  ...collaborativeDocumentsSchema
});