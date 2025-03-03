'use client'

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useContractStore from "@/stores/contract-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

const AllContracts = () => {
  const { contracts } = useContractStore();
  const { searchQuery, setSearchQuery } = useDashboardStore();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  





  // Filter contracts based on search and status
  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      const matchesSearch =
        !searchQuery ||
        contract.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.vendor?.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        contract.contract_number
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || contract.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [contracts, searchQuery, statusFilter]);

  // Calculate contract statistics
  const stats = useMemo(() => {
    const totalValue = filteredContracts.reduce(
      (sum, contract) => sum + (contract.value || 0),
      0
    );

    return {
      total: filteredContracts.length,
      totalValue,
      activeCount: filteredContracts.filter((c) => c.status === "active")
        .length,
      pendingCount: filteredContracts.filter(
        (c) => c.status === "pending_signature"
      ).length,
      draftCount: filteredContracts.filter((c) => c.status === "draft").length,
    };
  }, [filteredContracts]);


  const handleContractCreated = (newContract) => {
    // Create a formatted contract object from the form data
    const formattedContract = {
      id: `c${(contracts.length + 1).toString().padStart(3, '0')}`,
      name: newContract.contractName,
      vendor: newContract.vendorName,
      type: newContract.contractType,
      value: newContract.contractValue,
      startDate: newContract.startDate ? new Date(newContract.startDate).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }) : '',
      endDate: newContract.endDate ? new Date(newContract.endDate).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }) : '',
      status: "active"
    };
    
    // Add the new contract to the list
    setContracts(prev => [formattedContract, ...prev]);
    
    // Show success message (in a real app, you would use a toast notification)
    console.log("Contract created successfully:", formattedContract);
  };



  return (
    <div className="space-y-6 p-6">
      {/* Header with Stats */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">All Contracts</h2>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Contract
        </Button>
      </div>

      {/* Contract Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Total Contracts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalValue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Active Contracts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Pending Signature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingCount}</div>
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
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending_signature">Pending Signature</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contracts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContracts.map((contract) => (
          <Card
            key={contract.id}
            className="hover:shadow-lg transition-shadow cursor-pointer"
          >
            <CardHeader>
              <CardTitle className="text-lg font-medium">
                {contract.title}
              </CardTitle>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  #{contract.contract_number}
                </span>
                <span
                  className={`text-sm px-2 py-1 rounded-full ${
                    contract.status === "active"
                      ? "bg-green-100 text-green-800"
                      : contract.status === "pending_signature"
                      ? "bg-yellow-100 text-yellow-800"
                      : contract.status === "draft"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {contract.status}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Value:</span>
                  <span className="font-medium">
                    ${contract.value?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Vendor:</span>
                  <span className="font-medium">{contract.vendor?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Start Date:
                  </span>
                  <span className="font-medium">
                    {new Date(contract.start_date).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Expiry Date:
                  </span>
                  <span className="font-medium">
                    {new Date(contract.expires_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredContracts.length === 0 && (
          <div className="col-span-full text-center py-10 text-muted-foreground">
            No contracts found
          </div>
        )}
      </div>
    </div>
  );
};

export default AllContracts;
