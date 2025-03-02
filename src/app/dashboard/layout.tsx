'use client'

import React, { useState } from "react";
import { Header } from "@/app/_components/dashboard/Header";
import { SideNavigation } from "@/app/_components/dashboard/SideNavigation"

interface DashboardLayoutProps {
  children?: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <SideNavigation className="hidden md:flex w-64" />
      <div className="flex-1 flex flex-col">
        <Header
          isSearchOpen={isSearchOpen}
          onSearchOpen={() => setIsSearchOpen(true)}
          onSearchClose={() => setIsSearchOpen(false)}
        />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
