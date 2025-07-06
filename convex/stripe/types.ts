import { v } from "convex/values";

// Stripe Price IDs for different plans
export const STRIPE_PRICE_IDS = {
  STARTER_MONTHLY: "price_starter_monthly",
  STARTER_ANNUAL: "price_starter_annual",
  PROFESSIONAL_MONTHLY: "price_professional_monthly", 
  PROFESSIONAL_ANNUAL: "price_professional_annual",
  ENTERPRISE: "price_enterprise", // Custom pricing
} as const;

// Subscription Plans
export const PLANS = {
  STARTER: "starter",
  PROFESSIONAL: "professional",
  ENTERPRISE: "enterprise",
} as const;

export type PlanType = typeof PLANS[keyof typeof PLANS];

// Billing Periods
export const BILLING_PERIODS = {
  MONTHLY: "monthly",
  ANNUAL: "annual",
} as const;

export type BillingPeriod = typeof BILLING_PERIODS[keyof typeof BILLING_PERIODS];

// Subscription Status (matches Stripe)
export const SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  CANCELED: "canceled",
  INCOMPLETE: "incomplete",
  INCOMPLETE_EXPIRED: "incomplete_expired",
  PAST_DUE: "past_due",
  TRIALING: "trialing",
  UNPAID: "unpaid",
} as const;

export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS];

// Convex Schema for Stripe data
export const stripeCustomerSchema = v.object({
  enterpriseId: v.id("enterprises"),
  stripeCustomerId: v.string(),
  email: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const subscriptionSchema = v.object({
  enterpriseId: v.id("enterprises"),
  stripeSubscriptionId: v.string(),
  stripeCustomerId: v.string(),
  status: v.union(
    v.literal("active"),
    v.literal("canceled"),
    v.literal("incomplete"),
    v.literal("incomplete_expired"),
    v.literal("past_due"),
    v.literal("trialing"),
    v.literal("unpaid")
  ),
  plan: v.union(
    v.literal("starter"),
    v.literal("professional"),
    v.literal("enterprise")
  ),
  billingPeriod: v.union(
    v.literal("monthly"),
    v.literal("annual")
  ),
  currentPeriodStart: v.number(),
  currentPeriodEnd: v.number(),
  cancelAtPeriodEnd: v.boolean(),
  canceledAt: v.optional(v.number()),
  trialEnd: v.optional(v.number()),
  metadata: v.optional(v.record(v.string(), v.string())),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const paymentMethodSchema = v.object({
  enterpriseId: v.id("enterprises"),
  stripePaymentMethodId: v.string(),
  type: v.string(),
  card: v.optional(v.object({
    brand: v.string(),
    last4: v.string(),
    expMonth: v.number(),
    expYear: v.number(),
  })),
  isDefault: v.boolean(),
  createdAt: v.number(),
});

export const invoiceSchema = v.object({
  enterpriseId: v.id("enterprises"),
  stripeInvoiceId: v.string(),
  subscriptionId: v.optional(v.string()),
  status: v.string(),
  amount: v.number(),
  currency: v.string(),
  paid: v.boolean(),
  periodStart: v.number(),
  periodEnd: v.number(),
  dueDate: v.optional(v.number()),
  pdfUrl: v.optional(v.string()),
  createdAt: v.number(),
});

export const usageRecordSchema = v.object({
  enterpriseId: v.id("enterprises"),
  subscriptionId: v.string(),
  metric: v.string(), // e.g., "api_calls", "contracts_processed"
  quantity: v.number(),
  timestamp: v.number(),
  metadata: v.optional(v.record(v.string(), v.string())),
});

// Checkout Session Data
export const checkoutSessionSchema = v.object({
  plan: v.string(),
  billingPeriod: v.string(),
  enterpriseId: v.id("enterprises"),
  userId: v.id("users"),
  successUrl: v.string(),
  cancelUrl: v.string(),
});

// Price data for display
export const PLAN_DETAILS = {
  starter: {
    name: "Starter",
    description: "Perfect for small teams getting started",
    features: [
      "Up to 10 users",
      "10,000 API calls/month",
      "Unlimited dashboards", 
      "6-month data retention",
      "Email support",
      "Basic integrations",
      "Standard analytics"
    ],
    limits: {
      users: 10,
      apiCalls: 10000,
      dataRetentionMonths: 6,
    }
  },
  professional: {
    name: "Professional",
    description: "For growing teams that need more",
    features: [
      "Up to 50 users",
      "100,000 API calls/month",
      "Advanced analytics",
      "2-year data retention",
      "Priority support",
      "All integrations",
      "Custom branding",
      "AI-powered insights"
    ],
    limits: {
      users: 50,
      apiCalls: 100000,
      dataRetentionMonths: 24,
    }
  },
  enterprise: {
    name: "Enterprise",
    description: "Tailored for large organizations",
    features: [
      "Unlimited users",
      "Custom API limits",
      "Unlimited retention",
      "Dedicated support",
      "SSO/SAML",
      "Custom contracts",
      "SLA guarantees",
      "On-premise option"
    ],
    limits: {
      users: -1, // unlimited
      apiCalls: -1, // custom
      dataRetentionMonths: -1, // unlimited
    }
  }
};

// Pricing in cents
export const PRICING = {
  starter: {
    monthly: 4900, // $49
    annual: 39900, // $399 (save $189)
  },
  professional: {
    monthly: 14900, // $149
    annual: 119900, // $1199 (save $589)
  },
  enterprise: {
    monthly: -1, // custom
    annual: -1, // custom
  }
};