// convex/agents/analytics.ts
// import { internalMutation, internalQuery } from "../_generated/server";
// import { v } from "convex/values";
// import { Id } from "../_generated/dataModel";

// /**
//  * Analytics Agent
//  * 
//  * Responsibilities:
//  * - Generate comprehensive analytics reports
//  * - Track KPIs and business metrics
//  * - Identify trends and patterns in contract data
//  * - Monitor vendor performance and relationships
//  * - Calculate financial metrics and projections
//  * - Detect anomalies and opportunities
//  * - Generate executive dashboards
//  * - Provide predictive analytics
//  */

// // ============================================================================
// // CONFIGURATION
// // ============================================================================

// const ANALYTICS_CONFIG = {
//   // Processing settings
//   checkIntervalMinutes: 60, // Run hourly
//   batchSize: 50,
//   analysisTimeoutMinutes: 30,
  
//   // Time periods for analysis
//   timePeriods: {
//     daily: 1,
//     weekly: 7,
//     monthly: 30,
//     quarterly: 90,
//     yearly: 365,
//   },
  
//   // KPI thresholds
//   kpiThresholds: {
//     contractRenewalRate: 0.80, // 80% target
//     vendorSatisfaction: 0.85,
//     costSavingsTarget: 0.10, // 10% annual savings
//     complianceRate: 0.95,
//     contractCycleTime: 14, // days
//     approvalTime: 3, // days
//   },
  
//   // Analytics categories
//   categories: {
//     contract: ["volume", "value", "types", "status", "lifecycle"],
//     vendor: ["performance", "spend", "risk", "concentration"],
//     financial: ["spend", "savings", "roi", "budget", "forecast"],
//     compliance: ["adherence", "violations", "audits", "certifications"],
//     operational: ["efficiency", "bottlenecks", "automation", "workload"],
//   },
  
//   // Insight generation rules
//   insightRules: {
//     spendIncreaseThreshold: 0.20, // 20% increase triggers alert
//     vendorConcentrationLimit: 0.30, // 30% of spend with one vendor
//     contractExpiryWarningDays: 90,
//     unusualActivityStdDev: 2.5,
//     trendsMinDataPoints: 5,
//   },
  
//   // Report templates
//   reportTemplates: {
//     executive: ["overview", "kpis", "risks", "opportunities", "forecast"],
//     operational: ["workload", "bottlenecks", "efficiency", "team_performance"],
//     financial: ["spend_analysis", "savings", "budget_variance", "forecast"],
//     vendor: ["performance", "risk", "spend_distribution", "compliance"],
//     compliance: ["adherence", "violations", "upcoming_audits", "certifications"],
//   },
// };

// // Extended metrics for analytics agent
// interface AnalyticsAgentMetrics {
//   totalRuns: number;
//   successfulRuns: number;
//   failedRuns: number;
//   averageRunTime: number;
//   lastRunDuration?: number;
//   dataProcessed?: number;
//   insightsGenerated?: number;
//   // Analytics-specific metrics
//   reportsGenerated?: number;
//   kpisCalculated?: number;
//   trendsIdentified?: number;
//   anomaliesDetected?: number;
//   forecastsCreated?: number;
//   dataPointsAnalyzed?: number;
// }

// // ============================================================================
// // MAIN EXECUTION
// // ============================================================================

// export const run = internalMutation({
//   args: {
//     agentId: v.id("agents"),
//   },
//   handler: async (ctx, args) => {
//     const startTime = Date.now();
    
//     try {
//       await ctx.db.insert("agentLogs", {
//         agentId: args.agentId,
//         level: "info",
//         message: "Analytics agent starting run",
//         timestamp: new Date().toISOString(),
//         category: "agent_execution",
//       });

//       await ctx.db.patch(args.agentId, {
//         status: "busy",
//         lastRun: new Date().toISOString(),
//       });

//       // Calculate KPIs
//       const kpisCalculated = await calculateKPIs(ctx, args.agentId);
      
