// src/lib/api-client.ts
import { useState, useMemo } from 'react';
import { api } from "../../convex/_generated/api"; // Correct path to generated API
import { useQuery, useMutation, useAction } from "convex/react";
import type {
    FunctionReference,
    FunctionArgs,
    FunctionReturnType
} from "convex/server";
import { Id } from '../../convex/_generated/dataModel'; // Correct path to generated dataModel
import type { VendorCategory } from '@/types/vendor.types'; // Import VendorCategory
import type { ContractTypeEnum } from '@/types/contract.types'; // Import ContractTypeEnum

// Define a constant for skipping queries cleanly
const SKIP_TOKEN = 'skip' as const;

/**
 * Custom hook for Convex queries with simplified loading/error handling.
 * Handles undefined state during loading and returns data, loading state, and error.
 * Supports skipping the query by passing SKIP_TOKEN as args.
 */
export function useConvexQuery<
    Query extends FunctionReference<"query">
>(
  queryFn: Query,
  args: FunctionArgs<Query> | typeof SKIP_TOKEN
) {
    const stableArgs = useMemo(() => args, [JSON.stringify(args)]);

    const result = useQuery(
        queryFn,
        stableArgs === SKIP_TOKEN ? SKIP_TOKEN : stableArgs
    );

    const isLoading = result === undefined && stableArgs !== SKIP_TOKEN;
    const error = result && typeof result === 'object' && 'message' in result ? result as Error : null;
    const data = (!isLoading && !error && stableArgs !== SKIP_TOKEN && result !== undefined)
                 ? result as FunctionReturnType<Query>
                 : null;

    return { data, isLoading, error };
}

/**
 * Custom hook for Convex mutations with loading state and error handling.
 */
export function useConvexMutation<
    Mutation extends FunctionReference<"mutation">
>(
  mutationFn: Mutation
) {
  const mutationRunner = useMutation(mutationFn);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = async (
      args: FunctionArgs<Mutation>
  ): Promise<FunctionReturnType<Mutation> | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await mutationRunner(args);
      return result as FunctionReturnType<Mutation>;
    } catch (err) {
      const caughtError = err instanceof Error ? err : new Error(String(err));
      console.error(`Mutation failed:`, caughtError);
      setError(caughtError);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { execute, isLoading, error };
}


export function useConvexAction<Action extends FunctionReference<"action">> (
  actionFn: Action
) {
  const actionRunner = useAction(actionFn);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = async (
    args: FunctionArgs<Action>
  ): Promise<FunctionReturnType<Action> | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await actionRunner(args);
      return result as FunctionReturnType<Action>;
    } catch (err) {
      const caughtError = err instanceof Error ? err : new Error(String(err));
      console.error(`Action failed:`, caughtError);
      setError(caughtError);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { execute, isLoading, error };
}

// ============================================================================
// Vendor API Hooks
// ============================================================================

/**
 * Args type for fetching vendors.
 * Includes enterpriseId (required) and optional category filter.
 */
interface UseVendorsArgs {
  enterpriseId: Id<"enterprises">;
  category?: VendorCategory | "all"; // Use the imported VendorCategory type
}

/**
 * Hook to fetch vendors for a specific enterprise, with optional category filter.
 * @param args - Object containing enterpriseId and optional category.
 * Pass null/undefined or use SKIP_TOKEN to skip the query.
 */
export const useVendors = (args: UseVendorsArgs | null | undefined | typeof SKIP_TOKEN) => {
  return useConvexQuery(
      api.vendors.getVendors,
      args === SKIP_TOKEN || !args || !args.enterpriseId ? SKIP_TOKEN : args
  );
};

/**
 * Args type for fetching a single vendor.
 */
interface UseVendorArgs {
    vendorId: Id<"vendors">;
    enterpriseId: Id<"enterprises">; // For access control
}

/**
 * Hook to fetch a single vendor by its ID, ensuring it belongs to the enterprise.
 * @param args - Object containing vendorId and enterpriseId.
 * Pass null/undefined or use SKIP_TOKEN to skip.
 */
export const useVendor = (args: UseVendorArgs | null | undefined | typeof SKIP_TOKEN) => {
   return useConvexQuery(
       api.vendors.getVendorById,
       args === SKIP_TOKEN || !args || !args.vendorId || !args.enterpriseId ? SKIP_TOKEN : args
   );
};

export const useCreateVendor = () => {
  return useConvexMutation(api.vendors.createVendor);
};

export const useUpdateVendor = () => {
  return useConvexMutation(api.vendors.updateVendor);
};

