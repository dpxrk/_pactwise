"use client";

import { ReactNode, useEffect } from "react";
import { ConvexReactClient, useConvex } from "convex/react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { userAnalytics, errorTracker, healthMonitor } from "@/lib/monitoring";
import { api } from "../../convex/_generated/api";

// Type for the convex analytics object
interface ConvexAnalytics {
  logEvent: (event: string, properties: Record<string, unknown>) => Promise<void>;
  logEventBatch: (events: Array<{ event: string; properties: Record<string, unknown> }>) => Promise<void>;
  reportError: (errorData: Record<string, unknown>) => void;
  getHealthStatus: () => { status: string; checks: unknown };
}

declare global {
  interface Window {
    convexAnalytics: ConvexAnalytics;
  }
}

// Initialize the Convex client
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

// Monitoring wrapper component
function MonitoringProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  
  useEffect(() => {
    // Initialize monitoring when the app starts
    if (typeof window !== 'undefined') {
      // Set up global convex analytics object for monitoring integration
      window.convexAnalytics = {
        logEvent: async (event: string, properties: Record<string, unknown>) => {
          // Direct mutation call to avoid circular dependency with UserAnalytics
          // This method is called BY UserAnalytics, so we shouldn't call back into it
          try {
            await convex.mutation(api.realtime.userEvents.logEvent, { event, properties });
          } catch (error) {
            console.error("Failed to log event to Convex:", error);
          }
        },
        logEventBatch: async (events: Array<{ event: string; properties: Record<string, unknown> }>) => {
          // Direct mutation calls to avoid circular dependency
          try {
            await Promise.all(events.map(({ event, properties }) => 
              convex.mutation(api.realtime.userEvents.logEvent, { event, properties })
            ));
          } catch (error) {
            console.error("Failed to log event batch to Convex:", error);
          }
        },
        reportError: (errorData: Record<string, unknown>) => {
          errorTracker.captureError(new Error(errorData.message as string || 'Unknown error'), errorData);
        },
        getHealthStatus: () => {
          return {
            status: healthMonitor.isHealthy() ? 'healthy' : 'unhealthy',
            checks: healthMonitor.getHealthStatus(),
          };
        },
      };

      // Track initial page load directly to avoid circular dependency
      window.convexAnalytics.logEvent('app_loaded', {
        url: window.location.href,
        timestamp: Date.now(),
      });

      // Clean up on unmount
      return () => {
        healthMonitor.destroy();
        userAnalytics.flush();
      };
    }
    return undefined;
  }, [convex]);

  return <>{children}</>;
}

export function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  
  // If environment variables are missing, render children without providers
  if (!publishableKey || !convex) {
    console.warn("Missing environment variables. Running in demo mode without authentication.");
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <MonitoringProvider>
          {children}
        </MonitoringProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}