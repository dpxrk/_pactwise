import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { VendorType } from "@/types/vendor.types";

interface VendorState {
  vendors: VendorType[];
  loading: boolean;
  error: string | null;

  // Vendor CRUD operations
  setVendors: (vendors: VendorType[]) => void;
  addVendor: (vendor: VendorType) => void;
  updateVendor: (id: number, vendor: Partial<VendorType>) => void;
  deleteVendor: (id: number) => void;
  fetchMoreVendors: (page: number) => Promise<void>;

  // Loading and error states
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Additional vendor-specific operations
  updateVendorStatus: (id: number, status: VendorType["status"]) => void;
  updateRiskLevel: (id: number, riskLevel: VendorType["risk_level"]) => void;
  updateComplianceScore: (id: number, score: number) => void;
  updateActiveContracts: (id: number, count: number) => void;
  addVendorSpend: (id: number, amount: number) => void;
}

const useVendorStore = create<VendorState>()(
  devtools(
    (set) => ({
      // Initial state
      vendors: [],
      loading: false,
      error: null,

      // Core actions
      setVendors: (vendors) => set({ vendors }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      // CRUD operations
      addVendor: (vendor) => {
        set((state) => ({
          vendors: [...state.vendors, vendor],
        }));
      },

      updateVendor: (id, updatedVendor) => {
        set((state) => ({
          vendors: state.vendors.map((vendor) =>
            vendor.id === id ? { ...vendor, ...updatedVendor } : vendor
          ),
        }));
      },

      deleteVendor: (id) => {
        set((state) => ({
          vendors: state.vendors.filter((vendor) => vendor.id !== id),
        }));
      },

      fetchMoreVendors: async (page: number) => {
        try {
          set({ loading: true });
          const response = await fetch(`/api/vendors?page=${page}`);
          const newVendors = await response.json();
          set((state) => ({
            vendors: [...state.vendors, ...newVendors],
            loading: false,
          }));
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
        }
      },

      // Additional vendor-specific operations
      updateVendorStatus: (id, status) => {
        set((state) => ({
          vendors: state.vendors.map((vendor) =>
            vendor.id === id ? { ...vendor, status } : vendor
          ),
        }));
      },

      updateRiskLevel: (id, riskLevel) => {
        set((state) => ({
          vendors: state.vendors.map((vendor) =>
            vendor.id === id ? { ...vendor, risk_level: riskLevel } : vendor
          ),
        }));
      },

      updateComplianceScore: (id, score) => {
        set((state) => ({
          vendors: state.vendors.map((vendor) =>
            vendor.id === id ? { ...vendor, compliance_score: score } : vendor
          ),
        }));
      },

      updateActiveContracts: (id, count) => {
        set((state) => ({
          vendors: state.vendors.map((vendor) =>
            vendor.id === id ? { ...vendor, active_contracts: count } : vendor
          ),
        }));
      },

      addVendorSpend: (id, amount) => {
        set((state) => ({
          vendors: state.vendors.map((vendor) =>
            vendor.id === id
              ? { ...vendor, total_spend: (vendor.total_spend || 0) + amount }
              : vendor
          ),
        }));
      },
    }),
    {
      name: "vendor-store",
    }
  )
);

export default useVendorStore;
