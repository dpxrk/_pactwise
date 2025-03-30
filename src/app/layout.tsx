import type { Metadata } from "next";
import "./globals.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./ConvexClientProvider";


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
    <ConvexAuthNextjsServerProvider>
    <html lang="en">      
     
      <body>
        <ConvexClientProvider>
        {children}
        </ConvexClientProvider>
      </body>
        
    </html>
    </ConvexAuthNextjsServerProvider>
  );
}
