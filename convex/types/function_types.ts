// convex/types/function-types.ts
/**
 * Type-safe function parameter and return types
 * Replaces all function parameter 'any' types with proper interfaces
 */

import { Id } from "../_generated/dataModel";

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface PaginationParams {
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
  dateField?: "created" | "updated" | "start" | "end";
}

export interface SearchParams {
  query: string;
  fields?: string[];
  fuzzy?: boolean;
  limit?: number;
}

export interface SortParams {
  field: string;
  direction: "asc" | "desc";
}

// ============================================================================
// CONTRACT TYPES
// ============================================================================

export interface ContractFilters {
  status?: string[];
  vendorId?: Id<"vendors">[];
  contractType?: string[];
  dateRange?: DateRangeFilter;
  valueRange?: {
    min?: number;
    max?: number;
  };
  tags?: string[];
}

export interface ContractSearchResult {
  contractId: Id<"contracts">;
  title: string;
  vendorName: string;
  status: string;
  value?: number;
  endDate?: string;
  matchScore: number;
  highlights?: Record<string, string[]>;
}

export interface ContractAnalysisResult {
  contractId: Id<"contracts">;
  extractedData: {
    parties?: string[];
    startDate?: string;
    endDate?: string;
    value?: number;
    paymentTerms?: string;
    keyTerms?: Array<{
      term: string;
      value: string;
      confidence: number;
    }>;
  };
  risks?: Array<{
    type: string;
    severity: "low" | "medium" | "high";
    description: string;
    recommendation?: string;
  }>;
  opportunities?: Array<{
    type: string;
    potential: number;
    description: string;
  }>;
}

// ============================================================================
// VENDOR TYPES
// ============================================================================

export interface VendorFilters {
  category?: string[];
  status?: "active" | "inactive";
  contractCount?: {
    min?: number;
    max?: number;
  };
  totalValue?: {
    min?: number;
    max?: number;
  };
}

