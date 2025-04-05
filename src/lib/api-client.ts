// src/lib/api-client.ts
import {useState} from 'react'
import { api } from "../../convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import type { DefaultFunctionArgs, FunctionReference, FunctionVisibility, OptionalRestArgs } from "convex/server";
import { Id } from '../../convex/_generated/dataModel';

/**
 * Custom hook to handle API loading states and errors
 * @param queryFn Convex query function
 * @param args Arguments to pass to the query
 * @returns Object containing data, loading state, and error
 */
export function useConvexQuery<T extends DefaultFunctionArgs>(
  queryFn: FunctionReference<"query", "public", T>,
  args?: any,
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
export const useContracts = () => {
  return useConvexQuery(api.contracts.listContracts);
};

export const useContract = (contractId: string) => {
  return useConvexQuery(api.contracts.getContract, { contractId });
};

export const useCreateContract = () => {
  return useConvexMutation(api.contracts.createContract);
};

export const useUpdateContract = () => {
  return useConvexMutation(api.contracts.updateContract);
};

export const useExpiringContracts = (daysThreshold: number = 30, enterpriseId: Id<"enterprises">) => {
  return useConvexQuery(api.contracts.getExpiringContracts, {
    daysThreshold, enterpriseId
  });
};

export const useContractAnalytics = () => {
  return useConvexQuery(api.contracts.getContractAnalytics);
};

/**
 * Vendor API hooks
 */
export const useVendors = () => {
  return useConvexQuery(api.vendors.listVendors);
};

export const useVendor = (vendorId: string) => {
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