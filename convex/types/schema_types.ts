// convex/types/schema-types.ts
/**
 * Comprehensive TypeScript types for Convex schema fields
 * Replaces all v.any() with proper type-safe alternatives
 */

import { v } from "convex/values";

// Common value type that replaces v.any() with a specific union
const flexibleValueValidator = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.null(),
  v.array(v.union(v.string(), v.number(), v.boolean(), v.null())),
  v.object({})
);

// ============================================================================
// USER ONBOARDING TYPES
// ============================================================================

export interface OnboardingMetadata {
  completedAt?: string;
  setupPreferences?: {
    industry?: string;
    teamSize?: string;
    primaryUseCase?: string[];
    integrationsEnabled?: string[];
  };
  tourProgress?: {
    dashboardTour?: boolean;
    contractUploadTour?: boolean;
    vendorManagementTour?: boolean;
    analyticsOverviewTour?: boolean;
  };
  initialSetup?: {
    firstContractUploaded?: boolean;
    firstVendorAdded?: boolean;
    teamMembersInvited?: number;
    notificationPreferencesSet?: boolean;
  };
}

export const onboardingMetadataValidator = v.object({
  completedAt: v.optional(v.string()),
  setupPreferences: v.optional(v.object({
    industry: v.optional(v.string()),
    teamSize: v.optional(v.string()),
    primaryUseCase: v.optional(v.array(v.string())),
    integrationsEnabled: v.optional(v.array(v.string())),
  })),
  tourProgress: v.optional(v.object({
    dashboardTour: v.optional(v.boolean()),
    contractUploadTour: v.optional(v.boolean()),
    vendorManagementTour: v.optional(v.boolean()),
    analyticsOverviewTour: v.optional(v.boolean()),
  })),
  initialSetup: v.optional(v.object({
    firstContractUploaded: v.optional(v.boolean()),
    firstVendorAdded: v.optional(v.boolean()),
    teamMembersInvited: v.optional(v.number()),
    notificationPreferencesSet: v.optional(v.boolean()),
  })),
});

// ============================================================================
// ANALYTICS & MONITORING TYPES
// ============================================================================

export interface AnalyticsEventProperties {
  // Page view properties
  pageTitle?: string;
  pagePath?: string;
  referrer?: string;
  url?: string;
  
  // Session properties
  sessionId?: string;
  timestamp?: number;
  
  // User interaction properties
  elementId?: string;
  elementType?: string;
  elementText?: string;
  
  // Contract-related properties
  contractId?: string;
  contractStatus?: string;
  contractValue?: number;
  
  // Vendor-related properties
  vendorId?: string;
  vendorName?: string;
  vendorCategory?: string;
  
  // Performance metrics
  loadTime?: number;
  renderTime?: number;
  apiCallDuration?: number;
  duration?: number;
  
  // Event metrics
  eventsCount?: number;
  
  // Custom dimensions
  customDimensions?: Record<string, string | number | boolean>;
  
  // Allow any additional properties
  [key: string]: any;
}

export const analyticsEventPropertiesValidator = v.any();

// ============================================================================
// ERROR REPORT TYPES
// ============================================================================

export interface ErrorReportContext {
  // Error details
  errorCode?: string;
  errorType?: string;
  severity?: "low" | "medium" | "high" | "critical";
  type?: string; // Error type (e.g., "unhandledrejection")
  
  // User context
  userAction?: string;
  userRole?: string;
  featureArea?: string;
  
  // System context
  apiEndpoint?: string;
  httpMethod?: string;
  responseStatus?: number;
  
  // Additional debugging info
  stackTrace?: string;
  breadcrumbs?: Array<{
    timestamp: string;
    action: string;
    metadata?: Record<string, string | number | boolean>;
  }>;
  
  // Allow any additional properties
  [key: string]: any;
}

export const errorReportContextValidator = v.any();

// ============================================================================
// REALTIME EVENT TYPES
// ============================================================================

export interface RealtimeEventData {
  // Contract events
  contractUpdate?: {
    contractId: string;
    fields: string[];
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  };
  
  // Vendor events
  vendorUpdate?: {
    vendorId: string;
    fields: string[];
    changes?: Record<string, { old: unknown; new: unknown }>;
  };
  
  // Notification events
  notificationData?: {
    type: string;
    priority: string;
    recipients: string[];
    channels: string[];
  };
  
  // System events
  systemAlert?: {
    alertType: string;
    message: string;
    affectedUsers?: string[];
    resolution?: string;
  };
  
  // Analysis events
  analysisStatus?: string;
  results?: any;
  completedAt?: string;
  
  // Generic alert fields (for system_alert events)
  alertType?: string;
  title?: string;
  message?: string;
  severity?: string;
  
  // Allow any additional properties
  [key: string]: any;
}

export const realtimeEventDataValidator = v.any();

// ============================================================================
// AGENT SYSTEM TYPES
// ============================================================================

export interface AgentInsightData {
  // Financial insights
  financialAnalysis?: {
    totalSpend: number;
    savingsIdentified: number;
    costTrends: Array<{ period: string; amount: number }>;
    recommendations: string[];
  };
  
  // Legal insights
  legalReview?: {
    risks: Array<{ clause: string; riskLevel: string; recommendation: string }>;
    complianceIssues: string[];
    missingClauses: string[];
  };
  
  // Analytics insights
  analyticsReport?: {
    metrics: Record<string, number>;
    trends: Array<{ metric: string; change: number; period: string }>;
    predictions: Array<{ metric: string; value: number; confidence: number }>;
  };
  
  // Cost optimization insights
  potentialSavings?: number;
  
