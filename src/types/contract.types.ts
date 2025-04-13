// Type definition for contracts based on the simplified schema
import { Id } from "../../convex/_generated/dataModel";
import { VendorType } from "./vendor.types";

// Contract status options from the schema
export type ContractStatus = 
  | "draft"
  | "pending_analysis"
  | "active" 
  | "expired" 
  | "terminated"
  | "archived";

// Analysis status options from the schema
export type AnalysisStatus = 
  | "pending"
  | "processing"
  | "completed"
  | "failed";

// Main contract type aligned with the Convex schema
export type ContractType = {
  _id: Id<"contracts">; // Convex ID
  _creationTime?: number; // Convex automatic timestamp

  // Core Contract Info
  title: string;
  vendorId: Id<"vendors">;
  status: ContractStatus;
  
  // File Information
  storageId: Id<"_storage">;
  fileName: string;
  fileType: string;
  
  // Extracted Information (all optional since they might not be available)
  extractedParties?: string[];
  extractedStartDate?: string;
  extractedEndDate?: string;
  extractedPaymentSchedule?: string;
  extractedPricing?: string;
  extractedScope?: string;
  
  // Analysis Process Tracking
  analysisStatus?: AnalysisStatus;
  analysisError?: string;
  
  // Optional user notes
  notes?: string;
  
  // Not in the schema but added by the getContracts query for UI display
  vendor?: VendorType;
};


// Form data for contract creation/editing
export interface ContractFormData {
  title: string;
  vendorId: string; // String representation of the Id
  notes?: string;
  file?: File; // For uploading the contract document
}

// Vendor form data
export interface VendorFormData {
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  notes?: string;
  website?: string;
}