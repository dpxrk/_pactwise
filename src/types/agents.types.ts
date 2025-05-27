// src/types/agents.types.ts
import { Id } from "../../convex/_generated/dataModel";

// ============================================================================
// CORE AGENT ENUMS AND CONSTANTS
// ============================================================================

// Agent system status options
export const agentSystemStatusOptions = [
  "stopped", "starting", "running", "paused", "error"
] as const;
export type AgentSystemStatus = typeof agentSystemStatusOptions[number];

// Individual agent status options
export const agentStatusOptions = [
  "inactive", "active", "busy", "error", "disabled"
] as const;
export type AgentStatus = typeof agentStatusOptions[number];

// Agent types/roles in the system
export const agentTypeOptions = [
  "manager",        // System coordination and management
  "secretary",      // Administrative tasks and notifications
  "financial",      // Financial analysis and reporting
  "notifications",  // Communication and alerts
  "legal",          // Legal compliance and risk assessment
  "analytics",      // Data analysis and insights
  "workflow",       // Process automation and orchestration
  "compliance",     // Regulatory compliance monitoring
  "risk",           // Risk assessment and management
  "audit",          // Audit trail and reporting
  "integration",    // Third-party system integrations
  "scheduler",      // Task scheduling and timing
  "backup",         // Data backup and recovery
  "monitor",        // System health and performance monitoring
] as const;
export type AgentType = typeof agentTypeOptions[number];

// Insight/analysis types
export const insightTypeOptions = [
  "contract_analysis",     // Contract content analysis
  "financial_risk",        // Financial risk assessment
  "expiration_warning",    // Contract expiration alerts
  "legal_review",          // Legal compliance issues
  "compliance_alert",      // Regulatory compliance warnings
  "performance_metric",    // Performance and KPI insights
  "cost_optimization",     // Cost-saving opportunities
  "vendor_risk",          // Vendor risk assessment
  "renewal_opportunity",   // Contract renewal suggestions
  "negotiation_insight",   // Contract negotiation recommendations
  "audit_finding",        // Audit-related discoveries
  "anomaly_detection",    // Unusual patterns or outliers
  "trend_analysis",       // Historical trend insights
  "recommendation",       // General recommendations
  "alert",               // General system alerts
  "report",              // Automated reports
] as const;
export type InsightType = typeof insightTypeOptions[number];

// Task status for agent task queue
export const taskStatusOptions = [
  "pending", "in_progress", "completed", "failed", "cancelled", "timeout"
] as const;
export type TaskStatus = typeof taskStatusOptions[number];

// Task priority levels
export const taskPriorityOptions = [
  "low", "medium", "high", "critical"
] as const;
export type TaskPriority = typeof taskPriorityOptions[number];

// Log levels
export const logLevelOptions = [
  "debug", "info", "warn", "error", "critical"
] as const;
export type LogLevel = typeof logLevelOptions[number];

// ============================================================================
// CORE AGENT SYSTEM TYPES
// ============================================================================

export interface AgentSystemType {
  _id: Id<"agentSystem">;
  _creationTime: number;
  isRunning: boolean;
  status: AgentSystemStatus;
  lastStarted?: string;
  lastStopped?: string;
  errorMessage?: string;
  config?: AgentSystemConfig;
  metrics?: AgentSystemMetrics;
}

export interface AgentSystemConfig {
  maxConcurrentTasks: number;
  taskTimeoutMinutes: number;
  logRetentionDays: number;
  insightRetentionDays?: number;
  healthCheckIntervalMinutes?: number;
  autoRestartOnFailure?: boolean;
  maxRetryAttempts?: number;
  enabledFeatures?: string[];
  notifications?: {
    emailEnabled: boolean;
    slackEnabled: boolean;
    webhookEnabled: boolean;
  };
}

export interface AgentSystemMetrics {
  totalTasksProcessed: number;
  totalInsightsGenerated: number;
  systemUptime: number;
  averageTaskDuration?: number;
  errorRate?: number;
  lastHealthCheck?: string;
  performanceScore?: number;
}

// ============================================================================
// INDIVIDUAL AGENT TYPES
// ============================================================================

export interface AgentType {
  _id: Id<"agents">;
  _creationTime: number;
  name: string;
  type: AgentType;
  status: AgentStatus;
  description?: string;
  isEnabled: boolean;
  lastRun?: string;
  lastSuccess?: string;
  runCount: number;
  errorCount: number;
  lastError?: string;
  config?: AgentConfig;
  metrics?: AgentMetrics;
  createdAt: string;
  updatedAt?: string;
}

// Base agent configuration (extended by specific agent types)
export interface AgentConfig {
  runIntervalMinutes?: number;
  retryAttempts?: number;
  timeoutMinutes?: number;
  enabled?: boolean;
  priority?: TaskPriority;
  dependencies?: Id<"agents">[];
  triggers?: AgentTrigger[];
  [key: string]: any; // Allow agent-specific config
}

