import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ContractType } from "@/types/contract.types";

interface ContractModalState {
  // Modal state
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  
  // Vendor verification state
  vendorName: string;
  vendorExists: boolean | null;
  vendorSearchPerformed: boolean;
  setVendorName: (name: string) => void;
  checkVendorExists: () => void;
  
  // Vendor creation dialog
  showVendorDialog: boolean;
  openVendorDialog: () => void;
  closeVendorDialog: () => void;
  createVendor: () => void;
  
  // Form data
  startDate: Date | null;
  endDate: Date | null;
  setStartDate: (date: Date | null) => void;
  setEndDate: (date: Date | null) => void;
  
  formData: {
    contractName: string;
    contractType: string;
    contractValue: string;
    contractCategory: string;
    contractOwner: string;
    contractDescription: string;
  };
  
  // Form operations
  updateFormData: (field: string, value: string) => void;
  isSubmitting: boolean;
  isFormValid: () => boolean;
  submitContract: () => Promise<any>;
  
  // Search functionality
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  getFilteredContracts: () => ContractType[];
}

interface ContractStoreState extends ContractModalState {
  // Original contract store state
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

const useContractStore = create<ContractStoreState>()(
  devtools(
    (set, get) => ({
      // Initial state from original contract store
      contracts: [],
      loading: false,
      error: null,

      // Core actions from original store
      setContracts: (contracts) => set({ contracts }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      // CRUD operations from original store
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

      // Modal state from new implementation
      isModalOpen: false,
      openModal: () => set({ isModalOpen: true }),
      closeModal: () => {
        // Reset form data when closing modal
        set({
          isModalOpen: false,
          vendorName: "",
          vendorExists: null,
          vendorSearchPerformed: false,
          startDate: null,
          endDate: null,
          formData: {
            contractName: "",
            contractType: "",
            contractValue: "",
            contractCategory: "",
            contractOwner: "",
            contractDescription: "",
          },
        });
      },
      
      // Vendor verification state
      vendorName: "",
      vendorExists: null,
      vendorSearchPerformed: false,
      setVendorName: (name) => set({ vendorName: name }),
      
      // Check if vendor exists (simulated API call)
      checkVendorExists: () => {
        const vendorName = get().vendorName;
        if (!vendorName.trim()) return;
        
        set({ vendorSearchPerformed: true });
        
        // In a real app, this would be an API call to check the vendor
        setTimeout(() => {
          // Simulate vendor check - in this case we'll say a vendor named "Acme" exists
          const exists = vendorName.toLowerCase() === "acme";
          set({ vendorExists: exists });
        }, 600);
      },
      
      // Vendor creation dialog
      showVendorDialog: false,
      openVendorDialog: () => set({ showVendorDialog: true }),
      closeVendorDialog: () => set({ showVendorDialog: false }),
      
      // Handle create vendor action
      createVendor: () => {
        // In a real app, this would make an API call to create the vendor
        set({ 
          showVendorDialog: false,
          vendorExists: true 
        });
      },
      
      // Form data
      startDate: null,
      endDate: null,
      setStartDate: (date) => set({ startDate: date }),
      setEndDate: (date) => set({ endDate: date }),
      
      formData: {
        contractName: "",
        contractType: "",
        contractValue: "",
        contractCategory: "",
        contractOwner: "",
        contractDescription: "",
      },
      
      // Update form data
      updateFormData: (field, value) => {
        set((state) => ({
          formData: {
            ...state.formData,
            [field]: value
          }
        }));
      },
      
      // Form submission
      isSubmitting: false,
      
      // Check if form is valid
      isFormValid: () => {
        const state = get();
        return (
          state.vendorExists && 
          state.formData.contractName && 
          state.formData.contractType && 
          state.formData.contractValue && 
          state.formData.contractCategory && 
          state.formData.contractOwner && 
          state.startDate && 
          state.endDate
        );
      },
      
      // Submit contract
      submitContract: async () => {
        const state = get();
        if (!state.isFormValid()) return;
        
        set({ isSubmitting: true });
        
        try {
          // Generate a random contract number
          const contractNumber = `CNT-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
          
          // Format dates consistently
          const formatDate = (date: Date | null): string => {
            return date ? date.toISOString() : new Date().toISOString();
          };
          
          // Convert form data to the specific ContractType format
          const contractData: ContractType = {
            id: Math.floor(Math.random() * 10000), // Temporary ID (server would generate real one)
            title: state.formData.contractName,
            type: state.formData.contractType,
            contract_number: contractNumber,
            status: "draft", // Initial status
            value: parseFloat(state.formData.contractValue) || 0,
            created_at: new Date().toISOString(),
            start_date: formatDate(state.startDate),
            expires_at: formatDate(state.endDate),
            updated_at: new Date().toISOString(),
            assignee: state.formData.contractOwner, // Assuming owner and assignee are the same initially
            description: state.formData.contractDescription,
            is_renewable:  true, // Default value of true
            auto_renewal: true, // Default value since autoRenewal doesn't exist in formData
            archived_at: "",
            signature_due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Default 14 days
            sent_for_signature_at: new Date(),
            awaiting_counterparty: true,
            pending_signers: [], // Default empty array since pendingSigners doesn't exist in formData
            vendor: {
              id: 1, // This would come from your vendor selection/lookup
              name: state.vendorName,
              location: "Unknown", // This would come from vendor data
              email: "vendor@example.com", // This would come from vendor data
              rating: 0, // Default value
              tier: "Standard" // Default value
            },
            owner: state.formData.contractOwner
          };
          
          // In a real app, this would be an API call
          // const response = await fetch('/api/contracts', {
          //   method: 'POST',
          //   headers: { 'Content-Type': 'application/json' },
          //   body: JSON.stringify(contractData)
          // });
          // const savedContract = await response.json();
          
          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Add the contract to state
          get().addContract(contractData);
          
          // Reset submission state and close modal
          set({ isSubmitting: false });
          get().closeModal();
          
          return contractData;
        } catch (error) {
          // Handle error
          set({ 
            isSubmitting: false,
            error: (error as Error).message
          });
        }
      },
      
      // Search functionality
      searchQuery: "",
      setSearchQuery: (query) => set({ searchQuery: query }),
      getFilteredContracts: () => {
        const { contracts, searchQuery } = get();
        if (!searchQuery.trim()) return contracts;
        
        const query = searchQuery.toLowerCase();
        return contracts.filter(contract => 
          contract.title.toLowerCase().includes(query) ||
          contract.vendor.name?.toLowerCase().includes(query) ||
          contract.type?.toLowerCase().includes(query)
        );
      }
    }),
    {
      name: "contract-store",
    }
  )
);

export default useContractStore;