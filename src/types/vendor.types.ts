export interface VendorType {
  id: number;
  name: string;
  vendor_number: string;
  status: "active" | "inactive" | "pending";
  category: string;
  email: string;
  phone?: string;
  address?: string;
  active_contracts: number;
  total_spend: number;
  risk_level: "low" | "medium" | "high";
  created_at: string;
  updated_at: string;
  primary_contact?: {
    name: string;
    email: string;
    phone?: string;
  };
  compliance_score?: number;
  payment_terms?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}