// Agent trigger conditions
export interface AgentTrigger {
  type: "schedule" | "event" | "condition" | "manual";
  schedule?: string; // Cron expression for scheduled triggers
  event?: string; // Event name for event-based triggers
  condition?: string; // Condition expression for conditional triggers
  enabled: boolean;
}

// Base agent metrics (extended by specific agent types)
export interface AgentMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageRunTime: number;
  lastRunDuration?: number;
  dataProcessed?: number;
  insightsGenerated?: number;
  [key: string]: any; // Allow agent-specific metrics
}

// ============================================================================
// SPECIFIC AGENT TYPE CONFIGURATIONS
// ============================================================================

// Manager Agent Configuration
export interface ManagerAgentConfig extends AgentConfig {
  healthCheckIntervalMinutes: number;
  taskCleanupHours: number;
  logCleanupDays: number;
  agentRestartThreshold: number;
  systemMetricsCollectionInterval: number;
}

// Financial Agent Configuration
export interface FinancialAgentConfig extends AgentConfig {
  riskThresholds: {
    low: number;
    medium: number;
    high: number;
  };
  currencyConversion: boolean;
  costAnalysisDepth: "basic" | "detailed" | "comprehensive";
  reportingFrequency: "daily" | "weekly" | "monthly";
}

// Legal Agent Configuration
export interface LegalAgentConfig extends AgentConfig {
  jurisdictions: string[];
  complianceFrameworks: string[];
  riskAssessmentCriteria: string[];
  autoReviewEnabled: boolean;
  flaggedTerms: string[];
}

// Notification Agent Configuration
export interface NotificationAgentConfig extends AgentConfig {
  channels: {
    email: boolean;
    slack: boolean;
    webhook: boolean;
    inApp: boolean;
  };
  urgencyLevels: {
    [key in TaskPriority]: {
      delay: number;
      retries: number;
      escalation: boolean;
    };
  };
}

// Analytics Agent Configuration
export interface AnalyticsAgentConfig extends AgentConfig {
  reportTypes: string[];
  dataRetentionDays: number;
  aggregationLevels: string[];
  realTimeAnalysis: boolean;
  machineLearningEnabled: boolean;
}

// ============================================================================
// AGENT INSIGHTS AND ANALYSIS
// ============================================================================

export interface AgentInsightType {
  _id: Id<"agentInsights">;
  _creationTime: number;
  agentId: Id<"agents">;
  type: InsightType;
  title: string;
  description: string;
  priority: TaskPriority;
  contractId?: Id<"contracts">;
  vendorId?: Id<"vendors">;
  data?: InsightData;
  actionRequired: boolean;
  actionTaken: boolean;
  actionDetails?: string;
  isRead: boolean;
  expiresAt?: string;
  createdAt: string;
  readAt?: string;
  tags?: string[];
  confidence?: number; // 0-1 confidence score for AI-generated insights
}

// Structured insight data based on type
export interface InsightData {
  // Contract Analysis
  contractRisk?: {
    score: number;
    factors: string[];
    recommendations: string[];
  };
  
  // Financial Analysis
  financialImpact?: {
    amount: number;
    currency: string;
    type: "cost" | "saving" | "risk";
    timeframe: string;
  };
  
  // Compliance Analysis
  complianceIssues?: {
    framework: string;
    violations: string[];
    severity: "low" | "medium" | "high" | "critical";
    remediation: string[];
  };
  
  // Performance Metrics
  performanceData?: {
    metric: string;
    current: number;
    target: number;
    trend: "improving" | "declining" | "stable";
  };
  
  // Trend Analysis
  trendData?: {
    period: string;
    dataPoints: Array<{
      date: string;
      value: number;
    }>;
    pattern: string;
    forecast?: number;
  };
  
  // Custom data for specific insights
  [key: string]: any;
}

// ============================================================================
// AGENT TASK MANAGEMENT
// ============================================================================

export interface AgentTaskType {
  _id: Id<"agentTasks">;
  _creationTime: number;
  assignedAgentId: Id<"agents">;
  createdByAgentId?: Id<"agents">;
  taskType: string;
  status: TaskStatus;
  priority: TaskPriority;
  title: string;
  description?: string;
  contractId?: Id<"contracts">;
  vendorId?: Id<"vendors">;
  data?: TaskData;
  result?: TaskResult;
  errorMessage?: string;
  scheduledFor?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  dependencies?: Id<"agentTasks">[];
  retryCount?: number;
  maxRetries?: number;
}

