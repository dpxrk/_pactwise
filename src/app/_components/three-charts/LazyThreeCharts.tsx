'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/premium/Skeleton';
import type { 
  BarChartProps, 
  LineChartProps, 
  PieChartProps, 
  AreaChartProps 
} from '@/types/three-charts.types';

// Loading component for charts
const ChartLoader = () => (
  <div className="w-full h-full flex items-center justify-center">
    <Skeleton className="w-full h-full" />
  </div>
);

// Lazy load Three.js chart components
export const LazyThreeBarChart = dynamic<BarChartProps>(
  () => import('./ThreeBarChart').then(mod => mod.ThreeBarChart),
  { 
    loading: ChartLoader,
    ssr: false // Disable SSR for Three.js components
  }
);

export const LazyThreeLineChart = dynamic<LineChartProps>(
  () => import('./ThreeLineChart').then(mod => mod.ThreeLineChart),
  { 
    loading: ChartLoader,
    ssr: false
  }
);

export const LazyThreePieChart = dynamic<PieChartProps>(
  () => import('./ThreePieChart').then(mod => mod.ThreePieChart),
  { 
    loading: ChartLoader,
    ssr: false
  }
);

export const LazyThreeAreaChart = dynamic<AreaChartProps>(
  () => import('./ThreeAreaChart').then(mod => mod.ThreeAreaChart),
  { 
    loading: ChartLoader,
    ssr: false
  }
);