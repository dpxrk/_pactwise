'use client'

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DepartmentPerformanceSection } from "@/app/_components/analytics/DepartmentPerformanceSection";
import { RiskAndComplianceSection } from "@/app/_components/analytics/RiskAndComplianceSection";
import { KPISection } from "@/app/_components/analytics/KPISection";
import {ContractAnalyticsSection} from "@/app/_components/analytics/ContractAnalyticsSection"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


import { AlertTriangle } from "lucide-react";

const Analytics = () => {
  const [timeRange, setTimeRange] = useState("month");
  // const [viewMode, setViewMode] = useState("overview");

  return (

      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Analytics Dashboard</h2>
          <div className="flex gap-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Select Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Alert className="mb-8">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Attention Required</AlertTitle>
          <AlertDescription>
            5 contracts require renewal in the next 30 days. 3 high-risk
            contracts need review.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="compliance">Risk & Compliance</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <KPISection />
            <ContractAnalyticsSection />
          </TabsContent>

          <TabsContent value="contracts">
            <ContractAnalyticsSection />
            <Card>
              <CardHeader>
                <CardTitle>Contract Value Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {/* Add contract value distribution chart */}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance">
            <RiskAndComplianceSection />
          </TabsContent>

          <TabsContent value="departments">
            <DepartmentPerformanceSection />
          </TabsContent>
        </Tabs>
      </div>
 
  );
};

export default Analytics;
