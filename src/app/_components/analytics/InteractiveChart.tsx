'use client'

import React, { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  AreaChart as AreaChartIcon,
  Download,
  Maximize2,
  Filter,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ChartType = "area" | "bar" | "line" | "pie";

export interface ChartDataPoint {
  name: string;
  value: number;
  category?: string;
  date?: string;
  [key: string]: any;
}

export interface ChartSeries {
  key: string;
  name: string;
  color: string;
  visible: boolean;
}

interface InteractiveChartProps {
  title: string;
  subtitle?: string;
  data: ChartDataPoint[];
  type?: ChartType;
  series?: ChartSeries[];
  height?: number;
  showExport?: boolean;
  showTypeSelector?: boolean;
  showSeriesToggle?: boolean;
  onDataPointClick?: (dataPoint: ChartDataPoint) => void;
  onDrillDown?: (category: string, value: any) => void;
  className?: string;
  loading?: boolean;
}

const CHART_COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00ff00",
  "#0088fe", "#00c49f", "#ffbb28", "#ff8042", "#8dd1e1"
];

const PIE_COLORS = [
  "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8",
  "#82ca9d", "#ffc658", "#ff7300", "#00ff00", "#8dd1e1"
];

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  title,
  subtitle,
  data,
  type = "area",
  series = [],
  height = 300,
  showExport = true,
  showTypeSelector = true,
  showSeriesToggle = true,
  onDataPointClick,
  onDrillDown,
  className,
  loading = false,
}) => {
  const [chartType, setChartType] = useState<ChartType>(type);
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(
    new Set(series.map(s => s.key))
  );

  // Process data based on visible series
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map(item => {
      const newItem = { ...item };
      series.forEach(s => {
        if (!visibleSeries.has(s.key)) {
          delete newItem[s.key];
        }
      });
      return newItem;
    });
  }, [data, series, visibleSeries]);

  // Calculate trend
  const trend = useMemo(() => {
    if (processedData.length < 2) return null;
    
    const firstValue = processedData[0].value || 0;
    const lastValue = processedData[processedData.length - 1].value || 0;
    const change = ((lastValue - firstValue) / firstValue) * 100;
    
    return {
      direction: change >= 0 ? 'up' : 'down',
      percentage: Math.abs(change).toFixed(1),
    };
  }, [processedData]);

  const toggleSeries = (seriesKey: string) => {
    setVisibleSeries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(seriesKey)) {
        newSet.delete(seriesKey);
      } else {
        newSet.add(seriesKey);
      }
      return newSet;
    });
  };

  const handleExport = () => {
    // Export functionality - could integrate with CSV export, PDF, etc.
    const dataStr = JSON.stringify(processedData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_data.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDataPointClick = (data: any) => {
    if (onDataPointClick) {
      onDataPointClick(data);
    }
    
    // Auto drill-down if category and value are available
    if (onDrillDown && data.category) {
      onDrillDown(data.category, data.value);
    }
  };

  const renderChart = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (!processedData || processedData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No data available
        </div>
      );
    }

    const commonProps = {
      data: processedData,
      height,
      onClick: handleDataPointClick,
    };

    switch (chartType) {
      case "area":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: '#e0e0e0' }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: '#e0e0e0' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              {showSeriesToggle && <Legend />}
              {series.length > 0 ? (
                series.map((s, index) => (
                  visibleSeries.has(s.key) && (
                    <Area
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      stackId="1"
                      stroke={s.color}
                      fill={s.color}
                      fillOpacity={0.6}
                    />
                  )
                ))
              ) : (
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={CHART_COLORS[0]}
                  fill={CHART_COLORS[0]}
                  fillOpacity={0.6}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        );

      case "bar":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              {showSeriesToggle && <Legend />}
              {series.length > 0 ? (
                series.map((s, index) => (
                  visibleSeries.has(s.key) && (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      fill={s.color}
                      radius={[2, 2, 0, 0]}
                    />
                  )
                ))
              ) : (
                <Bar
                  dataKey="value"
                  fill={CHART_COLORS[0]}
                  radius={[2, 2, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              {showSeriesToggle && <Legend />}
              {series.length > 0 ? (
                series.map((s) => (
                  visibleSeries.has(s.key) && (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  )
                ))
              ) : (
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={CHART_COLORS[0]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        );

      case "pie":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={processedData}
                cx="50%"
                cy="50%"
                outerRadius={Math.min(height * 0.35, 120)}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {processedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center space-x-2">
              <span>{title}</span>
              {trend && (
                <Badge variant="outline" className="flex items-center space-x-1">
                  {trend.direction === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  )}
                  <span className={trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}>
                    {trend.percentage}%
                  </span>
                </Badge>
              )}
            </CardTitle>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {showSeriesToggle && series.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {series.map((s) => (
                    <DropdownMenuItem
                      key={s.key}
                      onClick={() => toggleSeries(s.key)}
                      className="flex items-center space-x-2"
                    >
                      {visibleSeries.has(s.key) ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                      <span>{s.name}</span>
                      <div
                        className="w-3 h-3 rounded-full ml-auto"
                        style={{ backgroundColor: s.color }}
                      />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {showTypeSelector && (
              <Select value={chartType} onValueChange={(value: ChartType) => setChartType(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="area">
                    <div className="flex items-center space-x-2">
                      <AreaChartIcon className="h-4 w-4" />
                      <span>Area</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="bar">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="h-4 w-4" />
                      <span>Bar</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="line">
                    <div className="flex items-center space-x-2">
                      <LineChartIcon className="h-4 w-4" />
                      <span>Line</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="pie">
                    <div className="flex items-center space-x-2">
                      <PieChartIcon className="h-4 w-4" />
                      <span>Pie</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}

            {showExport && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4" />
              </Button>
            )}

            <Button variant="outline" size="sm">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {renderChart()}
      </CardContent>
    </Card>
  );
};

export default InteractiveChart;