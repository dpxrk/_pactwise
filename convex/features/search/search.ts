// convex/search.ts
import { query, QueryCtx } from "../../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { Id, Doc } from "../../_generated/dataModel";
import { ContractEntity, UserEntity, VendorEntity, ContractFilters, ContractFacets, VendorFacets, UserFacets, SearchResult } from "../../shared/types";

// ============================================================================
// SEARCH CONFIGURATION
// ============================================================================

const SEARCH_CONFIG = {
  minQueryLength: 2,
  maxResults: 50,
  defaultLimit: 20,
  searchFields: {
    contracts: ['title', 'fileName', 'notes', 'extractedParties', 'extractedScope'],
    vendors: ['name', 'contactEmail', 'website', 'notes', 'address'],
    users: ['firstName', 'lastName', 'email', 'department', 'title'],
  },
 
  fieldWeights: {
    // Contract fields
    'contracts.title': 3.0,
    'contracts.fileName': 2.0,
    'contracts.extractedParties': 2.5,
    'contracts.extractedScope': 1.5,
    'contracts.notes': 1.0,
    // Vendor fields
    'vendors.name': 3.0,
    'vendors.contactEmail': 2.0,
    'vendors.website': 1.5,
    'vendors.notes': 1.0,
    'vendors.address': 1.0,
    // User fields
    'users.firstName': 2.5,
    'users.lastName': 2.5,
    'users.email': 2.0,
    'users.department': 1.5,
    'users.title': 1.5,
  },
};

// ============================================================================
// UNIFIED SEARCH
// ============================================================================

/**
 * Search across all entities (contracts, vendors, users)
 */
export const searchAll = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Get current user and their enterprise
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser) {
      throw new ConvexError("User not found");
    }

    // Validate search query
    const searchQuery = args.query.trim().toLowerCase();
    if (searchQuery.length < SEARCH_CONFIG.minQueryLength) {
      return {
        contracts: [],
        vendors: [],
        users: [],
        totalResults: 0,
        query: searchQuery,
      };
    }

    const limit = Math.min(args.limit || SEARCH_CONFIG.defaultLimit, SEARCH_CONFIG.maxResults);

    // Search in parallel
    const [contractResults, vendorResults, userResults] = await Promise.all([
      searchContracts(ctx, currentUser.enterpriseId, searchQuery, limit, args.includeArchived),
      searchVendors(ctx, currentUser.enterpriseId, searchQuery, limit),
      searchUsers(ctx, currentUser.enterpriseId, searchQuery, limit, currentUser),
    ]);

    // Combine and sort by relevance
    const allResults = [
      ...contractResults.map(r => ({ ...r, type: 'contract' as const })),
      ...vendorResults.map(r => ({ ...r, type: 'vendor' as const })),
      ...userResults.map(r => ({ ...r, type: 'user' as const })),
    ].sort((a, b) => b.score - a.score);

    return {
      results: allResults.slice(0, limit),
      byType: {
        contracts: contractResults.slice(0, Math.floor(limit / 3)),
        vendors: vendorResults.slice(0, Math.floor(limit / 3)),
        users: userResults.slice(0, Math.floor(limit / 3)),
      },
      totalResults: allResults.length,
      query: searchQuery,
    };
  },
});

// ============================================================================
// CONTRACT SEARCH
// ============================================================================

/**
 * Search contracts with advanced filters
 */
