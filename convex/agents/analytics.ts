// convex/agents/analytics.ts
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { ContractAnalytics, VendorAnalytics, MonthlyTrend, VendorMetric, ContractStatus, VendorCategory } from "../shared/types";

/**
 * Analytics Agent
 * 
 * Responsibilities:
 * - Generate comprehensive analytics reports
 * - Track KPIs and business metrics
 * - Identify trends and patterns in contract data
 * - Monitor vendor performance and relationships
 * - Calculate financial metrics and projections
 * - Detect anomalies and opportunities
 * - Generate executive dashboards
 * - Provide predictive analytics
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const ANALYTICS_CONFIG = {
  // Processing settings
  checkIntervalMinutes: 60, // Run hourly
  batchSize: 50,
  analysisTimeoutMinutes: 30,
  
  // Time periods for analysis
  timePeriods: {
    daily: 1,
    weekly: 7,
    monthly: 30,
    quarterly: 90,
    yearly: 365,
  },
  
  // KPI thresholds
  kpiThresholds: {
    contractRenewalRate: 0.80, // 80% target
    vendorSatisfaction: 0.85,
    costSavingsTarget: 0.10, // 10% annual savings
    complianceRate: 0.95,
    contractCycleTime: 14, // days
    approvalTime: 3, // days
  },
  
  // Analytics categories
  categories: {
    contract: ["volume", "value", "types", "status", "lifecycle"],
    vendor: ["performance", "spend", "risk", "concentration"],
    financial: ["spend", "savings", "roi", "budget", "forecast"],
    compliance: ["adherence", "violations", "audits", "certifications"],
    operational: ["efficiency", "bottlenecks", "automation", "workload"],
  },
  
  // Insight generation rules
  insightRules: {
    spendIncreaseThreshold: 0.20, // 20% increase triggers alert
    vendorConcentrationLimit: 0.30, // 30% of spend with one vendor
    contractExpiryWarningDays: 90,
    unusualActivityStdDev: 2.5,
    trendsMinDataPoints: 5,
  },
  
  // Report templates
  reportTemplates: {
    executive: ["overview", "kpis", "risks", "opportunities", "forecast"],
    operational: ["workload", "bottlenecks", "efficiency", "team_performance"],
    financial: ["spend_analysis", "savings", "budget_variance", "forecast"],
    vendor: ["performance", "risk", "spend_distribution", "compliance"],
    compliance: ["adherence", "violations", "upcoming_audits", "certifications"],
  },
};

// Extended metrics for analytics agent
interface AnalyticsAgentMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageRunTime: number;
  lastRunDuration?: number;
  dataProcessed?: number;
  insightsGenerated?: number;
  // Analytics-specific metrics
  reportsGenerated?: number;
  kpisCalculated?: number;
  trendsIdentified?: number;
  anomaliesDetected?: number;
  forecastsCreated?: number;
  dataPointsAnalyzed?: number;
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
        message: "Analytics agent starting run",
        timestamp: new Date().toISOString(),
        category: "agent_execution",
      });

      await ctx.db.patch(args.agentId, {
        status: "busy",
        lastRun: new Date().toISOString(),
      });

      // Calculate KPIs
      const kpisCalculated = await calculateKPIs(ctx, args.agentId);
      
      // Analyze contract metrics
      const contractInsights = await analyzeContractMetrics(ctx, args.agentId);
      
      // Analyze vendor performance
      const vendorInsights = await analyzeVendorPerformance(ctx, args.agentId);
      
      // Analyze financial trends
      const financialInsights = await analyzeFinancialTrends(ctx, args.agentId);
      
      // Detect anomalies
      const anomaliesDetected = await detectAnomalies(ctx, args.agentId);
      
      // Generate predictive analytics
      const forecastsCreated = await generatePredictiveAnalytics(ctx, args.agentId);
      
      // Create executive dashboard data
      await createExecutiveDashboard(ctx, args.agentId);
      
      // Generate automated reports
      const reportsGenerated = await generateAutomatedReports(ctx, args.agentId);

      // Update metrics
      await updateAgentMetrics(ctx, args.agentId, {
        runTime: Date.now() - startTime,
        kpisCalculated,
        contractInsights,
        vendorInsights,
        financialInsights,
        anomaliesDetected,
        forecastsCreated,
        reportsGenerated,
      });

      return { 
        success: true, 
        kpisCalculated,
        totalInsights: contractInsights + vendorInsights + financialInsights + anomaliesDetected,
        reportsGenerated,
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

interface KPIMetrics {
  contractRenewalRate: number;
  contractCycleTime: number;
  vendorConcentrationRisk: number;
  contractComplianceRate: number;
  identifiedSavings: number;
  savingsRate: number;
  totalActiveContractValue: number;
  contractsByType: Record<string, number>;
}

async function calculateKPIs(
  ctx: MutationCtx,
  agentId: Id<"agents">
): Promise<number> {
  const kpis: KPIMetrics = {
    contractRenewalRate: 0,
    contractCycleTime: 0,
    vendorConcentrationRisk: 0,
    contractComplianceRate: 0,
    identifiedSavings: 0,
    savingsRate: 0,
    totalActiveContractValue: 0,
    contractsByType: {},
  };
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  
  // Get all contracts for analysis
  const contracts = await ctx.db
    .query("contracts")
    .collect();
    
  const activeContracts = contracts.filter((c: Doc<"contracts">) => c.status === "active");
  const expiredLastYear = contracts.filter((c: Doc<"contracts">) => 
    c.status === "expired" && 
    c._creationTime && 
    c._creationTime > oneYearAgo.getTime()
  );

  // 1. Contract Renewal Rate
  const renewalEligible = expiredLastYear.length;
  const renewed = contracts.filter((c: Doc<"contracts">) => 
    c.notes?.includes("renewal") && 
    c._creationTime && 
    c._creationTime > oneYearAgo.getTime()
  ).length;
  kpis.contractRenewalRate = renewalEligible > 0 ? renewed / renewalEligible : 0;

  // 2. Contract Cycle Time (from creation to active)
  const recentActiveContracts = activeContracts.filter((c: Doc<"contracts">) => 
    c._creationTime && c._creationTime > oneYearAgo.getTime()
  );
  
  let totalCycleTime = 0;
  let cycleTimeCount = 0;
  
  // Calculate actual cycle times from status history
  for (const contract of recentActiveContracts) {
    if (contract.status === "active" || contract.status === "expired") {
      // Get status history for this contract
      const statusHistory = await ctx.db
        .query("contractStatusHistory")
        .withIndex("by_contract_time", (q) => q.eq("contractId", contract._id))
        .collect();
      
      // Find when contract moved from draft to active
      const activationEntry = statusHistory.find(entry => 
        entry.previousStatus === "draft" && entry.newStatus === "active"
      );
      
      if (activationEntry) {
        const createdTime = new Date(contract.createdAt).getTime();
        const activatedTime = new Date(activationEntry.changedAt).getTime();
        const cycleTimeDays = (activatedTime - createdTime) / (1000 * 60 * 60 * 24);
        
        totalCycleTime += cycleTimeDays;
        cycleTimeCount++;
      } else if (contract._creationTime && contract.status === "active") {
        // Fallback: if no history, estimate based on creation time
        const createdTime = contract._creationTime;
        const now = Date.now();
        const ageInDays = (now - createdTime) / (1000 * 60 * 60 * 24);
        
        // Assume contracts typically activate within 7 days if no history
        const estimatedCycleTime = Math.min(ageInDays, 7);
        totalCycleTime += estimatedCycleTime;
        cycleTimeCount++;
      }
    }
  }
  
  kpis.contractCycleTime = cycleTimeCount > 0 ? Math.round(totalCycleTime / cycleTimeCount * 10) / 10 : 0;

  // 3. Vendor Concentration
  const vendorSpend: Record<string, number> = {};
  let totalSpend = 0;
  
  for (const contract of activeContracts) {
    const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
    if (value > 0) {
      const vendorId = contract.vendorId ? contract.vendorId.toString() : 'unassigned';
      vendorSpend[vendorId] = (vendorSpend[vendorId] || 0) + value;
      totalSpend += value;
    }
  }
  
  const topVendorSpend = Math.max(...Object.values(vendorSpend), 0);
  kpis.vendorConcentrationRisk = totalSpend > 0 ? topVendorSpend / totalSpend : 0;

  // 4. Contract Compliance Rate
  const compliantContracts = activeContracts.filter((c: Doc<"contracts">) => 
    c.analysisStatus === "completed" && !c.analysisError
  ).length;
  kpis.contractComplianceRate = activeContracts.length > 0 
    ? compliantContracts / activeContracts.length 
    : 1;

  // 5. Cost Savings
  // Calculate based on renegotiated contracts or identified savings opportunities
  const savingsInsights = await ctx.db
    .query("agentInsights")
    .filter((q) => 
      q.and(
        q.eq(q.field("type"), "cost_optimization"),
        q.gte(q.field("createdAt"), oneYearAgo.toISOString())
      )
    )
    .collect();
  
  const totalSavings = savingsInsights.reduce((sum: number, insight: Doc<"agentInsights">) => 
    sum + (insight.data?.potentialSavings || 0), 0
  );
  kpis.identifiedSavings = totalSavings;
  kpis.savingsRate = totalSpend > 0 ? totalSavings / totalSpend : 0;

  // 6. Active Contract Value
  kpis.totalActiveContractValue = activeContracts.reduce((sum: number, c: Doc<"contracts">) => 
    sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
  );
  
  // 7. Contract Distribution
  kpis.contractsByType = activeContracts.reduce((acc: Record<string, number>, c: Doc<"contracts">) => {
    const type = c.contractType || "other";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Store KPIs
  await ctx.db.insert("agentInsights", {
    agentId,
    type: "report",
    title: "Key Performance Indicators Update",
    description: "Latest KPI calculations for contract management",
    priority: "low",
    actionRequired: false,
    actionTaken: false,
    isRead: false,
    createdAt: new Date().toISOString(),
    data: {
      kpis,
      calculatedAt: new Date().toISOString(),
      period: "last_365_days",
    },
  });

  // Check for KPI threshold violations
  let alertsCreated = 0;
  
  if (kpis.contractRenewalRate < ANALYTICS_CONFIG.kpiThresholds.contractRenewalRate) {
    alertsCreated++;
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "alert",
      title: "Low Contract Renewal Rate",
      description: `Contract renewal rate (${(kpis.contractRenewalRate * 100).toFixed(1)}%) is below target (${(ANALYTICS_CONFIG.kpiThresholds.contractRenewalRate * 100)}%)`,
      priority: "high",
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: {
        currentRate: kpis.contractRenewalRate,
        targetRate: ANALYTICS_CONFIG.kpiThresholds.contractRenewalRate,
        gap: ANALYTICS_CONFIG.kpiThresholds.contractRenewalRate - kpis.contractRenewalRate,
      },
    });
  }

  if (kpis.vendorConcentrationRisk > ANALYTICS_CONFIG.insightRules.vendorConcentrationLimit) {
    alertsCreated++;
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "vendor_risk",
      title: "High Vendor Concentration Risk",
      description: `${(kpis.vendorConcentrationRisk * 100).toFixed(1)}% of spend is concentrated with a single vendor`,
      priority: "high",
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: {
        concentrationRate: kpis.vendorConcentrationRisk,
        threshold: ANALYTICS_CONFIG.insightRules.vendorConcentrationLimit,
      },
    });
  }

  return Object.keys(kpis).length + alertsCreated;
}

async function analyzeContractMetrics(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  let insightsCreated = 0;
  
  // Get contracts grouped by time periods
  const contracts = await ctx.db
    .query("contracts")
    .collect();
  
  // Analyze contract volume trends
  const volumeTrends = analyzeVolumeTrends(contracts);
  
  if (volumeTrends.trend !== "stable") {
    insightsCreated++;
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "trend_analysis",
      title: `Contract Volume ${volumeTrends.trend === "increasing" ? "Increasing" : "Decreasing"}`,
      description: `Contract creation volume has ${volumeTrends.trend === "increasing" ? "increased" : "decreased"} by ${(volumeTrends.changeRate * 100).toFixed(1)}% over the last quarter`,
      priority: "medium",
      actionRequired: false,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: volumeTrends,
    });
  }

  // Analyze contract value distribution
  const valueDistribution = analyzeValueDistribution(contracts);
  
  if (valueDistribution.skewness > 2) {
    insightsCreated++;
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "anomaly_detection",
      title: "Uneven Contract Value Distribution",
      description: `Contract values are heavily skewed - ${valueDistribution.top20PercentValue}% of value comes from top 20% of contracts`,
      priority: "medium",
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: valueDistribution,
    });
  }

  // Analyze contract lifecycle
  const lifecycleMetrics = await analyzeContractLifecycle(ctx, contracts);
  
  if (lifecycleMetrics.averageTimeToExpiry < 90) {
    insightsCreated++;
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "alert",
      title: "Multiple Contracts Expiring Soon",
      description: `${lifecycleMetrics.expiringIn90Days} contracts are expiring within 90 days, representing ${formatCurrency(lifecycleMetrics.expiringValue)} in value`,
      priority: "high",
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: lifecycleMetrics,
    });
  }

  return insightsCreated;
}

async function analyzeVendorPerformance(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  let insightsCreated = 0;
  
  const vendors = await ctx.db
    .query("vendors")
    .collect();
    
  const contracts = await ctx.db
    .query("contracts")
    .collect();

  // Calculate vendor performance metrics
  const vendorMetrics = new Map<string, any>();
  
  for (const vendor of vendors) {
    const vendorContracts = contracts.filter((c: Doc<"contracts">) => c.vendorId === vendor._id);
    
    if (vendorContracts.length === 0) continue;
    
    const metrics = {
      vendorId: vendor._id,
      vendorName: vendor.name,
      contractCount: vendorContracts.length,
      activeContracts: vendorContracts.filter((c: Doc<"contracts">) => c.status === "active").length,
      totalValue: vendorContracts.reduce((sum: number, c: Doc<"contracts">) => 
        sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
      ),
      averageContractValue: 0,
      onTimeRenewalRate: 0, // Would need actual renewal tracking
      complianceScore: 0, // Would need compliance tracking
      riskScore: 0, // Would need risk assessment data
    };
    
    metrics.averageContractValue = metrics.contractCount > 0 
      ? metrics.totalValue / metrics.contractCount 
      : 0;
    
    // Simple risk scoring based on concentration
    if (metrics.totalValue > 1000000) {
      metrics.riskScore += 20;
    }
    if (metrics.activeContracts > 5) {
      metrics.riskScore += 10;
    }
    
    vendorMetrics.set(vendor._id.toString(), metrics);
  }

  // Identify top performers and risks
  const sortedByValue = Array.from(vendorMetrics.values())
    .sort((a, b) => b.totalValue - a.totalValue);
  
  const top5Vendors = sortedByValue.slice(0, 5);
  const totalValue = sortedByValue.reduce((sum, v) => sum + v.totalValue, 0);
  
  // Create vendor performance insight
  insightsCreated++;
  await ctx.db.insert("agentInsights", {
    agentId,
    type: "report",
    title: "Top Vendor Performance Analysis",
    description: `Analysis of top ${top5Vendors.length} vendors representing ${((top5Vendors.reduce((sum, v) => sum + v.totalValue, 0) / totalValue) * 100).toFixed(1)}% of total spend`,
    priority: "low",
    actionRequired: false,
    actionTaken: false,
    isRead: false,
    createdAt: new Date().toISOString(),
    data: {
      topVendors: top5Vendors,
      totalVendors: vendors.length,
      totalValue,
      metrics: Array.from(vendorMetrics.values()),
    },
  });

  // Check for vendor risks
  const highRiskVendors = Array.from(vendorMetrics.values())
    .filter(v => v.riskScore > 25);
  
  if (highRiskVendors.length > 0) {
    insightsCreated++;
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "vendor_risk",
      title: "High Risk Vendor Relationships Identified",
      description: `${highRiskVendors.length} vendor(s) have elevated risk scores due to high concentration or value`,
      priority: "high",
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: {
        highRiskVendors,
        totalAtRisk: highRiskVendors.reduce((sum, v) => sum + v.totalValue, 0),
      },
    });
  }

  return insightsCreated;
}

async function analyzeFinancialTrends(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  let insightsCreated = 0;
  
  const contracts = await ctx.db
    .query("contracts")
    .collect();
  
  // Group spending by month
  const monthlySpend = calculateMonthlySpend(contracts);
  const quarters = groupByQuarter(monthlySpend);
  
  // Calculate year-over-year growth
  const yoyGrowth = calculateYoYGrowth(monthlySpend);
  
  if (Math.abs(yoyGrowth) > ANALYTICS_CONFIG.insightRules.spendIncreaseThreshold) {
    insightsCreated++;
    const isIncrease = yoyGrowth > 0;
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "financial_risk",
      title: `Significant Spend ${isIncrease ? "Increase" : "Decrease"} Detected`,
      description: `Contract spending has ${isIncrease ? "increased" : "decreased"} by ${(Math.abs(yoyGrowth) * 100).toFixed(1)}% year-over-year`,
      priority: isIncrease ? "high" : "medium",
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: {
        yoyGrowth,
        monthlyTrend: monthlySpend,
        quarterlyTrend: quarters,
      },
    });
  }

  // Analyze spending patterns
  const spendingPatterns = analyzeSpendingPatterns(contracts);
  
  if (spendingPatterns.seasonality.isSeaonal) {
    insightsCreated++;
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "trend_analysis",
      title: "Seasonal Spending Pattern Detected",
      description: `Contract spending shows seasonal patterns with peak in ${spendingPatterns.seasonality.peakMonth}`,
      priority: "low",
      actionRequired: false,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: spendingPatterns,
    });
  }

  // Budget variance analysis
  const budgetVariance = await analyzeBudgetVariance(ctx, contracts);
  
  if (budgetVariance && Math.abs(budgetVariance.variancePercent) > 10) {
    insightsCreated++;
    const isOver = budgetVariance.variancePercent > 0;
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "financial_risk",
      title: `Budget ${isOver ? "Overrun" : "Underutilization"} Alert`,
      description: `Current spending is ${Math.abs(budgetVariance.variancePercent).toFixed(1)}% ${isOver ? "over" : "under"} budget`,
      priority: isOver ? "high" : "medium",
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: budgetVariance,
    });
  }

  return insightsCreated;
}

async function detectAnomalies(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  let anomaliesDetected = 0;
  
  const contracts = await ctx.db
    .query("contracts")
    .collect();
  
  // Detect pricing anomalies
  const pricingAnomalies = detectPricingAnomalies(contracts);
  
  for (const anomaly of pricingAnomalies) {
    anomaliesDetected++;
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "anomaly_detection",
      title: `Unusual Pricing Detected: ${anomaly.contractTitle}`,
      description: `Contract value (${formatCurrency(anomaly.value)}) is ${anomaly.standardDeviations.toFixed(1)} standard deviations from the mean for ${anomaly.contractType} contracts`,
      priority: "medium",
      contractId: anomaly.contractId,
      vendorId: anomaly.vendorId,
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: anomaly,
    });
  }

  // Detect unusual vendor activity
  const vendorActivityAnomalies = await detectVendorActivityAnomalies(ctx);
  
  for (const anomaly of vendorActivityAnomalies) {
    anomaliesDetected++;
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "anomaly_detection",
      title: "Unusual Vendor Activity Pattern",
      description: anomaly.description,
      priority: "medium",
      vendorId: anomaly.vendorId,
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: anomaly,
    });
  }

  // Detect contract term anomalies
  const termAnomalies = detectContractTermAnomalies(contracts);
  
  for (const anomaly of termAnomalies) {
    anomaliesDetected++;
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "anomaly_detection",
      title: "Unusual Contract Terms",
      description: anomaly.description,
      priority: "high",
      contractId: anomaly.contractId,
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: anomaly,
    });
  }

  return anomaliesDetected;
}

async function generatePredictiveAnalytics(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  let forecastsCreated = 0;
  
  const contracts = await ctx.db
    .query("contracts")
    .collect();
  
  // Forecast contract volume
  const volumeForecast = forecastContractVolume(contracts);
  
  forecastsCreated++;
  await ctx.db.insert("agentInsights", {
    agentId,
    type: "trend_analysis",
    title: "Contract Volume Forecast",
    description: `Projected ${volumeForecast.nextQuarter} new contracts in the next quarter based on historical trends`,
    priority: "low",
    actionRequired: false,
    actionTaken: false,
    isRead: false,
    createdAt: new Date().toISOString(),
    data: volumeForecast,
  });

  // Forecast spending
  const spendForecast = forecastSpending(contracts);
  
  forecastsCreated++;
  await ctx.db.insert("agentInsights", {
    agentId,
    type: "trend_analysis",
    title: "Spending Forecast",
    description: `Projected spending of ${formatCurrency(spendForecast.nextQuarterSpend)} in the next quarter (${spendForecast.confidence}% confidence)`,
    priority: "medium",
    actionRequired: false,
    actionTaken: false,
    isRead: false,
    createdAt: new Date().toISOString(),
    data: spendForecast,
  });

  // Predict renewal opportunities
  const renewalOpportunities = await predictRenewalOpportunities(ctx, contracts);
  
  if (renewalOpportunities.highValueRenewals.length > 0) {
    forecastsCreated++;
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "renewal_opportunity",
      title: "High-Value Renewal Opportunities",
      description: `${renewalOpportunities.highValueRenewals.length} high-value contracts worth ${formatCurrency(renewalOpportunities.totalValue)} are up for renewal`,
      priority: "high",
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: renewalOpportunities,
    });
  }

  // Predict risk events
  const riskPredictions = predictRiskEvents(contracts);
  
  if (riskPredictions.highRiskContracts.length > 0) {
    forecastsCreated++;
    await ctx.db.insert("agentInsights", {
      agentId,
      type: "financial_risk",
      title: "Predicted Contract Risks",
      description: `${riskPredictions.highRiskContracts.length} contracts show indicators of potential issues`,
      priority: "high",
      actionRequired: true,
      actionTaken: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      data: riskPredictions,
    });
  }

  return forecastsCreated;
}

async function createExecutiveDashboard(
  ctx: any,
  agentId: Id<"agents">
): Promise<void> {
  const contracts = await ctx.db
    .query("contracts")
    .collect();
    
  const vendors = await ctx.db
    .query("vendors")
    .collect();

  // Calculate active contract value and financial metrics
  const activeContracts = contracts.filter((c: any) => c.status === "active");
  const { activeContractValue, monthlyBurn, annualProjection } = calculateActiveContractFinancials(activeContracts);
  
  // Calculate upcoming renewals
  const upcomingRenewals = calculateUpcomingRenewals(contracts, 30);
  
  // Calculate contracts at risk
  const contractsAtRisk = await calculateContractsAtRisk(ctx, contracts);
  
  // Calculate savings opportunities
  const savingsOpportunities = calculateSavingsOpportunities(contracts, vendors);
  
  // Get latest KPIs
  const latestKPIs = await getLatestKPIs(ctx);
  
  // Calculate month-over-month trends
  const trends = calculateMonthOverMonthTrends(contracts, vendors);

  const dashboard = {
    overview: {
      totalContracts: contracts.length,
      activeContracts: activeContracts.length,
      totalVendors: vendors.length,
      activeVendors: vendors.filter((v: any) => 
        contracts.some((c: any) => c.vendorId === v._id && c.status === "active")
      ).length,
    },
    financial: {
      totalContractValue: contracts.reduce((sum: number, c: any) => 
        sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
      ),
      activeContractValue,
      monthlyBurn,
      annualProjection,
      savingsOpportunities: savingsOpportunities.totalPotentialSavings,
    },
    kpis: {
      contractRenewalRate: latestKPIs.contractRenewalRate,
      vendorSatisfaction: latestKPIs.vendorSatisfaction,
      complianceRate: latestKPIs.complianceRate,
      avgContractCycleTime: latestKPIs.avgContractCycleTime,
    },
    alerts: {
      expiringContracts: contracts.filter((c: any) => {
        if (!c.extractedEndDate) return false;
        const daysUntil = Math.ceil(
          (new Date(c.extractedEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return daysUntil <= 90 && daysUntil > 0;
      }).length,
      upcomingRenewals: upcomingRenewals.length,
      contractsAtRisk: contractsAtRisk.length,
      savingsOpportunities: savingsOpportunities.opportunities.length,
      pendingApprovals: await countPendingApprovals(ctx, contracts),
      complianceIssues: await countComplianceIssues(ctx, contracts),
      budgetAlerts: await countBudgetAlerts(ctx, contracts[0]?.enterpriseId)
    },
    trends: {
      contractVolumeChange: trends.contractVolumeChange,
      spendingChange: trends.spendingChange,
      vendorCountChange: trends.vendorCountChange,
    },
    insights: {
      topSpendCategories: savingsOpportunities.topSpendCategories,
      vendorConcentrationRisk: savingsOpportunities.vendorConcentrationRisk,
      upcomingRenewalsValue: upcomingRenewals.reduce((sum: number, c: any) => 
        sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
      ),
    },
    lastUpdated: new Date().toISOString(),
  };

  // Store dashboard data
  await ctx.db.insert("agentInsights", {
    agentId,
    type: "report",
    title: "Executive Dashboard Update",
    description: "Real-time executive dashboard metrics",
    priority: "low",
    actionRequired: false,
    actionTaken: false,
    isRead: false,
    createdAt: new Date().toISOString(),
    data: dashboard,
  });
}

async function generateAutomatedReports(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  let reportsGenerated = 0;
  const now = new Date();
  
  // Check if it's time for weekly report (Monday)
  if (now.getDay() === 1) {
    await generateWeeklyReport(ctx, agentId);
    reportsGenerated++;
  }
  
  // Check if it's time for monthly report (1st of month)
  if (now.getDate() === 1) {
    await generateMonthlyReport(ctx, agentId);
    reportsGenerated++;
  }
  
  // Check if it's time for quarterly report
  if (now.getDate() === 1 && [0, 3, 6, 9].includes(now.getMonth())) {
    await generateQuarterlyReport(ctx, agentId);
    reportsGenerated++;
  }
  
  return reportsGenerated;
}

// ============================================================================
// FINANCIAL CALCULATION FUNCTIONS
// ============================================================================

function calculateActiveContractFinancials(activeContracts: any[]): {
  activeContractValue: number;
  monthlyBurn: number;
  annualProjection: number;
} {
  let activeContractValue = 0;
  let monthlyBurn = 0;
  let annualProjection = 0;
  
  activeContracts.forEach(contract => {
    const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
    if (value > 0) {
      activeContractValue += value;
      
      // Calculate monthly burn based on contract duration
      if (contract.extractedStartDate && contract.extractedEndDate) {
        const startDate = new Date(contract.extractedStartDate);
        const endDate = new Date(contract.extractedEndDate);
        const durationMonths = Math.max(1, 
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
        );
        
        const monthlyValue = value / durationMonths;
        monthlyBurn += monthlyValue;
        
        // Only count contracts that will be active for next 12 months
        const now = new Date();
        const daysToExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysToExpiry > 0) {
          const monthsRemaining = Math.min(12, daysToExpiry / 30);
          annualProjection += monthlyValue * monthsRemaining;
        }
      } else {
        // If no dates, assume annual contract
        monthlyBurn += value / 12;
        annualProjection += value;
      }
    }
  });
  
  return {
    activeContractValue,
    monthlyBurn,
    annualProjection
  };
}

function calculateUpcomingRenewals(contracts: any[], daysAhead: number): any[] {
  const now = new Date();
  const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
  
  return contracts.filter(contract => {
    if (contract.status !== 'active' || !contract.extractedEndDate) return false;
    
    const endDate = new Date(contract.extractedEndDate);
    return endDate >= now && endDate <= futureDate;
  }).sort((a, b) => {
    const dateA = new Date(a.extractedEndDate).getTime();
    const dateB = new Date(b.extractedEndDate).getTime();
    return dateA - dateB;
  });
}

async function calculateContractsAtRisk(ctx: any, contracts: any[]): Promise<any[]> {
  const riskFactors: any[] = [];
  
  for (const contract of contracts) {
    if (contract.status !== 'active') continue;
    
    let riskScore = 0;
    const risks: string[] = [];
    
    // Check if contract is expiring soon without renewal
    if (contract.extractedEndDate) {
      const daysToExpiry = Math.ceil(
        (new Date(contract.extractedEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysToExpiry > 0 && daysToExpiry <= 30) {
        riskScore += 3;
        risks.push('Expiring within 30 days');
      }
    }
    
    // Check if vendor has issues
    if (contract.vendorId) {
      const vendor = await ctx.db.get(contract.vendorId);
      if (vendor && vendor.status === 'inactive') {
        riskScore += 2;
        risks.push('Vendor marked as inactive');
      }
    }
    
    // Check if contract has no end date
    if (!contract.extractedEndDate) {
      riskScore += 1;
      risks.push('No end date specified');
    }
    
    // Check if contract value is unusually high
    const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
    if (value > 1000000) {
      riskScore += 2;
      risks.push('High value contract');
    }
    
    if (riskScore >= 3) {
      riskFactors.push({
        contractId: contract._id,
        title: contract.title,
        vendorId: contract.vendorId,
        value,
        riskScore,
        risks,
        extractedEndDate: contract.extractedEndDate
      });
    }
  }
  
  return riskFactors.sort((a, b) => b.riskScore - a.riskScore);
}

function calculateSavingsOpportunities(contracts: any[], vendors: any[]): {
  opportunities: any[];
  totalPotentialSavings: number;
  topSpendCategories: any[];
  vendorConcentrationRisk: any;
} {
  const opportunities: any[] = [];
  let totalPotentialSavings = 0;
  
  // Analyze vendor spend concentration
  const vendorSpend: Record<string, { vendor: any; totalSpend: number; contractCount: number }> = {};
  const categorySpend: Record<string, number> = {};
  
  contracts.forEach(contract => {
    if (contract.status !== 'active' || !contract.vendorId) return;
    
    const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
    if (value <= 0) return;
    
    // Track vendor spend
    if (!vendorSpend[contract.vendorId]) {
      const vendor = vendors.find(v => v._id === contract.vendorId);
      vendorSpend[contract.vendorId] = {
        vendor: vendor || { name: 'Unknown Vendor' },
        totalSpend: 0,
        contractCount: 0
      };
    }
    vendorSpend[contract.vendorId].totalSpend += value;
    vendorSpend[contract.vendorId].contractCount++;
    
    // Track category spend
    const vendor = vendors.find(v => v._id === contract.vendorId);
    if (vendor && vendor.category) {
      categorySpend[vendor.category] = (categorySpend[vendor.category] || 0) + value;
    }
  });
  
  // Find consolidation opportunities
  const vendorsByCategory: Record<string, any[]> = {};
  Object.entries(vendorSpend).forEach(([vendorId, data]) => {
    if (data.vendor.category) {
      if (!vendorsByCategory[data.vendor.category]) {
        vendorsByCategory[data.vendor.category] = [];
      }
      vendorsByCategory[data.vendor.category].push({
        vendorId,
        ...data
      });
    }
  });
  
  // Identify consolidation opportunities
  Object.entries(vendorsByCategory).forEach(([category, vendorsInCategory]) => {
    if (vendorsInCategory.length > 3) {
      const totalCategorySpend = vendorsInCategory.reduce((sum, v) => sum + v.totalSpend, 0);
      const potentialSaving = totalCategorySpend * 0.15; // Assume 15% savings from consolidation
      
      opportunities.push({
        type: 'vendor_consolidation',
        category,
        vendorCount: vendorsInCategory.length,
        totalSpend: totalCategorySpend,
        potentialSaving,
        description: `Consolidate ${vendorsInCategory.length} vendors in ${category}`
      });
      
      totalPotentialSavings += potentialSaving;
    }
  });
  
  // Identify duplicate services
  const similarVendors = vendors.filter(v => v.status === 'active');
  const vendorNameGroups: Record<string, any[]> = {};
  
  similarVendors.forEach(vendor => {
    const normalizedName = vendor.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const baseKey = normalizedName.substring(0, 5);
    if (!vendorNameGroups[baseKey]) {
      vendorNameGroups[baseKey] = [];
    }
    vendorNameGroups[baseKey].push(vendor);
  });
  
  Object.entries(vendorNameGroups).forEach(([key, group]) => {
    if (group.length > 1) {
      const groupSpend = group.reduce((sum, vendor) => {
        const spend = vendorSpend[vendor._id]?.totalSpend || 0;
        return sum + spend;
      }, 0);
      
      if (groupSpend > 50000) {
        const potentialSaving = groupSpend * 0.10;
        opportunities.push({
          type: 'duplicate_vendors',
          vendors: group.map(v => v.name),
          totalSpend: groupSpend,
          potentialSaving,
          description: `Potential duplicate vendors: ${group.map(v => v.name).join(', ')}`
        });
        
        totalPotentialSavings += potentialSaving;
      }
    }
  });
  
  // Calculate top spend categories
  const topSpendCategories = Object.entries(categorySpend)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, spend]) => ({ category, spend }));
  
  // Calculate vendor concentration risk
  const totalSpend = Object.values(vendorSpend).reduce((sum, v) => sum + v.totalSpend, 0);
  const topVendors = Object.entries(vendorSpend)
    .sort(([, a], [, b]) => b.totalSpend - a.totalSpend)
    .slice(0, 5);
  
  const top5Spend = topVendors.reduce((sum, [, v]) => sum + v.totalSpend, 0);
  const concentrationRatio = totalSpend > 0 ? (top5Spend / totalSpend) * 100 : 0;
  
  return {
    opportunities: opportunities.sort((a, b) => b.potentialSaving - a.potentialSaving),
    totalPotentialSavings,
    topSpendCategories,
    vendorConcentrationRisk: {
      ratio: concentrationRatio,
      isHighRisk: concentrationRatio > 60,
      topVendors: topVendors.map(([vendorId, data]) => ({
        name: data.vendor.name,
        spend: data.totalSpend,
        percentage: totalSpend > 0 ? (data.totalSpend / totalSpend) * 100 : 0
      }))
    }
  };
}

async function getLatestKPIs(ctx: any): Promise<{
  contractRenewalRate: number;
  vendorSatisfaction: number;
  complianceRate: number;
  avgContractCycleTime: number;
}> {
  // Get the most recent KPI calculation
  const latestKPI = await ctx.db
    .query("agentInsights")
    .filter((q: any) => q.eq(q.field("type"), "kpi_report"))
    .order("desc")
    .first();
  
  if (latestKPI && latestKPI.data) {
    return {
      contractRenewalRate: latestKPI.data.contractRenewalRate || 0,
      vendorSatisfaction: latestKPI.data.vendorSatisfaction || 0,
      complianceRate: latestKPI.data.complianceRate || 0,
      avgContractCycleTime: latestKPI.data.avgContractCycleTime || 0,
    };
  }
  
  // Return defaults if no KPIs found
  return {
    contractRenewalRate: 0,
    vendorSatisfaction: 0,
    complianceRate: 0,
    avgContractCycleTime: 0,
  };
}

function calculateMonthOverMonthTrends(contracts: any[], vendors: any[]): {
  contractVolumeChange: number;
  spendingChange: number;
  vendorCountChange: number;
} {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Calculate last month's date
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  
  // Contract volume change
  const currentMonthContracts = contracts.filter(c => {
    const createdDate = new Date(c.createdAt);
    return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
  }).length;
  
  const lastMonthContracts = contracts.filter(c => {
    const createdDate = new Date(c.createdAt);
    return createdDate.getMonth() === lastMonth && createdDate.getFullYear() === lastMonthYear;
  }).length;
  
  const contractVolumeChange = lastMonthContracts > 0 
    ? ((currentMonthContracts - lastMonthContracts) / lastMonthContracts) * 100 
    : 0;
  
  // Spending change
  const currentMonthSpend = contracts
    .filter(c => {
      const createdDate = new Date(c.createdAt);
      return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
    })
    .reduce((sum, c) => sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0);
  
  const lastMonthSpend = contracts
    .filter(c => {
      const createdDate = new Date(c.createdAt);
      return createdDate.getMonth() === lastMonth && createdDate.getFullYear() === lastMonthYear;
    })
    .reduce((sum, c) => sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0);
  
  const spendingChange = lastMonthSpend > 0 
    ? ((currentMonthSpend - lastMonthSpend) / lastMonthSpend) * 100 
    : 0;
  
  // Vendor count change
  const currentMonthVendors = vendors.filter(v => {
    const createdDate = new Date(v.createdAt);
    return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
  }).length;
  
  const lastMonthVendors = vendors.filter(v => {
    const createdDate = new Date(v.createdAt);
    return createdDate.getMonth() === lastMonth && createdDate.getFullYear() === lastMonthYear;
  }).length;
  
  const vendorCountChange = lastMonthVendors > 0 
    ? ((currentMonthVendors - lastMonthVendors) / lastMonthVendors) * 100 
    : 0;
  
  return {
    contractVolumeChange,
    spendingChange,
    vendorCountChange
  };
}

// ============================================================================
// ANALYTICS HELPER FUNCTIONS
// ============================================================================

function analyzeVolumeTrends(contracts: any[]): any {
  const monthlyVolume: Record<string, number> = {};
  
  contracts.forEach(contract => {
    if (contract._creationTime) {
      const date = new Date(contract._creationTime);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      monthlyVolume[monthKey] = (monthlyVolume[monthKey] || 0) + 1;
    }
  });
  
  const months = Object.keys(monthlyVolume).sort();
  if (months.length < 3) {
    return { trend: "insufficient_data", changeRate: 0 };
  }
  
  // Calculate trend over last 3 months
  const recentMonths = months.slice(-3);
  const recentVolumes = recentMonths.map(m => monthlyVolume[m]);
  
  const avgFirst = recentVolumes[0] || 0;
  const avgLast = recentVolumes[recentVolumes.length - 1] || 0;
  const changeRate = avgFirst > 0 ? (avgLast - avgFirst) / avgFirst : 0;
  
  return {
    trend: changeRate > 0.1 ? "increasing" : changeRate < -0.1 ? "decreasing" : "stable",
    changeRate,
    monthlyVolume,
    recentTrend: recentVolumes,
  };
}

function analyzeValueDistribution(contracts: any[]): any {
  const values = contracts
    .map(c => parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'))
    .filter(v => v > 0)
    .sort((a, b) => b - a);
  
  if (values.length === 0) {
    return { skewness: 0, top20PercentValue: 0 };
  }
  
  const totalValue = values.reduce((sum, v) => sum + v, 0);
  const top20Count = Math.ceil(values.length * 0.2);
  const top20Value = values.slice(0, top20Count).reduce((sum, v) => sum + v, 0);
  
  // Calculate statistical measures
  const mean = totalValue / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // Simple skewness calculation
  const skewness = values.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 3), 0) / values.length;
  
  return {
    totalValue,
    meanValue: mean,
    medianValue: values[Math.floor(values.length / 2)],
    stdDev,
    skewness,
    top20PercentValue: (top20Value / totalValue * 100).toFixed(1),
    distribution: {
      under10k: values.filter(v => v < 10000).length,
      "10k-50k": values.filter(v => v >= 10000 && v < 50000).length,
      "50k-100k": values.filter(v => v >= 50000 && v < 100000).length,
      "100k-500k": values.filter(v => v >= 100000 && v < 500000).length,
      over500k: values.filter(v => v >= 500000).length,
    },
  };
}

async function analyzeContractLifecycle(ctx: any, contracts: any[]): Promise<any> {
  const activeContracts = contracts.filter(c => c.status === "active");
  const now = new Date();
  
  let totalDaysToExpiry = 0;
  let expiringIn90Days = 0;
  let expiringValue = 0;
  let contractsWithEndDate = 0;
  
  for (const contract of activeContracts) {
    if (contract.extractedEndDate) {
      contractsWithEndDate++;
      const endDate = new Date(contract.extractedEndDate);
      const daysToExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysToExpiry > 0) {
        totalDaysToExpiry += daysToExpiry;
        
        if (daysToExpiry <= 90) {
          expiringIn90Days++;
          expiringValue += parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
        }
      }
    }
  }
  
  return {
    averageTimeToExpiry: contractsWithEndDate > 0 ? totalDaysToExpiry / contractsWithEndDate : 0,
    expiringIn90Days,
    expiringValue,
    contractsWithoutEndDate: activeContracts.length - contractsWithEndDate,
    expiryDistribution: {
      expired: contracts.filter(c => c.status === "expired").length,
      within30Days: activeContracts.filter(c => {
        if (!c.extractedEndDate) return false;
        const days = Math.ceil((new Date(c.extractedEndDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return days > 0 && days <= 30;
      }).length,
      within90Days: expiringIn90Days,
      beyond90Days: activeContracts.filter(c => {
        if (!c.extractedEndDate) return false;
        const days = Math.ceil((new Date(c.extractedEndDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return days > 90;
      }).length,
    },
  };
}

function calculateMonthlySpend(contracts: any[]): Record<string, number> {
  const monthlySpend: Record<string, number> = {};
  
  contracts.forEach(contract => {
    if (contract._creationTime && contract.status === "active") {
      const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
      if (value > 0) {
        const date = new Date(contract._creationTime);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        monthlySpend[monthKey] = (monthlySpend[monthKey] || 0) + value;
      }
    }
  });
  
  return monthlySpend;
}

function groupByQuarter(monthlyData: Record<string, number>): Record<string, number> {
  const quarters: Record<string, number> = {};
  
  Object.entries(monthlyData).forEach(([month, value]) => {
    const [year, monthNum] = month.split('-');
    const quarter = Math.ceil(parseInt(monthNum || '1') / 3);
    const quarterKey = `${year}-Q${quarter}`;
    quarters[quarterKey] = (quarters[quarterKey] || 0) + value;
  });
  
  return quarters;
}

function calculateYoYGrowth(monthlySpend: Record<string, number>): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  const lastYear = currentYear - 1;
  
  let currentYearTotal = 0;
  let lastYearTotal = 0;
  
  Object.entries(monthlySpend).forEach(([month, value]) => {
    const year = parseInt(month.split('-')[0] || '0');
    if (year === currentYear) {
      currentYearTotal += value || 0;
    } else if (year === lastYear) {
      lastYearTotal += value || 0;
    }
  });
  
  if (lastYearTotal === 0) return 0;
  
  return (currentYearTotal - lastYearTotal) / lastYearTotal;
}

function analyzeSpendingPatterns(contracts: any[]): any {
  const monthlySpend = calculateMonthlySpend(contracts);
  const monthlyValues = Object.values(monthlySpend);
  
  if (monthlyValues.length < 12) {
    return { seasonality: { isSeasonal: false }, patterns: [] };
  }
  
  // Simple seasonality detection
  const monthlyAverages: number[] = new Array(12).fill(0);
  const monthlyCounts: number[] = new Array(12).fill(0);
  
  Object.entries(monthlySpend).forEach(([month, value]) => {
    const monthNum = Math.max(0, Math.min(11, parseInt(month.split('-')[1] || '1') - 1));
    if (monthlyAverages[monthNum] !== undefined && monthlyCounts[monthNum] !== undefined) {
      monthlyAverages[monthNum] += value || 0;
      monthlyCounts[monthNum]++;
    }
  });
  
  for (let i = 0; i < 12; i++) {
    if ((monthlyCounts[i] || 0) > 0 && (monthlyAverages[i] || 0) > 0) {
      monthlyAverages[i] = (monthlyAverages[i] || 0) / (monthlyCounts[i] || 1);
    }
  }
  
  const avgSpend = monthlyAverages.reduce((sum, v) => sum + v, 0) / 12;
  const maxMonth = monthlyAverages.indexOf(Math.max(...monthlyAverages));
  const maxVariance = Math.max(...monthlyAverages) / avgSpend;
  
  return {
    seasonality: {
      isSeasonal: maxVariance > 1.3,
      peakMonth: new Date(2024, maxMonth).toLocaleString('default', { month: 'long' }),
      variance: maxVariance,
    },
    monthlyAverages,
    trend: monthlyValues && monthlyValues.length > 1 && 
           (monthlyValues[monthlyValues.length - 1] || 0) > (monthlyValues[0] || 0)
      ? "increasing" : "decreasing",
  };
}

async function analyzeBudgetVariance(ctx: any, contracts: any[]): Promise<any> {
  // This would typically fetch budget data from a budgets table
  // For now, we'll use a placeholder
  const annualBudget = 1000000; // Example budget
  
  const currentYearSpend = contracts
    .filter(c => {
      if (!c._creationTime) return false;
      const year = new Date(c._creationTime).getFullYear();
      return year === new Date().getFullYear() && c.status === "active";
    })
    .reduce((sum, c) => sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0);
  
  const monthsElapsed = new Date().getMonth() + 1;
  const expectedSpend = (annualBudget / 12) * monthsElapsed;
  const variance = currentYearSpend - expectedSpend;
  const variancePercent = expectedSpend > 0 ? (variance / expectedSpend) * 100 : 0;
  
  return {
    budget: annualBudget,
    actualSpend: currentYearSpend,
    expectedSpend,
    variance,
    variancePercent,
    projectedAnnualSpend: (currentYearSpend / monthsElapsed) * 12,
  };
}

function detectPricingAnomalies(contracts: any[]): any[] {
  const anomalies: any[] = [];
  
  // Group contracts by type for comparison
  const contractsByType: Record<string, any[]> = {};
  
  contracts.forEach(contract => {
    const type = contract.contractType || "other";
    if (!contractsByType[type]) {
      contractsByType[type] = [];
    }
    contractsByType[type].push(contract);
  });
  
  // Detect anomalies within each type
  Object.entries(contractsByType).forEach(([type, typeContracts]) => {
    if (typeContracts.length < 5) return; // Need enough data
    
    const values = typeContracts
      .map(c => parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'))
      .filter(v => v > 0);
    
    if (values.length < 5) return;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    typeContracts.forEach(contract => {
      const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
      if (value > 0) {
        const zScore = Math.abs((value - mean) / stdDev);
        
        if (zScore > ANALYTICS_CONFIG.insightRules.unusualActivityStdDev) {
          anomalies.push({
            contractId: contract._id,
            contractTitle: contract.title,
            contractType: type,
            vendorId: contract.vendorId,
            value,
            mean,
            stdDev,
            standardDeviations: zScore,
            percentageDifference: ((value - mean) / mean * 100).toFixed(1),
          });
        }
      }
    });
  });
  
  return anomalies;
}

async function detectVendorActivityAnomalies(ctx: any): Promise<any[]> {
  const anomalies: any[] = [];
  
  // Get recent vendor activity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const recentContracts = await ctx.db
    .query("contracts")
    .filter((q: any) => q.gte(q.field("_creationTime"), thirtyDaysAgo.getTime()))
    .collect();
  
  // Count contracts per vendor
  const vendorActivity: Record<string, number> = {};
  recentContracts.forEach((contract: any) => {
    const vendorId = contract.vendorId.toString();
    vendorActivity[vendorId] = (vendorActivity[vendorId] || 0) + 1;
  });
  
  // Detect unusual activity
  const activityCounts = Object.values(vendorActivity);
  if (activityCounts.length > 0) {
    const mean = activityCounts.reduce((sum, v) => sum + v, 0) / activityCounts.length;
    
    Object.entries(vendorActivity).forEach(([vendorId, count]) => {
      if (count > mean * 3) {
        anomalies.push({
          vendorId,
          activityCount: count,
          averageActivity: mean,
          description: `Vendor has ${count} new contracts in 30 days (average is ${mean.toFixed(1)})`,
        });
      }
    });
  }
  
  return anomalies;
}

function detectContractTermAnomalies(contracts: any[]): any[] {
  const anomalies: any[] = [];
  
  contracts.forEach(contract => {
    // Check for unusual contract duration
    if (contract.extractedStartDate && contract.extractedEndDate) {
      const startDate = new Date(contract.extractedStartDate);
      const endDate = new Date(contract.extractedEndDate);
      const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (durationDays > 1825) { // More than 5 years
        anomalies.push({
          contractId: contract._id,
          type: "long_duration",
          description: `Unusually long contract duration: ${Math.round(durationDays / 365)} years`,
          durationDays,
        });
      } else if (durationDays < 30) { // Less than 30 days
        anomalies.push({
          contractId: contract._id,
          type: "short_duration",
          description: `Unusually short contract duration: ${durationDays} days`,
          durationDays,
        });
      }
    }
    
    // Check for missing critical dates
    if (contract.status === "active" && !contract.extractedEndDate) {
      anomalies.push({
        contractId: contract._id,
        type: "missing_end_date",
        description: "Active contract without specified end date",
      });
    }
  });
  
  return anomalies;
}

function forecastContractVolume(contracts: any[]): any {
  const monthlyVolume = analyzeVolumeTrends(contracts).monthlyVolume;
  const months = Object.keys(monthlyVolume).sort();
  
  if (months.length < 6) {
    return { nextQuarter: 0, confidence: 0 };
  }
  
  // Simple moving average forecast
  const recentMonths = months.slice(-6);
  const recentVolumes = recentMonths.map(m => monthlyVolume[m]);
  const avgMonthlyVolume = recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;
  
  // Calculate trend
  const firstHalf = recentVolumes.slice(0, 3).reduce((sum, v) => sum + v, 0) / 3;
  const secondHalf = recentVolumes.slice(3).reduce((sum, v) => sum + v, 0) / 3;
  const trend = (secondHalf - firstHalf) / firstHalf;
  
  const nextQuarterVolume = Math.round(avgMonthlyVolume * 3 * (1 + trend));
  
  return {
    nextQuarter: nextQuarterVolume,
    confidence: 70, // Simple forecast, moderate confidence
    basis: "6-month moving average with trend adjustment",
    historicalAverage: avgMonthlyVolume,
    trend: (trend * 100).toFixed(1) + "%",
  };
}

function forecastSpending(contracts: any[]): any {
  const monthlySpend = calculateMonthlySpend(contracts);
  const months = Object.keys(monthlySpend).sort();
  
  if (months.length < 6) {
    return { nextQuarterSpend: 0, confidence: 0 };
  }
  
  // Calculate average monthly spend
  const recentMonths = months.slice(-6);
  const recentSpend = recentMonths.map(m => monthlySpend[m] || 0);
  const avgMonthlySpend = recentSpend.reduce((sum, v) => sum + (v || 0), 0) / recentSpend.length;
  
  // Add seasonality adjustment
  const currentMonth = new Date().getMonth();
  const seasonalFactor = 1; // Would calculate based on historical patterns
  
  const nextQuarterSpend = avgMonthlySpend * 3 * seasonalFactor;
  
  return {
    nextQuarterSpend,
    confidence: 75,
    monthlyAverage: avgMonthlySpend,
    seasonalAdjustment: seasonalFactor,
    basis: "6-month average with seasonal adjustment",
  };
}

async function predictRenewalOpportunities(ctx: any, contracts: any[]): Promise<any> {
  const next180Days = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
  
  const expiringContracts = contracts.filter(c => {
    if (c.status !== "active" || !c.extractedEndDate) return false;
    const endDate = new Date(c.extractedEndDate);
    return endDate <= next180Days && endDate > new Date();
  });
  
  const renewalOpportunities = expiringContracts.map(contract => ({
    contractId: contract._id,
    title: contract.title,
    vendorId: contract.vendorId,
    value: parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'),
    expiryDate: contract.extractedEndDate,
    daysUntilExpiry: Math.ceil(
      (new Date(contract.extractedEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ),
    renewalProbability: 0.75, // Would calculate based on historical data
  }));
  
  const highValueThreshold = 50000;
  const highValueRenewals = renewalOpportunities.filter(r => r.value >= highValueThreshold);
  
  return {
    totalOpportunities: renewalOpportunities.length,
    highValueRenewals,
    totalValue: renewalOpportunities.reduce((sum, r) => sum + r.value, 0),
    expectedRenewalValue: renewalOpportunities.reduce((sum, r) => sum + (r.value * r.renewalProbability), 0),
    timeline: {
      within30Days: renewalOpportunities.filter(r => r.daysUntilExpiry <= 30).length,
      within90Days: renewalOpportunities.filter(r => r.daysUntilExpiry <= 90).length,
      within180Days: renewalOpportunities.length,
    },
  };
}

function predictRiskEvents(contracts: any[]): any {
  const riskIndicators: any[] = [];
  
  contracts.forEach(contract => {
    let riskScore = 0;
    const risks: string[] = [];
    
    // High value without end date
    if (contract.status === "active" && !contract.extractedEndDate) {
      const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
      if (value > 100000) {
        riskScore += 30;
        risks.push("High value contract without end date");
      }
    }
    
    // Expiring soon without renewal plan
    if (contract.extractedEndDate) {
      const daysUntilExpiry = Math.ceil(
        (new Date(contract.extractedEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
        riskScore += 20;
        risks.push("Expiring soon without renewal plan");
      }
    }
    
    // Missing critical information
    if (!contract.extractedPaymentSchedule) {
      riskScore += 10;
      risks.push("Missing payment schedule");
    }
    
    if (riskScore >= 30) {
      riskIndicators.push({
        contractId: contract._id,
        title: contract.title,
        riskScore,
        risks,
        recommendedActions: generateRiskMitigationActions(risks),
      });
    }
  });
  
  return {
    totalRisks: riskIndicators.length,
    highRiskContracts: riskIndicators.filter(r => r.riskScore >= 40),
    mediumRiskContracts: riskIndicators.filter(r => r.riskScore >= 20 && r.riskScore < 40),
    riskDistribution: {
      missingInfo: riskIndicators.filter(r => r.risks.some((risk: string) => risk.includes("Missing"))).length,
      expirationRisk: riskIndicators.filter(r => r.risks.some((risk: string) => risk.includes("Expiring"))).length,
      valueRisk: riskIndicators.filter(r => r.risks.some((risk: string) => risk.includes("High value"))).length,
    },
  };
}

function generateRiskMitigationActions(risks: string[]): string[] {
  const actions: string[] = [];
  
  risks.forEach(risk => {
    if (risk.includes("end date")) {
      actions.push("Define contract end date and renewal terms");
    }
    if (risk.includes("Expiring")) {
      actions.push("Initiate renewal discussions with vendor");
      actions.push("Prepare contract renewal or replacement");
    }
    if (risk.includes("payment")) {
      actions.push("Document payment terms and schedule");
    }
  });
  
  return Array.from(new Set(actions));
}

// ============================================================================
// REPORT GENERATION FUNCTIONS
// ============================================================================

async function generateWeeklyReport(ctx: any, agentId: Id<"agents">): Promise<void> {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  // Gather weekly metrics
  const weeklyMetrics = await gatherWeeklyMetrics(ctx, oneWeekAgo);
  
  await ctx.db.insert("agentInsights", {
    agentId,
    type: "report",
    title: "Weekly Analytics Report",
    description: `Weekly summary: ${weeklyMetrics.newContracts} new contracts, ${formatCurrency(weeklyMetrics.totalValue)} in value`,
    priority: "low",
    actionRequired: false,
    actionTaken: false,
    isRead: false,
    createdAt: new Date().toISOString(),
    data: weeklyMetrics,
  });
}

async function generateMonthlyReport(ctx: any, agentId: Id<"agents">): Promise<void> {
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const monthlyMetrics = await gatherMonthlyMetrics(ctx, oneMonthAgo);
  
  await ctx.db.insert("agentInsights", {
    agentId,
    type: "report",
    title: "Monthly Analytics Report",
    description: `Monthly performance summary with ${monthlyMetrics.highlights.length} key highlights`,
    priority: "medium",
    actionRequired: monthlyMetrics.actionItems.length > 0,
    actionTaken: false,
    isRead: false,
    createdAt: new Date().toISOString(),
    data: monthlyMetrics,
  });
}

async function generateQuarterlyReport(ctx: any, agentId: Id<"agents">): Promise<void> {
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  
  const quarterlyMetrics = await gatherQuarterlyMetrics(ctx, threeMonthsAgo);
  
  await ctx.db.insert("agentInsights", {
    agentId,
    type: "report",
    title: "Quarterly Business Review",
    description: "Comprehensive quarterly analysis with strategic recommendations",
    priority: "high",
    actionRequired: true,
    actionTaken: false,
    isRead: false,
    createdAt: new Date().toISOString(),
    data: quarterlyMetrics,
  });
}

async function gatherWeeklyMetrics(ctx: any, since: Date): Promise<any> {
  const contracts = await ctx.db
    .query("contracts")
    .filter((q: any) => q.gte(q.field("_creationTime"), since.getTime()))
    .collect();
  
  return {
    period: "weekly",
    startDate: since.toISOString(),
    endDate: new Date().toISOString(),
    newContracts: contracts.length,
    totalValue: contracts.reduce((sum: number, c: any) => 
      sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
    ),
    byStatus: contracts.reduce((acc: Record<string, number>, c: any) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    topVendors: [], // Would calculate
    expiringNext7Days: 0, // Would calculate
  };
}

async function gatherMonthlyMetrics(ctx: any, since: Date): Promise<any> {
  const now = new Date();
  
  // Get all relevant data
  const [contracts, vendors, insights, tasks] = await Promise.all([
    ctx.db.query("contracts").collect(),
    ctx.db.query("vendors").collect(),
    ctx.db.query("agentInsights")
      .filter((q: any) => q.gte(q.field("createdAt"), since.toISOString()))
      .collect(),
    ctx.db.query("agentTasks")
      .filter((q: any) => q.gte(q.field("createdAt"), since.toISOString()))
      .collect(),
  ]);

  // Filter contracts by period
  const periodContracts = contracts.filter((c: any) => 
    c._creationTime && c._creationTime >= since.getTime()
  );
  const previousPeriodStart = new Date(since.getTime() - 30 * 24 * 60 * 60 * 1000);
  const previousPeriodContracts = contracts.filter((c: any) => 
    c._creationTime && 
    c._creationTime >= previousPeriodStart.getTime() && 
    c._creationTime < since.getTime()
  );

  // Calculate comprehensive metrics
  const activeContracts = contracts.filter((c: any) => c.status === "active");
  const expiredThisPeriod = periodContracts.filter((c: any) => c.status === "expired");
  const newActiveContracts = periodContracts.filter((c: any) => c.status === "active");

  // Financial metrics
  const totalValue = activeContracts.reduce((sum: number, c: any) => 
    sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
  );
  const periodValue = periodContracts.reduce((sum: number, c: any) => 
    sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
  );
  const previousPeriodValue = previousPeriodContracts.reduce((sum: number, c: any) => 
    sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
  );
  const valueGrowth = previousPeriodValue > 0 
    ? ((periodValue - previousPeriodValue) / previousPeriodValue) * 100 
    : 0;

  // Vendor metrics
  const activeVendors = new Set(activeContracts.map((c: any) => c.vendorId.toString())).size;
  const newVendors = vendors.filter((v: any) => 
    v._creationTime && v._creationTime >= since.getTime()
  ).length;

  // Contract cycle time from actual status history
  let totalCycleTime = 0;
  let cycleTimeCount = 0;
  
  for (const contract of periodContracts.filter((c: any) => c.status === "active" || c.status === "expired")) {
    const statusHistory = await ctx.db
      .query("contractStatusHistory")
      .withIndex("by_contract_time", (q) => q.eq("contractId", contract._id))
      .collect();
    
    const activationEntry = statusHistory.find(entry => 
      entry.previousStatus === "draft" && entry.newStatus === "active"
    );
    
    if (activationEntry) {
      const createdTime = new Date(contract.createdAt).getTime();
      const activatedTime = new Date(activationEntry.changedAt).getTime();
      const cycleTimeDays = (activatedTime - createdTime) / (1000 * 60 * 60 * 24);
      totalCycleTime += cycleTimeDays;
      cycleTimeCount++;
    }
  }
  
  const avgCycleTime = cycleTimeCount > 0 ? Math.round(totalCycleTime / cycleTimeCount * 10) / 10 : 0;

  // Risk metrics
  const highRiskInsights = insights.filter((i: any) => 
    i.priority === "critical" || (i.priority === "high" && i.actionRequired)
  );
  const resolvedRisks = insights.filter((i: any) => i.actionTaken).length;

  // Compliance metrics
  const complianceIssues = insights.filter((i: any) => 
    i.type === "compliance_alert" || i.type === "legal_review"
  );
  const complianceRate = activeContracts.length > 0
    ? (activeContracts.length - complianceIssues.length) / activeContracts.length
    : 1;

  // Cost savings
  const savingsInsights = insights.filter((i: any) => i.type === "cost_optimization");
  const identifiedSavings = savingsInsights.reduce((sum: number, i: any) => 
    sum + (i.data?.potentialSavings || 0), 0
  );

  // Upcoming expirations
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringNext30Days = activeContracts.filter((c: any) => {
    if (!c.extractedEndDate) return false;
    const endDate = new Date(c.extractedEndDate);
    return endDate <= next30Days && endDate > now;
  });

  // Generate highlights
  const highlights: string[] = [];
  
  if (valueGrowth > 10) {
    highlights.push(`${valueGrowth.toFixed(1)}% increase in contract value month-over-month`);
  } else if (valueGrowth < -10) {
    highlights.push(`${Math.abs(valueGrowth).toFixed(1)}% decrease in contract value - review needed`);
  }
  
  if (periodContracts.length > previousPeriodContracts.length * 1.2) {
    highlights.push(`${periodContracts.length} new contracts created (20%+ increase)`);
  }
  
  if (identifiedSavings > 0) {
    highlights.push(`${formatCurrency(identifiedSavings)} in potential cost savings identified`);
  }
  
  if (avgCycleTime > 0 && avgCycleTime < 7) {
    highlights.push(`Average contract cycle time improved to ${avgCycleTime.toFixed(1)} days`);
  }
  
  if (complianceRate < 0.9) {
    highlights.push(`Compliance rate at ${(complianceRate * 100).toFixed(1)}% - attention needed`);
  }

  // Generate action items
  const actionItems: string[] = [];
  
  if (expiringNext30Days.length > 0) {
    actionItems.push(`Review ${expiringNext30Days.length} contracts expiring in next 30 days`);
  }
  
  if (highRiskInsights.length > resolvedRisks) {
    actionItems.push(`Address ${highRiskInsights.length - resolvedRisks} unresolved high-priority issues`);
  }
  
  const vendorConcentration = calculateVendorConcentration(activeContracts);
  if (vendorConcentration.topVendorPercentage > 30) {
    actionItems.push(`Reduce vendor concentration risk - ${vendorConcentration.topVendorPercentage.toFixed(1)}% with single vendor`);
  }
  
  if (newVendors === 0 && periodContracts.length > 10) {
    actionItems.push("Consider vendor diversification - no new vendors added this month");
  }

  return {
    period: "monthly",
    startDate: since.toISOString(),
    endDate: now.toISOString(),
    highlights,
    actionItems,
    
    summary: {
      totalActiveContracts: activeContracts.length,
      newContractsThisPeriod: periodContracts.length,
      contractsExpiredThisPeriod: expiredThisPeriod.length,
      totalActiveValue: totalValue,
      periodValue: periodValue,
      valueGrowth: valueGrowth,
      activeVendors: activeVendors,
      newVendors: newVendors,
      complianceRate: (complianceRate * 100).toFixed(1) + "%",
      identifiedSavings: identifiedSavings,
    },
    
    contractMetrics: {
      byStatus: periodContracts.reduce((acc: Record<string, number>, c: any) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byType: periodContracts.reduce((acc: Record<string, number>, c: any) => {
        const type = c.contractType || "other";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      averageCycleTime: avgCycleTime,
      averageValue: periodContracts.length > 0 ? periodValue / periodContracts.length : 0,
    },
    
    vendorMetrics: {
      topVendorsByValue: getTopVendorsByValue(activeContracts, vendors, 5),
      vendorConcentration: vendorConcentration,
      newVendorOnboarding: newVendors,
      vendorPerformance: calculateVendorPerformanceScores(contracts, vendors, insights),
    },
    
    riskMetrics: {
      totalRisksIdentified: highRiskInsights.length,
      risksResolved: resolvedRisks,
      openRisks: highRiskInsights.length - resolvedRisks,
      risksByType: highRiskInsights.reduce((acc: Record<string, number>, i: any) => {
        acc[i.type] = (acc[i.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    },
    
    upcomingEvents: {
      contractsExpiringNext30Days: expiringNext30Days.length,
      expiringValue: expiringNext30Days.reduce((sum: number, c: any) => 
        sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
      ),
      upcomingRenewals: expiringNext30Days.filter((c: any) => 
        c.metadata?.autoRenewal || c.contractType === "saas"
      ).length,
      paymentsDueNext30Days: calculateUpcomingPayments(activeContracts, 30),
    },
    
    performanceIndicators: {
      taskCompletionRate: tasks.length > 0 
        ? (tasks.filter((t: any) => t.status === "completed").length / tasks.length) * 100 
        : 100,
      insightActionRate: insights.length > 0
        ? (insights.filter((i: any) => i.actionTaken).length / insights.filter((i: any) => i.actionRequired).length) * 100
        : 100,
      systemUptime: 99.9, // Would calculate from agent logs
      dataQuality: calculateDataQualityScore(activeContracts),
    },
  };
}

async function gatherQuarterlyMetrics(ctx: any, since: Date): Promise<any> {
  const now = new Date();
  const quarterStart = since;
  const previousQuarterStart = new Date(quarterStart.getTime() - 90 * 24 * 60 * 60 * 1000);
  const yearAgoStart = new Date(quarterStart.getTime() - 365 * 24 * 60 * 60 * 1000);
  
  // Get comprehensive data
  const [contracts, vendors, insights, tasks, users, agentLogs] = await Promise.all([
    ctx.db.query("contracts").collect(),
    ctx.db.query("vendors").collect(),
    ctx.db.query("agentInsights").collect(),
    ctx.db.query("agentTasks").collect(),
    ctx.db.query("users").collect(),
    ctx.db.query("agentLogs")
      .filter((q: any) => q.gte(q.field("timestamp"), quarterStart.toISOString()))
      .collect(),
  ]);

  // Period filtering
  const quarterContracts = contracts.filter((c: any) => 
    c._creationTime && c._creationTime >= quarterStart.getTime()
  );
  const previousQuarterContracts = contracts.filter((c: any) => 
    c._creationTime && 
    c._creationTime >= previousQuarterStart.getTime() && 
    c._creationTime < quarterStart.getTime()
  );
  const yearAgoQuarterContracts = contracts.filter((c: any) => 
    c._creationTime && 
    c._creationTime >= yearAgoStart.getTime() && 
    c._creationTime < (yearAgoStart.getTime() + 90 * 24 * 60 * 60 * 1000)
  );

  // Active contracts analysis
  const activeContracts = contracts.filter((c: any) => c.status === "active");
  const activeContractValue = activeContracts.reduce((sum: number, c: any) => 
    sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
  );

  // Quarter-over-quarter analysis
  const qoqGrowth = calculateQuarterGrowth(quarterContracts, previousQuarterContracts);
  const yoyGrowth = calculateQuarterGrowth(quarterContracts, yearAgoQuarterContracts);

  // Vendor analysis
  const vendorMetrics = analyzeVendorQuarterlyPerformance(contracts, vendors, insights);
  
  // Financial analysis
  const financialAnalysis = performQuarterlyFinancialAnalysis(
    contracts, quarterContracts, previousQuarterContracts, yearAgoQuarterContracts
  );

  // Risk and compliance
  const riskAnalysis = performQuarterlyRiskAnalysis(contracts, insights);
  const complianceAnalysis = performQuarterlyComplianceAnalysis(contracts, insights);

  // Operational efficiency
  const operationalMetrics = await calculateOperationalEfficiency(
    ctx, contracts, tasks, agentLogs, users, quarterStart
  );

  // Strategic recommendations
  const strategicRecommendations = generateStrategicRecommendations(
    qoqGrowth, yoyGrowth, vendorMetrics, financialAnalysis, riskAnalysis
  );

  // Executive summary
  const executiveSummary = generateExecutiveSummary(
    quarterContracts, activeContracts, financialAnalysis, vendorMetrics, operationalMetrics
  );

  return {
    period: "quarterly",
    quarter: `Q${Math.ceil((quarterStart.getMonth() + 1) / 3)} ${quarterStart.getFullYear()}`,
    startDate: quarterStart.toISOString(),
    endDate: now.toISOString(),
    
    executiveSummary,
    
    growth: {
      quarterOverQuarter: qoqGrowth,
      yearOverYear: yoyGrowth,
      contractVolume: {
        thisQuarter: quarterContracts.length,
        lastQuarter: previousQuarterContracts.length,
        yearAgoQuarter: yearAgoQuarterContracts.length,
        trend: calculateTrend(
          yearAgoQuarterContracts.length,
          previousQuarterContracts.length,
          quarterContracts.length
        ),
      },
    },
    
    financialAnalysis,
    vendorAnalysis: vendorMetrics,
    riskAnalysis,
    complianceAnalysis,
    operationalMetrics,
    
    contractPortfolio: {
      totalActive: activeContracts.length,
      totalValue: activeContractValue,
      byType: groupContractsByType(activeContracts),
      byStatus: groupContractsByStatus(contracts),
      avgContractValue: activeContracts.length > 0 
        ? activeContractValue / activeContracts.length 
        : 0,
      valueDistribution: analyzeValueDistribution(activeContracts),
      expirationSchedule: analyzeExpirationSchedule(activeContracts),
    },
    
    savingsAndOptimization: {
      identifiedSavings: calculateQuarterlySavings(insights),
      implementedSavings: calculateImplementedSavings(insights, contracts),
      optimizationOpportunities: identifyOptimizationOpportunities(
        contracts, vendors, financialAnalysis
      ),
      costAvoidance: calculateCostAvoidance(contracts, insights),
    },
    
    keyAchievements: generateKeyAchievements(
      quarterContracts, insights, tasks, operationalMetrics
    ),
    
    challenges: identifyChallenges(
      riskAnalysis, complianceAnalysis, operationalMetrics, vendorMetrics
    ),
    
    strategicRecommendations,
    
    nextQuarterPriorities: generateNextQuarterPriorities(
      riskAnalysis, vendorMetrics, financialAnalysis, activeContracts
    ),
    
    appendix: {
      detailedVendorList: vendorMetrics.allVendors,
      contractExpirationDetails: generateExpirationReport(activeContracts),
      complianceDetails: complianceAnalysis.details,
      systemPerformance: operationalMetrics.systemMetrics,
    },
  };
}

// Helper functions for quarterly metrics
function calculateQuarterGrowth(current: any[], previous: any[]): any {
  const currentValue = current.reduce((sum: number, c: any) => 
    sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
  );
  const previousValue = previous.reduce((sum: number, c: any) => 
    sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
  );
  
  const volumeGrowth = previous.length > 0 
    ? ((current.length - previous.length) / previous.length) * 100 
    : 0;
  const valueGrowth = previousValue > 0 
    ? ((currentValue - previousValue) / previousValue) * 100 
    : 0;

  return {
    volumeGrowth: volumeGrowth.toFixed(1) + "%",
    valueGrowth: valueGrowth.toFixed(1) + "%",
    absoluteVolumeChange: current.length - previous.length,
    absoluteValueChange: currentValue - previousValue,
    currentVolume: current.length,
    previousVolume: previous.length,
    currentValue,
    previousValue,
  };
}

function analyzeVendorQuarterlyPerformance(contracts: any[], vendors: any[], insights: any[]): any {
  const vendorMetrics = new Map<string, any>();
  
  vendors.forEach(vendor => {
    const vendorContracts = contracts.filter((c: Doc<"contracts">) => c.vendorId === vendor._id);
    const activeContracts = vendorContracts.filter(c => c.status === "active");
    const totalValue = vendorContracts.reduce((sum, c) => 
      sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
    );
    
    const vendorInsights = insights.filter(i => i.vendorId === vendor._id);
    const riskScore = vendorInsights.filter(i => 
      i.type === "vendor_risk" || i.type === "financial_risk"
    ).length * 10;
    
    vendorMetrics.set(vendor._id.toString(), {
      vendor,
      totalContracts: vendorContracts.length,
      activeContracts: activeContracts.length,
      totalValue,
      riskScore,
      performanceScore: calculateVendorPerformanceScore(vendorContracts, vendorInsights),
      insights: vendorInsights.length,
    });
  });
  
  const sortedVendors = Array.from(vendorMetrics.values())
    .sort((a, b) => b.totalValue - a.totalValue);
  
  return {
    totalVendors: vendors.length,
    activeVendors: sortedVendors.filter(v => v.activeContracts > 0).length,
    topVendorsByValue: sortedVendors.slice(0, 10),
    vendorConcentration: calculateDetailedVendorConcentration(sortedVendors),
    highRiskVendors: sortedVendors.filter(v => v.riskScore >= 30),
    performanceDistribution: groupVendorsByPerformance(sortedVendors),
    allVendors: sortedVendors,
  };
}

function performQuarterlyFinancialAnalysis(
  allContracts: any[], 
  quarter: any[], 
  previousQuarter: any[], 
  yearAgoQuarter: any[]
): any {
  const activeContracts = allContracts.filter(c => c.status === "active");
  
  // Calculate various financial metrics
  const totalCommitted = activeContracts.reduce((sum, c) => 
    sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
  );
  
  const quarterSpend = quarter.reduce((sum, c) => 
    sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
  );
  
  const monthlyBurn = calculateMonthlyBurn(activeContracts);
  const annualProjection = monthlyBurn * 12;
  
  return {
    totalCommittedValue: totalCommitted,
    quarterlySpend: quarterSpend,
    monthlyBurnRate: monthlyBurn,
    annualProjection,
    
    spendByCategory: groupSpendByCategory(quarter),
    spendByDepartment: groupSpendByDepartment(quarter),
    spendTrend: analyzeSpendTrend(allContracts),
    
    budgetAnalysis: {
      projectedVsBudget: "Within budget", // Would compare with actual budget
      variancePercentage: 0,
      recommendations: [],
    },
    
    costStructure: {
      fixedCosts: calculateFixedCosts(activeContracts),
      variableCosts: calculateVariableCosts(activeContracts),
      oneTimeCosts: calculateOneTimeCosts(quarter),
    },
    
    roi: calculateQuarterlyROI(quarter, previousQuarter),
    paymentSchedule: analyzePaymentSchedule(activeContracts),
  };
}

function performQuarterlyRiskAnalysis(contracts: any[], insights: any[]): any {
  const activeContracts = contracts.filter(c => c.status === "active");
  const riskInsights = insights.filter(i => 
    i.type === "financial_risk" || 
    i.type === "vendor_risk" || 
    i.type === "legal_review" ||
    i.type === "compliance_alert"
  );
  
  return {
    overallRiskScore: calculateOverallRiskScore(activeContracts, riskInsights),
    risksByCategory: {
      financial: riskInsights.filter(i => i.type === "financial_risk").length,
      vendor: riskInsights.filter(i => i.type === "vendor_risk").length,
      legal: riskInsights.filter(i => i.type === "legal_review").length,
      compliance: riskInsights.filter(i => i.type === "compliance_alert").length,
    },
    highRiskContracts: identifyHighRiskContracts(activeContracts, riskInsights),
    mitigationStatus: {
      identified: riskInsights.length,
      addressed: riskInsights.filter(i => i.actionTaken).length,
      pending: riskInsights.filter(i => !i.actionTaken && i.actionRequired).length,
    },
    emergingRisks: identifyEmergingRisks(contracts, insights),
    riskTrends: analyzeRiskTrends(insights),
  };
}

function performQuarterlyComplianceAnalysis(contracts: any[], insights: any[]): any {
  const complianceInsights = insights.filter(i => 
    i.type === "compliance_alert" || i.type === "legal_review"
  );
  
  const activeContracts = contracts.filter(c => c.status === "active");
  const compliantContracts = activeContracts.filter(c => 
    !complianceInsights.some(i => i.contractId === c._id && !i.actionTaken)
  );
  
  return {
    overallComplianceRate: activeContracts.length > 0 
      ? (compliantContracts.length / activeContracts.length) * 100 
      : 100,
    
    complianceByType: groupComplianceByContractType(contracts, complianceInsights),
    
    violations: {
      total: complianceInsights.length,
      resolved: complianceInsights.filter(i => i.actionTaken).length,
      pending: complianceInsights.filter(i => !i.actionTaken).length,
      critical: complianceInsights.filter(i => i.priority === "critical").length,
    },
    
    regulatoryUpdates: [], // Would track actual regulatory changes
    
    auditReadiness: calculateAuditReadiness(contracts, complianceInsights),
    
    details: complianceInsights.map(i => ({
      type: i.type,
      title: i.title,
      contractId: i.contractId,
      severity: i.priority,
      status: i.actionTaken ? "resolved" : "pending",
      createdAt: i.createdAt,
    })),
  };
}

async function calculateOperationalEfficiency(
  ctx: any,
  contracts: any[], 
  tasks: any[], 
  logs: any[], 
  users: any[],
  since: Date
): Promise<any> {
  const periodTasks = tasks.filter((t: any) => 
    t.createdAt && new Date(t.createdAt) >= since
  );
  
  const completedTasks = periodTasks.filter((t: any) => t.status === "completed");
  const avgTaskCompletionTime = calculateAverageTaskCompletionTime(completedTasks);
  
  return {
    contractProcessingTime: await calculateAverageContractProcessingTime(ctx, contracts),
    taskCompletionRate: periodTasks.length > 0 
      ? (completedTasks.length / periodTasks.length) * 100 
      : 100,
    averageTaskCompletionTime: avgTaskCompletionTime,
    
    userProductivity: {
      contractsPerUser: contracts.length / users.length,
      activeUsers: users.filter(u => u.lastLoginAt && 
        new Date(u.lastLoginAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).length,
    },
    
    automationMetrics: {
      automatedTasks: periodTasks.filter((t: any) => t.createdByAgentId).length,
      manualTasks: periodTasks.filter((t: any) => !t.createdByAgentId).length,
      automationRate: periodTasks.length > 0
        ? (periodTasks.filter((t: any) => t.createdByAgentId).length / periodTasks.length) * 100
        : 0,
    },
    
    systemMetrics: {
      uptime: calculateSystemUptime(logs),
      errorRate: calculateErrorRate(logs),
      averageResponseTime: calculateAverageResponseTime(logs),
      agentPerformance: calculateAgentPerformance(logs),
    },
  };
}

function generateStrategicRecommendations(
  qoqGrowth: any,
  yoyGrowth: any,
  vendorMetrics: any,
  financialAnalysis: any,
  riskAnalysis: any
): string[] {
  const recommendations: string[] = [];
  
  // Growth recommendations
  if (parseFloat(qoqGrowth.valueGrowth) > 20) {
    recommendations.push("Rapid growth detected - consider scaling contract management resources");
  } else if (parseFloat(qoqGrowth.valueGrowth) < -10) {
    recommendations.push("Contract value declining - investigate causes and develop retention strategy");
  }
  
  // Vendor recommendations
  if (vendorMetrics.vendorConcentration.top3Percentage > 60) {
    recommendations.push("High vendor concentration risk - develop vendor diversification strategy");
  }
  
  if (vendorMetrics.highRiskVendors.length > 5) {
    recommendations.push("Multiple high-risk vendor relationships - implement vendor risk management program");
  }
  
  // Financial recommendations
  if (financialAnalysis.annualProjection > financialAnalysis.totalCommittedValue * 1.2) {
    recommendations.push("Projected spend exceeds commitments - review contract terms and negotiate better rates");
  }
  
  // Risk recommendations
  if (riskAnalysis.overallRiskScore > 70) {
    recommendations.push("Elevated risk profile - prioritize risk mitigation initiatives");
  }
  
  if (riskAnalysis.mitigationStatus.pending > 10) {
    recommendations.push(`${riskAnalysis.mitigationStatus.pending} unaddressed risks - allocate resources for risk resolution`);
  }
  
  // Operational recommendations
  const savingsPercentage = (financialAnalysis.quarterlySpend > 0) 
    ? (parseFloat(yoyGrowth.absoluteValueChange) / financialAnalysis.quarterlySpend) * 100 
    : 0;
    
  if (savingsPercentage < 5) {
    recommendations.push("Limited cost savings achieved - implement systematic cost optimization program");
  }
  
  return recommendations;
}

function generateExecutiveSummary(
  quarterContracts: any[],
  activeContracts: any[],
  financial: any,
  vendor: any,
  operational: any
): any {
  const totalValue = activeContracts.reduce((sum, c) => 
    sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
  );
  
  return {
    keyMessage: generateKeyMessage(quarterContracts, financial, vendor),
    
    highlights: [
      `${quarterContracts.length} new contracts worth ${formatCurrency(financial.quarterlySpend)}`,
      `${activeContracts.length} active contracts with total value of ${formatCurrency(totalValue)}`,
      `${vendor.activeVendors} active vendor relationships`,
      `${operational.automationMetrics.automationRate.toFixed(1)}% task automation rate`,
    ],
    
    criticalMetrics: {
      contractGrowth: `${((quarterContracts.length / activeContracts.length) * 100).toFixed(1)}%`,
      spendEfficiency: financial.roi || "N/A",
      vendorConcentration: `${vendor.vendorConcentration.topVendorPercentage.toFixed(1)}%`,
      operationalEfficiency: `${operational.taskCompletionRate.toFixed(1)}%`,
    },
    
    executiveActions: generateExecutiveActions(financial, vendor, operational),
  };
}

// Additional helper functions
function calculateVendorConcentration(contracts: any[]): any {
  const vendorSpend: Record<string, number> = {};
  let totalSpend = 0;
  
  contracts.forEach(contract => {
    const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
    if (value > 0) {
      const vendorId = contract.vendorId ? contract.vendorId.toString() : 'unassigned';
      vendorSpend[vendorId] = (vendorSpend[vendorId] || 0) + value;
      totalSpend += value;
    }
  });
  
  const sortedVendors = Object.entries(vendorSpend)
    .sort(([, a], [, b]) => b - a);
  
  const topVendorSpend = sortedVendors[0]?.[1] || 0;
  const top3Spend = sortedVendors.slice(0, 3)
    .reduce((sum, [, value]) => sum + value, 0);
  
  return {
    topVendorPercentage: totalSpend > 0 ? (topVendorSpend / totalSpend) * 100 : 0,
    top3Percentage: totalSpend > 0 ? (top3Spend / totalSpend) * 100 : 0,
    vendorCount: Object.keys(vendorSpend).length,
    herfindahlIndex: calculateHerfindahlIndex(vendorSpend, totalSpend),
  };
}

function calculateHerfindahlIndex(vendorSpend: Record<string, number>, totalSpend: number): number {
  if (totalSpend === 0) return 0;
  
  return Object.values(vendorSpend)
    .reduce((sum, spend) => {
      const marketShare = spend / totalSpend;
      return sum + (marketShare * marketShare);
    }, 0) * 10000; // Scale to 0-10000
}

function getTopVendorsByValue(contracts: any[], vendors: any[], limit: number): any[] {
  const vendorMap = new Map(vendors.map(v => [v._id.toString(), v]));
  const vendorValues: Record<string, number> = {};
  
  contracts.forEach(contract => {
    const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
    const vendorId = contract.vendorId.toString();
    vendorValues[vendorId] = (vendorValues[vendorId] || 0) + value;
  });
  
  return Object.entries(vendorValues)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([vendorId, value]) => ({
      vendor: vendorMap.get(vendorId),
      totalValue: value,
      contractCount: contracts.filter(c => c.vendorId.toString() === vendorId).length,
    }));
}

function calculateVendorPerformanceScores(contracts: any[], vendors: any[], insights: any[]): any {
  const scores: Record<string, any> = {};
  
  vendors.forEach(vendor => {
    const vendorContracts = contracts.filter((c: Doc<"contracts">) => c.vendorId === vendor._id);
    const vendorInsights = insights.filter(i => i.vendorId === vendor._id);
    
    const riskInsights = vendorInsights.filter(i => 
      i.type === "vendor_risk" || i.type === "financial_risk"
    );
    
    const complianceScore = vendorInsights.filter(i => 
      i.type === "compliance_alert"
    ).length === 0 ? 100 : 50;
    
    const valueScore = vendorContracts.reduce((sum, c) => 
      sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
    );
    
    scores[vendor._id.toString()] = {
      vendorName: vendor.name,
      overallScore: (complianceScore + (riskInsights.length === 0 ? 100 : 50)) / 2,
      complianceScore,
      riskScore: riskInsights.length === 0 ? 100 : Math.max(0, 100 - (riskInsights.length * 20)),
      valueScore,
      contractCount: vendorContracts.length,
    };
  });
  
  return scores;
}

function calculateUpcomingPayments(contracts: any[], days: number): any {
  const upcomingPayments: any[] = [];
  const cutoffDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  
  contracts.forEach(contract => {
    if (contract.extractedPaymentSchedule) {
      // Parse payment schedule with comprehensive pattern matching
      const schedule = contract.extractedPaymentSchedule.toLowerCase();
      const totalValue = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
      
      let frequency: string;
      let amount: number;
      let intervalDays: number;
      
      if (schedule.includes('monthly') || schedule.includes('per month')) {
        frequency = 'monthly';
        amount = totalValue / 12;
        intervalDays = 30;
      } else if (schedule.includes('quarterly') || schedule.includes('per quarter')) {
        frequency = 'quarterly';
        amount = totalValue / 4;
        intervalDays = 90;
      } else if (schedule.includes('annually') || schedule.includes('yearly') || schedule.includes('per year')) {
        frequency = 'annually';
        amount = totalValue;
        intervalDays = 365;
      } else if (schedule.includes('weekly') || schedule.includes('per week')) {
        frequency = 'weekly';
        amount = totalValue / 52;
        intervalDays = 7;
      } else if (schedule.includes('one-time') || schedule.includes('upfront')) {
        frequency = 'one-time';
        amount = totalValue;
        intervalDays = 0;
      } else {
        // Default to monthly if unclear
        frequency = 'monthly';
        amount = totalValue / 12;
        intervalDays = 30;
      }
      
      // Calculate next payment date based on contract dates
      let nextDue: Date;
      if (contract.extractedStartDate) {
        const startDate = new Date(contract.extractedStartDate);
        const daysSinceStart = (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        const periodsPassed = Math.floor(daysSinceStart / intervalDays);
        nextDue = new Date(startDate.getTime() + (periodsPassed + 1) * intervalDays * 24 * 60 * 60 * 1000);
      } else {
        nextDue = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
      }
      
      if (nextDue <= cutoffDate && amount > 0) {
        upcomingPayments.push({
          contractId: contract._id,
          contractTitle: contract.title,
          vendorId: contract.vendorId,
          amount,
          frequency,
          nextDue,
          totalContractValue: totalValue,
        });
      }
    }
  });
  
  return {
    count: upcomingPayments.length,
    totalAmount: upcomingPayments.reduce((sum, p) => sum + p.amount, 0),
    payments: upcomingPayments,
  };
}

function calculateDataQualityScore(contracts: any[]): number {
  if (contracts.length === 0) return 100;
  
  let totalScore = 0;
  
  contracts.forEach(contract => {
    let contractScore = 0;
    let fields = 0;
    
    // Check required fields
    if (contract.title) { contractScore++; fields++; }
    if (contract.contractType) { contractScore++; fields++; }
    if (contract.extractedStartDate) { contractScore++; fields++; }
    if (contract.extractedEndDate) { contractScore++; fields++; }
    if (contract.extractedPricing) { contractScore++; fields++; }
    if (contract.extractedPaymentSchedule) { contractScore++; fields++; }
    if (contract.extractedParties?.length > 0) { contractScore++; fields++; }
    
    totalScore += (fields > 0 ? (contractScore / fields) : 0) * 100;
  });
  
  return totalScore / contracts.length;
}

function calculateVendorPerformanceScore(contracts: any[], insights: any[]): number {
  if (contracts.length === 0) return 0;
  
  const issues = insights.filter(i => 
    i.type === "vendor_risk" || 
    i.type === "compliance_alert" || 
    i.priority === "critical"
  ).length;
  
  const baseScore = 100;
  const deduction = Math.min(issues * 10, 50);
  
  return Math.max(baseScore - deduction, 0);
}

function calculateTrend(oldest: number, middle: number, newest: number): string {
  const firstGrowth = middle > 0 ? ((middle - oldest) / oldest) : 0;
  const secondGrowth = newest > 0 ? ((newest - middle) / middle) : 0;
  
  if (firstGrowth > 0.1 && secondGrowth > 0.1) return "accelerating";
  if (firstGrowth > 0 && secondGrowth > 0) return "growing";
  if (firstGrowth < -0.1 && secondGrowth < -0.1) return "declining";
  if (firstGrowth < 0 && secondGrowth < 0) return "contracting";
  return "stable";
}

function groupContractsByType(contracts: any[]): Record<string, number> {
  return contracts.reduce((acc: Record<string, number>, c: any) => {
    const type = c.contractType || "other";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function groupContractsByStatus(contracts: any[]): Record<string, number> {
  return contracts.reduce((acc: Record<string, number>, c: any) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function analyzeExpirationSchedule(contracts: any[]): any {
  const schedule: Record<string, number> = {
    expired: 0,
    within30Days: 0,
    within90Days: 0,
    within180Days: 0,
    within1Year: 0,
    beyond1Year: 0,
    noEndDate: 0,
  };
  
  const now = new Date();
  
  contracts.forEach(contract => {
    if (!contract.extractedEndDate) {
      schedule.noEndDate = schedule.noEndDate + 1;
      return;
    }
    
    const endDate = new Date(contract.extractedEndDate);
    const daysUntil = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) schedule.expired = schedule.expired + 1;
    else if (daysUntil <= 30) schedule.within30Days = schedule.within30Days + 1;
    else if (daysUntil <= 90) schedule.within90Days = schedule.within90Days + 1;
    else if (daysUntil <= 180) schedule.within180Days = schedule.within180Days + 1;
    else if (daysUntil <= 365) schedule.within1Year = schedule.within1Year + 1;
    else schedule.beyond1Year = schedule.beyond1Year + 1;
  });
  
  return schedule;
}

function calculateQuarterlySavings(insights: any[]): number {
  return insights
    .filter(i => i.type === "cost_optimization")
    .reduce((sum, i) => sum + (i.data?.potentialSavings || 0), 0);
}

function calculateImplementedSavings(insights: any[], contracts: any[]): number {
  return insights
    .filter(i => i.type === "cost_optimization" && i.actionTaken)
    .reduce((sum, i) => sum + (i.data?.potentialSavings || 0), 0) * 0.7; // Assume 70% realization
}

function identifyOptimizationOpportunities(
  contracts: any[], 
  vendors: any[], 
  financial: any
): any[] {
  const opportunities: any[] = [];
  
  // Bundle opportunities
  const vendorCounts = contracts.reduce((acc: Record<string, number>, c: any) => {
    if (c.status === "active") {
      acc[c.vendorId.toString()] = (acc[c.vendorId.toString()] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(vendorCounts).forEach(([vendorId, count]) => {
    if (typeof count === 'number' && count >= 3) {
      opportunities.push({
        type: "bundling",
        vendorId,
        description: `${count} contracts with same vendor - potential bundling opportunity`,
        estimatedSavings: financial.quarterlySpend * 0.05, // 5% estimate
      });
    }
  });
  
  // Early payment discounts
  if (financial.quarterlySpend > 100000) {
    opportunities.push({
      type: "payment_terms",
      description: "Negotiate early payment discounts on high-value contracts",
      estimatedSavings: financial.quarterlySpend * 0.02, // 2% estimate
    });
  }
  
  return opportunities;
}

function calculateCostAvoidance(contracts: any[], insights: any[]): number {
  // Calculate costs avoided through proactive actions
  const avoidedRenewals = insights
    .filter(i => i.type === "renewal_opportunity" && i.actionTaken)
    .length;
  
  const avgContractValue = contracts.length > 0
    ? contracts.reduce((sum, c) => 
        sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
      ) / contracts.length
    : 0;
  
  return avoidedRenewals * avgContractValue * 0.15; // Assume 15% savings on renegotiation
}

function generateKeyAchievements(
  contracts: any[], 
  insights: any[], 
  tasks: any[], 
  operational: any
): string[] {
  const achievements: string[] = [];
  
  if (operational.taskCompletionRate > 95) {
    achievements.push(`Achieved ${operational.taskCompletionRate.toFixed(1)}% task completion rate`);
  }
  
  const criticalIssuesResolved = insights.filter(i => 
    i.priority === "critical" && i.actionTaken
  ).length;
  
  if (criticalIssuesResolved > 0) {
    achievements.push(`Resolved ${criticalIssuesResolved} critical issues`);
  }
  
  if (operational.automationMetrics.automationRate > 70) {
    achievements.push(`${operational.automationMetrics.automationRate.toFixed(1)}% process automation achieved`);
  }
  
  return achievements;
}

function identifyChallenges(
  risk: any, 
  compliance: any, 
  operational: any, 
  vendor: any
): string[] {
  const challenges: string[] = [];
  
  if (risk.mitigationStatus.pending > 10) {
    challenges.push(`${risk.mitigationStatus.pending} unresolved risk items require attention`);
  }
  
  if (compliance.overallComplianceRate < 90) {
    challenges.push(`Compliance rate at ${compliance.overallComplianceRate.toFixed(1)}% - below target`);
  }
  
  if (vendor.highRiskVendors.length > 3) {
    challenges.push(`${vendor.highRiskVendors.length} vendors identified as high risk`);
  }
  
  if (operational.systemMetrics.errorRate > 5) {
    challenges.push("System error rate exceeds acceptable threshold");
  }
  
  return challenges;
}

function generateNextQuarterPriorities(
  risk: any, 
  vendor: any, 
  financial: any, 
  contracts: any[]
): string[] {
  const priorities: string[] = [];
  
  // Risk priorities
  if (risk.mitigationStatus.pending > 5) {
    priorities.push("Complete pending risk mitigation actions");
  }
  
  // Vendor priorities
  if (vendor.vendorConcentration.topVendorPercentage > 40) {
    priorities.push("Implement vendor diversification strategy");
  }
  
  // Contract priorities
  const expiringNext90 = contracts.filter(c => {
    if (!c.extractedEndDate || c.status !== "active") return false;
    const daysUntil = Math.ceil(
      (new Date(c.extractedEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntil > 0 && daysUntil <= 90;
  });
  
  if (expiringNext90.length > 10) {
    priorities.push(`Process ${expiringNext90.length} contract renewals`);
  }
  
  // Financial priorities
  if (financial.costStructure.variableCosts > financial.costStructure.fixedCosts * 1.5) {
    priorities.push("Optimize variable cost contracts");
  }
  
  return priorities;
}

function generateExpirationReport(contracts: any[]): any[] {
  const now = new Date();
  
  return contracts
    .filter(c => c.extractedEndDate && c.status === "active")
    .map(c => ({
      contractId: c._id,
      title: c.title,
      vendorId: c.vendorId,
      value: parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'),
      endDate: c.extractedEndDate,
      daysUntilExpiry: Math.ceil(
        (new Date(c.extractedEndDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }))
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
    .slice(0, 20); // Top 20 expiring contracts
}

function calculateDetailedVendorConcentration(vendors: any[]): any {
  const totalValue = vendors.reduce((sum, v) => sum + v.totalValue, 0);
  
  if (totalValue === 0 || vendors.length === 0) {
    return {
      topVendorPercentage: 0,
      top3Percentage: 0,
      top5Percentage: 0,
      herfindahlIndex: 0,
    };
  }
  
  const top1 = vendors[0]?.totalValue || 0;
  const top3 = vendors.slice(0, 3).reduce((sum, v) => sum + v.totalValue, 0);
  const top5 = vendors.slice(0, 5).reduce((sum, v) => sum + v.totalValue, 0);
  
  const hhi = vendors.reduce((sum, v) => {
    const share = v.totalValue / totalValue;
    return sum + (share * share);
  }, 0) * 10000;
  
  return {
    topVendorPercentage: (top1 / totalValue) * 100,
    top3Percentage: (top3 / totalValue) * 100,
    top5Percentage: (top5 / totalValue) * 100,
    herfindahlIndex: hhi,
  };
}

function groupVendorsByPerformance(vendors: any[]): any {
  return {
    excellent: vendors.filter(v => v.performanceScore >= 90).length,
    good: vendors.filter(v => v.performanceScore >= 70 && v.performanceScore < 90).length,
    average: vendors.filter(v => v.performanceScore >= 50 && v.performanceScore < 70).length,
    poor: vendors.filter(v => v.performanceScore < 50).length,
  };
}

function groupSpendByCategory(contracts: any[]): Record<string, number> {
  return contracts.reduce((acc, c) => {
    const category = c.contractType || "other";
    const value = parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
    acc[category] = (acc[category] || 0) + value;
    return acc;
  }, {} as Record<string, number>);
}

function groupSpendByDepartment(contracts: any[]): Record<string, number> {
  const departmentSpend: Record<string, number> = {};
  
  // Department mapping based on contract type and actual department field
  const contractTypeToDepartment: Record<string, string> = {
    "saas": "IT",
    "technology": "IT",
    "software": "IT",
    "hardware": "IT",
    "legal": "Legal",
    "employment": "HR",
    "consulting": "Operations",
    "lease": "Facilities",
    "facilities": "Facilities",
    "marketing": "Marketing",
    "sales": "Sales",
    "finance": "Finance",
    "insurance": "Risk Management",
    "other": "Other"
  };
  
  for (const contract of contracts) {
    // Use department field if available, otherwise map from contract type
    const department = contract.departmentId || 
                      contractTypeToDepartment[contract.contractType || "other"] || 
                      "Other";
    
    const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
    departmentSpend[department] = (departmentSpend[department] || 0) + value;
  }
  
  return departmentSpend;
}

function analyzeSpendTrend(contracts: any[]): any {
  const monthlySpend = calculateMonthlySpend(contracts);
  const months = Object.keys(monthlySpend).sort();
  
  if (months.length < 3) return { trend: "insufficient_data" };
  
  const recentMonths = months.slice(-12);
  const values = recentMonths.map(m => monthlySpend[m] || 0);
  
  // Simple linear regression
  const n = values.length;
  const sumX = n * (n - 1) / 2;
  const sumY = values.reduce((a: number, b: number) => (a || 0) + (b || 0), 0);
  const sumXY = values.reduce((sum: number, val: number, i: number) => (sum || 0) + ((val || 0) * i), 0);
  const sumXX = n * (n - 1) * (2 * n - 1) / 6;
  
  const slope = (n * (sumXY || 0) - sumX * (sumY || 0)) / (n * sumXX - sumX * sumX);
  const intercept = ((sumY || 0) - slope * sumX) / n;
  
  return {
    trend: slope > 0 ? "increasing" : "decreasing",
    monthlyGrowthRate: slope,
    projection: {
      nextMonth: intercept + slope * n,
      next3Months: intercept + slope * (n + 2),
    },
  };
}

function calculateMonthlyBurn(contracts: any[]): number {
  const activeContracts = contracts.filter(c => c.status === "active");
  let totalMonthlyBurn = 0;
  
  activeContracts.forEach(contract => {
    const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
    
    if (contract.extractedPaymentSchedule) {
      const schedule = contract.extractedPaymentSchedule.toLowerCase();
      if (schedule.includes('monthly')) {
        totalMonthlyBurn += value;
      } else if (schedule.includes('annual') || schedule.includes('yearly')) {
        totalMonthlyBurn += value / 12;
      } else if (schedule.includes('quarterly')) {
        totalMonthlyBurn += value / 3;
      } else {
        // Default to annual if unclear
        totalMonthlyBurn += value / 12;
      }
    } else {
      // Assume annual if no schedule
      totalMonthlyBurn += value / 12;
    }
  });
  
  return totalMonthlyBurn;
}

function calculateFixedCosts(contracts: any[]): number {
  return contracts
    .filter(c => {
      const type = c.contractType || "";
      return ["lease", "saas", "employment"].includes(type);
    })
    .reduce((sum, c) => sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0);
}

function calculateVariableCosts(contracts: any[]): number {
  return contracts
    .filter(c => {
      const type = c.contractType || "";
      return ["consulting", "services", "logistics"].includes(type);
    })
    .reduce((sum, c) => sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0);
}

function calculateOneTimeCosts(contracts: any[]): number {
  return contracts
    .filter(c => {
      const schedule = (c.extractedPaymentSchedule || "").toLowerCase();
      return schedule.includes("one-time") || schedule.includes("lump sum");
    })
    .reduce((sum, c) => sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0);
}

function calculateQuarterlyROI(current: any[], previous: any[]): string {
  // Simplified ROI calculation
  const currentValue = current.reduce((sum: number, c: any) => 
    sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
  );
  const previousValue = previous.reduce((sum: number, c: any) => 
    sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
  );
  
  if (previousValue === 0) return "N/A";
  
  const roi = ((currentValue - previousValue) / previousValue) * 100;
  return `${roi.toFixed(1)}%`;
}

function analyzePaymentSchedule(contracts: any[]): any {
  const schedules = {
    monthly: 0,
    quarterly: 0,
    annual: 0,
    oneTime: 0,
    other: 0,
  };
  
  contracts.forEach(contract => {
    const schedule = (contract.extractedPaymentSchedule || "").toLowerCase();
    if (schedule.includes("monthly")) schedules.monthly++;
    else if (schedule.includes("quarterly")) schedules.quarterly++;
    else if (schedule.includes("annual") || schedule.includes("yearly")) schedules.annual++;
    else if (schedule.includes("one-time") || schedule.includes("lump")) schedules.oneTime++;
    else schedules.other++;
  });
  
  return schedules;
}

function calculateOverallRiskScore(contracts: any[], insights: any[]): number {
  const baseScore = 50;
  let adjustments = 0;
  
  // High-value contracts without end dates
  const riskyContracts = contracts.filter(c => 
    c.status === "active" && 
    !c.extractedEndDate && 
    parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0') > 50000
  );
  adjustments += riskyContracts.length * 5;
  
  // Unresolved risk insights
  const unresolved = insights.filter(i => 
    (i.type === "financial_risk" || i.type === "vendor_risk") && 
    !i.actionTaken
  );
  adjustments += unresolved.length * 3;
  
  return Math.min(baseScore + adjustments, 100);
}

function identifyHighRiskContracts(contracts: any[], insights: any[]): any[] {
  const riskMap = new Map<string, number>();
  
  // Add risk scores from insights
  insights.forEach(insight => {
    if (insight.contractId && (insight.type.includes("risk") || insight.priority === "critical")) {
      const current = riskMap.get(insight.contractId.toString()) || 0;
      riskMap.set(insight.contractId.toString(), current + 10);
    }
  });
  
  return contracts
    .filter(c => c.status === "active")
    .map(contract => {
      let riskScore = riskMap.get(contract._id.toString()) || 0;
      
      // Add risk factors
      if (!contract.extractedEndDate) riskScore += 15;
      if (parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0') > 100000) riskScore += 10;
      if (!contract.extractedPaymentSchedule) riskScore += 5;
      
      return { contract, riskScore };
    })
    .filter(item => item.riskScore >= 20)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10);
}

function identifyEmergingRisks(contracts: any[], insights: any[]): string[] {
  const risks: string[] = [];
  const recentInsights = insights.filter(i => {
    const daysSince = (Date.now() - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 30;
  });
  
  // Pattern detection
  const riskTypes = recentInsights.reduce((acc: Record<string, number>, i: any) => {
    if (i.type.includes("risk")) {
      acc[i.type] = (acc[i.type] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(riskTypes).forEach(([type, count]) => {
    if (typeof count === 'number' && count >= 5) {
      risks.push(`Increasing ${type.replace("_", " ")} incidents (${count} in last 30 days)`);
    }
  });
  
  return risks;
}

function analyzeRiskTrends(insights: any[]): any {
  const monthlyRisks: Record<string, number> = {};
  
  insights
    .filter(i => i.type.includes("risk"))
    .forEach(insight => {
      const month = new Date(insight.createdAt).toISOString().slice(0, 7);
      monthlyRisks[month] = (monthlyRisks[month] || 0) + 1;
    });
  
  const months = Object.keys(monthlyRisks).sort();
  const lastMonth = months[months.length - 1];
  const firstMonth = months[0];
  const trend = months.length >= 3 && lastMonth && firstMonth &&
    (monthlyRisks[lastMonth!] || 0) > (monthlyRisks[firstMonth!] || 0)
    ? "increasing" : "stable";
  
  return { monthlyRisks, trend };
}

function groupComplianceByContractType(contracts: any[], insights: any[]): any {
  const compliance: Record<string, any> = {};
  
  const types = Array.from(new Set(contracts.map(c => c.contractType || "other")));
  
  types.forEach(type => {
    const typeContracts = contracts.filter(c => 
      (c.contractType || "other") === type && c.status === "active"
    );
    const typeIssues = insights.filter(i => 
      i.type === "compliance_alert" && 
      typeContracts.some(c => c._id === i.contractId)
    );
    
    compliance[type] = {
      total: typeContracts.length,
      compliant: typeContracts.length - typeIssues.length,
      rate: typeContracts.length > 0 
        ? ((typeContracts.length - typeIssues.length) / typeContracts.length) * 100 
        : 100,
    };
  });
  
  return compliance;
}

function calculateAuditReadiness(contracts: any[], insights: any[]): number {
  const activeContracts = contracts.filter(c => c.status === "active");
  if (activeContracts.length === 0) return 100;
  
  let readinessScore = 100;
  
  // Deduct for missing data
  const missingEndDates = activeContracts.filter(c => !c.extractedEndDate).length;
  readinessScore -= (missingEndDates / activeContracts.length) * 20;
  
  // Deduct for compliance issues
  const complianceIssues = insights.filter(i => 
    i.type === "compliance_alert" && !i.actionTaken
  ).length;
  readinessScore -= complianceIssues * 5;
  
  return Math.max(readinessScore, 0);
}

async function calculateAverageContractProcessingTime(ctx: any, contracts: any[]): Promise<number> {
  let totalProcessingTime = 0;
  let processedCount = 0;
  
  for (const contract of contracts) {
    if (contract.status === "active" || contract.status === "expired") {
      // Get status history
      const statusHistory = await ctx.db
        .query("contractStatusHistory")
        .withIndex("by_contract_time", (q) => q.eq("contractId", contract._id))
        .collect();
      
      // Find activation time
      const activationEntry = statusHistory.find(entry => 
        entry.previousStatus === "draft" && entry.newStatus === "active"
      );
      
      if (activationEntry) {
        const createdTime = new Date(contract.createdAt).getTime();
        const activatedTime = new Date(activationEntry.changedAt).getTime();
        const processingTimeDays = (activatedTime - createdTime) / (1000 * 60 * 60 * 24);
        
        if (processingTimeDays > 0 && processingTimeDays < 365) { // Sanity check
          totalProcessingTime += processingTimeDays;
          processedCount++;
        }
      }
    }
  }
  
  // Return average processing time in days, default to 7 if no data
  return processedCount > 0 ? Math.round(totalProcessingTime / processedCount * 10) / 10 : 7;
}

function calculateAverageTaskCompletionTime(tasks: any[]): number {
  if (tasks.length === 0) return 0;
  
  let totalTime = 0;
  let count = 0;
  
  tasks.forEach(task => {
    if (task.startedAt && task.completedAt) {
      const duration = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime();
      totalTime += duration;
      count++;
    }
  });
  
  return count > 0 ? totalTime / count / (1000 * 60 * 60) : 0; // Return in hours
}

function calculateSystemUptime(logs: any[]): number {
  const errors = logs.filter(l => l.level === "error" || l.level === "critical");
  const totalLogs = logs.length;
  
  if (totalLogs === 0) return 100;
  
  return ((totalLogs - errors.length) / totalLogs) * 100;
}

function calculateErrorRate(logs: any[]): number {
  const errors = logs.filter(l => l.level === "error" || l.level === "critical");
  return logs.length > 0 ? (errors.length / logs.length) * 100 : 0;
}

function calculateAverageResponseTime(logs: any[]): number {
  // Calculate actual response times from logs with performance data
  const performanceLogs = logs.filter(log => 
    log.data?.responseTime || 
    (log.data?.startTime && log.data?.endTime)
  );
  
  if (performanceLogs.length === 0) {
    // Return a reasonable default if no performance data available
    return 250;
  }
  
  let totalResponseTime = 0;
  let count = 0;
  
  performanceLogs.forEach(log => {
    if (log.data?.responseTime) {
      totalResponseTime += log.data.responseTime;
      count++;
    } else if (log.data?.startTime && log.data?.endTime) {
      const startTime = new Date(log.data.startTime).getTime();
      const endTime = new Date(log.data.endTime).getTime();
      const responseTime = endTime - startTime;
      if (responseTime > 0 && responseTime < 60000) { // Sanity check: less than 1 minute
        totalResponseTime += responseTime;
        count++;
      }
    }
  });
  
  return count > 0 ? Math.round(totalResponseTime / count) : 250;
}

function calculateAgentPerformance(logs: any[]): any {
  const agentLogs: Record<string, any> = {};
  
  logs.forEach(log => {
    const agentId = log.agentId?.toString() || "unknown";
    if (!agentLogs[agentId]) {
      agentLogs[agentId] = {
        total: 0,
        errors: 0,
        runs: 0,
      };
    }
    
    agentLogs[agentId].total++;
    if (log.level === "error" || log.level === "critical") {
      agentLogs[agentId].errors++;
    }
    if (log.message?.includes("starting run")) {
      agentLogs[agentId].runs++;
    }
  });
  
  return Object.entries(agentLogs).map(([agentId, stats]) => ({
    agentId,
    errorRate: stats.total > 0 ? (stats.errors / stats.total) * 100 : 0,
    totalRuns: stats.runs,
  }));
}

function generateKeyMessage(contracts: any[], financial: any, vendor: any): string {
  const growth = contracts.length > 10 ? "strong" : "moderate";
  const efficiency = financial.roi && parseFloat(financial.roi) > 10 ? "improved" : "stable";
  
  return `The quarter showed ${growth} growth with ${contracts.length} new contracts. ` +
         `Financial efficiency ${efficiency}, with vendor concentration at ${vendor.vendorConcentration.topVendorPercentage.toFixed(1)}%.`;
}

function generateExecutiveActions(financial: any, vendor: any, operational: any): string[] {
  const actions: string[] = [];
  
  if (vendor.vendorConcentration.topVendorPercentage > 40) {
    actions.push("Approve vendor diversification initiative");
  }
  
  if (financial.budgetAnalysis.variancePercentage > 10) {
    actions.push("Review and adjust budget allocations");
  }
  
  if (operational.taskCompletionRate < 90) {
    actions.push("Allocate additional resources to contract processing");
  }
  
  return actions;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================================================
// METRICS UPDATE FUNCTION
// ============================================================================

async function updateAgentMetrics(
  ctx: any,
  agentId: Id<"agents">,
  runData: {
    runTime: number;
    kpisCalculated: number;
    contractInsights: number;
    vendorInsights: number;
    financialInsights: number;
    anomaliesDetected: number;
    forecastsCreated: number;
    reportsGenerated: number;
  }
): Promise<void> {
  const agent = await ctx.db.get(agentId);
  if (!agent) return;

  const existingMetrics = (agent.metrics as AnalyticsAgentMetrics) || {
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    averageRunTime: 0,
    reportsGenerated: 0,
    kpisCalculated: 0,
    trendsIdentified: 0,
    anomaliesDetected: 0,
    forecastsCreated: 0,
    dataPointsAnalyzed: 0,
  };

  const totalInsights = runData.contractInsights + runData.vendorInsights + 
                       runData.financialInsights + runData.anomaliesDetected;

  const newMetrics: AnalyticsAgentMetrics = {
    ...existingMetrics,
    totalRuns: existingMetrics.totalRuns + 1,
    successfulRuns: existingMetrics.successfulRuns + 1,
    averageRunTime: 
      ((existingMetrics.averageRunTime * existingMetrics.totalRuns) + runData.runTime) / 
      (existingMetrics.totalRuns + 1),
    lastRunDuration: runData.runTime,
    reportsGenerated: (existingMetrics.reportsGenerated || 0) + runData.reportsGenerated,
    kpisCalculated: (existingMetrics.kpisCalculated || 0) + runData.kpisCalculated,
    trendsIdentified: (existingMetrics.trendsIdentified || 0) + runData.financialInsights,
    anomaliesDetected: (existingMetrics.anomaliesDetected || 0) + runData.anomaliesDetected,
    forecastsCreated: (existingMetrics.forecastsCreated || 0) + runData.forecastsCreated,
    insightsGenerated: (existingMetrics.insightsGenerated || 0) + totalInsights,
  };

  await ctx.db.patch(agentId, {
    status: "active",
    lastSuccess: new Date().toISOString(),
    runCount: (agent.runCount || 0) + 1,
    metrics: newMetrics,
  });
}

async function handleAgentError(ctx: any, agentId: Id<"agents">, error: any): Promise<void> {
  await ctx.db.insert("agentLogs", {
    agentId,
    level: "error",
    message: "Analytics agent failed",
    data: { error: error instanceof Error ? error.message : String(error) },
    timestamp: new Date().toISOString(),
    category: "agent_execution",
  });

  const agent = await ctx.db.get(agentId);
  if (agent) {
    const existingMetrics = (agent.metrics as AnalyticsAgentMetrics) || {
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
// QUERY FUNCTIONS
// ============================================================================

export const getAnalyticsReport = internalQuery({
  args: {
    reportType: v.union(
      v.literal("executive"),
      v.literal("financial"),
      v.literal("vendor"),
      v.literal("operational"),
      v.literal("compliance")
    ),
    timeRange: v.optional(v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("yearly")
    )),
  },
  handler: async (ctx, args) => {
    const timeRange = args.timeRange || "monthly";
    const daysMap = {
      daily: 1,
      weekly: 7,
      monthly: 30,
      quarterly: 90,
      yearly: 365,
    };
    
    const since = new Date(Date.now() - daysMap[timeRange] * 24 * 60 * 60 * 1000);
    
    // Get latest report of the specified type
    const reports = await ctx.db
      .query("agentInsights")
      .filter((q: any) => 
        q.and(
          q.eq(q.field("type"), "report"),
          q.gte(q.field("createdAt"), since.toISOString())
        )
      )
      .order("desc")
      .collect();
    
    // Filter by report type based on title
    const reportTypeMap = {
      executive: "Executive",
      financial: "Financial",
      vendor: "Vendor",
      operational: "Operational",
      compliance: "Compliance",
    };
    
    const filteredReports = reports.filter(r => 
      r.title.toLowerCase().includes(reportTypeMap[args.reportType].toLowerCase())
    );
    
    return filteredReports[0] || null;
  },
});

export const getKPIs = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Get the latest KPI insight
    const kpiInsight = await ctx.db
      .query("agentInsights")
      .filter((q: any) => 
        q.and(
          q.eq(q.field("type"), "report"),
          q.eq(q.field("title"), "Key Performance Indicators Update")
        )
      )
      .order("desc")
      .first();
    
    return kpiInsight?.data?.kpis || null;
  },
});

export const getTrends = internalQuery({
  args: {
    trendType: v.optional(v.union(
      v.literal("contract_volume"),
      v.literal("spending"),
      v.literal("vendor_activity"),
      v.literal("risk")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("agentInsights")
      .filter((q: any) => q.eq(q.field("type"), "trend_analysis"));
    
    const insights = await query
      .order("desc")
      .take(args.limit || 10);
    
    if (args.trendType) {
      return insights.filter(i => 
        i.title.toLowerCase().includes((args.trendType!).replace("_", " "))
      );
    }
    
    return insights;
  },
});

export const getAnomalies = internalQuery({
  args: {
    status: v.optional(v.union(
      v.literal("unresolved"),
      v.literal("resolved"),
      v.literal("all")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let insights = await ctx.db
      .query("agentInsights")
      .filter((q: any) => q.eq(q.field("type"), "anomaly_detection"))
      .order("desc")
      .take(args.limit || 20);
    
    if (args.status === "unresolved") {
      insights = insights.filter(i => !i.actionTaken && i.actionRequired);
    } else if (args.status === "resolved") {
      insights = insights.filter(i => i.actionTaken);
    }
    
    return insights;
  },
});

export const getFinancialMetrics = internalQuery({
  args: {
    timeRange: v.optional(v.union(
      v.literal("30days"),
      v.literal("90days"),
      v.literal("1year")
    )),
  },
  handler: async (ctx, args) => {
    const contracts = await ctx.db
      .query("contracts")
      .collect();
    
    const timeRange = args.timeRange || "30days";
    const daysMap = { "30days": 30, "90days": 90, "1year": 365 };
    const since = new Date(Date.now() - daysMap[timeRange] * 24 * 60 * 60 * 1000);
    
    const periodContracts = contracts.filter(c => 
      c._creationTime && c._creationTime >= since.getTime()
    );
    
    const activeContracts = contracts.filter(c => c.status === "active");
    
    const metrics = {
      totalContractValue: activeContracts.reduce((sum, c) => 
        sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
      ),
      periodSpend: periodContracts.reduce((sum, c) => 
        sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
      ),
      averageContractValue: 0,
      monthlyBurn: calculateMonthlyBurn(activeContracts),
      contractCount: {
        total: contracts.length,
        active: activeContracts.length,
        period: periodContracts.length,
      },
    };
    
    metrics.averageContractValue = activeContracts.length > 0 
      ? metrics.totalContractValue / activeContracts.length 
      : 0;
    
    return metrics;
  },
});

// ============================================================================
// TRACKING HELPER FUNCTIONS
// ============================================================================

// Count pending contract approvals
async function countPendingApprovals(ctx: any, contracts: any[]): Promise<number> {
  const contractIds = contracts.map(c => c._id);
  
  const pendingApprovals = await ctx.db
    .query("contractApprovals")
    .filter((q: any) => 
      q.and(
        q.eq(q.field("status"), "pending"),
        q.or(...contractIds.map(id => q.eq(q.field("contractId"), id)))
      )
    )
    .collect();
  
  return pendingApprovals.length;
}

// Count compliance issues across contracts
async function countComplianceIssues(ctx: any, contracts: any[]): Promise<number> {
  const contractIds = contracts.map(c => c._id);
  let totalIssues = 0;
  
  // Get compliance checks for all contracts
  const complianceChecks = await ctx.db
    .query("complianceChecks")
    .filter((q: any) => 
      q.and(
        q.or(
          q.eq(q.field("status"), "non_compliant"),
          q.eq(q.field("status"), "remediation_required")
        ),
        q.or(...contractIds.map(id => q.eq(q.field("contractId"), id)))
      )
    )
    .collect();
  
  // Count total unresolved issues
  complianceChecks.forEach(check => {
    if (check.issues) {
      totalIssues += check.issues.filter((issue: any) => 
        !issue.resolvedAt && (issue.severity === "critical" || issue.severity === "high")
      ).length;
    }
  });
  
  return totalIssues;
}

// Count budget alerts for the enterprise
async function countBudgetAlerts(ctx: any, enterpriseId: Id<"enterprises"> | undefined): Promise<number> {
  if (!enterpriseId) return 0;
  
  const budgets = await ctx.db
    .query("budgets")
    .withIndex("by_enterprise", (q: any) => q.eq("enterpriseId", enterpriseId))
    .filter((q: any) => 
      q.or(
        q.eq(q.field("status"), "exceeded"),
        q.eq(q.field("status"), "at_risk")
      )
    )
    .collect();
  
  let totalAlerts = 0;
  
  // Count unacknowledged alerts
  budgets.forEach(budget => {
    if (budget.alerts) {
      totalAlerts += budget.alerts.filter((alert: any) => !alert.acknowledged).length;
    }
  });
  
  return totalAlerts;
}