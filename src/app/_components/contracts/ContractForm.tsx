'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { VendorType } from '@/types/vendor.types'; // Assuming you have this type

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";

// Icons
import {
  Calendar as CalendarIcon,
  DollarSign,
  FileText,
  Check,
  X,
  Building,
  Tag,
  User,
  AlertCircle,
  Search,
  Plus,
  Save,
  ArrowLeft
} from "lucide-react";

// API Client and types
// --- FIX: Import useContract hook ---
import { useConvexMutation, useConvexQuery, useCurrentUser, useVendors, useContract } from "@/lib/api-client";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

// Form Types
interface ContractFormProps {
  contractId?: Id<"contracts">; // Optional for editing existing contracts
  isModal?: boolean;
  onClose?: () => void;
  onSuccess?: (contractId: Id<"contracts">) => void;
}

interface FormState {
  title: string;
  description: string;
  contractType: string;
  vendorId: string;
  departmentId?: string;
  effectiveDate?: Date;
  expiresAt?: Date;
  autoRenewal: boolean;
  currency: string;
  value?: number;
  customFields?: Record<string, any>;
}

export const ContractForm = ({ contractId, isModal = false, onClose, onSuccess }: ContractFormProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showVendorSearch, setShowVendorSearch] = useState(false);
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');

  // Get current user for enterprise ID
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser(); // Added loading state
  const enterpriseId = currentUser?.enterpriseId as Id<"enterprises"> | undefined;

  // Get vendors for the enterprise - Pass enterpriseId args
  // Assuming useVendors was fixed in api-client.ts to accept { enterpriseId }
  const vendorArgs = enterpriseId ? { enterpriseId } : null;
  const { data: vendors, isLoading: isLoadingVendors } = useVendors(vendorArgs);

  // Create/Update mutations
  const createContract = useConvexMutation(api.contracts.createContract);
  const updateContract = useConvexMutation(api.contracts.updateContract);

  // --- FIX: Use the useContract hook ---
  // Get contract data if editing. The useContract hook handles skipping if contractId is null/undefined.
  const { data: contractData, isLoading: isLoadingContract, error: contractError } = useContract(contractId);

  // Form state
  const [formState, setFormState] = useState<FormState>({
    title: '', description: '', contractType: '', vendorId: '',
    departmentId: undefined, effectiveDate: undefined, expiresAt: undefined,
    autoRenewal: false, currency: 'USD', value: undefined, customFields: {},
  });

  // Contract type options (keep as is)
   const contractTypes = [ { value: "sales", label: "Sales Agreement" }, { value: "service", label: "Service Agreement" }, { value: "nda", label: "Non-Disclosure Agreement" }, { value: "employment", label: "Employment Contract" }, { value: "partnership", label: "Partnership Agreement" }, { value: "licensing", label: "Licensing Agreement" }, { value: "vendor", label: "Vendor Agreement" }, { value: "custom", label: "Custom Contract" }, ];
  // Currency options (keep as is)
   const currencies = [ { value: "USD", label: "US Dollar (USD)" }, { value: "EUR", label: "Euro (EUR)" }, { value: "GBP", label: "British Pound (GBP)" }, { value: "CAD", label: "Canadian Dollar (CAD)" }, { value: "AUD", label: "Australian Dollar (AUD)" }, { value: "JPY", label: "Japanese Yen (JPY)" }, { value: "CNY", label: "Chinese Yuan (CNY)" }, ];


  // Load contract data if editing
  useEffect(() => {
    // Check if contractData exists and corresponds to the current contractId being edited
    if (contractData && contractId && contractData._id === contractId) {
      setFormState({
        title: contractData.title || '',
        // Assuming 'description' exists on contractData, adjust if needed
        description: (contractData as any).description || '',
        // Assuming 'contractType' exists, adjust field name if different
        contractType: (contractData as any).contractType || '',
        // Assuming 'vendorId' exists and is the ID string
        vendorId: contractData.vendorId?.toString() || '', // Ensure it's string if needed
        // Assuming 'departmentId' exists
        departmentId: (contractData as any).departmentId,
         // Ensure dates are handled correctly (Convex might store numbers)
        effectiveDate: contractData.startDate ? new Date(contractData.startDate) : undefined,
        expiresAt: contractData.endDate ? new Date(contractData.endDate) : undefined,
         // Assuming 'autoRenewal' exists
        autoRenewal: (contractData as any).autoRenewal || false,
         // Assuming 'currency' exists
        currency: (contractData as any).currency || 'USD',
        value: contractData.contractValue, // Assuming field name is contractValue
         // Assuming 'customFields' exists
        customFields: (contractData as any).customFields || {},
      });
    } else if (!contractId) {
       // Reset form when creating a new contract or if contractData is not for the current ID
       setFormState({
           title: '', description: '', contractType: '', vendorId: '',
           departmentId: undefined, effectiveDate: undefined, expiresAt: undefined,
           autoRenewal: false, currency: 'USD', value: undefined, customFields: {},
         });
    }
  }, [contractData, contractId]); // Depend on contractData and contractId

  // Handle input changes (keep as is)
   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { const { name, value } = e.target; setFormState(prev => ({ ...prev, [name]: name === 'value' ? parseFloat(value) || undefined : value })); };
  // Handle select changes (keep as is)
   const handleSelectChange = (name: string, value: string) => { setFormState(prev => ({ ...prev, [name]: value })); };
  // Handle date selection (keep as is)
   const handleDateChange = (name: string, date?: Date) => { setFormState(prev => ({ ...prev, [name]: date })); };
  // Handle toggle (switch) changes (keep as is)
   const handleToggleChange = (name: string, checked: boolean) => { setFormState(prev => ({ ...prev, [name]: checked })); };

  // Filter vendors based on search query (add null check for vendor.name)
  const filteredVendors = Array.isArray(vendors) ? vendors.filter((vendor:VendorType) => {
    if (!vendorSearchQuery) return true;
    const query = vendorSearchQuery.toLowerCase();
    return (
      vendor.name?.toLowerCase().includes(query) || // Add null check
      (vendor.vendor_number && vendor.vendor_number.toLowerCase().includes(query))
    );
  }) : [];

  // Select a vendor (keep as is)
   const selectVendor = (vendorId: string) => { setFormState(prev => ({ ...prev, vendorId })); setShowVendorSearch(false); };
  // Format date for display (keep as is)
   const formatDate = (date?: Date): string => { return date ? format(date, 'PPP') : 'Select date'; };

  // Check if form is valid (keep as is)
  const isFormValid = (): boolean => {
    return !!(formState.title && formState.contractType && formState.vendorId && enterpriseId);
  };

  // Handle form submission (adjust field names passed to mutations)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid() || !enterpriseId) {
      setError('Please fill out all required fields (Title, Type, Vendor)');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const generateContractId = (vendorId:number|string): string => {
      const uniqueSuffix = Math.floor(100+Math.random() * 900);

      return `ctr${vendorId}${uniqueSuffix}`
    }


    try {
      // Use field names consistent with backend mutations
      const mutationArgs = {
         title: formState.title,
         // Pass other fields required/accepted by createContract/updateContract
         // Ensure the names match exactly what the backend expects
         vendorId: formState.vendorId as Id<"vendors">,
         status: 'Draft', // Example: Set initial status if creating
         startDate: formState.effectiveDate?.getTime(), // Pass as number (timestamp)
         endDate: formState.expiresAt?.getTime(), // Pass as number (timestamp)
         contractValue: formState.value,
         // Add other relevant fields from formState like description, type, etc.
         description: formState.description,
         contractType: formState.contractType,
         autoRenewal: formState.autoRenewal,
         currency: formState.currency,
         // customFields: formState.customFields, // Pass if backend handles it
         contractId: generateContractId(formState.vendorId as Id<"vendors">)
      };


      if (contractId) {
        // Update existing contract
        await updateContract.execute({
          id: contractId, // Pass 'id' for update
          ...mutationArgs
          // Remove fields not needed for update if necessary (like enterpriseId?)
        });
        setSuccess('Contract updated successfully');
        if (onSuccess) onSuccess(contractId);
        if (!isModal) setTimeout(() => router.push(`/dashboard/contracts/${contractId}`), 1500);

      } else {
        // Create new contract
        const newContractResult = await createContract.execute({
          enterpriseId: enterpriseId, // Add enterpriseId for create
          ...mutationArgs
        });

        // Check if createContract returns the new ID or null/undefined on failure
        if (newContractResult) {
           const newContractId = newContractResult; // Assuming it returns the ID
           setSuccess('Contract created successfully');
           if (onSuccess) onSuccess(newContractId);
           if (!isModal) setTimeout(() => router.push(`/dashboard/contracts/${newContractId}`), 1500);
         } else {
           // Handle case where mutation succeeded but didn't return expected ID (if applicable)
           // Or use createContract.error if that hook provides it
           setError(createContract.error?.message || 'Failed to create contract or get new ID');
         }
      }
    } catch (err) {
      // This catch block might not be needed if useConvexMutation handles it
      console.error('Error saving contract:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      // useConvexMutation should handle its own loading state
      // setIsLoading(false); // Maybe remove if useConvexMutation handles it
    }
  };

  // Combined loading state for initial data fetches
  const initialLoading = isLoadingUser || (contractId && isLoadingContract) || isLoadingVendors;

  // If initially loading required data (user, existing contract, vendors)
  if (initialLoading) {
    return (
       <div className="flex items-center justify-center p-8">
         <div className="text-center">
           <div className="mb-4 p-3 bg-primary/5 rounded-sm inline-block">
             <div className="w-10 h-10 border-t-2 border-primary animate-spin rounded-full"></div>
           </div>
           <p className="text-muted-foreground">Loading form data...</p>
         </div>
       </div>
    );
  }

   // Handle error fetching existing contract data
   if (contractId && contractError) {
     return (
        <Alert variant="destructive" className="m-4">
           <AlertCircle className="h-4 w-4" />
           <AlertTitle>Error Loading Contract Data</AlertTitle>
           <AlertDescription>{contractError.message}</AlertDescription>
         </Alert>
     );
   }

  // Form content that can be used in both modal and page contexts
  const formContent = (
    // Keep the existing form structure
    // Ensure input names match keys in FormState and handleInputChange/mutationArgs
     <form onSubmit={handleSubmit} className="space-y-6">
         {/* Alerts */}
         {error && ( <Alert variant="destructive"> <AlertCircle className="h-4 w-4" /> <AlertTitle>Error</AlertTitle> <AlertDescription>{error}</AlertDescription> </Alert> )}
         {success && ( <Alert className="bg-green-50 border-green-200"> <Check className="h-4 w-4 text-green-600" /> <AlertTitle className="text-green-800">Success</AlertTitle> <AlertDescription className="text-green-700">{success}</AlertDescription> </Alert> )}

         {/* Basic Info */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2"> <Label htmlFor="title">Contract Title <span className="text-red-500">*</span></Label> <div className="relative"> <FileText className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" /> <Input id="title" name="title" placeholder="Enter contract title" className="pl-10 border-gold/20" value={formState.title} onChange={handleInputChange} required /> </div> </div>
             <div className="space-y-2"> <Label htmlFor="contractType">Contract Type <span className="text-red-500">*</span></Label> <div className="relative"> <Tag className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" /> <Select value={formState.contractType} onValueChange={(value) => handleSelectChange('contractType', value)}> <SelectTrigger className="pl-10 border-gold/20"> <SelectValue placeholder="Select contract type" /> </SelectTrigger> <SelectContent> {contractTypes.map((type) => ( <SelectItem key={type.value} value={type.value}> {type.label} </SelectItem> ))} </SelectContent> </Select> </div> </div>
         </div>

         {/* Vendor Selection */}
         <div className="space-y-2"> <Label>Vendor <span className="text-red-500">*</span></Label> <div className="relative"> <Building className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" /> <div className="flex space-x-2"> <Button type="button" variant="outline" className="w-full justify-between text-left font-normal border-gold/20 pl-10" onClick={() => setShowVendorSearch(true)}> {formState.vendorId && Array.isArray(vendors) ? vendors.find((vendor:VendorType) => vendor._id.toString() === formState.vendorId)?.name || 'Select vendor' : 'Select vendor' } <Search className="h-4 w-4 text-muted-foreground" /> </Button> </div> </div> </div>

         {/* Dates */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2"> <Label>Effective Date</Label> <div className="relative"> <Popover> <PopoverTrigger asChild> <Button type="button" variant="outline" className="w-full justify-start text-left font-normal border-gold/20 pl-10"> <CalendarIcon className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" /> {formatDate(formState.effectiveDate)} </Button> </PopoverTrigger> <PopoverContent className="w-auto p-0" align="start"> <Calendar mode="single" selected={formState.effectiveDate} onSelect={(date) => handleDateChange('effectiveDate', date)} initialFocus /> </PopoverContent> </Popover> </div> </div>
             <div className="space-y-2"> <Label>Expiration Date</Label> <div className="relative"> <Popover> <PopoverTrigger asChild> <Button type="button" variant="outline" className="w-full justify-start text-left font-normal border-gold/20 pl-10"> <CalendarIcon className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" /> {formatDate(formState.expiresAt)} </Button> </PopoverTrigger> <PopoverContent className="w-auto p-0" align="start"> <Calendar mode="single" selected={formState.expiresAt} onSelect={(date) => handleDateChange('expiresAt', date)} initialFocus disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) || (formState.effectiveDate !== undefined && date < formState.effectiveDate)} /> </PopoverContent> </Popover> </div> </div>
         </div>

         {/* Value and Auto-Renewal */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2"> <Label htmlFor="value">Contract Value</Label> <div className="flex space-x-2"> <div className="relative flex-1"> <DollarSign className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" /> <Input id="value" name="value" type="number" placeholder="Enter contract value" className="pl-10 border-gold/20" value={formState.value || ''} onChange={handleInputChange} min={0} step={0.01} /> </div> <Select value={formState.currency} onValueChange={(value) => handleSelectChange('currency', value)}> <SelectTrigger className="w-24 border-gold/20"> <SelectValue placeholder="USD" /> </SelectTrigger> <SelectContent> {currencies.map((currency) => ( <SelectItem key={currency.value} value={currency.value}> {currency.value} </SelectItem> ))} </SelectContent> </Select> </div> </div>
             <div className="space-y-2"> <Label>Auto-Renewal</Label> <div className="flex items-center space-x-2 pt-2"> <Switch checked={formState.autoRenewal} onCheckedChange={(checked) => handleToggleChange('autoRenewal', checked)} /> <span className="text-sm text-muted-foreground"> {formState.autoRenewal ? 'Enabled' : 'Disabled'} </span> </div> </div>
         </div>

         {/* Description */}
         <div className="space-y-2"> <Label htmlFor="description">Description</Label> <Textarea id="description" name="description" placeholder="Enter contract description and key terms" className="min-h-24 border-gold/20" value={formState.description} onChange={handleInputChange} rows={4}/> </div>

         {/* Actions */}
         <div className="flex justify-between pt-4 border-t border-gold/10">
             <Button type="button" variant="outline" className="border-gold/50 text-primary hover:bg-gold/5" onClick={isModal ? onClose : () => router.back()}> <ArrowLeft className="mr-2 h-4 w-4" /> {isModal ? 'Cancel' : 'Back'} </Button>
             <Button type="submit" disabled={!isFormValid() || createContract.isLoading || updateContract.isLoading} className="bg-primary hover:bg-primary/90 text-white"> { (createContract.isLoading || updateContract.isLoading) ? ( <><div className="h-4 w-4 border-t-2 border-blue-200 border-solid rounded-full animate-spin mr-2"></div> {contractId ? 'Updating...' : 'Creating...'}</> ) : ( <><Save className="mr-2 h-4 w-4" /> {contractId ? 'Update Contract' : 'Create Contract'}</> ) } </Button>
         </div>
     </form>
  );

  // Vendor Search Dialog (keep as is)
   const vendorSearchDialog = ( <Dialog open={showVendorSearch} onOpenChange={setShowVendorSearch}> <DialogContent className="bg-white border-gold/10 shadow-luxury"> <DialogHeader> <DialogTitle className="text-xl font-serif text-primary">Select Vendor</DialogTitle> <DialogDescription> Search and select a vendor for this contract. </DialogDescription> </DialogHeader> <div className="space-y-4"> <div className="relative"> <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" /> <Input placeholder="Search vendors..." value={vendorSearchQuery} onChange={(e) => setVendorSearchQuery(e.target.value)} className="pl-10 border-gold/20" /> </div> <div className="max-h-60 overflow-y-auto border rounded-md"> {filteredVendors.length > 0 ? ( filteredVendors.map((vendor:VendorType) => ( <div key={vendor._id} /* Use _id if that's the actual ID field from Convex */ className="flex items-center p-3 hover:bg-muted/50 cursor-pointer border-b last:border-0" onClick={() => selectVendor(vendor._id.toString())} > <div> <p className="font-medium">{vendor.name}</p> <p className="text-xs text-muted-foreground"> {vendor.vendor_number} · {vendor.category} </p> </div> {formState.vendorId === vendor._id.toString() && ( <Check className="ml-auto h-4 w-4 text-green-600" /> )} </div> )) ) : ( <div className="p-4 text-center text-muted-foreground"> {vendorSearchQuery ? 'No vendors found' : (isLoadingVendors ? 'Loading vendors...' : 'No vendors available')} </div> )} </div> <div className="flex justify-between"> <Button variant="outline" onClick={() => setShowVendorSearch(false)} className="border-gold/50 text-primary hover:bg-gold/5" > Cancel </Button> <Button onClick={() => { router.push('/dashboard/vendors/new'); setShowVendorSearch(false); }} className="bg-primary hover:bg-primary/90 text-white" > <Plus className="mr-2 h-4 w-4" /> New Vendor </Button> </div> </div> </DialogContent> </Dialog> );


  // Render as a page if not modal, or just the content if modal
  if (isModal) {
    return (
      <>
        {formContent}
        {vendorSearchDialog}
      </>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Card className="border-gold/10 bg-white/90 backdrop-blur-sm shadow-luxury">
        <CardHeader>
          <CardTitle className="text-2xl text-primary font-serif">
            {contractId ? 'Edit Contract' : 'Create New Contract'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {formContent}
        </CardContent>
      </Card>
      {vendorSearchDialog}
    </div>
  );
};

export default ContractForm;