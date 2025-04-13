import { Id } from "../../convex/_generated/dataModel";


export type VendorType = {
  _id: Id<"vendors">;
  _creationTime?: number;
  
  // Core vendor info
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  notes?: string;
  website?: string;
};