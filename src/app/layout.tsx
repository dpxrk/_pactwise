import type { Metadata } from "next";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
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
    <html lang="en">
      <body>
        <ErrorBoundary>
          <ConvexClientProvider>
            <MonitoringProvider>
              <SessionWrapper>
                {children}
                <HealthIndicator />
              </SessionWrapper>
            </MonitoringProvider>
          </ConvexClientProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}