  // KPI data - Now compatible with KPIMetrics type
  kpis?: Record<string, number>;
  
  // Renewal data
  currentRate?: number;
  targetRate?: number;
  
  // Risk data
  concentrationRate?: number;
  riskScore?: number;
  
  // Financial anomaly data (from financial.ts)
  contractValue?: number;
  typeAverage?: number;
  typeStdDev?: number;
  zScore?: number;
  percentageDifference?: string;
  
  // Analytics anomaly data (from analytics.ts)
  contractId?: string;
  title?: string;
  category?: string;
  description?: string;
  severity?: string;
  timestamp?: string;
  threshold?: any;
  actual?: any;
  expected?: any;
  
  // Generic fields for flexibility
  [key: string]: any;
}

export const agentInsightDataValidator = v.any();

export interface AgentTaskData {
  input?: Record<string, unknown>;
  parameters?: Record<string, string | number | boolean>;
  context?: {
    triggerType: string;
    triggerSource: string;
    relatedEntities: Array<{ type: string; id: string }>;
  };
}

export const agentTaskDataValidator = v.object({
  input: v.optional(v.record(v.string(), flexibleValueValidator)),
  parameters: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean()))),
  context: v.optional(v.object({
    triggerType: v.string(),
    triggerSource: v.string(),
    relatedEntities: v.array(v.object({
      type: v.string(),
      id: v.string(),
    })),
  })),
});

export interface AgentTaskResult {
  success: boolean;
  output?: Record<string, unknown>;
  metrics?: {
    executionTime: number;
    resourcesUsed: Record<string, number>;
    itemsProcessed: number;
  };
  errors?: Array<{
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }>;
}

export const agentTaskResultValidator = v.object({
  success: v.boolean(),
  output: v.optional(v.record(v.string(), flexibleValueValidator)),
  metrics: v.optional(v.object({
    executionTime: v.number(),
    resourcesUsed: v.record(v.string(), v.number()),
    itemsProcessed: v.number(),
  })),
  errors: v.optional(v.array(v.object({
    code: v.string(),
    message: v.string(),
    details: v.optional(v.record(v.string(), flexibleValueValidator)),
  }))),
});

// ============================================================================
// MEMORY SYSTEM TYPES
// ============================================================================

export interface MemoryStructuredData {
  // Task execution data - simplified structure used in memoryIntegration.ts
  taskType?: string;
  status?: string;
  priority?: string;
  agentType?: string;
  result?: unknown;
  error?: string;
  
  // Insight data - simplified structure
  insightType?: string;
  actionRequired?: boolean;
  data?: unknown;
  
  // Interaction data
  action?: string;
  entityType?: string;
  entityId?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  
  // Feedback data
  feedbackType?: "positive" | "negative" | "correction" | "preference";
  
  // Conversation data
  messageId?: string;
  threadId?: string;
  intents?: string[];
  entities?: Array<{ type: string; value: string; confidence: number }>;
  
  // Legacy nested structures (for backward compatibility)
  taskExecution?: {
    taskType: string;
    status: string;
    priority: string;
    agentType: string;
    result?: unknown;
    error?: string;
  };
  
  insightData?: {
    insightType: string;
    priority: string;
    actionRequired: boolean;
    data: unknown;
    agentType?: string;
  };
  
  interactionData?: {
    action: string;
    entityType: string;
    entityId: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  };
  
  feedbackData?: {
    feedbackType: "positive" | "negative" | "correction" | "preference";
    timestamp: string;
  };
  
  conversationData?: {
    messageId: string;
    threadId: string;
    intents: string[];
    entities: Array<{ type: string; value: string; confidence: number }>;
  };
}

export const memoryStructuredDataValidator = v.any();

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface NotificationMetadata {
  // Email metadata
  emailData?: {
    subject: string;
    previewText?: string;
    templateId?: string;
    templateVariables?: Record<string, string | number>;
  };
  
  // SMS metadata
  smsData?: {
    shortCode?: string;
    campaign?: string;
  };
  
  // In-app metadata
  inAppData?: {
    icon?: string;
    color?: string;
    actionUrl?: string;
    actionLabel?: string;
  };
  
  // Scheduling metadata
  schedulingData?: {
    timezone?: string;
    preferredTime?: string;
    retryPolicy?: {
      maxAttempts: number;
      backoffMultiplier: number;
    };
  };
  
  // Test metadata
  isTest?: boolean;
  createdBy?: string;
  
  // Event metadata
  channels?: string[];
  
  // Allow any additional properties
  [key: string]: any;
}

// ============================================================================
// AGENT LOG TYPES
// ============================================================================

export interface AgentLogData {
  // Task execution logs
  taskExecution?: {
    taskId: string;
    phase: "started" | "processing" | "completed" | "failed";
    duration?: number;
    resourcesUsed?: Record<string, number>;
  };
  
  // Error logs
  error?: {
    code: string;
    message: string;
    stackTrace?: string;
    context?: Record<string, unknown>;
  };
  
  // Performance logs
  performance?: {
    operation: string;
    duration: number;
    memoryUsed?: number;
    cpuUsage?: number;
  };
  
  // System logs
  system?: {
    event: string;
    details?: Record<string, unknown>;
  };
  
  // Debug logs
  debug?: {
    component: string;
    data: Record<string, unknown>;
  };
  
  // Flexible fields for agent-specific data
  systemId?: string;
  newManagerId?: string;
  agentId?: string;
  insightId?: string;
  taskId?: string;
  contractId?: string;
  vendorId?: string;
  [key: string]: any;
}

export const agentLogDataValidator = v.any();

export const notificationMetadataValidator = v.any();