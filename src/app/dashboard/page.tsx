'use client'

import React, { useEffect } from "react";
import DashboardContent from "@/app/_components/dashboard/DashboardContent";
import { useQuery, useMutation } from 'convex/react';
import { useAuth } from '@clerk/nextjs';
import { api } from "../../../convex/_generated/api";

interface HomeDashboardProps {
  params?: Promise<{ [key: string]: string | string[] | undefined }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

const HomeDashboard: React.FC<HomeDashboardProps> = () => {
  const { isSignedIn, isLoaded } = useAuth();
  const currentUser = useQuery(api.users.getCurrentUser, isLoaded ? {} : "skip");
  
  // Redirect to onboarding if user not found in database
  useEffect(() => {
    if (isLoaded && isSignedIn && currentUser === null) {
      // User is authenticated with Clerk but doesn't exist in our database
      // Redirect to onboarding to create their account
      window.location.href = '/onboarding';
    }
  }, [isLoaded, isSignedIn, currentUser]);
  
  // Handle loading state - wait for auth to load
  if (!isLoaded || currentUser === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Handle unauthenticated state or redirect in progress
  if (currentUser === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to account setup...</p>
        </div>
      </div>
    );
  }

  // Handle case where user doesn't have an enterprise - redirect to onboarding
  if (!currentUser.enterpriseId) {
    // Redirect to onboarding flow
    window.location.href = '/onboarding';
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to setup...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <DashboardContent enterpriseId={currentUser.enterpriseId} />
    </>    
  );
};

export default HomeDashboard;