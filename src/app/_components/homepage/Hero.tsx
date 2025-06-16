import { ArrowRight, Bot, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/app/_components/common/Container";

export const Hero = () => {
  return (
    <div className="relative pt-24 pb-20 md:pt-32 md:pb-28 bg-gradient-to-b from-slate-50 to-transparent overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Kept subtle background animations for "life" */}
        <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-gradient-to-br from-gold/10 to-transparent animate-gentle-pulse" />
        <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-gradient-to-tr from-primary/5 to-transparent animate-gentle-pulse animation-delay-2000" />
        <div className="absolute top-1/4 left-1/3 w-1 h-16 bg-gold/30 animate-float" />
        <div className="absolute top-1/2 right-1/4 w-24 h-1 bg-gold/20 animate-float animation-delay-2000" />
      </div>

      <Container className="relative z-10">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex items-center justify-center">
            <span className="h-px w-8 bg-gold mx-3"></span>
            <span className="text-sm uppercase tracking-widest font-medium text-gradient-gold">AI-Powered Solutions</span>
            <span className="h-px w-8 bg-gold mx-3"></span>
          </div>

          <h1 className="max-w-5xl text-4xl font-bold tracking-tight text-primary sm:text-6xl md:text-7xl font-sans">
            Transform Your{" "}
            <span className="relative inline-block text-gold text-gradient-gold">
              Contract Management
              <span className="absolute -bottom-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent"></span>
            </span>
            {" "}<br className="hidden sm:inline" />
            with AI Agents{" "}
          </h1>

          <p className="mt-8 max-w-3xl text-lg leading-8 text-muted-foreground md:text-xl font-light">
            Experience the future of contract management with autonomous AI agents that handle analysis, 
            compliance monitoring, risk assessment, and workflow automation—while you focus on strategy.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4 text-sm">
            <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm rounded-full px-4 py-2 border border-gold/20 hover:shadow-luxury-sm transition-shadow duration-300">
              <Bot className="w-4 h-4 text-gold" /> {/* text-gold will be standard, not gradient here unless you add text-gradient-gold */}
              <span className="text-primary/80">Autonomous AI Agents</span>
            </div>
            <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm rounded-full px-4 py-2 border border-gold/20 hover:shadow-luxury-sm transition-shadow duration-300">
              <Zap className="w-4 h-4 text-gold" />
              <span className="text-primary/80">Real-time Analysis</span>
            </div>
            <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm rounded-full px-4 py-2 border border-gold/20 hover:shadow-luxury-sm transition-shadow duration-300">
              <Shield className="w-4 h-4 text-gold" />
              <span className="text-primary/80">Risk Monitoring</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-y-4 gap-x-8">
            <Button 
              variant="outline"
              size="lg" 
              className="group bg-primary hover:bg-primary/90 text-gold px-8 py-6 rounded-sm cursor-pointer shadow-luxury hover:shadow-luxury-lg transition-all duration-300 transform hover:scale-105"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>           
          </div>
        </div>
      </Container>
    </div>
  );
};