export interface TaskData {
  input?: any;
  parameters?: Record<string, any>;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface TaskResult {
  success: boolean;
  output?: any;
  metrics?: Record<string, number>;
  artifacts?: string[]; // URLs or IDs of generated files
  nextActions?: string[];
  warnings?: string[];
}

// ============================================================================
// AGENT LOGGING
// ============================================================================

export interface AgentLogType {
  _id: Id<"agentLogs">;
  _creationTime: number;
  agentId: Id<"agents">;
  level: LogLevel;
  message: string;
  data?: LogData;
  taskId?: Id<"agentTasks">;
  timestamp: string;
  category?: string;
  source?: string;
  userId?: string; // If action was triggered by a user
}

export interface LogData {
  error?: Error | string;
  duration?: number;
  context?: Record<string, any>;
  stackTrace?: string;
  requestId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// AGENT COMMUNICATION AND EVENTS
// ============================================================================

export interface AgentEvent {
  type: string;
  source: Id<"agents">;
  target?: Id<"agents">;
  data?: any;
  timestamp: string;
  priority: TaskPriority;
}

export interface AgentMessage {
  from: Id<"agents">;
  to: Id<"agents">;
  type: "request" | "response" | "notification" | "alert";
  payload: any;
  correlationId?: string;
  timestamp: string;
}

// ============================================================================
// AGENT WORKFLOW AND ORCHESTRATION
// ============================================================================

export interface AgentWorkflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  triggers: AgentTrigger[];
  enabled: boolean;
  version: number;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkflowStep {
  id: string;
  agentId: Id<"agents">;
  action: string;
  inputs?: Record<string, any>;
  conditions?: WorkflowCondition[];
  onSuccess?: string; // Next step ID
  onFailure?: string; // Next step ID
  timeout?: number;
  retries?: number;
}

export interface WorkflowCondition {
  field: string;
  operator: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "in" | "contains";
  value: any;
}

// ============================================================================
// AGENT PERFORMANCE AND MONITORING
// ============================================================================

export interface AgentPerformanceReport {
  agentId: Id<"agents">;
  period: {
    start: string;
    end: string;
  };
  metrics: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageCompletionTime: number;
    successRate: number;
    errorRate: number;
    throughput: number; // Tasks per hour
  };
  insights: {
    performance: "excellent" | "good" | "fair" | "poor";
    recommendations: string[];
    trends: string[];
  };
  generatedAt: string;
}

export interface SystemHealthStatus {
  overall: "healthy" | "warning" | "critical";
  agents: Array<{
    id: Id<"agents">;
    name: string;
    status: AgentStatus;
    health: "healthy" | "warning" | "critical";
    lastCheck: string;
  }>;
  resources: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
  };
  alerts: Array<{
    level: "info" | "warning" | "error";
    message: string;
    timestamp: string;
  }>;
}

// ============================================================================
// UTILITY TYPES AND INTERFACES
// ============================================================================

// Type for enriched data (with additional computed fields)
export interface EnrichedAgentInsight extends AgentInsightType {
  agentName: string;
  agentType: AgentType;
  relatedContractTitle?: string;
  relatedVendorName?: string;
}

export interface EnrichedAgentLog extends AgentLogType {
  agentName: string;
  agentType: AgentType;
  taskTitle?: string;
}

export interface EnrichedAgentTask extends AgentTaskType {
  agentName: string;
  agentType: AgentType;
  creatorName?: string;
  relatedContractTitle?: string;
  relatedVendorName?: string;
}

// Form data types for creating/updating agents
export interface CreateAgentData {
  name: string;
  type: AgentType;
  description?: string;
  config?: AgentConfig;
  isEnabled?: boolean;
}

export interface UpdateAgentData {
  name?: string;
  description?: string;
  config?: AgentConfig;
  isEnabled?: boolean;
}

// API response types
export interface AgentSystemStatusResponse {
  system: AgentSystemType | null;
  agents: AgentType[];
  stats: {
    totalAgents: number;
    activeAgents: number;
    recentInsights: number;
    pendingTasks: number;
    activeTasks: number;
  };
}

export interface AgentOperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// ============================================================================
// CONSTANTS AND MAPPINGS
// ============================================================================

// Human-readable labels for enums
export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  manager: "System Manager",
  secretary: "Administrative Assistant",
  financial: "Financial Analyst",
  notifications: "Notification Manager",
  legal: "Legal Compliance",
  analytics: "Data Analytics",
  workflow: "Workflow Orchestrator",
  compliance: "Compliance Monitor",
  risk: "Risk Assessor",
  audit: "Audit Manager",
  integration: "Integration Handler",
  scheduler: "Task Scheduler",
  backup: "Backup Manager",
  monitor: "System Monitor",
};

export const INSIGHT_TYPE_LABELS: Record<InsightType, string> = {
  contract_analysis: "Contract Analysis",
  financial_risk: "Financial Risk",
  expiration_warning: "Expiration Warning",
  legal_review: "Legal Review",
  compliance_alert: "Compliance Alert",
  performance_metric: "Performance Metric",
  cost_optimization: "Cost Optimization",
  vendor_risk: "Vendor Risk",
  renewal_opportunity: "Renewal Opportunity",
  negotiation_insight: "Negotiation Insight",
  audit_finding: "Audit Finding",
  anomaly_detection: "Anomaly Detection",
  trend_analysis: "Trend Analysis",
  recommendation: "Recommendation",
  alert: "Alert",
  report: "Report",
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export const STATUS_COLORS: Record<AgentStatus, string> = {
  inactive: "bg-gray-100 text-gray-800",
  active: "bg-green-100 text-green-800",
  busy: "bg-blue-100 text-blue-800",
  error: "bg-red-100 text-red-800",
  disabled: "bg-red-100 text-red-800",
};