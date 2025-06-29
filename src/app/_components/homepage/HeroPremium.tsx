"use client";

import React, { useEffect, useRef } from "react";
import { ArrowRight, Sparkles, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/app/_components/common/Container";

export const HeroPremium = () => {
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    // Text scramble effect for headline
    const scrambleText = (element: HTMLElement) => {
      const text = element.textContent || "";
      const chars = "!<>-_\\/[]{}—=+*^?#________";
      let iteration = 0;
      
      const interval = setInterval(() => {
        element.textContent = text
          .split("")
          .map((letter, index) => {
            if (index < iteration) {
              return text[index];
            }
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("");
        
        if (iteration >= text.length) {
          clearInterval(interval);
        }
        
        iteration += 1/3;
      }, 30);
    };

    // Trigger scramble effect on load
    if (headlineRef.current) {
      setTimeout(() => scrambleText(headlineRef.current!), 500);
    }
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float animation-delay-4000" />
      </div>

      <Container className="relative z-10">
        <div className="flex flex-col items-center text-center">
          {/* Premium badge */}
          <div className="mb-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/10 hover:border-white/20 transition-all duration-300 group">
              <Sparkles className="w-4 h-4 text-teal-400 animate-pulse" />
              <span className="text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">
                Next-Gen Contract Intelligence
              </span>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            </div>
          </div>

          {/* Main headline with gradient */}
          <h1 
            ref={headlineRef}
            className="text-display font-black text-white text-center max-w-6xl mx-auto mb-8 animate-fade-in-up"
          >
            <span className="block">Contracts on</span>
            <span className="block text-gradient animate-gradient-shift bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-500 bg-[length:200%_auto]">
              Autopilot
            </span>
          </h1>

          {/* Subtitle */}
          <p 
            ref={subtitleRef}
            className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed animate-fade-in animation-delay-200"
          >
            Let AI agents handle your contracts while you focus on growth. 
            <span className="text-white font-medium"> 90% faster</span>, 
            <span className="text-white font-medium"> 100% smarter</span>.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-12 animate-fade-in animation-delay-300">
            {[
              { icon: Zap, text: "10x Faster Analysis", color: "purple" },
              { icon: Shield, text: "Zero-Risk Compliance", color: "pink" },
              { icon: Sparkles, text: "AI-Powered Insights", color: "teal" },
            ].map((feature, index) => (
              <div
                key={index}
                className={`
                  group relative overflow-hidden rounded-full
                  px-5 py-2.5 
                  bg-gradient-to-r from-${feature.color}-500/10 to-${feature.color}-600/10
                  border border-${feature.color}-500/20
                  hover:border-${feature.color}-400/40
                  transition-all duration-300
                  animate-fade-in animation-delay-${400 + index * 100}
                `}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <div className="relative flex items-center gap-2">
                  <feature.icon className={`w-4 h-4 text-${feature.color}-400`} />
                  <span className="text-sm font-medium text-gray-200">{feature.text}</span>
                </div>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 animate-fade-in animation-delay-500">
            <Button
              size="lg"
              className="group relative overflow-hidden bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-8 py-6 text-lg font-semibold rounded-xl transition-all duration-300 shadow-glow hover:shadow-glow hover:scale-105"
            >
              <span className="relative z-10 flex items-center gap-2">
                Start Free Trial
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </Button>
            
            <Button
              size="lg"
              variant="outline"
              className="group glass hover:bg-white/5 border-white/10 hover:border-white/20 text-white px-8 py-6 text-lg font-semibold rounded-xl transition-all duration-300"
            >
              <span className="flex items-center gap-2">
                Watch Demo
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              </span>
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="mt-16 pt-16 border-t border-white/5 animate-fade-in animation-delay-700">
            <p className="text-sm text-gray-500 mb-4">Trusted by leading enterprises</p>
            <div className="flex items-center justify-center gap-8 opacity-50 hover:opacity-70 transition-opacity">
              {/* Placeholder for logos - replace with actual logos */}
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-24 h-8 bg-white/10 rounded animate-pulse"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </Container>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none" />
    </div>
  );
};

export default HeroPremium;