//       // Analyze contract metrics
//       const contractInsights = await analyzeContractMetrics(ctx, args.agentId);
      
//       // Analyze vendor performance
//       const vendorInsights = await analyzeVendorPerformance(ctx, args.agentId);
      
//       // Analyze financial trends
//       const financialInsights = await analyzeFinancialTrends(ctx, args.agentId);
      
//       // Detect anomalies
//       const anomaliesDetected = await detectAnomalies(ctx, args.agentId);
      
//       // Generate predictive analytics
//       const forecastsCreated = await generatePredictiveAnalytics(ctx, args.agentId);
      
//       // Create executive dashboard data
//       await createExecutiveDashboard(ctx, args.agentId);
      
//       // Generate automated reports
//       const reportsGenerated = await generateAutomatedReports(ctx, args.agentId);

//       // Update metrics
//       await updateAgentMetrics(ctx, args.agentId, {
//         runTime: Date.now() - startTime,
//         kpisCalculated,
//         contractInsights,
//         vendorInsights,
//         financialInsights,
//         anomaliesDetected,
//         forecastsCreated,
//         reportsGenerated,
//       });

//       return { 
//         success: true, 
//         kpisCalculated,
//         totalInsights: contractInsights + vendorInsights + financialInsights + anomaliesDetected,
//         reportsGenerated,
//       };

//     } catch (error) {
//       await handleAgentError(ctx, args.agentId, error);
//       throw error;
//     }
//   },
// });

// // ============================================================================
// // CORE FUNCTIONS
// // ============================================================================

// async function calculateKPIs(
//   ctx: any,
//   agentId: Id<"agents">
// ): Promise<number> {
//   const kpis: Record<string, any> = {};
//   const now = new Date();
//   const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  
//   // Get all contracts for analysis
//   const contracts = await ctx.db
//     .query("contracts")
//     .collect();
    
//   const activeContracts = contracts.filter(c => c.status === "active");
//   const expiredLastYear = contracts.filter(c => 
//     c.status === "expired" && 
//     c._creationTime && 
//     c._creationTime > oneYearAgo.getTime()
//   );

//   // 1. Contract Renewal Rate
//   const renewalEligible = expiredLastYear.length;
//   const renewed = contracts.filter(c => 
//     c.metadata?.renewedFrom && 
//     c._creationTime && 
//     c._creationTime > oneYearAgo.getTime()
//   ).length;
//   kpis.contractRenewalRate = renewalEligible > 0 ? renewed / renewalEligible : 0;

//   // 2. Contract Cycle Time (from creation to active)
//   const recentActiveContracts = activeContracts.filter(c => 
//     c._creationTime && c._creationTime > oneYearAgo.getTime()
//   );
  
//   let totalCycleTime = 0;
//   let cycleTimeCount = 0;
  
//   for (const contract of recentActiveContracts) {
//     if (contract._creationTime && contract.analysisStatus === "completed") {
//       // Estimate cycle time (in practice, you'd track actual status changes)
//       const cycleTime = 7; // Placeholder - would calculate from status change logs
//       totalCycleTime += cycleTime;
//       cycleTimeCount++;
//     }
//   }
  
//   kpis.averageContractCycleTime = cycleTimeCount > 0 ? totalCycleTime / cycleTimeCount : 0;

//   // 3. Vendor Concentration
//   const vendorSpend: Record<string, number> = {};
//   let totalSpend = 0;
  
//   for (const contract of activeContracts) {
//     const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
//     if (value > 0) {
//       const vendorId = contract.vendorId.toString();
//       vendorSpend[vendorId] = (vendorSpend[vendorId] || 0) + value;
//       totalSpend += value;
//     }
//   }
  
//   const topVendorSpend = Math.max(...Object.values(vendorSpend), 0);
//   kpis.vendorConcentrationRisk = totalSpend > 0 ? topVendorSpend / totalSpend : 0;

