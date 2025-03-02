"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/app/_components/common/Container";

export const Hero = () => {
  return (
    <div className="relative pt-20 pb-16 md:pt-24 md:pb-20">
      <Container className="relative z-10">
        <div className="flex flex-col items-center text-center">
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-primary sm:text-6xl font-serif">
            Transform Your <br />
            <span className="text-gold">Contract Management</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
            Streamline your contract lifecycle with AI-powered automation,
            real-time analytics, and secure collaboration tools designed for
            modern enterprises.
          </p>

          <div className="mt-10 flex items-center gap-x-6">
            <Button size="lg" className="group">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button variant="outline" size="lg">
              Learn More
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
};
