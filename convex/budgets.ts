import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getSecurityContext } from "./security/rowLevelSecurity";
import { ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";

// Create a new budget
export const createBudget = mutation({
  args: {
    name: v.string(),
    budgetType: v.union(
      v.literal("annual"),
      v.literal("quarterly"),
      v.literal("monthly"),
      v.literal("project"),
      v.literal("department")
    ),
    departmentId: v.optional(v.string()),
    totalBudget: v.number(),
    startDate: v.string(),
    endDate: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only managers and above can create budgets
    if (!["owner", "admin", "manager"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Manager access required");
    }

    const budgetId = await ctx.db.insert("budgets", {
      enterpriseId: securityContext.enterpriseId,
      name: args.name,
      budgetType: args.budgetType,
      departmentId: args.departmentId,
      totalBudget: args.totalBudget,
      allocatedAmount: 0,
      spentAmount: 0,
      committedAmount: 0,
      startDate: args.startDate,
      endDate: args.endDate,
      status: "healthy",
      ownerId: securityContext.userId,
      createdAt: new Date().toISOString(),
    });

    // Log the creation
    await ctx.db.insert("auditLogs", {
      userId: securityContext.userId,
      enterpriseId: securityContext.enterpriseId,
      operation: "createBudget",
      resourceType: "budgets",
      resourceId: budgetId,
      action: "create",
      status: "success",
      timestamp: new Date().toISOString(),
    });

    return budgetId;
  },
});

// Get budgets
export const getBudgets = query({
  args: {
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("exceeded"),
      v.literal("at_risk"),
      v.literal("healthy"),
      v.literal("closed")
    )),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    let budgets = await ctx.db
      .query("budgets")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
      .collect();

    // Filter by status if provided
    if (args.status) {
      if (args.status === "active") {
        budgets = budgets.filter(b => b.status !== "closed");
      } else {
        budgets = budgets.filter(b => b.status === args.status);
      }
    }

    // Enrich with department names
    const enrichedBudgets = await Promise.all(
      budgets.map(async (budget) => {
        let departmentName;
        if (budget.departmentId) {
          // Mock department name - in production, fetch from departments table
          departmentName = `Department ${budget.departmentId}`;
        }

        return {
          ...budget,
          departmentName,
        };
      })
    );

    return enrichedBudgets;
  },
});

// Get budget summary
export const getBudgetSummary = query({
  args: {},
  handler: async (ctx) => {
    const securityContext = await getSecurityContext(ctx);
    
    const budgets = await ctx.db
      .query("budgets")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
      .filter((q) => q.neq(q.field("status"), "closed"))
      .collect();

    const summary = budgets.reduce((acc, budget) => {
      acc.totalBudget += budget.totalBudget;
      acc.totalAllocated += budget.allocatedAmount;
      acc.totalSpent += budget.spentAmount;
      acc.totalCommitted += budget.committedAmount;
      
      if (budget.status === "at_risk" || budget.status === "exceeded") {
        acc.budgetsAtRisk++;
      }
      
      return acc;
    }, {
      totalBudget: 0,
      totalAllocated: 0,
      totalSpent: 0,
      totalCommitted: 0,
      budgetsAtRisk: 0,
    });

    return summary;
  },
});

// Get budget allocations
export const getBudgetAllocations = query({
  args: {
    budgetId: v.id("budgets"),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    const budget = await ctx.db.get(args.budgetId);
    if (!budget || budget.enterpriseId !== securityContext.enterpriseId) {
      throw new ConvexError("Budget not found");
    }

    const allocations = await ctx.db
      .query("contractBudgetAllocations")
      .withIndex("by_budget", (q) => q.eq("budgetId", args.budgetId))
      .collect();

    // Enrich with contract details
    const enrichedAllocations = await Promise.all(
      allocations.map(async (allocation) => {
        const contract = await ctx.db.get(allocation.contractId);
        let vendor;
        if (contract?.vendorId) {
          vendor = await ctx.db.get(contract.vendorId);
        }

        return {
          ...allocation,
          contractTitle: contract?.title || "Unknown Contract",
          contractStatus: contract?.status || "unknown",
          vendorName: vendor?.name,
        };
      })
    );

    return enrichedAllocations;
  },
});