export interface VendorAnalytics {
  vendorId: Id<"vendors">;
  totalContracts: number;
  activeContracts: number;
  totalValue: number;
  averageContractValue: number;
  riskScore?: number;
  performanceMetrics?: {
    onTimeDelivery?: number;
    qualityScore?: number;
    responsiveness?: number;
  };
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface NotificationFilters {
  type?: string[];
  priority?: string[];
  isRead?: boolean;
  dateRange?: DateRangeFilter;
  channels?: ("email" | "sms" | "in_app")[];
}

export interface NotificationDeliveryResult {
  notificationId: Id<"notifications">;
  channel: "email" | "sms" | "in_app";
  status: "sent" | "delivered" | "failed" | "bounced";
  timestamp: string;
  error?: string;
  metadata?: {
    messageId?: string;
    providerResponse?: string;
  };
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface AnalyticsQuery {
  metrics: string[];
  dimensions?: string[];
  filters?: Record<string, string | number | boolean | string[]>;
  dateRange: DateRangeFilter;
  granularity?: "hour" | "day" | "week" | "month" | "quarter" | "year";
  limit?: number;
}

export interface AnalyticsResult {
  metrics: Record<string, number>;
  dimensions?: Record<string, string>;
  timeSeries?: Array<{
    timestamp: string;
    values: Record<string, number>;
  }>;
  totals?: Record<string, number>;
  percentageChange?: Record<string, number>;
}

// ============================================================================
// USER & AUTH TYPES
// ============================================================================

export interface UserPreferences {
  notifications: {
    email: boolean;
    sms: boolean;
    inApp: boolean;
    frequency: "immediate" | "daily" | "weekly";
    types: Record<string, boolean>;
  };
  display: {
    theme: "light" | "dark" | "system";
    density: "compact" | "comfortable" | "spacious";
    language: string;
    timezone: string;
    dateFormat: string;
    numberFormat: string;
  };
  features: {
    betaFeatures: boolean;
    advancedAnalytics: boolean;
    aiSuggestions: boolean;
  };
}

export interface SessionInfo {
  sessionId: string;
  userId: Id<"users">;
  startedAt: string;
  lastActivityAt: string;
  ipAddress?: string;
  userAgent?: string;
  device?: {
    type: "desktop" | "mobile" | "tablet";
    browser: string;
    os: string;
  };
}

// ============================================================================
// FILE HANDLING TYPES
// ============================================================================

export interface FileUploadParams {
  fileName: string;
  fileType: string;
  fileSize: number;
  metadata?: {
    contractId?: Id<"contracts">;
    vendorId?: Id<"vendors">;
    category?: string;
    tags?: string[];
  };
}

export interface FileProcessingResult {
  fileId: string;
  status: "pending" | "processing" | "completed" | "failed";
  processedAt?: string;
  extractedText?: string;
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    language?: string;
    encoding?: string;
  };
  errors?: Array<{
    code: string;
    message: string;
    line?: number;
  }>;
}

// ============================================================================
// WORKFLOW TYPES
// ============================================================================

export interface WorkflowDefinition {
  id: string;
  name: string;
  trigger: {
    type: "event" | "schedule" | "manual";
    config: Record<string, unknown>;
  };
  steps: Array<{
    id: string;
    type: string;
    config: Record<string, unknown>;
    conditions?: Array<{
      field: string;
      operator: "equals" | "contains" | "greater" | "less" | "in" | "not_in";
      value: unknown;
    }>;
    onSuccess?: string;
    onFailure?: string;
  }>;
  variables?: Record<string, unknown>;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  executionId: string;
  status: "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt?: string;
  steps: Array<{
    stepId: string;
    status: "pending" | "running" | "completed" | "failed" | "skipped";
    startedAt?: string;
    completedAt?: string;
    output?: unknown;
    error?: string;
  }>;
  finalOutput?: unknown;
  errors?: string[];
}

// ============================================================================
// ERROR HANDLING TYPES
// ============================================================================

export interface ErrorContext {
  operation: string;
  userId?: Id<"users">;
  enterpriseId?: Id<"enterprises">;
  resourceType?: string;
  resourceId?: string;
  input?: Record<string, unknown>;
  stackTrace?: string;
  timestamp: string;
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  expected?: unknown;
  received?: unknown;
}

export interface BatchOperationResult<T> {
  successful: T[];
  failed: Array<{
    item: unknown;
    error: string;
    index: number;
  }>;
  stats: {
    total: number;
    succeeded: number;
    failed: number;
    duration: number;
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isValidDateRange(value: unknown): value is DateRangeFilter {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  
  if (obj.startDate !== undefined && typeof obj.startDate !== 'string') return false;
  if (obj.endDate !== undefined && typeof obj.endDate !== 'string') return false;
  if (obj.dateField !== undefined && 
      !['created', 'updated', 'start', 'end'].includes(obj.dateField as string)) {
    return false;
  }
  
  return true;
}

export function isValidPaginationParams(value: unknown): value is PaginationParams {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  
  if (obj.limit !== undefined && typeof obj.limit !== 'number') return false;
  if (obj.offset !== undefined && typeof obj.offset !== 'number') return false;
  if (obj.cursor !== undefined && typeof obj.cursor !== 'string') return false;
  
  return true;
}

export function assertValidationErrors(errors: unknown): asserts errors is ValidationError[] {
  if (!Array.isArray(errors)) {
    throw new Error('Validation errors must be an array');
  }
  
  for (const error of errors) {
    if (typeof error !== 'object' || error === null) {
      throw new Error('Each validation error must be an object');
    }
    
    const e = error as Record<string, unknown>;
    if (typeof e.field !== 'string' || typeof e.code !== 'string' || typeof e.message !== 'string') {
      throw new Error('Validation error must have field, code, and message properties');
    }
  }
}