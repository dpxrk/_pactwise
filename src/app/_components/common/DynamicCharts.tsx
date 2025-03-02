//@ts-nocheck
"use client";


import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  RadialBarChart,
  RadialBar,
  ScatterChart,
  Scatter,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import CustomTooltip from "./CustomToolTip";

// Define available chart types
type ChartType = 
  | 'line' 
  | 'bar' 
  | 'area' 
  | 'pie' 
  | 'radar' 
  | 'radialBar' 
  | 'scatter'
  | 'composed';

// Define chart series configuration
interface SeriesConfig {
  dataKey: string;
  name?: string;
  color?: string;
  type?: 'line' | 'bar' | 'area' | 'scatter'; // For composed charts
  stackId?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dot?: boolean | object;
  activeDot?: object;
  isAnimationActive?: boolean;
  fillOpacity?: number;
}

interface DynamicChartProps {
  type: ChartType;
  data: any[];
  series: SeriesConfig[];
  width?: string | number;
  height?: number;
  layout?: 'horizontal' | 'vertical';
  stacked?: boolean;
  xAxisKey?: string;
  yAxisLabel?: string;
  xAxisLabel?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  useCustomTooltip?: boolean;
  colors?: string[];
  margin?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  pieConfig?: {
    innerRadius?: number;
    outerRadius?: number;
    paddingAngle?: number;
    dataKey: string;
    nameKey?: string;
    labelLine?: boolean;
    label?: boolean | React.ReactNode | Function;
  };
  radarConfig?: {
    outerRadius?: number;
    dataKey: string;
  };
  radialBarConfig?: {
    innerRadius?: number;
    outerRadius?: number;
    dataKey: string;
    startAngle?: number;
    endAngle?: number;
  };
  syncId?: string; // For synchronized charts
}

