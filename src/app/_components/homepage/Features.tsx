"use client";

import { Shield, FileText, Users, BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/app/_components/common/Container";

const features = [
  {
    icon: <Shield className="h-8 w-8 text-gold" />,
    title: "Enterprise-Grade Security",
    description:
      "Secure document management with role-based access control and encryption.",
  },
  {
    icon: <FileText className="h-8 w-8 text-gold" />,
    title: "Smart Contract Management",
    description:
      "Create, upload, and manage contracts with powerful templating and redlining capabilities.",
  },
  {
    icon: <Users className="h-8 w-8 text-gold" />,
    title: "Vendor Management",
    description:
      "Streamline vendor relationships and maintain compliance with centralized vendor data.",
  },
  {
    icon: <BarChart2 className="h-8 w-8 text-gold" />,
    title: "Advanced Analytics",
    description:
      "Gain insights into contract performance, savings, and operational efficiency.",
  },
];

export const Features = () => {
  return (
    <section className="relative">
      <Container className="py-24 sm:py-32">
        <div className="mb-16 flex flex-col items-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary font-serif sm:text-4xl">
            Powerful Features for Modern Businesses
          </h2>
          <p className="mt-4 max-w-xl text-center text-muted-foreground">
            Everything you need to manage contracts efficiently and securely in
            one place.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="transition-shadow border-gold/20 bg-background"
            >
              <CardHeader>
                <div className="mb-2">{feature.icon}</div>
                <CardTitle className="text-xl font-serif">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
};

export default Features;
