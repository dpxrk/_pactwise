'use client';

import React, { useState, useEffect, useRef } from 'react'; // Added useRef
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { VendorType } from '@/types/vendor.types';

// UI Components (Assuming these are from shadcn/ui)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"; // Added CardDescription
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
import { Separator } from "@/components/ui/separator"; // Added Separator

// Icons
import {
  Calendar as CalendarIcon,
  DollarSign,
  FileText,
  Check,
  X,
  Building,
  Tag,
  AlertCircle,
  Search,
  Plus,
  Save,
  ArrowLeft,
  Upload,
  File as FileIcon, // Renamed to avoid conflict with File type
  Paperclip,       // Changed icon name
  Loader2          // Added Loader icon
} from "lucide-react";

// API Client and types
import { useConvexMutation, useCurrentUser, useVendors, useContract } from '@/lib/api-client'; // Assuming these hooks exist and work
import { api } from "../../../../convex/_generated/api"; // Adjust path as needed
import { Id } from "../../../../convex/_generated/dataModel"; // Adjust path as needed

// Form Types
interface ContractFormProps {
  contractId?: Id<"contracts">;
  isModal?: boolean;
  onClose?: () => void;
  onSuccess?: (contractId: Id<"contracts">) => void;
}

interface FormState {
  title: string;
  description: string;
  contractType: string;
  vendorId: string;
  departmentId?: string; // Keep if used, otherwise remove
  effectiveDate?: Date;
  expiresAt?: Date;
  autoRenewal: boolean;
  currency: string;
  value?: number;
  customFields?: Record<string, any>; // Keep if used
  documents: File[]; // Files selected for upload
}

// --- Helper Function ---
function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
// --- End Helper ---

