'use client';

import { getCLS, getINP, getFCP, getLCP, getTTFB, onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

// Web Vitals tracking
interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

// Performance tracking store
class PerformanceTracker {
  private metrics: Map<string, WebVitalsMetric> = new Map();
  private observers: Array<(metric: WebVitalsMetric) => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeWebVitals();
    }
  }

  private initializeWebVitals() {
    // Track Core Web Vitals
    onCLS((metric) => this.handleMetric({ ...metric, name: 'CLS' }));
    onINP((metric) => this.handleMetric({ ...metric, name: 'INP' }));
    onLCP((metric) => this.handleMetric({ ...metric, name: 'LCP' }));
    onFCP((metric) => this.handleMetric({ ...metric, name: 'FCP' }));
    onTTFB((metric) => this.handleMetric({ ...metric, name: 'TTFB' }));
  }

  private handleMetric(metric: WebVitalsMetric) {
    this.metrics.set(metric.name, metric);
    
    // Notify observers
    this.observers.forEach(callback => callback(metric));
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Web Vital - ${metric.name}:`, metric);
    }
    
    // Send to analytics service
    this.sendToAnalytics(metric);
  }

  private sendToAnalytics(metric: WebVitalsMetric) {
    // In production, send to your analytics service
    // Example: Google Analytics, Mixpanel, or custom endpoint
    
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', metric.name, {
        custom_parameter_1: metric.value,
        custom_parameter_2: metric.rating,
      });
    }
    
    // Send to Convex analytics
    if (typeof window !== 'undefined') {
      this.sendEventToConvex('web_vital', {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        navigationType: metric.navigationType,
      });
    }
    
    // Store locally for development
    if (process.env.NODE_ENV === 'development') {
      const vitals = JSON.parse(localStorage.getItem('web_vitals') || '[]');
      vitals.push({
        ...metric,
        timestamp: Date.now(),
        url: window.location.href,
      });
      // Keep only last 50 metrics
      if (vitals.length > 50) {
        vitals.splice(0, vitals.length - 50);
      }
      localStorage.setItem('web_vitals', JSON.stringify(vitals));
    }
  }

  private sendEventToConvex(event: string, properties: Record<string, unknown>) {
    // This will be called by the ConvexClientProvider
    if (typeof window !== 'undefined' && (window as any).convexAnalytics) {
      (window as any).convexAnalytics.logEvent(event, properties);
    }
  }

  public subscribe(callback: (metric: WebVitalsMetric) => void) {
    this.observers.push(callback);
    return () => {
      const index = this.observers.indexOf(callback);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  public getMetrics(): Map<string, WebVitalsMetric> {
    return new Map(this.metrics);
  }

  public getMetric(name: string): WebVitalsMetric | undefined {
    return this.metrics.get(name);
  }
}

// Global performance tracker instance
export const performanceTracker = new PerformanceTracker();

// User behavior analytics
interface UserEvent {
  event: string;
  timestamp: number;
  url: string;
  userId?: string;
  properties?: Record<string, any>;
  sessionId: string;
}

class UserAnalytics {
  private sessionId: string;
  private events: UserEvent[] = [];
  private sessionStart: number;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStart = Date.now();
    
    if (typeof window !== 'undefined') {
      this.initializeTracking();
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeTracking() {
    // Track page views
    this.track('page_view', {
      page: window.location.pathname,
      referrer: document.referrer,
    });

    // Track clicks on important elements
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.matches('button, a, [data-track]')) {
        this.track('click', {
          element: target.tagName.toLowerCase(),
          text: target.textContent?.slice(0, 100),
          dataTrack: target.getAttribute('data-track'),
        });
      }
    });

    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      this.track('form_submit', {
        formId: form.id,
        formName: form.name,
        action: form.action,
      });
    });

    // Track navigation timing
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        this.track('page_load_complete', {
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          totalTime: navigation.loadEventEnd - navigation.fetchStart,
        });
      }, 0);
    });

    // Track session duration on page unload
    window.addEventListener('beforeunload', () => {
      this.track('session_end', {
        duration: Date.now() - this.sessionStart,
        eventsCount: this.events.length,
      });
      this.flush();
    });
  }

  public track(event: string, properties?: Record<string, any>, userId?: string) {
    const userEvent: UserEvent = {
      event,
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userId,
      properties,
      sessionId: this.sessionId,
    };

    this.events.push(userEvent);

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('User Event:', userEvent);
    }

    // Store events locally
    this.storeEvent(userEvent);

    // Send to analytics service (in production)
    this.sendEvent(userEvent);
  }

  private storeEvent(event: UserEvent) {
    if (typeof window === 'undefined') return;

    const events = JSON.parse(localStorage.getItem('user_events') || '[]');
    events.push(event);
    
    // Keep only last 100 events
    if (events.length > 100) {
      events.splice(0, events.length - 100);
    }
    
    localStorage.setItem('user_events', JSON.stringify(events));
  }

  private sendEvent(event: UserEvent) {
    // In production, send to your analytics service
    // Example implementations:
    
    // Google Analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', event.event, {
        custom_parameter_1: event.properties,
        user_id: event.userId,
      });
    }

    // Send to Convex
    if (typeof window !== 'undefined' && (window as any).convexAnalytics) {
      (window as any).convexAnalytics.logEvent(event.event, {
        ...event.properties,
        timestamp: event.timestamp,
        url: event.url,
        sessionId: event.sessionId,
        userId: event.userId,
      });
    }
  }

  public flush() {
    // Send any pending events
    if (this.events.length > 0) {
      const eventsToSend = [...this.events];
      this.events = [];
      
      // Send batch of events to Convex
      if (typeof window !== 'undefined' && (window as any).convexAnalytics) {
        (window as any).convexAnalytics.logEventBatch(eventsToSend);
      }
    }
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getEvents(): UserEvent[] {
    return [...this.events];
  }
}

// Global user analytics instance
export const userAnalytics = new UserAnalytics();

// Error tracking
interface ErrorReport {
  error: Error;
  errorInfo?: any;
  timestamp: number;
  url: string;
  userId?: string;
  sessionId: string;
  userAgent: string;
  context?: Record<string, any>;
}

class ErrorTracker {
  private errors: ErrorReport[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeErrorTracking();
    }
  }

  private initializeErrorTracking() {
    // Track unhandled errors
    window.addEventListener('error', (event) => {
      this.captureError(new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        { type: 'unhandledrejection' }
      );
    });
  }

  public captureError(error: Error, context?: Record<string, any>, userId?: string) {
    const errorReport: ErrorReport = {
      error,
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userId,
      sessionId: userAnalytics.getSessionId(),
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : '',
      context,
    };

    this.errors.push(errorReport);

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error captured:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        timestamp: errorReport.timestamp,
        url: errorReport.url,
        userId: errorReport.userId,
        sessionId: errorReport.sessionId,
        userAgent: errorReport.userAgent,
        context: errorReport.context,
      });
    }

    // Send to error tracking service
    this.sendError(errorReport);
  }

  private sendError(errorReport: ErrorReport) {
    // Send to Sentry (if configured)
    this.sendToSentry(errorReport);

    // Send to Convex
    if (typeof window !== 'undefined' && (window as any).convexAnalytics) {
      (window as any).convexAnalytics.reportError({
        message: errorReport.error.message,
        stack: errorReport.error.stack,
        timestamp: errorReport.timestamp,
        url: errorReport.url,
        userId: errorReport.userId,
        sessionId: errorReport.sessionId,
        userAgent: errorReport.userAgent,
        context: errorReport.context,
      });
    }
  }

  private async sendToSentry(errorReport: ErrorReport) {
    if (typeof window === 'undefined') return;

    try {
      const Sentry = await import('@sentry/nextjs');
      
      // Set user context
      Sentry.setUser({
        id: errorReport.userId || 'anonymous',
        ip_address: '{{auto}}',
      });

      // Set additional context
      Sentry.setContext('error_report', {
        timestamp: errorReport.timestamp,
        sessionId: errorReport.sessionId,
        url: errorReport.url,
        userAgent: errorReport.userAgent,
      });

      // Set tags
      Sentry.setTags({
        source: 'error_tracker',
        environment: process.env.NODE_ENV || 'development',
      });

      // Capture exception with context
      Sentry.captureException(errorReport.error, {
        contexts: {
          errorReport: errorReport.context,
        },
        extra: {
          timestamp: errorReport.timestamp,
          sessionId: errorReport.sessionId,
          url: errorReport.url,
        },
        fingerprint: [
          errorReport.error.name,
          errorReport.error.message,
          errorReport.url,
        ],
      });
    } catch (sentryError) {
      console.error('Failed to send error to Sentry:', sentryError);
    }
  }

  public getErrors(): ErrorReport[] {
    return [...this.errors];
  }
}

// Global error tracker instance
export const errorTracker = new ErrorTracker();

// Health check monitoring
class HealthMonitor {
  private checks: Map<string, boolean> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.startHealthChecks();
    }
  }

  private startHealthChecks() {
    // Run health checks every 5 minutes
    this.checkInterval = setInterval(() => {
      this.runHealthChecks();
    }, 5 * 60 * 1000);

    // Run initial health check
    this.runHealthChecks();
  }

  private async runHealthChecks() {
    // Check Convex connectivity
    try {
      if (typeof window !== 'undefined' && (window as any).convexAnalytics) {
        const healthStatus = await (window as any).convexAnalytics.getHealthStatus();
        this.checks.set('convex', healthStatus.status === 'healthy');
      } else {
        this.checks.set('convex', false);
      }
    } catch {
      this.checks.set('convex', false);
    }

    // Check local storage
    try {
      localStorage.setItem('health_check', Date.now().toString());
      const value = localStorage.getItem('health_check');
      this.checks.set('localStorage', value !== null);
    } catch {
      this.checks.set('localStorage', false);
    }

    // Check memory usage (if available)
    if ('memory' in performance) {
      const memory = (performance as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      if (memory) {
        const memoryUsage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        this.checks.set('memory', memoryUsage < 0.9); // Alert if > 90% memory usage
      }
    }

    // Report unhealthy checks
    const unhealthyChecks = Array.from(this.checks.entries())
      .filter(([_, healthy]) => !healthy)
      .map(([check]) => check);

    if (unhealthyChecks.length > 0) {
      errorTracker.captureError(
        new Error(`Health check failures: ${unhealthyChecks.join(', ')}`),
        { type: 'health_check', unhealthyChecks }
      );
    }
  }

  public getHealthStatus(): Record<string, boolean> {
    return Object.fromEntries(this.checks);
  }

  public isHealthy(): boolean {
    return Array.from(this.checks.values()).every(healthy => healthy);
  }

  public destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

// Global health monitor instance
export const healthMonitor = new HealthMonitor();

// Performance measurement utilities
export const measurePerformance = {
  // Measure component render time
  measureRender: (componentName: string, renderFn: () => void) => {
    const start = performance.now();
    renderFn();
    const end = performance.now();
    
    userAnalytics.track('component_render', {
      component: componentName,
      renderTime: end - start,
    });
  },

  // Measure async operation time
  measureAsync: async <T>(operationName: string, operation: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    try {
      const result = await operation();
      const end = performance.now();
      
      userAnalytics.track('async_operation', {
        operation: operationName,
        duration: end - start,
        success: true,
      });
      
      return result;
    } catch (error) {
      const end = performance.now();
      
      userAnalytics.track('async_operation', {
        operation: operationName,
        duration: end - start,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw error;
    }
  },

  // Measure Convex function call performance
  measureConvexCall: async <T>(functionName: string, operation: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    
    try {
      const result = await operation();
      const end = performance.now();
      
      userAnalytics.track('convex_call', {
        function: functionName,
        duration: end - start,
        success: true,
      });
      
      return result;
    } catch (error) {
      const end = performance.now();
      
      userAnalytics.track('convex_call', {
        function: functionName,
        duration: end - start,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw error;
    }
  },
};

// Enhanced error reporting function with Sentry integration
export const reportError = async (
  error: Error | string,
  context?: {
    contexts?: Record<string, any>;
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    user?: { id?: string; email?: string; username?: string };
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
    fingerprint?: string[];
  }
) => {
  if (typeof window === 'undefined') return;

  const errorObj = typeof error === 'string' ? new Error(error) : error;

  try {
    const Sentry = await import('@sentry/nextjs');
    
    // Set user context if provided
    if (context?.user) {
      Sentry.setUser(context.user);
    }

    // Set additional contexts
    if (context?.contexts) {
      Object.entries(context.contexts).forEach(([key, value]) => {
        Sentry.setContext(key, value);
      });
    }

    // Set tags
    if (context?.tags) {
      Sentry.setTags(context.tags);
    }

    // Capture exception
    Sentry.captureException(errorObj, {
      level: context?.level || 'error',
      extra: context?.extra,
      fingerprint: context?.fingerprint,
    });
  } catch (sentryError) {
    console.error('Failed to report error to Sentry:', sentryError);
    // Fall back to error tracker
    errorTracker.captureError(errorObj, context?.extra);
  }
};

// Enhanced performance monitoring
export const reportPerformance = async (
  metric: {
    name: string;
    value: number;
    unit?: string;
    tags?: Record<string, string>;
  }
) => {
  if (typeof window === 'undefined') return;

  try {
    const Sentry = await import('@sentry/nextjs');
    
    // Send custom metric to Sentry
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `${metric.name}: ${metric.value}${metric.unit || ''}`,
      level: 'info',
      data: metric.tags,
    });

    // Also track via user analytics
    userAnalytics.track('performance_metric', {
      metric_name: metric.name,
      metric_value: metric.value,
      metric_unit: metric.unit,
      ...metric.tags,
    });
  } catch (error) {
    console.error('Failed to report performance metric:', error);
  }
};

// Type declarations for global objects
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    Sentry?: {
      captureException: (error: Error, context?: Record<string, unknown>) => void;
    };
  }
}