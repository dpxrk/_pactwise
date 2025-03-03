export type ContractType = {
  id: number;
  title: string;
  type: string;
  contract_number: string;
  status: "active" | "pending_signature" | "draft" | "expired" | "archived";
  value: number;
  created_at: string;
  start_date: string;
  expires_at: string;
  updated_at: string;
  assignee: string;
  description: string;
  is_renewable: boolean;
  auto_renewal: boolean;
  archived_at: string;
  signature_due_date: Date;
  sent_for_signature_at: Date;
  awaiting_counterparty: boolean;
  pending_signers: string[];
  vendor: {
    id:number;
    name: string;
    location: string;
    email: string;
    rating: number;
    tier: string;
  };
  owner:string;
};




// Form data for contract creation/editing
export interface ContractFormData {
  contractName: string;
  contractType: string;
  contractValue: string;
  contractCategory: string;
  contractOwner: string;
  contractDescription: string;
  isRenewable: boolean;
  autoRenewal: boolean;
  signatureDueDate: Date | null;
  pendingSigners: string[];
}

// Vendor data type
export interface VendorFormData {
  name: string;
  location: string;
  email: string;
  tier: string;
}