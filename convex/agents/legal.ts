// convex/agents/legal.ts
import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * Legal Agent
 * 
 * Responsibilities:
 * - Analyze contracts for legal compliance and risks
 * - Review contract terms and clauses for legal issues
 * - Monitor regulatory compliance requirements
 * - Identify missing or problematic legal provisions
 * - Track contract modifications and amendments
 * - Generate legal risk assessments and recommendations
 * - Monitor legal deadlines and obligations
 * - Ensure adherence to corporate legal policies
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const LEGAL_CONFIG = {
  // Processing settings
  checkIntervalMinutes: 10,
  batchSize: 8,
  analysisTimeoutMinutes: 15,
  
  // Legal review thresholds
  thresholds: {
    highRiskValue: 50000,
    criticalReviewValue: 250000,
    longTermMonths: 24,
    highLiabilityAmount: 100000,
  },
  
  // Risk scoring weights
  riskWeights: {
    contractType: 0.25,
    liability: 0.30,
    termination: 0.20,
    compliance: 0.15,
    intellectual_property: 0.10,
  },
  
  // Required clauses by contract type
  requiredClauses: {
    saas: [
      "data_protection", "service_level", "limitation_of_liability",
      "termination", "intellectual_property", "compliance"
    ],
    nda: [
      "confidentiality", "return_of_information", "term_duration",
      "remedies", "governing_law"
    ],
    employment: [
      "compensation", "termination", "confidentiality", 
      "non_compete", "intellectual_property", "benefits"
    ],
    partnership: [
      "profit_sharing", "decision_making", "termination",
      "liability", "intellectual_property", "dispute_resolution"
    ],
    msa: [
      "scope_of_work", "payment_terms", "intellectual_property",
      "limitation_of_liability", "termination", "confidentiality"
    ],
  },
  
  // Compliance frameworks to check
  complianceFrameworks: [
    "gdpr", "ccpa", "hipaa", "sox", "pci_dss", "iso27001"
  ],
  
  // High-risk terms that require attention
  highRiskTerms: [
    "unlimited liability", "perpetual", "non-cancelable",
    "automatic renewal", "indemnification", "liquidated damages",
    "specific performance", "injunctive relief"
  ],
  
  // Legal deadline types
  deadlineTypes: {
    renewal_notice: 30, // days before expiration
    termination_notice: 60,
    compliance_review: 90,
    legal_review: 180,
  },
};

// Extended metrics for legal agent
interface LegalAgentMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageRunTime: number;
  lastRunDuration?: number;
  dataProcessed?: number;
  insightsGenerated?: number;
  // Legal-specific metrics
  contractsReviewed?: number;
  legalRisksIdentified?: number;
  complianceIssuesFound?: number;
  clausesAnalyzed?: number;
  deadlinesTracked?: number;
  amendmentsProcessed?: number;
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
        message: "Legal agent starting run",
        timestamp: new Date().toISOString(),
        category: "agent_execution",
      });

      await ctx.db.patch(args.agentId, {
        status: "busy",
        lastRun: new Date().toISOString(),
      });

      // Process assigned legal review tasks
      const tasksProcessed = await processLegalTasks(ctx, args.agentId);
      
      // Review contracts for legal compliance
      const complianceReviews = await reviewContractCompliance(ctx, args.agentId);
      
      // Analyze contract clauses and terms
      const clauseAnalysis = await analyzeContractClauses(ctx, args.agentId);
      
      // Monitor legal deadlines
      const deadlineAlerts = await monitorLegalDeadlines(ctx, args.agentId);
      
      // Check for regulatory compliance
      const regulatoryChecks = await checkRegulatoryCompliance(ctx, args.agentId);
      
      // Identify high-risk contract terms
      const riskTermsFound = await identifyHighRiskTerms(ctx, args.agentId);
      
      // Generate legal trend analysis
      await generateLegalTrendAnalysis(ctx, args.agentId);

      // Update metrics
      await updateAgentMetrics(ctx, args.agentId, {
        runTime: Date.now() - startTime,
        tasksProcessed,
        complianceReviews,
        clauseAnalysis,
        deadlineAlerts,
        regulatoryChecks,
        riskTermsFound,
      });

      return { 
        success: true, 
        tasksProcessed,
        totalInsights: complianceReviews + clauseAnalysis + deadlineAlerts + regulatoryChecks + riskTermsFound,
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

async function processLegalTasks(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  const tasks = await ctx.db
    .query("agentTasks")
    .withIndex("by_assigned_agent", (q: any) => q.eq("assignedAgentId", agentId))
    .filter((q: any) => q.eq(q.field("status"), "pending"))
    .take(LEGAL_CONFIG.batchSize);

  let processed = 0;

  for (const task of tasks) {
    try {
      await ctx.db.patch(task._id, {
        status: "in_progress",
        startedAt: new Date().toISOString(),
      });

      let result;
      switch (task.taskType) {
        case "legal_review":
          result = await performLegalReview(ctx, agentId, task);
          break;
        case "compliance_check":
          result = await performComplianceCheck(ctx, agentId, task);
          break;
        case "clause_analysis":
          result = await analyzeSpecificClauses(ctx, agentId, task);
          break;
        case "risk_assessment":
          result = await assessLegalRisk(ctx, agentId, task);
          break;
        case "amendment_review":
          result = await reviewAmendment(ctx, agentId, task);
          break;
        default:
          throw new Error(`Unknown legal task type: ${task.taskType}`);
      }

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
        message: `Failed to process legal task ${task._id}`,
        data: { taskId: task._id, error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date().toISOString(),
        category: "task_processing",
      });
    }
  }

  return processed;
}

