import React from "react";

import  DashboardContent  from "@/app/_components/dashboard/DashboardContent"


interface HomeDashboardProps {
  children?: React.ReactNode;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = () => {
  return (
    <>
      <DashboardContent />
    </>    
  );
};

export default HomeDashboard;
