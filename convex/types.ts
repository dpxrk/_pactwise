// convex/types.ts
import { Id, Doc } from "./_generated/dataModel";

// ============================================================================
// DOCUMENT TYPES (Convex table types)
// ============================================================================

export type Enterprise = Doc<"enterprises">;
export type User = Doc<"users">;
export type Vendor = Doc<"vendors">;
export type Contract = Doc<"contracts">;
export type Invitation = Doc<"invitations">;
export type UserOnboarding = Doc<"userOnboarding">;
export type UserPresence = Doc<"userPresence">;
export type RealtimeEvent = Doc<"realtimeEvents">;
export type TypingIndicator = Doc<"typingIndicators">;

// ============================================================================
// ENUM TYPES (from schema)
// ============================================================================

export type ContractStatus = 
  | "draft" 
  | "pending_analysis" 
  | "active" 
  | "expired" 
  | "terminated" 
  | "archived";

export type AnalysisStatus = 
  | "pending" 
  | "processing" 
  | "completed" 
  | "failed";

export type VendorCategory = 
  | "technology"
  | "marketing"
  | "legal"
  | "finance"
  | "hr"
  | "facilities"
  | "logistics"
  | "manufacturing"
  | "consulting"
  | "other";

export type ContractType = 
  | "nda"
  | "msa"
  | "sow"
  | "saas"
  | "lease"
  | "employment"
  | "partnership"
  | "other";

export type UserRole = 
  | "owner"
  | "admin"
  | "manager"
  | "user"
  | "viewer";

export type VendorStatus = "active" | "inactive";

export type NotificationChannel = "in_app" | "email" | "sms";

export type ActivityType = 
  | "viewing_contract"
  | "editing_contract"
  | "viewing_vendor"
  | "dashboard"
  | "idle";

export type RealtimeEventType = 
  | "contract_updated"
  | "contract_created"
  | "contract_deleted"
  | "vendor_updated"
  | "vendor_created"
  | "analysis_completed"
  | "notification_created"
  | "user_joined"
  | "user_left"
  | "system_alert";

// ============================================================================
// FILTER AND QUERY TYPES
// ============================================================================

export interface ContractFilters {
  enterpriseId: Id<"enterprises">;
  status?: ContractStatus | "all";
  contractType?: ContractType | "all";
  vendorId?: Id<"vendors">;
  analysisStatus?: AnalysisStatus | "all";
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
  minValue?: number;
  maxValue?: number;
  limit?: number;
  offset?: number;
  sortBy?: "title" | "createdAt" | "value" | "endDate" | "status";
  sortOrder?: "asc" | "desc";
}

export interface VendorFilters {
  enterpriseId: Id<"enterprises">;
  category?: VendorCategory | "all";
  status?: VendorStatus | "all";
  searchQuery?: string;
  limit?: number;
  offset?: number;
  sortBy?: "name" | "createdAt" | "category" | "status";
  sortOrder?: "asc" | "desc";
}

