// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Contract-related enums
const ContractStatus = {
  DRAFT: "draft",
  PENDING_REVIEW: "pending_review",
  IN_REVIEW: "in_review",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  PENDING_SIGNATURE: "pending_signature",
  PARTIALLY_SIGNED: "partially_signed",
  SIGNED: "signed",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
  ARCHIVED: "archived",
  TERMINATED: "terminated",
};

const ContractType = {
  SALES: "sales",
  SERVICE: "service",
  NDA: "nda",
  EMPLOYMENT: "employment",
  PARTNERSHIP: "partnership",
  LICENSING: "licensing",
  VENDOR: "vendor",
  CUSTOM: "custom",
};

// User-related enums
const UserRole = {
  SYSTEM_ADMIN: "system_admin",        // Can manage entire system
  ENTERPRISE_ADMIN: "enterprise_admin", // Can manage specific enterprise
  CONTRACT_ADMIN: "contract_admin",     // Can manage all contracts
  CONTRACT_MANAGER: "contract_manager", // Can manage assigned contracts
  CONTRACT_VIEWER: "contract_viewer",   // Read-only access
  TEMPLATE_ADMIN: "template_admin",     // Can manage templates
  ANALYTICS_USER: "analytics_user",     // Analytics access only
  VENDOR: "vendor",                     // External vendor access
  GUEST: "guest",                       // Limited time access
};

const UserStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  PENDING: "pending",
  SUSPENDED: "suspended",
  DEACTIVATED: "deactivated",
};

const AuthenticationType = {
  PASSWORD: "password",
  SSO: "sso",
  OAUTH: "oauth",
  LDAP: "ldap",
};

// Vendor-related enums
const VendorStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  PENDING: "pending",
  ONBOARDING: "onboarding",
  APPROVED: "approved",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
  BLOCKED: "blocked",
  ARCHIVED: "archived",
};

const VendorType = {
  SUPPLIER: "supplier",
  SERVICE_PROVIDER: "service_provider",
  MANUFACTURER: "manufacturer",
  DISTRIBUTOR: "distributor",
  CONTRACTOR: "contractor",
  CONSULTANT: "consultant",
  PARTNER: "partner",
  OTHER: "other",
};

const VendorCategory = {
  IT_SERVICES: "it_services",
  LEGAL: "legal",
  MARKETING: "marketing",
  FINANCE: "finance",
  HR: "hr",
  FACILITIES: "facilities",
  LOGISTICS: "logistics",
  MANUFACTURING: "manufacturing",
  PROFESSIONAL_SERVICES: "professional_services",
  SOFTWARE: "software",
  HARDWARE: "hardware",
  OFFICE_SUPPLIES: "office_supplies",
  UTILITIES: "utilities",
  TELECOMMUNICATIONS: "telecommunications",
  OTHER: "other",
};

const RiskLevel = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

const ComplianceStatus = {
  COMPLIANT: "compliant",
  NON_COMPLIANT: "non_compliant",
  PENDING_REVIEW: "pending_review",
  REQUIRES_ACTION: "requires_action",
  EXEMPTED: "exempted",
  NOT_APPLICABLE: "not_applicable",
};

const ContactType = {
  PRIMARY: "primary",
  BILLING: "billing",
  LEGAL: "legal",
  TECHNICAL: "technical",
  SALES: "sales",
  SUPPORT: "support",
  OTHER: "other",
};