async function reviewContractCompliance(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  let reviewsCreated = 0;

  // Get contracts needing legal review
  const contractsToReview = await ctx.db
    .query("contracts")
    .withIndex("by_status_and_enterpriseId")
    .filter((q: any) => 
      q.and(
        q.eq(q.field("status"), "active"),
        q.or(
          q.eq(q.field("analysisStatus"), "completed"),
          q.eq(q.field("analysisStatus"), undefined)
        )
      )
    )
    .take(LEGAL_CONFIG.batchSize);

  for (const contract of contractsToReview) {
    // Check if already has recent legal review
    const existingReview = await ctx.db
      .query("agentInsights")
      .withIndex("by_contract", (q: any) => q.eq("contractId", contract._id))
      .filter((q: any) => 
        q.and(
          q.eq(q.field("type"), "legal_review"),
          q.gt(q.field("createdAt"), new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        )
      )
      .first();

    if (existingReview) continue;

    const legalReview = await conductLegalReview(ctx, contract);
    
    if (legalReview.issues.length > 0 || legalReview.riskScore > 50) {
      reviewsCreated++;
      
      const priority = legalReview.riskScore > 75 ? "critical" : 
                      legalReview.riskScore > 50 ? "high" : "medium";

      await ctx.db.insert("agentInsights", {
        agentId,
        type: "legal_review",
        title: `Legal Review: ${contract.title || contract._id}`,
        description: `${legalReview.issues.length} legal issue(s) identified. Risk score: ${legalReview.riskScore}/100`,
        priority,
        contractId: contract._id,
        vendorId: contract.vendorId,
        actionRequired: legalReview.issues.some((i:any) => i.severity === "high"),
        actionTaken: false,
        isRead: false,
        createdAt: new Date().toISOString(),
        data: legalReview,
      });

      // Create task for high-priority issues
      if (priority === "critical" || priority === "high") {
        await createLegalActionTask(ctx, agentId, contract, legalReview);
      }
    }
  }

  return reviewsCreated;
}

async function analyzeContractClauses(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  let analysisCreated = 0;

  const contracts = await ctx.db
    .query("contracts")
    .withIndex("by_status_and_enterpriseId")
    .filter((q: any) => q.eq(q.field("status"), "active"))
    .take(LEGAL_CONFIG.batchSize);

  for (const contract of contracts) {
    const contractType = contract.contractType || "other";
    const requiredClauses = LEGAL_CONFIG.requiredClauses[contractType as keyof typeof LEGAL_CONFIG.requiredClauses] || [];
    
    if (requiredClauses.length === 0) continue;

    // Simulate clause analysis (in practice, would use AI/NLP)
    const clauseAnalysis = await analyzeContractForClauses(contract, requiredClauses);
    
    if (clauseAnalysis.missingClauses.length > 0 || clauseAnalysis.problematicClauses.length > 0) {
      analysisCreated++;
      
      const priority = clauseAnalysis.criticalMissing > 0 ? "high" : "medium";

      await ctx.db.insert("agentInsights", {
        agentId,
        type: "compliance_alert",
        title: `Clause Analysis: ${contract.title || contract._id}`,
        description: `${clauseAnalysis.missingClauses.length} missing clause(s) and ${clauseAnalysis.problematicClauses.length} problematic clause(s) found`,
        priority,
        contractId: contract._id,
        vendorId: contract.vendorId,
        actionRequired: clauseAnalysis.criticalMissing > 0,
        actionTaken: false,
        isRead: false,
        createdAt: new Date().toISOString(),
        data: clauseAnalysis,
      });
    }
  }

  return analysisCreated;
}

async function monitorLegalDeadlines(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  let alertsCreated = 0;

  const activeContracts = await ctx.db
    .query("contracts")
    .withIndex("by_status_and_enterpriseId")
    .filter((q: any) => q.eq(q.field("status"), "active"))
    .collect();

  for (const contract of activeContracts) {
    const deadlines = calculateLegalDeadlines(contract);
    
    for (const deadline of deadlines) {
      if (deadline.daysUntil <= deadline.warningDays && deadline.daysUntil > 0) {
        // Check if alert already exists
        const existingAlert = await ctx.db
          .query("agentInsights")
          .withIndex("by_contract", (q: any) => q.eq("contractId", contract._id))
          .filter((q: any) => 
            q.and(
              q.eq(q.field("type"), "alert"),
              q.eq(q.field("actionTaken"), false),
              q.gte(q.field("createdAt"), new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            )
          )
          .first();

        if (!existingAlert) {
          alertsCreated++;
          
          await ctx.db.insert("agentInsights", {
            agentId,
            type: "alert",
            title: `Legal Deadline Approaching: ${deadline.type}`,
            description: `${deadline.description} for contract "${contract.title}" is due in ${deadline.daysUntil} days`,
            priority: deadline.daysUntil <= 7 ? "critical" : "high",
            contractId: contract._id,
            vendorId: contract.vendorId,
            actionRequired: true,
            actionTaken: false,
            isRead: false,
            createdAt: new Date().toISOString(),
            data: {
              deadlineType: deadline.type,
              dueDate: deadline.dueDate,
              daysUntil: deadline.daysUntil,
              requiredAction: deadline.requiredAction,
            },
          });
        }
      }
    }
  }

  return alertsCreated;
}

async function checkRegulatoryCompliance(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  let complianceIssues = 0;

  const contracts = await ctx.db
    .query("contracts")
    .withIndex("by_status_and_enterpriseId")
    .filter((q: any) => q.eq(q.field("status"), "active"))
    .take(LEGAL_CONFIG.batchSize);

  for (const contract of contracts) {
    const complianceCheck = await performRegulatoryComplianceCheck(contract);
    
    if (complianceCheck.violations.length > 0) {
      complianceIssues++;
      
      const severity = complianceCheck.violations.some((v:any) => v.severity === "critical") ? "critical" :
                      complianceCheck.violations.some((v:any) => v.severity === "high") ? "high" : "medium";

      await ctx.db.insert("agentInsights", {
        agentId,
        type: "compliance_alert",
        title: `Regulatory Compliance Issues: ${contract.title || contract._id}`,
        description: `${complianceCheck.violations.length} compliance violation(s) detected`,
        priority: severity,
        contractId: contract._id,
        vendorId: contract.vendorId,
        actionRequired: true,
        actionTaken: false,
        isRead: false,
        createdAt: new Date().toISOString(),
        data: complianceCheck,
      });

      // Create compliance remediation task
      await createComplianceTask(ctx, agentId, contract, complianceCheck);
    }
  }

  return complianceIssues;
}

async function identifyHighRiskTerms(
  ctx: any,
  agentId: Id<"agents">
): Promise<number> {
  let riskTermsFound = 0;

  const contracts = await ctx.db
    .query("contracts")
    .withIndex("by_status_and_enterpriseId")
    .filter((q: any) => q.eq(q.field("status"), "active"))
    .take(LEGAL_CONFIG.batchSize);

  for (const contract of contracts) {
    const riskAnalysis = await analyzeHighRiskTerms(contract);
    
    if (riskAnalysis.highRiskTerms.length > 0) {
      riskTermsFound++;
      
      const priority = riskAnalysis.criticalTerms > 0 ? "critical" : "high";

      await ctx.db.insert("agentInsights", {
        agentId,
        type: "legal_review",
        title: `High-Risk Terms Detected: ${contract.title || contract._id}`,
        description: `${riskAnalysis.highRiskTerms.length} high-risk legal term(s) require review`,
        priority,
        contractId: contract._id,
        vendorId: contract.vendorId,
        actionRequired: true,
        actionTaken: false,
        isRead: false,
        createdAt: new Date().toISOString(),
        data: riskAnalysis,
      });
    }
  }

  return riskTermsFound;
}

async function generateLegalTrendAnalysis(
  ctx: any,
  agentId: Id<"agents">
): Promise<void> {
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  
  // Get recent legal insights
  const recentInsights = await ctx.db
    .query("agentInsights")
    .filter((q: any) => 
      q.and(
        q.eq(q.field("agentId"), agentId),
        q.gt(q.field("createdAt"), sixMonthsAgo)
      )
    )
    .collect();

  if (recentInsights.length < 10) return;

  // Analyze trends
  const trendAnalysis = {
    totalIssues: recentInsights.length,
    byType: {} as Record<string, number>,
    byPriority: {} as Record<string, number>,
    topRisks: [] as string[],
    recommendations: [] as string[],
  };

  // Group by type and priority
  for (const insight of recentInsights) {
    trendAnalysis.byType[insight.type] = (trendAnalysis.byType[insight.type] || 0) + 1;
    trendAnalysis.byPriority[insight.priority] = (trendAnalysis.byPriority[insight.priority] || 0) + 1;
  }

  // Generate recommendations based on trends
  const mostCommonType = Object.entries(trendAnalysis.byType)
    .sort(([,a], [,b]) => b - a)[0];
  
  if (mostCommonType && mostCommonType[1] > recentInsights.length * 0.3) {
    trendAnalysis.recommendations.push(
      `High frequency of ${mostCommonType[0]} issues suggests need for template review and standardization`
    );
  }

  if (trendAnalysis.byPriority.critical && trendAnalysis.byPriority.critical > 5) {
    trendAnalysis.recommendations.push(
      "Multiple critical legal issues indicate need for enhanced contract review process"
    );
  }

  await ctx.db.insert("agentInsights", {
    agentId,
    type: "trend_analysis",
    title: "Legal Risk Trends (6-Month Analysis)",
    description: `Analysis of ${recentInsights.length} legal insights reveals key risk patterns and improvement opportunities`,
    priority: "low",
    actionRequired: trendAnalysis.recommendations.length > 0,
    actionTaken: false,
    isRead: false,
    createdAt: new Date().toISOString(),
    data: trendAnalysis,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function conductLegalReview(ctx: any, contract: any): Promise<any> {
  const review = {
    riskScore: 0,
    issues: [] as any[],
    recommendations: [] as string[],
    complianceStatus: "compliant" as string,
  };

  // Check contract value risk
  const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
  if (value > LEGAL_CONFIG.thresholds.criticalReviewValue) {
    review.riskScore += 25;
    review.issues.push({
      type: "high_value_risk",
      severity: "high",
      description: "High-value contract requires enhanced legal oversight",
      recommendation: "Implement additional approval layers and legal review checkpoints"
    });
  }

  // Check contract duration
  if (contract.extractedStartDate && contract.extractedEndDate) {
    const duration = Math.ceil(
      (new Date(contract.extractedEndDate).getTime() - new Date(contract.extractedStartDate).getTime()) / 
      (1000 * 60 * 60 * 24 * 30)
    );
    
    if (duration > LEGAL_CONFIG.thresholds.longTermMonths) {
      review.riskScore += 15;
      review.issues.push({
        type: "long_term_commitment",
        severity: "medium",
        description: `Long-term contract (${duration} months) creates extended legal obligations`,
        recommendation: "Include periodic review clauses and termination options"
      });
    }
  }

  // Check for required legal elements based on contract type
  const contractType = contract.contractType || "other";
  const missingElements = await checkRequiredLegalElements(contract, contractType);
  
  if (missingElements.length > 0) {
    review.riskScore += missingElements.length * 10;
    review.issues.push({
      type: "missing_legal_elements",
      severity: "medium",
      description: `Missing required legal elements: ${missingElements.join(', ')}`,
      recommendation: "Add missing legal provisions to ensure comprehensive protection"
    });
  }

  // Set overall compliance status
  if (review.riskScore > 75) {
    review.complianceStatus = "non_compliant";
  } else if (review.riskScore > 50) {
    review.complianceStatus = "requires_attention";
  }

  return review;
}

async function analyzeContractForClauses(contract: any, requiredClauses: string[]): Promise<any> {
  const analysis = {
    missingClauses: [] as string[],
    problematicClauses: [] as any[],
    criticalMissing: 0,
    recommendations: [] as string[],
  };

  // Simulate clause detection (in practice, would use AI/NLP)
  const contractText = [
    contract.extractedScope || '',
    contract.extractedPaymentSchedule || '',
    contract.notes || ''
  ].join(' ').toLowerCase();

  // Check for required clauses
  for (const clause of requiredClauses) {
    const clauseKeywords = getClauseKeywords(clause);
    const hasClause = clauseKeywords.some(keyword => contractText.includes(keyword));
    
    if (!hasClause) {
      analysis.missingClauses.push(clause);
      if (isCriticalClause(clause)) {
        analysis.criticalMissing++;
      }
    }
  }

  // Check for problematic terms
  for (const riskTerm of LEGAL_CONFIG.highRiskTerms) {
    if (contractText.includes(riskTerm.toLowerCase())) {
      analysis.problematicClauses.push({
        term: riskTerm,
        severity: "high",
        concern: `Contains high-risk term: "${riskTerm}"`,
        recommendation: `Review and consider modifying "${riskTerm}" clause`
      });
    }
  }

  // Generate recommendations
  if (analysis.criticalMissing > 0) {
    analysis.recommendations.push("Add critical missing clauses before contract execution");
  }
  if (analysis.problematicClauses.length > 0) {
    analysis.recommendations.push("Review and modify high-risk terms to reduce legal exposure");
  }

  return analysis;
}

function calculateLegalDeadlines(contract: any): any[] {
  const deadlines: Array<{
    type: string;
    description: string;
    dueDate: string;
    daysUntil: number;
    warningDays: number;
    requiredAction: string;
  }> = [];
  const now = new Date();

  if (contract.extractedEndDate) {
    const endDate = new Date(contract.extractedEndDate);
    
    // Renewal notice deadline
    const renewalNoticeDate = new Date(endDate);
    renewalNoticeDate.setDate(renewalNoticeDate.getDate() - LEGAL_CONFIG.deadlineTypes.renewal_notice);
    
    if (renewalNoticeDate > now) {
      deadlines.push({
        type: "renewal_notice",
        description: "Contract renewal notice",
        dueDate: renewalNoticeDate.toISOString(),
        daysUntil: Math.ceil((renewalNoticeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        warningDays: 14,
        requiredAction: "Review contract for renewal or provide termination notice"
      });
    }

    // Termination notice deadline
    const terminationNoticeDate = new Date(endDate);
    terminationNoticeDate.setDate(terminationNoticeDate.getDate() - LEGAL_CONFIG.deadlineTypes.termination_notice);
    
    if (terminationNoticeDate > now) {
      deadlines.push({
        type: "termination_notice",
        description: "Contract termination notice deadline",
        dueDate: terminationNoticeDate.toISOString(),
        daysUntil: Math.ceil((terminationNoticeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        warningDays: 21,
        requiredAction: "Decide on contract continuation or provide termination notice"
      });
    }
  }

  // Legal review deadline (periodic)
  const lastReviewDate = contract._creationTime ? new Date(contract._creationTime) : now;
  const nextReviewDate = new Date(lastReviewDate);
  nextReviewDate.setDate(nextReviewDate.getDate() + LEGAL_CONFIG.deadlineTypes.legal_review);
  
  if (nextReviewDate > now) {
    deadlines.push({
      type: "legal_review",
      description: "Periodic legal review",
      dueDate: nextReviewDate.toISOString(),
      daysUntil: Math.ceil((nextReviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      warningDays: 30,
      requiredAction: "Conduct comprehensive legal review of contract terms"
    });
  }

  return deadlines;
}

async function performRegulatoryComplianceCheck(contract: any): Promise<any> {
  const complianceCheck = {
    violations: [] as any[],
    frameworks: [] as string[],
    recommendations: [] as string[],
  };

  const contractText = [
    contract.extractedScope || '',
    contract.notes || '',
    contract.title || ''
  ].join(' ').toLowerCase();

  // Check GDPR compliance for data processing contracts
  if (contractText.includes('data') || contractText.includes('personal') || contract.contractType === 'saas') {
    const gdprCompliant = checkGDPRCompliance(contractText);
    if (!gdprCompliant.compliant) {
      complianceCheck.violations.push({
        framework: "GDPR",
        severity: "high",
        violation: gdprCompliant.issue,
        requirement: "Data processing agreements must include GDPR-compliant terms"
      });
    }
    complianceCheck.frameworks.push("GDPR");
  }

  // Check financial compliance for high-value contracts
  const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
  if (value > 10000) {
    const financialCompliant = checkFinancialCompliance(contractText);
    if (!financialCompliant.compliant) {
      complianceCheck.violations.push({
        framework: "Financial",
        severity: "medium",
        violation: financialCompliant.issue,
        requirement: "High-value contracts require financial compliance measures"
      });
    }
  }

  // Generate recommendations
  if (complianceCheck.violations.length > 0) {
    complianceCheck.recommendations.push("Review contract against applicable regulatory frameworks");
    complianceCheck.recommendations.push("Consult legal counsel for compliance remediation");
  }

  return complianceCheck;
}

async function analyzeHighRiskTerms(contract: any): Promise<any> {
  const analysis = {
    highRiskTerms: [] as any[],
    criticalTerms: 0,
    riskScore: 0,
    recommendations: [] as string[],
  };

  const contractText = [
    contract.extractedScope || '',
    contract.extractedPaymentSchedule || '',
    contract.notes || ''
  ].join(' ').toLowerCase();

  // Check for each high-risk term
  for (const term of LEGAL_CONFIG.highRiskTerms) {
    if (contractText.includes(term.toLowerCase())) {
      const severity = assessTermSeverity(term);
      
      analysis.highRiskTerms.push({
        term,
        severity,
        context: extractTermContext(contractText, term),
        impact: getTermImpactDescription(term),
        recommendation: getTermRecommendation(term)
      });

      if (severity === "critical") {
        analysis.criticalTerms++;
        analysis.riskScore += 30;
      } else if (severity === "high") {
        analysis.riskScore += 20;
      } else {
        analysis.riskScore += 10;
      }
    }
  }

  // Generate overall recommendations
  if (analysis.criticalTerms > 0) {
    analysis.recommendations.push("Immediately review critical risk terms with legal counsel");
    analysis.recommendations.push("Consider contract renegotiation to mitigate critical risks");
  }
  
  if (analysis.riskScore > 50) {
    analysis.recommendations.push("Implement additional risk mitigation measures");
    analysis.recommendations.push("Require enhanced approval process for this contract");
  }

  return analysis;
}

// ============================================================================
// TASK PROCESSING FUNCTIONS
// ============================================================================

async function performLegalReview(ctx: any, agentId: Id<"agents">, task: any): Promise<any> {
  const contract = await ctx.db.get(task.contractId);
  if (!contract) {
    throw new Error("Contract not found for legal review");
  }

  const review = await conductLegalReview(ctx, contract);
  
  // Create detailed legal assessment
  const legalAssessment = {
    contractId: contract._id,
    reviewDate: new Date().toISOString(),
    reviewer: "Legal Agent",
    overallRisk: review.riskScore,
    riskLevel: review.riskScore > 75 ? "high" : review.riskScore > 50 ? "medium" : "low",
    issues: review.issues,
    recommendations: review.recommendations,
    complianceStatus: review.complianceStatus,
    nextReviewDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 months
  };

  return legalAssessment;
}

async function performComplianceCheck(ctx: any, agentId: Id<"agents">, task: any): Promise<any> {
  const contract = await ctx.db.get(task.contractId);
  if (!contract) {
    throw new Error("Contract not found for compliance check");
  }

  const complianceCheck = await performRegulatoryComplianceCheck(contract);
  
  const complianceAssessment = {
    contractId: contract._id,
    checkDate: new Date().toISOString(),
    frameworksChecked: complianceCheck.frameworks,
    violations: complianceCheck.violations,
    overallStatus: complianceCheck.violations.length === 0 ? "compliant" : "non_compliant",
    remediation: complianceCheck.recommendations,
    nextCheckDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 3 months
  };

  return complianceAssessment;
}

async function analyzeSpecificClauses(ctx: any, agentId: Id<"agents">, task: any): Promise<any> {
  const contract = await ctx.db.get(task.contractId);
  if (!contract) {
    throw new Error("Contract not found for clause analysis");
  }

  const contractType = contract.contractType || "other";
  const requiredClauses = LEGAL_CONFIG.requiredClauses[contractType as keyof typeof LEGAL_CONFIG.requiredClauses] || [];
  
  const clauseAnalysis = await analyzeContractForClauses(contract, requiredClauses);
  
  const analysis = {
    contractId: contract._id,
    contractType,
    analysisDate: new Date().toISOString(),
    requiredClauses,
    foundClauses: requiredClauses.filter(clause => !clauseAnalysis.missingClauses.includes(clause)),
    missingClauses: clauseAnalysis.missingClauses,
    problematicClauses: clauseAnalysis.problematicClauses,
    completenessScore: ((requiredClauses.length - clauseAnalysis.missingClauses.length) / requiredClauses.length) * 100,
    recommendations: clauseAnalysis.recommendations,
  };

  return analysis;
}

async function assessLegalRisk(ctx: any, agentId: Id<"agents">, task: any): Promise<any> {
  const contract = await ctx.db.get(task.contractId);
  if (!contract) {
    throw new Error("Contract not found for legal risk assessment");
  }

  const riskAssessment = {
    contractId: contract._id,
    assessmentDate: new Date().toISOString(),
    riskFactors: [] as any[],
    overallRiskScore: 0,
    riskLevel: "low" as string,
    mitigationStrategies: [] as string[],
  };

  // Assess contract value risk
  const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
  if (value > 0) {
    const valueRisk = assessValueRisk(value);
    riskAssessment.riskFactors.push(valueRisk);
    riskAssessment.overallRiskScore += valueRisk.score;
  }

  // Assess duration risk
  if (contract.extractedStartDate && contract.extractedEndDate) {
    const durationRisk = assessDurationRisk(contract.extractedStartDate, contract.extractedEndDate);
    riskAssessment.riskFactors.push(durationRisk);
    riskAssessment.overallRiskScore += durationRisk.score;
  }

  // Assess contractual complexity risk
  const complexityRisk = assessContractComplexity(contract);
  riskAssessment.riskFactors.push(complexityRisk);
  riskAssessment.overallRiskScore += complexityRisk.score;

  // Determine risk level
  if (riskAssessment.overallRiskScore > 75) {
    riskAssessment.riskLevel = "critical";
  } else if (riskAssessment.overallRiskScore > 50) {
    riskAssessment.riskLevel = "high";
  } else if (riskAssessment.overallRiskScore > 25) {
    riskAssessment.riskLevel = "medium";
  }

  // Generate mitigation strategies
  riskAssessment.mitigationStrategies = generateMitigationStrategies(riskAssessment.riskFactors);

  return riskAssessment;
}

async function reviewAmendment(ctx: any, agentId: Id<"agents">, task: any): Promise<any> {
  const contract = await ctx.db.get(task.contractId);
  if (!contract) {
    throw new Error("Contract not found for amendment review");
  }

  // Simulate amendment review (would need amendment data in practice)
  const amendmentReview = {
    contractId: contract._id,
    reviewDate: new Date().toISOString(),
    amendmentType: task.data?.amendmentType || "modification",
    changes: task.data?.changes || [],
    legalImpact: "medium",
    approvalRequired: true,
    risks: [] as string[],
    recommendations: [] as string[],
  };

  // Assess amendment impact
  if (task.data?.changes) {
    for (const change of task.data.changes) {
      if (change.type === "pricing") {
        amendmentReview.risks.push("Pricing changes may affect budget and financial commitments");
      } else if (change.type === "scope") {
        amendmentReview.risks.push("Scope changes may impact deliverables and timeline");
      } else if (change.type === "termination") {
        amendmentReview.risks.push("Termination clause changes affect contract exit strategy");
      }
    }
  }

  // Generate recommendations
  if (amendmentReview.risks.length > 0) {
    amendmentReview.recommendations.push("Review amendment impact on overall contract risk profile");
    amendmentReview.recommendations.push("Ensure amendment aligns with organizational policies");
  }

  return amendmentReview;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function createLegalActionTask(ctx: any, agentId: Id<"agents">, contract: any, legalReview: any): Promise<void> {
  // Create task for legal team or workflow agent
  const workflowAgent = await ctx.db
    .query("agents")
    .withIndex("by_type", (q: any) => q.eq("type", "workflow"))
    .first();

  if (workflowAgent) {
    await ctx.db.insert("agentTasks", {
      assignedAgentId: workflowAgent._id,
      createdByAgentId: agentId,
      taskType: "legal_action_required",
      status: "pending",
      priority: legalReview.riskScore > 75 ? "critical" : "high",
      title: `Legal Action Required: ${contract.title}`,
      description: `Contract requires legal attention due to ${legalReview.issues.length} identified issues`,
      contractId: contract._id,
      vendorId: contract.vendorId,
      data: {
        actionType: "legal_review",
        issues: legalReview.issues,
        recommendations: legalReview.recommendations,
        urgency: legalReview.riskScore > 75 ? "critical" : "high",
      },
      createdAt: new Date().toISOString(),
    });
  }
}

async function createComplianceTask(ctx: any, agentId: Id<"agents">, contract: any, complianceCheck: any): Promise<void> {
  // Create task for compliance agent
  const complianceAgent = await ctx.db
    .query("agents")
    .withIndex("by_type", (q: any) => q.eq("type", "compliance"))
    .first();

  if (complianceAgent) {
    await ctx.db.insert("agentTasks", {
      assignedAgentId: complianceAgent._id,
      createdByAgentId: agentId,
      taskType: "compliance_remediation",
      status: "pending",
      priority: complianceCheck.violations.some((v: any) => v.severity === "critical") ? "critical" : "high",
      title: `Compliance Remediation: ${contract.title}`,
      description: `Address ${complianceCheck.violations.length} compliance violations`,
      contractId: contract._id,
      vendorId: contract.vendorId,
      data: {
        violations: complianceCheck.violations,
        frameworks: complianceCheck.frameworks,
        recommendations: complianceCheck.recommendations,
      },
      createdAt: new Date().toISOString(),
    });
  }
}

async function checkRequiredLegalElements(contract: any, contractType: string): Promise<string[]> {
  const missingElements: string[] = [];
  const contractText = [
    contract.extractedScope || '',
    contract.extractedPaymentSchedule || '',
    contract.notes || ''
  ].join(' ').toLowerCase();

  // Basic legal elements every contract should have
  const basicElements = [
    { name: "governing_law", keywords: ["governing law", "jurisdiction", "laws of"] },
    { name: "dispute_resolution", keywords: ["dispute", "arbitration", "mediation", "court"] },
    { name: "force_majeure", keywords: ["force majeure", "acts of god", "unforeseeable"] },
    { name: "entire_agreement", keywords: ["entire agreement", "complete agreement", "supersedes"] },
  ];

  for (const element of basicElements) {
    const hasElement = element.keywords.some(keyword => contractText.includes(keyword));
    if (!hasElement) {
      missingElements.push(element.name);
    }
  }

  return missingElements;
}

function getClauseKeywords(clause: string): string[] {
  const keywordMap: Record<string, string[]> = {
    data_protection: ["data protection", "privacy", "gdpr", "personal data"],
    service_level: ["service level", "sla", "uptime", "availability"],
    limitation_of_liability: ["limitation of liability", "liability cap", "damages"],
    termination: ["termination", "end", "expire", "cancel"],
    intellectual_property: ["intellectual property", "ip", "copyright", "trademark"],
    compliance: ["compliance", "regulatory", "standards", "certification"],
    confidentiality: ["confidentiality", "non-disclosure", "proprietary", "confidential"],
    return_of_information: ["return", "destroy", "delete", "confidential information"],
    term_duration: ["term", "duration", "period", "expires"],
    remedies: ["remedies", "damages", "injunction", "specific performance"],
    governing_law: ["governing law", "jurisdiction", "applicable law"],
    compensation: ["compensation", "salary", "wage", "payment"],
    non_compete: ["non-compete", "non-competition", "restraint of trade"],
    benefits: ["benefits", "insurance", "vacation", "health"],
    profit_sharing: ["profit sharing", "profits", "revenue sharing"],
    decision_making: ["decision making", "voting", "management", "control"],
    liability: ["liability", "responsible", "damages", "indemnification"],
    dispute_resolution: ["dispute resolution", "arbitration", "mediation"],
    scope_of_work: ["scope of work", "deliverables", "services", "work"],
    payment_terms: ["payment terms", "invoice", "billing", "payment schedule"],
  };

  return keywordMap[clause] || [clause];
}

function isCriticalClause(clause: string): boolean {
  const criticalClauses = [
    "limitation_of_liability",
    "termination",
    "intellectual_property",
    "data_protection",
    "governing_law",
    "confidentiality"
  ];
  return criticalClauses.includes(clause);
}

function checkGDPRCompliance(contractText: string): { compliant: boolean; issue?: string } {
  const gdprKeywords = ["data protection", "gdpr", "personal data", "data subject", "data controller"];
  const hasGDPRTerms = gdprKeywords.some(keyword => contractText.includes(keyword));
  
  if (contractText.includes('data') && !hasGDPRTerms) {
    return {
      compliant: false,
      issue: "Contract involves data processing but lacks GDPR compliance terms"
    };
  }
  
  return { compliant: true };
}

function checkFinancialCompliance(contractText: string): { compliant: boolean; issue?: string } {
  const financialKeywords = ["audit", "financial records", "books and records", "compliance"];
  const hasFinancialTerms = financialKeywords.some(keyword => contractText.includes(keyword));
  
  if (!hasFinancialTerms) {
    return {
      compliant: false,
      issue: "High-value contract lacks financial compliance and audit provisions"
    };
  }
  
  return { compliant: true };
}

function assessTermSeverity(term: string): "critical" | "high" | "medium" {
  const criticalTerms = ["unlimited liability", "perpetual", "non-cancelable"];
  const highTerms = ["automatic renewal", "indemnification", "liquidated damages"];
  
  if (criticalTerms.includes(term.toLowerCase())) return "critical";
  if (highTerms.includes(term.toLowerCase())) return "high";
  return "medium";
}

function extractTermContext(contractText: string, term: string): string {
  const termIndex = contractText.toLowerCase().indexOf(term.toLowerCase());
  if (termIndex === -1) return "";
  
  const start = Math.max(0, termIndex - 50);
  const end = Math.min(contractText.length, termIndex + term.length + 50);
  
  return "..." + contractText.substring(start, end) + "...";
}

function getTermImpactDescription(term: string): string {
  const impactMap: Record<string, string> = {
    "unlimited liability": "Exposes organization to unlimited financial risk",
    "perpetual": "Creates indefinite obligations with no clear end date",
    "non-cancelable": "Prevents contract termination regardless of circumstances",
    "automatic renewal": "Contract renews automatically without explicit approval",
    "indemnification": "Requires covering third-party claims and damages",
    "liquidated damages": "Specifies predetermined penalty amounts for breach",
    "specific performance": "May require completion of obligations rather than monetary damages",
    "injunctive relief": "Allows court orders to prevent certain actions",
  };
  
  return impactMap[term.toLowerCase()] || "Requires legal review for potential risks";
}

function getTermRecommendation(term: string): string {
  const recommendationMap: Record<string, string> = {
    "unlimited liability": "Negotiate liability caps and limitations",
    "perpetual": "Add termination clauses with reasonable notice periods",
    "non-cancelable": "Include termination rights for cause and convenience",
    "automatic renewal": "Require explicit approval for renewals",
    "indemnification": "Limit scope and add mutual indemnification provisions",
    "liquidated damages": "Ensure damages are reasonable and proportionate",
    "specific performance": "Limit to appropriate circumstances only",
    "injunctive relief": "Restrict to protection of confidential information",
  };
  
  return recommendationMap[term.toLowerCase()] || "Review term with legal counsel";
}

function assessValueRisk(value: number): any {
  let score = 0;
  let riskLevel = "low";
  let description = "";

  if (value > LEGAL_CONFIG.thresholds.criticalReviewValue) {
    score = 30;
    riskLevel = "critical";
    description = "Extremely high contract value requires comprehensive legal oversight";
  } else if (value > LEGAL_CONFIG.thresholds.highRiskValue) {
    score = 20;
    riskLevel = "high";
    description = "High contract value increases financial exposure";
  } else if (value > 10000) {
    score = 10;
    riskLevel = "medium";
    description = "Moderate contract value requires standard legal review";
  } else {
    score = 5;
    riskLevel = "low";
    description = "Low contract value presents minimal financial risk";
  }

  return {
    factor: "contract_value",
    score,
    riskLevel,
    description,
    value,
  };
}

function assessDurationRisk(startDate: string, endDate: string): any {
  const duration = Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 
    (1000 * 60 * 60 * 24 * 30)
  );

  let score = 0;
  let riskLevel = "low";
  let description = "";

  if (duration > 60) { // 5+ years
    score = 25;
    riskLevel = "high";
    description = "Very long-term commitment creates significant legal obligations";
  } else if (duration > LEGAL_CONFIG.thresholds.longTermMonths) {
    score = 15;
    riskLevel = "medium";
    description = "Long-term contract increases legal complexity";
  } else if (duration > 12) {
    score = 10;
    riskLevel = "low";
    description = "Multi-year contract requires periodic review";
  } else {
    score = 5;
    riskLevel = "low";
    description = "Short-term contract presents minimal duration risk";
  }

  return {
    factor: "contract_duration",
    score,
    riskLevel,
    description,
    durationMonths: duration,
  };
}

function assessContractComplexity(contract: any): any {
  let complexityScore = 0;
  let description = "Standard contract complexity";

  // Check for multiple parties
  if (contract.extractedParties && contract.extractedParties.length > 2) {
    complexityScore += 10;
    description = "Multi-party contract increases legal complexity";
  }

  // Check for complex payment terms
  if (contract.extractedPaymentSchedule && contract.extractedPaymentSchedule.length > 100) {
    complexityScore += 10;
  }

  // Check for complex scope
  if (contract.extractedScope && contract.extractedScope.length > 500) {
    complexityScore += 10;
  }

  const riskLevel = complexityScore > 20 ? "high" : complexityScore > 10 ? "medium" : "low";

  return {
    factor: "contract_complexity",
    score: Math.min(complexityScore, 25), // Cap at 25
    riskLevel,
    description,
    complexityFactors: complexityScore / 10,
  };
}

function generateMitigationStrategies(riskFactors: any[]): string[] {
  const strategies: string[] = [];

  for (const factor of riskFactors) {
    switch (factor.factor) {
      case "contract_value":
        if (factor.riskLevel === "critical" || factor.riskLevel === "high") {
          strategies.push("Implement milestone-based payments to reduce financial exposure");
          strategies.push("Require performance bonds or guarantees");
          strategies.push("Add enhanced termination rights for non-performance");
        }
        break;
      
      case "contract_duration":
        if (factor.riskLevel === "high" || factor.riskLevel === "medium") {
          strategies.push("Include periodic review and adjustment clauses");
          strategies.push("Add early termination rights with reasonable notice");
          strategies.push("Implement performance benchmarks for long-term contracts");
        }
        break;
      
      case "contract_complexity":
        if (factor.riskLevel === "high") {
          strategies.push("Simplify contract structure where possible");
          strategies.push("Create detailed implementation timeline");
          strategies.push("Establish clear communication protocols");
        }
        break;
    }
  }

  // Add general strategies for high-risk contracts
  const highRiskFactors = riskFactors.filter(f => f.riskLevel === "critical" || f.riskLevel === "high");
  if (highRiskFactors.length > 0) {
    strategies.push("Require board or senior management approval");
    strategies.push("Conduct enhanced due diligence on counterparty");
    strategies.push("Consider obtaining legal opinions on key terms");
  }

  return [...new Set(strategies)]; // Remove duplicates
}

async function updateAgentMetrics(
  ctx: any,
  agentId: Id<"agents">,
  runData: {
    runTime: number;
    tasksProcessed: number;
    complianceReviews: number;
    clauseAnalysis: number;
    deadlineAlerts: number;
    regulatoryChecks: number;
    riskTermsFound: number;
  }
): Promise<void> {
  const agent = await ctx.db.get(agentId);
  if (!agent) return;

  const existingMetrics = (agent.metrics as LegalAgentMetrics) || {
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    averageRunTime: 0,
    contractsReviewed: 0,
    legalRisksIdentified: 0,
    complianceIssuesFound: 0,
    clausesAnalyzed: 0,
    deadlinesTracked: 0,
    amendmentsProcessed: 0,
  };

  const newMetrics: LegalAgentMetrics = {
    ...existingMetrics,
    totalRuns: existingMetrics.totalRuns + 1,
    successfulRuns: existingMetrics.successfulRuns + 1,
    averageRunTime: 
      ((existingMetrics.averageRunTime * existingMetrics.totalRuns) + runData.runTime) / 
      (existingMetrics.totalRuns + 1),
    lastRunDuration: runData.runTime,
    contractsReviewed: (existingMetrics.contractsReviewed || 0) + runData.tasksProcessed,
    legalRisksIdentified: (existingMetrics.legalRisksIdentified || 0) + runData.riskTermsFound,
    complianceIssuesFound: (existingMetrics.complianceIssuesFound || 0) + runData.regulatoryChecks,
    clausesAnalyzed: (existingMetrics.clausesAnalyzed || 0) + runData.clauseAnalysis,
    deadlinesTracked: (existingMetrics.deadlinesTracked || 0) + runData.deadlineAlerts,
    insightsGenerated: (existingMetrics.insightsGenerated || 0) + 
      runData.complianceReviews + runData.clauseAnalysis + runData.deadlineAlerts + runData.regulatoryChecks + runData.riskTermsFound,
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
    message: "Legal agent failed",
    data: { error: error instanceof Error ? error.message : String(error) },
    timestamp: new Date().toISOString(),
    category: "agent_execution",
  });

  const agent = await ctx.db.get(agentId);
  if (agent) {
    const existingMetrics = (agent.metrics as LegalAgentMetrics) || {
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

export const getLegalInsights = internalQuery({
  args: {
    contractId: v.optional(v.id("contracts")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("agentInsights");
    
    if (args.contractId) {
      //@ts-ignore
      query = query.withIndex("by_contract", (q: any) => q.eq("contractId", args.contractId));
    }
    
    const insights = await query
      .filter((q: any) => 
        q.or(
          q.eq(q.field("type"), "legal_review"),
          q.eq(q.field("type"), "compliance_alert")
        )
      )
      .order("desc")
      .take(args.limit || 20);

    return insights;
  },
});

export const getLegalDeadlines = internalQuery({
  args: {
    daysAhead: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysAhead = args.daysAhead || 30;
    const cutoffDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
    
    const deadlineInsights = await ctx.db
      .query("agentInsights")
      .filter((q: any) => 
        q.and(
          q.eq(q.field("type"), "alert"),
          q.lte(q.field("createdAt"), cutoffDate),
          q.eq(q.field("actionTaken"), false)
        )
      )
      .order("desc")
      .collect();

    return deadlineInsights;
  },
});