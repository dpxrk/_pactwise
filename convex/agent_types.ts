// convex/agent-types.ts
import { Id, Doc } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";

// ============================================================================
// AGENT CONTEXT TYPES
// ============================================================================

export type AgentMutationCtx = MutationCtx;
export type AgentQueryCtx = QueryCtx;

// ============================================================================
// AGENT TASK AND INSIGHT TYPES
// ============================================================================

export interface AgentTask extends Doc<"agentTasks"> {
  
}

export interface AgentInsight extends Doc<"agentInsights"> {
  
}

// ============================================================================
// FINANCIAL ANALYSIS TYPES
// ============================================================================

export interface FinancialSummary {
  totalValue?: number;
  valueCategory?: string;
  monthlyValue?: number;
  annualizedValue?: number;
  costPerUnit?: number;
  paybackPeriod?: number;
  roi?: number;
  currency?: string;
  inflationAdjustment?: number;
}

export interface FinancialRisk {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  impact?: number;
  probability?: number;
  mitigationStrategy?: string;
}

export interface FinancialOpportunity {
  type: string;
  description: string;
  potentialSavings?: number;
  recommendation?: string;
  implementationCost?: number;
  timeToRealization?: number;
}

export interface FinancialMetrics {
  paymentTerms?: string;
  currency?: string;
  inflationAdjustment?: number;
  benchmarkComparison?: string;
  costAnalysis?: Record<string, number>;
  budgetVariance?: number;
}

export interface FinancialAnalysis {
  financialSummary: FinancialSummary;
  risks: FinancialRisk[];
  opportunities: FinancialOpportunity[];
  metrics: FinancialMetrics;
}

// ============================================================================
// LEGAL ANALYSIS TYPES
// ============================================================================

export interface LegalRisk {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  clause?: string;
  recommendation?: string;
}

export interface LegalClause {
  type: string;
  content: string;
  status: "present" | "missing" | "problematic";
  recommendation?: string;
}

export interface ComplianceViolation {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  regulation?: string;
  remediation?: string;
}

export interface LegalAnalysis {
  riskFactors: LegalRisk[];
  problematicClauses: LegalClause[];
  missingClauses: string[];
  complianceViolations: ComplianceViolation[];
  overallRiskScore: number;
  recommendations: string[];
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface KPIMetrics {
  contractRenewalRate: number;
  contractCycleTime: number;
  vendorConcentrationRisk: number;
  contractComplianceRate: number;
  identifiedSavings: number;
  savingsRate: number;
  totalActiveContractValue: number;
  contractsByType: Record<string, number>;
  averageContractValue: number;
  monthlySpend: number;
  quarterlyGrowthRate: number;
}

export interface VendorMetrics {
  vendorId: Id<"vendors">;
  name: string;
  activeContracts: number;
  totalValue: number;
  averageValue: number;
  performanceScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  lastActivity: number;
}

export interface TrendAnalysis {
  direction: "increasing" | "decreasing" | "stable";
  magnitude: number;
  confidence: number;
  timeframe: string;
  dataPoints: number;
  significance: "low" | "medium" | "high";
}

export interface AnomalyDetection {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  value: number;
  expectedValue: number;
  deviationScore: number;
  timestamp: string;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface NotificationBatch {
  userId: Id<"users">;
  notifications: Doc<"notifications">[];
  batchType: "digest" | "immediate" | "scheduled";
  scheduledFor?: string;
}

export interface NotificationTemplate {
  type: string;
  title: string;
  messageTemplate: string;
  channels: ("in_app" | "email" | "sms")[];
  priority: "low" | "medium" | "high" | "critical";
  metadata?: Record<string, unknown>;
}

// ============================================================================
// REPORTING TYPES
// ============================================================================

export interface ReportData {
  title: string;
  type: "weekly" | "monthly" | "quarterly" | "annual";
  generatedAt: string;
  timeframe: {
    start: string;
    end: string;
  };
  metrics: Record<string, unknown>;
  insights: string[];
  recommendations: string[];
  attachments?: string[];
}

export interface ExecutiveSummary {
  keyMetrics: Record<string, number>;
  majorInsights: string[];
  criticalActions: string[];
  riskAreas: string[];
  opportunities: string[];
  performanceHighlights: string[];
}

// ============================================================================
// HELPER UTILITY TYPES
// ============================================================================

export interface DateRange {
  start: Date;
  end: Date;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface SortOptions {
  field: string;
  direction: "asc" | "desc";
}

export interface FilterOptions {
  status?: string[];
  type?: string[];
  priority?: string[];
  dateRange?: DateRange;
  searchQuery?: string;
}

// ============================================================================
// AGENT CONFIGURATION TYPES
// ============================================================================

export interface AgentConfig {
  checkIntervalMinutes: number;
  batchSize: number;
  maxRetries: number;
  retryDelaySeconds: number;
  taskTimeoutMinutes: number;
  isEnabled: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
}

export interface AgentMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageRunTime: number;
  lastRunDuration?: number;
  dataProcessed?: number;
  insightsGenerated?: number;
  errorsEncountered?: number;
  lastError?: string;
  lastErrorTimestamp?: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isFinancialTask(task: Doc<"agentTasks">): boolean {
  return task.taskType === "financial_analysis" || 
         task.taskType === "cost_optimization" || 
         task.taskType === "budget_analysis";
}

export function isLegalTask(task: Doc<"agentTasks">): boolean {
  return task.taskType === "legal_review" || 
         task.taskType === "compliance_check" || 
         task.taskType === "risk_assessment";
}

export function isAnalyticsTask(task: Doc<"agentTasks">): boolean {
  return task.taskType === "analytics" || 
         task.taskType === "reporting" || 
         task.taskType === "trend_analysis";
}

export function isNotificationTask(task: Doc<"agentTasks">): boolean {
  return task.taskType === "notification" || 
         task.taskType === "alert" || 
         task.taskType === "digest";
}