'use client';

import React from "react";
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
} from "lucide-react";
import { MetricCard } from "@/app/_components/common/MetricCard";
import DynamicChart from "@/app/_components/common/DynamicCharts"

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
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Chart data for portfolio performance
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

  // Risk data for pie chart
  const riskData = [
    { name: "Low Risk", value: 65, color: CHART_COLORS.success },
    { name: "Medium Risk", value: 25, color: CHART_COLORS.warning },
    { name: "High Risk", value: 10, color: CHART_COLORS.danger },
  ];

  // Value distribution data for pie chart
  const valueDistributionData = [
    { name: "Strategic", value: 45, color: CHART_COLORS.primary },
    { name: "Operational", value: 30, color: CHART_COLORS.secondary },
    { name: "Tactical", value: 15, color: CHART_COLORS.tertiary },
    { name: "Support", value: 10, color: CHART_COLORS.quaternary },
  ];

  // Custom formatter for y-axis values
  const formatYAxis = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return value;
  };

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

          <TabsContent value="overview" className="space-y-6 mt-0">
            {/* Executive KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Contract Value"
                value={formatCurrency(125000000)}
                icon={DollarSign}
                trend={12.5}
                changeType="positive"
                description="YTD Contract Portfolio"
              />
              <MetricCard
                title="Cost Optimization"
                value={formatCurrency(7500000)}
                icon={TrendingUp}
                trend={15.3}
                changeType="positive"
                description="Annual savings achieved"
              />
              <MetricCard
                title="Risk-Weighted Exposure"
                value={formatCurrency(28000000)}
                icon={Scale}
                trend={-8.2}
                changeType="positive"
                description="Total risk-adjusted value"
              />
              <MetricCard
                title="Operational Efficiency"
                value="92.5%"
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

              <Card className="border border-gold/10 shadow-luxury ">
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

          {/* These would be implemented in a similar fashion */}
          <TabsContent value="contracts">
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Contract Analytics content would go here</p>
            </div>
          </TabsContent>
          
          <TabsContent value="vendors">
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Vendor Insights content would go here</p>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default DashboardContent;