// convex/agents/financial.ts
import { internalMutation, internalQuery, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

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
      await handleAgentError(ctx, args.agentId, error);
      throw error;
    }
  },
});

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

async function processFinancialTasks(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  // Get pending tasks assigned to this agent
  const tasks = await ctx.db
    .query("agentTasks")
    .withIndex("by_assigned_agent", (q: any) => q.eq("assignedAgentId", agentId))
    .filter((q: any) => q.eq(q.field("status"), "pending"))
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
      await ctx.db.patch(task._id, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date().toISOString(),
      });

      await ctx.db.insert("agentLogs", {
        agentId,
        level: "error",
        message: `Failed to process task ${task._id}`,
        data: { taskId: task._id, error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date().toISOString(),
        category: "task_processing",
      });
    }
  }

  return processed;
}

async function analyzeContract(
  ctx: any,
  agentId: Id<"agents">,
  task: any
): Promise<any> {
  const contract = await ctx.db.get(task.contractId);
  if (!contract) {
    throw new Error("Contract not found");
  }

  const analysis = {
    financialSummary: {} as any,
    risks: [] as any[],
    opportunities: [] as any[],
    metrics: {} as any,
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
        mitigation: "Ensure proper approval chain and payment milestones",
      });
    }
  }

  // Analyze payment terms
  if (contract.extractedPaymentSchedule) {
    const paymentAnalysis = analyzePaymentTerms(contract.extractedPaymentSchedule);
    analysis.financialSummary.paymentStructure = paymentAnalysis;
    
    if (paymentAnalysis.hasUnfavorableTerms) {
      analysis.risks.push({
        type: "unfavorable_payment_terms",
        severity: "low",
        description: paymentAnalysis.concern,
        mitigation: "Consider negotiating payment terms",
      });
    }
  }

  // Compare with similar contracts
  const comparison = await compareWithSimilarContracts(ctx, contract);
  if (comparison.priceVariance > FINANCIAL_CONFIG.thresholds.priceVariancePercent) {
    analysis.opportunities.push({
      type: "pricing_negotiation",
      potential: comparison.potentialSavings,
      description: `Price is ${comparison.priceVariance}% higher than similar contracts`,
      action: "Review pricing and consider renegotiation",
    });
  }

  // Calculate key metrics
  analysis.metrics = {
    annualizedValue: calculateAnnualizedValue(contract),
    costPerUnit: calculateCostPerUnit(contract),
    paybackPeriod: calculatePaybackPeriod(contract),
    totalCostOfOwnership: calculateTCO(contract),
  };

  // Create insights based on analysis
  if (analysis.risks.length > 0) {
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "financial_risk",
      title: `Financial Risks Identified: ${contract.title}`,
      description: `${analysis.risks.length} financial risk(s) identified requiring attention`,
      priority: analysis.risks.some(r => r.severity === "high") ? "high" : "medium",
      contractId: contract._id,
      vendorId: contract.vendorId,
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: analysis,
    });
  }

  // Update contract with analysis results
  await ctx.db.patch(contract._id, {
    analysisStatus: "completed",
  });

  return analysis;
}

async function analyzeContractPortfolio(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  let insightsCreated = 0;

  // Get all active contracts
  const activeContracts = await ctx.db
    .query("contracts")
    .withIndex("by_status_and_enterpriseId")
    .filter((q: any) => q.eq(q.field("status"), "active"))
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
    const vendorId = contract.vendorId.toString();
    portfolioMetrics.contractsByVendor[vendorId] = (portfolioMetrics.contractsByVendor[vendorId] || 0) + 1;
    
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
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  let alertsCreated = 0;
  
  const contracts = await ctx.db
    .query("contracts")
    .withIndex("by_status_and_enterpriseId")
    .filter((q: any) => q.eq(q.field("status"), "active"))
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
          vendorId: contract.vendorId,
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
          notificationType: "payment_reminder",
          urgency: "high",
          payments: upcomingPayments,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return alertsCreated;
}

async function findCostOptimizations(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  let opportunitiesFound = 0;

  // Analyze contracts by vendor for bundling opportunities
  const contractsByVendor = await ctx.db
    .query("contracts")
    .withIndex("by_status_and_enterpriseId")
    .filter((q: any) => q.eq(q.field("status"), "active"))
    .collect();

  const vendorGroups: Record<string, any[]> = {};
  
  for (const contract of contractsByVendor) {
    const vendorId = contract.vendorId.toString();
    if (!vendorGroups[vendorId]) {
      vendorGroups[vendorId] = [];
    }
    vendorGroups[vendorId].push(contract);
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
  ctx: any,
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
          vendorId: contract.vendorId,
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
  ctx: any,
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
  const recentValues = recentMonths.map(m => monthlySpend[m]);
  const averageMonthlySpend = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
  
  // Simple linear projection for next 3 months
  const growthRate = calculateGrowthRate(recentValues);
  const projectedSpend = [];
  
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
    if (parts.length === 2 && parts[1].length <= 2) {
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

function analyzePaymentTerms(scheduleText: string): any {
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

async function compareWithSimilarContracts(ctx: any, contract: any): Promise<any> {
  // Get similar contracts
  const similarContracts = await ctx.db
    .query("contracts")
    .withIndex("by_contractType_and_enterpriseId")
    .filter((q: any) => 
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
    .map(c => parseContractValue(c.extractedPricing || "0"))
    .filter(v => v > 0);

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