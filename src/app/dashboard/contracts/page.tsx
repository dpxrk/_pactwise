// src/app/dashboard/contracts/page.tsx (or appropriate path)
'use client'

import React, { useMemo, useState } from "react";
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
import {Button} from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components
import { AlertCircle } from "lucide-react"; // Import AlertCircle icon

// --- Import the CORRECT hooks ---
import { useConvexQuery, useContracts } from "@/lib/api-client"; // Import useContracts
import { Id } from "../../../../convex/_generated/dataModel";
import { api } from "../../../../convex/_generated/api";

import { useDashboardStore } from "@/stores/dashboard-store";
import { ContractType } from "@/types/contract.types"; // Assuming you have this type

const AllContracts = () => {
  const router = useRouter()
  const { searchQuery, setSearchQuery } = useDashboardStore();
  const [statusFilter, setStatusFilter] = useState<string>("all");


  /*
   * Fetching current user data
   */
  // Using useConvexQuery here is fine IF api.users.getCurrentUser takes no arguments
  const { data: currentUser, isLoading: isLoadingUser } = useConvexQuery(api.users.getCurrentUser);
  const enterpriseId = currentUser?.enterpriseId as Id<"enterprises"> | undefined;
  console.log("AllContracts - enterpriseId:", enterpriseId); // Debug log

  /*
   * Fetching data - FIX: Use the useContracts hook instead of useConvexQuery directly
   */
  // Prepare args for useContracts, only include status if not 'all'
  // Pass null if enterpriseId is missing so the hook knows to skip
  const contractArgs = useMemo(() => {
    if (!enterpriseId) return null;
    return {
      enterpriseId,
      status: statusFilter !== "all" ? statusFilter : undefined,
      limit: 100 // Example limit
    };
  }, [enterpriseId, statusFilter]);
  console.log("AllContracts - contractArgs being passed to useContracts:", contractArgs); // Debug log

  // Call the specific hook, passing the prepared args.
  // The useContracts hook will handle skipping if contractArgs is null or enterpriseId is missing.
  const { data: contracts, isLoading: isLoadingContracts, error: contractsError } = useContracts(contractArgs);

  // Use a combined loading state
  const isLoading = isLoadingUser || isLoadingContracts;


 // Filter contracts based on search
 const filteredContracts = useMemo(() => {
   // Ensure contracts is an array before filtering
   if (!Array.isArray(contracts)) return [];

   return contracts.filter((contract:ContractType) => {
     if (!searchQuery) return true;

     const query = searchQuery.toLowerCase();
     // Add null checks for potentially missing fields
     return (
       contract.title?.toLowerCase().includes(query) ||
       contract.vendor?.name?.toLowerCase().includes(query) ||
       contract.contract_number?.toLowerCase().includes(query)
     );
   });
 }, [contracts, searchQuery]);


  // Calculate contract statistics
  const stats = useMemo(() => {
    // Ensure contracts is an array
    if (!Array.isArray(contracts)) return {
      total: 0, totalValue: 0, activeCount: 0, pendingCount: 0, draftCount: 0,
    };

    const totalValue = contracts.reduce(
      (sum:number, contract:ContractType) => sum + (contract.value || 0), 0
    );

    return {
      total: contracts.length,
      totalValue,
      activeCount: contracts.filter((c:ContractType) => c.status === "active").length,
      // Ensure status check matches actual status values (case-sensitive)
      pendingCount: contracts.filter((c:ContractType) => c.status === "pending_signature").length,
      draftCount: contracts.filter((c:ContractType) => c.status === "draft").length,
    };
  }, [contracts]);


  const viewContractDetails = (contractId: Id<"contracts">) => {
    router.push(`/dashboard/contracts/${contractId}`);
  };


  // Render loading state using combined isLoading
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold">All Contracts</h2>
          <NewContractButton />
        </div>
        <div className="flex items-center justify-center py-12">
          {/* Standard loading spinner */}
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // --- Handle potential error state for contracts ---
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
     )
   }


  // Map status to badge style
  const getStatusBadgeClass = (status: string): string => {
    switch (status?.toLowerCase()) { // Add null check and lowercase for safety
      case "active": return "bg-green-100 text-green-800";
      case "pending_signature": return "bg-yellow-100 text-yellow-800";
      case "draft": return "bg-blue-100 text-blue-800";
      case "expired": return "bg-red-100 text-red-800";
      case "archived": return "bg-gray-100 text-gray-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };


  // Format date for display
  const formatDate = (dateValue?: number | string | Date): string => { // Accept different date types
    if (!dateValue) return "N/A";
    try {
      // Handle potential number (timestamp) or string/Date object
      const date = typeof dateValue === 'number' ? new Date(dateValue) : new Date(dateValue);
      if (isNaN(date.getTime())) return "Invalid Date"; // Check if date is valid
      return date.toLocaleDateString();
    } catch (e) {
      return "Invalid Date";
    }
  };


  // Format currency for display
  const formatCurrency = (amount?: number): string => {
    if (amount === undefined || amount === null || isNaN(amount)) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };


  // Format status label
  const formatStatusLabel = (status: string): string => {
    if (!status) return "Unknown";
    return status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };


    return (
      <div className="space-y-6 p-6">
        {/* Header with Stats */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold">All Contracts</h2>
          <NewContractButton />
        </div>

        {/* Contract Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Stats Cards... using 'stats' object */}
           <Card> <CardHeader> <CardTitle className="text-sm font-medium"> Total Contracts </CardTitle> </CardHeader> <CardContent> <div className="text-2xl font-bold">{stats.total}</div> </CardContent> </Card>
           <Card> <CardHeader> <CardTitle className="text-sm font-medium">Total Value</CardTitle> </CardHeader> <CardContent> <div className="text-2xl font-bold"> ${stats.totalValue.toLocaleString()} </div> </CardContent> </Card>
           <Card> <CardHeader> <CardTitle className="text-sm font-medium"> Active Contracts </CardTitle> </CardHeader> <CardContent> <div className="text-2xl font-bold">{stats.activeCount}</div> </CardContent> </Card>
           <Card> <CardHeader> <CardTitle className="text-sm font-medium"> Pending Signature </CardTitle> </CardHeader> <CardContent> <div className="text-2xl font-bold">{stats.pendingCount}</div> </CardContent> </Card>
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
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending_signature">Pending Signature</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Start Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Expiry Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Use filteredContracts here */}
                {filteredContracts.length > 0 ? (
                  filteredContracts.map((contract: any) => ( // Use a more specific type if possible instead of 'any'
                    <tr
                      key={contract._id.toString()}
                      className="hover:bg-muted/20 cursor-pointer"
                      onClick={() => viewContractDetails(contract._id)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-muted-foreground mr-2 flex-shrink-0" />
                          <div>
                            <div className="font-medium text-primary truncate" title={contract.title}>{contract.title || 'N/A'}</div>
                            <div className="text-xs text-muted-foreground">{contract.contract_number || 'No number'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {contract.vendor?.name || "N/A"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Badge className={`${getStatusBadgeClass(contract.status)} font-medium`}>
                          {formatStatusLabel(contract.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {formatCurrency(contract.value)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {/* Check your actual date field names */}
                        {formatDate(contract.startDate || contract.effectiveDate)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                         {/* Check your actual date field names */}
                        {formatDate(contract.endDate || contract.expiresAt)}
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      {searchQuery ? "No contracts found matching your search" : "No contracts found"}
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