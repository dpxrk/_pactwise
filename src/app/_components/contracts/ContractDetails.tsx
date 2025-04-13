'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useConvexQuery } from '@/lib/api-client';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { ContractStatus, AnalysisStatus } from '@/types/contract.types';

// UI Components
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Icons
import {
  Building,
  Calendar,
  Edit,
  FileText,
  Download,
  AlertCircle,
  Trash2,
  Archive,
  Info,
  ExternalLink,
  BarChart2,
  PenTool,
  CreditCard,
  Users,
  Clock
} from 'lucide-react';

interface ContractDetailsProps {
  contractId: Id<"contracts">;
  onEdit?: () => void;
}

// Contract status color mapper
const statusColors: Record<ContractStatus, string> = {
  draft: 'bg-blue-100 text-blue-800',
  pending_analysis: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  expired: 'bg-red-100 text-red-800',
  terminated: 'bg-orange-100 text-orange-800',
  archived: 'bg-slate-100 text-slate-800',
};

// Analysis status color mapper
const analysisColors: Record<AnalysisStatus, string> = {
  pending: 'bg-slate-100 text-slate-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export const ContractDetails = ({ contractId, onEdit }: ContractDetailsProps) => {
  const router = useRouter();
  
  // Fetch contract data
  const { data: contract, isLoading, error } = useConvexQuery(
    api.contracts.getContractById,
    { contractId }
  );
  
  // Fetch vendor data if not included in contract
  const { data: vendor } = useConvexQuery(
    api.vendors.getVendorById,
    contract?.vendorId ? { vendorId: contract.vendorId } : "skip"
  );

  // Get file URL for download/view
  const { data: fileUrl } = useConvexQuery(
    api.contracts.getContractFileUrl,
    contract ? { storageId: contract.storageId } : "skip"
  );
  
  // Format date string for display
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Not specified';
    try {
      return format(new Date(dateString), 'PPP');
    } catch (e) {
      return dateString;
    }
  };
  
  // Handle edit button click
  const handleEdit = () => {
    if (onEdit) {
      onEdit();
    } else {
      router.push(`/dashboard/contracts/edit/${contractId}`);
    }
  };

  // Handle download button click
  const handleDownload = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Error state
  if (error || !contract) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error ? `Failed to load contract: ${error.message}` : 'Contract not found'}
        </AlertDescription>
      </Alert>
    );
  }
  
  // Get the vendor information
  const vendorInfo = (contract as any).vendor || vendor || { name: 'Unknown Vendor' };
  
  // Determine status color
  const statusColor = statusColors[contract.status as ContractStatus] || 'bg-gray-100 text-gray-800';
  const analysisColor = contract.analysisStatus ? 
    (analysisColors[contract.analysisStatus as AnalysisStatus] || 'bg-gray-100 text-gray-800') : 
    'bg-gray-100 text-gray-800';
  
  // Format status label
  const formatStatusLabel = (status: string): string => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };
  
  return (
    <div className="space-y-6">
      {/* Contract Header */}
      <Card className="border-gold/10 bg-white/90 backdrop-blur-sm shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-2xl font-serif text-primary">
                {contract.title}
              </CardTitle>
              <Badge className={statusColor}>
                {formatStatusLabel(contract.status)}
              </Badge>
              {contract.analysisStatus && (
                <Badge className={analysisColor}>
                  Analysis: {formatStatusLabel(contract.analysisStatus)}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              File: {contract.fileName || 'Unnamed file'}
            </p>
          </div>
          <div className="flex gap-2">
            {fileUrl && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                View Document
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
      </Card>
      
      {/* Contract Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Contract Information */}
        <Card className="border-gold/10 bg-white/90 backdrop-blur-sm shadow-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Contract Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Document Type</p>
                  <p className="text-sm text-muted-foreground">
                    {contract.fileType || 'Unknown'}
                  </p>
                </div>
              </div>
              
              {contract.analysisStatus && (
                <div className="flex items-start gap-3">
                  <BarChart2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Analysis Status</p>
                    <p className="text-sm text-muted-foreground">
                      {formatStatusLabel(contract.analysisStatus)}
                      {contract.analysisError && (
                        <span className="text-red-500 block">
                          Error: {contract.analysisError}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Extracted Date Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Start Date</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(contract.extractedStartDate)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">End Date</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(contract.extractedEndDate)}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Extracted Payment Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Payment Schedule</p>
                  <p className="text-sm text-muted-foreground">
                    {contract.extractedPaymentSchedule || 'Not specified'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Pricing</p>
                  <p className="text-sm text-muted-foreground">
                    {contract.extractedPricing || 'Not specified'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Extracted Parties */}
            {contract.extractedParties && contract.extractedParties.length > 0 && (
              <div className="pt-2">
                <Separator className="mb-4" />
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Parties Involved</p>
                    <ul className="mt-1 space-y-1">
                      {contract.extractedParties.map((party, index) => (
                        <li key={index} className="text-sm text-muted-foreground">
                          • {party}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
            {/* Contract Scope */}
            {contract.extractedScope && (
              <div className="pt-2">
                <Separator className="mb-4" />
                <h3 className="text-sm font-medium mb-2">Contract Scope</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {contract.extractedScope}
                </p>
              </div>
            )}
            
            {/* Notes */}
            {contract.notes && (
              <div className="pt-2">
                <Separator className="mb-4" />
                <h3 className="text-sm font-medium mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {contract.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Sidebar Information */}
        <Card className="border-gold/10 bg-white/90 backdrop-blur-sm shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Vendor Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Vendor Information */}
            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Vendor</p>
                <p className="text-sm text-muted-foreground">
                  {vendorInfo.name}
                </p>
              </div>
            </div>
            {/* Contact Email */}
            {vendorInfo.contactEmail && (
              <div className="flex items-start gap-3">
                <ExternalLink className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Contact Email</p>
                  <p className="text-sm text-muted-foreground">
                    {vendorInfo.contactEmail}
                  </p>
                </div>
              </div>
            )}
            
            {/* Contact Phone */}
            {vendorInfo.contactPhone && (
              <div className="flex items-start gap-3">
                <ExternalLink className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Contact Phone</p>
                  <p className="text-sm text-muted-foreground">
                    {vendorInfo.contactPhone}
                  </p>
                </div>
              </div>
            )}
            
            {/* Vendor Website */}
            {vendorInfo.website && (
              <div className="flex items-start gap-3">
                <ExternalLink className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Website</p>
                  <a 
                    href={vendorInfo.website.startsWith('http') ? vendorInfo.website : `https://${vendorInfo.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {vendorInfo.website}
                  </a>
                </div>
              </div>
            )}
            
            {/* Creation Time */}
            {contract._creationTime && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(contract._creationTime), 'PPP')}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Analysis Failed Alert */}
      {contract.analysisStatus === 'failed' && contract.analysisError && (
        <Alert variant="destructive" className="border-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Analysis Failed</AlertTitle>
          <AlertDescription>{contract.analysisError}</AlertDescription>
        </Alert>
      )}
      
      {/* Contract Actions */}
      <Card className="border-gold/10 bg-white/90 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Contract Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {fileUrl && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download Document
              </Button>
            )}
            
            {/* Edit contract */}
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Details
            </Button>
            
            {/* Retry analysis if failed */}
            {contract.analysisStatus === 'failed' && (
              <Button variant="outline" size="sm">
                <BarChart2 className="h-4 w-4 mr-2" />
                Retry Analysis
              </Button>
            )}
            
            {/* Archive contract */}
            {contract.status !== 'archived' && (
              <Button variant="outline" size="sm">
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </Button>
            )}
            
            {/* Delete contract */}
            <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContractDetails;