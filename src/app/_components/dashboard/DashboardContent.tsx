'use client';

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity,
  DollarSign,
  TrendingUp,
  Scale,
  Building,
  Target,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { MetricCard } from "@/app/_components/common/MetricCard";
import DynamicChart from "@/app/_components/common/DynamicCharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConvexQuery } from "@/lib/api-client";
import { api } from "../../../../convex/_generated/api"

// Define chart colors for consistency
const CHART_COLORS = {
  primary: "hsl(var(--chart-1))",
  secondary: "hsl(var(--chart-2))",
  tertiary: "hsl(var(--chart-3))",
  quaternary: "hsl(var(--chart-4))",
  success: "#10b981", // emerald-500
  warning: "#f59e0b", // amber-500
  danger: "#ef4444", // red-500
};

const DashboardContent = () => {
  // Get contract analytics data from the API
  const { data: contractAnalytics, isLoading: analyticsLoading } = useConvexQuery(
    api.contracts.getContractAnalytics
  );

  // Get expiring contracts to show in alerts
  const { data: expiringContracts, isLoading: expiringLoading } = useConvexQuery(
    api.contracts.getExpiringContracts,
    { daysThreshold: 30 }
  );

  const [timeRange, setTimeRange] = useState("month");

  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Sample data transformed from API response
  // In a real app, you would transform the API data into this format
  const portfolioData = [
    {
      month: "Jan",
      contractValue: 18500000,
      costSavings: 950000,
      efficiency: 89,
      contracts: 245,
    },
    {
      month: "Feb",
      contractValue: 21000000,
      costSavings: 1150000,
      efficiency: 91,
      contracts: 285,
    },
    {
      month: "Mar",
      contractValue: 24500000,
      costSavings: 1450000,
      efficiency: 93,
      contracts: 310,
    },
    {
      month: "Apr",
      contractValue: 22000000,
      costSavings: 1250000,
      efficiency: 92,
      contracts: 290,
    },
    {
      month: "May",
      contractValue: 27500000,
      costSavings: 1650000,
      efficiency: 94,
      contracts: 335,
    },
    {
      month: "Jun",
      contractValue: 31000000,
      costSavings: 1850000,
      efficiency: 95,
      contracts: 370,
    },
  ];

  // Risk data from analytics
  const riskData = [
    { name: "Low Risk", value: 65, color: CHART_COLORS.success },
    { name: "Medium Risk", value: 25, color: CHART_COLORS.warning },
    { name: "High Risk", value: 10, color: CHART_COLORS.danger },
  ];

  // Value distribution data
  const valueDistributionData = [
    { name: "Strategic", value: 45, color: CHART_COLORS.primary },
    { name: "Operational", value: 30, color: CHART_COLORS.secondary },
    { name: "Tactical", value: 15, color: CHART_COLORS.tertiary },
    { name: "Support", value: 10, color: CHART_COLORS.quaternary },
  ];

  // Formatter for chart axis
  const formatYAxis = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return value;
  };

  // Get expiring count from API data or use a fallback
  const expiringCount = expiringContracts?.length || 0;
  
  // Get analytics data with fallbacks for when data is loading
  const totalContractValue = contractAnalytics?.valueByRrency?.USD || 125000000;
  const costOptimization = totalContractValue * 0.06; // 6% of total as savings (example)
  const riskWeightedExposure = totalContractValue * 0.22; // 22% of total as risk exposure
  const operationalEfficiency = contractAnalytics?.avgTimeToSign ? 
    100 - (contractAnalytics.avgTimeToSign / 10) : 92.5; // Lower time = higher efficiency

  // Show loading state or proper content
  if (analyticsLoading && expiringLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="mb-4 p-3 bg-primary/5 rounded-sm inline-block">
            <div className="w-10 h-10 border-t-2 border-gold animate-spin rounded-full"></div>
          </div>
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-background">
      <Tabs defaultValue="overview" className="w-full">
        <div className="flex flex-col space-y-4 px-4 py-6">
          <div className="flex justify-between items-center">
            <TabsList className="bg-background-light">
              <TabsTrigger value="overview">Executive Summary</TabsTrigger>
              <TabsTrigger value="contracts">Contract Analytics</TabsTrigger>
              <TabsTrigger value="vendors">Vendor Insights</TabsTrigger>
            </TabsList>
          </div>

          {/* Alert for expiring contracts */}
          {expiringCount > 0 && (
            <Alert className="mb-4 border-amber-200 bg-amber-50 dark:bg-amber-900/20">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Attention Required</AlertTitle>
              <AlertDescription className="text-amber-700">
                {expiringCount} {expiringCount === 1 ? 'contract requires' : 'contracts require'} renewal in the next 30 days.
                <Button variant="link" className="p-0 h-auto text-amber-800 font-medium hover:text-amber-900">
                  View Expiring Contracts
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <TabsContent value="overview" className="space-y-6 mt-0">
            {/* Executive KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Contract Value"
                value={formatCurrency(totalContractValue)}
                icon={DollarSign}
                trend={12.5}
                changeType="positive"
                description="YTD Contract Portfolio"
              />
              <MetricCard
                title="Cost Optimization"
                value={formatCurrency(costOptimization)}
                icon={TrendingUp}
                trend={15.3}
                changeType="positive"
                description="Annual savings achieved"
              />
              <MetricCard
                title="Risk-Weighted Exposure"
                value={formatCurrency(riskWeightedExposure)}
                icon={Scale}
                trend={-8.2}
                changeType="positive"
                description="Total risk-adjusted value"
              />
              <MetricCard
                title="Operational Efficiency"
                value={`${operationalEfficiency.toFixed(1)}%`}
                icon={Activity}
                trend={5.7}
                changeType="positive"
                description="Contract process efficiency"
              />
            </div>

            {/* Strategic Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                title="Vendor Consolidation"
                value="32.8%"
                icon={Building}
                trend={-4.2}
                changeType="positive"
                description="Top vendor concentration"
              />
              <MetricCard
                title="Compliance Score"
                value="96.7%"
                icon={ShieldCheck}
                trend={2.1}
                changeType="positive"
                description="Overall compliance rating"
              />
              <MetricCard
                title="Strategic Initiative Coverage"
                value="88.4%"
                icon={Target}
                trend={6.3}
                changeType="positive"
                description="Alignment with objectives"
              />
            </div>

            {/* Enhanced Charts */}
            <div className="grid grid-cols-1 gap-4">
              <Card className="bg-background-glass backdrop-blur-sm border border-gold/10 shadow-luxury">
                <CardHeader>
                  <CardTitle className="text-primary font-serif">
                    Contract Counts and Monthly Savings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <DynamicChart
                      type="bar"
                      data={portfolioData}
                      series={[
                        { 
                          dataKey: "costSavings", 
                          name: "Cost Savings", 
                          fill: CHART_COLORS.secondary
                        },
                        { 
                          dataKey: "contracts", 
                          name: "Contract Count", 
                          fill: CHART_COLORS.tertiary
                        }
                      ]}
                      xAxisKey="month"
                      height={300}
                      showGrid={true}
                      yAxisLabel="Value" 
                      margin={{ top: 20, right: 30, left: 30, bottom: 20 }}
                      useCustomTooltip={true}
                      colors={[CHART_COLORS.secondary, CHART_COLORS.tertiary]}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Risk and Compliance Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border border-gold/10 shadow-luxury">
                <CardHeader>
                  <CardTitle className="text-primary font-serif">Risk Distribution Matrix</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <DynamicChart
                      type="pie"
                      data={riskData}
                      series={[{ dataKey: "value" }]}
                      height={300}
                      useCustomTooltip={true}
                      showLegend={true}
                      colors={riskData.map(item => item.color)}
                      margin={{ top: 20, right: 30, left: 30, bottom: 40 }}
                      pieConfig={{
                        dataKey: "value",
                        nameKey: "name",
                        innerRadius: 60,
                        outerRadius: 100,
                        paddingAngle: 2,
                        label: false,
                        labelLine: false
                      }}
                    />
                    <div className="flex justify-center mt-2 space-x-4">
                      {riskData.map((item, index) => (
                        <div key={index} className="flex items-center">
                          <div 
                            className="w-3 h-3 rounded-full mr-1" 
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-xs">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gold/10 shadow-luxury">
                <CardHeader>
                  <CardTitle className="text-primary font-serif">Strategic Value Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <DynamicChart
                      type="pie"
                      data={valueDistributionData}
                      series={[{ dataKey: "value" }]}
                      height={300}
                      useCustomTooltip={true}
                      showLegend={true}
                      colors={valueDistributionData.map(item => item.color)}
                      margin={{ top: 20, right: 30, left: 30, bottom: 40 }}
                      pieConfig={{
                        dataKey: "value",
                        nameKey: "name",
                        innerRadius: 60,
                        outerRadius: 100,
                        paddingAngle: 2,
                        label: false,
                        labelLine: false
                      }}
                    />
                    <div className="flex justify-center mt-2 space-x-4">
                      {valueDistributionData.map((item, index) => (
                        <div key={index} className="flex items-center">
                          <div 
                            className="w-3 h-3 rounded-full mr-1" 
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-xs">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Contract Analytics Tab */}
          <TabsContent value="contracts" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                title="Total Contracts"
                value={contractAnalytics?.totalContracts?.toString() || "486"}
                icon={Activity}
                trend={3.5}
                changeType="positive"
                description="All contracts in system"
              />
              <MetricCard
                title="Active Contracts"
                value={contractAnalytics?.statusCounts?.active?.toString() || "312"}
                icon={Activity}
                trend={5.2}
                changeType="positive"
                description="Currently active contracts"
              />
              <MetricCard
                title="Avg. Completion Time"
                value={`${contractAnalytics?.avgTimeToSign?.toFixed(1) || "4.2"} days`}
                icon={Activity}
                trend={-0.8}
                changeType="positive"
                description="Average time to signature"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Contract Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <DynamicChart
                    type="pie"
                    data={[
                      { name: "Active", value: contractAnalytics?.statusCounts?.active || 312, color: "#4ade80" },
                      { name: "Pending", value: contractAnalytics?.statusCounts?.pending_signature || 45, color: "#f59e0b" },
                      { name: "Expired", value: contractAnalytics?.statusCounts?.expired || 72, color: "#ef4444" },
                      { name: "Draft", value: contractAnalytics?.statusCounts?.draft || 38, color: "#60a5fa" },
                      { name: "Archived", value: contractAnalytics?.statusCounts?.archived || 19, color: "#a3a3a3" }
                    ]}
                    series={[{ dataKey: "value" }]}
                    height={320}
                    showLegend={true}
                    pieConfig={{
                      dataKey: "value",
                      nameKey: "name",
                      innerRadius: 60,
                      outerRadius: 120,
                      paddingAngle: 2,
                      label: true,
                      labelLine: true
                    }}
                    useCustomTooltip={true}
                    colors={["#4ade80", "#f59e0b", "#ef4444", "#60a5fa", "#a3a3a3"]}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Vendor Insights Tab */}
          <TabsContent value="vendors" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Top Vendors by Spend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <DynamicChart
                      type="bar"
                      data={[
                        { name: "Acme Corp", value: 1250000 },
                        { name: "TechSolutions", value: 980000 },
                        { name: "GlobalServices", value: 850000 },
                        { name: "Innovate Inc", value: 720000 },
                        { name: "PrimeConsulting", value: 690000 },
                      ]}
                      series={[{
                        dataKey: "value",
                        name: "Annual Spend",
                        fill: CHART_COLORS.primary
                      }]}
                      xAxisKey="name"
                      height={320}
                      showGrid={true}
                      showLegend={true}
                      useCustomTooltip={true}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vendor Risk Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <DynamicChart
                      type="pie"
                      data={[
                        { name: "Low Risk", value: 65, color: CHART_COLORS.success },
                        { name: "Medium Risk", value: 25, color: CHART_COLORS.warning },
                        { name: "High Risk", value: 10, color: CHART_COLORS.danger },
                      ]}
                      series={[{ dataKey: "value" }]}
                      height={320}
                      showLegend={true}
                      useCustomTooltip={true}
                      colors={[CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.danger]}
                      pieConfig={{
                        dataKey: "value",
                        nameKey: "name",
                        innerRadius: 50,
                        outerRadius: 100,
                        paddingAngle: 2,
                        label: true,
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vendor Compliance Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <DynamicChart
                      type="bar"
                      data={[
                        { category: "Data Privacy", compliant: 85, nonCompliant: 15 },
                        { category: "Security", compliant: 92, nonCompliant: 8 },
                        { category: "Financial", compliant: 78, nonCompliant: 22 },
                        { category: "Regulatory", compliant: 88, nonCompliant: 12 },
                      ]}
                      series={[
                        { 
                          dataKey: "compliant", 
                          name: "Compliant", 
                          fill: CHART_COLORS.success,
                          stackId: "stack1"
                        },
                        { 
                          dataKey: "nonCompliant", 
                          name: "Non-Compliant", 
                          fill: CHART_COLORS.danger,
                          stackId: "stack1"
                        }
                      ]}
                      xAxisKey="category"
                      height={320}
                      stacked={true}
                      showGrid={true}
                      showLegend={true}
                      useCustomTooltip={true}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default DashboardContent;