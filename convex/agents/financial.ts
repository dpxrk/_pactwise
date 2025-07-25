// convex/agents/financial.ts
import { internalMutation, internalQuery, internalAction, MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { 
  AgentMutationCtx, 
  FinancialAnalysis, 
  FinancialRisk, 
  FinancialOpportunity, 
  AgentMetrics,
  isFinancialTask 
} from "../shared/agent_types";

/**
 * Financial Agent
 * 
 * Responsibilities:
 * - Analyze contract financial terms and pricing structures
 * - Assess financial risks and opportunities
 * - Track spending patterns and budget impact
 * - Identify cost optimization opportunities
 * - Monitor payment schedules and financial obligations
 * - Generate financial insights and recommendations
 * - Detect pricing anomalies and negotiate opportunities
 * - Calculate ROI and value metrics
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const FINANCIAL_CONFIG = {
  // Processing settings
  checkIntervalMinutes: 5,
  batchSize: 10,
  analysisTimeoutMinutes: 10,
  
  // Financial thresholds
  thresholds: {
    highValue: 100000,
    mediumValue: 25000,
    lowValue: 5000,
    criticalSpend: 500000,
    budgetWarningPercent: 80,
    priceVariancePercent: 15,
    unusualIncreasePercent: 20,
  },
  
  // Risk scoring weights
  riskWeights: {
    contractValue: 0.3,
    vendorHistory: 0.2,
    paymentTerms: 0.2,
    priceVolatility: 0.15,
    marketComparison: 0.15,
  },
  
  // Analysis parameters
  analysis: {
    historicalPeriodDays: 365,
    forecastPeriodDays: 90,
    benchmarkSampleSize: 5,
    minDataPointsForTrend: 3,
  },
  
  // Alert thresholds
  alerts: {
    paymentDueDays: 7,
    budgetExceededPercent: 100,
    savingsOpportunityMin: 1000,
    contractStackingThreshold: 3, // Multiple contracts with same vendor
  },
};

// Extended metrics type for financial agent
interface FinancialAgentMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageRunTime: number;
  lastRunDuration?: number;
  dataProcessed?: number;
  insightsGenerated?: number;
  // Financial-specific metrics
  contractsAnalyzed?: number;
  totalValueAnalyzed?: number;
  risksIdentified?: number;
  savingsIdentified?: number;
  paymentsTracked?: number;
  anomaliesDetected?: number;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export const run = internalMutation({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    
    try {
      await ctx.db.insert("agentLogs", {
        agentId: args.agentId,
        level: "info",
        message: "Financial agent starting run",
        timestamp: new Date().toISOString(),
        category: "agent_execution",
      });

      await ctx.db.patch(args.agentId, {
        status: "busy",
        lastRun: new Date().toISOString(),
      });

      // Process assigned analysis tasks
      const tasksProcessed = await processFinancialTasks(ctx, args.agentId);
      
      // Analyze contract portfolio
      const portfolioInsights = await analyzeContractPortfolio(ctx, args.agentId);
      
      // Check payment schedules
      const paymentAlerts = await checkPaymentSchedules(ctx, args.agentId);
      
      // Identify cost optimization opportunities
      const savingsFound = await findCostOptimizations(ctx, args.agentId);
      
      // Detect pricing anomalies
      const anomaliesDetected = await detectPricingAnomalies(ctx, args.agentId);
      
      // Generate financial forecast
      await generateFinancialForecast(ctx, args.agentId);

      // Update metrics
      await updateAgentMetrics(ctx, args.agentId, {
        runTime: Date.now() - startTime,
        tasksProcessed,
        portfolioInsights,
        paymentAlerts,
        savingsFound,
        anomaliesDetected,
      });

      return { 
        success: true, 
        tasksProcessed,
        insightsGenerated: portfolioInsights + paymentAlerts + savingsFound + anomaliesDetected,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = {
        agentId: args.agentId,
        agentType: 'financial',
        operation: 'agent_run',
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      };
      
      await handleAgentError(ctx, args.agentId, error);
      
      // Log detailed error for debugging
      await ctx.db.insert("agentLogs", {
        agentId: args.agentId,
        level: "error",
        message: `Financial agent run failed: ${errorMessage}`,
        data: errorDetails,
        timestamp: new Date().toISOString(),
        category: "agent_execution",
      });
      
      // Return error result instead of throwing
      return { 
        success: false, 
        error: errorMessage,
        tasksProcessed: 0,
        insightsGenerated: 0,
      };
    }
  },
});

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

async function processFinancialTasks(
  ctx: AgentMutationCtx,
  agentId: Id<"agents">
): Promise<number> {
  // Get pending tasks assigned to this agent
  const tasks = await ctx.db
    .query("agentTasks")
    .withIndex("by_assigned_agent", (q) => q.eq("assignedAgentId", agentId))
    .filter((q) => q.eq(q.field("status"), "pending"))
    .take(FINANCIAL_CONFIG.batchSize);

  let processed = 0;

  for (const task of tasks) {
    try {
      // Update task status
      await ctx.db.patch(task._id, {
        status: "in_progress",
        startedAt: new Date().toISOString(),
      });

      // Process based on task type
      let result;
      switch (task.taskType) {
        case "contract_analysis":
          result = await analyzeContract(ctx, agentId, task);
          break;
        case "risk_assessment":
          result = await assessFinancialRisk(ctx, agentId, task);
          break;
        case "payment_verification":
          result = await verifyPaymentTerms(ctx, agentId, task);
          break;
        case "cost_comparison":
          result = await compareCosts(ctx, agentId, task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.taskType}`);
      }

      // Complete task
      await ctx.db.patch(task._id, {
        status: "completed",
        completedAt: new Date().toISOString(),
        result,
      });

      processed++;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const taskType = task.taskType || 'unknown';
      
      // Categorize error for better handling
      const errorCategory = categorizeError(error);
      const isRetryable = errorCategory === 'temporary' || errorCategory === 'rate_limit';
      
      const patchData: {
        status: "pending" | "failed";
        errorMessage: string;
        retryCount: number;
        completedAt?: string;
      } = {
        status: isRetryable && (task.retryCount || 0) < 3 ? "pending" : "failed",
        errorMessage: errorMessage,
        retryCount: (task.retryCount || 0) + 1,
      };
      
      if (!isRetryable) {
        patchData.completedAt = new Date().toISOString();
      }
      
      await ctx.db.patch(task._id, patchData);

      await ctx.db.insert("agentLogs", {
        agentId,
        level: "error",
        message: `Failed to process ${taskType} task ${task._id}`,
        data: { 
          taskId: task._id, 
          taskType: taskType,
          error: errorMessage,
          errorCategory: errorCategory,
          isRetryable: isRetryable,
          retryCount: task.retryCount || 0,
          contractId: task.contractId,
        },
        timestamp: new Date().toISOString(),
        category: "task_processing",
      });
      
      // Don't count retryable errors as failures
      if (!isRetryable) {
        processed--; // Decrement since we incremented earlier
      }
    }
  }

  return processed;
}

async function analyzeContract(
  ctx: AgentMutationCtx,
  agentId: Id<"agents">,
  task: Doc<"agentTasks">
): Promise<FinancialAnalysis> {
  if (!task.contractId) {
    throw new Error("Validation Error: Task missing contractId");
  }
  
  const contract = await ctx.db.get(task.contractId);
  if (!contract) {
    throw new Error("Not Found: Contract does not exist");
  }

  const analysis: FinancialAnalysis = {
    financialSummary: {},
    risks: [],
    opportunities: [],
    metrics: {},
  };

  // Extract and analyze pricing
  if (contract.extractedPricing) {
    const value = parseContractValue(contract.extractedPricing);
    analysis.financialSummary.totalValue = value;
    analysis.financialSummary.valueCategory = categorizeValue(value);
    
    // Check if high value
    if (value > FINANCIAL_CONFIG.thresholds.highValue) {
      analysis.risks.push({
        type: "high_value_exposure",
        severity: "medium",
        description: `High value contract (${formatCurrency(value)}) represents significant financial commitment`,
        mitigationStrategy: "Ensure proper approval chain and payment milestones",
      });
    }
  }

  // Analyze payment terms
  if (contract.extractedPaymentSchedule) {
    const paymentAnalysis = analyzePaymentTerms(contract.extractedPaymentSchedule);
    // analysis.financialSummary.paymentStructure = paymentAnalysis; // TODO: Add to interface or use existing property
    
    if (paymentAnalysis.hasUnfavorableTerms) {
      analysis.risks.push({
        type: "unfavorable_payment_terms",
        severity: "low",
        description: paymentAnalysis.concern,
        mitigationStrategy: "Consider negotiating payment terms",
      });
    }
  }

  // Compare with similar contracts
  const comparison = await compareWithSimilarContracts(ctx, contract);
  if (comparison.priceVariance > FINANCIAL_CONFIG.thresholds.priceVariancePercent) {
    analysis.opportunities.push({
      type: "pricing_negotiation",
      potentialSavings: comparison.potentialSavings,
      description: `Price is ${comparison.priceVariance}% higher than similar contracts`,
      recommendation: "Review pricing and consider renegotiation",
    });
  }

  // Calculate key metrics
  analysis.financialSummary.annualizedValue = calculateAnnualizedValue(contract);
  analysis.metrics = {
    ...analysis.metrics,
    annualizedValue: calculateAnnualizedValue(contract),
    costPerUnit: calculateCostPerUnit(contract),
    paybackPeriod: calculatePaybackPeriod(contract),
    totalCostOfOwnership: calculateTCO(contract),
  };

  // Create insights based on analysis
  if (analysis.risks.length > 0) {
    const insightData: {
      agentId: Id<"agents">;
      type: "financial_risk";
      title: string;
      description: string;
      priority: "high" | "medium";
      contractId: Id<"contracts">;
      actionRequired: boolean;
      actionTaken: boolean;
      isRead: boolean;
      createdAt: string;
      data: FinancialAnalysis;
      vendorId?: Id<"vendors">;
    } = {
      agentId,
      type: "financial_risk",
      title: `Financial Risks Identified: ${contract.title}`,
      description: `${analysis.risks.length} financial risk(s) identified requiring attention`,
      priority: analysis.risks.some(r => r.severity === "high") ? "high" : "medium",
      contractId: contract._id,
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: analysis,
    };
    
    if (contract.vendorId) {
      insightData.vendorId = contract.vendorId;
    }
    
    await ctx.db.insert("agentInsights", insightData);
  }

  // Update contract with analysis results
  await ctx.db.patch(contract._id, {
    analysisStatus: "completed",
  });

  return analysis;
}

async function analyzeContractPortfolio(
  ctx: AgentMutationCtx,
  agentId: Id<"agents">
): Promise<number> {
  let insightsCreated = 0;

  // Get all active contracts
  const activeContracts = await ctx.db
    .query("contracts")
    .withIndex("by_status_and_enterpriseId")
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();

  if (activeContracts.length === 0) return 0;

  // Calculate portfolio metrics
  const portfolioMetrics = {
    totalValue: 0,
    totalAnnualValue: 0,
    contractsByType: {} as Record<string, number>,
    contractsByVendor: {} as Record<string, number>,
    valueByCategory: {} as Record<string, number>,
    expiringNext90Days: 0,
    averageContractValue: 0,
  };

  // Analyze each contract
  for (const contract of activeContracts) {
    const value = parseContractValue(contract.extractedPricing || "0");
    const annualValue = calculateAnnualizedValue(contract);
    
    portfolioMetrics.totalValue += value;
    portfolioMetrics.totalAnnualValue += annualValue;
    
    // Group by type
    const type = contract.contractType || "other";
    portfolioMetrics.contractsByType[type] = (portfolioMetrics.contractsByType[type] || 0) + 1;
    
    // Group by vendor
    if (contract.vendorId) {
      const vendorId = contract.vendorId.toString();
      portfolioMetrics.contractsByVendor[vendorId] = (portfolioMetrics.contractsByVendor[vendorId] || 0) + 1;
    }
    
    // Check expiration
    if (contract.extractedEndDate) {
      const daysUntilExpiry = Math.ceil(
        (new Date(contract.extractedEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilExpiry <= 90 && daysUntilExpiry > 0) {
        portfolioMetrics.expiringNext90Days++;
      }
    }
  }

  portfolioMetrics.averageContractValue = portfolioMetrics.totalValue / activeContracts.length;

  // Check for concentration risk
  const vendorConcentration = Object.entries(portfolioMetrics.contractsByVendor)
    .filter(([_, count]) => count >= FINANCIAL_CONFIG.alerts.contractStackingThreshold);

  if (vendorConcentration.length > 0) {
    insightsCreated++;
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "vendor_risk",
      title: "Vendor Concentration Risk Detected",
      description: `${vendorConcentration.length} vendor(s) have multiple active contracts, creating dependency risk`,
      priority: "medium",
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: {
        vendorConcentration,
        totalVendors: Object.keys(portfolioMetrics.contractsByVendor).length,
      },
    });
  }

  // Generate portfolio summary insight
  insightsCreated++;
  await ctx.db.insert("agentInsights", {
    agentId,
    type: "report",
    title: "Contract Portfolio Financial Summary",
    description: `Total portfolio value: ${formatCurrency(portfolioMetrics.totalAnnualValue)}/year across ${activeContracts.length} contracts`,
    priority: "low",
    actionRequired: false,
    actionTaken: false,
    isRead: false,
    createdAt: new Date().toISOString(),
    data: portfolioMetrics,
  });

  return insightsCreated;
}

async function checkPaymentSchedules(
  ctx: AgentMutationCtx,
  agentId: Id<"agents">
): Promise<number> {
  let alertsCreated = 0;
  
  const contracts = await ctx.db
    .query("contracts")
    .withIndex("by_status_and_enterpriseId")
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();

  const upcomingPayments: any[] = [];

  for (const contract of contracts) {
    if (!contract.extractedPaymentSchedule) continue;

    const payments = parsePaymentSchedule(contract.extractedPaymentSchedule);
    const now = new Date();
    
    for (const payment of payments) {
      const daysUntilDue = Math.ceil(
        (payment.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilDue <= FINANCIAL_CONFIG.alerts.paymentDueDays && daysUntilDue > 0) {
        upcomingPayments.push({
          contractId: contract._id,
          contractTitle: contract.title,
          vendorId: contract.vendorId || undefined,
          amount: payment.amount,
          dueDate: payment.dueDate,
          daysUntilDue,
        });
      }
    }
  }

  if (upcomingPayments.length > 0) {
    alertsCreated++;
    
    const totalDue = upcomingPayments.reduce((sum, p) => sum + p.amount, 0);
    
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "alert",
      title: "Upcoming Payment Obligations",
      description: `${upcomingPayments.length} payment(s) totaling ${formatCurrency(totalDue)} due within ${FINANCIAL_CONFIG.alerts.paymentDueDays} days`,
      priority: "high",
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: {
        payments: upcomingPayments,
        totalAmount: totalDue,
      },
    });

    // Create notification task
    const notificationsAgent = await ctx.db
      .query("agents")
      .withIndex("by_type", (q: any) => q.eq("type", "notifications"))
      .first();

    if (notificationsAgent) {
      await ctx.db.insert("agentTasks", {
        assignedAgentId: notificationsAgent._id,
        createdByAgentId: agentId,
        taskType: "send_notification",
        status: "pending",
        priority: "high",
        title: "Notify: Upcoming payment obligations",
        data: {
          input: {
            notificationType: "payment_reminder",
            urgency: "high",
            payments: upcomingPayments,
          },
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return alertsCreated;
}

async function findCostOptimizations(
  ctx: AgentMutationCtx,
  agentId: Id<"agents">
): Promise<number> {
  let opportunitiesFound = 0;

  // Analyze contracts by vendor for bundling opportunities
  const contractsByVendor = await ctx.db
    .query("contracts")
    .withIndex("by_status_and_enterpriseId")
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();

  const vendorGroups: Record<string, any[]> = {};
  
  for (const contract of contractsByVendor) {
    if (contract.vendorId) {
      const vendorId = contract.vendorId.toString();
      if (!vendorGroups[vendorId]) {
        vendorGroups[vendorId] = [];
      }
      vendorGroups[vendorId].push(contract);
    }
  }

  // Check for bundling opportunities
  for (const [vendorId, contracts] of Object.entries(vendorGroups)) {
    if (contracts.length >= 2) {
      const totalValue = contracts.reduce((sum, c) => sum + parseContractValue(c.extractedPricing || "0"), 0);
      const potentialSavings = totalValue * 0.1; // Assume 10% bundling discount
      
      if (potentialSavings >= FINANCIAL_CONFIG.alerts.savingsOpportunityMin) {
        opportunitiesFound++;
        
        await ctx.db.insert("agentInsights", {
          agentId,
          type: "cost_optimization",
          title: "Contract Bundling Opportunity",
          description: `Potential savings of ${formatCurrency(potentialSavings)} by bundling ${contracts.length} contracts with the same vendor`,
          priority: "medium",
          vendorId: contracts[0].vendorId,
          actionRequired: true,
          actionTaken: false,
          isRead: false,
          createdAt: new Date().toISOString(),
          data: {
            vendorId,
            contractCount: contracts.length,
            totalValue,
            potentialSavings,
            contractIds: contracts.map(c => c._id),
          },
        });
      }
    }
  }

  // Check for duplicate services
  const contractsByType: Record<string, any[]> = {};
  
  for (const contract of contractsByVendor) {
    const type = contract.contractType || "other";
    if (!contractsByType[type]) {
      contractsByType[type] = [];
    }
    contractsByType[type].push(contract);
  }

  // Look for potential redundancies
  for (const [type, contracts] of Object.entries(contractsByType)) {
    if (contracts.length >= 3 && type !== "other") {
      opportunitiesFound++;
      
      const totalValue = contracts.reduce((sum, c) => sum + parseContractValue(c.extractedPricing || "0"), 0);
      
      await ctx.db.insert("agentInsights", {
        agentId,
        type: "cost_optimization",
        title: `Multiple ${type} Contracts Detected`,
        description: `${contracts.length} active ${type} contracts worth ${formatCurrency(totalValue)}. Review for potential consolidation.`,
        priority: "low",
        actionRequired: true,
        actionTaken: false,
        isRead: false,
        createdAt: new Date().toISOString(),
        data: {
          contractType: type,
          contractCount: contracts.length,
          totalValue,
          averageValue: totalValue / contracts.length,
        },
      });
    }
  }

  return opportunitiesFound;
}

async function detectPricingAnomalies(
  ctx: AgentMutationCtx,
  agentId: Id<"agents">
): Promise<number> {
  let anomaliesFound = 0;

  // Get contracts grouped by type for comparison
  const contractsByType = await ctx.db
    .query("contracts")
    .withIndex("by_contractType_and_enterpriseId")
    .collect();

  const typeGroups: Record<string, any[]> = {};
  
  for (const contract of contractsByType) {
    if (!contract.extractedPricing) continue;
    
    const type = contract.contractType || "other";
    if (!typeGroups[type]) {
      typeGroups[type] = [];
    }
    typeGroups[type].push(contract);
  }

  // Analyze each type group for anomalies
  for (const [type, contracts] of Object.entries(typeGroups)) {
    if (contracts.length < FINANCIAL_CONFIG.analysis.minDataPointsForTrend) continue;

    const values = contracts
      .map(c => parseContractValue(c.extractedPricing))
      .filter(v => v > 0);

    if (values.length === 0) continue;

    const stats = calculateStatistics(values);
    
    // Check each contract for anomalies
    for (const contract of contracts) {
      const value = parseContractValue(contract.extractedPricing);
      const zScore = Math.abs((value - stats.mean) / stats.stdDev);
      
      if (zScore > 2) { // More than 2 standard deviations from mean
        anomaliesFound++;
        
        await ctx.db.insert("agentInsights", {
          agentId,
          type: "anomaly_detection",
          title: `Unusual Pricing Detected: ${contract.title}`,
          description: `Contract value (${formatCurrency(value)}) is ${zScore.toFixed(1)} standard deviations from typical ${type} contracts`,
          priority: "medium",
          contractId: contract._id,
          vendorId: contract.vendorId || undefined,
          actionRequired: true,
          actionTaken: false,
          isRead: false,
          createdAt: new Date().toISOString(),
          data: {
            contractValue: value,
            typeAverage: stats.mean,
            typeStdDev: stats.stdDev,
            zScore,
            percentageDifference: ((value - stats.mean) / stats.mean * 100).toFixed(1),
          },
        });
      }
    }
  }

  return anomaliesFound;
}

async function generateFinancialForecast(
  ctx: AgentMutationCtx,
  agentId: Id<"agents">
): Promise<void> {
  // Get historical contract data
  const historicalContracts = await ctx.db
    .query("contracts")
    .collect();

  if (historicalContracts.length < 10) return; // Need sufficient data

  // Calculate monthly spend trends
  const monthlySpend: Record<string, number> = {};
  const now = new Date();
  
  for (const contract of historicalContracts) {
    if (!contract._creationTime) continue;
    
    const contractDate = new Date(contract._creationTime);
    const monthKey = `${contractDate.getFullYear()}-${(contractDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const value = parseContractValue(contract.extractedPricing || "0");
    
    monthlySpend[monthKey] = (monthlySpend[monthKey] || 0) + value;
  }

  // Calculate trend
  const months = Object.keys(monthlySpend).sort();
  if (months.length < 3) return;

  const recentMonths = months.slice(-6); // Last 6 months
  const recentValues = recentMonths.map(m => monthlySpend[m] || 0);
  const averageMonthlySpend = recentValues.reduce((a: number, b: number) => (a || 0) + (b || 0), 0) / recentValues.length;
  
  // Simple linear projection for next 3 months
  const growthRate = calculateGrowthRate(recentValues.filter(v => v !== undefined) as number[]);
  const projectedSpend: Array<{month: number, amount: number}> = [];
  
  for (let i = 1; i <= 3; i++) {
    const projected = averageMonthlySpend * Math.pow(1 + growthRate, i);
    projectedSpend.push({
      month: i,
      amount: projected,
    });
  }

  const totalProjected = projectedSpend.reduce((sum, p) => sum + p.amount, 0);

  await ctx.db.insert("agentInsights", {
    agentId,
    type: "trend_analysis",
    title: "Quarterly Spend Forecast",
    description: `Projected contract spend for next quarter: ${formatCurrency(totalProjected)} based on ${growthRate > 0 ? 'increasing' : 'decreasing'} trend`,
    priority: "low",
    actionRequired: false,
    actionTaken: false,
    isRead: false,
    createdAt: new Date().toISOString(),
    data: {
      historicalAverage: averageMonthlySpend,
      growthRate: (growthRate * 100).toFixed(1) + '%',
      projectedMonths: projectedSpend,
      totalProjected,
      confidence: 0.7, // Simple model, moderate confidence
    },
  });
}

// ============================================================================
// ERROR HANDLING HELPERS
// ============================================================================

function categorizeError(error: unknown): 'validation' | 'permission' | 'not_found' | 'temporary' | 'rate_limit' | 'unknown' {
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  
  if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
    return 'not_found';
  }
  if (errorMessage.includes('permission') || errorMessage.includes('access denied') || errorMessage.includes('unauthorized')) {
    return 'permission';
  }
  if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    return 'validation';
  }
  if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
    return 'rate_limit';
  }
  if (errorMessage.includes('timeout') || errorMessage.includes('network') || errorMessage.includes('temporary')) {
    return 'temporary';
  }
  
  return 'unknown';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseContractValue(priceString: string): number {
  if (!priceString) return 0;
  
  // Remove currency symbols and clean the string
  const cleaned = priceString.replace(/[^0-9.,]/g, '');
  
  // Handle different number formats
  let normalized = cleaned;
  
  // If there's both comma and period, assume comma is thousands separator
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.replace(/,/g, '');
  } else if (cleaned.includes(',')) {
    // Check if comma is decimal separator (European format)
    const parts = cleaned.split(',');
    if (parts && parts.length === 2 && parts[1] && parts[1]!.length <= 2) {
      normalized = cleaned.replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  }
  
  const value = parseFloat(normalized);
  return isNaN(value) ? 0 : value;
}

function categorizeValue(value: number): string {
  if (value >= FINANCIAL_CONFIG.thresholds.criticalSpend) return "critical";
  if (value >= FINANCIAL_CONFIG.thresholds.highValue) return "high";
  if (value >= FINANCIAL_CONFIG.thresholds.mediumValue) return "medium";
  if (value >= FINANCIAL_CONFIG.thresholds.lowValue) return "low";
  return "minimal";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function analyzePaymentTerms(scheduleText: string): {
  structure: string;
  frequency: string;
  hasUnfavorableTerms: boolean;
  concern: string;
} {
  const analysis = {
    structure: "unknown",
    frequency: "unknown",
    hasUnfavorableTerms: false,
    concern: "",
  };

  const lowerText = scheduleText.toLowerCase();

  // Detect payment structure
  if (lowerText.includes("monthly")) {
    analysis.structure = "recurring";
    analysis.frequency = "monthly";
  } else if (lowerText.includes("quarterly")) {
    analysis.structure = "recurring";
    analysis.frequency = "quarterly";
  } else if (lowerText.includes("annual") || lowerText.includes("yearly")) {
    analysis.structure = "recurring";
    analysis.frequency = "annual";
  } else if (lowerText.includes("one-time") || lowerText.includes("lump sum")) {
    analysis.structure = "one-time";
  }

  // Check for unfavorable terms
  if (lowerText.includes("advance") || lowerText.includes("prepay")) {
    analysis.hasUnfavorableTerms = true;
    analysis.concern = "Requires advance payment";
  } else if (lowerText.includes("penalty") || lowerText.includes("late fee")) {
    analysis.hasUnfavorableTerms = true;
    analysis.concern = "Contains penalty clauses";
  }

  return analysis;
}

async function compareWithSimilarContracts(ctx: AgentMutationCtx, contract: Doc<"contracts">): Promise<{
  priceVariance: number;
  potentialSavings: number;
  averageMarketPrice?: number;
  sampleSize?: number;
}> {
  // Get similar contracts
  const similarContracts = await ctx.db
    .query("contracts")
    .withIndex("by_contractType_and_enterpriseId")
    .filter((q) => 
      q.and(
        q.eq(q.field("contractType"), contract.contractType),
        q.neq(q.field("_id"), contract._id)
      )
    )
    .take(FINANCIAL_CONFIG.analysis.benchmarkSampleSize);

  if (similarContracts.length === 0) {
    return { priceVariance: 0, potentialSavings: 0 };
  }

  const currentValue = parseContractValue(contract.extractedPricing || "0");
  const similarValues = similarContracts
    .map((c) => parseContractValue(c.extractedPricing || "0"))
    .filter((v) => v > 0);

  if (similarValues.length === 0 || currentValue === 0) {
    return { priceVariance: 0, potentialSavings: 0 };
  }

  const averageSimilar = similarValues.reduce((a, b) => a + b, 0) / similarValues.length;
  const variance = ((currentValue - averageSimilar) / averageSimilar) * 100;
  const savings = variance > 0 ? currentValue - averageSimilar : 0;

  return {
    priceVariance: variance,
    potentialSavings: savings,
    averageMarketPrice: averageSimilar,
    sampleSize: similarValues.length,
  };
}

async function assessFinancialRisk(ctx: AgentMutationCtx, agentId: Id<"agents">, task: Doc<"agentTasks">): Promise<FinancialAnalysis> {
  if (!task.contractId) {
    throw new Error("Contract ID not provided for risk assessment");
  }
  const contract = await ctx.db.get(task.contractId);
  if (!contract) {
    throw new Error("Contract not found for risk assessment");
  }

  const riskFactors: string[] = [];
  let riskScore = 0;

  // Assess contract value risk
  const value = parseContractValue(contract.extractedPricing || "0");
  if (value > FINANCIAL_CONFIG.thresholds.criticalSpend) {
    riskFactors.push("Very high contract value");
    riskScore += 30;
  } else if (value > FINANCIAL_CONFIG.thresholds.highValue) {
    riskFactors.push("High contract value");
    riskScore += 15;
  }

  // Assess payment terms risk
  if (contract.extractedPaymentSchedule) {
    const paymentAnalysis = analyzePaymentTerms(contract.extractedPaymentSchedule);
    if (paymentAnalysis.hasUnfavorableTerms) {
      riskFactors.push("Unfavorable payment terms");
      riskScore += 10;
    }
  }

  // Assess duration risk
  if (contract.extractedStartDate && contract.extractedEndDate) {
    const duration = Math.ceil(
      (new Date(contract.extractedEndDate).getTime() - new Date(contract.extractedStartDate).getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    if (duration > 1095) { // More than 3 years
      riskFactors.push("Long-term commitment");
      riskScore += 15;
    }
  }

  const riskLevel = riskScore > 40 ? "high" : riskScore > 20 ? "medium" : "low";

  const risks: FinancialRisk[] = riskFactors.map(factor => ({
    type: "contract_risk",
    severity: riskLevel as "low" | "medium" | "high" | "critical",
    description: factor,
  }));

  return {
    financialSummary: {
      totalValue: parseContractValue(contract.extractedPricing || "0"),
    },
    risks,
    opportunities: [],
    metrics: {
      paymentTerms: contract.extractedPaymentSchedule,
    },
  };
}

async function verifyPaymentTerms(ctx: AgentMutationCtx, agentId: Id<"agents">, task: Doc<"agentTasks">): Promise<{
  isValid: boolean;
  issues: string[];
  recommendations: string[];
}> {
  if (!task.contractId) {
    throw new Error("Contract ID not provided for payment verification");
  }
  const contract = await ctx.db.get(task.contractId);
  if (!contract) {
    throw new Error("Contract not found for payment verification");
  }

  const verification = {
    isValid: true,
    issues: [] as string[],
    recommendations: [] as string[],
  };

  if (!contract.extractedPaymentSchedule) {
    verification.isValid = false;
    verification.issues.push("No payment schedule found in contract");
    verification.recommendations.push("Review contract for payment terms");
    return verification;
  }

  const paymentAnalysis = analyzePaymentTerms(contract.extractedPaymentSchedule);
  
  if (paymentAnalysis.hasUnfavorableTerms) {
    verification.issues.push(paymentAnalysis.concern);
    verification.recommendations.push("Consider renegotiating payment terms");
  }

  // Check for reasonable payment frequency
  if (paymentAnalysis.frequency === "unknown") {
    verification.issues.push("Payment frequency unclear");
    verification.recommendations.push("Clarify payment schedule with vendor");
  }

  return verification;
}

async function compareCosts(ctx: AgentMutationCtx, agentId: Id<"agents">, task: Doc<"agentTasks">): Promise<{
  comparison: unknown;
  savings?: number;
  recommendations: string[];
}> {
  if (!task.contractId) {
    throw new Error("Contract ID not provided for cost comparison");
  }
  const contract = await ctx.db.get(task.contractId);
  if (!contract) {
    throw new Error("Contract not found for cost comparison");
  }

  const comparison = await compareWithSimilarContracts(ctx, contract);
  
  return {
    comparison: {
      currentValue: parseContractValue(contract.extractedPricing || "0"),
      marketAverage: comparison.averageMarketPrice || 0,
      variance: comparison.priceVariance,
    },
    savings: comparison.potentialSavings,
    recommendations: [
      comparison.priceVariance > 15 
        ? "Consider renegotiation - price significantly above market"
        : "Price appears competitive"
    ],
  };
}

async function updateAgentMetrics(
  ctx: AgentMutationCtx,
  agentId: Id<"agents">,
  runData: {
    runTime: number;
    tasksProcessed: number;
    portfolioInsights: number;
    paymentAlerts: number;
    savingsFound: number;
    anomaliesDetected: number;
  }
): Promise<void> {
  const agent = await ctx.db.get(agentId);
  if (!agent) return;

  const existingMetrics = (agent.metrics as FinancialAgentMetrics) || {
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    averageRunTime: 0,
    contractsAnalyzed: 0,
    totalValueAnalyzed: 0,
    risksIdentified: 0,
    savingsIdentified: 0,
    paymentsTracked: 0,
    anomaliesDetected: 0,
  };

  const newMetrics: FinancialAgentMetrics = {
    ...existingMetrics,
    totalRuns: existingMetrics.totalRuns + 1,
    successfulRuns: existingMetrics.successfulRuns + 1,
    averageRunTime: 
      ((existingMetrics.averageRunTime * existingMetrics.totalRuns) + runData.runTime) / 
      (existingMetrics.totalRuns + 1),
    lastRunDuration: runData.runTime,
    contractsAnalyzed: (existingMetrics.contractsAnalyzed || 0) + runData.tasksProcessed,
    anomaliesDetected: (existingMetrics.anomaliesDetected || 0) + runData.anomaliesDetected,
    insightsGenerated: (existingMetrics.insightsGenerated || 0) + 
      runData.portfolioInsights + runData.paymentAlerts + runData.savingsFound + runData.anomaliesDetected,
  };

  await ctx.db.patch(agentId, {
    status: "active",
    lastSuccess: new Date().toISOString(),
    runCount: (agent.runCount || 0) + 1,
    metrics: newMetrics,
  });
}

async function handleAgentError(ctx: AgentMutationCtx, agentId: Id<"agents">, error: unknown): Promise<void> {
  await ctx.db.insert("agentLogs", {
    agentId,
    level: "error",
    message: "Financial agent failed",
    data: { error: error instanceof Error ? error.message : String(error) },
    timestamp: new Date().toISOString(),
    category: "agent_execution",
  });

  const agent = await ctx.db.get(agentId);
  if (agent) {
    const existingMetrics = (agent.metrics as FinancialAgentMetrics) || {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      averageRunTime: 0,
    };

    await ctx.db.patch(agentId, {
      status: "error",
      errorCount: (agent.errorCount || 0) + 1,
      lastError: error instanceof Error ? error.message : String(error),
      metrics: {
        ...existingMetrics,
        totalRuns: existingMetrics.totalRuns + 1,
        failedRuns: existingMetrics.failedRuns + 1,
      },
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================



function calculateAnnualizedValue(contract: Doc<"contracts">): number {
  const totalValue = parseContractValue(contract.extractedPricing || "0");
  
  if (!contract.extractedStartDate || !contract.extractedEndDate) {
    return totalValue; // Assume annual if no dates
  }

  try {
    const startDate = new Date(contract.extractedStartDate);
    const endDate = new Date(contract.extractedEndDate);
    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (durationDays <= 0) return totalValue;
    
    const annualizedValue = (totalValue / durationDays) * 365;
    return annualizedValue;
  } catch (error) {
    return totalValue; // Fallback if date parsing fails
  }
}

function calculateCostPerUnit(contract: Doc<"contracts">): number {
  const totalValue = parseContractValue(contract.extractedPricing || "0");
  
  // Extract potential unit information from scope, pricing, and payment schedule
  const searchText = [
    contract.extractedScope || "",
    contract.extractedPricing || "",
    contract.extractedPaymentSchedule || "",
    contract.title || ""
  ].join(" ").toLowerCase();
  
  // Comprehensive unit patterns
  const unitPatterns = [
    /(\d+)\s*(users?|licenses?|seats?|accounts?)/gi,
    /(\d+)\s*(gb|tb|mb)\s*(storage|data|bandwidth)/gi,
    /(\d+)\s*(hours?|days?|months?|years?)\s*(of\s+)?(service|support|consulting)/gi,
    /(\d+)\s*(units?|items?|devices?|machines?)/gi,
    /per\s+(user|seat|license|unit|device)\s*[:\s]*\$?([\d,]+)/gi,
    /\$?([\d,]+)\s*\/\s*(user|seat|license|unit|month)/gi
  ];
  
  let units = 0;
  let costPerUnit = 0;
  
  // Try to find unit count
  for (const pattern of unitPatterns) {
    const matches = Array.from(searchText.matchAll(pattern));
    if (matches.length > 0) {
      const match = matches[0];
      // Check for direct per-unit pricing
      if (pattern.source.includes('per\\s+')) {
        if (match && match[2]) {
          costPerUnit = parseFloat(match[2].replace(/,/g, ''));
          if (costPerUnit > 0) {
            return costPerUnit;
          }
        }
      } else if (match && match[1]) {
        // Extract unit count
        const potentialUnits = parseInt(match[1]);
        if (potentialUnits > 0 && potentialUnits < 100000) { // Sanity check
          units = potentialUnits;
          break;
        }
      }
    }
  }
  
  // Calculate cost per unit if we found units
  if (units > 0) {
    return totalValue / units;
  }
  
  // For time-based contracts, calculate monthly cost
  if (contract.extractedStartDate && contract.extractedEndDate) {
    const start = new Date(contract.extractedStartDate);
    const end = new Date(contract.extractedEndDate);
    const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    if (months > 0) {
      return totalValue / months; // Cost per month
    }
  }
  
  return totalValue; // Return total if no units found
}

function calculatePaybackPeriod(contract: Doc<"contracts">): number {
  const investmentCost = parseContractValue(contract.extractedPricing || "0");
  
  // Extract savings or benefit information from contract
  const searchText = [
    contract.extractedScope || "",
    contract.notes || "",
    contract.title || ""
  ].join(" ").toLowerCase();
  
  // Look for savings or ROI mentions
  const savingsPatterns = [
    /sav(?:e|ing|ings)\s*(?:of\s*)?\$?([\d,]+)\s*(?:per\s*)?(month|year|annually)?/gi,
    /roi\s*(?:of\s*)?([\d.]+)\s*%/gi,
    /reduce.*cost.*by\s*\$?([\d,]+)/gi,
    /([\d.]+)\s*%\s*(?:cost\s*)?reduction/gi,
    /benefit(?:s)?\s*(?:of\s*)?\$?([\d,]+)/gi
  ];
  
  let monthlySavings = 0;
  
  for (const pattern of savingsPatterns) {
    const matches = Array.from(searchText.matchAll(pattern));
    if (matches.length > 0) {
      const match = matches[0];
      if (pattern.source.includes('roi') || pattern.source.includes('%')) {
        // ROI or percentage savings
        if (match && match[1]) {
          const percentage = parseFloat(match[1]);
          if (percentage > 0 && percentage <= 100) {
            monthlySavings = (investmentCost * (percentage / 100)) / 12; // Monthly ROI
            break;
          }
        }
      } else {
        // Direct savings amount
        if (match && match[1]) {
          const savingsAmount = parseFloat(match[1].replace(/,/g, ''));
          const period = match[2]?.toLowerCase();
        
          if (savingsAmount > 0) {
            if (period === 'year' || period === 'annually') {
              monthlySavings = savingsAmount / 12;
            } else {
              monthlySavings = savingsAmount; // Assume monthly if not specified
            }
            break;
          }
        }
      }
    }
  }
  
  // If no explicit savings found, estimate based on contract type
  if (monthlySavings === 0) {
    const contractType = contract.contractType?.toLowerCase() || '';
    const estimatedROI: { [key: string]: number } = {
      'saas': 0.15,           // 15% annual ROI
      'software': 0.20,       // 20% annual ROI
      'consulting': 0.25,     // 25% annual ROI
      'technology': 0.18,     // 18% annual ROI
      'service': 0.12,        // 12% annual ROI
      'maintenance': 0.10,    // 10% annual ROI (cost avoidance)
      'insurance': 0.08,      // 8% annual ROI (risk mitigation)
    };
    
    const roi = estimatedROI[contractType] || 0.10; // Default 10%
    monthlySavings = (investmentCost * roi) / 12;
  }
  
  if (monthlySavings <= 0) return Infinity;
  
  return investmentCost / monthlySavings; // Months to payback
}

function calculateTCO(contract: Doc<"contracts">): number {
  const baseValue = parseContractValue(contract.extractedPricing || "0");
  
  // Calculate contract duration in years
  let contractYears = 1; // Default to 1 year
  if (contract.extractedStartDate && contract.extractedEndDate) {
    const start = new Date(contract.extractedStartDate);
    const end = new Date(contract.extractedEndDate);
    contractYears = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365));
  }
  
  // Extract additional cost information from contract
  const searchText = [
    contract.extractedScope || "",
    contract.extractedPaymentSchedule || "",
    contract.notes || ""
  ].join(" ").toLowerCase();
  
  // Look for specific cost mentions
  const costPatterns = [
    /implementation\s*(?:fee|cost)?\s*:?\s*\$?([\d,]+)/gi,
    /setup\s*(?:fee|cost)?\s*:?\s*\$?([\d,]+)/gi,
    /training\s*(?:fee|cost)?\s*:?\s*\$?([\d,]+)/gi,
    /maintenance\s*(?:fee|cost)?\s*:?\s*\$?([\d,]+)\s*(?:per\s*)?(year|month)?/gi,
    /support\s*(?:fee|cost)?\s*:?\s*\$?([\d,]+)\s*(?:per\s*)?(year|month)?/gi,
    /additional\s*(?:fees?|costs?)\s*:?\s*\$?([\d,]+)/gi
  ];
  
  let implementationCost = 0;
  let annualMaintenanceCost = 0;
  let trainingCost = 0;
  let foundExplicitCosts = false;
  
  for (const pattern of costPatterns) {
    const matches = Array.from(searchText.matchAll(pattern));
    if (matches.length > 0) {
      foundExplicitCosts = true;
      const match = matches[0];
      if (match && match[1]) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
      
        if (pattern.source.includes('implementation') || pattern.source.includes('setup')) {
          implementationCost += amount;
        } else if (pattern.source.includes('training')) {
          trainingCost += amount;
        } else if (pattern.source.includes('maintenance') || pattern.source.includes('support')) {
          const period = match[2]?.toLowerCase();
          if (period === 'month') {
            annualMaintenanceCost += amount * 12;
          } else {
            annualMaintenanceCost += amount;
          }
        }
      }
    }
  }
  
  // If no explicit costs found, estimate based on contract type and value
  if (!foundExplicitCosts) {
    const contractType = contract.contractType?.toLowerCase() || '';
    
    // TCO multipliers by contract type
    const tcoMultipliers: Record<string, {
      implementation: number;
      training: number;
      maintenance: number;
      infrastructure: number;
    }> = {
      'saas': {
        implementation: 0.10,      // 10% one-time
        training: 0.05,           // 5% one-time
        maintenance: 0.15,        // 15% annual (support, updates)
        infrastructure: 0.05      // 5% annual (integration, monitoring)
      },
      'software': {
        implementation: 0.20,      // 20% one-time
        training: 0.10,           // 10% one-time
        maintenance: 0.20,        // 20% annual
        infrastructure: 0.10      // 10% annual
      },
      'consulting': {
        implementation: 0.05,      // 5% one-time
        training: 0.00,           // Usually included
        maintenance: 0.00,        // Project-based
        infrastructure: 0.02      // 2% annual (tools, communication)
      },
      'service': {
        implementation: 0.08,      // 8% one-time
        training: 0.03,           // 3% one-time
        maintenance: 0.10,        // 10% annual
        infrastructure: 0.05      // 5% annual
      },
      'default': {
        implementation: 0.15,      // 15% one-time
        training: 0.05,           // 5% one-time
        maintenance: 0.15,        // 15% annual
        infrastructure: 0.05      // 5% annual
      }
    };
    
    const multipliers = tcoMultipliers[contractType] || tcoMultipliers.default;
    
    implementationCost = baseValue * (multipliers?.implementation || 0);
    trainingCost = baseValue * (multipliers?.training || 0);
    annualMaintenanceCost = baseValue * ((multipliers?.maintenance || 0) + (multipliers?.infrastructure || 0));
  }
  
  // Calculate total TCO
  const oneTimeCosts = implementationCost + trainingCost;
  const recurringCosts = annualMaintenanceCost * contractYears;
  
  // Add hidden costs (estimated at 10-20% for unforeseen expenses)
  const hiddenCosts = (baseValue + oneTimeCosts + recurringCosts) * 0.10;
  
  return baseValue + oneTimeCosts + recurringCosts + hiddenCosts;
}

function calculateStatistics(values: number[]): { mean: number; stdDev: number; median: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0, median: 0 };
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0 
    ? ((sorted[sorted.length / 2 - 1]!) + (sorted[sorted.length / 2]!)) / 2
    : sorted[Math.floor(sorted.length / 2)]!;
  
  return { mean, stdDev, median };
}

function calculateGrowthRate(values: number[]): number {
  if (values.length < 2) return 0;
  
  // Simple linear regression to find growth trend
  const n = values.length;
  const xSum = n * (n - 1) / 2; // Sum of indices 0, 1, 2, ...
  const ySum = values.reduce((a, b) => a + b, 0);
  const xySum = values.reduce((sum, val, index) => sum + (val * index), 0);
  const xxSum = n * (n - 1) * (2 * n - 1) / 6; // Sum of squares
  
  const slope = (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum);
  const avgValue = ySum / n;
  
  return avgValue > 0 ? slope / avgValue : 0; // Growth rate as percentage
}

function parsePaymentSchedule(scheduleText: string): Array<{ amount: number; dueDate: Date }> {
  const payments: Array<{ amount: number; dueDate: Date }> = [];
  
  // Comprehensive payment schedule parsing with multiple patterns
  const lines = scheduleText.split(/[\n;,]/);
  
  // Common payment patterns to match
  const patterns = [
    // Pattern 1: "$1,000 due on 2024-01-15" or "1000 USD by Jan 15, 2024"
    /\$?([\d,]+(?:\.\d{2})?)\s*(?:USD)?\s*(?:due|by|on)?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    // Pattern 2: "Payment of $5,000 on January 15th, 2024"
    /payment\s+of\s+\$?([\d,]+(?:\.\d{2})?)\s*(?:on|by)?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/i,
    // Pattern 3: "15/01/2024: $1,000" or "2024-01-15 - 1000"
    /(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})[:\s-]+\$?([\d,]+(?:\.\d{2})?)/i,
    // Pattern 4: "Monthly payment: $1,000" (for recurring)
    /(monthly|quarterly|annual|yearly)\s+payment[:\s]+\$?([\d,]+(?:\.\d{2})?)/i,
    // Pattern 5: Milestone payments "Upon completion: $10,000"
    /(?:upon|after|on)\s+([\w\s]+):\s*\$?([\d,]+(?:\.\d{2})?)/i,
  ];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Try each pattern
    for (const pattern of patterns) {
      const match = trimmedLine.match(pattern);
      
      if (match) {
        let amount: number = 0;
        let dateStr: string = '';
        let isRecurring = false;
        
        // Handle different capture group positions based on pattern
        if (pattern.source.includes('monthly|quarterly')) {
          // Recurring payment pattern
          const frequency = match[1]!.toLowerCase();
          amount = parseFloat(match[2]!.replace(/[,$]/g, ''));
          
          // Generate dates based on frequency
          const now = new Date();
          const dates = generateRecurringDates(frequency, now, 12); // Next 12 occurrences
          
          dates.forEach(date => {
            payments.push({ amount, dueDate: date });
          });
          isRecurring = true;
        } else if (match[1] && match[1].match(/\d/)) {
          // Date comes first
          dateStr = match[1]!;
          amount = parseFloat(match[2]!.replace(/[,$]/g, ''));
        } else {
          // Amount comes first
          amount = parseFloat(match[1]!.replace(/[,$]/g, ''));
          dateStr = match[2]!;
        }
        
        if (!isRecurring && dateStr) {
          const parsedDate = parseDate(dateStr);
          if (parsedDate && !isNaN(parsedDate.getTime()) && amount > 0) {
            payments.push({ amount, dueDate: parsedDate });
          }
        }
        
        break; // Move to next line after successful match
      }
    }
  }
  
  // Sort payments by due date
  return payments.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

// Helper function to parse various date formats
function parseDate(dateStr: string): Date | null {
  // Try standard formats first
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date;
  
  // Convert MM/DD/YYYY to YYYY-MM-DD
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts;
      date = new Date(`${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`);
      if (!isNaN(date.getTime())) return date;
    }
  }
  
  // Try parsing month names "January 15, 2024" or "15 Jan 2024"
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthMatch = dateStr.toLowerCase().match(new RegExp(`(\\d{1,2})\\s*(${monthNames.join('|')})[a-z]*\\s*(\\d{4})|` +
    `(${monthNames.join('|')})[a-z]*\\s*(\\d{1,2}),?\\s*(\\d{4})`, 'i'));
  
  if (monthMatch) {
    let day: string, month: string, year: string;
    if (monthMatch[1]) {
      // Format: "15 Jan 2024"
      day = monthMatch[1];
      month = monthMatch[2]!;
      year = monthMatch[3]!;
    } else {
      // Format: "Jan 15, 2024"
      month = monthMatch[4]!;
      day = monthMatch[5]!;
      year = monthMatch[6]!;
    }
    
    const monthIndex = monthNames.indexOf(month.toLowerCase().slice(0, 3)) + 1;
    date = new Date(`${year}-${monthIndex.toString().padStart(2, '0')}-${day.padStart(2, '0')}`);
    if (!isNaN(date.getTime())) return date;
  }
  
  return null;
}

// Generate recurring payment dates based on frequency
function generateRecurringDates(frequency: string, startDate: Date, count: number): Date[] {
  const dates: Date[] = [];
  const date = new Date(startDate);
  
  for (let i = 0; i < count; i++) {
    switch (frequency.toLowerCase()) {
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'annual':
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      default:
        date.setMonth(date.getMonth() + 1); // Default to monthly
    }
    dates.push(new Date(date));
  }
  
  return dates;
}

function generateRiskRecommendations(riskFactors: string[], riskLevel: string): string[] {
  const recommendations: string[] = [];
  
  if (riskLevel === "high") {
    recommendations.push("Require additional approval levels for this contract");
    recommendations.push("Consider breaking contract into smaller phases");
  }
  
  if (riskFactors.includes("Very high contract value")) {
    recommendations.push("Implement milestone-based payments");
    recommendations.push("Require performance bonds or guarantees");
  }
  
  if (riskFactors.includes("Unfavorable payment terms")) {
    recommendations.push("Negotiate more favorable payment schedule");
    recommendations.push("Consider alternative payment structures");
  }
  
  if (riskFactors.includes("Long-term commitment")) {
    recommendations.push("Include periodic review clauses");
    recommendations.push("Add early termination options");
  }
  
  return recommendations;
}