//   // 4. Contract Compliance Rate
//   const compliantContracts = activeContracts.filter(c => 
//     c.analysisStatus === "completed" && !c.analysisError
//   ).length;
//   kpis.contractComplianceRate = activeContracts.length > 0 
//     ? compliantContracts / activeContracts.length 
//     : 1;

//   // 5. Cost Savings
//   // Calculate based on renegotiated contracts or identified savings opportunities
//   const savingsInsights = await ctx.db
//     .query("agentInsights")
//     .filter((q: any) => 
//       q.and(
//         q.eq(q.field("type"), "cost_optimization"),
//         q.gte(q.field("createdAt"), oneYearAgo.toISOString())
//       )
//     )
//     .collect();
  
//   const totalSavings = savingsInsights.reduce((sum, insight) => 
//     sum + (insight.data?.potentialSavings || 0), 0
//   );
//   kpis.identifiedSavings = totalSavings;
//   kpis.savingsRate = totalSpend > 0 ? totalSavings / totalSpend : 0;

//   // 6. Active Contract Value
//   kpis.totalActiveContractValue = activeContracts.reduce((sum, c) => 
//     sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
//   );
  
//   // 7. Contract Distribution
//   kpis.contractsByType = activeContracts.reduce((acc, c) => {
//     const type = c.contractType || "other";
//     acc[type] = (acc[type] || 0) + 1;
//     return acc;
//   }, {} as Record<string, number>);

//   // Store KPIs
//   await ctx.db.insert("agentInsights", {
//     agentId,
//     type: "report",
//     title: "Key Performance Indicators Update",
//     description: "Latest KPI calculations for contract management",
//     priority: "low",
//     actionRequired: false,
//     actionTaken: false,
//     isRead: false,
//     createdAt: new Date().toISOString(),
//     data: {
//       kpis,
//       calculatedAt: new Date().toISOString(),
//       period: "last_365_days",
//     },
//   });

//   // Check for KPI threshold violations
//   let alertsCreated = 0;
  
//   if (kpis.contractRenewalRate < ANALYTICS_CONFIG.kpiThresholds.contractRenewalRate) {
//     alertsCreated++;
//     await ctx.db.insert("agentInsights", {
//       agentId,
//       type: "alert",
//       title: "Low Contract Renewal Rate",
//       description: `Contract renewal rate (${(kpis.contractRenewalRate * 100).toFixed(1)}%) is below target (${(ANALYTICS_CONFIG.kpiThresholds.contractRenewalRate * 100)}%)`,
//       priority: "high",
//       actionRequired: true,
//       actionTaken: false,
//       isRead: false,
//       createdAt: new Date().toISOString(),
//       data: {
//         currentRate: kpis.contractRenewalRate,
//         targetRate: ANALYTICS_CONFIG.kpiThresholds.contractRenewalRate,
//         gap: ANALYTICS_CONFIG.kpiThresholds.contractRenewalRate - kpis.contractRenewalRate,
//       },
//     });
//   }

//   if (kpis.vendorConcentrationRisk > ANALYTICS_CONFIG.insightRules.vendorConcentrationLimit) {
//     alertsCreated++;
//     await ctx.db.insert("agentInsights", {
//       agentId,
//       type: "vendor_risk",
//       title: "High Vendor Concentration Risk",
//       description: `${(kpis.vendorConcentrationRisk * 100).toFixed(1)}% of spend is concentrated with a single vendor`,
//       priority: "high",
//       actionRequired: true,
//       actionTaken: false,
//       isRead: false,
//       createdAt: new Date().toISOString(),
//       data: {
//         concentrationRate: kpis.vendorConcentrationRisk,
//         threshold: ANALYTICS_CONFIG.insightRules.vendorConcentrationLimit,
//       },
//     });
//   }

//   return Object.keys(kpis).length + alertsCreated;
// }

// async function analyzeContractMetrics(
//   ctx: any,
//   agentId: Id<"agents">
// ): Promise<number> {
//   let insightsCreated = 0;
  
