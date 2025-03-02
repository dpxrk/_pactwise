"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/app/_components/common/Container";


export const Hero = () => {
  return (
    <div className="relative pt-24 pb-20 md:pt-32 md:pb-28 bg-gradient-to-b from-slate-50 to-transparent">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-gradient-to-br from-gold/10 to-transparent" />
        <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-gradient-to-tr from-primary/5 to-transparent" />
        <div className="absolute top-1/4 left-1/3 w-1 h-16 bg-gold/30" />
        <div className="absolute top-1/2 right-1/4 w-24 h-1 bg-gold/20" />
      </div>

      <Container className="relative z-10">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex items-center justify-center">
            <span className="h-px w-8 bg-gold mx-3"></span>
            <span className="text-gold text-sm uppercase tracking-widest font-medium">Elite Solutions</span>
            <span className="h-px w-8 bg-gold mx-3"></span>
          </div>

          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-primary sm:text-6xl md:text-7xl font-serif">
            Transform Your{" "}
            <span className="text-gold relative inline-block">
              Contract Management
              <span className="absolute -bottom-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent"></span>
            </span>
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl font-light">
            Streamline your contract lifecycle with AI-powered automation,
            real-time analytics, and secure collaboration tools designed for
            modern enterprises.
          </p>

          <div className="mt-12 flex flex-col sm:flex-row items-center gap-y-4 gap-x-8 ">
            <Button 
              variant="outline"
              size="lg" 
              className="group bg-primary hover:bg-primary/90 text-gold px-8 py-6 rounded-sm cursor-pointer"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="border-gold/50 text-primary hover:bg-gold/5 px-8 py-6 rounded-sm cursor-pointer"
            >
              Learn More
            </Button>
          </div>

         
        </div>
      </Container>
    </div>
  );
};