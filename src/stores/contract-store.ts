import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ContractType } from "@/types/contract.types";

interface ContractState {
  contracts: ContractType[];
  loading: boolean;
  error: string | null;

  // Contract CRUD operations
  setContracts: (contracts: ContractType[]) => void;
  addContract: (contract: ContractType) => void;
  updateContract: (id: number, contract: Partial<ContractType>) => void;
  deleteContract: (id: number) => void;
  fetchMoreContracts: (page: number) => Promise<void>;

  // Loading and error states
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const useContractStore = create<ContractState>()(
  devtools(
    (set) => ({
      // Initial state
      contracts: [],
      loading: false,
      error: null,

      // Core actions
      setContracts: (contracts) => set({ contracts }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      // CRUD operations
      addContract: (contract) => {
        set((state) => ({
          contracts: [...state.contracts, contract],
        }));
      },

      updateContract: (id, updatedContract) => {
        set((state) => ({
          contracts: state.contracts.map((contract) =>
            contract.id === id ? { ...contract, ...updatedContract } : contract
          ),
        }));
      },

      deleteContract: (id) => {
        set((state) => ({
          contracts: state.contracts.filter((contract) => contract.id !== id),
        }));
      },

      fetchMoreContracts: async (page: number) => {
        try {
          set({ loading: true });
          const response = await fetch(`/api/contracts?page=${page}`);
          const newContracts = await response.json();
          set((state) => ({
            contracts: [...state.contracts, ...newContracts],
            loading: false,
          }));
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
        }
      },
    }),
    {
      name: "contract-store",
    }
  )
);

export default useContractStore;