export const ContractForm = ({ contractId, isModal = false, onClose, onSuccess }: ContractFormProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false); // For submission loading state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showVendorSearch, setShowVendorSearch] = useState(false);
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for file input

  // --- Data Fetching ---
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
  const enterpriseId = currentUser?.enterpriseId as Id<"enterprises"> | undefined;

  const vendorArgs = enterpriseId ? { enterpriseId } : null;
  const { data: vendors = [], isLoading: isLoadingVendors } = useVendors(vendorArgs); // Default to empty array

  const { data: contractData, isLoading: isLoadingContract, error: contractError } = useContract(contractId);

  // Convex Mutations
  const createContract = useConvexMutation(api.contracts.createContract);
  const updateContract = useConvexMutation(api.contracts.updateContract);
  // --- FIX: Add generateUploadUrl mutation ---
  const generateUploadUrl = useConvexMutation(api.files.generateUploadUrl); // Assuming you have this
  // --- End Data Fetching ---

  // --- Form State ---
  const [formState, setFormState] = useState<FormState>({
    title: '', description: '', contractType: '', vendorId: '',
    effectiveDate: undefined, expiresAt: undefined,
    autoRenewal: false, currency: 'USD', value: undefined,
    documents: [], // Initialize documents array
    // Removed departmentId & customFields unless specifically needed by your backend
  });
  // --- End Form State ---

  // --- Constants (Contract Types, Currencies) ---
  const contractTypes = [
    { value: "sales", label: "Sales Agreement" },
    { value: "service", label: "Service Agreement" },
    { value: "nda", label: "Non-Disclosure Agreement" },
    { value: "employment", label: "Employment Contract" },
    { value: "partnership", label: "Partnership Agreement" },
    { value: "licensing", label: "Licensing Agreement" },
    { value: "vendor", label: "Vendor Agreement" },
    { value: "custom", label: "Custom Contract" },
  ];
  
  const currencies = [
    { value: "USD", label: "US Dollar (USD)" },
    { value: "EUR", label: "Euro (EUR)" },
    { value: "GBP", label: "British Pound (GBP)" },
    { value: "CAD", label: "Canadian Dollar (CAD)" },
    { value: "AUD", label: "Australian Dollar (AUD)" },
    { value: "JPY", label: "Japanese Yen (JPY)" },
    { value: "CNY", label: "Chinese Yuan (CNY)" },
  ];
  // --- End Constants ---

  // --- Effects ---
  // Load existing contract data
  useEffect(() => {
    if (contractData && contractId && contractData._id === contractId) {
      setFormState({
        title: contractData.title || '',
        description: (contractData as any).description || '', // Adjust field names as needed
        contractType: (contractData as any).contractType || '',
        vendorId: contractData.vendorId?.toString() || '',
        effectiveDate: contractData.startDate ? new Date(contractData.startDate) : undefined,
        expiresAt: contractData.endDate ? new Date(contractData.endDate) : undefined,
        autoRenewal: (contractData as any).autoRenewal || false,
        currency: (contractData as any).currency || 'USD',
        value: contractData.contractValue,
        documents: [], // Reset documents, fetching existing ones needs separate logic
        // Add other fields like departmentId, customFields if they exist on contractData
      });
    } else if (!contractId) {
      // Reset form for new contract
      setFormState({
        title: '', description: '', contractType: '', vendorId: '',
        effectiveDate: undefined, expiresAt: undefined,
        autoRenewal: false, currency: 'USD', value: undefined,
        documents: [],
      });
    }
  }, [contractData, contractId]);
  // --- End Effects ---

  // --- Event Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: name === 'value' ? parseFloat(value) || undefined : value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (name: string, date?: Date) => {
    setFormState(prev => ({ ...prev, [name]: date }));
  };

  const handleToggleChange = (name: string, checked: boolean) => {
    setFormState(prev => ({ ...prev, [name]: checked }));
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFormState(prev => ({
        ...prev,
        // Prevent duplicates if needed, or simply append
        documents: [...prev.documents, ...newFiles]
      }));
      // Optional: Clear the input value if you want to allow selecting the same file again
      e.target.value = '';
    }
  };

  // Remove a selected file
  const removeDocument = (indexToRemove: number) => {
    setFormState(prev => ({
      ...prev,
      documents: prev.documents.filter((_, index) => index !== indexToRemove)
    }));
  };

  // Trigger file input click
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Vendor Selection
  const selectVendor = (vendorId: string) => {
    setFormState(prev => ({ ...prev, vendorId }));
    setShowVendorSearch(false);
  };
  // --- End Event Handlers ---

  // --- Derived State / Helpers ---
  const filteredVendors = vendors.filter((vendor: VendorType) => {
    if (!vendorSearchQuery) return true;
    const query = vendorSearchQuery.toLowerCase();
    return (
      vendor.name?.toLowerCase().includes(query) ||
      vendor.vendor_number?.toLowerCase().includes(query)
    );
  });
  const formatDateDisplay = (date?: Date): React.ReactNode => { // Changed return type
    return date
        ? format(date, 'PPP') // Returns string (which is a valid ReactNode)
        : <span className="text-muted-foreground">Select date</span>; // Returns JSX.Element (also a valid ReactNode)
};

  const isFormValid = (): boolean => {
   
    return !!(formState.title && formState.contractType && formState.vendorId && enterpriseId);
  };
  // --- End Derived State / Helpers ---

  // --- Form Submission ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isFormValid()) {
      setError('Please fill out all required fields (Title, Type, Vendor)');
      return;
    }

    setIsLoading(true); // Start loading indicator

    try {
        // --- Step 1: Upload files to Convex File Storage (if any) ---
        const uploadedFileIds: Id<"_storage">[] = [];
        if (formState.documents.length > 0) {
            // Generate upload URLs for all files
            const uploadUrlPromises = formState.documents.map(() => generateUploadUrl.execute());
            const postUrls = await Promise.all(uploadUrlPromises);

            // Upload each file
            const uploadPromises = formState.documents.map(async (file, index) => {
                const postUrl = postUrls[index];
                if (!postUrl) {
                    throw new Error(`Could not get upload URL for file ${file.name}`);
                }
                const result = await fetch(postUrl.toString(), {
                    method: "POST", 
                    headers: { "Content-Type": file.type },
                    body: file,
                });
                const { storageId } = await result.json();
                if (!storageId) {
                    throw new Error(`Upload failed for file ${file.name}`);
                }
                uploadedFileIds.push(storageId);
            });
            await Promise.all(uploadPromises);
        }
        // --- End File Upload ---


      // --- Step 2: Prepare data for Convex mutation ---
      const mutationArgs = {
        // Map formState fields to your Convex schema fields
        title: formState.title,
        vendorId: formState.vendorId as Id<"vendors">, // Cast to Convex ID type
        description: formState.description,
        contractType: formState.contractType,
        startDate: formState.effectiveDate?.getTime(), // Pass dates as timestamps
        endDate: formState.expiresAt?.getTime(),
        contractValue: formState.value,
        currency: formState.currency,
        autoRenewal: formState.autoRenewal,
        // Add other fields like departmentId, customFields if needed
        // --- FIX: Add uploaded file IDs ---
        documentStorageIds: uploadedFileIds, // Pass the storage IDs to your mutation
        // --- End File ID Fix ---
        status: 'Draft', // Set initial status or get from form
      };

      // --- Step 3: Execute Convex Mutation (Create or Update) ---
      if (contractId) {
        // Update existing contract
        await updateContract.execute({ id: contractId, ...mutationArgs });
        setSuccess('Contract updated successfully!');
        if (onSuccess) onSuccess(contractId);
        if (!isModal) setTimeout(() => router.push(`/dashboard/contracts/${contractId}`), 1500); // Redirect after success
      } else {
        // Create new contract
        const newContractResult = await createContract.execute({
          enterpriseId: enterpriseId as Id<"enterprises">, // Ensure enterpriseId is present and cast
          ...mutationArgs
        });
        if (newContractResult) { // Assuming create returns the new ID
          setSuccess('Contract created successfully!');
          if (onSuccess) onSuccess(newContractResult);
          if (!isModal) setTimeout(() => router.push(`/dashboard/contracts/${newContractResult}`), 1500); // Redirect
        } else {
            // Use specific error from mutation hook if available
           setError(createContract.error?.message || 'Failed to create contract. No ID returned.');
        }
      }

      // Reset documents in form state after successful submission
      if (!error) { // Only reset if successful
         setFormState(prev => ({ ...prev, documents: [] }));
      }

    } catch (err: any) {
      console.error("Error saving contract:", err);
      // Provide more specific error messages if possible
      let message = 'An unknown error occurred.';
      if (err instanceof Error) {
          message = err.message;
      } else if (typeof err === 'string') {
          message = err;
      }
      setError(`Submission failed: ${message}`);
    } finally {
      setIsLoading(false); // Stop loading indicator
    }
  };
  // --- End Form Submission ---

  // --- Initial Loading / Error States ---
  const dataLoading = isLoadingUser || isLoadingVendors || (contractId && isLoadingContract);
  if (dataLoading) {
    return (
      <div className="flex items-center justify-center p-10 min-h-[300px] bg-background rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading form data...</p>
      </div>
    );
  }

  if (contractId && contractError) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Contract Data</AlertTitle>
        <AlertDescription>{contractError.message}</AlertDescription>
      </Alert>
    );
  }
  // --- End Initial Loading / Error States ---

  // --- Form JSX ---
  const formContent = (
    // Use standard shadcn form structure if available, otherwise basic form
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert variant="default"> {/* Use success variant if defined in your Alert component */}
          <Check className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Section 1: Core Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">Contract Details</h3>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Contract Title <span className="text-destructive">*</span></Label>
            <div className="relative">
              <FileText className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="title" name="title" placeholder="e.g., Annual SaaS Subscription" className="pl-8" value={formState.title} onChange={handleInputChange} required />
            </div>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="contractType">Contract Type <span className="text-destructive">*</span></Label>
            <div className="relative">
               <Tag className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
               <Select value={formState.contractType} onValueChange={(value) => handleSelectChange('contractType', value)} required>
                 <SelectTrigger className="pl-8">
                   <SelectValue placeholder="Select type..." />
                 </SelectTrigger>
                 <SelectContent>
                   {contractTypes.map((type) => ( <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem> ))}
                 </SelectContent>
               </Select>
            </div>
          </div>
        </div>

         {/* Vendor */}
        <div className="space-y-1.5">
          <Label>Vendor <span className="text-destructive">*</span></Label>
          <div className="flex items-center gap-2">
            <div className="relative flex-grow">
               <Building className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
               <Button type="button" variant="outline" className="w-full justify-start text-left font-normal pl-8" onClick={() => setShowVendorSearch(true)}>
                 {formState.vendorId && vendors.length > 0
                   ? vendors.find((v:VendorType) => v.id.toString() === formState.vendorId)?.name ?? 'Select vendor...'
                   : 'Select vendor...'
                 }
               </Button>
            </div>
            <Button type="button" variant="outline" size="icon" onClick={() => setShowVendorSearch(true)}>
                <Search className="h-4 w-4" />
            </Button>
          </div>
          {/* Hidden required input for native validation, tied to vendorId */}
           <input type="text" value={formState.vendorId} required style={{ display: 'none' }} readOnly/>
        </div>
      </div>

      {/* Section 2: Dates & Financials */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">Timeline & Value</h3>
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {/* Effective Date */}
          <div className="space-y-1.5">
             <Label htmlFor="effectiveDate">Effective Date</Label>
             <Popover>
               <PopoverTrigger asChild>
                 <Button id="effectiveDate" type="button" variant="outline" className="w-full justify-start text-left font-normal">
                   <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                   {formatDateDisplay(formState.effectiveDate)}
                 </Button>
               </PopoverTrigger>
               <PopoverContent className="w-auto p-0" align="start">
                 <Calendar mode="single" selected={formState.effectiveDate} onSelect={(d) => handleDateChange('effectiveDate', d)} initialFocus />
               </PopoverContent>
             </Popover>
          </div>

           {/* Expiration Date */}
          <div className="space-y-1.5">
             <Label htmlFor="expiresAt">Expiration Date</Label>
             <Popover>
               <PopoverTrigger asChild>
                 <Button id="expiresAt" type="button" variant="outline" className="w-full justify-start text-left font-normal">
                   <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                   {formatDateDisplay(formState.expiresAt)}
                 </Button>
               </PopoverTrigger>
               <PopoverContent className="w-auto p-0" align="start">
                 <Calendar
                    mode="single"
                    selected={formState.expiresAt}
                    onSelect={(d) => handleDateChange('expiresAt', d)}
                    initialFocus
                    disabled={(date) =>
                        (formState.effectiveDate && date < formState.effectiveDate) || // Must be after effective date
                        date < new Date(new Date().setHours(0, 0, 0, 0)) // Cannot be in the past
                    }
                 />
               </PopoverContent>
             </Popover>
          </div>

          {/* Value */}
          <div className="space-y-1.5">
            <Label htmlFor="value">Contract Value</Label>
            <div className="flex gap-2">
              <div className="relative flex-grow">
                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input id="value" name="value" type="number" placeholder="0.00" className="pl-8" value={formState.value ?? ''} onChange={handleInputChange} min={0} step={0.01} />
              </div>
              <Select value={formState.currency} onValueChange={(value) => handleSelectChange('currency', value)}>
                <SelectTrigger className="w-[80px]">
                   <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

           {/* Auto-Renewal */}
          <div className="space-y-1.5">
             <Label>Auto-Renewal</Label>
             <div className="flex items-center space-x-2 pt-2">
               <Switch id="autoRenewal" name="autoRenewal" checked={formState.autoRenewal} onCheckedChange={(checked) => handleToggleChange('autoRenewal', checked)} />
               <Label htmlFor="autoRenewal" className="text-sm text-muted-foreground cursor-pointer">
                   {formState.autoRenewal ? 'Enabled' : 'Disabled'}
               </Label>
             </div>
           </div>
        </div>
      </div>

      {/* Section 3: Description & Documents */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">Details & Attachments</h3>
        <Separator />
        {/* Description */}
        <div className="space-y-1.5">
           <Label htmlFor="description">Description / Notes</Label>
           <Textarea id="description" name="description" placeholder="Add key terms, notes, or summary..." className="min-h-[100px]" value={formState.description} onChange={handleInputChange} />
        </div>

        {/* File Upload */}
        <div className="space-y-1.5">
            <Label htmlFor="document-upload">Attachments</Label>
            {/* Hidden File Input */}
            <input
                type="file"
                id="document-upload"
                ref={fileInputRef}
                className="hidden"
                multiple
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png" // Add relevant file types
            />
            {/* Dropzone / Click Area */}
            <label
                htmlFor="document-upload"
                className="flex flex-col items-center justify-center w-full h-32 px-4 text-center border-2 border-dashed rounded-lg cursor-pointer bg-card hover:border-primary/50 hover:bg-muted/50 transition-colors"
            >
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">PDF, DOCX, PNG, JPG etc.</p>
            </label>

             {/* List of selected files */}
            {formState.documents.length > 0 && (
            <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-foreground">Selected files:</p>
                <ul className="space-y-1 max-h-40 overflow-y-auto rounded-md border p-2">
                {formState.documents.map((file, index) => (
                    <li key={index} className="flex items-center justify-between text-sm p-1.5 bg-muted/30 rounded">
                    <div className="flex items-center gap-2 truncate">
                        <FileIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className="truncate flex-grow">{file.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">({formatBytes(file.size)})</span>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:bg-destructive/10"
                        onClick={() => removeDocument(index)}
                        aria-label={`Remove ${file.name}`}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                    </li>
                ))}
                </ul>
            </div>
            )}
        </div>
      </div>


      {/* Actions */}
      <Separator className="mt-8"/>
      <div className="flex justify-between items-center pt-4 gap-4 flex-wrap">
         {/* Back/Cancel Button */}
         <Button type="button" variant="outline" onClick={isModal ? onClose : () => router.back()} disabled={isLoading}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {isModal ? 'Cancel' : 'Back'}
         </Button>
         {/* Submit Button */}
         <Button type="submit" disabled={!isFormValid() || isLoading} className="min-w-[120px]">
            {isLoading ? (
               <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
               <Save className="mr-2 h-4 w-4" />
            )}
            {isLoading
              ? (contractId ? 'Updating...' : 'Creating...')
              : (contractId ? 'Update Contract' : 'Create Contract')
            }
         </Button>
      </div>
    </form>
  );
  // --- End Form JSX ---

  // --- Vendor Search Dialog JSX ---
  const vendorSearchDialog = (
    <Dialog open={showVendorSearch} onOpenChange={setShowVendorSearch}>
      <DialogContent className="sm:max-w-[425px] bg-background"> {/* Ensure background */}
        <DialogHeader>
          <DialogTitle>Select Vendor</DialogTitle>
          <DialogDescription>Search for an existing vendor or add a new one.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or vendor number..."
              value={vendorSearchQuery}
              onChange={(e) => setVendorSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          {/* Vendor List */}
          <div className="max-h-60 overflow-y-auto border rounded-md bg-card">
            {isLoadingVendors ? (
                <div className="p-4 text-center text-muted-foreground">Loading vendors...</div>
            ) : filteredVendors.length > 0 ? (
              filteredVendors.map((vendor: VendorType) => (
                <button // Use button for better accessibility
                  type="button"
                  key={vendor.id.toString()}
                  className="flex items-center justify-between w-full p-3 text-left hover:bg-muted/50 cursor-pointer border-b last:border-0"
                  onClick={() => selectVendor(vendor.id.toString())}
                >
                  <div>
                    <p className="font-medium text-sm">{vendor.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {vendor.vendor_number ? `${vendor.vendor_number} · ` : ''}
                      {vendor.category}
                    </p>
                  </div>
                  {formState.vendorId === vendor.id.toString() && (
                    <Check className="ml-auto h-4 w-4 text-green-600 flex-shrink-0" />
                  )}
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                {vendorSearchQuery ? 'No vendors found.' : 'No vendors available.'}
              </div>
            )}
          </div>
        </div>
        {/* Dialog Actions */}
        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => { /* TODO: Implement navigation or modal for new vendor */
               // router.push('/dashboard/vendors/new'); // Or open a modal
               console.log("Navigate to New Vendor Form");
               setShowVendorSearch(false);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> New Vendor
          </Button>
          <Button variant="ghost" onClick={() => setShowVendorSearch(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  // --- End Vendor Search Dialog JSX ---


  // --- Final Render Logic ---
  if (isModal) {
    // In modal mode, render only the content and the dialog
    // The Dialog component itself should provide the background/container
    return (
      <>
        {formContent}
        {vendorSearchDialog}
      </>
    );
  }

  // In page mode, wrap the content in a Card for structure and background
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* --- FIX: Ensure Card has a solid background --- */}
      {/* Use bg-card for theme consistency or bg-white for explicit white */}
      <Card className="bg-card shadow-md"> {/* Removed transparency, added shadow */}
        <CardHeader>
          <CardTitle className="text-2xl">
            {contractId ? 'Edit Contract' : 'Create New Contract'}
          </CardTitle>
          <CardDescription>
             {contractId ? 'Update the details of the existing contract.' : 'Fill in the details to create a new contract.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {formContent}
        </CardContent>
      </Card>
      {/* Render the vendor search dialog (it handles its own visibility) */}
      {vendorSearchDialog}
    </div>
  );
  // --- End Final Render Logic ---
};

export default ContractForm;