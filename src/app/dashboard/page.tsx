'use client'

import React from "react";
import DashboardContent from "@/app/_components/dashboard/DashboardContent";
import { useQuery } from 'convex/react';
import { api } from "../../../convex/_generated/api";

interface HomeDashboardProps {
  children?: React.ReactNode;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = () => {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  
  // Handle loading state
  if (currentUser === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Handle unauthenticated state
  if (currentUser === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600">Please sign in to access the dashboard.</p>
        </div>
      </div>
    );
  }

  // Handle case where user doesn't have an enterprise
  if (!currentUser.enterpriseId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Enterprise Found</h2>
          <p className="text-gray-600">Please contact your administrator to be assigned to an enterprise.</p>
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