export const searchContractsWithAdvancedFilters = query({
  args: {
    query: v.string(),
    filters: v.optional(v.object({
      status: v.optional(v.array(v.string())),
      contractType: v.optional(v.array(v.string())),
      vendorId: v.optional(v.id("vendors")),
      dateRange: v.optional(v.object({
        startDate: v.string(),
        endDate: v.string(),
        dateField: v.union(v.literal("created"), v.literal("start"), v.literal("end")),
      })),
      valueRange: v.optional(v.object({
        min: v.number(),
        max: v.number(),
      })),
    })),
    sort: v.optional(v.object({
      field: v.union(
        v.literal("relevance"),
        v.literal("title"),
        v.literal("createdAt"),
        v.literal("value"),
        v.literal("endDate")
      ),
      order: v.union(v.literal("asc"), v.literal("desc")),
    })),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser) {
      throw new ConvexError("User not found");
    }

    const searchQuery = args.query.trim().toLowerCase();
    const limit = Math.min(args.limit || SEARCH_CONFIG.defaultLimit, SEARCH_CONFIG.maxResults);
    const offset = args.offset || 0;

    // Get contracts with filters
    let contracts = await ctx.db
      .query("contracts")
      .withIndex("by_status_and_enterpriseId", (q) => 
        q.eq("enterpriseId", currentUser.enterpriseId)
      )
      .collect();

    // Apply filters
    if (args.filters) {
      contracts = await applyContractFilters(ctx, contracts, args.filters as ContractFilters);
    }

    // Search and score
    let results: any[] = [];
    if (searchQuery.length >= SEARCH_CONFIG.minQueryLength) {
      const searchResults = await scoreContractResults(contracts, searchQuery);
      results = searchResults.map(r => ({
        ...r.item,
        relevance: r.score,
        matchedFields: r.highlights,
      }));
    } else {
      // No search query, just return filtered results
      results = contracts.map(contract => ({
        ...contract,
        relevance: 1,
        matchedFields: [],
      }));
    }

    // Sort results
    results = sortResults(results, args.sort || { field: 'relevance', order: 'desc' });

    // Paginate
    const paginatedResults = results.slice(offset, offset + limit);

    // Enrich with vendor information
    const enrichedResults = await Promise.all(
      paginatedResults.map(async (result) => {
        const vendor = await ctx.db.get(result.vendorId as Id<"vendors">);
        return {
          ...result,
          vendor: vendor ? {
            _id: vendor._id,
            name: (vendor as any).name,
            category: (vendor as any).category,
          } : null,
        };
      })
    );

    return {
      results: enrichedResults,
      total: results.length,
      hasMore: offset + limit < results.length,
      facets: await getContractFacets(ctx, contracts),
    };
  },
});

// ============================================================================
// VENDOR SEARCH
// ============================================================================

/**
 * Search vendors with filters
 */
export const searchVendorsWithFilters = query({
  args: {
    query: v.string(),
    filters: v.optional(v.object({
      category: v.optional(v.array(v.string())),
      hasActiveContracts: v.optional(v.boolean()),
    })),
    sort: v.optional(v.object({
      field: v.union(
        v.literal("relevance"),
        v.literal("name"),
        v.literal("contractCount"),
        v.literal("totalValue")
      ),
      order: v.union(v.literal("asc"), v.literal("desc")),
    })),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser) {
      throw new ConvexError("User not found");
    }

    const searchQuery = args.query.trim().toLowerCase();
    const limit = Math.min(args.limit || SEARCH_CONFIG.defaultLimit, SEARCH_CONFIG.maxResults);

    // Get vendors
    let vendors = await ctx.db
      .query("vendors")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", currentUser.enterpriseId))
      .collect();

    // Apply category filter
    if (args.filters?.category && args.filters.category.length > 0) {
      vendors = vendors.filter(v => 
        v.category && args.filters!.category!.includes(v.category)
      );
    }

    // Search and score
    let results: any[] = [];
    if (searchQuery.length >= SEARCH_CONFIG.minQueryLength) {
      const searchResults = await scoreVendorResults(vendors, searchQuery);
      results = searchResults.map(r => ({
        ...r.item,
        relevance: r.score,
        matchedFields: r.highlights,
      }));
    } else {
      results = vendors.map(vendor => ({
        ...vendor,
        relevance: 1,
        matchedFields: [],
      }));
    }

    // Enrich with contract data
    const enrichedResults = await Promise.all(
      results.map(async (vendor) => {
        const contracts = await ctx.db
          .query("contracts")
          .withIndex("by_vendorId_and_enterpriseId", (q) =>
            q.eq("enterpriseId", currentUser.enterpriseId).eq("vendorId", vendor._id)
          )
          .collect();

        const activeContracts = contracts.filter(c => c.status === "active");
        const totalValue = contracts.reduce((sum, c) => {
          const value = parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
          return sum + value;
        }, 0);

        return {
          ...vendor,
          contractCount: contracts.length,
          activeContractCount: activeContracts.length,
          totalValue,
        };
      })
    );

    // Apply hasActiveContracts filter
    let filteredResults = enrichedResults;
    if (args.filters?.hasActiveContracts === true) {
      filteredResults = enrichedResults.filter(v => v.activeContractCount > 0);
    } else if (args.filters?.hasActiveContracts === false) {
      filteredResults = enrichedResults.filter(v => v.activeContractCount === 0);
    }

    // Sort
    const sortedResults = sortResults(filteredResults, args.sort || { field: 'relevance', order: 'desc' });

    return {
      results: sortedResults.slice(0, limit),
      total: sortedResults.length,
      facets: {
        categories: getVendorCategoryFacets(vendors),
      },
    };
  },
});