export const useDeleteVendor = () => {
  return useConvexMutation(api.vendors.deleteVendor);
};


// ============================================================================
// Contract API Hooks
// ============================================================================

export const useGenerateUploadUrl = () => {
    return useConvexMutation(api.contracts.generateUploadUrl);
};

export const useCreateContract = () => {
  return useConvexMutation(api.contracts.createContract);
};

/**
 * Args type for fetching contracts for an enterprise.
 */
interface UseContractsArgs {
    enterpriseId: Id<"enterprises">;
    contractType?: ContractTypeEnum | "all"; // Use imported ContractTypeEnum
    // Add other filters if your getContracts query supports them (e.g., status)
    status?: string; // Example
}

/**
 * Hook to fetch contracts for a specific enterprise, with optional filters.
 * @param args - Object containing enterpriseId and optional filters like contractType.
 * Pass null/undefined or use SKIP_TOKEN to skip.
 */
export const useContracts = (args: UseContractsArgs | null | undefined | typeof SKIP_TOKEN) => {
    return useConvexQuery(
        api.contracts.getContracts,
        args === SKIP_TOKEN || !args || !args.enterpriseId
            ? SKIP_TOKEN
            : {
                  ...args,
                  // Explicitly narrow status to allowed values if present
                  status: args.status as
                      | "draft"
                      | "pending_analysis"
                      | "active"
                      | "expired"
                      | "terminated"
                      | "archived"
                      | "all"
                      | undefined,
                  contractType: args.contractType as
                      | "other"
                      | "nda"
                      | "msa"
                      | "sow"
                      | "saas"
                      | "lease"
                      | "employment"
                      | "partnership"
                      | "all"
                      | undefined,
              }
    );
  }

/**
 * Args type for fetching contracts by vendor.
 */
interface UseContractsByVendorArgs {
    vendorId: Id<"vendors">;
    enterpriseId: Id<"enterprises">; // To scope contracts to the enterprise
}
/**
 * Hook to fetch contracts associated with a specific vendor within an enterprise.
 * @param args - Object containing vendorId and enterpriseId.
 * Pass null/undefined or use SKIP_TOKEN to skip.
 */
export const useContractsByVendor = (args: UseContractsByVendorArgs | null | undefined | typeof SKIP_TOKEN) => {
  return useConvexQuery(
    api.contracts.getContractsByVendor,
    args === SKIP_TOKEN || !args || !args.vendorId || !args.enterpriseId ? SKIP_TOKEN : args
  );
};

/**
 * Args type for fetching a single contract.
 */
interface UseContractArgs {
    contractId: Id<"contracts">;
    enterpriseId: Id<"enterprises">; // For access control
}

/**
 * Hook to fetch a single contract by its ID, ensuring it belongs to the enterprise.
 * @param args - Object containing contractId and enterpriseId.
 * Pass null/undefined or use SKIP_TOKEN to skip.
 */
export const useContract = (args: UseContractArgs | null | undefined | typeof SKIP_TOKEN) => {
   return useConvexQuery(
       api.contracts.getContractById,
       args === SKIP_TOKEN || !args || !args.contractId || !args.enterpriseId ? SKIP_TOKEN : args
   );
};

export const useUpdateContract = () => {
  return useConvexMutation(api.contracts.updateContract);
};

export const useDeleteContract = () => {
  return useConvexMutation(api.contracts.deleteContract);
};

export const useContractFileUrl = (storageId: Id<"_storage"> | null | undefined | typeof SKIP_TOKEN) => {
    return useConvexQuery(
        api.contracts.getContractFileUrl,
        storageId === SKIP_TOKEN || !storageId ? SKIP_TOKEN : { storageId }
    );
};


// ============================================================================
// Direct API Client Export (Optional)
// ============================================================================
export const apiClient = {
  vendors: {
    create: api.vendors.createVendor,
    list: api.vendors.getVendors,
    get: api.vendors.getVendorById,
    update: api.vendors.updateVendor,
    delete: api.vendors.deleteVendor,
  },
  contracts: {
    generateUploadUrl: api.contracts.generateUploadUrl,
    create: api.contracts.createContract,
    list: api.contracts.getContracts, // Changed from listByVendor to general list
    listByVendor: api.contracts.getContractsByVendor,
    get: api.contracts.getContractById,
    getFileUrl: api.contracts.getContractFileUrl,
    update: api.contracts.updateContract,
    delete: api.contracts.deleteContract,
    // analysis functions are internal
  },
  // enterprises: { // Example if you add enterprise functions
  //   get: api.enterprises.getEnterpriseById,
  // }
};