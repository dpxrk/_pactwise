// TODO: Fix test imports when ConvexTestingHelper is available
/*
import { expect, test, describe, beforeEach, vi } from "vitest";
import { ConvexTestingHelper } from "convex-test";
import { getContractsOptimized, getContractByIdOptimized, bulkUpdateContractStatus } from "../contracts";
import { api } from "../../_generated/api";

describe("Optimized Contract Queries", () => {
  let t: ConvexTestingHelper;

  beforeEach(async () => {
    t = new ConvexTestingHelper();
    await t.reset();
  });

  describe("getContractsOptimized", () => {
    test("should paginate contracts correctly", async () => {
      // Setup test data
      const enterpriseId = await t.mutation(api.enterprises.create, {
        name: "Test Enterprise",
      });

      // Create 25 contracts
      const contractIds = [];
      for (let i = 0; i < 25; i++) {
        const id = await t.mutation(api.contracts.createContract, {
          enterpriseId,
          title: `Contract ${i}`,
          storageId: "test_storage_id",
          fileName: `contract_${i}.pdf`,
          fileType: "application/pdf",
        });
        contractIds.push(id);
      }

      // Test first page
      const firstPage = await t.query(api.optimized.contracts.getContractsOptimized, {
        enterpriseId,
        limit: 10,
      });

      expect(firstPage.contracts).toHaveLength(10);
      expect(firstPage.hasMore).toBe(true);
      expect(firstPage.nextCursor).toBeDefined();

      // Test second page
      const secondPage = await t.query(api.optimized.contracts.getContractsOptimized, {
        enterpriseId,
        limit: 10,
        cursor: firstPage.nextCursor,
      });

      expect(secondPage.contracts).toHaveLength(10);
      expect(secondPage.hasMore).toBe(true);

      // Test last page
      const lastPage = await t.query(api.optimized.contracts.getContractsOptimized, {
        enterpriseId,
        limit: 10,
        cursor: secondPage.nextCursor,
      });

      expect(lastPage.contracts).toHaveLength(5);
      expect(lastPage.hasMore).toBe(false);
      expect(lastPage.nextCursor).toBeNull();
    });

    test("should batch fetch vendors efficiently", async () => {
      const enterpriseId = await t.mutation(api.enterprises.create, {
        name: "Test Enterprise",
      });

      // Create vendors
      const vendorIds = [];
      for (let i = 0; i < 5; i++) {
        const id = await t.mutation(api.vendors.create, {
          enterpriseId,
          name: `Vendor ${i}`,
        });
        vendorIds.push(id);
      }

      // Create contracts with vendors
      for (let i = 0; i < 10; i++) {
        await t.mutation(api.contracts.createContract, {
          enterpriseId,
          vendorId: vendorIds[i % 5],
          title: `Contract ${i}`,
          storageId: "test_storage_id",
          fileName: `contract_${i}.pdf`,
          fileType: "application/pdf",
        });
      }

      // Spy on database queries
      const querySpy = vi.spyOn(t.db, "query");

      const result = await t.query(api.optimized.contracts.getContractsOptimized, {
        enterpriseId,
        limit: 10,
      });

      // Should have vendor info without N+1 queries
      expect(result.contracts).toHaveLength(10);
      result.contracts.forEach(contract => {
        expect(contract.vendor).toBeDefined();
        expect(contract.vendor?.name).toMatch(/Vendor \d/);
      });

      // Verify batch fetching (should be 2 queries: contracts + vendors)
      const vendorQueries = querySpy.mock.calls.filter(
        call => call[0] === "vendors"
      );
      expect(vendorQueries.length).toBe(1); // Single batch query for vendors
    });

    test("should filter by status and type", async () => {
      const enterpriseId = await t.mutation(api.enterprises.create, {
        name: "Test Enterprise",
      });

      // Create contracts with different statuses and types
      await t.mutation(api.contracts.createContract, {
        enterpriseId,
        title: "Active NDA",
        contractType: "nda",
        storageId: "test_storage_id",
        fileName: "nda.pdf",
        fileType: "application/pdf",
      });

      await t.mutation(api.contracts.createContract, {
        enterpriseId,
        title: "Draft MSA",
        contractType: "msa",
        storageId: "test_storage_id",
        fileName: "msa.pdf",
        fileType: "application/pdf",
      });

      // Test status filter
      const activeContracts = await t.query(api.optimized.contracts.getContractsOptimized, {
        enterpriseId,
        status: "draft",
      });

      expect(activeContracts.contracts).toHaveLength(2);

      // Test type filter
      const ndaContracts = await t.query(api.optimized.contracts.getContractsOptimized, {
        enterpriseId,
        contractType: "nda",
      });

      expect(ndaContracts.contracts).toHaveLength(1);
      expect(ndaContracts.contracts[0].title).toBe("Active NDA");
    });
  });

  describe("bulkUpdateContractStatus", () => {
    test("should update multiple contracts in batches", async () => {
      const enterpriseId = await t.mutation(api.enterprises.create, {
        name: "Test Enterprise",
      });

      const userId = await t.mutation(api.users.create, {
        clerkId: "test_user",
        email: "test@example.com",
        enterpriseId,
        role: "admin",
      });

      // Create 60 contracts (more than batch size)
      const contractIds = [];
      for (let i = 0; i < 60; i++) {
        const id = await t.mutation(api.contracts.createContract, {
          enterpriseId,
          title: `Contract ${i}`,
          storageId: "test_storage_id",
          fileName: `contract_${i}.pdf`,
          fileType: "application/pdf",
        });
        contractIds.push(id);
      }

      // Update all contracts
      const result = await t.mutation(api.optimized.contracts.bulkUpdateContractStatus, {
        contractIds,
        newStatus: "active",
        reason: "Bulk activation",
      });

      expect(result.total).toBe(60);
      expect(result.successful).toBe(60);
      expect(result.failed).toBe(0);

      // Verify updates
      const updatedContracts = await t.query(api.optimized.contracts.getContractsOptimized, {
        enterpriseId,
        status: "active",
        limit: 100,
      });

      expect(updatedContracts.contracts.length).toBe(60);
    });

    test("should handle partial failures gracefully", async () => {
      const enterpriseId = await t.mutation(api.enterprises.create, {
        name: "Test Enterprise",
      });

      const validId = await t.mutation(api.contracts.createContract, {
        enterpriseId,
        title: "Valid Contract",
        storageId: "test_storage_id",
        fileName: "valid.pdf",
        fileType: "application/pdf",
      });

      const invalidId = "invalid_contract_id";

      const result = await t.mutation(api.optimized.contracts.bulkUpdateContractStatus, {
        contractIds: [validId, invalidId],
        newStatus: "active",
      });

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });
  });

  describe("getContractByIdOptimized", () => {
    test("should fetch all related data in parallel", async () => {
      const enterpriseId = await t.mutation(api.enterprises.create, {
        name: "Test Enterprise",
      });

      const vendorId = await t.mutation(api.vendors.create, {
        enterpriseId,
        name: "Test Vendor",
      });

      const userId = await t.mutation(api.users.create, {
        clerkId: "test_user",
        email: "test@example.com",
        enterpriseId,
        role: "admin",
      });

      const contractId = await t.mutation(api.contracts.createContract, {
        enterpriseId,
        vendorId,
        title: "Test Contract",
        storageId: "test_storage_id",
        fileName: "test.pdf",
        fileType: "application/pdf",
      });

      // Add assignment
      await t.mutation(api.contracts.assignContract, {
        contractId,
        userId,
        assignmentType: "owner",
      });

      const result = await t.query(api.optimized.contracts.getContractByIdOptimized, {
        contractId,
      });

      expect(result._id).toBe(contractId);
      expect(result.vendor).toBeDefined();
      expect(result.vendor?.name).toBe("Test Vendor");
      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].user).toBeDefined();
      expect(result.statusHistory).toBeDefined();
      expect(result.pendingApprovals).toBeDefined();
    });
  });
});

describe("Performance Benchmarks", () => {
  let t: ConvexTestingHelper;

  beforeEach(async () => {
    t = new ConvexTestingHelper();
    await t.reset();
  });

  test("should handle 1000+ contracts efficiently", async () => {
    const enterpriseId = await t.mutation(api.enterprises.create, {
      name: "Large Enterprise",
    });

    // Create 1000 contracts
    console.time("Create 1000 contracts");
    const createPromises = [];
    for (let i = 0; i < 1000; i++) {
      createPromises.push(
        t.mutation(api.contracts.createContract, {
          enterpriseId,
          title: `Contract ${i}`,
          storageId: "test_storage_id",
          fileName: `contract_${i}.pdf`,
          fileType: "application/pdf",
        })
      );
    }
    await Promise.all(createPromises);
    console.timeEnd("Create 1000 contracts");

    // Test query performance
    console.time("Query first page");
    const firstPage = await t.query(api.optimized.contracts.getContractsOptimized, {
      enterpriseId,
      limit: 50,
    });
    console.timeEnd("Query first page");

    expect(firstPage.contracts).toHaveLength(50);
    expect(firstPage.hasMore).toBe(true);

    // Paginate through all results
    let totalFetched = 50;
    let cursor = firstPage.nextCursor;
    
    console.time("Paginate through 1000 contracts");
    while (cursor) {
      const page = await t.query(api.optimized.contracts.getContractsOptimized, {
        enterpriseId,
        limit: 50,
        cursor,
      });
      totalFetched += page.contracts.length;
      cursor = page.nextCursor;
    }
    console.timeEnd("Paginate through 1000 contracts");

    expect(totalFetched).toBe(1000);
  });
});*/