// Get budget analytics
export const getBudgetAnalytics = query({
  args: {
    budgetId: v.id("budgets"),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    const budget = await ctx.db.get(args.budgetId);
    if (!budget || budget.enterpriseId !== securityContext.enterpriseId) {
      throw new ConvexError("Budget not found");
    }

    // Calculate burn rate
    const startDate = new Date(budget.startDate);
    const now = new Date();
    const daysElapsed = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    const dailyBurnRate = budget.spentAmount / daysElapsed;
    const weeklyBurnRate = dailyBurnRate * 7;
    const monthlyBurnRate = dailyBurnRate * 30;

    // Calculate projections
    const endDate = new Date(budget.endDate);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const projectedTotal = dailyBurnRate * totalDays;
    
    const remainingBudget = budget.totalBudget - budget.spentAmount;
    const daysUntilExhausted = remainingBudget > 0 ? Math.floor(remainingBudget / dailyBurnRate) : 0;
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const recommendedDailyLimit = daysRemaining > 0 ? remainingBudget / daysRemaining : 0;

    // Get spending by category (mock data)
    const topCategories = [
      { name: "Software", amount: budget.spentAmount * 0.4, percentage: 40 },
      { name: "Services", amount: budget.spentAmount * 0.3, percentage: 30 },
      { name: "Hardware", amount: budget.spentAmount * 0.2, percentage: 20 },
      { name: "Other", amount: budget.spentAmount * 0.1, percentage: 10 },
    ];

    return {
      burnRate: {
        daily: dailyBurnRate,
        weekly: weeklyBurnRate,
        monthly: monthlyBurnRate,
      },
      projectedTotal,
      daysUntilExhausted,
      recommendedDailyLimit,
      topCategories,
    };
  },
});

