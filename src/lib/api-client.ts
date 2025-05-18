// src/lib/api-client.ts
import { useState, useMemo } from 'react';
import { api } from "../../convex/_generated/api"; // Correct path to generated API
import { useQuery, useMutation } from "convex/react";
import type {
    FunctionReference,
    FunctionArgs,     // Import FunctionArgs
    FunctionReturnType // Import FunctionReturnType
} from "convex/server";
import { Id } from '../../convex/_generated/dataModel'; // Correct path to generated dataModel

// Define a constant for skipping queries cleanly
const SKIP_TOKEN = 'skip' as const;

/**
 * Custom hook for Convex queries with simplified loading/error handling.
 * Handles undefined state during loading and returns data, loading state, and error.
 * Supports skipping the query by passing SKIP_TOKEN as args.
 *
 * @template Query - The type of the Convex query function reference.
 * @param queryFn - The Convex query function reference (e.g., api.vendors.getVendors).
 * @param args - Arguments for the query function, or SKIP_TOKEN to skip the query.
 */
export function useConvexQuery<
    Query extends FunctionReference<"query">
>(
  queryFn: Query,
  args: FunctionArgs<Query> | typeof SKIP_TOKEN // Use FunctionArgs or skip token
) {
    // Use useMemo to prevent re-running query if args object reference changes but value is same
    // Convex's useQuery does shallow equality checks, so this might be slightly redundant
    // but can be helpful if args are complex objects constructed inline.
    const stableArgs = useMemo(() => args, [JSON.stringify(args)]); // Basic stabilization

    const result = useQuery(
        queryFn,      
        stableArgs === SKIP_TOKEN ? SKIP_TOKEN : stableArgs // Pass SKIP_TOKEN to Convex hook if needed
    );

    const isLoading = result === undefined && stableArgs !== SKIP_TOKEN;
    // Check if result is an Error without using instanceof
    const error = result && typeof result === 'object' && 'message' in result ? result as Error : null;
    // Ensure data is only returned when not loading, no error, and query wasn't skipped
    const data = (!isLoading && !error && stableArgs !== SKIP_TOKEN && result !== undefined)
                 ? result as FunctionReturnType<Query> // Assert type when successful
                 : null;

    return { data, isLoading, error };
}

/**
 * Custom hook for Convex mutations with loading state and error handling.
 *
 * @template Mutation - The type of the Convex mutation function reference.
 * @returns Object containing execute function, loading state, and error.
 */
export function useConvexMutation<
    Mutation extends FunctionReference<"mutation">
>(
  mutationFn: Mutation
) {
  const mutationRunner = useMutation(mutationFn);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Executes the mutation.
   * @param args - Arguments for the mutation function.
   * @returns The result of the mutation, or null if an error occurred.
   */
  const execute = async (
      args: FunctionArgs<Mutation>
  ): Promise<FunctionReturnType<Mutation> | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await mutationRunner(args);
      return result as FunctionReturnType<Mutation>; // Assert type on success
    } catch (err) {
      // Ensure error is always an Error object
      const caughtError = err instanceof Error ? err : new Error(String(err));
      console.error(`Mutation failed:`, caughtError); // Log error without accessing .name
      setError(caughtError);
      return null; // Return null on failure
    } finally {
      setIsLoading(false);
    }
  };

  return { execute, isLoading, error };
}

// ============================================================================
// Vendor API Hooks (Aligned with simplified convex/vendors.ts)
// ============================================================================

/**
 * Hook to fetch all vendors.
 * Takes no arguments.
 */
export const useVendors = () => {
  // api.vendors.getVendors takes no arguments
  return useConvexQuery(api.vendors.getVendors, {}); // Pass empty object for args
};

/**
 * Hook to fetch a single vendor by its ID.
 * @param vendorId - The ID of the vendor, or null/undefined to skip.
 */
export const useVendor = (vendorId: Id<"vendors"> | null | undefined) => {
   return useConvexQuery(
       api.vendors.getVendorById,
       vendorId ? { vendorId } : SKIP_TOKEN // Pass args or skip token
   );
};

