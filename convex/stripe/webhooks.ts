import { httpAction } from "../_generated/server";
import { getStripe, getWebhookSecret } from "./config";
import type Stripe from "stripe";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// Main webhook handler
export const handleWebhook = httpAction(async (ctx, request) => {
  const stripe = await getStripe();
  const webhookSecret = getWebhookSecret();
  
  // Get the signature from headers
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }
  
  // Get raw body
  const rawBody = await request.text();
  
  let event: Stripe.Event;
  
  try {
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }
  
  // Handle the event
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(ctx, event.data.object as Stripe.Checkout.Session);
        break;
        
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionCreatedOrUpdated(ctx, event.data.object as Stripe.Subscription);
        break;
        
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(ctx, event.data.object as Stripe.Subscription);
        break;
        
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(ctx, event.data.object as Stripe.Invoice);
        break;
        
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(ctx, event.data.object as Stripe.Invoice);
        break;
        
      case "customer.updated":
        await handleCustomerUpdated(ctx, event.data.object as Stripe.Customer);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response("Internal error", { status: 500 });
  }
});

// Handle successful checkout
async function handleCheckoutSessionCompleted(
  ctx: any,
  session: Stripe.Checkout.Session
) {
  if (session.mode === "subscription") {
    // Subscription checkout completed
    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;
    const enterpriseId = session.metadata?.enterpriseId as Id<"enterprises">;
    const userId = session.metadata?.userId as Id<"users">;
    
    if (!enterpriseId) {
      throw new Error("Missing enterpriseId in session metadata");
    }
    
    // The subscription will be handled by the subscription.created webhook
    console.log("Checkout completed for subscription:", subscriptionId);
    
    // You can add additional logic here, like sending a welcome email
  } else if (session.mode === "setup") {
    // Payment method setup completed
    const customerId = session.customer as string;
    const setupIntentId = session.setup_intent as string;
    
    console.log("Payment method setup completed:", setupIntentId);
  }
}

// Handle subscription created or updated
async function handleSubscriptionCreatedOrUpdated(
  ctx: any,
  subscription: Stripe.Subscription
) {
  const enterpriseId = subscription.metadata.enterpriseId as Id<"enterprises">;
  
  if (!enterpriseId) {
    console.error("Missing enterpriseId in subscription metadata");
    return;
  }
  
  // Store or update subscription in database
  await ctx.runMutation(api.stripe.subscriptions.store, {
    enterpriseId,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer as string,
    status: subscription.status,
    plan: subscription.metadata.plan || "starter",
    billingPeriod: subscription.metadata.billingPeriod || "monthly",
    currentPeriodStart: (subscription as any).current_period_start * 1000,
    currentPeriodEnd: (subscription as any).current_period_end * 1000,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at ? subscription.canceled_at * 1000 : undefined,
    trialEnd: subscription.trial_end ? subscription.trial_end * 1000 : undefined,
    metadata: subscription.metadata,
  });
}

// Handle subscription deleted
async function handleSubscriptionDeleted(
  ctx: any,
  subscription: Stripe.Subscription
) {
  const enterpriseId = subscription.metadata.enterpriseId as Id<"enterprises">;
  
  if (!enterpriseId) {
    console.error("Missing enterpriseId in subscription metadata");
    return;
  }
  
  // Update subscription status to canceled
  await ctx.runMutation(api.stripe.subscriptions.store, {
    enterpriseId,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customer as string,
    status: "canceled",
    plan: subscription.metadata.plan || "starter",
    billingPeriod: subscription.metadata.billingPeriod || "monthly",
    currentPeriodStart: (subscription as any).current_period_start * 1000,
    currentPeriodEnd: (subscription as any).current_period_end * 1000,
    cancelAtPeriodEnd: false,
    canceledAt: Date.now(),
    trialEnd: subscription.trial_end ? subscription.trial_end * 1000 : undefined,
    metadata: subscription.metadata,
  });
}

// Handle successful invoice payment
async function handleInvoicePaymentSucceeded(
  ctx: any,
  invoice: Stripe.Invoice
) {
  const subscriptionId = (invoice as any).subscription as string;
  const customerId = invoice.customer as string;
  
  // Store invoice record
  if (invoice.metadata?.enterpriseId) {
    await ctx.runMutation(api.stripe.invoices.store, {
      enterpriseId: invoice.metadata.enterpriseId as Id<"enterprises">,
      stripeInvoiceId: invoice.id,
      subscriptionId,
      status: invoice.status || "paid",
      amount: invoice.amount_paid,
      currency: invoice.currency,
      paid: true,
      periodStart: invoice.period_start * 1000,
      periodEnd: invoice.period_end * 1000,
      dueDate: invoice.due_date ? invoice.due_date * 1000 : undefined,
      pdfUrl: invoice.invoice_pdf || undefined,
    });
  }
}

// Handle failed invoice payment
async function handleInvoicePaymentFailed(
  ctx: any,
  invoice: Stripe.Invoice
) {
  const subscriptionId = (invoice as any).subscription as string;
  const customerId = invoice.customer as string;
  
  console.error("Invoice payment failed:", invoice.id);
  
  // You can add logic here to:
  // - Send payment failure notification email
  // - Update subscription status
  // - Restrict access to features
}

// Handle customer updated
async function handleCustomerUpdated(
  ctx: any,
  customer: Stripe.Customer
) {
  const enterpriseId = customer.metadata.enterpriseId as Id<"enterprises">;
  
  if (!enterpriseId || !customer.email) {
    return;
  }
  
  // Update customer email in database
  await ctx.runMutation(api.stripe.customers.updateEmail, {
    enterpriseId,
    email: customer.email,
  });
}