// Allocate contracts to budget
export const allocateContractsToBudget = mutation({
  args: {
    budgetId: v.id("budgets"),
    allocations: v.array(v.object({
      contractId: v.id("contracts"),
      allocatedAmount: v.number(),
      allocationType: v.union(v.literal("full"), v.literal("prorated"), v.literal("custom")),
    })),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only managers and above can allocate budgets
    if (!["owner", "admin", "manager"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Manager access required");
    }

    const budget = await ctx.db.get(args.budgetId);
    if (!budget || budget.enterpriseId !== securityContext.enterpriseId) {
      throw new ConvexError("Budget not found");
    }

    // Calculate total allocation
    const totalAllocation = args.allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    const newTotalAllocated = budget.allocatedAmount + totalAllocation;

    if (newTotalAllocated > budget.totalBudget) {
      throw new ConvexError("Total allocation exceeds budget");
    }

    // Create allocations
    for (const allocation of args.allocations) {
      const contract = await ctx.db.get(allocation.contractId);
      if (!contract || contract.enterpriseId !== securityContext.enterpriseId) {
        throw new ConvexError("Contract not found");
      }

      await ctx.db.insert("contractBudgetAllocations", {
        contractId: allocation.contractId,
        budgetId: args.budgetId,
        allocatedAmount: allocation.allocatedAmount,
        allocationType: allocation.allocationType,
        startDate: budget.startDate,
        endDate: budget.endDate,
        createdAt: new Date().toISOString(),
      });
    }

    // Update budget allocated amount
    await ctx.db.patch(args.budgetId, {
      allocatedAmount: newTotalAllocated,
    });

    // Check and update budget status
    await checkBudgetStatus(ctx, args.budgetId);

    return { success: true };
  },
});

// Remove contract allocation
export const removeContractAllocation = mutation({
  args: {
    allocationId: v.id("contractBudgetAllocations"),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    const allocation = await ctx.db.get(args.allocationId);
    if (!allocation) {
      throw new ConvexError("Allocation not found");
    }

    const budget = await ctx.db.get(allocation.budgetId);
    if (!budget || budget.enterpriseId !== securityContext.enterpriseId) {
      throw new ConvexError("Access denied");
    }

    // Update budget allocated amount
    await ctx.db.patch(allocation.budgetId, {
      allocatedAmount: budget.allocatedAmount - allocation.allocatedAmount,
    });

    // Delete allocation
    await ctx.db.delete(args.allocationId);

    return { success: true };
  },
});

// Get unallocated contracts for a budget period
export const getUnallocatedContracts = query({
  args: {
    budgetId: v.id("budgets"),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    const budget = await ctx.db.get(args.budgetId);
    if (!budget || budget.enterpriseId !== securityContext.enterpriseId) {
      throw new ConvexError("Budget not found");
    }

    // Get all contracts
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", securityContext.enterpriseId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Get allocated contract IDs
    const allocations = await ctx.db
      .query("contractBudgetAllocations")
      .withIndex("by_budget", (q) => q.eq("budgetId", args.budgetId))
      .collect();
    
    const allocatedContractIds = new Set(allocations.map(a => a.contractId));

    // Filter unallocated contracts that overlap with budget period
    const unallocatedContracts = contracts.filter(contract => {
      if (allocatedContractIds.has(contract._id)) return false;

      // Check if contract period overlaps with budget period
      const contractStart = new Date(contract.startDate || budget.startDate);
      const contractEnd = new Date(contract.endDate || budget.endDate);
      const budgetStart = new Date(budget.startDate);
      const budgetEnd = new Date(budget.endDate);

      return contractStart <= budgetEnd && contractEnd >= budgetStart;
    });

    // Enrich with vendor names
    const enrichedContracts = await Promise.all(
      unallocatedContracts.map(async (contract) => {
        let vendor;
        if (contract.vendorId) {
          vendor = await ctx.db.get(contract.vendorId);
        }
        return {
          ...contract,
          vendorName: vendor?.name,
        };
      })
    );

    return enrichedContracts;
  },
});

// Update budget
export const updateBudget = mutation({
  args: {
    budgetId: v.id("budgets"),
    updates: v.object({
      name: v.optional(v.string()),
      totalBudget: v.optional(v.number()),
      description: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Only managers and above can update budgets
    if (!["owner", "admin", "manager"].includes(securityContext.role)) {
      throw new ConvexError("Access denied: Manager access required");
    }

    const budget = await ctx.db.get(args.budgetId);
    if (!budget || budget.enterpriseId !== securityContext.enterpriseId) {
      throw new ConvexError("Budget not found");
    }

    await ctx.db.patch(args.budgetId, {
      ...args.updates,
      updatedAt: new Date().toISOString(),
    });

    // Check and update budget status
    await checkBudgetStatus(ctx, args.budgetId);

    return { success: true };
  },
});

// Acknowledge budget alert
export const acknowledgeAlert = mutation({
  args: {
    budgetId: v.id("budgets"),
    alertIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const securityContext = await getSecurityContext(ctx);
    
    const budget = await ctx.db.get(args.budgetId);
    if (!budget || budget.enterpriseId !== securityContext.enterpriseId) {
      throw new ConvexError("Budget not found");
    }

    if (!budget.alerts || !budget.alerts[args.alertIndex]) {
      throw new ConvexError("Alert not found");
    }

    const updatedAlerts = [...budget.alerts];
    updatedAlerts[args.alertIndex].acknowledged = true;

    await ctx.db.patch(args.budgetId, {
      alerts: updatedAlerts,
    });

    return { success: true };
  },
});

// Get departments (mock implementation)
export const getDepartments = query({
  args: {},
  handler: async (ctx) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Mock departments - in production, fetch from departments table
    return [
      { _id: "dept1", name: "Engineering" },
      { _id: "dept2", name: "Marketing" },
      { _id: "dept3", name: "Sales" },
      { _id: "dept4", name: "Operations" },
      { _id: "dept5", name: "Finance" },
    ];
  },
});

// Helper function to check and update budget status
async function checkBudgetStatus(ctx: any, budgetId: Id<"budgets">) {
  const budget = await ctx.db.get(budgetId);
  if (!budget) return;

  const spentPercentage = (budget.spentAmount / budget.totalBudget) * 100;
  const allocatedPercentage = (budget.allocatedAmount / budget.totalBudget) * 100;
  
  let newStatus = budget.status;
  const alerts = budget.alerts || [];

  if (spentPercentage >= 100) {
    newStatus = "exceeded";
    // Add exceeded alert if not already present
    if (!alerts.some((a: any) => a.type === "exceeded" && !a.acknowledged)) {
      alerts.push({
        type: "exceeded",
        threshold: 100,
        triggeredAt: new Date().toISOString(),
        acknowledged: false,
      });
    }
  } else if (spentPercentage >= 80 || allocatedPercentage >= 90) {
    newStatus = "at_risk";
    // Add threshold alert if not already present
    const threshold = spentPercentage >= 80 ? 80 : 90;
    if (!alerts.some((a: any) => a.type === "threshold_reached" && a.threshold === threshold && !a.acknowledged)) {
      alerts.push({
        type: "threshold_reached",
        threshold,
        triggeredAt: new Date().toISOString(),
        acknowledged: false,
      });
    }
  } else {
    newStatus = "healthy";
  }

  if (newStatus !== budget.status || alerts.length !== (budget.alerts || []).length) {
    await ctx.db.patch(budgetId, {
      status: newStatus,
      alerts,
    });
  }
}