export interface UserFilters {
  enterpriseId: Id<"enterprises">;
  role?: UserRole | "all";
  isActive?: boolean;
  department?: string;
  searchQuery?: string;
  limit?: number;
  offset?: number;
  sortBy?: "firstName" | "lastName" | "email" | "createdAt" | "role";
  sortOrder?: "asc" | "desc";
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface ContractAnalytics {
  totalContracts: number;
  activeContracts: number;
  expiredContracts: number;
  draftContracts: number;
  totalValue: number;
  averageValue: number;
  contractsByType: Record<ContractType, number>;
  contractsByStatus: Record<ContractStatus, number>;
  monthlyTrends: MonthlyTrend[];
  expiringNext30Days: number;
  renewalRate: number;
  complianceScore: number;
}

export interface VendorAnalytics {
  totalVendors: number;
  activeVendors: number;
  inactiveVendors: number;
  vendorsByCategory: Record<VendorCategory, number>;
  averageContractsPerVendor: number;
  topVendorsByValue: VendorMetric[];
  vendorPerformanceScores: VendorPerformance[];
  newVendorsThisMonth: number;
}

export interface MonthlyTrend {
  month: string;
  year: number;
  contractsCreated: number;
  contractsExpired: number;
  totalValue: number;
  activeContracts: number;
}

export interface VendorMetric {
  vendorId: Id<"vendors">;
  vendorName: string;
  totalValue: number;
  contractCount: number;
  averageValue: number;
  category: VendorCategory;
}

export interface VendorPerformance {
  vendorId: Id<"vendors">;
  vendorName: string;
  performanceScore: number;
  onTimeDelivery: number;
  qualityScore: number;
  communicationScore: number;
  category: VendorCategory;
}

// ============================================================================
// SEARCH TYPES
// ============================================================================

export interface SearchResults {
  contracts: SearchResultContract[];
  vendors: SearchResultVendor[];
  users: SearchResultUser[];
  total: number;
}

export interface SearchResultContract {
  _id: Id<"contracts">;
  title: string;
  status: ContractStatus;
  vendorName: string;
  value?: number;
  highlightedContent?: string;
}

export interface SearchResultVendor {
  _id: Id<"vendors">;
  name: string;
  category?: VendorCategory;
  status?: VendorStatus;
  contractCount: number;
  highlightedContent?: string;
}

export interface SearchResultUser {
  _id: Id<"users">;
  firstName?: string;
  lastName?: string;
  email: string;
  role: UserRole;
  department?: string;
  highlightedContent?: string;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface NotificationPreferences {
  channels: NotificationChannel[];
  contractExpirations: boolean;
  analysisComplete: boolean;
  systemAlerts: boolean;
  teamUpdates: boolean;
}

export interface NotificationData {
  type: "contract_expiration" | "analysis_complete" | "system_alert" | "team_update";
  title: string;
  message: string;
  actionUrl?: string;
  priority: "low" | "medium" | "high" | "critical";
  metadata?: Record<string, unknown>;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  offset: number;
  limit: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type CreateVendorArgs = OptionalFields<
  Omit<Vendor, "_id" | "_creationTime" | "createdAt">,
  "status" | "category" | "contactEmail" | "contactPhone" | "address" | "notes" | "website"
> & {
  createdAt: string;
};

export type UpdateVendorArgs = Partial<
  Omit<Vendor, "_id" | "_creationTime" | "enterpriseId">
>;

export type CreateContractArgs = OptionalFields<
  Omit<Contract, "_id" | "_creationTime" | "createdAt" | "analysisStatus" | "analysisError">,
  | "contractType"
  | "value"
  | "startDate"
  | "endDate"
  | "extractedParties"
  | "extractedStartDate"
  | "extractedEndDate"
  | "extractedPaymentSchedule"
  | "extractedPricing"
  | "extractedScope"
  | "notes"
> & {
  createdAt: string;
};

export type UpdateContractArgs = Partial<
  Omit<Contract, "_id" | "_creationTime" | "enterpriseId" | "storageId" | "fileName" | "fileType">
>;

// ============================================================================
// FILTER HELPER TYPES
// ============================================================================

export interface DateRange {
  start?: string;
  end?: string;
}

export interface NumericRange {
  min?: number;
  max?: number;
}

export interface SortOptions {
  field: string;
  direction: "asc" | "desc";
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

export interface AuditLogEntry {
  userId: Id<"users">;
  enterpriseId: Id<"enterprises">;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isContractStatus(value: string): value is ContractStatus {
  return ["draft", "pending_analysis", "active", "expired", "terminated", "archived"].includes(value);
}

export function isVendorCategory(value: string): value is VendorCategory {
  return [
    "technology", "marketing", "legal", "finance", "hr",
    "facilities", "logistics", "manufacturing", "consulting", "other"
  ].includes(value);
}

export function isUserRole(value: string): value is UserRole {
  return ["owner", "admin", "manager", "user", "viewer"].includes(value);
}

export function isNotificationChannel(value: string): value is NotificationChannel {
  return ["in_app", "email", "sms"].includes(value);
}