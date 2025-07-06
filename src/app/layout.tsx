import type { Metadata } from "next";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { ErrorBoundary } from './_components/common/ErrorBoundary';
import { SessionWrapper } from './_components/auth/SessionWrapper';
import { MonitoringProvider, HealthIndicator } from './_components/common/MonitoringProvider';
import { PerformanceProvider } from './_components/common/PerformanceProvider';
import { LazyStripeProvider } from '@/lib/stripe/lazy-provider';
import { AIChatProvider } from '@/components/ai/AIChatProvider';
import { ToastProvider } from '@/components/premium/Toast';

export const metadata: Metadata = {
  title: "Pactwise",
  description: "An application to help manage your contracts and vendors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans">
        <ErrorBoundary>
          <ConvexClientProvider>
            <MonitoringProvider>
              <PerformanceProvider>
                <SessionWrapper>
                  <LazyStripeProvider>
                    <ToastProvider>
                      <AIChatProvider>
                        {children}
                        <HealthIndicator />
                      </AIChatProvider>
                    </ToastProvider>
                  </LazyStripeProvider>
                </SessionWrapper>
              </PerformanceProvider>
            </MonitoringProvider>
          </ConvexClientProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}