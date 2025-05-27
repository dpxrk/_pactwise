"use client";

import { Shield, FileText, Users, BarChart2, Bot, Brain, Zap, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/app/_components/common/Container";

const features = [
  {
    icon: <Bot className="h-10 w-10 text-gold" />,
    title: "AI Agent Automation",
    description:
      "Deploy autonomous AI agents for contract analysis, risk assessment, compliance monitoring, and workflow orchestration.",
      highlight: "New",
  },
  {
    icon: <Brain className="h-10 w-10 text-gold" />,
    title: "Intelligent Contract Analysis",
    description:
      "Advanced AI analyzes contract content, extracts key terms, identifies risks, and provides actionable insights in real-time.",
  },
  {
    icon: <Shield className="h-10 w-10 text-gold" />,
    title: "Enterprise-Grade Security",
    description:
      "Secure document management with role-based access control, encryption, and comprehensive audit trails.",
  },
  {
    icon: <FileText className="h-10 w-10 text-gold" />,
    title: "Smart Contract Management",
    description:
      "Create, upload, and manage contracts with AI-powered templating, automated redlining, and intelligent categorization.",
  },
  {
    icon: <Users className="h-10 w-10 text-gold" />,
    title: "Vendor Intelligence",
    description:
      "AI-driven vendor risk assessment, performance monitoring, and relationship optimization for better partnerships.",
  },
  {
    icon: <BarChart2 className="h-10 w-10 text-gold" />,
    title: "Advanced Analytics",
    description:
      "Real-time dashboards, predictive insights, and automated reporting powered by AI agents working around the clock.",
  },
  {
    icon: <Zap className="h-10 w-10 text-gold" />,
    title: "Workflow Automation",
    description:
      "Intelligent automation of approval processes, notifications, renewals, and compliance checks with minimal human intervention.",
  },
  {
    icon: <Eye className="h-10 w-10 text-gold" />,
    title: "Risk Monitoring",
    description:
      "Continuous AI monitoring for contract compliance, regulatory changes, and potential risks with automated alerts.",
  },
];

export const Features = () => {
  return (
    <section className="relative bg-gradient-to-t from-slate-50/50 to-transparent">
      {/* Enhanced decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 right-1/4 w-1/3 h-1/3 bg-gradient-to-tl from-gold/5 to-transparent" />
        <div className="absolute top-1/3 left-0 w-1/4 h-1/4 bg-gradient-to-tr from-primary/5 to-transparent" />
        <div className="absolute bottom-1/4 right-1/3 w-1 h-16 bg-gold/20" />
        <div className="absolute top-1/2 left-1/4 w-24 h-1 bg-gold/10" />
        
        {/* Floating elements for AI theme */}
        <div className="absolute top-1/4 right-1/3 w-2 h-2 bg-gold/30 rounded-full animate-pulse" />
        <div className="absolute bottom-1/3 left-1/4 w-1 h-1 bg-primary/40 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-2/3 right-1/5 w-1.5 h-1.5 bg-gold/40 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <Container className="py-12 sm:py-12 relative z-10">
        <div className="mb-16 flex flex-col items-center">
          <div className="mb-6 flex items-center justify-center">
            <span className="h-px w-6 bg-gold mx-3"></span>
            <span className="text-gold text-sm uppercase tracking-widest font-medium">AI-Powered Capabilities</span>
            <span className="h-px w-6 bg-gold mx-3"></span>
          </div>
          
          <h2 className="text-3xl font-bold tracking-tight text-primary font-serif sm:text-4xl md:text-5xl text-center max-w-3xl">
            Revolutionize Your Workflow with{" "}
            <span className="text-gold relative inline-block ml-2">
              Intelligent Automation
              <span className="absolute -bottom-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent"></span>
            </span>
          </h2>
          
          <p className="mt-6 max-w-2xl text-center text-muted-foreground font-light text-lg">
            Experience next-generation contract management powered by autonomous AI agents that work 24/7 
            to analyze, monitor, and optimize your contracts.
          </p>
        </div>

        {/* AI Agents Showcase Section */}
        <div className="mb-16 p-8 bg-gradient-to-r from-gold/5 via-primary/5 to-gold/5 rounded-xl border border-gold/20">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-primary mb-2">Meet Your AI Agents</h3>
            <p className="text-muted-foreground">Autonomous agents working together to transform your contract management</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-gold/20 transition-colors">
                <Bot className="w-8 h-8 text-gold" />
              </div>
              <h4 className="font-semibold text-primary mb-2">Financial Agent</h4>
              <p className="text-sm text-muted-foreground">Analyzes costs, identifies savings opportunities, and monitors financial compliance</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h4 className="font-semibold text-primary mb-2">Legal Agent</h4>
              <p className="text-sm text-muted-foreground">Reviews contracts for legal compliance, risk assessment, and regulatory alignment</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-gold/20 transition-colors">
                <BarChart2 className="w-8 h-8 text-gold" />
              </div>
              <h4 className="font-semibold text-primary mb-2">Analytics Agent</h4>
              <p className="text-sm text-muted-foreground">Generates insights, tracks KPIs, and provides predictive analytics for decision making</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="transition-all duration-300 border border-gold/10 bg-white/80 backdrop-blur-sm hover:shadow-lg hover:shadow-gold/5 group relative overflow-hidden"
            >
              {/* {feature.highlight && (
                <div className="absolute top-2 right-2 bg-gold text-white text-xs px-2 py-1 rounded-full font-medium">
                  {feature.highlight}
                </div>
              )} */}
              <CardHeader className="pb-4">
                <div className="mb-4 p-3 bg-primary/5 rounded-sm inline-block group-hover:bg-gold/5 transition-colors duration-300">
                  {feature.icon}
                </div>
                <CardTitle className="text-xl font-serif text-primary group-hover:text-gold transition-colors duration-300">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
                <div className="mt-6 h-px w-12 bg-gradient-to-r from-gold/30 to-transparent group-hover:w-full transition-all duration-500"></div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Technology Stack Highlight */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">Powered by cutting-edge AI technology</p>
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            <span className="px-3 py-1 bg-white/50 rounded-full border border-gold/20 text-primary/70">Machine Learning</span>
            <span className="px-3 py-1 bg-white/50 rounded-full border border-gold/20 text-primary/70">Natural Language Processing</span>
            <span className="px-3 py-1 bg-white/50 rounded-full border border-gold/20 text-primary/70">Autonomous Agents</span>
            <span className="px-3 py-1 bg-white/50 rounded-full border border-gold/20 text-primary/70">Predictive Analytics</span>
          </div>
        </div>
      </Container>
    </section>
  );
};

export default Features;