import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

export function useVendorExistence(vendorName: string, enterpriseId: Id<"enterprises"> | undefined) {
  const result = useQuery(
    api.vendors.vendors.checkVendorExists,
    vendorName && enterpriseId ? { name: vendorName, enterpriseId } : "skip"
  );

  return {
    exists: result?.exists ?? null,
    vendor: result?.vendor ?? null,
    isLoading: result === undefined && !!vendorName && !!enterpriseId,
    error: null, // Convex handles errors internally
  };
}