/**
 * Hook to create a new vendor.
 * Returns execute function, isLoading state, and error state.
 */
export const useCreateVendor = () => {
  return useConvexMutation(api.vendors.createVendor);
};

/**
 * Hook to update an existing vendor.
 * Returns execute function, isLoading state, and error state.
 */
export const useUpdateVendor = () => {
  return useConvexMutation(api.vendors.updateVendor);
};

/**
 * Hook to delete a vendor.
 * Returns execute function, isLoading state, and error state.
 */
export const useDeleteVendor = () => {
  return useConvexMutation(api.vendors.deleteVendor);
};


// ============================================================================
// Contract API Hooks (Aligned with simplified convex/contracts.ts)
// ============================================================================

/**
 * Hook to generate a file upload URL for contracts.
 * Returns execute function, isLoading state, and error state.
 */
export const useGenerateUploadUrl = () => {
    // generateUploadUrl takes no arguments
    return useConvexMutation(api.contracts.generateUploadUrl);
};

/**
 * Hook to create a new contract record (after file upload).
 * Returns execute function, isLoading state, and error state.
 */
export const useCreateContract = () => {
  return useConvexMutation(api.contracts.createContract);
};

/**
 * Hook to fetch contracts associated with a specific vendor.
 * @param vendorId - The ID of the vendor, or null/undefined to skip.
 */
export const useContractsByVendor = (vendorId: Id<"vendors"> | null | undefined) => {
  return useConvexQuery(
    api.contracts.getContractsByVendor,
    vendorId ? { vendorId } : SKIP_TOKEN // Pass args or skip token
  );
};

/**
 * Hook to fetch a single contract by its ID.
 * @param contractId - The ID of the contract, or null/undefined to skip.
 */
export const useContract = (contractId: Id<"contracts"> | null | undefined) => {
   return useConvexQuery(
       api.contracts.getContractById,
       contractId ? { contractId } : SKIP_TOKEN // Pass args or skip token
   );
};

/**
 * Hook to update basic contract details (title, status, notes).
 * Returns execute function, isLoading state, and error state.
 */
export const useUpdateContract = () => {
  return useConvexMutation(api.contracts.updateContract);
};

/**
 * Hook to delete a contract (record and file).
 * Returns execute function, isLoading state, and error state.
 */
export const useDeleteContract = () => {
  return useConvexMutation(api.contracts.deleteContract);
};

/**
 * Hook to get the download URL for a contract file.
 * @param storageId - The _storage ID of the file, or null/undefined to skip.
 */
export const useContractFileUrl = (storageId: Id<"_storage"> | null | undefined) => {
    return useConvexQuery(
        api.contracts.getContractFileUrl,
        storageId ? { storageId } : SKIP_TOKEN // Pass args or skip token
    );
};


// ============================================================================
// Removed User/Enterprise/Analytics/Notification Hooks
// ============================================================================
// Hooks like useCurrentUser, useUpdateProfile, useExpiringContracts,
// useContractAnalytics, useAddVendorContact, useMarkNotificationRead etc.
// have been removed as their corresponding backend functions or concepts
// were removed in the simplification process. User info should generally
// be accessed via Clerk's hooks (e.g., useUser) on the frontend.


// ============================================================================
// Direct API Client Export (Optional)
// ============================================================================
// You might still want direct access sometimes, e.g., in server-side contexts
// or outside React components, though hooks are preferred in React.
// This export reflects the *actual* simplified API surface.
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
    listByVendor: api.contracts.getContractsByVendor,
    get: api.contracts.getContractById,
    getFileUrl: api.contracts.getContractFileUrl,
    update: api.contracts.updateContract,
    delete: api.contracts.deleteContract,
    // Note: analysis functions (analyzeContract, updateContractAnalysis)
    // are typically triggered internally on the backend and not directly
    // called from the client via this helper.
  },
};