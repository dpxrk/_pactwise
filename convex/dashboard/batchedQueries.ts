import { query, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";

/**
 * Batched dashboard query that fetches all dashboard data in a single request
 * This reduces the number of round trips and improves performance
 */
export const getAllDashboardData = query({
  args: {
    enterpriseId: v.id("enterprises"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { enterpriseId, userId } = args;
    
    // Run all queries in parallel
    const [
      contractStats,
      contracts,
      vendors,
      recentActivity,
      upcomingRenewals,
      riskAlerts,
      spendAnalysis
    ] = await Promise.all([
      // Contract statistics
      getContractStats(ctx, enterpriseId),
      
      // Recent contracts (limit to 10)
      ctx.db
        .query("contracts")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
        .order("desc")
        .take(10),
      
      // Active vendors (limit to 10)
      ctx.db
        .query("vendors")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
        .filter((q) => q.eq(q.field("status"), "active"))
        .take(10),
      
      // Recent activity
      getRecentActivity(ctx, enterpriseId, 5),
      
      // Upcoming renewals (next 30 days)
      getUpcomingRenewals(ctx, enterpriseId, 30),
      
      // Risk alerts
      getRiskAlerts(ctx, enterpriseId),
      
      // Spend analysis
      getSpendAnalysis(ctx, enterpriseId)
    ]);
    
    // Enrich contracts with vendor data
    const vendorMap = new Map(vendors.map(v => [v._id, v]));
    const enrichedContracts = contracts.map(contract => ({
      ...contract,
      vendor: vendorMap.get(contract.vendorId)
    }));
    
    return {
      stats: contractStats,
      contracts: enrichedContracts,
      vendors,
      recentActivity,
      upcomingRenewals,
      riskAlerts,
      spendAnalysis,
      lastUpdated: Date.now(),
    };
  },
});

/**
 * Get contract statistics
 */
async function getContractStats(ctx: QueryCtx, enterpriseId: Id<"enterprises">) {
  const contracts = await ctx.db
    .query("contracts")
    .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
    .collect();
  
  const now = new Date();
  const stats = {
    total: contracts.length,
    active: 0,
    expiringSoon: 0,
    totalValue: 0,
    avgValue: 0,
    byStatus: {} as Record<string, number>,
    byType: {} as Record<string, number>,
  };
  
  contracts.forEach((contract: Doc<"contracts">) => {
    // Status counts
    stats.byStatus[contract.status] = (stats.byStatus[contract.status] || 0) + 1;
    
    // Type counts
    if (contract.contractType) {
      stats.byType[contract.contractType] = (stats.byType[contract.contractType] || 0) + 1;
    }
    
    // Active contracts
    if (contract.status === "active") {
      stats.active++;
    }
    
    // Expiring soon (within 30 days)
    if (contract.extractedEndDate) {
      const endDate = new Date(contract.extractedEndDate);
      const daysUntilExpiry = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry >= 0 && daysUntilExpiry <= 30) {
        stats.expiringSoon++;
      }
    }
    
    // Value calculations
    if (contract.extractedPricing) {
      const value = parseFloat(contract.extractedPricing.replace(/[^0-9.-]+/g, ""));
      if (!isNaN(value)) {
        stats.totalValue += value;
      }
    }
  });
  
  stats.avgValue = stats.total > 0 ? stats.totalValue / stats.total : 0;
  
  return stats;
}

/**
 * Get recent activity
 */
async function getRecentActivity(ctx: QueryCtx, enterpriseId: Id<"enterprises">, limit: number) {
  // In a real implementation, this would query an activity/audit log table
  // For now, we'll use recent contract updates
  const recentContracts = await ctx.db
    .query("contracts")
    .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
    .order("desc")
    .take(limit);
  
  return recentContracts.map((contract: Doc<"contracts">) => ({
    id: contract._id,
    type: "contract_updated",
    title: contract.title,
    timestamp: contract._creationTime,
    status: contract.status,
  }));
}

/**
 * Get upcoming renewals
 */
async function getUpcomingRenewals(ctx: QueryCtx, enterpriseId: Id<"enterprises">, daysAhead: number) {
  const contracts = await ctx.db
    .query("contracts")
    .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
    .filter((q: any) => q.eq(q.field("status"), "active"))
    .collect();
  
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  
  return contracts
    .filter((contract: Doc<"contracts">) => {
      if (!contract.extractedEndDate) return false;
      const endDate = new Date(contract.extractedEndDate);
      return endDate >= now && endDate <= futureDate;
    })
    .sort((a: Doc<"contracts">, b: Doc<"contracts">) => {
      const aDate = new Date(a.extractedEndDate!).getTime();
      const bDate = new Date(b.extractedEndDate!).getTime();
      return aDate - bDate;
    })
    .slice(0, 10); // Limit to 10 upcoming renewals
}

/**
 * Get risk alerts
 */
async function getRiskAlerts(ctx: QueryCtx, enterpriseId: Id<"enterprises">) {
  const [expiringContracts, highValueContracts, vendorsWithoutContracts] = await Promise.all([
    // Contracts expiring in next 7 days without renewal
    ctx.db
      .query("contracts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect()
      .then((contracts: Doc<"contracts">[]) => {
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return contracts.filter(c => {
          if (!c.extractedEndDate) return false;
          const endDate = new Date(c.extractedEndDate);
          return endDate >= now && endDate <= sevenDaysFromNow;
        });
      }),
    
    // High value contracts without proper review
    ctx.db
      .query("contracts")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
      .filter((q: any) => q.eq(q.field("analysisStatus"), "pending"))
      .collect()
      .then((contracts: Doc<"contracts">[]) => {
        return contracts.filter(c => {
          if (!c.extractedPricing) return false;
          const value = parseFloat(c.extractedPricing.replace(/[^0-9.-]+/g, ""));
          return !isNaN(value) && value > 100000; // High value threshold
        });
      }),
    
    // Vendors without active contracts
    ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
      .filter((q: any) => q.eq(q.field("status"), "active"))
      .collect()
      .then(async (vendors: Doc<"vendors">[]) => {
        const vendorsWithoutContracts = [];
        for (const vendor of vendors) {
          const contracts = await ctx.db
            .query("contracts")
            .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
            .filter((q: any) => 
              q.and(
                q.eq(q.field("vendorId"), vendor._id),
                q.eq(q.field("status"), "active")
              )
            )
            .first();
          
          if (!contracts) {
            vendorsWithoutContracts.push(vendor);
          }
        }
        return vendorsWithoutContracts.slice(0, 5);
      }),
  ]);
  
  return {
    expiringContracts: expiringContracts.length,
    highValueContracts: highValueContracts.length,
    vendorsWithoutContracts: vendorsWithoutContracts.length,
    alerts: [
      ...expiringContracts.map(c => ({
        type: "expiring_soon" as const,
        severity: "high" as const,
        title: `${c.title} expiring soon`,
        contractId: c._id,
      })),
      ...highValueContracts.map(c => ({
        type: "needs_review" as const,
        severity: "medium" as const,
        title: `High value contract needs review: ${c.title}`,
        contractId: c._id,
      })),
      ...vendorsWithoutContracts.map(v => ({
        type: "vendor_no_contract" as const,
        severity: "low" as const,
        title: `Vendor ${v.name} has no active contracts`,
        vendorId: v._id,
      })),
    ].slice(0, 10), // Limit to 10 alerts
  };
}

/**
 * Get spend analysis
 */
async function getSpendAnalysis(ctx: QueryCtx, enterpriseId: Id<"enterprises">) {
  const contracts = await ctx.db
    .query("contracts")
    .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
    .filter((q: any) => q.eq(q.field("status"), "active"))
    .collect();
  
  const spendByCategory: Record<string, number> = {};
  const spendByVendor: Record<string, { name: string; amount: number }> = {};
  const monthlySpend: Record<string, number> = {};
  let totalSpend = 0;
  
  // Get vendor data for names
  const vendorIds = Array.from(new Set(contracts.map((c: Doc<"contracts">) => c.vendorId)));
  const vendors = await ctx.db
    .query("vendors")
    .filter((q: any) => q.or(...vendorIds.map(id => q.eq(q.field("_id"), id))))
    .collect();
  
  const vendorMap = new Map(vendors.map((v: Doc<"vendors">) => [v._id, v]));
  
  contracts.forEach((contract: Doc<"contracts">) => {
    if (!contract.extractedPricing) return;
    
    const value = parseFloat(contract.extractedPricing.replace(/[^0-9.-]+/g, ""));
    if (isNaN(value)) return;
    
    totalSpend += value;
    
    // By category (using contract type as proxy)
    const category = contract.contractType || "other";
    spendByCategory[category] = (spendByCategory[category] || 0) + value;
    
    // By vendor
    const vendor = vendorMap.get(contract.vendorId);
    if (vendor) {
      if (!spendByVendor[contract.vendorId]) {
        spendByVendor[contract.vendorId] = { name: vendor.name, amount: 0 };
      }
      spendByVendor[contract.vendorId].amount += value;
    }
    
    // Monthly spend (simplified - assumes annual contracts)
    const monthlyAmount = value / 12;
    const currentMonth = new Date().toISOString().slice(0, 7);
    monthlySpend[currentMonth] = (monthlySpend[currentMonth] || 0) + monthlyAmount;
  });
  
  // Get top vendors by spend
  const topVendors = Object.entries(spendByVendor)
    .sort(([, a], [, b]) => b.amount - a.amount)
    .slice(0, 5)
    .map(([id, data]) => ({
      vendorId: id,
      name: data.name,
      amount: data.amount,
      percentage: (data.amount / totalSpend) * 100,
    }));
  
  return {
    totalSpend,
    spendByCategory,
    topVendors,
    monthlySpend,
    avgContractValue: contracts.length > 0 ? totalSpend / contracts.length : 0,
  };
}