//   // Get contracts grouped by time periods
//   const contracts = await ctx.db
//     .query("contracts")
//     .collect();
  
//   // Analyze contract volume trends
//   const volumeTrends = analyzeVolumeTrends(contracts);
  
//   if (volumeTrends.trend !== "stable") {
//     insightsCreated++;
//     await ctx.db.insert("agentInsights", {
//       agentId,
//       type: "trend_analysis",
//       title: `Contract Volume ${volumeTrends.trend === "increasing" ? "Increasing" : "Decreasing"}`,
//       description: `Contract creation volume has ${volumeTrends.trend === "increasing" ? "increased" : "decreased"} by ${(volumeTrends.changeRate * 100).toFixed(1)}% over the last quarter`,
//       priority: "medium",
//       actionRequired: false,
//       actionTaken: false,
//       isRead: false,
//       createdAt: new Date().toISOString(),
//       data: volumeTrends,
//     });
//   }

//   // Analyze contract value distribution
//   const valueDistribution = analyzeValueDistribution(contracts);
  
//   if (valueDistribution.skewness > 2) {
//     insightsCreated++;
//     await ctx.db.insert("agentInsights", {
//       agentId,
//       type: "anomaly_detection",
//       title: "Uneven Contract Value Distribution",
//       description: `Contract values are heavily skewed - ${valueDistribution.top20PercentValue}% of value comes from top 20% of contracts`,
//       priority: "medium",
//       actionRequired: true,
//       actionTaken: false,
//       isRead: false,
//       createdAt: new Date().toISOString(),
//       data: valueDistribution,
//     });
//   }

//   // Analyze contract lifecycle
//   const lifecycleMetrics = await analyzeContractLifecycle(ctx, contracts);
  
//   if (lifecycleMetrics.averageTimeToExpiry < 90) {
//     insightsCreated++;
//     await ctx.db.insert("agentInsights", {
//       agentId,
//       type: "alert",
//       title: "Multiple Contracts Expiring Soon",
//       description: `${lifecycleMetrics.expiringIn90Days} contracts are expiring within 90 days, representing ${formatCurrency(lifecycleMetrics.expiringValue)} in value`,
//       priority: "high",
//       actionRequired: true,
//       actionTaken: false,
//       isRead: false,
//       createdAt: new Date().toISOString(),
//       data: lifecycleMetrics,
//     });
//   }

//   return insightsCreated;
// }

// async function analyzeVendorPerformance(
//   ctx: any,
//   agentId: Id<"agents">
// ): Promise<number> {
//   let insightsCreated = 0;
  
//   const vendors = await ctx.db
//     .query("vendors")
//     .collect();
    
//   const contracts = await ctx.db
//     .query("contracts")
//     .collect();

//   // Calculate vendor performance metrics
//   const vendorMetrics = new Map<string, any>();
  
//   for (const vendor of vendors) {
//     const vendorContracts = contracts.filter(c => c.vendorId === vendor._id);
    
//     if (vendorContracts.length === 0) continue;
    
//     const metrics = {
//       vendorId: vendor._id,
//       vendorName: vendor.name,
//       contractCount: vendorContracts.length,
//       activeContracts: vendorContracts.filter(c => c.status === "active").length,
//       totalValue: vendorContracts.reduce((sum, c) => 
//         sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
//       ),
//       averageContractValue: 0,
//       onTimeRenewalRate: 0, // Would need actual renewal tracking
//       complianceScore: 0, // Would need compliance tracking
//       riskScore: 0, // Would need risk assessment data
//     };
    
//     metrics.averageContractValue = metrics.contractCount > 0 
//       ? metrics.totalValue / metrics.contractCount 
//       : 0;
    
//     // Simple risk scoring based on concentration
//     if (metrics.totalValue > 1000000) {
//       metrics.riskScore += 20;
//     }
//     if (metrics.activeContracts > 5) {
//       metrics.riskScore += 10;
//     }
    
//     vendorMetrics.set(vendor._id.toString(), metrics);
//   }

