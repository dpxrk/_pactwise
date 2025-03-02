"use client";

import { Shield, FileText, Users, BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/app/_components/common/Container";

const features = [
  {
    icon: <Shield className="h-10 w-10 text-gold" />,
    title: "Enterprise-Grade Security",
    description:
      "Secure document management with role-based access control and encryption.",
  },
  {
    icon: <FileText className="h-10 w-10 text-gold" />,
    title: "Smart Contract Management",
    description:
      "Create, upload, and manage contracts with powerful templating and redlining capabilities.",
  },
  {
    icon: <Users className="h-10 w-10 text-gold" />,
    title: "Vendor Management",
    description:
      "Streamline vendor relationships and maintain compliance with centralized vendor data.",
  },
  {
    icon: <BarChart2 className="h-10 w-10 text-gold" />,
    title: "Advanced Analytics",
    description:
      "Gain insights into contract performance, savings, and operational efficiency.",
  },
];

export const Features = () => {
  return (
    <section className="relative bg-gradient-to-t from-slate-50/50 to-transparent">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 right-1/4 w-1/3 h-1/3 bg-gradient-to-tl from-gold/5 to-transparent" />
        <div className="absolute top-1/3 left-0 w-1/4 h-1/4 bg-gradient-to-tr from-primary/5 to-transparent" />
        <div className="absolute bottom-1/4 right-1/3 w-1 h-16 bg-gold/20" />
        <div className="absolute top-1/2 left-1/4 w-24 h-1 bg-gold/10" />
      </div>

      <Container className="py-24 sm:py-32 relative z-10">
        <div className="mb-16 flex flex-col items-center">
          <div className="mb-6 flex items-center justify-center">
            <span className="h-px w-6 bg-gold mx-3"></span>
            <span className="text-gold text-sm uppercase tracking-widest font-medium">Core Capabilities</span>
            <span className="h-px w-6 bg-gold mx-3"></span>
          </div>
          
          <h2 className="text-3xl font-bold tracking-tight text-primary font-serif sm:text-4xl md:text-5xl text-center max-w-2xl">
            Powerful Features for 
            <span className="text-gold relative inline-block ml-2">
              Modern Businesses
              <span className="absolute -bottom-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent"></span>
            </span>
          </h2>
          
          <p className="mt-6 max-w-xl text-center text-muted-foreground font-light text-lg">
            Everything you need to manage contracts efficiently and securely in
            one place.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="transition-all duration-300 border border-gold/10 bg-white/80 backdrop-blur-sm hover:shadow-lg hover:shadow-gold/5 group"
            >
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
      </Container>
    </section>
  );
};

export default Features;