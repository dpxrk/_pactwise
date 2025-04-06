'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useConvexQuery } from '@/lib/api-client';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';

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
  DollarSign,
  Edit,
  FileSignature,
  Info,
  Tag,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  Download,
  Share2,
  Trash2,
  Archive
} from 'lucide-react';

interface ContractDetailsProps {
  contractId: Id<"contracts">;
  onEdit?: () => void;
}

// Contract status color mapper
const statusColors: Record<string, string> = {
  draft: 'bg-blue-100 text-blue-800',
  pending_review: 'bg-yellow-100 text-yellow-800',
  in_review: 'bg-purple-100 text-purple-800',
  pending_approval: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  pending_signature: 'bg-orange-100 text-orange-800',
  partially_signed: 'bg-indigo-100 text-indigo-800',
  signed: 'bg-green-100 text-green-800',
  expired: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  archived: 'bg-slate-100 text-slate-800',
  terminated: 'bg-rose-100 text-rose-800',
};

export const ContractDetails = ({ contractId, onEdit }: ContractDetailsProps) => {
  const router = useRouter();
  
  // Fetch contract data
  const { data: contract, isLoading, error } = useConvexQuery(
    api.contracts.getContract,
    { contractId }
  );
  
  // Format date string for display
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Not specified';
    return format(new Date(dateString), 'PPP');
  };
  
  // Format currency for display
  const formatCurrency = (value?: number, currency = 'USD'): string => {
    if (value === undefined) return 'Not specified';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency 
    }).format(value);
  };
  
  // Handle edit button click
  const handleEdit = () => {
    if (onEdit) {
      onEdit();
    } else {
      router.push(`/dashboard/contracts/edit/${contractId}`);
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
  
  // Determine status label and color
  const statusLabel = contract.status.replace(/_/g, ' ');
  const statusColor = statusColors[contract.status] || 'bg-gray-100 text-gray-800';
  
  // Calculate contract duration
  const calculateDuration = (): string => {
    if (!contract.effectiveDate || !contract.expiresAt) return 'Not specified';
    
    const start = new Date(contract.effectiveDate);
    const end = new Date(contract.expiresAt);
    const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    
    if (diffMonths < 1) {
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return `${diffDays} days`;
    } else if (diffMonths < 12) {
      return `${diffMonths} months`;
    } else {
      const years = Math.floor(diffMonths / 12);
      const months = diffMonths % 12;
      return months > 0 ? `${years} years, ${months} months` : `${years} years`;
    }
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
                {statusLabel}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Contract #{contract.contractNumber}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
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
            {/* Contract Type & Value */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Contract Type</p>
                  <p className="text-sm text-muted-foreground">
                    {contract.contractType}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Contract Value</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(contract.value, contract.currency)}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Date Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Effective Date</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(contract.effectiveDate)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Expiration Date</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(contract.expiresAt)}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Auto-Renewal & Duration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Contract Duration</p>
                  <p className="text-sm text-muted-foreground">
                    {calculateDuration()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Auto-Renewal</p>
                  <p className="text-sm text-muted-foreground">
                    {contract.autoRenewal ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Description */}
            <div className="pt-2">
              <Separator className="mb-4" />
              <h3 className="text-sm font-medium mb-2">Description</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {contract.description || 'No description provided.'}
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Sidebar Information */}
        <Card className="border-gold/10 bg-white/90 backdrop-blur-sm shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Related Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Vendor Information */}
            <div className="flex items-start gap-3">
              <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Vendor</p>
                <p className="text-sm text-muted-foreground">
                  {contract.vendor?.name || 'Not specified'}
                </p>
              </div>
            </div>
            
            {/* Created By */}
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Created By</p>
                <p className="text-sm text-muted-foreground">
                  {contract.createdBy?.name || 'Not specified'}
                </p>
              </div>
            </div>
            
            {/* Created/Updated Dates */}
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Created Date</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(contract.createdAt)}
                </p>
              </div>
            </div>
            
            {contract.updatedAt && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Last Updated</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(contract.updatedAt)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Approval Status */}
      {contract.approvalChain && contract.approvalChain.length > 0 && (
        <Card className="border-gold/10 bg-white/90 backdrop-blur-sm shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Approval Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {contract.approvalChain.map((approval:any, index:number) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {/* Would need to look up user name from userId */}
                      User {approval.userId.toString().slice(0, 8)}...
                    </span>
                  </div>
                  <Badge 
                    className={
                      approval.status === 'approved' ? 'bg-green-100 text-green-800' :
                      approval.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {approval.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Signature Status */}
      {contract.status === 'pending_signature' && (
        <Card className="border-gold/10 bg-white/90 backdrop-blur-sm shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Signature Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">Pending Signatures</AlertTitle>
              <AlertDescription className="text-blue-700">
                This contract is awaiting signatures. You can send reminders or view signature details.
              </AlertDescription>
            </Alert>
            
            <div className="mt-4">
              <Button variant="outline" size="sm" className="mr-2">
                <FileSignature className="h-4 w-4 mr-2" />
                View Signatures
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share for Signature
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Contract Actions */}
      <Card className="border-gold/10 bg-white/90 backdrop-blur-sm shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Contract Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            {contract.status !== 'signed' && (
              <Button variant="outline" size="sm">
                <FileSignature className="h-4 w-4 mr-2" />
                Sign
              </Button>
            )}
            {contract.status === 'signed' && (
              <Button variant="outline" size="sm">
                <CheckCircle className="h-4 w-4 mr-2" />
                View Signatures
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </Button>
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