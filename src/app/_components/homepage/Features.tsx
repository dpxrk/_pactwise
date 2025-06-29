import { Shield, FileText, Users, BarChart2, Bot, Brain, Zap, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/app/_components/common/Container";
import React from 'react';
import { cn } from "@/lib/utils";

const features = [
  {
    icon: <Bot className="h-10 w-10" />,
    title: "AI Agent Automation",
    description:
      "Deploy autonomous AI agents for contract analysis, risk assessment, compliance monitoring, and workflow orchestration.",
  },
  {
    icon: <Brain className="h-10 w-10" />,
    title: "Intelligent Contract Analysis",
    description:
      "Advanced AI analyzes contract content, extracts key terms, identifies risks, and provides actionable insights in real-time.",
  },
  {
    icon: <Shield className="h-10 w-10" />,
    title: "Enterprise-Grade Security",
    description:
      "Secure document management with role-based access control, encryption, and comprehensive audit trails.",
  },
  {
    icon: <FileText className="h-10 w-10" />,
    title: "Smart Contract Management",
    description:
      "Create, upload, and manage contracts with AI-powered templating, automated redlining, and intelligent categorization.",
  },
  {
    icon: <Users className="h-10 w-10" />,
    title: "Vendor Intelligence",
    description:
      "AI-driven vendor risk assessment, performance monitoring, and relationship optimization for better partnerships.",
  },
  {
    icon: <BarChart2 className="h-10 w-10" />,
    title: "Advanced Analytics",
    description:
      "Real-time dashboards, predictive insights, and automated reporting powered by AI agents working around the clock.",
  },
  {
    icon: <Zap className="h-10 w-10" />,
    title: "Workflow Automation",
    description:
      "Intelligent automation of approval processes, notifications, renewals, and compliance checks with minimal human intervention.",
  },
  {
    icon: <Eye className="h-10 w-10" />,
    title: "Risk Monitoring",
    description:
      "Continuous AI monitoring for contract compliance, regulatory changes, and potential risks with automated alerts.",
  },
];

export const Features = () => {
  return (
    <section className="relative bg-gradient-to-b from-transparent via-emerald-950/20 to-transparent">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 right-1/4 w-1/3 h-1/3 bg-gradient-to-tl from-emerald-500/5 to-transparent" />
        <div className="absolute top-1/3 left-0 w-1/4 h-1/4 bg-gradient-to-tr from-teal-500/5 to-transparent" />
      </div>

      <Container className="py-16 sm:py-24 relative z-10">
        <div className="mb-20 flex flex-col items-center">
          <div className="mb-8 flex items-center justify-center">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-emerald-500 mx-4"></span>
            <span className="text-sm uppercase tracking-widest font-medium bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">AI-Powered Capabilities</span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-teal-500 mx-4"></span>
          </div>
          
          <h2 className="text-4xl font-bold tracking-tight text-white font-sans sm:text-5xl md:text-6xl text-center max-w-3xl">
            Revolutionize Your Workflow with{" "}
            <span className="relative inline-block ml-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              Intelligent Automation
              <span className="absolute -bottom-2.5 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent"></span>
            </span>
          </h2>
          
          <p className="mt-8 max-w-2xl text-center text-gray-300 font-light text-lg">
            Experience next-generation contract management powered by autonomous AI agents that work 24/7 
            to analyze, monitor, and optimize your contracts.
          </p>
        </div>

        <div className="mb-20 p-10 bg-gradient-to-br from-emerald-950/50 via-teal-950/30 to-cyan-950/50 rounded-xl border border-emerald-500/20 shadow-2xl backdrop-blur-sm">
          <div className="text-center mb-10">
            <h3 className="text-3xl font-bold text-white mb-3">Meet Your AI Agents</h3>
            <p className="text-gray-300 text-base">Autonomous agents synergizing to elevate your contract management.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <Bot className="w-10 h-10" />, title: "Financial Agent", desc: "Analyzes costs, identifies savings, and monitors financial compliance with precision." },
              { icon: <Shield className="w-10 h-10" />, title: "Legal Agent", desc: "Reviews contracts for legal compliance, risk assessment, and regulatory alignment meticulously." },
              { icon: <BarChart2 className="w-10 h-10" />, title: "Analytics Agent", desc: "Generates insights, tracks KPIs, and provides predictive analytics for strategic decision making." }
            ].map((agent, idx) => (
              <div key={idx} className="text-center group">
                <div className="w-20 h-20 bg-emerald-950/50 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-5 shadow-2xl hover:bg-emerald-900/50 hover:border-emerald-400/50 transition-all duration-300 transform group-hover:scale-105">
                  {React.cloneElement(agent.icon, { className: "w-10 h-10 text-emerald-400 transform transition-transform duration-300 group-hover:scale-110" })}
                </div>
                <h4 className="font-semibold text-xl text-white mb-2">{agent.title}</h4>
                <p className="text-sm text-gray-300 px-2">{agent.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <Card
              key={index}
              className={cn(
                "transition-all duration-300 border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-teal-950/30 to-cyan-950/40 shadow-2xl group relative overflow-hidden backdrop-blur-sm",
                "transform hover:-translate-y-2 hover:shadow-emerald-500/20 hover:border-emerald-400/40" 
              )}
              style={{ transformStyle: "preserve-3d" }}
            >
              <CardHeader className="pb-4">
                <div className="mb-4 p-3 bg-emerald-900/30 rounded-lg inline-block group-hover:bg-emerald-800/40 transition-colors duration-300 transform group-hover:scale-105">
                  {React.cloneElement(feature.icon, { className: "h-10 w-10 text-emerald-400 transition-transform duration-300 group-hover:scale-110" })}
                </div>
                <CardTitle className="text-xl font-sans text-white group-hover:text-emerald-300 transition-colors duration-300">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {feature.description}
                </p>
                <div className="mt-6 h-px w-12 bg-gradient-to-r from-emerald-500/40 to-transparent group-hover:w-full transition-all duration-500 ease-out"></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-20 text-center">
          <p className="text-base text-gray-300 mb-6">Powered by cutting-edge AI technology</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm">
            {["Machine Learning", "Natural Language Processing", "Autonomous Agents", "Predictive Analytics"].map((tech, idx) => (
                <span key={idx} className="px-4 py-2 bg-emerald-950/50 backdrop-blur-sm rounded-full border border-emerald-500/20 text-emerald-100 hover:bg-emerald-900/50 hover:border-emerald-400/40 transition-all duration-300 transform hover:scale-105 cursor-default">
                    {tech}
                </span>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
};

export default Features;