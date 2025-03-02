import React from "react";

import  DashboardContent  from "@/app/_components/dashboard/DashboardContent"
import DashboardLayout from "./layout"

interface HomeDashboardLayoutProps {
  children?: React.ReactNode;
}

export const HomeDashboardLayout: React.FC<HomeDashboardLayoutProps> = () => {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
};

export default HomeDashboardLayout;
