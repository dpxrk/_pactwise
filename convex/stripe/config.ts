import { action } from "../_generated/server";
import Stripe from "stripe";

// Initialize Stripe with the secret key
export function getStripe() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
  }
  
  return new Stripe(stripeSecretKey, {
    apiVersion: "2025-06-30.basil",
    typescript: true,
  });
}

// Helper to get price IDs from environment
export function getStripePriceId(plan: string, billingPeriod: string): string {
  const envKey = `STRIPE_PRICE_ID_${plan.toUpperCase()}_${billingPeriod.toUpperCase()}`;
  const priceId = process.env[envKey];
  
  if (!priceId) {
    throw new Error(`${envKey} is not set in environment variables`);
  }
  
  return priceId;
}

// Helper to format currency
export function formatCurrency(amountInCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amountInCents / 100);
}

// Helper to get the webhook secret
export function getWebhookSecret(): string {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set in environment variables");
  }
  
  return webhookSecret;
}