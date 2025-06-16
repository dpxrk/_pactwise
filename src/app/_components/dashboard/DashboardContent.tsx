// src/app/_components/dashboard/DashboardContent.tsx
'use client';

import React, { useState } from "react";
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
  AlertCircle,
  FileText,
  Users,
  Calendar
} from "lucide-react";
import { MetricCard } from "@/app/_components/common/MetricCard";
import DynamicChart from "@/app/_components/common/DynamicCharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

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

interface DashboardContentProps {
  enterpriseId: Id<"enterprises">;
}

const DashboardContent: React.FC<DashboardContentProps> = ({ enterpriseId }) => {
  const [timeRange, setTimeRange] = useState("month");

  // Fetch data from Convex backend
  const contractStats = useQuery(api.contracts.getContractStats, { enterpriseId });
  const contractsData = useQuery(api.contracts.getContracts, { 
    enterpriseId,
    status: "all",
    contractType: "all"
  });
  const contracts = contractsData?.contracts;
  const vendorsData = useQuery(api.vendors.getVendors, { 
    enterpriseId,
    category: "all"
  });
  const vendors = vendorsData?.vendors;
  
  // Agent system data
  const agentSystemStatus = useQuery(api.agents.manager.getAgentSystemStatus, {});
  const recentInsights = useQuery(api.agents.manager.getRecentInsights, { limit: 10 });

  // Helper functions
  const formatCurrency = (value: number) => {
    if (isNaN(value) || typeof value !== 'number') return '$0';
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatYAxis = (value: number) => {
    if (isNaN(value) || typeof value !== 'number') return '0';
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return value.toString();
  };

  // Calculate metrics from actual data
  const calculateTotalContractValue = () => {
    if (!contracts || !Array.isArray(contracts)) return 0;
    return contracts.reduce((total, contract) => {
      const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
      return total + (isNaN(value) ? 0 : value);
    }, 0);
  };

  const calculateActiveContracts = () => {
    return contractStats?.byStatus?.active || 0;
  };

  const calculateExpiringContracts = () => {
    if (!contracts || !Array.isArray(contracts)) return 0;
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    return contracts.filter(contract => {
      if (!contract.extractedEndDate) return false;
      const endDate = new Date(contract.extractedEndDate);
      return endDate <= thirtyDaysFromNow && endDate > new Date();
    }).length;
  };

  const getStatusDistributionData = () => {
    if (!contractStats?.byStatus) return [];
    
    const statusColors: Record<string, string> = {
      active: "#10b981",
      draft: "#60a5fa", 
      pending_analysis: "#f59e0b",
      expired: "#ef4444",
      terminated: "#8b5cf6",
      archived: "#6b7280"
    };

    return Object.entries(contractStats.byStatus).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
      value: count,
      color: statusColors[status] || "#6b7280"
    }));
  };

  const getContractTypeData = () => {
    if (!contractStats?.byType) return [];
    
    const typeColors: Record<string, string> = {
      nda: CHART_COLORS.primary,
      msa: CHART_COLORS.secondary,
      saas: CHART_COLORS.tertiary,
      sow: CHART_COLORS.quaternary,
      lease: "#8b5cf6",
      employment: "#06b6d4",
      partnership: "#84cc16",
      other: "#6b7280"
    };

    return Object.entries(contractStats.byType).map(([type, count]) => ({
      name: type.toUpperCase(),
      value: count,
      color: typeColors[type] || "#6b7280"
    }));
  };

  const getVendorCategoryData = () => {
    if (!vendors || !Array.isArray(vendors)) return [];
    
    const categoryCount: Record<string, number> = {};
    vendors.forEach(vendor => {
      const category = vendor.category || 'other';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });

    const categoryColors: Record<string, string> = {
      technology: CHART_COLORS.primary,
      marketing: CHART_COLORS.secondary,
      legal: CHART_COLORS.tertiary,
      finance: CHART_COLORS.quaternary,
      hr: "#8b5cf6",
      facilities: "#06b6d4",
      logistics: "#84cc16",
      manufacturing: "#f59e0b",
      consulting: "#ef4444",
      other: "#6b7280"
    };

    return Object.entries(categoryCount).map(([category, count]) => ({
      name: category.charAt(0).toUpperCase() + category.slice(1),
      value: count,
      color: categoryColors[category] || "#6b7280"
    }));
  };

  const getRiskDistributionData = () => {
    // Calculate risk based on contract values and types
    if (!contracts || !Array.isArray(contracts)) return [];
    
    let lowRisk = 0, mediumRisk = 0, highRisk = 0;
    
    contracts.forEach(contract => {
      const value = parseFloat(contract.extractedPricing?.replace(/[^0-9.-]/g, '') || '0');
      const type = contract.contractType;
      
      // Simple risk calculation based on value and type
      if (value > 100000 || ['partnership', 'msa'].includes(type || '')) {
        highRisk++;
      } else if (value > 10000 || ['saas', 'employment'].includes(type || '')) {
        mediumRisk++;
      } else {
        lowRisk++;
      }
    });

    return [
      { name: "Low Risk", value: lowRisk, color: CHART_COLORS.success },
      { name: "Medium Risk", value: mediumRisk, color: CHART_COLORS.warning },
      { name: "High Risk", value: highRisk, color: CHART_COLORS.danger }
    ];
  };

  // Loading state
  const isLoading = contractStats === undefined || contractsData === undefined || vendorsData === undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="mb-4 p-3 bg-primary/5 rounded-sm inline-block">
            <div className="w-10 h-10 border-t-2 border-primary animate-spin rounded-full"></div>
          </div>
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  const totalContractValue = calculateTotalContractValue();
  const activeContracts = calculateActiveContracts();
  const expiringCount = calculateExpiringContracts();
  const totalVendors = (vendors && Array.isArray(vendors)) ? vendors.length : 0;
  const agentInsights = recentInsights?.length || 0;

  return (
    <div className="w-full min-h-screen bg-background">
      <Tabs defaultValue="overview" className="w-full">
        <div className="flex flex-col space-y-4 px-4 py-6">
          <div className="flex justify-between items-center">
            <TabsList className="bg-background-light">
              <TabsTrigger value="overview">Executive Summary</TabsTrigger>
              <TabsTrigger value="contracts">Contract Analytics</TabsTrigger>
              <TabsTrigger value="vendors">Vendor Insights</TabsTrigger>
              <TabsTrigger value="agents">AI Agents</TabsTrigger>
            </TabsList>
          </div>

          {/* Alert for expiring contracts */}
          {expiringCount > 0 && (
            <Alert className="mb-4 border-amber-200 bg-amber-50 dark:bg-amber-900/20">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Attention Required</AlertTitle>
              <AlertDescription className="text-amber-700">
                {expiringCount} {expiringCount === 1 ? 'contract expires' : 'contracts expire'} in the next 30 days.
                <Button variant="link" className="p-0 h-auto text-amber-800 font-medium hover:text-amber-900 ml-1">
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
                description="Total portfolio value"
              />
              <MetricCard
                title="Active Contracts"
                value={activeContracts.toString()}
                icon={FileText}
                trend={8.2}
                changeType="positive"
                description="Currently active contracts"
              />
              <MetricCard
                title="Total Vendors"
                value={totalVendors.toString()}
                icon={Users}
                trend={15.3}
                changeType="positive"
                description="Vendor relationships"
              />
              <MetricCard
                title="Expiring Soon"
                value={expiringCount.toString()}
                icon={Calendar}
                trend={-5.7}
                changeType={expiringCount > 5 ? "negative" : "positive"}
                description="Contracts expiring in 30 days"
              />
            </div>

            {/* AI Insights Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard 
                title="AI Insights Generated" 
                value={agentInsights.toString()} 
                icon={Activity} 
                trend={25.4} 
                changeType="positive" 
                description="Recent AI analysis insights"
              />
              <MetricCard 
                title="System Health" 
                value={agentSystemStatus?.system?.isRunning ? "Running" : "Stopped"} 
                icon={ShieldCheck} 
                trend={0} 
                changeType="neutral" 
                description="AI agent system status"
              />
              <MetricCard 
                title="Active Agents" 
                value={agentSystemStatus?.stats?.activeAgents?.toString() || "0"} 
                icon={Target} 
                trend={0} 
                changeType="neutral" 
                description="Currently running agents"
              />
            </div>

            {/* Contract Analysis Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border border-gold/10 shadow-luxury">
                <CardHeader>
                  <CardTitle className="text-primary font-sans">Contract Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <DynamicChart 
                      type="pie" 
                      data={getStatusDistributionData()} 
                      series={[{ dataKey: "value" }]} 
                      height={300} 
                      showLegend={false} 
                      colors={getStatusDistributionData().map(item => item.color)}
                      pieConfig={{ 
                        dataKey: "value", 
                        nameKey: "name", 
                        innerRadius: 60, 
                        outerRadius: 100, 
                        paddingAngle: 2 
                      }}
                    />
                    <div className="flex justify-center mt-2 flex-wrap gap-2">
                      {getStatusDistributionData().map((item, index) => (
                        <div key={index} className="flex items-center">
                          <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: item.color }} />
                          <span className="text-xs">{item.name} ({item.value})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gold/10 shadow-luxury">
                <CardHeader>
                  <CardTitle className="text-primary font-sans">Risk Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <DynamicChart 
                      type="pie" 
                      data={getRiskDistributionData()} 
                      series={[{ dataKey: "value" }]} 
                      height={300} 
                      showLegend={false} 
                      colors={getRiskDistributionData().map(item => item.color)}
                      pieConfig={{ 
                        dataKey: "value", 
                        nameKey: "name", 
                        innerRadius: 60, 
                        outerRadius: 100, 
                        paddingAngle: 2 
                      }}
                    />
                    <div className="flex justify-center mt-2 space-x-4">
                      {getRiskDistributionData().map((item, index) => (
                        <div key={index} className="flex items-center">
                          <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: item.color }} />
                          <span className="text-xs">{item.name} ({item.value})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="contracts" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard 
                title="Total Contracts" 
                value={contractStats?.total?.toString() || "0"} 
                icon={FileText} 
                description="All contracts in system"
              />
              <MetricCard 
                title="Active Contracts" 
                value={contractStats?.byStatus?.active?.toString() || "0"} 
                icon={Activity} 
                description="Currently active contracts"
              />
              <MetricCard 
                title="Draft Contracts" 
                value={contractStats?.byStatus?.draft?.toString() || "0"} 
                icon={Activity} 
                description="Contracts in draft status"
              />
              <MetricCard 
                title="Recently Created" 
                value={contractStats?.recentlyCreated?.toString() || "0"} 
                icon={Calendar} 
                description="Created in last 7 days"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Contract Types Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <DynamicChart 
                      type="bar" 
                      data={getContractTypeData()} 
                      series={[{ dataKey: "value", name: "Count", fill: CHART_COLORS.primary }]} 
                      xAxisKey="name" 
                      height={320} 
                      showGrid={true} 
                      showLegend={false} 
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Analysis Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <DynamicChart 
                      type="pie" 
                      data={Object.entries(contractStats?.byAnalysisStatus || {}).map(([status, count]) => ({
                        name: status.charAt(0).toUpperCase() + status.slice(1),
                        value: count,
                        color: status === 'completed' ? CHART_COLORS.success : 
                               status === 'failed' ? CHART_COLORS.danger : 
                               status === 'processing' ? CHART_COLORS.warning : CHART_COLORS.primary
                      }))} 
                      series={[{ dataKey: "value" }]} 
                      height={320} 
                      showLegend={true} 
                      pieConfig={{ 
                        dataKey: "value", 
                        nameKey: "name", 
                        innerRadius: 60, 
                        outerRadius: 120 
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="vendors" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard 
                title="Total Vendors" 
                value={totalVendors.toString()} 
                icon={Building} 
                description="Registered vendor relationships"
              />
              <MetricCard 
                title="Active Relationships" 
                value={(vendors && Array.isArray(vendors)) ? vendors.filter(v => v.contractCount > 0).length.toString() : "0"} 
                icon={Activity} 
                description="Vendors with active contracts"
              />
              <MetricCard 
                title="Avg Contracts per Vendor" 
                value={(totalVendors > 0 ? ((contractStats?.total || 0) / totalVendors).toFixed(1) : "0")} 
                icon={Target} 
                description="Average contracts per vendor"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Vendor Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <DynamicChart 
                      type="bar" 
                      data={getVendorCategoryData()} 
                      series={[{ dataKey: "value", name: "Vendors", fill: CHART_COLORS.secondary }]} 
                      xAxisKey="name" 
                      height={320} 
                      showGrid={true} 
                      showLegend={false} 
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Vendors by Contract Count</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <DynamicChart 
                      type="bar" 
                      data={(vendors && Array.isArray(vendors)) ? vendors
                        .sort((a, b) => (b.contractCount || 0) - (a.contractCount || 0))
                        .slice(0, 5)
                        .map(vendor => ({
                          name: vendor.name.length > 15 ? vendor.name.substring(0, 15) + '...' : vendor.name,
                          value: vendor.contractCount || 0
                        })) : []
                      } 
                      series={[{ dataKey: "value", name: "Contracts", fill: CHART_COLORS.tertiary }]} 
                      xAxisKey="name" 
                      height={320} 
                      showGrid={true} 
                      showLegend={false} 
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="agents" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard 
                title="System Status" 
                value={agentSystemStatus?.system?.isRunning ? "Running" : "Stopped"} 
                icon={Activity} 
                description="AI agent system status"
              />
              <MetricCard 
                title="Active Agents" 
                value={agentSystemStatus?.stats?.activeAgents?.toString() || "0"} 
                icon={Users} 
                description="Currently running agents"
              />
              <MetricCard 
                title="Recent Insights" 
                value={agentSystemStatus?.stats?.recentInsights?.toString() || "0"} 
                icon={TrendingUp} 
                description="Insights generated (24h)"
              />
              <MetricCard 
                title="Active Tasks" 
                value={agentSystemStatus?.stats?.activeTasks?.toString() || "0"} 
                icon={Calendar} 
                description="Tasks being processed"
              />
            </div>

            {/* Recent AI Insights */}
            <Card>
              <CardHeader>
                <CardTitle>Recent AI Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentInsights && recentInsights.length > 0 ? (
                    recentInsights.slice(0, 5).map((insight, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
                        <div className={`w-2 h-2 rounded-full mt-2 ${
                          insight.priority === 'critical' ? 'bg-red-500' :
                          insight.priority === 'high' ? 'bg-orange-500' :
                          insight.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`} />
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{insight.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
                          <div className="flex items-center space-x-2 mt-2 text-xs text-muted-foreground">
                            <span>{insight.agentName}</span>
                            <span>•</span>
                            <span>{new Date(insight.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No recent AI insights available.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default DashboardContent;