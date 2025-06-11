'use client'

import React, { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { NewContractButton } from "@/app/_components/contracts/NewContractButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Eye, FileText, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

// Import simplified hooks
import { useConvexQuery } from "@/lib/api-client";
import { api } from "../../../../convex/_generated/api";

import { useDashboardStore } from "@/stores/dashboard-store";
import { ContractType } from "@/types/contract.types";
import { Id } from "../../../../convex/_generated/dataModel";

const AllContracts = () => {
  const router = useRouter();
  const { searchQuery, setSearchQuery } = useDashboardStore();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // We'll add a new function to contracts.ts instead
  // Let's modify this file so it calls that new function

  /*
   * Now we'll use the new getContracts function we created in convex/contracts.ts
   */
  const { data: contracts = [], isLoading: isLoadingContracts, error: contractsError } = useConvexQuery(
    api.contracts.getContracts,
    {}
  );

  // Use a combined loading state
  const isLoading = isLoadingContracts;

  // Filter contracts based on search and status
  const filteredContracts = useMemo(() => {
    // Ensure contracts is an array before filtering
    if (!Array.isArray(contracts)) return [];

    return contracts.filter((contract) => {
      // Filter by status if not "all"
      const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
      if (!matchesStatus) return false;
      
      // Apply search filter
      if (!searchQuery) return true;

      const query = searchQuery.toLowerCase();
      return (
        contract.title?.toLowerCase().includes(query) ||
        contract.fileName?.toLowerCase().includes(query) ||
        (contract.extractedParties && 
          contract.extractedParties.some(party => 
            party.toLowerCase().includes(query)
          ))
      );
    });
  }, [contracts, searchQuery, statusFilter]);

  // Calculate contract statistics
  const stats = useMemo(() => {
    // Ensure contracts is an array
    if (!Array.isArray(contracts)) return {
      total: 0, 
      activeCount: 0, 
      pendingCount: 0, 
      draftCount: 0,
    };

    return {
      total: contracts.length,
      activeCount: contracts.filter((c) => c.status === "active").length,
      pendingCount: contracts.filter((c) => c.status === "pending_analysis").length,
      draftCount: contracts.filter((c) => c.status === "draft").length,
    };
  }, [contracts]);

  const viewContractDetails = useCallback((contractId: Id<"contracts">) => {
    router.push(`/dashboard/contracts/${contractId}`);
  }, [router]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold">All Contracts</h2>
          <NewContractButton />
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (contractsError) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Contracts</AlertTitle>
        <AlertDescription>
          {contractsError.message}
          <pre className="mt-2 text-xs">Please try refreshing the page.</pre>
        </AlertDescription>
      </Alert>
    );
  }

  // Map status to badge style
  const getStatusBadgeClass = useCallback((status: string): string => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "pending_analysis": return "bg-yellow-100 text-yellow-800";
      case "draft": return "bg-blue-100 text-blue-800";
      case "expired": return "bg-red-100 text-red-800";
      case "terminated": return "bg-orange-100 text-orange-800";
      case "archived": return "bg-gray-100 text-gray-800";
      default: return "bg-slate-100 text-slate-800";
    }
  }, []);

  // Format date for display
  const formatDate = useCallback((dateString?: string): string => {
    if (!dateString) return "Not available";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return "Invalid date";
    }
  }, []);

  // Format status label
  const formatStatusLabel = useCallback((status: string): string => {
    if (!status) return "Unknown";
    return status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Header with Stats */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">All Contracts</h2>
        <NewContractButton />
      </div>

      {/* Contract Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Contracts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active Contracts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Pending Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draftCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contracts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_analysis">Pending Analysis</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contracts Table */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Contract</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Analysis Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Start Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">End Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredContracts.length > 0 ? (
                filteredContracts.map((contract) => {
                  // Get vendor information (assuming we have loaded vendor data)
                  const vendor = contract.vendor || { name: 'N/A' };
                  
                  return (
                    <tr
                      key={contract._id}
                      className="hover:bg-muted/20 cursor-pointer"
                      onClick={() => viewContractDetails(contract._id)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-muted-foreground mr-2 flex-shrink-0" />
                          <div>
                            <div className="font-medium text-primary truncate" title={contract.title}>{contract.title || 'Untitled'}</div>
                            <div className="text-xs text-muted-foreground">{contract.fileName || 'No file'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {vendor.name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Badge className={`${getStatusBadgeClass(contract.status)} font-medium`}>
                          {formatStatusLabel(contract.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {contract.analysisStatus ? (
                          <Badge className={
                            contract.analysisStatus === 'completed' ? 'bg-green-100 text-green-800' :
                            contract.analysisStatus === 'processing' ? 'bg-blue-100 text-blue-800' :
                            contract.analysisStatus === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }>
                            {formatStatusLabel(contract.analysisStatus)}
                          </Badge>
                        ) : 'Not analyzed'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {formatDate(contract.extractedStartDate)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {formatDate(contract.extractedEndDate)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row click when clicking button
                            viewContractDetails(contract._id);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    {searchQuery || statusFilter !== 'all' ? "No contracts found matching your criteria" : "No contracts found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AllContracts;