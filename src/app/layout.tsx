import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { ErrorBoundary } from './_components/common/ErrorBoundary';
import { SessionWrapper } from './_components/auth/SessionWrapper';
import { MonitoringProvider, HealthIndicator } from './_components/common/MonitoringProvider';

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

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
      <body className={`${montserrat.variable} font-sans`}>
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