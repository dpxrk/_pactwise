// Enhanced type definitions for Convex operations and data structures

import { QueryCtx, MutationCtx, ActionCtx } from "convex/server";
import { Id } from "../../convex/_generated/dataModel";

// Convex Context Types
export type ConvexQueryCtx = QueryCtx;
export type ConvexMutationCtx = MutationCtx;
export type ConvexActionCtx = ActionCtx;

// Agent Task Types
export interface AgentTask {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data: AgentTaskData;
  result?: AgentTaskResult;
  error?: string;
  createdAt: string;
  updatedAt?: string;
  retryCount?: number;
  maxRetries?: number;
}

export interface AgentTaskData {
  contractId?: Id<"contracts">;
  vendorId?: Id<"vendors">;
  enterpriseId: Id<"enterprises">;
  userId?: Id<"users">;
  parameters?: Record<string, unknown>;
  metadata?: TaskMetadata;
}

export interface TaskMetadata {
  source?: string;
  triggeredBy?: string;
  correlationId?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface AgentTaskResult {
  success: boolean;
  data?: Record<string, unknown>;
  insights?: Insight[];
  recommendations?: Recommendation[];
  metadata?: ResultMetadata;
  executionTime?: number;
}

export interface ResultMetadata {
  processedAt: string;
  version: string;
  confidence?: number;
  sources?: string[];
  [key: string]: unknown;
}

// Analytics Types
export interface AnalysisResult {
  type: string;
  confidence: number;
  value: unknown;
  metadata: Record<string, unknown>;
  extractedAt: string;
}

export interface ContractAnalysis {
  contractId: Id<"contracts">;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results: {
    parties?: AnalysisResult;
    terms?: AnalysisResult;
    dates?: AnalysisResult;
    financials?: AnalysisResult;
    risks?: AnalysisResult;
    compliance?: AnalysisResult;
  };
  summary?: string;
  recommendations?: Recommendation[];
  createdAt: string;
  updatedAt?: string;
}

export interface Insight {
  id: string;
  type: 'risk' | 'opportunity' | 'compliance' | 'financial' | 'operational';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  data: Record<string, unknown>;
  source: string;
  confidence: number;
  createdAt: string;
}

export interface Recommendation {
  id: string;
  type: 'action' | 'review' | 'optimize' | 'alert';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  actionItems?: ActionItem[];
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  source: string;
  createdAt: string;
}

export interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  status: 'pending' | 'in_progress' | 'completed';
  metadata?: Record<string, unknown>;
}

// Search Types
export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  sort?: SearchSort;
  pagination?: SearchPagination;
  options?: SearchOptions;
}

export interface SearchFilters {
  contractTypes?: string[];
  statuses?: string[];
  dateRange?: {
    start?: string;
    end?: string;
  };
  vendorIds?: Id<"vendors">[];
  tags?: string[];
  [key: string]: unknown;
}

export interface SearchSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SearchPagination {
  limit: number;
  offset?: number;
  cursor?: string;
}

export interface SearchOptions {
  includeContent?: boolean;
  highlightMatches?: boolean;
  fuzzyMatch?: boolean;
  boost?: Record<string, number>;
  debug?: boolean;
}

export interface SearchResult<T = unknown> {
  items: SearchResultItem<T>[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
  aggregations?: Record<string, SearchAggregation>;
  executionTime?: number;
  debug?: SearchDebugInfo;
}

export interface SearchResultItem<T = unknown> {
  id: string;
  type: string;
  score: number;
  data: T;
  highlights?: Record<string, string[]>;
  metadata?: Record<string, unknown>;
}

export interface SearchAggregation {
  buckets: Array<{
    key: string;
    count: number;
    data?: Record<string, unknown>;
  }>;
}

export interface SearchDebugInfo {
  query: string;
  parsedQuery?: Record<string, unknown>;
  executionPlan?: string[];
  performance?: Record<string, number>;
}

// Error Types
export interface ConvexError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  timestamp: string;
}

export interface ValidationError extends ConvexError {
  code: 'VALIDATION_ERROR';
  field?: string;
  value?: unknown;
  rule?: string;
}

export interface AuthorizationError extends ConvexError {
  code: 'AUTHORIZATION_ERROR';
  requiredRole?: string;
  userRole?: string;
  resource?: string;
}

export interface NotFoundError extends ConvexError {
  code: 'NOT_FOUND';
  resourceType?: string;
  resourceId?: string;
}

// Event Types
export interface RealtimeEvent {
  type: string;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  metadata: EventMetadata;
  timestamp: string;
}

export interface EventMetadata {
  userId?: Id<"users">;
  enterpriseId: Id<"enterprises">;
  source: string;
  correlationId?: string;
  version: string;
  [key: string]: unknown;
}

// Configuration Types
export interface AgentConfig {
  enabled: boolean;
  maxConcurrency: number;
  timeout: number;
  retryPolicy: RetryPolicy;
  features: Record<string, FeatureConfig>;
  metadata?: Record<string, unknown>;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential';
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
}

export interface FeatureConfig {
  enabled: boolean;
  parameters?: Record<string, unknown>;
  limits?: Record<string, number>;
}

// API Response Types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
  meta?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ConvexError;
  metadata?: {
    requestId: string;
    timestamp: string;
    executionTime: number;
    [key: string]: unknown;
  };
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type WithMetadata<T> = T & {
  metadata?: Record<string, unknown>;
};

export type WithTimestamps<T> = T & {
  createdAt: string;
  updatedAt?: string;
};

export type DatabaseEntity<T> = WithTimestamps<WithMetadata<T>> & {
  _id: Id<string>;
};

// Query Builder Types
export type QueryBuilder<T> = {
  where: (predicate: (item: T) => boolean) => QueryBuilder<T>;
  orderBy: (field: keyof T, direction?: 'asc' | 'desc') => QueryBuilder<T>;
  limit: (count: number) => QueryBuilder<T>;
  offset: (count: number) => QueryBuilder<T>;
  select: <K extends keyof T>(fields: K[]) => QueryBuilder<Pick<T, K>>;
  execute: () => Promise<T[]>;
  first: () => Promise<T | null>;
  count: () => Promise<number>;
};

// Event Emitter Types
export interface EventEmitter {
  on<T = unknown>(event: string, listener: (data: T) => void): void;
  off<T = unknown>(event: string, listener: (data: T) => void): void;
  emit<T = unknown>(event: string, data: T): void;
  once<T = unknown>(event: string, listener: (data: T) => void): void;
}

export default {};