import type { Metadata } from "next";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { ClerkProvider } from '@clerk/nextjs'; // Import ClerkProvider
import { ErrorBoundary } from './_components/common/ErrorBoundary';
import { SessionWrapper } from './_components/auth/SessionWrapper';
import { MonitoringProvider, HealthIndicator } from './_components/common/MonitoringProvider';

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
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <html lang="en">
        <body>
          <ErrorBoundary>
            <MonitoringProvider>
              <SessionWrapper>
                <ConvexClientProvider>
                  {children}
                  <HealthIndicator />
                </ConvexClientProvider>
              </SessionWrapper>
            </MonitoringProvider>
          </ErrorBoundary>
        </body>
      </html>
    </ClerkProvider>
  );
}