// ============================================================================
// USER SEARCH
// ============================================================================

/**
 * Search users within the enterprise
 */
export const searchUsersWithinEnterprise = query({
  args: {
    query: v.string(),
    filters: v.optional(v.object({
      role: v.optional(v.array(v.string())),
      department: v.optional(v.array(v.string())),
      isActive: v.optional(v.boolean()),
    })),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser) {
      throw new ConvexError("User not found");
    }

    const searchQuery = args.query.trim().toLowerCase();
    const limit = Math.min(args.limit || SEARCH_CONFIG.defaultLimit, SEARCH_CONFIG.maxResults);

    // Get users in the same enterprise
    let users = await ctx.db
      .query("users")
      .withIndex("by_enterprise", (q) => q.eq("enterpriseId", currentUser.enterpriseId))
      .collect();

    // Apply filters
    if (args.filters) {
      if (args.filters.role && args.filters.role.length > 0) {
        users = users.filter(u => args.filters!.role!.includes(u.role));
      }
      if (args.filters.department && args.filters.department.length > 0) {
        users = users.filter(u => u.department && args.filters!.department!.includes(u.department));
      }
      if (args.filters.isActive !== undefined) {
        users = users.filter(u => u.isActive === args.filters!.isActive);
      }
    }

    // Search and score
    let results: any[] = [];
    if (searchQuery.length >= SEARCH_CONFIG.minQueryLength) {
      const searchResults = scoreUserResults(users, searchQuery);
      results = searchResults.map(r => ({
        ...r.item,
        relevance: r.score,
        matchedFields: r.highlights,
      }));
    } else {
      results = users.map(user => ({
        ...user,
        relevance: 1,
        matchedFields: [],
      }));
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    return {
      results: results.slice(0, limit),
      total: results.length,
      facets: {
        roles: getUserRoleFacets(users),
        departments: getUserDepartmentFacets(users),
      },
    };
  },
});

// ============================================================================
// AUTOCOMPLETE
// ============================================================================

/**
 * Quick autocomplete for search suggestions
 */
