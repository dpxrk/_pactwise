// src/app/_components/dashboard/DashboardContent.tsx (adjust path as needed)
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
// --- FIX: Import the CORRECT hooks from api-client ---
import {
  useConvexQuery        // <-- Keep this for expiringContracts (if it doesn't need enterpriseId)
} from "@/lib/api-client"; // Adjust path if necessary
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel"; // <-- Import Id type

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
  // --- FIX: Get current user data to retrieve enterpriseId ---
  const { data: currentUserData, isLoading: isLoadingUser } = useCurrentUser();
  // Adjust 'enterpriseId' based on your actual user data structure in Convex
  const enterpriseId = currentUserData?.enterpriseId as Id<"enterprises"> | undefined;
  

  // --- FIX: Use the correct hook and pass enterpriseId ---
  const { data: contractAnalytics, isLoading: analyticsLoading, error: analyticsError } = useContractAnalytics(
    enterpriseId // Pass the retrieved enterpriseId here
  );

  // Get expiring contracts to show in alerts
  // IMPORTANT: If getExpiringContracts ALSO needs enterpriseId, update this call similarly!
  // Assuming for now it doesn't based on your api-client.ts hook definition for it.
  // const { data: expiringContracts, isLoading: expiringLoading } = useConvexQuery(
  //   api.contracts.getExpiringContracts,
  //   { daysThreshold: 30 } // This hook call seems correct based on api-client.ts
  //   // If it needs enterpriseId, it should be:
  //   // enterpriseId ? { daysThreshold: 30, enterpriseId } : null
  // );

  const [timeRange, setTimeRange] = useState("month");

  // Format currency values
  const formatCurrency = (value: number) => {
    // Add a check for NaN or non-number values
    if (isNaN(value) || typeof value !== 'number') return '$0';
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Sample data transformed from API response (replace with actual transformation logic)
  // ... (keep your sample portfolioData, riskData, valueDistributionData) ...
   const portfolioData = [ { month: "Jan", contractValue: 18500000, costSavings: 950000, efficiency: 89, contracts: 245, }, { month: "Feb", contractValue: 21000000, costSavings: 1150000, efficiency: 91, contracts: 285, }, { month: "Mar", contractValue: 24500000, costSavings: 1450000, efficiency: 93, contracts: 310, }, { month: "Apr", contractValue: 22000000, costSavings: 1250000, efficiency: 92, contracts: 290, }, { month: "May", contractValue: 27500000, costSavings: 1650000, efficiency: 94, contracts: 335, }, { month: "Jun", contractValue: 31000000, costSavings: 1850000, efficiency: 95, contracts: 370, }, ];
   const riskData = [ { name: "Low Risk", value: 65, color: CHART_COLORS.success }, { name: "Medium Risk", value: 25, color: CHART_COLORS.warning }, { name: "High Risk", value: 10, color: CHART_COLORS.danger }, ];
   const valueDistributionData = [ { name: "Strategic", value: 45, color: CHART_COLORS.primary }, { name: "Operational", value: 30, color: CHART_COLORS.secondary }, { name: "Tactical", value: 15, color: CHART_COLORS.tertiary }, { name: "Support", value: 10, color: CHART_COLORS.quaternary }, ];


  // Formatter for chart axis
  const formatYAxis = (value: number) => {
    if (isNaN(value) || typeof value !== 'number') return '0';
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return value.toString(); // Return as string
  };

  // Get expiring count from API data or use a fallback
  const expiringCount = 0;

  // --- FIX: Safely access contractAnalytics data only when loaded and available ---
  const totalContractValue = contractAnalytics?.valueByCurrency?.USD ?? 0; // Use ?? for fallback
  const costOptimization = contractAnalytics?.totalSavings ?? 0; // Example: use actual savings field if available
  const riskWeightedExposure = contractAnalytics?.totalRiskValue ?? 0; // Example: use actual risk field
  const operationalEfficiency = contractAnalytics?.avgTimeToSign ?
    Math.max(0, 100 - (contractAnalytics.avgTimeToSign / 10)) : 0; // Example calculation, ensure non-negative

  // --- FIX: Update loading check to include user loading state ---
  if (isLoadingUser || analyticsLoading ) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="mb-4 p-3 bg-primary/5 rounded-sm inline-block">
            {/* Simple loading spinner */}
            <div className="w-10 h-10 border-t-2 border-primary animate-spin rounded-full"></div>
          </div>
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  // --- FIX: Handle potential error state for analytics ---
   if (analyticsError) {
     return (
        <Alert variant="destructive" className="m-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Analytics</AlertTitle>
          <AlertDescription>
            There was a problem fetching the contract analytics data. Please try again later.
            <pre className="mt-2 text-xs">{analyticsError.message}</pre>
          </AlertDescription>
        </Alert>
     )
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
          {/* {expiringCount > 0 && (
            <Alert className="mb-4 border-amber-200 bg-amber-50 dark:bg-amber-900/20">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Attention Required</AlertTitle>
              <AlertDescription className="text-amber-700">
                {expiringCount} {expiringCount === 1 ? 'contract requires' : 'contracts require'} renewal in the next 30 days.
                <Button variant="link" className="p-0 h-auto text-amber-800 font-medium hover:text-amber-900 ml-1">
                  View Expiring Contracts
                </Button>
              </AlertDescription>
            </Alert>
          )} */}

          <TabsContent value="overview" className="space-y-6 mt-0">
            {/* Executive KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               <MetricCard
                 title="Total Contract Value"
                 // Use the state variable derived safely
                 value={formatCurrency(totalContractValue)}
                 icon={DollarSign}
                 trend={12.5} // Replace with dynamic trend if available
                 changeType="positive"
                 description="YTD Contract Portfolio"
               />
               <MetricCard
                 title="Cost Optimization"
                 value={formatCurrency(costOptimization)} // Use state variable
                 icon={TrendingUp}
                 trend={15.3} // Replace with dynamic trend
                 changeType="positive"
                 description="Annual savings achieved"
               />
               <MetricCard
                 title="Risk-Weighted Exposure"
                 value={formatCurrency(riskWeightedExposure)} // Use state variable
                 icon={Scale}
                 trend={-8.2} // Replace with dynamic trend
                 changeType="positive" // Check if negative trend should be negative changeType
                 description="Total risk-adjusted value"
               />
               <MetricCard
                 title="Operational Efficiency"
                 value={`${operationalEfficiency.toFixed(1)}%`} // Use state variable
                 icon={Activity}
                 trend={5.7} // Replace with dynamic trend
                 changeType="positive"
                 description="Contract process efficiency"
               />
            </div>

             {/* Strategic Metrics */}
             {/* Update these similarly if data comes from analytics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard title="Vendor Consolidation" value="32.8%" icon={Building} trend={-4.2} changeType="positive" description="Top vendor concentration"/>
              <MetricCard title="Compliance Score" value="96.7%" icon={ShieldCheck} trend={2.1} changeType="positive" description="Overall compliance rating"/>
              <MetricCard title="Strategic Initiative Coverage" value="88.4%" icon={Target} trend={6.3} changeType="positive" description="Alignment with objectives"/>
            </div>

             {/* Enhanced Charts */}
             {/* Ensure data passed to charts uses actual API data when available */}
            <div className="grid grid-cols-1 gap-4">
               <Card className="bg-background-glass backdrop-blur-sm border border-gold/10 shadow-luxury">
                 <CardHeader>
                   <CardTitle className="text-primary font-serif">
                     Contract Counts and Monthly Savings
                   </CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="h-[300px] w-full">
                     {/* TODO: Replace portfolioData with transformed data from contractAnalytics */}
                     <DynamicChart type="bar" data={portfolioData} series={[ { dataKey: "costSavings", name: "Cost Savings", fill: CHART_COLORS.secondary }, { dataKey: "contracts", name: "Contract Count", fill: CHART_COLORS.tertiary } ]} xAxisKey="month" height={300} showGrid={true} yAxisLabel="Value" margin={{ top: 20, right: 30, left: 30, bottom: 20 }} useCustomTooltip={true} colors={[CHART_COLORS.secondary, CHART_COLORS.tertiary]}/>
                   </div>
                 </CardContent>
               </Card>
             </div>

             {/* Risk and Compliance Matrix */}
             {/* Ensure data passed uses actual API data */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
               <Card className="border border-gold/10 shadow-luxury">
                 <CardHeader>
                   <CardTitle className="text-primary font-serif">Risk Distribution Matrix</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="h-[300px] w-full">
                     {/* TODO: Replace riskData with transformed data from contractAnalytics */}
                     <DynamicChart type="pie" data={riskData} series={[{ dataKey: "value" }]} height={300} useCustomTooltip={true} showLegend={false} colors={riskData.map(item => item.color)} margin={{ top: 20, right: 30, left: 30, bottom: 40 }} pieConfig={{ dataKey: "value", nameKey: "name", innerRadius: 60, outerRadius: 100, paddingAngle: 2, label: false, labelLine: false }}/>
                     <div className="flex justify-center mt-2 space-x-4">
                       {riskData.map((item, index) => ( <div key={index} className="flex items-center"> <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: item.color }} /> <span className="text-xs">{item.name}</span> </div> ))}
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
                     {/* TODO: Replace valueDistributionData with transformed API data */}
                     <DynamicChart type="pie" data={valueDistributionData} series={[{ dataKey: "value" }]} height={300} useCustomTooltip={true} showLegend={false} colors={valueDistributionData.map(item => item.color)} margin={{ top: 20, right: 30, left: 30, bottom: 40 }} pieConfig={{ dataKey: "value", nameKey: "name", innerRadius: 60, outerRadius: 100, paddingAngle: 2, label: false, labelLine: false }}/>
                     <div className="flex justify-center mt-2 space-x-4">
                       {valueDistributionData.map((item, index) => ( <div key={index} className="flex items-center"> <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: item.color }}/> <span className="text-xs">{item.name}</span> </div> ))}
                     </div>
                   </div>
                 </CardContent>
               </Card>
            </div>
          </TabsContent>

           {/* Contract Analytics Tab */}
           {/* Update these metrics/charts to use contractAnalytics data */}
          <TabsContent value="contracts" className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               <MetricCard title="Total Contracts" value={contractAnalytics?.totalContracts?.toString() || "0"} icon={Activity} description="All contracts in system"/>
               <MetricCard title="Active Contracts" value={contractAnalytics?.statusCounts?.Active?.toString() || "0"} icon={Activity} description="Currently active contracts"/>
               <MetricCard title="Avg. Completion Time" value={`${contractAnalytics?.avgTimeToSign?.toFixed(1) || "0.0"} days`} icon={Activity} description="Average time to signature"/>
             </div>
             <Card>
               <CardHeader><CardTitle>Contract Status Distribution</CardTitle></CardHeader>
               <CardContent>
                 <div className="h-80">
                    {/* Ensure pie data uses contractAnalytics.statusCounts safely */}
                    <DynamicChart type="pie" data={[ { name: "Active", value: contractAnalytics?.statusCounts?.Active || 0, color: "#4ade80" }, { name: "Pending", value: contractAnalytics?.statusCounts?.PendingSignature || 0, color: "#f59e0b" }, { name: "Expired", value: contractAnalytics?.statusCounts?.Expired || 0, color: "#ef4444" }, { name: "Draft", value: contractAnalytics?.statusCounts?.Draft || 0, color: "#60a5fa" }, { name: "Archived", value: contractAnalytics?.statusCounts?.Archived || 0, color: "#a3a3a3" } ]} series={[{ dataKey: "value" }]} height={320} showLegend={true} pieConfig={{ dataKey: "value", nameKey: "name", innerRadius: 60, outerRadius: 120, paddingAngle: 2, label: true, labelLine: true }} useCustomTooltip={true} colors={["#4ade80", "#f59e0b", "#ef4444", "#60a5fa", "#a3a3a3"]}/>
                 </div>
               </CardContent>
             </Card>
          </TabsContent>

           {/* Vendor Insights Tab */}
           {/* Update these charts to use vendor-related analytics if available */}
          <TabsContent value="vendors" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader><CardTitle>Top Vendors by Spend</CardTitle></CardHeader>
                <CardContent><div className="h-80"><DynamicChart type="bar" data={[ { name: "Acme Corp", value: 1250000 }, { name: "TechSolutions", value: 980000 }, { name: "GlobalServices", value: 850000 }, { name: "Innovate Inc", value: 720000 }, { name: "PrimeConsulting", value: 690000 }, ]} series={[{ dataKey: "value", name: "Annual Spend", fill: CHART_COLORS.primary }]} xAxisKey="name" height={320} showGrid={true} showLegend={false} useCustomTooltip={true}/></div></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Vendor Risk Overview</CardTitle></CardHeader>
                <CardContent><div className="h-80"><DynamicChart type="pie" data={[ { name: "Low Risk", value: 65, color: CHART_COLORS.success }, { name: "Medium Risk", value: 25, color: CHART_COLORS.warning }, { name: "High Risk", value: 10, color: CHART_COLORS.danger }, ]} series={[{ dataKey: "value" }]} height={320} showLegend={false} useCustomTooltip={true} colors={[CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.danger]} pieConfig={{ dataKey: "value", nameKey: "name", innerRadius: 50, outerRadius: 100, paddingAngle: 2, label: true, }}/></div></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Vendor Compliance Status</CardTitle></CardHeader>
                <CardContent><div className="h-80"><DynamicChart type="bar" data={[ { category: "Data Privacy", compliant: 85, nonCompliant: 15 }, { category: "Security", compliant: 92, nonCompliant: 8 }, { category: "Financial", compliant: 78, nonCompliant: 22 }, { category: "Regulatory", compliant: 88, nonCompliant: 12 }, ]} series={[ { dataKey: "compliant", name: "Compliant", fill: CHART_COLORS.success, stackId: "stack1" }, { dataKey: "nonCompliant", name: "Non-Compliant", fill: CHART_COLORS.danger, stackId: "stack1" } ]} xAxisKey="category" height={320} stacked={true} showGrid={true} showLegend={true} useCustomTooltip={true}/></div></CardContent>
              </Card>
            </div>
          </TabsContent>

        </div>
      </Tabs>
    </div>
  );
};

export default DashboardContent;