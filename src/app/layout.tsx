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
import { ServiceWorkerProvider } from '@/components/performance/ServiceWorkerProvider';
import { fontVariables } from './fonts';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'),
  title: "Pactwise",
  description: "An application to help manage your contracts and vendors",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png' },
    ],
  },
  openGraph: {
    title: 'Pactwise - Contract Management Platform',
    description: 'Intelligent contract and vendor management platform',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pactwise',
    description: 'Intelligent contract and vendor management platform',
    images: ['/twitter-image.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="font-sans">
        <ErrorBoundary>
          <ToastProvider>
            <ServiceWorkerProvider>
              <ConvexClientProvider>
                <MonitoringProvider>
                  <PerformanceProvider>
                    <SessionWrapper>
                      <LazyStripeProvider>
                        <AIChatProvider>
                          {children}
                          <HealthIndicator />
                        </AIChatProvider>
                      </LazyStripeProvider>
                    </SessionWrapper>
                  </PerformanceProvider>
                </MonitoringProvider>
              </ConvexClientProvider>
            </ServiceWorkerProvider>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}