export const autocomplete = query({
  args: {
    query: v.string(),
    type: v.optional(v.union(
      v.literal("all"),
      v.literal("contracts"),
      v.literal("vendors"),
      v.literal("users")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!currentUser) {
      throw new ConvexError("User not found");
    }

    const searchQuery = args.query.trim().toLowerCase();
    if (searchQuery.length < 1) {
      return { suggestions: [] };
    }

    const limit = Math.min(args.limit || 10, 20);
    const type = args.type || "all";
    const suggestions: Array<{
      value: string;
      label: string;
      type: 'contract' | 'vendor' | 'user';
      id: string;
    }> = [];

    // Get suggestions based on type
    if (type === "all" || type === "contracts") {
      const contracts = await ctx.db
        .query("contracts")
        .withIndex("by_status_and_enterpriseId", (q) => 
          q.eq("enterpriseId", currentUser.enterpriseId)
        )
        .collect();

      contracts
        .filter(c => c.title.toLowerCase().includes(searchQuery))
        .slice(0, limit)
        .forEach(c => {
          suggestions.push({
            value: c.title,
            label: c.title,
            type: 'contract',
            id: c._id,
          });
        });
    }

    if (type === "all" || type === "vendors") {
      const vendors = await ctx.db
        .query("vendors")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", currentUser.enterpriseId))
        .collect();

      vendors
        .filter(v => v.name.toLowerCase().includes(searchQuery))
        .slice(0, limit)
        .forEach(v => {
          suggestions.push({
            value: v.name,
            label: v.name,
            type: 'vendor',
            id: v._id,
          });
        });
    }

    if (type === "all" || type === "users") {
      const users = await ctx.db
        .query("users")
        .withIndex("by_enterprise", (q) => q.eq("enterpriseId", currentUser.enterpriseId))
        .collect();

      users
        .filter(u => {
          const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
          return fullName.includes(searchQuery) || u.email.toLowerCase().includes(searchQuery);
        })
        .slice(0, limit)
        .forEach(u => {
          const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
          suggestions.push({
            value: name,
            label: name,
            type: 'user',
            id: u._id,
          });
        });
    }

    return { suggestions: suggestions.slice(0, limit) };
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function searchContracts(
  ctx: QueryCtx,
  enterpriseId: Id<"enterprises">,
  query: string,
  limit: number,
  includeArchived?: boolean
): Promise<SearchResult<ContractEntity>[]> {
  let contracts = await ctx.db
    .query("contracts")
    .withIndex("by_status_and_enterpriseId", (q) => 
      q.eq("enterpriseId", enterpriseId)
    )
    .collect();

  if (!includeArchived) {
    contracts = contracts.filter((c) => c.status !== "archived");
  }

  return (await scoreContractResults(contracts, query)).slice(0, limit);
}

async function searchVendors(
  ctx: QueryCtx,
  enterpriseId: Id<"enterprises">,
  query: string,
  limit: number
): Promise<SearchResult<VendorEntity>[]> {
  const vendors = await ctx.db
    .query("vendors")
    .withIndex("by_enterprise", (q) => q.eq("enterpriseId", enterpriseId))
    .collect();

  return (await scoreVendorResults(vendors, query)).slice(0, limit);
}

async function searchUsers(
  ctx: QueryCtx,
  enterpriseId: Id<"enterprises">,
  query: string,
  limit: number,
  currentUser: UserEntity
): Promise<SearchResult<UserEntity>[]> {
  let users = await ctx.db
    .query("users")
    .withIndex("by_enterprise", (q: any) => q.eq("enterpriseId", enterpriseId))
    .collect();

  // Only show active users by default
  users = users.filter((u: any) => u.isActive !== false);

  return scoreUserResults(users, query).slice(0, limit);
}

async function scoreContractResults(contracts: Doc<"contracts">[], query: string): Promise<SearchResult<ContractEntity>[]> {
  return contracts
    .map(contract => {
      let relevance = 0;
      const matchedFields: string[] = [];

      // Check each searchable field
      SEARCH_CONFIG.searchFields.contracts.forEach(field => {
        const value = contract[field];
        if (value) {
          const fieldValue = Array.isArray(value) ? value.join(' ') : String(value);
          if (fieldValue.toLowerCase().includes(query)) {
            const key = `contracts.${field}` as keyof typeof SEARCH_CONFIG.fieldWeights;
            const weight = SEARCH_CONFIG.fieldWeights[key] ?? 1;
            relevance += weight;
            matchedFields.push(field);
          }}
      });

      return { 
        item: contract as ContractEntity, 
        score: relevance, 
        highlights: matchedFields 
      };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

async function scoreVendorResults(vendors: Doc<"vendors">[], query: string): Promise<SearchResult<VendorEntity>[]> {
  return vendors
    .map(vendor => {
      let relevance = 0;
      const matchedFields: string[] = [];

      SEARCH_CONFIG.searchFields.vendors.forEach(field => {
        const value = vendor[field];
        if (value) {
          const fieldValue = String(value);
          if (fieldValue.toLowerCase().includes(query)) {
            const key = `contracts.${field}` as keyof typeof SEARCH_CONFIG.fieldWeights;
            const weight = SEARCH_CONFIG.fieldWeights[key] ?? 1;
            relevance += weight;
            matchedFields.push(field);
          }
        }
      });

      return { 
        item: vendor as VendorEntity, 
        score: relevance, 
        highlights: matchedFields 
      };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

function scoreUserResults(users: Doc<"users">[], query: string): SearchResult<UserEntity>[] {
  return users
    .map(user => {
      let relevance = 0;
      const matchedFields: string[] = [];

      SEARCH_CONFIG.searchFields.users.forEach(field => {
        const value = user[field];
        if (value) {
          const fieldValue = String(value);
          if (fieldValue.toLowerCase().includes(query)) {
            const key = `contracts.${field}` as keyof typeof SEARCH_CONFIG.fieldWeights;
            const weight = SEARCH_CONFIG.fieldWeights[key] ?? 1;
            relevance += weight;
            matchedFields.push(field);
          }
        }
      });

      return { 
        item: user as UserEntity, 
        score: relevance, 
        highlights: matchedFields 
      };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

async function applyContractFilters(ctx: QueryCtx, contracts: Doc<"contracts">[], filters: ContractFilters): Promise<Doc<"contracts">[]> {
  let filtered = contracts;

  // Status filter
  if (filters.status && filters.status.length > 0) {
    filtered = filtered.filter(c => filters.status!.includes(c.status));
  }

  // Contract type filter
  if (filters.contractType && filters.contractType.length > 0) {
    filtered = filtered.filter(c => c.contractType && filters.contractType!.includes(c.contractType));
  }

  // Vendor filter
  if (filters.vendorId && filters.vendorId.length > 0) {
    filtered = filtered.filter(c => c.vendorId && filters.vendorId!.includes(c.vendorId));
  }

  // Date range filter
  if (filters.dateRange) {
    const { start, end } = filters.dateRange;
    filtered = filtered.filter(c => {
      const dateValue = c._creationTime ? new Date(c._creationTime).toISOString() : undefined;
      
      if (!dateValue) return false;
      
      return dateValue >= (start || '') && dateValue <= (end || '');
    });
  }

  // Value range filter
  if (filters.valueRange) {
    filtered = filtered.filter(c => {
      const value = parseFloat(c.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
      return value >= (filters.valueRange!.min || 0) && value <= (filters.valueRange!.max || 0);
    });
  }

  return filtered;
}

function sortResults(results: any[], sort: any): any[] {
  const sorted = [...results];
  
  sorted.sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sort.field) {
      case 'relevance':
        aValue = a.relevance || 0;
        bValue = b.relevance || 0;
        break;
      case 'title':
      case 'name':
        aValue = a.title || a.name || '';
        bValue = b.title || b.name || '';
        break;
      case 'createdAt':
        aValue = a._creationTime || 0;
        bValue = b._creationTime || 0;
        break;
      case 'value':
      case 'totalValue':
        aValue = a.totalValue || parseFloat(a.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
        bValue = b.totalValue || parseFloat(b.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
        break;
      case 'endDate':
        aValue = a.extractedEndDate || '';
        bValue = b.extractedEndDate || '';
        break;
      case 'contractCount':
        aValue = a.contractCount || 0;
        bValue = b.contractCount || 0;
        break;
      default:
        aValue = a[sort.field];
        bValue = b[sort.field];
    }

    if (sort.order === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  return sorted;
}

async function getContractFacets(ctx: any, contracts: any[]): Promise<any> {
  const facets = {
    status: {} as Record<string, number>,
    contractType: {} as Record<string, number>,
    valueRanges: {
      '0-10k': 0,
      '10k-50k': 0,
      '50k-100k': 0,
      '100k-500k': 0,
      '500k+': 0,
    },
  };

  contracts.forEach(contract => {
    // Status facet
    facets.status[contract.status] = (facets.status[contract.status] || 0) + 1;

    // Contract type facet
    const type = contract.contractType || 'other';
    facets.contractType[type] = (facets.contractType[type] || 0) + 1;

    // Value range facet
    const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
    if (value < 10000) {
      facets.valueRanges['0-10k']++;
    } else if (value < 50000) {
      facets.valueRanges['10k-50k']++;
    } else if (value < 100000) {
      facets.valueRanges['50k-100k']++;
    } else if (value < 500000) {
      facets.valueRanges['100k-500k']++;
    } else {
      facets.valueRanges['500k+']++;
    }
  });

  return facets;
}

function getVendorCategoryFacets(vendors: any[]): Record<string, number> {
  const facets: Record<string, number> = {};
  
  vendors.forEach(vendor => {
    const category = vendor.category || 'other';
    facets[category] = (facets[category] || 0) + 1;
  });

  return facets;
}

function getUserRoleFacets(users: any[]): Record<string, number> {
  const facets: Record<string, number> = {};
  
  users.forEach(user => {
    facets[user.role] = (facets[user.role] || 0) + 1;
  });

  return facets;
}

function getUserDepartmentFacets(users: any[]): Record<string, number> {
  const facets: Record<string, number> = {};
  
  users.forEach(user => {
    if (user.department) {
      facets[user.department] = (facets[user.department] || 0) + 1;
    }
  });

  return facets;
}