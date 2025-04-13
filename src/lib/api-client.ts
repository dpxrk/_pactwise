// // src/lib/api-client.ts
// import {useState} from 'react'
// import { api } from "../../convex/_generated/api";
// import { useQuery, useMutation } from "convex/react";
// import type { DefaultFunctionArgs, FunctionReference } from "convex/server";
// import { Id } from '../../convex/_generated/dataModel';

// /**
//  * Custom hook to handle API loading states and errors
//  * @param queryFn Convex query function
//  * @param args Arguments to pass to the query
//  * @returns Object containing data, loading state, and error
//  */
// export function useConvexQuery<T extends DefaultFunctionArgs>(
//   queryFn: FunctionReference<"query", "public", T>,
//   args?: any, // Allow args to be potentially undefined
// ) {

//   const result = useQuery(queryFn, args);
//   const isLoading = result === undefined;
//   const error = result instanceof Error ? result : null;
//   const data = !isLoading && !error ? result : null;

//   return { data, isLoading, error };
// }

// /**
//  * Custom hook for Convex mutations with better error handling
//  * @param mutationFn Convex mutation function
//  * @returns Object containing mutation function, loading state, and error
//  */
// export function useConvexMutation<T extends DefaultFunctionArgs,>(
//   mutationFn: FunctionReference<"mutation", "public", T>
// ) {
//   const mutationRunner = useMutation(mutationFn);
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState<Error | null>(null);

//   const execute = async (args:any): Promise<T | null> => {
//     setIsLoading(true);
//     setError(null);
//     try {
//       const result = await mutationRunner(args);
//       return result;
//     } catch (err) {
//       const error = err instanceof Error ? err : new Error(String(err));
//       setError(error);
//       return null;
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return { execute, isLoading, error };
// }

// /**
//  * Contract API hooks
//  */

// // Define expected args type (adjust based on your actual listContracts backend args)
// type ListContractsArgs = {
//   enterpriseId: Id<"enterprises">;
//   status?: string; // Optional status filter
//   limit?: number;   // Optional limit
// };

// export const useContracts = (args?: ListContractsArgs | null) => {
//   console.log("useContracts - received args:", args);

//   if (!args?.enterpriseId) {
//     console.log("useContracts - Skipping query, enterpriseId missing in args.");
//     // Return default state if required ID is missing
//     return { data: null, isLoading: false, error: null };
//   }

//   // If enterpriseId exists, proceed with the query
//   console.log("useContracts - Calling useConvexQuery with args:", args);
//   return useConvexQuery(api.contracts.listContracts, args);
// };


// export const useContract = (contractId: Id<"contracts"> | undefined | null) => {
//    if (!contractId) {
//        console.log("useContract - Skipping query, contractId missing.");
//        return { data: null, isLoading: false, error: null };
//    }
//    return useConvexQuery(api.contracts.getContract, { contractId });
// };

// export const useCreateContract = () => {
//   return useConvexMutation(api.contracts.createContract);
// };

// export const useUpdateContract = () => {
//   return useConvexMutation(api.contracts.updateContract);
// };


// export const useExpiringContracts = (daysThreshold: number = 30, enterpriseId?: Id<"enterprises"> | null) => {
//   console.log("useExpiringContracts - received enterpriseId:", enterpriseId);

  
//   if (!enterpriseId) {
//     console.log("useExpiringContracts - Skipping query, enterpriseId is missing.");
    
//     return { data: null, isLoading: false, error: null };
//   }

 
//   const args = { daysThreshold, enterpriseId };
//   console.log("useExpiringContracts - Calling useConvexQuery with args:", args);
//   return useConvexQuery(api.contracts.getExpiringContracts, args);
// };


// export const useContractAnalytics = (enterpriseId: Id<"enterprises"> | undefined | null) => {
//   console.log("useContractAnalytics - received enterpriseId:", enterpriseId);


//   if (!enterpriseId) {
//     console.log("useContractAnalytics - Skipping query, enterpriseId is missing.");
//     return { data: null, isLoading: false, error: null };
//   }
//   const args = { enterpriseId };
//   console.log("useContractAnalytics - Calling useConvexQuery with args:", args);
//   return useConvexQuery(api.contracts.getContractAnalytics, args);
// };

// /**
//  * Vendor API hooks
//  */

// // Define expected args type
// type ListVendorsArgs = {
//   enterpriseId: Id<"enterprises">;
//   // Add other optional filters if needed
// };

// export const useVendors = (args?: ListVendorsArgs | null) => {
//   console.log("useVendors - received args:", args);

//   if (!args?.enterpriseId) {
//     console.log("useVendors - Skipping query, enterpriseId missing in args.");
//     return { data: null, isLoading: false, error: null };
//   }

//   // If enterpriseId exists, proceed with the query
//   console.log("useVendors - Calling useConvexQuery with args:", args);
//   return useConvexQuery(api.vendors.listVendors, args);
// };



// export const useVendor = (vendorId: Id<"vendors"> | undefined | null) => {
//    if (!vendorId) {
//        console.log("useVendor - Skipping query, vendorId missing.");
//        return { data: null, isLoading: false, error: null };
//    }
//    // Assuming backend expects { vendorId: Id<"vendors"> }
//    return useConvexQuery(api.vendors.getVendor, { vendorId });
// };

// export const useCreateVendor = () => {
//   return useConvexMutation(api.vendors.createVendor);
// };

// export const useUpdateVendor = () => {
//   return useConvexMutation(api.vendors.updateVendor);
// };

// export const useAddVendorContact = () => {
//   return useConvexMutation(api.vendors.addVendorContact);
// };

// /**
//  * User API hooks
//  */
// export const useCurrentUser = () => {
//   // Assuming getCurrentUser does not require arguments
//   return useConvexQuery(api.users.getCurrentUser);
// };

// export const useUpdateProfile = () => {
//   return useConvexMutation(api.users.updateUserProfile);
// };

// export const useMarkNotificationRead = () => {
//   return useConvexMutation(api.users.markNotificationRead);
// };

// export const useMarkAllNotificationsRead = () => {
//   return useConvexMutation(api.users.markAllNotificationsRead);
// };

// // Export API functions directly for use in components
// export const apiClient = {
//   contracts: {
//     list: api.contracts.listContracts,
//     get: api.contracts.getContract,
//     create: api.contracts.createContract,
//     update: api.contracts.updateContract,
//     getExpiring: api.contracts.getExpiringContracts,
//     getAnalytics: api.contracts.getContractAnalytics,
//   },
//   vendors: {
//     list: api.vendors.listVendors,
//     get: api.vendors.getVendor,
//     create: api.vendors.createVendor,
//     update: api.vendors.updateVendor,
//     addContact: api.vendors.addVendorContact,
//   },
//   users: {
//     getCurrentUser: api.users.getCurrentUser,
//     updateProfile: api.users.updateUserProfile,
//     markNotificationRead: api.users.markNotificationRead,
//     markAllNotificationsRead: api.users.markAllNotificationsRead,
//   },
// };


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