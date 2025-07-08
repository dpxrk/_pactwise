import { Doc, Id, TableNames } from "../_generated/dataModel";
import { QueryCtx } from "../_generated/server";

/**
 * DataLoader implementation for Convex to prevent N+1 queries
 * This batches and caches database lookups within a single request
 */

export class ConvexDataLoader<T extends TableNames> {
  private cache = new Map<string, Doc<T> | null>();
  private batchQueue = new Map<string, Id<T>>();
  private batchPromise: Promise<void> | null = null;
  private resolvers = new Map<string, {
    resolve: (value: Doc<T> | null) => void;
    reject: (error: Error) => void;
  }>();

  constructor(
    private ctx: QueryCtx,
    private table: T,
    private batchSize = 50,
    private batchDelay = 1 // milliseconds
  ) {}

  /**
   * Load a single document by ID
   */
  async load(id: Id<T>): Promise<Doc<T> | null> {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    // Return existing promise if already loading
    if (this.resolvers.has(id)) {
      return new Promise((resolve, reject) => {
        const existing = this.resolvers.get(id)!;
        this.resolvers.set(id, {
          resolve: (value) => {
            existing.resolve(value);
            resolve(value);
          },
          reject: (error) => {
            existing.reject(error);
            reject(error);
          },
        });
      });
    }

    // Add to batch queue
    this.batchQueue.set(id, id);

    // Create promise for this ID
    const promise = new Promise<Doc<T> | null>((resolve, reject) => {
      this.resolvers.set(id, { resolve, reject });
    });

    // Schedule batch execution
    this.scheduleBatch();

    return promise;
  }

  /**
   * Load multiple documents by IDs
   */
  async loadMany(ids: Id<T>[]): Promise<(Doc<T> | null)[]> {
    return Promise.all(ids.map(id => this.load(id)));
  }

  /**
   * Prime the cache with pre-fetched data
   */
  prime(id: Id<T>, value: Doc<T> | null): void {
    this.cache.set(id, value);
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear a specific item from cache
   */
  clearItem(id: Id<T>): void {
    this.cache.delete(id);
  }

  private scheduleBatch(): void {
    if (this.batchPromise) return;

    this.batchPromise = new Promise(resolve => {
      setTimeout(() => {
        this.executeBatch().then(resolve);
      }, this.batchDelay);
    });
  }

  private async executeBatch(): Promise<void> {
    const ids = Array.from(this.batchQueue.values());
    this.batchQueue.clear();
    this.batchPromise = null;

    if (ids.length === 0) return;

    try {
      // Batch fetch all documents
      const results = await Promise.all(
        ids.map(id => this.ctx.db.get(id))
      );

      // Process results
      ids.forEach((id, index) => {
        const result = results[index];
        this.cache.set(id, result);
        
        const resolver = this.resolvers.get(id);
        if (resolver) {
          resolver.resolve(result);
          this.resolvers.delete(id);
        }
      });
    } catch (error) {
      // Reject all pending promises
      ids.forEach(id => {
        const resolver = this.resolvers.get(id);
        if (resolver) {
          resolver.reject(error as Error);
          this.resolvers.delete(id);
        }
      });
    }
  }
}

/**
 * Create a DataLoader context for a request
 */
export class DataLoaderContext {
  private loaders = new Map<string, ConvexDataLoader<any>>();

  constructor(private ctx: QueryCtx) {}

  getLoader<T extends TableNames>(table: T): ConvexDataLoader<T> {
    const key = table as string;
    if (!this.loaders.has(key)) {
      this.loaders.set(key, new ConvexDataLoader(this.ctx, table));
    }
    return this.loaders.get(key)!;
  }

  /**
   * Clear all loaders
   */
  clearAll(): void {
    this.loaders.forEach(loader => loader.clear());
    this.loaders.clear();
  }
}

/**
 * Helper to create vendor loader with relationship data
 */
export async function loadVendorWithStats(
  ctx: QueryCtx,
  loaderContext: DataLoaderContext,
  vendorId: Id<"vendors">
): Promise<{
  vendor: Doc<"vendors"> | null;
  activeContracts: number;
  totalValue: number;
}> {
  const vendorLoader = loaderContext.getLoader("vendors");
  const vendor = await vendorLoader.load(vendorId);
  
  if (!vendor) {
    return { vendor: null, activeContracts: 0, totalValue: 0 };
  }

  // Use indexes to efficiently count contracts
  const contracts = await ctx.db
    .query("contracts")
    .withIndex("by_vendorId_and_enterpriseId", q => 
      q.eq("enterpriseId", vendor.enterpriseId).eq("vendorId", vendorId)
    )
    .filter(q => q.eq(q.field("status"), "active"))
    .collect();

  const totalValue = contracts.reduce((sum, c) => sum + (c.value || 0), 0);

  return {
    vendor,
    activeContracts: contracts.length,
    totalValue,
  };
}

/**
 * Helper to batch load users for contracts
 */
export async function loadContractUsers(
  ctx: QueryCtx,
  loaderContext: DataLoaderContext,
  contracts: Doc<"contracts">[]
): Promise<Map<Id<"users">, Doc<"users">>> {
  const userLoader = loaderContext.getLoader("users");
  
  // Collect all unique user IDs
  const userIds = new Set<Id<"users">>();
  contracts.forEach(contract => {
    if (contract.ownerId) userIds.add(contract.ownerId);
    if (contract.createdBy) userIds.add(contract.createdBy);
    if (contract.lastModifiedBy) userIds.add(contract.lastModifiedBy);
  });

  // Batch load all users
  const userPromises = Array.from(userIds).map(id => 
    userLoader.load(id).then(user => [id, user] as [Id<"users">, Doc<"users"> | null])
  );
  
  const userResults = await Promise.all(userPromises);
  
  // Convert to Map for easy lookup
  const userMap = new Map<Id<"users">, Doc<"users">>();
  userResults.forEach(([id, user]) => {
    if (user) userMap.set(id, user);
  });
  
  return userMap;
}

/**
 * Helper to efficiently load contract with all related data
 */
export async function loadContractWithRelations(
  ctx: QueryCtx,
  loaderContext: DataLoaderContext,
  contractId: Id<"contracts">
): Promise<{
  contract: Doc<"contracts"> | null;
  vendor: Doc<"vendors"> | null;
  owner: Doc<"users"> | null;
  assignments: Doc<"contractAssignments">[];
  approvals: Doc<"contractApprovals">[];
}> {
  const contractLoader = loaderContext.getLoader("contracts");
  const vendorLoader = loaderContext.getLoader("vendors");
  const userLoader = loaderContext.getLoader("users");

  // Load contract
  const contract = await contractLoader.load(contractId);
  if (!contract) {
    return {
      contract: null,
      vendor: null,
      owner: null,
      assignments: [],
      approvals: [],
    };
  }

  // Load related data in parallel
  const [vendor, owner, assignments, approvals] = await Promise.all([
    contract.vendorId ? vendorLoader.load(contract.vendorId) : null,
    contract.ownerId ? userLoader.load(contract.ownerId) : null,
    ctx.db
      .query("contractAssignments")
      .withIndex("by_contract", q => q.eq("contractId", contractId))
      .filter(q => q.eq(q.field("isActive"), true))
      .collect(),
    ctx.db
      .query("contractApprovals")
      .withIndex("by_contract", q => q.eq("contractId", contractId))
      .collect(),
  ]);

  return {
    contract,
    vendor,
    owner,
    assignments,
    approvals,
  };
}