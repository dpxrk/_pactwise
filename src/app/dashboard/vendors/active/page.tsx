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
import useVendorStore from "@/stores/vendor-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { VendorType } from "@/types/vendor.types";
import VendorForm from "@/app/_components/vendor/VendorForm";
import VendorDetailsModal from "@/app/_components/vendor/VendorDetailsModal";

const ActiveVendors = () => {
  const { vendors, addVendor, updateVendor } = useVendorStore();
  const { searchQuery, setSearchQuery } = useDashboardStore();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isVendorFormOpen, setIsVendorFormOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorType | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Filter only active vendors based on search and category
  const filteredVendors = useMemo(() => {
    return vendors.filter((vendor) => {
      // First filter for active status
      if (vendor.status !== "active") return false;

      const matchesSearch =
        !searchQuery ||
        vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.vendor_number
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        vendor.contactEmail?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        categoryFilter === "all" || vendor.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [vendors, searchQuery, categoryFilter]);

  // Calculate active vendor statistics
  const stats = useMemo(() => {
    const totalSpend = filteredVendors.reduce(
      (sum, vendor) => sum + (vendor.total_spend || 0),
      0
    );

    const averageComplianceScore =
      filteredVendors.reduce(
        (sum, vendor) => sum + (vendor.compliance_score || 0),
        0
      ) / (filteredVendors.length || 1);

    return {
      total: filteredVendors.length,
      totalSpend,
      averageCompliance: Math.round(averageComplianceScore),
      criticalCount: filteredVendors.filter((v) => v.risk_level === "high")
        .length,
      contractCount: filteredVendors.reduce(
        (sum, v) => sum + (v.active_contracts || 0),
        0
      ),
    };
  }, [filteredVendors]);

  const handleCreateVendor = async (vendorData: Partial<VendorType>) => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newVendor: VendorType = {
        _id: `vendor-${Date.now()}` as any,
        enterpriseId: "enterprise-1" as any,
        name: vendorData.name || "",
        status: "active",
        vendor_number: `VND-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
        total_spend: 0,
        active_contracts: 0,
        risk_level: "low",
        compliance_score: 85,
        _creationTime: Date.now(),
      };
      
      // Add optional fields only if they have values
      if (vendorData.contactEmail) newVendor.contactEmail = vendorData.contactEmail;
      if (vendorData.contactPhone) newVendor.contactPhone = vendorData.contactPhone;
      if (vendorData.address) newVendor.address = vendorData.address;
      if (vendorData.website) newVendor.website = vendorData.website;
      if (vendorData.category) newVendor.category = vendorData.category;
      if (vendorData.notes) newVendor.notes = vendorData.notes;

      addVendor(newVendor);
    } finally {
      setLoading(false);
    }
  };

  const handleEditVendor = async (vendorData: Partial<VendorType>) => {
    if (!selectedVendor) return;
    
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateVendor(selectedVendor._id as any, vendorData);
      setSelectedVendor({ ...selectedVendor, ...vendorData } as VendorType);
    } finally {
      setLoading(false);
    }
  };

  const handleViewVendor = (vendor: VendorType) => {
    setSelectedVendor(vendor);
    setIsDetailsModalOpen(true);
  };

  const handleUpdateVendor = (updatedVendor: VendorType) => {
    setSelectedVendor(updatedVendor);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header with Stats */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold ">Active Vendors</h2>
        <Button 
          className='cursor-pointer'
          onClick={() => setIsVendorFormOpen(true)}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          New Vendor
        </Button>
      </div>

      {/* Active Vendor Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Active Vendors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalSpend.toLocaleString()}
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
            <div className="text-2xl font-bold">{stats.contractCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Avg Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageCompliance}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search active vendors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter} >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="technology">Technology</SelectItem>
            <SelectItem value="services">Services</SelectItem>
            <SelectItem value="manufacturing">Manufacturing</SelectItem>
            <SelectItem value="consulting">Consulting</SelectItem>
            <SelectItem value="supplies">Supplies</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active Vendors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVendors.map((vendor) => (
          <Card
            key={vendor._id}
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleViewVendor(vendor)}
          >
            <CardHeader>
              <CardTitle className="text-lg font-medium">
                {vendor.name}
              </CardTitle>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  #{vendor.vendor_number}
                </span>
                <span className="text-sm px-2 py-1 rounded-full bg-green-100 text-green-800">
                  Active
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Category:
                  </span>
                  <span className="font-medium">{vendor.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Active Contracts:
                  </span>
                  <span className="font-medium">
                    {vendor.active_contracts || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Current Spend:
                  </span>
                  <span className="font-medium">
                    ${vendor.total_spend?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    Compliance Score:
                  </span>
                  <span
                    className={`font-medium ${
                      (vendor.compliance_score || 0) >= 80
                        ? "text-green-600"
                        : (vendor.compliance_score || 0) >= 60
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {vendor.compliance_score || 0}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredVendors.length === 0 && (
          <div className="col-span-full text-center py-10 text-muted-foreground">
            No active vendors found
          </div>
        )}
      </div>

      {/* Vendor Form Modal */}
      <VendorForm
        open={isVendorFormOpen}
        onOpenChange={setIsVendorFormOpen}
        onSubmit={handleCreateVendor}
        loading={loading}
      />

      {/* Vendor Details Modal */}
      <VendorDetailsModal
        open={isDetailsModalOpen}
        onOpenChange={setIsDetailsModalOpen}
        vendor={selectedVendor}
        onEditVendor={handleEditVendor}
        onUpdateVendor={handleUpdateVendor}
      />
    </div>
  );
};

export default ActiveVendors;
