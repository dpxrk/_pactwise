"use client";

import React from "react";
import { Check, Sparkles, Zap, Building2 } from "lucide-react";

const PricingSection = () => {
  const plans = [
    {
      name: "Starter",
      price: "$49",
      period: "/month",
      description: "Perfect for small teams getting started with contract management",
      icon: Zap,
      popular: false,
      features: [
        "Up to 10 users",
        "10,000 API calls/month",
        "Unlimited dashboards",
        "6-month data retention",
        "Email support",
        "Basic integrations",
        "Standard analytics"
      ],
      cta: "Start Free Trial",
      gradient: "from-emerald-500 to-teal-600"
    },
    {
      name: "Professional",
      price: "$149",
      period: "/month",
      description: "For growing teams that need advanced features and analytics",
      icon: Sparkles,
      popular: true,
      features: [
        "Up to 50 users",
        "100,000 API calls/month",
        "Advanced analytics features",
        "2-year data retention",
        "Priority support",
        "All integrations",
        "Custom branding",
        "AI-powered insights"
      ],
      cta: "Start Free Trial",
      gradient: "from-teal-500 to-cyan-600"
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "Tailored solutions for large organizations with specific needs",
      icon: Building2,
      popular: false,
      features: [
        "Unlimited users",
        "Custom API limits",
        "Unlimited data retention",
        "Dedicated support team",
        "SSO/SAML integration",
        "Custom contracts",
        "SLA guarantees",
        "On-premise deployment option"
      ],
      cta: "Contact Sales",
      gradient: "from-cyan-500 to-blue-600"
    }
  ];

  return (
    <section className="relative py-24 px-4 bg-gradient-to-b from-[#0a1515] to-[#0d1f1f]">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-6">
            Choose the perfect plan for your team. All plans include a 14-day free trial.
          </p>
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400 font-medium">
              Save 20% with annual billing
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            return (
              <div
                key={index}
                className={`relative group ${
                  plan.popular ? "md:-mt-4" : ""
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-5 left-0 right-0 flex justify-center">
                    <span className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-semibold px-4 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Card */}
                <div
                  className={`h-full bg-white/5 backdrop-blur-sm border rounded-2xl p-8 transition-all duration-300 hover:transform hover:-translate-y-2 ${
                    plan.popular
                      ? "border-teal-500/50 hover:border-teal-400/70"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  {/* Plan Header */}
                  <div className="mb-8">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} p-0.5 mb-4`}>
                      <div className="w-full h-full bg-[#0d1f1f] rounded-xl flex items-center justify-center">
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                    <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                    <div className="flex items-baseline">
                      <span className="text-4xl font-bold text-white">{plan.price}</span>
                      <span className="text-gray-400 ml-1">{plan.period}</span>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start">
                        <Check className="w-5 h-5 text-emerald-400 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-300 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-300 ${
                      plan.popular
                        ? "bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:from-teal-600 hover:to-cyan-700"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional Options */}
        <div className="mt-16 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-white mb-2">Need More?</h3>
            <p className="text-gray-400">Flexible add-ons to scale with your growth</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <h4 className="font-semibold text-white mb-2">Additional API Calls</h4>
              <p className="text-gray-400 text-sm">$10 per 10,000 calls</p>
            </div>
            <div className="text-center">
              <h4 className="font-semibold text-white mb-2">Extended Data Retention</h4>
              <p className="text-gray-400 text-sm">$20/month per additional year</p>
            </div>
            <div className="text-center">
              <h4 className="font-semibold text-white mb-2">Premium Integrations</h4>
              <p className="text-gray-400 text-sm">$30-50/month each</p>
            </div>
          </div>
        </div>

        {/* Trust Elements */}
        <div className="text-center mt-12">
          <p className="text-gray-400 text-sm">
            All plans include SSL encryption, GDPR compliance, and 99.9% uptime SLA
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;