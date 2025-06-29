import { ArrowRight, Bot, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/app/_components/common/Container";

export const Hero = () => {
  return (
    <div className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden">
      {/* Remove the white background to show the dark animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Subtle animated lines only - no orbs */}
        <div className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent animate-slide-in-left" />
        <div className="absolute top-3/4 right-0 w-full h-px bg-gradient-to-l from-transparent via-teal-500/30 to-transparent animate-slide-in-right animation-delay-600" />
      </div>

      <Container className="relative z-10">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex items-center justify-center animate-fade-in">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-emerald-500 mx-3"></span>
            <span className="text-sm uppercase tracking-widest font-medium bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">AI-Powered Solutions</span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-teal-500 mx-3"></span>
          </div>

          <h1 className="max-w-5xl text-4xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl font-sans animate-fade-in-up">
            Transform Your{" "}
            <span className="relative inline-block bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Contract Management
              <span className="absolute -bottom-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/70 to-transparent animate-pulse"></span>
            </span>
            {" "}<br className="hidden sm:inline" />
            with AI Agents{" "}
          </h1>

          <p className="mt-8 max-w-3xl text-lg leading-8 text-gray-300 md:text-xl font-light animate-fade-in animation-delay-200">
            Experience the future of contract management with autonomous AI agents that handle analysis, 
            compliance monitoring, risk assessment, and workflow automation—while you focus on strategy.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4 text-sm animate-fade-in animation-delay-400">
            <div className="flex items-center gap-2 bg-emerald-950/50 backdrop-blur-sm rounded-full px-4 py-2 border border-emerald-500/30 hover:border-emerald-400/50 hover:bg-emerald-900/50 transition-all duration-300 group">
              <Bot className="w-4 h-4 text-emerald-400 group-hover:animate-pulse" />
              <span className="text-emerald-100">Autonomous AI Agents</span>
            </div>
            <div className="flex items-center gap-2 bg-teal-950/50 backdrop-blur-sm rounded-full px-4 py-2 border border-teal-500/30 hover:border-teal-400/50 hover:bg-teal-900/50 transition-all duration-300 group">
              <Zap className="w-4 h-4 text-teal-400 group-hover:animate-pulse" />
              <span className="text-teal-100">Real-time Analysis</span>
            </div>
            <div className="flex items-center gap-2 bg-cyan-950/50 backdrop-blur-sm rounded-full px-4 py-2 border border-cyan-500/30 hover:border-cyan-400/50 hover:bg-cyan-900/50 transition-all duration-300 group">
              <Shield className="w-4 h-4 text-cyan-400 group-hover:animate-pulse" />
              <span className="text-cyan-100">Risk Monitoring</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-y-4 gap-x-8 animate-fade-in animation-delay-600">
            <Button 
              variant="outline"
              size="lg" 
              className="group relative bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-8 py-6 rounded-lg cursor-pointer shadow-2xl hover:shadow-emerald-500/25 transition-all duration-300 transform hover:scale-105 border-0 overflow-hidden"
            >
              <span className="relative z-10">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4 inline transition-transform group-hover:translate-x-1" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
            </Button>           
          </div>
        </div>
      </Container>
    </div>
  );
};