import * as Sentry from '@sentry/nextjs';
import { Primitive, StartSpanOptions } from '@sentry/types';

// Performance monitoring configuration
export const PERFORMANCE_CONFIG = {
  // Critical operations that always get traced
  criticalOperations: [
    'contract.create',
    'contract.analyze',
    'vendor.performance.calculate',
    'dashboard.load',
    'search.execute',
    'ai.query',
  ],
  
  // Custom sampling rates for different operations
  samplingRates: {
    'api.query': 0.5,
    'api.mutation': 1.0,
    'page.load': 0.3,
    'interaction.click': 0.1,
    'database.query': 0.5,
  },
  
  // Performance thresholds (in ms)
  thresholds: {
    'api.response': 1000,
    'page.load': 3000,
    'interaction.response': 300,
    'database.query': 500,
  },
};

// Custom performance metrics
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, Primitive>;
}

// Performance monitoring class
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private activeTransactions: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Start a performance transaction
  startTransaction(name: string, op: string, data?: Record<string, any>) {
    const transaction = Sentry.startTransaction({
      name,
      op,
      data,
      trimEnd: true,
    });

    // Set custom sampling based on operation type
    const samplingRate = PERFORMANCE_CONFIG.samplingRates[op] || 0.1;
    if (Math.random() > samplingRate && !PERFORMANCE_CONFIG.criticalOperations.includes(name)) {
      transaction.sampled = false;
    }

    Sentry.getCurrentHub().configureScope(scope => scope.setSpan(transaction));
    this.activeTransactions.set(name, transaction);
    
    return transaction;
  }

  // End a performance transaction
  endTransaction(name: string, status?: string) {
    const transaction = this.activeTransactions.get(name);
    if (transaction) {
      if (status) {
        transaction.setStatus(status);
      }
      transaction.finish();
      this.activeTransactions.delete(name);
    }
  }

  // Measure a specific operation
  async measureOperation<T>(
    name: string,
    operation: () => Promise<T> | T,
    options?: {
      op?: string;
      description?: string;
      data?: Record<string, any>;
      tags?: Record<string, Primitive>;
    }
  ): Promise<T> {
    const span = Sentry.getCurrentHub().getScope()?.getSpan();
    const childSpan = span?.startChild({
      op: options?.op || 'function',
      description: options?.description || name,
      data: options?.data,
    });

    if (childSpan && options?.tags) {
      Object.entries(options.tags).forEach(([key, value]) => {
        childSpan.setTag(key, value);
      });
    }

    const startTime = performance.now();

    try {
      const result = await operation();
      const duration = performance.now() - startTime;

      // Check against thresholds
      const threshold = PERFORMANCE_CONFIG.thresholds[options?.op || ''];
      if (threshold && duration > threshold) {
        this.reportSlowOperation(name, duration, threshold, options);
      }

      childSpan?.setStatus('ok');
      return result;
    } catch (error) {
      childSpan?.setStatus('internal_error');
      throw error;
    } finally {
      childSpan?.finish();
    }
  }

  // Report a slow operation
  private reportSlowOperation(
    name: string,
    duration: number,
    threshold: number,
    options?: any
  ) {
    Sentry.captureMessage(`Slow operation detected: ${name}`, 'warning', {
      tags: {
        operation: name,
        threshold: threshold.toString(),
        duration: duration.toString(),
        exceeded_by: ((duration - threshold) / threshold * 100).toFixed(2) + '%',
      },
      extra: {
        ...options,
        duration,
        threshold,
      },
    });
  }

  // Record a custom metric
  recordMetric(metric: PerformanceMetric) {
    const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
    if (transaction) {
      transaction.setMeasurement(metric.name, metric.value, metric.unit);
      
      if (metric.tags) {
        Object.entries(metric.tags).forEach(([key, value]) => {
          transaction.setTag(key, value);
        });
      }
    }
  }

  // Measure Web Vitals
  measureWebVitals() {
    if (typeof window === 'undefined') return;

    // Core Web Vitals
    this.measureLCP();
    this.measureFID();
    this.measureCLS();
    
    // Additional metrics
    this.measureTTFB();
    this.measureFCP();
  }

  private measureLCP() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        
        this.recordMetric({
          name: 'lcp',
          value: lastEntry.startTime,
          unit: 'millisecond',
          tags: {
            page: window.location.pathname,
          },
        });
      });
      
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    }
  }

  private measureFID() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if ('processingStart' in entry) {
            const fid = entry.processingStart - entry.startTime;
            
            this.recordMetric({
              name: 'fid',
              value: fid,
              unit: 'millisecond',
              tags: {
                page: window.location.pathname,
                eventType: entry.name,
              },
            });
          }
        }
      });
      
      observer.observe({ entryTypes: ['first-input'] });
    }
  }

  private measureCLS() {
    if ('PerformanceObserver' in window) {
      let clsValue = 0;
      let clsEntries: PerformanceEntry[] = [];
      let sessionValue = 0;
      let sessionEntries: PerformanceEntry[] = [];
      
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // @ts-ignore - LayoutShift type
          if (!entry.hadRecentInput) {
            const firstSessionEntry = sessionEntries[0];
            const lastSessionEntry = sessionEntries[sessionEntries.length - 1];
            
            // @ts-ignore
            if (sessionValue && entry.startTime - lastSessionEntry.startTime < 1000 && entry.startTime - firstSessionEntry.startTime < 5000) {
              // @ts-ignore
              sessionValue += entry.value;
              sessionEntries.push(entry);
            } else {
              // @ts-ignore
              sessionValue = entry.value;
              sessionEntries = [entry];
            }
            
            if (sessionValue > clsValue) {
              clsValue = sessionValue;
              clsEntries = sessionEntries;
              
              this.recordMetric({
                name: 'cls',
                value: clsValue,
                unit: 'score',
                tags: {
                  page: window.location.pathname,
                },
              });
            }
          }
        }
      });
      
      observer.observe({ entryTypes: ['layout-shift'] });
    }
  }

  private measureTTFB() {
    if ('performance' in window && 'timing' in window.performance) {
      const { responseStart, requestStart } = window.performance.timing;
      const ttfb = responseStart - requestStart;
      
      this.recordMetric({
        name: 'ttfb',
        value: ttfb,
        unit: 'millisecond',
        tags: {
          page: window.location.pathname,
        },
      });
    }
  }

  private measureFCP() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.recordMetric({
              name: 'fcp',
              value: entry.startTime,
              unit: 'millisecond',
              tags: {
                page: window.location.pathname,
              },
            });
          }
        }
      });
      
      observer.observe({ entryTypes: ['paint'] });
    }
  }

  // Measure API performance
  measureAPICall(endpoint: string, method: string) {
    const startTime = performance.now();
    
    return {
      end: (status: number, error?: Error) => {
        const duration = performance.now() - startTime;
        
        this.recordMetric({
          name: 'api.call.duration',
          value: duration,
          unit: 'millisecond',
          tags: {
            endpoint,
            method,
            status: status.toString(),
            success: (status >= 200 && status < 300).toString(),
          },
        });

        // Report slow API calls
        if (duration > PERFORMANCE_CONFIG.thresholds['api.response']) {
          this.reportSlowOperation(`API ${method} ${endpoint}`, duration, PERFORMANCE_CONFIG.thresholds['api.response'], {
            endpoint,
            method,
            status,
            error: error?.message,
          });
        }
      },
    };
  }

  // Measure database query performance
  measureDatabaseQuery(queryName: string, tableName?: string) {
    const startTime = performance.now();
    
    return {
      end: (success: boolean, recordCount?: number) => {
        const duration = performance.now() - startTime;
        
        this.recordMetric({
          name: 'db.query.duration',
          value: duration,
          unit: 'millisecond',
          tags: {
            query: queryName,
            table: tableName || 'unknown',
            success: success.toString(),
            recordCount: recordCount?.toString() || '0',
          },
        });

        // Report slow queries
        if (duration > PERFORMANCE_CONFIG.thresholds['database.query']) {
          this.reportSlowOperation(`DB Query ${queryName}`, duration, PERFORMANCE_CONFIG.thresholds['database.query'], {
            queryName,
            tableName,
            recordCount,
          });
        }
      },
    };
  }

  // Measure user interactions
  measureInteraction(interactionType: string, target: string) {
    const startTime = performance.now();
    
    return {
      end: () => {
        const duration = performance.now() - startTime;
        
        this.recordMetric({
          name: 'user.interaction.duration',
          value: duration,
          unit: 'millisecond',
          tags: {
            type: interactionType,
            target,
            page: window.location.pathname,
          },
        });

        // Report slow interactions
        if (duration > PERFORMANCE_CONFIG.thresholds['interaction.response']) {
          this.reportSlowOperation(`User ${interactionType} on ${target}`, duration, PERFORMANCE_CONFIG.thresholds['interaction.response'], {
            interactionType,
            target,
          });
        }
      },
    };
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// React hook for performance monitoring
export function usePerformanceMonitor() {
  return performanceMonitor;
}

// HOC for measuring component render performance
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return (props: P) => {
    const renderStart = performance.now();
    
    React.useEffect(() => {
      const renderDuration = performance.now() - renderStart;
      
      performanceMonitor.recordMetric({
        name: 'component.render.duration',
        value: renderDuration,
        unit: 'millisecond',
        tags: {
          component: componentName,
          page: window.location.pathname,
        },
      });
    }, []);

    return <Component {...props} />;
  };
}