// src/lib/api-client.ts
import {useState} from 'react'
import { api } from "../../convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import type { DefaultFunctionArgs, FunctionReference } from "convex/server";
import { Id } from '../../convex/_generated/dataModel';

/**
 * Custom hook to handle API loading states and errors
 * @param queryFn Convex query function
 * @param args Arguments to pass to the query
 * @returns Object containing data, loading state, and error
 */
export function useConvexQuery<T extends DefaultFunctionArgs>(
  queryFn: FunctionReference<"query", "public", T>,
  args?: any, // Allow args to be potentially undefined
) {

  const result = useQuery(queryFn, args);
  const isLoading = result === undefined;
  const error = result instanceof Error ? result : null;
  const data = !isLoading && !error ? result : null;

  return { data, isLoading, error };
}

/**
 * Custom hook for Convex mutations with better error handling
 * @param mutationFn Convex mutation function
 * @returns Object containing mutation function, loading state, and error
 */
export function useConvexMutation<T extends DefaultFunctionArgs,>(
  mutationFn: FunctionReference<"mutation", "public", T>
) {
  const mutationRunner = useMutation(mutationFn);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = async (args:any): Promise<T | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await mutationRunner(args);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { execute, isLoading, error };
}

/**
 * Contract API hooks
 */

// Define expected args type (adjust based on your actual listContracts backend args)
type ListContractsArgs = {
  enterpriseId: Id<"enterprises">;
  status?: string; // Optional status filter
  limit?: number;   // Optional limit
};

export const useContracts = (args?: ListContractsArgs | null) => {
  console.log("useContracts - received args:", args);

  if (!args?.enterpriseId) {
    console.log("useContracts - Skipping query, enterpriseId missing in args.");
    // Return default state if required ID is missing
    return { data: null, isLoading: false, error: null };
  }

  // If enterpriseId exists, proceed with the query
  console.log("useContracts - Calling useConvexQuery with args:", args);
  return useConvexQuery(api.contracts.listContracts, args);
};


export const useContract = (contractId: Id<"contracts"> | undefined | null) => {
   if (!contractId) {
       console.log("useContract - Skipping query, contractId missing.");
       return { data: null, isLoading: false, error: null };
   }
   return useConvexQuery(api.contracts.getContract, { contractId });
};

export const useCreateContract = () => {
  return useConvexMutation(api.contracts.createContract);
};

export const useUpdateContract = () => {
  return useConvexMutation(api.contracts.updateContract);
};


export const useExpiringContracts = (daysThreshold: number = 30, enterpriseId?: Id<"enterprises"> | null) => {
  console.log("useExpiringContracts - received enterpriseId:", enterpriseId);

  
  if (!enterpriseId) {
    console.log("useExpiringContracts - Skipping query, enterpriseId is missing.");
    
    return { data: null, isLoading: false, error: null };
  }

 
  const args = { daysThreshold, enterpriseId };
  console.log("useExpiringContracts - Calling useConvexQuery with args:", args);
  return useConvexQuery(api.contracts.getExpiringContracts, args);
};


export const useContractAnalytics = (enterpriseId: Id<"enterprises"> | undefined | null) => {
  console.log("useContractAnalytics - received enterpriseId:", enterpriseId);


  if (!enterpriseId) {
    console.log("useContractAnalytics - Skipping query, enterpriseId is missing.");
    return { data: null, isLoading: false, error: null };
  }
  const args = { enterpriseId };
  console.log("useContractAnalytics - Calling useConvexQuery with args:", args);
  return useConvexQuery(api.contracts.getContractAnalytics, args);
};

/**
 * Vendor API hooks
 */

// Define expected args type
type ListVendorsArgs = {
  enterpriseId: Id<"enterprises">;
  // Add other optional filters if needed
};

export const useVendors = (args?: ListVendorsArgs | null) => {
  console.log("useVendors - received args:", args);

  if (!args?.enterpriseId) {
    console.log("useVendors - Skipping query, enterpriseId missing in args.");
    return { data: null, isLoading: false, error: null };
  }

  // If enterpriseId exists, proceed with the query
  console.log("useVendors - Calling useConvexQuery with args:", args);
  return useConvexQuery(api.vendors.listVendors, args);
};



export const useVendor = (vendorId: Id<"vendors"> | undefined | null) => {
   if (!vendorId) {
       console.log("useVendor - Skipping query, vendorId missing.");
       return { data: null, isLoading: false, error: null };
   }
   // Assuming backend expects { vendorId: Id<"vendors"> }
   return useConvexQuery(api.vendors.getVendor, { vendorId });
};

export const useCreateVendor = () => {
  return useConvexMutation(api.vendors.createVendor);
};

export const useUpdateVendor = () => {
  return useConvexMutation(api.vendors.updateVendor);
};

export const useAddVendorContact = () => {
  return useConvexMutation(api.vendors.addVendorContact);
};

/**
 * User API hooks
 */
export const useCurrentUser = () => {
  // Assuming getCurrentUser does not require arguments
  return useConvexQuery(api.users.getCurrentUser);
};

export const useUpdateProfile = () => {
  return useConvexMutation(api.users.updateUserProfile);
};

export const useMarkNotificationRead = () => {
  return useConvexMutation(api.users.markNotificationRead);
};

export const useMarkAllNotificationsRead = () => {
  return useConvexMutation(api.users.markAllNotificationsRead);
};

// Export API functions directly for use in components
export const apiClient = {
  contracts: {
    list: api.contracts.listContracts,
    get: api.contracts.getContract,
    create: api.contracts.createContract,
    update: api.contracts.updateContract,
    getExpiring: api.contracts.getExpiringContracts,
    getAnalytics: api.contracts.getContractAnalytics,
  },
  vendors: {
    list: api.vendors.listVendors,
    get: api.vendors.getVendor,
    create: api.vendors.createVendor,
    update: api.vendors.updateVendor,
    addContact: api.vendors.addVendorContact,
  },
  users: {
    getCurrentUser: api.users.getCurrentUser,
    updateProfile: api.users.updateUserProfile,
    markNotificationRead: api.users.markNotificationRead,
    markAllNotificationsRead: api.users.markAllNotificationsRead,
  },
};