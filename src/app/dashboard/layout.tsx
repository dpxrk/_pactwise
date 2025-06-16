'use client'

import React, { useState } from "react";
import { Header } from "@/app/_components/dashboard/Header";
import { SideNavigation } from "@/app/_components/dashboard/SideNavigation";
import { useAuth, RedirectToSignIn } from "@clerk/nextjs";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useEntranceAnimation } from "@/hooks/useAnimations";

interface DashboardLayoutProps {
  children?: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { isSignedIn, isLoaded } = useAuth();
  const isVisible = useEntranceAnimation(100);
  
  // Show loading state while checking auth
  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <div className="text-center space-y-6 animate-fade-in">
          <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-8 border border-border/50 shadow-2xl">
            <LoadingSpinner size="xl" className="mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Loading Pactwise</h3>
            <p className="text-muted-foreground">Preparing your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Redirect to sign in if not authenticated
  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  return (
    <div className={`flex h-screen bg-gradient-to-br from-background via-background to-muted/20 ${isVisible ? 'animate-fade-in' : 'opacity-0'}`}>
      <SideNavigation className="hidden md:flex w-64 relative z-10" />
      <div className="flex-1 flex flex-col relative">
        <Header
          isSearchOpen={isSearchOpen}
          onSearchOpen={() => setIsSearchOpen(true)}
          onSearchClose={() => setIsSearchOpen(false)}
          className="relative z-10"
        />
        <main className={`flex-1 overflow-auto relative ${isVisible ? 'animate-slide-in-bottom' : ''}`}>
          <div className="min-h-full">
            {children}
          </div>
        </main>
        
        {/* Subtle background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/5 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;