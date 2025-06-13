/**
 * Core entity types to replace 'any' types throughout the codebase
 * These provide type safety for contracts, users, vendors, and other core entities
 */

import { Id, Doc } from "../../convex/_generated/dataModel";

// ============================================================================
// CORE ENTITY INTERFACES
// ============================================================================

/**
 * Contract entity with all possible fields
 */
export interface ContractEntity extends Doc<"contracts"> {
  _id: Id<"contracts">;
  _creationTime: number;
  enterpriseId: Id<"enterprises">;
  vendorId: Id<"vendors">;
  title: string;
  status: "draft" | "pending_analysis" | "active" | "expired" | "terminated" | "archived";
  contractType?: "nda" | "msa" | "sow" | "saas" | "lease" | "employment" | "partnership" | "other";
  storageId: Id<"_storage">;
  fileName: string;
  fileType: string;
  value?: number;
  startDate?: string;
  endDate?: string;
  extractedParties?: string[];
  extractedStartDate?: string;
  extractedEndDate?: string;
  extractedPaymentSchedule?: string;
  extractedPricing?: string;
  extractedScope?: string;
  analysisStatus?: "pending" | "processing" | "completed" | "failed";
  analysisError?: string;
  notes?: string;
  createdAt: string;
}

/**
 * User entity with all possible fields
 */
export interface UserEntity extends Doc<"users"> {
  _id: Id<"users">;
  _creationTime: number;
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enterpriseId: Id<"enterprises">;
  role: "owner" | "admin" | "manager" | "user" | "viewer";
  isActive?: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
  phoneNumber?: string;
  department?: string;
  title?: string;
}

/**
 * Vendor entity with all possible fields
 */
export interface VendorEntity extends Doc<"vendors"> {
  _id: Id<"vendors">;
  _creationTime?: number;
  enterpriseId: Id<"enterprises">;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  notes?: string;
  website?: string;
  category?: "technology" | "marketing" | "legal" | "finance" | "hr" | "facilities" | "logistics" | "manufacturing" | "consulting" | "other";
  status?: "active" | "inactive";
  createdAt: string;
}

/**
 * Enterprise entity
 */
