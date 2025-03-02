import React, { Suspense } from "react";
import { Navigation } from "@/app/_components/homepage/Navigation";
import { Hero } from "@/app/_components/homepage/Hero";
const Features = React.lazy(() => import("@/app/_components/homepage/Features"));
import { Benefits } from "@/app/_components/homepage/Benefits";
import { Footer } from "@/app/_components/homepage/Footer";
import  LoadingSpinner  from "@/app/_components/common/LoadingSpinner"

export const LandingPage = () => {
  return (
    <div className="relative min-h-screen bg-background/50 overflow-hidden">
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navigation />

        <main className="flex-grow">
          <Hero />

          <Suspense fallback={<LoadingSpinner />}>
            <Features />
          </Suspense>

          <Benefits />
        </main>

        <Footer />
      </div>
    </div>
  );
};

export default LandingPage;
