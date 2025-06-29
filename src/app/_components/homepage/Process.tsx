"use client";

import React from "react";
import { Upload, Brain, Shield, TrendingUp } from "lucide-react";

const ProcessSection = () => {
  const steps = [
    {
      number: "01",
      title: "Upload Your Contracts",
      description: "Simply drag and drop your contracts or connect your existing document management system. Our AI instantly begins processing.",
      icon: Upload,
      color: "from-emerald-500 to-teal-600"
    },
    {
      number: "02",
      title: "AI Analysis & Extraction",
      description: "Our multi-agent AI system analyzes every clause, extracts key terms, identifies risks, and categorizes your contracts automatically.",
      icon: Brain,
      color: "from-teal-500 to-cyan-600"
    },
    {
      number: "03",
      title: "Monitor & Manage",
      description: "Get real-time alerts for renewals, compliance issues, and optimization opportunities. Collaborate with your team seamlessly.",
      icon: Shield,
      color: "from-cyan-500 to-blue-600"
    },
    {
      number: "04",
      title: "Optimize & Save",
      description: "Leverage AI-powered insights to negotiate better terms, consolidate vendors, and reduce costs by up to 30%.",
      icon: TrendingUp,
      color: "from-blue-500 to-emerald-600"
    }
  ];

  return (
    <section className="relative py-24 px-4 bg-gradient-to-b from-[#0d1f1f] to-[#0a1515]">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Transform your contract management in four simple steps. 
            Get started in minutes, see results immediately.
          </p>
        </div>

        {/* Process Steps */}
        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-blue-500/20 transform -translate-y-1/2" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={index}
                  className="relative group"
                >
                  {/* Step Card */}
                  <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 h-full transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:transform hover:-translate-y-2">
                    {/* Step Number */}
                    <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-full flex items-center justify-center border border-white/20">
                      <span className="text-sm font-bold text-white">{step.number}</span>
                    </div>
                    
                    {/* Icon */}
                    <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${step.color} p-0.5 mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <div className="w-full h-full bg-[#0d1f1f] rounded-xl flex items-center justify-center">
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    
                    {/* Content */}
                    <h3 className="text-xl font-semibold text-white mb-3">
                      {step.title}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                  
                  {/* Arrow (except for last item) */}
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 8L20 16L12 24" stroke="url(#gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <defs>
                          <linearGradient id="gradient" x1="12" y1="8" x2="20" y2="24">
                            <stop stopColor="#10b981" stopOpacity="0.5"/>
                            <stop offset="1" stopColor="#0ea5e9" stopOpacity="0.5"/>
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-gray-400 mb-6">
            Join thousands of enterprises already transforming their contract management
          </p>
          <button className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 transform hover:scale-105">
            Start Your Free Trial
          </button>
        </div>
      </div>
    </section>
  );
};

export default ProcessSection;