export interface EnterpriseEntity extends Doc<"enterprises"> {
  _id: Id<"enterprises">;
  _creationTime: number;
  name: string;
  domain?: string;
  industry?: string;
  size?: "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1000+";
  contractVolume?: "low" | "medium" | "high" | "enterprise";
  primaryUseCase?: string[];
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/**
 * Strongly typed query context to replace any types
 */
export interface TypedQueryContext {
  db: {
    query: <T extends keyof typeof import("../../convex/_generated/dataModel").default>(
      table: T
    ) => any;
    get: <T extends keyof typeof import("../../convex/_generated/dataModel").default>(
      id: Id<T>
    ) => Promise<Doc<T> | null>;
  };
  auth: {
    getUserIdentity: () => Promise<any>;
  };
}

/**
 * Strongly typed mutation context to replace any types
 */
export interface TypedMutationContext extends TypedQueryContext {
  db: TypedQueryContext["db"] & {
    insert: <T extends keyof typeof import("../../convex/_generated/dataModel").default>(
      table: T,
      value: any
    ) => Promise<Id<T>>;
    patch: <T extends keyof typeof import("../../convex/_generated/dataModel").default>(
      id: Id<T>,
      value: Partial<Doc<T>>
    ) => Promise<void>;
    replace: <T extends keyof typeof import("../../convex/_generated/dataModel").default>(
      id: Id<T>,
      value: Doc<T>
    ) => Promise<void>;
    delete: (id: Id<any>) => Promise<void>;
  };
}

// ============================================================================
// SEARCH AND FILTERING TYPES
// ============================================================================

/**
 * Contract search filters
 */
export interface ContractFilters {
  status?: ContractEntity["status"][];
  contractType?: ContractEntity["contractType"][];
  vendorId?: Id<"vendors">[];
  dateRange?: {
    start: string;
    end: string;
  };
  valueRange?: {
    min: number;
    max: number;
  };
}

/**
 * Contract search facets
 */
export interface ContractFacets {
  status: Record<string, number>;
  contractType: Record<string, number>;
  vendor: Record<string, number>;
  analysisStatus: Record<string, number>;
}

/**
 * Vendor search filters
 */
export interface VendorFilters {
  category?: VendorEntity["category"][];
  status?: VendorEntity["status"][];
}

/**
 * Vendor search facets
 */
export interface VendorFacets {
  category: Record<string, number>;
  status: Record<string, number>;
}

/**
 * User search filters
 */
export interface UserFilters {
  role?: UserEntity["role"][];
  department?: string[];
  isActive?: boolean;
}

/**
 * User search facets
 */
export interface UserFacets {
  role: Record<string, number>;
  department: Record<string, number>;
  status: Record<string, number>;
}

/**
 * Search result with score
 */
export interface SearchResult<T> {
  item: T;
  score: number;
  highlights?: string[];
}

/**
 * Paginated search results
 */
export interface SearchResults<T> {
  results: SearchResult<T>[];
  facets: Record<string, Record<string, number>>;
  totalCount: number;
  hasMore: boolean;
  continueCursor?: string;
}

// ============================================================================
// CSV EXPORT TYPES
// ============================================================================

/**
 * CSV export configuration
 */
export interface CSVExportConfig {
  filename: string;
  headers: string[];
  dateFormat?: string;
  currencyFormat?: string;
  includeTimestamp?: boolean;
}

/**
 * Contract CSV row
 */
export interface ContractCSVRow {
  id: string;
  title: string;
  vendor: string;
  status: string;
  contractType: string;
  value: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

/**
 * Vendor CSV row
 */
export interface VendorCSVRow {
  id: string;
  name: string;
  category: string;
  status: string;
  contactEmail: string;
  contractCount: string;
  totalValue: string;
  createdAt: string;
}

// ============================================================================
// ERROR HANDLING TYPES
// ============================================================================

/**
 * Application error with context
 */
export interface AppErrorContext {
  userId?: string;
  enterpriseId?: string;
  component?: string;
  action?: string;
  endpoint?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Strongly typed error details
 */
export interface ErrorDetails {
  code: string;
  message: string;
  stack?: string;
  context: AppErrorContext;
  timestamp: string;
  severity: "low" | "medium" | "high" | "critical";
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

/**
 * Notification data
 */
export interface NotificationData {
  title: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  actionUrl?: string;
  actionText?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Strongly typed notification
 */
export interface TypedNotification extends Doc<"notifications"> {
  _id: Id<"notifications">;
  _creationTime: number;
  enterpriseId: Id<"enterprises">;
  userId?: Id<"users">;
  type: "contract_expiry" | "approval_required" | "system_alert" | "payment_due" | "renewal_reminder";
  title: string;
  message: string;
  status: "pending" | "sent" | "failed" | "read";
  priority: "low" | "medium" | "high" | "urgent";
  channels: ("email" | "in_app" | "sms")[];
  scheduledFor?: string;
  sentAt?: string;
  readAt?: string;
  data?: NotificationData;
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

/**
 * Analytics event data
 */
export interface AnalyticsEventData {
  event: string;
  timestamp: number;
  url: string;
  userId?: string;
  properties?: Record<string, unknown>;
  sessionId: string;
  userAgent?: string;
  ip?: string;
  authenticatedUserId?: Id<"users">;
  enterpriseId?: Id<"enterprises">;
  serverTimestamp: number;
  createdAt: string;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  pageLoadTime?: number;
  apiResponseTime?: number;
  dbQueryTime?: number;
  renderTime?: number;
  memoryUsage?: number;
  errorCount?: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Database operation result
 */
export interface DatabaseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  cursor?: string;
  limit?: number;
  offset?: number;
}

/**
 * Sort parameters
 */
export interface SortParams {
  field: string;
  direction: "asc" | "desc";
}

/**
 * Query parameters
 */
export interface QueryParams extends PaginationParams {
  sort?: SortParams;
  filters?: Record<string, unknown>;
  search?: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for contracts
 */
export function isContractEntity(obj: unknown): obj is ContractEntity {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "_id" in obj &&
    "title" in obj &&
    "status" in obj &&
    "enterpriseId" in obj &&
    "vendorId" in obj
  );
}

/**
 * Type guard for users
 */
export function isUserEntity(obj: unknown): obj is UserEntity {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "_id" in obj &&
    "email" in obj &&
    "role" in obj &&
    "enterpriseId" in obj
  );
}

/**
 * Type guard for vendors
 */
export function isVendorEntity(obj: unknown): obj is VendorEntity {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "_id" in obj &&
    "name" in obj &&
    "enterpriseId" in obj
  );
}