export default defineSchema({
  // ============= ENTERPRISE STRUCTURE =============
  
  // Enterprises table
  enterprises: defineTable({
    name: v.string(),
    domain: v.string(),
    industry: v.optional(v.string()),
    size: v.optional(v.string()), // e.g., "small", "medium", "large"
    logo: v.optional(v.string()), // URL to logo
    primaryColor: v.optional(v.string()), // Brand color
    secondaryColor: v.optional(v.string()), // Secondary brand color
    settings: v.optional(v.any()), // Enterprise-level settings
    features: v.optional(v.array(v.string())), // Enabled features
    plan: v.string(), // e.g., "free", "standard", "premium"
    planExpiry: v.optional(v.string()), // ISO date string
    isActive: v.boolean(),
    createdAt: v.string(), // ISO date string
    updatedAt: v.optional(v.string()), // ISO date string
  })
  .index("by_domain", ["domain"]),

  // Departments table
  departments: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    enterpriseId: v.id("enterprises"),
    managerId: v.optional(v.id("users")),
    parentDepartmentId: v.optional(v.id("departments")),
    createdAt: v.string(), // ISO date string
    updatedAt: v.optional(v.string()), // ISO date string
  })
  .index("by_enterprise", ["enterpriseId"]),

  // Brands table
  brands: defineTable({
    name: v.string(),
    logo: v.optional(v.string()), // URL to logo
    primaryColor: v.string(),
    secondaryColor: v.optional(v.string()),
    enterpriseId: v.id("enterprises"),
    createdAt: v.string(), // ISO date string
    updatedAt: v.optional(v.string()), // ISO date string
  })
  .index("by_enterprise", ["enterpriseId"]),

  // ============= USER MANAGEMENT =============
  
  // Users table
  users: defineTable({    
    // Basic user information
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    title: v.optional(v.string()),
    department: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")), // Add this field
    role: v.string(), // Uses UserRole values
    status: v.string(), // Uses UserStatus values
    isActive: v.boolean(),
    isEmailVerified: v.boolean(),
    authId: v.string(), // Store the identity.subject from auth provider here
    authType: v.string(), // Uses AuthenticationType values
    
    // Enterprise association
    enterpriseId: v.id("enterprises"),
    allowedDomains: v.optional(v.array(v.string())),
    brandAccess: v.optional(v.array(v.id("brands"))),
    
    // User preferences
    language: v.string(),
    timezone: v.string(),
    dateFormat: v.string(),
    
    // Notification preferences
    notificationPreferences: v.object({
      emailEnabled: v.boolean(),
      inAppEnabled: v.boolean(),
      smsEnabled: v.boolean(),
      contractNotifications: v.boolean(),
      approvalNotifications: v.boolean(),
      signatureNotifications: v.boolean(),
      analyticsNotifications: v.boolean(),
    }),
    
    // Security preferences
    securityPreferences: v.object({
      mfaEnabled: v.boolean(),
      mfaType: v.optional(v.string()),
      ipWhitelist: v.optional(v.array(v.string())),
      allowedDevices: v.optional(v.array(v.string())),
      sessionTimeout: v.number(),
    }),
    
    // Auth and security
    hashedPassword: v.optional(v.string()),
    mfaSecret: v.optional(v.string()),
    failedLoginAttempts: v.number(),
    lockedUntil: v.optional(v.string()), // ISO date string
    lastActiveIp: v.optional(v.string()),
    
    // Permission tracking
    permissions: v.array(v.string()),
    accessibleContracts: v.array(v.id("contracts")),
    accessibleTemplates: v.array(v.id("templates")),
    accessibleDepartments: v.array(v.id("departments")),
    
    // Usage metrics
    contractsCreated: v.number(),
    contractsSigned: v.number(),
    templatesCreated: v.number(),
    activeSessions: v.number(),
    
    // Timestamps
    createdAt: v.string(), // ISO date string
    updatedAt: v.optional(v.string()), // ISO date string
    lastLogin: v.optional(v.string()), // ISO date string
    passwordChangedAt: v.optional(v.string()), // ISO date string
    emailVerifiedAt: v.optional(v.string()), // ISO date string
  })
  .index("by_email", ["email"])
  .index("by_enterprise", ["enterpriseId"])
  .index("by_role", ["role"])
  .index("by_authId", ["authId"])
  .index("by_department", ["departmentId"]), 

  // User sessions
  userSessions: defineTable({
    userId: v.id("users"),
    sessionId: v.string(),
    token: v.string(),
    expiresAt: v.string(), // ISO date string
    ipAddress: v.string(),
    userAgent: v.string(),
    deviceInfo: v.optional(v.any()),
    isActive: v.boolean(),
    createdAt: v.string(), // ISO date string
    lastActiveAt: v.optional(v.string()), // ISO date string
  })
  .index("by_user", ["userId"])
  .index("by_token", ["token"]),

  // User login attempts (for security monitoring)
  userLoginAttempts: defineTable({
    userId: v.id("users"),
    timestamp: v.string(), // ISO date string
    ipAddress: v.string(),
    userAgent: v.string(),
    success: v.boolean(),
    failureReason: v.optional(v.string()),
  })
  .index("by_user", ["userId"]),

  // Password reset tokens
  passwordResetTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.string(), // ISO date string
    isUsed: v.boolean(),
    createdAt: v.string(), // ISO date string
    usedAt: v.optional(v.string()), // ISO date string
  })
  .index("by_token", ["token"])
  .index("by_user", ["userId"]),

  // Email verification tokens
  emailVerificationTokens: defineTable({
    userId: v.id("users"),
    email: v.string(),
    token: v.string(),
    expiresAt: v.string(), // ISO date string
    isUsed: v.boolean(),
    createdAt: v.string(), // ISO date string
    usedAt: v.optional(v.string()), // ISO date string
  })
  .index("by_token", ["token"])
  .index("by_user", ["userId"]),

  // User notifications
  userNotifications: defineTable({
    userId: v.id("users"),
    type: v.string(), // e.g., "contract_expiry", "approval_request", etc.
    title: v.string(),
    message: v.string(),
    linkUrl: v.optional(v.string()),
    isRead: v.boolean(),
    metadata: v.optional(v.any()),
    createdAt: v.string(), // ISO date string
    readAt: v.optional(v.string()), // ISO date string
  })
  .index("by_user", ["userId"])
  .index("by_user_and_read", ["userId", "isRead"]),

  // User activity log
  userActivityLog: defineTable({
    userId: v.id("users"),
    action: v.string(), // e.g., "login", "create_contract", "approve", etc.
    resourceType: v.optional(v.string()), // e.g., "contract", "template", etc.
    resourceId: v.optional(v.string()), // ID of the affected resource
    details: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.string(), // ISO date string
  })
  .index("by_user", ["userId"]),
  
  // ============= VENDOR MANAGEMENT =============

  // Vendors table
  vendors: defineTable({
    // Basic information
    name: v.string(),
    vendorType: v.string(), // Using VendorType values
    category: v.string(), // Using VendorCategory values
    status: v.string(), // Using VendorStatus values
    taxId: v.optional(v.string()),
    registrationNumber: v.optional(v.string()),
    website: v.optional(v.string()), // URL stored as string
    description: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    currency: v.string(),
    
    // Address information (embedded objects)
    primaryAddress: v.optional(v.object({
      street1: v.string(),
      street2: v.optional(v.string()),
      city: v.string(),
      state: v.string(),
      postalCode: v.string(),
      country: v.string(),
      isPrimary: v.boolean(),
      addressType: v.string(),
    })),
    billingAddress: v.optional(v.object({
      street1: v.string(),
      street2: v.optional(v.string()),
      city: v.string(),
      state: v.string(),
      postalCode: v.string(),
      country: v.string(),
      isPrimary: v.boolean(),
      addressType: v.string(),
    })),
    
    // Additional details
    industry: v.optional(v.string()),
    yearEstablished: v.optional(v.number()),
    companySize: v.optional(v.string()),
    diversityClassifications: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
    
    // References
    enterpriseId: v.id("enterprises"),
    departmentId: v.optional(v.id("departments")),
    
    // Tracking
    createdAt: v.string(), // ISO date string
    updatedAt: v.optional(v.string()), // ISO date string
    createdById: v.id("users"),
    lastAccessedAt: v.optional(v.string()), // ISO date string
    lastAccessedById: v.optional(v.id("users")),
  })
  .index("by_enterprise", ["enterpriseId"])
  .index("by_status", ["status"])
  .index("by_category", ["category"])
  .index("by_type", ["vendorType"]),

  // Vendor contacts
  vendorContacts: defineTable({
    vendorId: v.id("vendors"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.string(), // Email stored as string
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
    contactType: v.string(), // Using ContactType values
    isPrimary: v.boolean(),
    notes: v.optional(v.string()),
    createdAt: v.string(), // ISO date string
    updatedAt: v.optional(v.string()), // ISO date string
    createdById: v.id("users"),
  })
  .index("by_vendor", ["vendorId"])
  .index("by_email", ["email"])
  .index("by_primary", ["vendorId", "isPrimary"]),

  // Vendor documents
  vendorDocuments: defineTable({
    vendorId: v.id("vendors"),
    documentType: v.string(),
    documentName: v.string(),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    expirationDate: v.optional(v.string()), // ISO date string
    isConfidential: v.boolean(),
    fileUrl: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
    createdAt: v.string(), // ISO date string
    createdById: v.id("users"),
    downloadedCount: v.number(),
    lastDownloadedAt: v.optional(v.string()), // ISO date string
    isExpired: v.boolean(),
  })
  .index("by_vendor", ["vendorId"])
  .index("by_document_type", ["documentType"])
  .index("by_expiration", ["expirationDate"]),

  // Vendor risk assessments
  vendorRiskAssessments: defineTable({
    vendorId: v.id("vendors"),
    riskScore: v.number(),
    riskLevel: v.string(), // Using RiskLevel values
    assessedAt: v.string(), // ISO date string
    assessedById: v.id("users"),
    nextAssessmentDate: v.optional(v.string()), // ISO date string
    riskFactors: v.array(v.object({
      factorName: v.string(),
      factorScore: v.number(),
      weight: v.number(),
      description: v.string(),
      recommendations: v.optional(v.array(v.string())),
    })),
    previousScore: v.optional(v.number()),
    scoreChange: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
  .index("by_vendor", ["vendorId"])
  .index("by_risk_level", ["riskLevel"])
  .index("by_next_assessment", ["nextAssessmentDate"]),

  // Vendor compliance checks
  vendorCompliance: defineTable({
    vendorId: v.id("vendors"),
    complianceType: v.string(), // e.g., "data_privacy", "security", "financial"
    status: v.string(), // Using ComplianceStatus values
    lastCheckedAt: v.string(), // ISO date string
    checkedById: v.id("users"),
    nextCheckDate: v.optional(v.string()), // ISO date string
    expirationDate: v.optional(v.string()), // ISO date string for certifications
    findings: v.optional(v.array(v.string())),
    remediationPlan: v.optional(v.string()),
    remediationDeadline: v.optional(v.string()), // ISO date string
    documents: v.optional(v.array(v.id("vendorDocuments"))),
    notes: v.optional(v.string()),
  })
  .index("by_vendor", ["vendorId"])
  .index("by_status", ["status"])
  .index("by_type", ["complianceType"]),

  // Vendor analytics
  vendorAnalytics: defineTable({
    vendorId: v.id("vendors"),
    periodStart: v.string(), // ISO date string
    periodEnd: v.string(), // ISO date string
    
    // Metrics
    totalSpend: v.number(),
    contractCount: v.number(),
    activeContractCount: v.number(),
    averageContractValue: v.number(),
    paymentPerformance: v.any(), // Complex nested object
    contractPerformance: v.any(), // Complex nested object
    spendByCategory: v.any(), // Dict of category -> amount
    spendByDepartment: v.any(), // Dict of department -> amount
    spendTrend: v.array(v.any()), // Time series data
    
    // Additional analytics
    savingsAnalysis: v.optional(v.any()),
    performanceMetrics: v.optional(v.any()),
    contractMetrics: v.optional(v.any()),
    
    updatedAt: v.string(), // ISO date string
  })
  .index("by_vendor", ["vendorId"]),

  // Vendor performance reviews
  vendorPerformanceReviews: defineTable({
    vendorId: v.id("vendors"),
    reviewerId: v.id("users"),
    reviewPeriodStart: v.string(), // ISO date string
    reviewPeriodEnd: v.string(), // ISO date string
    overallScore: v.number(), // e.g., 1-10 or 1-5
    categories: v.array(v.object({
      categoryName: v.string(), // e.g., "quality", "timeliness", "value"
      score: v.number(),
      comments: v.optional(v.string()),
    })),
    strengths: v.optional(v.array(v.string())),
    weaknesses: v.optional(v.array(v.string())),
    recommendations: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    createdAt: v.string(), // ISO date string
    updatedAt: v.optional(v.string()), // ISO date string
  })
  .index("by_vendor", ["vendorId"])
  .index("by_reviewer", ["reviewerId"]),

  // Vendor relationship history (important events, issues, etc.)
  vendorRelationshipLogs: defineTable({
    vendorId: v.id("vendors"),
    logType: v.string(), // e.g., "issue", "milestone", "meeting", "note"
    title: v.string(),
    description: v.string(),
    severity: v.optional(v.string()), // For issues: "low", "medium", "high"
    status: v.optional(v.string()), // For issues/milestones: "open", "closed", "in_progress"
    tags: v.optional(v.array(v.string())),
    createdAt: v.string(), // ISO date string
    createdById: v.id("users"),
    updatedAt: v.optional(v.string()), // ISO date string
    resolvedAt: v.optional(v.string()), // ISO date string
    relatedDocuments: v.optional(v.array(v.id("vendorDocuments"))),
    relatedContracts: v.optional(v.array(v.id("contracts"))),
  })
  .index("by_vendor", ["vendorId"])
  .index("by_type", ["logType"])
  .index("by_status", ["status"]),

  // ============= CONTRACT MANAGEMENT =============
  
  // Templates table
  templates: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    contractType: v.string(),
    fileUrl: v.optional(v.string()),
    content: v.optional(v.string()),
    version: v.number(),
    enterpriseId: v.id("enterprises"),
    createdBy: v.id("users"),
    createdAt: v.string(),
    updatedAt: v.optional(v.string()),
  })
  .index("by_enterprise", ["enterpriseId"]),

  // Contracts table (main entity)
  contracts: defineTable({
    // Basic information
    title: v.string(),
    description: v.optional(v.string()),
    contractNumber: v.string(),
    status: v.string(), // Using the ContractStatus enum values
    contractType: v.string(), // Using the ContractType enum values
    
    // References
    enterpriseId: v.id("enterprises"),
    vendorId: v.id("vendors"),
    departmentId: v.optional(v.id("departments")),
    templateId: v.optional(v.id("templates")),
    createdById: v.id("users"),
    currentAssigneeId: v.optional(v.id("users")),
    
    // Enhanced date management
    effectiveDate: v.optional(v.string()),
    expiresAt: v.optional(v.string()),
    autoRenewal: v.boolean(),
    renewalNotificationDays: v.optional(v.number()),
    termsLength: v.optional(v.number()),
    noticePeriodDays: v.optional(v.number()),
    
    // Enhanced financial tracking
    currency: v.string(),
    value: v.optional(v.number()),
    paymentTerms: v.optional(v.object({
      paymentFrequency: v.string(),
      paymentMethod: v.string(),
      paymentDays: v.number(),
      earlyPaymentDiscount: v.optional(v.number()),
      latePaymentPenalty: v.optional(v.number()),
    })),
    paymentSchedule: v.optional(v.any()),
    renewalTerms: v.optional(v.any()),
    
    // Enhanced compliance and legal
    governingLaw: v.optional(v.string()),
    jurisdiction: v.optional(v.string()),
    complianceStatus: v.optional(v.object({
      isCompliant: v.boolean(),
      complianceChecks: v.array(v.any()),
      lastReviewDate: v.string(),
      nextReviewDate: v.string(),
      requiredCertifications: v.array(v.string()),
    })),
    riskAssessment: v.optional(v.object({
      riskScore: v.number(),
      riskFactors: v.array(v.string()),
      mitigationSteps: v.array(v.string()),
      lastAssessedAt: v.string(),
    })),
    legalReviewStatus: v.optional(v.string()),
    
    // Document configuration
    documentLanguage: v.optional(v.string()),
    isPublic: v.boolean(),
    watermark: v.boolean(),
    contentHash: v.optional(v.string()),
    version: v.number(),
    sharingToken: v.optional(v.string()),
    
    // Custom fields
    customFields: v.optional(v.any()),
    contractMetadata: v.optional(v.any()),
    notes: v.optional(v.string()),
    
    // Enhanced tracking
    createdAt: v.string(),
    updatedAt: v.optional(v.string()),
    approvedAt: v.optional(v.string()),
    cancelledAt: v.optional(v.string()),
    terminatedAt: v.optional(v.string()),
    lastAccessedAt: v.optional(v.string()),
    
    // Analytics
    accessCount: v.number(),
    signatureCompletedAt: v.optional(v.string()),
    timeToSign: v.optional(v.number()),
    timeToApprove: v.optional(v.number()),
    negotiationTime: v.optional(v.number()),
    modificationCount: v.number(),
    
    // Workflow
    approvalChain: v.optional(v.any()),
    approvalDeadline: v.optional(v.string()),
    approvalReminderSent: v.boolean(),
    relatedContracts: v.optional(v.any()),
    tags: v.optional(v.array(v.string())),
  })
  .index("by_enterprise", ["enterpriseId"])
  .index("by_vendor", ["vendorId"])
  .index("by_status", ["status"])
  .index("by_type", ["contractType"])
  .index("by_created_by", ["createdById"])
  .index("by_expires_at", ["expiresAt"]),

  // Contract revisions
  contractRevisions: defineTable({
    contractId: v.id("contracts"),
    version: v.number(),
    contentHash: v.optional(v.string()),
    content: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    changesSummary: v.optional(v.string()),
    reviewStatus: v.optional(v.string()),
    reviewNotes: v.optional(v.string()),
    redlineUrl: v.optional(v.string()),
    versionMetadata: v.optional(v.any()),
    modifiedSections: v.optional(v.any()),
    createdById: v.id("users"),
    reviewedById: v.optional(v.id("users")),
    createdAt: v.string(),
    reviewedAt: v.optional(v.string()),
  })
  .index("by_contract", ["contractId"]),

  // Contract shares
  contractShares: defineTable({
    contractId: v.id("contracts"),
    sharedByUserId: v.id("users"),
    sharedWithEmail: v.string(),
    shareLink: v.string(),
    sharePassword: v.optional(v.string()),
    isActive: v.boolean(),
    permissions: v.any(), // Dictionary of permissions
    watermark: v.boolean(),
    expiresAt: v.optional(v.string()),
    maxViews: v.optional(v.number()),
    notifyOnAccess: v.boolean(),
    requireAuthentication: v.boolean(),
    accessCount: v.number(),
    accessLog: v.optional(v.any()),
    createdAt: v.string(),
    lastAccessedAt: v.optional(v.string()),
  })
  .index("by_contract", ["contractId"]),

  // Signatures
  signatures: defineTable({
    contractId: v.id("contracts"),
    userId: v.optional(v.id("users")),
    signerEmail: v.string(),
    signerName: v.string(),
    signerTitle: v.optional(v.string()),
    signatureType: v.string(), // e.g., "electronic", "digital", "wet"
    signatureData: v.optional(v.string()), // Could be a URL or actual signature data
    signedAt: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    status: v.string(), // e.g., "pending", "completed", "rejected"
    verificationMethod: v.optional(v.string()), // How the signature was verified
    sequence: v.number(), // Order in which signatures are collected
    expiresAt: v.optional(v.string()),
    notifiedAt: v.optional(v.string()),
    reminderCount: v.number(),
    createdAt: v.string(),
  })
  .index("by_contract", ["contractId"]),

  // Contract approvers (for many-to-many relationship)
  contractApprovers: defineTable({
    contractId: v.id("contracts"),
    userId: v.id("users"),
    approvalStatus: v.string(), // e.g., "pending", "approved", "rejected"
    approvalStep: v.number(), // Sequence number in approval chain
    comments: v.optional(v.string()),
    approvedAt: v.optional(v.string()),
    rejectedAt: v.optional(v.string()),
    reminderSent: v.boolean(),
    reminderCount: v.number(),
    createdAt: v.string(),
  })
  .index("by_contract", ["contractId"])
  .index("by_user", ["userId"]),
});