//   // Identify top performers and risks
//   const sortedByValue = Array.from(vendorMetrics.values())
//     .sort((a, b) => b.totalValue - a.totalValue);
  
//   const top5Vendors = sortedByValue.slice(0, 5);
//   const totalValue = sortedByValue.reduce((sum, v) => sum + v.totalValue, 0);
  
//   // Create vendor performance insight
//   insightsCreated++;
//   await ctx.db.insert("agentInsights", {
//     agentId,
//     type: "report",
//     title: "Top Vendor Performance Analysis",
//     description: `Analysis of top ${top5Vendors.length} vendors representing ${((top5Vendors.reduce((sum, v) => sum + v.totalValue, 0) / totalValue) * 100).toFixed(1)}% of total spend`,
//     priority: "low",
//     actionRequired: false,
//     actionTaken: false,
//     isRead: false,
//     createdAt: new Date().toISOString(),
//     data: {
//       topVendors: top5Vendors,
//       totalVendors: vendors.length,
//       totalValue,
//       metrics: Array.from(vendorMetrics.values()),
//     },
//   });

//   // Check for vendor risks
//   const highRiskVendors = Array.from(vendorMetrics.values())
//     .filter(v => v.riskScore > 25);
  
//   if (highRiskVendors.length > 0) {
//     insightsCreated++;
//     await ctx.db.insert("agentInsights", {
//       agentId,
//       type: "vendor_risk",
//       title: "High Risk Vendor Relationships Identified",
//       description: `${highRiskVendors.length} vendor(s) have elevated risk scores due to high concentration or value`,
//       priority: "high",
//       actionRequired: true,
//       actionTaken: false,
//       isRead: false,
//       createdAt: new Date().toISOString(),
//       data: {
//         highRiskVendors,
//         totalAtRisk: highRiskVendors.reduce((sum, v) => sum + v.totalValue, 0),
//       },
//     });
//   }

//   return insightsCreated;
// }

// async function analyzeFinancialTrends(
//   ctx: any,
//   agentId: Id<"agents">
// ): Promise<number> {
//   let insightsCreated = 0;
  
//   const contracts = await ctx.db
//     .query("contracts")
//     .collect();
  
//   // Group spending by month
//   const monthlySpend = calculateMonthlySpend(contracts);
//   const quarters = groupByQuarter(monthlySpend);
  
//   // Calculate year-over-year growth
//   const yoyGrowth = calculateYoYGrowth(monthlySpend);
  
//   if (Math.abs(yoyGrowth) > ANALYTICS_CONFIG.insightRules.spendIncreaseThreshold) {
//     insightsCreated++;
//     const isIncrease = yoyGrowth > 0;
//     await ctx.db.insert("agentInsights", {
//       agentId,
//       type: "financial_risk",
//       title: `Significant Spend ${isIncrease ? "Increase" : "Decrease"} Detected`,
//       description: `Contract spending has ${isIncrease ? "increased" : "decreased"} by ${(Math.abs(yoyGrowth) * 100).toFixed(1)}% year-over-year`,
//       priority: isIncrease ? "high" : "medium",
//       actionRequired: true,
//       actionTaken: false,
//       isRead: false,
//       createdAt: new Date().toISOString(),
//       data: {
//         yoyGrowth,
//         monthlyTrend: monthlySpend,
//         quarterlyTrend: quarters,
//       },
//     });
//   }

//   // Analyze spending patterns
//   const spendingPatterns = analyzeSpendingPatterns(contracts);
  
//   if (spendingPatterns.seasonality.isSeaonal) {
//     insightsCreated++;
//     await ctx.db.insert("agentInsights", {
//       agentId,
//       type: "trend_analysis",
//       title: "Seasonal Spending Pattern Detected",
//       description: `Contract spending shows seasonal patterns with peak in ${spendingPatterns.seasonality.peakMonth}`,
//       priority: "low",
//       actionRequired: false,
//       actionTaken: false,
//       isRead: false,
//       createdAt: new Date().toISOString(),
//       data: spendingPatterns,
//     });
//   }

