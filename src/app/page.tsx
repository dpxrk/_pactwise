import React, { Suspense } from "react";
import { Navigation } from "@/app/_components/homepage/Navigation";
import { Hero } from "@/app/_components/homepage/Hero";
const Features = React.lazy(() => import("@/app/_components/homepage/Features"));
import { Benefits } from "@/app/_components/homepage/Benefits";
import { Footer } from "@/app/_components/homepage/Footer";
import  LoadingSpinner  from "@/app/_components/common/LoadingSpinner"
import { ThreeBackground } from "@/app/_components/homepage/ThreeBackground";
import "@/app/globals.css"


import AuthRedirectHandler from "../app/../lib/AuthRedirectHandler"

const LandingPage = () => {
  return (
    <div className="relative min-h-screen bg-[#0d1f1f]">
      {/* Three.js background layer - absolute positioned behind content */}
      <div className="absolute inset-0 z-0">
        <ThreeBackground />
      </div>
      
      {/* Main content layer - relative positioned on top */}
      <div className="relative z-10">
        <AuthRedirectHandler />
        <div className="flex flex-col min-h-screen">
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
    </div>
  );
};

export default LandingPage;
