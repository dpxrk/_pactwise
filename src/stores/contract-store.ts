import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ContractType } from "@/types/contract.types";
import { Id } from "../../convex/_generated/dataModel";

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
  submitContract: () => Promise<ContractType | null>;
  
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
  updateContract: (id: string, contract: Partial<ContractType>) => void;
  deleteContract: (id: string) => void;
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
            contract._id === id ? { ...contract, ...updatedContract } : contract
          ),
        }));
      },

      deleteContract: (id) => {
        set((state) => ({
          contracts: state.contracts.filter((contract) => contract._id !== id),
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
      
      // Mark that vendor search has been performed
      checkVendorExists: () => {
        const vendorName = get().vendorName;
        if (!vendorName.trim()) return;
        
        set({ vendorSearchPerformed: true });
        // The actual vendor existence check is now handled by the useVendorExistence hook
        // This method is kept for backward compatibility
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
      submitContract: async (): Promise<void> => {
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
            _id: `temp_${Math.floor(Math.random() * 10000)}` as Id<"contracts">, // Temporary ID (server would generate real one)
            enterpriseId: "temp_enterprise" as Id<"enterprises">, // Would come from user context
            title: state.formData.contractName,
            vendorId: "temp_vendor" as Id<"vendors">, // Would come from vendor selection
            status: "draft", // Initial status
            contractType: (state.formData.contractType || "other") as "nda" | "msa" | "sow" | "saas" | "lease" | "employment" | "partnership" | "other",
            storageId: "temp_storage" as Id<"_storage">, // Would be set when file is uploaded
            fileName: "temp_file.pdf", // Would come from file upload
            fileType: "application/pdf", // Would come from file upload
            extractedStartDate: formatDate(state.startDate),
            extractedEndDate: formatDate(state.endDate),
            extractedPricing: state.formData.contractValue,
            notes: state.formData.contractDescription,
            analysisStatus: "pending",
            vendor: {
              _id: "temp_vendor" as Id<"vendors">,
              enterpriseId: "temp_enterprise" as Id<"enterprises">,
              name: state.vendorName,
              contactEmail: "",
              category: "other"
            }
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
          contract.vendor?.name?.toLowerCase().includes(query) ||
          contract.contractType?.toLowerCase().includes(query)
        );
      }
    }),
    {
      name: "contract-store",
    }
  )
);

export default useContractStore;