//   // Budget variance analysis
//   const budgetVariance = await analyzeBudgetVariance(ctx, contracts);
  
//   if (budgetVariance && Math.abs(budgetVariance.variancePercent) > 10) {
//     insightsCreated++;
//     const isOver = budgetVariance.variancePercent > 0;
//     await ctx.db.insert("agentInsights", {
//       agentId,
//       type: "financial_risk",
//       title: `Budget ${isOver ? "Overrun" : "Underutilization"} Alert`,
//       description: `Current spending is ${Math.abs(budgetVariance.variancePercent).toFixed(1)}% ${isOver ? "over" : "under"} budget`,
//       priority: isOver ? "high" : "medium",
//       actionRequired: true,
//       actionTaken: false,
//       isRead: false,
//       createdAt: new Date().toISOString(),
//       data: budgetVariance,
//     });
//   }

//   return insightsCreated;
// }

// async function detectAnomalies(
//   ctx: any,
//   agentId: Id<"agents">
// ): Promise<number> {
//   let anomaliesDetected = 0;
  
//   const contracts = await ctx.db
//     .query("contracts")
//     .collect();
  
//   // Detect pricing anomalies
//   const pricingAnomalies = detectPricingAnomalies(contracts);
  
//   for (const anomaly of pricingAnomalies) {
//     anomaliesDetected++;
//     await ctx.db.insert("agentInsights", {
//       agentId,
//       type: "anomaly_detection",
//       title: `Unusual Pricing Detected: ${anomaly.contractTitle}`,
//       description: `Contract value (${formatCurrency(anomaly.value)}) is ${anomaly.standardDeviations.toFixed(1)} standard deviations from the mean for ${anomaly.contractType} contracts`,
//       priority: "medium",
//       contractId: anomaly.contractId,
//       vendorId: anomaly.vendorId,
//       actionRequired: true,
//       actionTaken: false,
//       isRead: false,
//       createdAt: new Date().toISOString(),
//       data: anomaly,
//     });
//   }

//   // Detect unusual vendor activity
//   const vendorActivityAnomalies = await detectVendorActivityAnomalies(ctx);
  
//   for (const anomaly of vendorActivityAnomalies) {
//     anomaliesDetected++;
//     await ctx.db.insert("agentInsights", {
//       agentId,
//       type: "anomaly_detection",
//       title: "Unusual Vendor Activity Pattern",
//       description: anomaly.description,
//       priority: "medium",
//       vendorId: anomaly.vendorId,
//       actionRequired: true,
//       actionTaken: false,
//       isRead: false,
//       createdAt: new Date().toISOString(),
//       data: anomaly,
//     });
//   }

//   // Detect contract term anomalies
//   const termAnomalies = detectContractTermAnomalies(contracts);
  
//   for (const anomaly of termAnomalies) {
//     anomaliesDetected++;
//     await ctx.db.insert("agentInsights", {
//       agentId,
//       type: "anomaly_detection",
//       title: "Unusual Contract Terms",
//       description: anomaly.description,
//       priority: "high",
//       contractId: anomaly.contractId,
//       actionRequired: true,
//       actionTaken: false,
//       isRead: false,
//       createdAt: new Date().toISOString(),
//       data: anomaly,
//     });
//   }

//   return anomaliesDetected;
// }

// async function generatePredictiveAnalytics(
//   ctx: any,
//   agentId: Id<"agents">
// ): Promise<number> {
//   let forecastsCreated = 0;
  
//   const contracts = await ctx.db
//     .query("contracts")
//     .collect();
  
//   // Forecast contract volume
//   const volumeForecast = forecastContractVolume(contracts);
  
//   forecastsCreated++;
//   await ctx.db.insert("agentInsights", {
//     agentId,
//     type: "trend_analysis",
//     title: "Contract Volume Forecast",
//     description: `Projected ${volumeForecast.nextQuarter} new contracts in the next quarter based on historical trends`,
//     priority: "low",
//     actionRequired: false,
//     actionTaken: false,
//     isRead: false,
//     createdAt: new Date().toISOString(),
//     data: volumeForecast,
//   });

