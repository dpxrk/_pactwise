'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  DollarSign, 
  AlertTriangle, 
  BarChart3,
  Loader2
} from 'lucide-react';
import { useAnalyticsWorker } from '@/hooks/useWebWorker';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import DynamicChart from '@/app/_components/common/DynamicCharts';
import { PremiumLoader } from '@/components/premium';

interface OptimizedAnalyticsProps {
  enterpriseId: Id<"enterprises">;
}

/**
 * Optimized Analytics Component using Web Workers
 * Offloads heavy calculations to prevent UI blocking
 */
// Re-export the optimized version
export { OptimizedAnalyticsV2 as OptimizedAnalytics } from './OptimizedAnalyticsV2';
export { default } from './OptimizedAnalyticsV2';

// Keep the old implementation for backward compatibility but mark as deprecated
/** @deprecated Use OptimizedAnalyticsV2 instead */
const LegacyOptimizedAnalytics: React.FC<OptimizedAnalyticsProps> = ({ 
  enterpriseId 
}) => {
  const [stats, setStats] = useState<any>(null);
  const [spendAnalysis, setSpendAnalysis] = useState<any>(null);
  const [riskAnalysis, setRiskAnalysis] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch raw data from Convex
  const contractsData = useQuery(api.contracts.getContracts, {
    enterpriseId,
    status: "all",
    contractType: "all"
  });
  const vendorsData = useQuery(api.vendors.getVendors, {
    enterpriseId,
    category: "all"
  });

  // Initialize Web Worker
  const {
    calculateStats,
    analyzeSpending,
    calculateRisk,
    generateForecast,
    isProcessing,
    error,
    progress
  } = useAnalyticsWorker();

  // Process data when it changes
  useEffect(() => {
    if (!contractsData?.contracts || !vendorsData?.vendors) return;

    const processAnalytics = async () => {
      try {
        // Run calculations in parallel using Web Workers
        const [statsResult, spendResult, riskResult] = await Promise.all([
          calculateStats(contractsData.contracts),
          analyzeSpending(contractsData.contracts, vendorsData.vendors),
          calculateRisk(contractsData.contracts, vendorsData.vendors)
        ]);

        setStats(statsResult);
        setSpendAnalysis(spendResult);
        setRiskAnalysis(riskResult);

        // Generate forecast based on historical data
        const forecastResult = await generateForecast({
          contracts: contractsData.contracts,
          period: 6
        });
        setForecast(forecastResult);
      } catch (err) {
        console.error('Analytics processing error:', err);
      }
    };

    processAnalytics();
  }, [contractsData, vendorsData, calculateStats, analyzeSpending, calculateRisk, generateForecast]);

  // Memoized chart data
  const chartData = useMemo(() => {
    if (!stats || !spendAnalysis) return null;

    return {
      statusDistribution: Object.entries(stats.byStatus).map(([status, count]) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: count as number,
        color: getStatusColor(status)
      })),
      valueDistribution: stats.byValue.distribution,
      spendByCategory: Object.entries(spendAnalysis.byCategory).map(([category, amount]) => ({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        amount: amount as number
      })),
      monthlyTrend: Object.entries(spendAnalysis.trends.monthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, amount]) => ({
          month: formatMonth(month),
          amount: amount as number
        }))
    };
  }, [stats, spendAnalysis]);

  if (isProcessing && !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <PremiumLoader size="lg" />
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Processing analytics data...</p>
          {progress > 0 && <Progress value={progress} className="w-48 mt-2" />}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error processing analytics: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!stats || !chartData) {
    return <div>No data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="Total Contract Value"
          value={formatCurrency(stats.byValue.total)}
          icon={DollarSign}
          trend={12.5}
          description="Across all active contracts"
        />
        <SummaryCard
          title="Risk Score"
          value={`${riskAnalysis?.overall || 0}/100`}
          icon={AlertTriangle}
          trend={-5.2}
          description="Overall risk assessment"
          variant={riskAnalysis?.overall > 50 ? 'warning' : 'default'}
        />
        <SummaryCard
          title="Contracts Expiring"
          value={stats.expiring.next30Days}
          icon={BarChart3}
          trend={stats.expiring.next30Days > 5 ? 25 : 0}
          description="In the next 30 days"
          variant={stats.expiring.next30Days > 5 ? 'warning' : 'default'}
        />
        <SummaryCard
          title="Health Score"
          value={`${stats.health.score}%`}
          icon={TrendingUp}
          trend={3.7}
          description="Contract portfolio health"
          variant={stats.health.score < 70 ? 'warning' : 'success'}
        />
      </div>

      {/* Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="spending">Spending</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Contract Status Distribution">
              <DynamicChart
                type="donut"
                data={chartData.statusDistribution}
                height={300}
              />
            </ChartCard>
            <ChartCard title="Value Distribution">
              <DynamicChart
                type="bar"
                data={chartData.valueDistribution}
                height={300}
                xKey="range"
                yKey="count"
              />
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="spending" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Spend by Category">
              <DynamicChart
                type="bar"
                data={chartData.spendByCategory}
                height={300}
                xKey="category"
                yKey="amount"
              />
            </ChartCard>
            <ChartCard title="Monthly Spend Trend">
              <DynamicChart
                type="line"
                data={chartData.monthlyTrend}
                height={300}
                xKey="month"
                yKey="amount"
              />
            </ChartCard>
          </div>
          {spendAnalysis?.opportunities && (
            <OpportunitiesList opportunities={spendAnalysis.opportunities} />
          )}
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          <RiskAnalysisView analysis={riskAnalysis} />
        </TabsContent>

        <TabsContent value="forecast" className="space-y-4">
          <ForecastView forecast={forecast} />
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <InsightsView 
            stats={stats} 
            spendAnalysis={spendAnalysis}
            riskAnalysis={riskAnalysis}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Helper Components
const SummaryCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: number;
  description?: string;
  variant?: 'default' | 'success' | 'warning';
}> = ({ title, value, icon: Icon, trend, description, variant = 'default' }) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'text-green-600 bg-green-50';
      case 'warning':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-primary bg-primary/10';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-full ${getVariantStyles()}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend !== undefined && (
          <div className={`flex items-center mt-2 text-xs ${
            trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-600'
          }`}>
            <TrendingUp className={`h-3 w-3 mr-1 ${trend < 0 ? 'rotate-180' : ''}`} />
            {Math.abs(trend)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ 
  title, 
  children 
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const OpportunitiesList: React.FC<{ opportunities: any[] }> = ({ opportunities }) => (
  <Card>
    <CardHeader>
      <CardTitle>Cost Savings Opportunities</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {opportunities.slice(0, 5).map((opp, index) => (
          <div key={index} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <p className="font-medium text-sm">{opp.recommendation}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {opp.type === 'high_spend_vendor' && `${opp.vendorName} - ${formatCurrency(opp.amount)}`}
                {opp.type === 'consolidation_opportunity' && `${opp.vendorName} - ${opp.contracts} contracts`}
                {opp.type === 'category_concentration' && `${opp.category} - ${opp.percentage.toFixed(1)}% of spend`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-green-600">
                {formatCurrency(opp.potential_savings)}
              </p>
              <p className="text-xs text-muted-foreground">potential savings</p>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

const RiskAnalysisView: React.FC<{ analysis: any }> = ({ analysis }) => {
  if (!analysis) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Risk Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(analysis.byCategory).map(([category, score]) => (
              <div key={category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize">{category}</span>
                  <span>{score}/100</span>
                </div>
                <Progress 
                  value={score as number} 
                  className={`h-2 ${
                    (score as number) > 60 ? 'bg-red-200' : 
                    (score as number) > 30 ? 'bg-yellow-200' : 
                    'bg-green-200'
                  }`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>High Risk Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {analysis.items.slice(0, 5).map((item: any, index: number) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="truncate flex-1">{item.contractTitle}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  item.severity === 'critical' ? 'bg-red-100 text-red-700' :
                  item.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {item.totalRisk}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ForecastView: React.FC<{ forecast: any }> = ({ forecast }) => {
  if (!forecast || forecast.error) {
    return (
      <Alert>
        <AlertDescription>
          {forecast?.error || 'Insufficient data for forecasting'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contract Volume Forecast</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Trend: <span className={`font-medium ${
            forecast.trend === 'increasing' ? 'text-green-600' :
            forecast.trend === 'decreasing' ? 'text-red-600' :
            'text-gray-600'
          }`}>{forecast.trend}</span>
        </p>
        <DynamicChart
          type="line"
          data={[
            ...forecast.historical.map((p: any) => ({ 
              month: formatMonth(p.month), 
              value: p.y, 
              type: 'Actual' 
            })),
            ...forecast.forecast.map((p: any) => ({ 
              month: formatMonth(p.month), 
              value: p.predicted, 
              type: 'Forecast' 
            }))
          ]}
          height={300}
          xKey="month"
          yKey="value"
        />
      </CardContent>
    </Card>
  );
};

const InsightsView: React.FC<{ stats: any; spendAnalysis: any; riskAnalysis: any }> = ({
  stats,
  spendAnalysis,
  riskAnalysis
}) => (
  <div className="space-y-4">
    {stats.health.issues.length > 0 && (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {stats.health.issues.length} contracts need attention
        </AlertDescription>
      </Alert>
    )}
    
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {generateInsights(stats, spendAnalysis, riskAnalysis).map((insight, index) => (
        <Card key={index}>
          <CardHeader>
            <CardTitle className="text-sm">{insight.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{insight.description}</p>
            {insight.action && (
              <p className="text-sm font-medium mt-2 text-primary">{insight.action}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

// Helper functions
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { 
    month: 'short', 
    year: '2-digit' 
  });
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: '#10b981',
    expired: '#ef4444',
    pending: '#f59e0b',
    draft: '#6b7280',
  };
  return colors[status] || '#6b7280';
}

function generateInsights(stats: any, spendAnalysis: any, riskAnalysis: any): any[] {
  const insights = [];

  if (stats.expiring.next7Days > 0) {
    insights.push({
      title: 'Urgent Contract Renewals',
      description: `${stats.expiring.next7Days} contracts expire within 7 days`,
      action: 'Review and initiate renewal process'
    });
  }

  if (spendAnalysis?.opportunities?.length > 0) {
    const totalSavings = spendAnalysis.opportunities.reduce(
      (sum: number, opp: any) => sum + (opp.potential_savings || 0), 0
    );
    insights.push({
      title: 'Cost Optimization Potential',
      description: `${formatCurrency(totalSavings)} in potential savings identified`,
      action: 'Review optimization opportunities'
    });
  }

  if (riskAnalysis?.overall > 70) {
    insights.push({
      title: 'High Risk Alert',
      description: 'Portfolio risk score exceeds acceptable threshold',
      action: 'Immediate risk mitigation required'
    });
  }

  return insights;
}

// Export the legacy version as a named export for transition period
export { LegacyOptimizedAnalytics };