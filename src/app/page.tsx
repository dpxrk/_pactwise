import React, { Suspense } from "react";
import { NavigationPremium } from "@/app/_components/homepage/NavigationPremium";
import HeroPremium from "@/app/_components/homepage/HeroPremium";
import ProcessPremium from "@/app/_components/homepage/ProcessPremium";
import FeaturesPremium from "@/app/_components/homepage/FeaturesPremium";
import PricingPremium from "@/app/_components/homepage/PricingPremium";
import BenefitsPremium from "@/app/_components/homepage/BenefitsPremium";
import FAQPremium from "@/app/_components/homepage/FAQPremium";
import FinalCTAPremium from "@/app/_components/homepage/FinalCTAPremium";
import FooterPremium from "@/app/_components/homepage/FooterPremium";
import LoadingSpinner from "@/app/_components/common/LoadingSpinner"
import PremiumBackground from "@/app/_components/homepage/PremiumBackground";
import CustomCursor from "@/app/_components/common/CustomCursor";
import ScrollProgress from "@/app/_components/common/ScrollProgress";
import PageTransition from "@/app/_components/common/PageTransition";

import AuthRedirectHandler from "@/lib/AuthRedirectHandler"

const LandingPage = () => {
  return (
    <>
      {/* Page transition loader */}
      <PageTransition />
      
      {/* Custom cursor */}
      <CustomCursor />
      
      {/* Scroll progress indicators */}
      <ScrollProgress />
      
      <div className="relative min-h-screen bg-[#0a0a0a] noise-texture">
        {/* Premium animated background */}
        <div className="absolute inset-0 z-0">
          <PremiumBackground />
        </div>
        
        {/* Main content layer - relative positioned on top */}
        <div className="relative z-10">
          <AuthRedirectHandler />
          <div className="flex flex-col min-h-screen">
            <NavigationPremium />

            <main className="flex-grow">
              <section id="hero">
                <HeroPremium />
              </section>

              <section id="process">
                <ProcessPremium />
              </section>

              <Suspense fallback={<LoadingSpinner />}>
                <section id="features">
                  <FeaturesPremium />
                </section>
              </Suspense>

              <section id="pricing">
                <PricingPremium />
              </section>

              <section id="benefits">
                <BenefitsPremium />
              </section>

              <section id="faq">
                <FAQPremium />
              </section>

              <FinalCTAPremium />
            </main>

            <FooterPremium />
          </div>
        </div>
      </div>
    </>
  );
};

export default LandingPage;