const DynamicChart: React.FC<DynamicChartProps> = ({
  type,
  data,
  series,
  width = "100%",
  height = 400,
  layout = 'horizontal',
  stacked = false,
  xAxisKey = "name",
  yAxisLabel,
  xAxisLabel,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  useCustomTooltip = false,
  colors = ["hsl(var(--gold))", "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"],
  margin = { top: 20, right: 30, left: 20, bottom: 20 },
  pieConfig,
  radarConfig,
  radialBarConfig,
  syncId
}) => {
  // Generate color for a series
  const getColor = (index: number) => colors[index % colors.length];

  // Add this helper function near the top of the component
  const getNumericSize = (size: string | number | undefined) => {
    return typeof size === 'string' ? 0 : size;
  };

  // Common chart components
  const renderCartesianComponents = () => (
    <>
      {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
      <XAxis 
        dataKey={xAxisKey} 
        label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5 } : undefined}
        tick={{ fill: 'hsl(var(--muted-foreground))' }}
        axisLine={{ stroke: 'hsl(var(--border))' }}
      />
      <YAxis 
        label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
        tick={{ fill: 'hsl(var(--muted-foreground))' }}
        axisLine={{ stroke: 'hsl(var(--border))' }}
      />
      {showTooltip && useCustomTooltip ? <Tooltip content={<CustomTooltip />} /> : showTooltip ? <Tooltip /> : null}
      {showLegend && <Legend wrapperStyle={{ paddingTop: 10 }} />}
    </>
  );

  // Render Line Series
  const renderLineSeries = () => (
    <>
      {series.map((item, index) => (
        <Line
          key={`line-${item.dataKey}`}
          type="monotone"
          dataKey={item.dataKey}
          name={item.name || item.dataKey}
          stroke={item.color || item.stroke || getColor(index)}
          strokeWidth={item.strokeWidth || 2}
          dot={item.dot !== undefined ? item.dot : { r: 4, fill: item.color || getColor(index) }}
          activeDot={item.activeDot || { r: 6 }}
          isAnimationActive={item.isAnimationActive !== undefined ? item.isAnimationActive : true}
          fillOpacity={item.fillOpacity || 0.3}
          
        />
      ))}
    </>
  );

  // Render Bar Series
  const renderBarSeries = () => (
    <>
      {series.map((item, index) => (
        <Bar
          key={`bar-${item.dataKey}`}
          dataKey={item.dataKey}
          name={item.name || item.dataKey}
          fill={item.color || item.fill || getColor(index)}
          stroke={item.stroke || 'none'}
          strokeWidth={item.strokeWidth || 0}
          isAnimationActive={item.isAnimationActive !== undefined ? item.isAnimationActive : true}
          stackId={stacked ? '1' : undefined}
        />
      ))}
    </>
  );

  // Render Area Series
  const renderAreaSeries = () => (
    <>
      {series.map((item, index) => (
        <Area
          key={`area-${item.dataKey}`}
          type="monotone"
          dataKey={item.dataKey}
          name={item.name || item.dataKey}
          fill={item.fill || item.color || getColor(index)}
          stroke={item.stroke || item.color || getColor(index)}
          strokeWidth={item.strokeWidth || 2}
          dot={item.dot !== undefined ? item.dot : { r: 4 }}
          activeDot={item.activeDot || { r: 6 }}
          isAnimationActive={item.isAnimationActive !== undefined ? item.isAnimationActive : true}
          fillOpacity={item.fillOpacity || 0.3}
          stackId={stacked ? '1' : undefined}
        />
      ))}
    </>
  );

  // Render Pie Series
  const renderPieChart = () => {
    if (!pieConfig) return null;
    
    return (
      <PieChart width={getNumericSize(width)} height={height} margin={margin}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={pieConfig.labelLine !== undefined ? pieConfig.labelLine : true}
          label={pieConfig.label !== undefined ? pieConfig.label : true}
          outerRadius={pieConfig.outerRadius || 150}
          innerRadius={pieConfig.innerRadius || 0}
          fill={colors[0]}
          dataKey={pieConfig.dataKey}
          nameKey={pieConfig.nameKey || xAxisKey}
          paddingAngle={pieConfig.paddingAngle || 0}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getColor(index)} />
          ))}
        </Pie>
        {showLegend && <Legend wrapperStyle={{ paddingTop: 20 }} />}
        {showTooltip && useCustomTooltip ? <Tooltip content={<CustomTooltip />} /> : showTooltip ? <Tooltip /> : null}
      </PieChart>
    );
  };

  // Render Radar Chart
  const renderRadarChart = () => {
    if (!radarConfig) return null;
    
    return (
      <RadarChart cx="50%" cy="50%" outerRadius={radarConfig.outerRadius || 150} width={width} height={height} data={data} margin={margin}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey={xAxisKey} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
        <PolarRadiusAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
        {series.map((item, index) => (
          <Radar 
            key={`radar-${item.dataKey}`}
            name={item.name || item.dataKey}
            dataKey={item.dataKey}
            stroke={item.stroke || item.color || getColor(index)}
            fill={item.fill || item.color || getColor(index)}
            fillOpacity={item.fillOpacity || 0.3}
          />
        ))}
        {showLegend && <Legend wrapperStyle={{ paddingTop: 20 }} />}
        {showTooltip && useCustomTooltip ? <Tooltip content={<CustomTooltip />} /> : showTooltip ? <Tooltip /> : null}
      </RadarChart>
    );
  };

  // Render RadialBar Chart
  const renderRadialBarChart = () => {
    if (!radialBarConfig) return null;
    
    return (
      <RadialBarChart 
        cx="50%" 
        cy="50%" 
        innerRadius={radialBarConfig.innerRadius || 20} 
        outerRadius={radialBarConfig.outerRadius || 140} 
        startAngle={radialBarConfig.startAngle || 0} 
        endAngle={radialBarConfig.endAngle || 360} 
        width={width} 
        height={height} 
        data={data}
        margin={margin}
      >
        <RadialBar
          label={{ position: 'insideStart', fill: 'hsl(var(--foreground))' }}
          background={{ fill: 'hsl(var(--background))' }}
          dataKey={radialBarConfig.dataKey}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getColor(index)} />
          ))}
        </RadialBar>
        {showLegend && <Legend wrapperStyle={{ paddingTop: 20 }} iconSize={10} />}
        {showTooltip && useCustomTooltip ? <Tooltip content={<CustomTooltip />} /> : showTooltip ? <Tooltip /> : null}
      </RadialBarChart>
    );
  };

  // Render Scatter Chart
  const renderScatterChart = () => (
    <ScatterChart width={width} height={height} margin={margin}>
      {renderCartesianComponents()}
      {series.map((item, index) => (
        <Scatter
          key={`scatter-${item.dataKey}`}
          name={item.name || item.dataKey}
          data={data}
          fill={item.fill || item.color || getColor(index)}
          line={{ stroke: item.stroke || item.color || getColor(index) }}
          dataKey={item.dataKey}
        />
      ))}
    </ScatterChart>
  );

  // Render Composed Chart
  const renderComposedChart = () => (
    <ComposedChart width={width} height={height} data={data} layout={layout} margin={margin} syncId={syncId}>
      {renderCartesianComponents()}
      {series.map((item, index) => {
        const color = item.color || getColor(index);
        switch (item.type) {
          case 'line':
            return (
              <Line
                key={`line-${item.dataKey}`}
                type="monotone"
                dataKey={item.dataKey}
                name={item.name || item.dataKey}
                stroke={item.stroke || color}
                strokeWidth={item.strokeWidth || 2}
                dot={item.dot !== undefined ? item.dot : { r: 4 }}
                activeDot={item.activeDot || { r: 6 }}
                fill={item.fill || color}
                
              />
            );
          case 'bar':
            return (
              <Bar
                key={`bar-${item.dataKey}`}
                dataKey={item.dataKey}
                name={item.name || item.dataKey}
                fill={item.fill || color}
                stroke={item.stroke || 'none'}
                stackId={item.stackId}
              />
            );
          case 'area':
            return (
              <Area
                key={`area-${item.dataKey}`}
                type="monotone"
                dataKey={item.dataKey}
                name={item.name || item.dataKey}
                fill={item.fill || color}
                stroke={item.stroke || color}
                strokeWidth={item.strokeWidth || 2}
                fillOpacity={item.fillOpacity || 0.3}
                stackId={item.stackId}
              />
            );
          case 'scatter':
            return (
              <Scatter
                key={`scatter-${item.dataKey}`}
                name={item.name || item.dataKey}
                fill={item.fill || color}
                dataKey={item.dataKey}
              />
            );
          default:
            return null;
        }
      })}
    </ComposedChart>
  );

 
  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart width={width} height={height} data={data} layout={layout} margin={margin} syncId={syncId}>
            {renderCartesianComponents()}
            {renderLineSeries()}
          </LineChart>
        );
      case 'bar':
        return (
          <BarChart width={width} height={height} data={data} layout={layout} margin={margin} syncId={syncId}>
            {renderCartesianComponents()}
            {renderBarSeries()}
          </BarChart>
        );
      case 'area':
        return (
          <AreaChart width={width} height={height} data={data} layout={layout} margin={margin} syncId={syncId}>
            {renderCartesianComponents()}
            {renderAreaSeries()}
          </AreaChart>
        );
      case 'pie':
        return renderPieChart();
      case 'radar':
        return renderRadarChart();
      case 'radialBar':
        return renderRadialBarChart();
      case 'scatter':
        return renderScatterChart();
      case 'composed':
        return renderComposedChart();
      default:
        return <div>Unsupported chart type</div>;
    }
  };

  return (
    <ResponsiveContainer width={width} height={height}>
      {renderChart() || <div>No chart rendered</div>}
    </ResponsiveContainer>
  );
};

export default DynamicChart;