//   // Forecast spending
//   const spendForecast = forecastSpending(contracts);
  
//   forecastsCreated++;
//   await ctx.db.insert("agentInsights", {
//     agentId,
//     type: "trend_analysis",
//     title: "Spending Forecast",
//     description: `Projected spending of ${formatCurrency(spendForecast.nextQuarterSpend)} in the next quarter (${spendForecast.confidence}% confidence)`,
//     priority: "medium",
//     actionRequired: false,
//     actionTaken: false,
//     isRead: false,
//     createdAt: new Date().toISOString(),
//     data: spendForecast,
//   });

//   // Predict renewal opportunities
//   const renewalOpportunities = await predictRenewalOpportunities(ctx, contracts);
  
//   if (renewalOpportunities.highValueRenewals.length > 0) {
//     forecastsCreated++;
//     await ctx.db.insert("agentInsights", {
//       agentId,
//       type: "renewal_opportunity",
//       title: "High-Value Renewal Opportunities",
//       description: `${renewalOpportunities.highValueRenewals.length} high-value contracts worth ${formatCurrency(renewalOpportunities.totalValue)} are up for renewal`,
//       priority: "high",
//       actionRequired: true,
//       actionTaken: false,
//       isRead: false,
//       createdAt: new Date().toISOString(),
//       data: renewalOpportunities,
//     });
//   }

//   // Predict risk events
//   const riskPredictions = predictRiskEvents(contracts);
  
//   if (riskPredictions.highRiskContracts.length > 0) {
//     forecastsCreated++;
//     await ctx.db.insert("agentInsights", {
//       agentId,
//       type: "financial_risk",
//       title: "Predicted Contract Risks",
//       description: `${riskPredictions.highRiskContracts.length} contracts show indicators of potential issues`,
//       priority: "high",
//       actionRequired: true,
//       actionTaken: false,
//       isRead: false,
//       createdAt: new Date().toISOString(),
//       data: riskPredictions,
//     });
//   }

//   return forecastsCreated;
// }

// async function createExecutiveDashboard(
//   ctx: any,
//   agentId: Id<"agents">
// ): Promise<void> {
//   const contracts = await ctx.db
//     .query("contracts")
//     .collect();
    
//   const vendors = await ctx.db
//     .query("vendors")
//     .collect();

//   const dashboard = {
//     overview: {
//       totalContracts: contracts.length,
//       activeContracts: contracts.filter(c => c.status === "active").length,
//       totalVendors: vendors.length,
//       activeVendors: vendors.filter(v => 
//         contracts.some(c => c.vendorId === v._id && c.status === "active")
//       ).length,
//     },
//     financial: {
//       totalContractValue: contracts.reduce((sum, c) => 
//         sum + parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0'), 0
//       ),
//       monthlyBurn: 0, // Would calculate from payment schedules
//       annualProjection: 0, // Would calculate from active contracts
//     },
//     kpis: {
//       contractRenewalRate: 0, // Would fetch from latest KPI calculation
//       vendorSatisfaction: 0,
//       complianceRate: 0,
//       avgContractCycleTime: 0,
//     },
//     alerts: {
//       expiringContracts: contracts.filter(c => {
//         if (!c.extractedEndDate) return false;
//         const daysUntil = Math.ceil(
//           (new Date(c.extractedEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
//         );
//         return daysUntil <= 90 && daysUntil > 0;
//       }).length,
//       pendingApprovals: 0, // Would need approval tracking
//       complianceIssues: 0, // Would need compliance tracking
//       budgetAlerts: 0, // Would need budget tracking
//     },
//     trends: {
//       contractVolumeChange: 0, // Month-over-month
//       spendingChange: 0, // Month-over-month
//       vendorCountChange: 0, // Month-over