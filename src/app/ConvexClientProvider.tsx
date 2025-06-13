"use client";

import { ReactNode, useEffect } from "react";
import { ConvexReactClient } from "convex/react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { performanceTracker, userAnalytics, errorTracker, healthMonitor } from "@/lib/monitoring";

// Initialize the Convex client
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL environment variable");
}

const convex = new ConvexReactClient(convexUrl);

// Monitoring wrapper component
function MonitoringProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Initialize monitoring when the app starts
    if (typeof window !== 'undefined') {
      // Set up global convex analytics object for monitoring integration
      (window as any).convexAnalytics = {
        logEvent: (event: string, properties: Record<string, any>) => {
          userAnalytics.track(event, properties);
        },
        logEventBatch: (events: Array<{ event: string; properties: Record<string, any> }>) => {
          events.forEach(({ event, properties }) => {
            userAnalytics.track(event, properties);
          });
        },
        reportError: (errorData: Record<string, any>) => {
          errorTracker.captureError(new Error(errorData.message), errorData);
        },
        getHealthStatus: () => {
          return {
            status: healthMonitor.isHealthy() ? 'healthy' : 'unhealthy',
            checks: healthMonitor.getHealthStatus(),
          };
        },
      };

      // Track initial page load
      userAnalytics.track('app_loaded', {
        url: window.location.href,
        timestamp: Date.now(),
      });

      // Clean up on unmount
      return () => {
        healthMonitor.destroy();
        userAnalytics.flush();
      };
    }
  }, []);

  return <>{children}</>;
}

export function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <MonitoringProvider>
          {children}
        </MonitoringProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}