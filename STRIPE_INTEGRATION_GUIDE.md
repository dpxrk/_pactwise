# Stripe Integration Guide for Pactwise

## Overview
This guide outlines the complete integration of Stripe payment processing into the Pactwise platform, covering subscription management, usage-based billing, and enterprise invoicing.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Stripe Products Setup](#stripe-products-setup)
3. [Backend Integration](#backend-integration)
4. [Frontend Integration](#frontend-integration)
5. [Webhook Handling](#webhook-handling)
6. [Usage-Based Billing](#usage-based-billing)
7. [Enterprise Billing](#enterprise-billing)
8. [Security Considerations](#security-considerations)
9. [Testing Strategy](#testing-strategy)
10. [Migration Plan](#migration-plan)

## Architecture Overview

### High-Level Flow
```
User → Frontend → Convex Backend → Stripe API
                       ↓
                  Database (Subscriptions, Usage)
                       ↓
                  Stripe Webhooks → Convex
```

### Key Components
- **Stripe Products**: Starter, Professional, Enterprise
- **Stripe Prices**: Monthly/Annual for each product
- **Metered Billing**: API calls, data retention
- **Customer Portal**: Self-service subscription management
- **Webhooks**: Real-time subscription updates

## Stripe Products Setup

### 1. Create Products in Stripe Dashboard

```javascript
// Product Structure
const products = {
  starter: {
    name: "Pactwise Starter",
    description: "Perfect for small teams getting started",
    metadata: {
      tier: "starter",
      maxUsers: "10",
      apiCalls: "10000",
      dataRetention: "6"
    }
  },
  professional: {
    name: "Pactwise Professional",
    description: "For growing teams needing advanced features",
    metadata: {
      tier: "professional",
      maxUsers: "50",
      apiCalls: "100000",
      dataRetention: "24"
    }
  },
  enterprise: {
    name: "Pactwise Enterprise",
    description: "Custom solutions for large organizations",
    metadata: {
      tier: "enterprise",
      custom: "true"
    }
  }
};
```

### 2. Create Pricing Plans

```javascript
// Price Structure
const prices = {
  starter_monthly: {
    product: "starter",
    unit_amount: 4900, // $49.00
    currency: "usd",
    recurring: { interval: "month" }
  },
  starter_annual: {
    product: "starter",
    unit_amount: 39200, // $392.00 (20% discount)
    currency: "usd",
    recurring: { interval: "year" }
  },
  // Similar for professional tier
};
```

### 3. Create Metered Products

```javascript
// Usage-Based Products
const meteredProducts = {
  api_calls: {
    name: "Additional API Calls",
    unit_amount: 100, // $1.00 per 1000 calls
    usage_type: "metered",
    aggregate_usage: "sum"
  },
  data_retention: {
    name: "Extended Data Retention",
    unit_amount: 2000, // $20.00 per year
    usage_type: "licensed"
  }
};
```

## Backend Integration

### 1. Convex Schema Updates

```typescript
// convex/schema.ts additions
export const subscriptions = defineTable({
  enterpriseId: v.id("enterprises"),
  stripeCustomerId: v.string(),
  stripeSubscriptionId: v.string(),
  stripePriceId: v.string(),
  status: v.string(), // active, canceled, past_due, etc.
  currentPeriodStart: v.number(),
  currentPeriodEnd: v.number(),
  cancelAtPeriodEnd: v.boolean(),
  tier: v.string(), // starter, professional, enterprise
  billingInterval: v.string(), // monthly, annual
})
.index("by_enterprise", ["enterpriseId"])
.index("by_stripe_subscription", ["stripeSubscriptionId"]);

export const usageRecords = defineTable({
  enterpriseId: v.id("enterprises"),
  type: v.string(), // api_calls, data_storage
  amount: v.number(),
  timestamp: v.number(),
  stripeUsageRecordId: v.optional(v.string()),
  reported: v.boolean(),
})
.index("by_enterprise_type", ["enterpriseId", "type"])
.index("by_timestamp", ["timestamp"]);

export const invoices = defineTable({
  enterpriseId: v.id("enterprises"),
  stripeInvoiceId: v.string(),
  amount: v.number(),
  status: v.string(),
  paidAt: v.optional(v.number()),
  invoiceUrl: v.string(),
})
.index("by_enterprise", ["enterpriseId"]);
```

### 2. Stripe Configuration

```typescript
// convex/stripe/config.ts
import Stripe from 'stripe';

// Initialize Stripe with Convex environment variables
export const initStripe = () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  
  return new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
    typescript: true,
  });
};
```

### 3. Subscription Management Functions

```typescript
// convex/stripe/subscriptions.ts
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

export const createCheckoutSession = mutation({
  args: {
    priceId: v.string(),
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const stripe = initStripe();
    const identity = await ctx.auth.getUserIdentity();
    
    if (!identity) throw new Error("Unauthorized");
    
    // Get or create Stripe customer
    const enterprise = await ctx.db.get(args.enterpriseId);
    let customerId = enterprise?.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: identity.email,
        metadata: {
          enterpriseId: args.enterpriseId,
        },
      });
      customerId = customer.id;
      
      await ctx.db.patch(args.enterpriseId, {
        stripeCustomerId: customerId,
      });
    }
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: args.priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${process.env.APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.APP_URL}/pricing?canceled=true`,
      metadata: {
        enterpriseId: args.enterpriseId,
      },
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          enterpriseId: args.enterpriseId,
        },
      },
    });
    
    return { checkoutUrl: session.url };
  },
});

export const createCustomerPortal = mutation({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const stripe = initStripe();
    const enterprise = await ctx.db.get(args.enterpriseId);
    
    if (!enterprise?.stripeCustomerId) {
      throw new Error("No customer found");
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: enterprise.stripeCustomerId,
      return_url: `${process.env.APP_URL}/dashboard/billing`,
    });
    
    return { portalUrl: session.url };
  },
});
```

### 4. Usage Tracking

```typescript
// convex/stripe/usage.ts
export const recordApiUsage = mutation({
  args: {
    enterpriseId: v.id("enterprises"),
    endpoint: v.string(),
    responseTime: v.number(),
  },
  handler: async (ctx, args) => {
    // Record usage in database
    await ctx.db.insert("usageRecords", {
      enterpriseId: args.enterpriseId,
      type: "api_calls",
      amount: 1,
      timestamp: Date.now(),
      reported: false,
    });
    
    // Check if we need to report to Stripe (batch every hour)
    const hourAgo = Date.now() - 3600000;
    const unreportedUsage = await ctx.db
      .query("usageRecords")
      .withIndex("by_enterprise_type", (q) =>
        q.eq("enterpriseId", args.enterpriseId).eq("type", "api_calls")
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("reported"), false),
          q.lt(q.field("timestamp"), hourAgo)
        )
      )
      .collect();
    
    if (unreportedUsage.length >= 100) {
      await ctx.scheduler.runAfter(0, "stripe/reportUsage", {
        enterpriseId: args.enterpriseId,
      });
    }
  },
});

export const reportUsageToStripe = internalMutation({
  args: {
    enterpriseId: v.id("enterprises"),
  },
  handler: async (ctx, args) => {
    const stripe = initStripe();
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_enterprise", (q) =>
        q.eq("enterpriseId", args.enterpriseId)
      )
      .first();
    
    if (!subscription?.stripeSubscriptionId) return;
    
    // Get unreported usage
    const usage = await ctx.db
      .query("usageRecords")
      .withIndex("by_enterprise_type", (q) =>
        q.eq("enterpriseId", args.enterpriseId).eq("type", "api_calls")
      )
      .filter((q) => q.eq(q.field("reported"), false))
      .collect();
    
    const totalUsage = usage.reduce((sum, record) => sum + record.amount, 0);
    
    if (totalUsage > 0) {
      // Report to Stripe
      const subscriptionItem = await stripe.subscriptionItems.list({
        subscription: subscription.stripeSubscriptionId,
      });
      
      const meteredItem = subscriptionItem.data.find(
        (item) => item.price.recurring?.usage_type === 'metered'
      );
      
      if (meteredItem) {
        const usageRecord = await stripe.subscriptionItems.createUsageRecord(
          meteredItem.id,
          {
            quantity: totalUsage,
            timestamp: Math.floor(Date.now() / 1000),
            action: 'increment',
          }
        );
        
        // Mark usage as reported
        await Promise.all(
          usage.map((record) =>
            ctx.db.patch(record._id, {
              reported: true,
              stripeUsageRecordId: usageRecord.id,
            })
          )
        );
      }
    }
  },
});
```

## Frontend Integration

### 1. Pricing Page Integration

```typescript
// src/app/_components/homepage/Pricing.tsx updates
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

const PricingSection = () => {
  const createCheckout = useAction(api.stripe.subscriptions.createCheckoutSession);
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string, planName: string) => {
    setLoading(planName);
    try {
      const { checkoutUrl } = await createCheckout({
        priceId,
        enterpriseId: currentEnterprise._id,
      });
      
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error("Failed to start checkout process");
    } finally {
      setLoading(null);
    }
  };

  // Update CTA buttons to use handleSubscribe
  <button
    onClick={() => handleSubscribe(plan.stripePriceId, plan.name)}
    disabled={loading === plan.name}
    className={`...existing styles...`}
  >
    {loading === plan.name ? "Loading..." : plan.cta}
  </button>
};
```

### 2. Billing Dashboard

```typescript
// src/app/dashboard/billing/page.tsx
"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function BillingPage() {
  const subscription = useQuery(api.stripe.subscriptions.getCurrentSubscription);
  const usage = useQuery(api.stripe.usage.getCurrentPeriodUsage);
  const invoices = useQuery(api.stripe.invoices.list);
  const openPortal = useAction(api.stripe.subscriptions.createCustomerPortal);

  const handleManageSubscription = async () => {
    const { portalUrl } = await openPortal({
      enterpriseId: currentEnterprise._id,
    });
    
    if (portalUrl) {
      window.location.href = portalUrl;
    }
  };

  return (
    <div className="space-y-8">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold">{subscription?.tier}</h3>
              <p className="text-muted-foreground">
                ${subscription?.amount / 100}/month
              </p>
            </div>
            <Button onClick={handleManageSubscription}>
              Manage Subscription
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Usage This Period */}
      <Card>
        <CardHeader>
          <CardTitle>Usage This Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span>API Calls</span>
                <span>{usage?.apiCalls.toLocaleString()} / {subscription?.apiCallLimit.toLocaleString()}</span>
              </div>
              <Progress value={(usage?.apiCalls / subscription?.apiCallLimit) * 100} />
            </div>
            {usage?.apiCalls > subscription?.apiCallLimit && (
              <Alert>
                <AlertDescription>
                  Additional charges: ${((usage.apiCalls - subscription.apiCallLimit) * 0.001).toFixed(2)}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices?.map((invoice) => (
                <TableRow key={invoice._id}>
                  <TableCell>{new Date(invoice.created).toLocaleDateString()}</TableCell>
                  <TableCell>${invoice.amount / 100}</TableCell>
                  <TableCell>
                    <Badge variant={invoice.status === 'paid' ? 'success' : 'warning'}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <a href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Webhook Handling

### 1. Webhook Endpoint

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const stripe = initStripe();
    const sig = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!sig || !webhookSecret) {
      return new Response("Webhook signature missing", { status: 400 });
    }
    
    let event: Stripe.Event;
    
    try {
      const body = await request.text();
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response("Invalid signature", { status: 400 });
    }
    
    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        await ctx.runMutation(internal.stripe.webhooks.handleCheckoutCompleted, {
          session: event.data.object,
        });
        break;
        
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await ctx.runMutation(internal.stripe.webhooks.handleSubscriptionUpdate, {
          subscription: event.data.object,
        });
        break;
        
      case "invoice.payment_succeeded":
        await ctx.runMutation(internal.stripe.webhooks.handleInvoicePaid, {
          invoice: event.data.object,
        });
        break;
        
      case "invoice.payment_failed":
        await ctx.runMutation(internal.stripe.webhooks.handlePaymentFailed, {
          invoice: event.data.object,
        });
        break;
    }
    
    return new Response("OK", { status: 200 });
  }),
});

export default http;
```

### 2. Webhook Handlers

```typescript
// convex/stripe/webhooks.ts
export const handleCheckoutCompleted = internalMutation({
  args: {
    session: v.any(),
  },
  handler: async (ctx, args) => {
    const { session } = args;
    const enterpriseId = session.metadata.enterpriseId;
    
    // Create subscription record
    await ctx.db.insert("subscriptions", {
      enterpriseId,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      stripePriceId: session.line_items.data[0].price.id,
      status: "active",
      currentPeriodStart: Date.now(),
      currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
      cancelAtPeriodEnd: false,
      tier: determineTierFromPrice(session.line_items.data[0].price.id),
      billingInterval: session.line_items.data[0].price.recurring.interval,
    });
    
    // Update enterprise features
    await updateEnterpriseFeatures(ctx, enterpriseId);
    
    // Send welcome email
    await ctx.scheduler.runAfter(0, "notifications/sendWelcomeEmail", {
      enterpriseId,
    });
  },
});

export const handleSubscriptionUpdate = internalMutation({
  args: {
    subscription: v.any(),
  },
  handler: async (ctx, args) => {
    const { subscription } = args;
    
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) =>
        q.eq("stripeSubscriptionId", subscription.id)
      )
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: subscription.current_period_end * 1000,
      });
      
      // Update features if plan changed
      if (subscription.items.data[0].price.id !== existing.stripePriceId) {
        await ctx.db.patch(existing._id, {
          stripePriceId: subscription.items.data[0].price.id,
          tier: determineTierFromPrice(subscription.items.data[0].price.id),
        });
        await updateEnterpriseFeatures(ctx, existing.enterpriseId);
      }
    }
  },
});
```

## Usage-Based Billing

### 1. API Middleware

```typescript
// convex/middleware/usage.ts
export const trackApiUsage = async (ctx: any, next: any) => {
  const start = Date.now();
  const identity = await ctx.auth.getUserIdentity();
  
  try {
    const result = await next();
    
    if (identity?.enterpriseId) {
      // Record successful API call
      await ctx.runMutation(internal.stripe.usage.recordApiUsage, {
        enterpriseId: identity.enterpriseId,
        endpoint: ctx.functionName,
        responseTime: Date.now() - start,
      });
    }
    
    return result;
  } catch (error) {
    // Still track failed API calls
    if (identity?.enterpriseId) {
      await ctx.runMutation(internal.stripe.usage.recordApiUsage, {
        enterpriseId: identity.enterpriseId,
        endpoint: ctx.functionName,
        responseTime: Date.now() - start,
        failed: true,
      });
    }
    throw error;
  }
};
```

### 2. Scheduled Usage Reporting

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Report usage to Stripe every hour
crons.hourly(
  "report usage to stripe",
  { minuteUTC: 0 },
  internal.stripe.usage.reportAllUsage
);

// Clean up old usage records (keep 90 days)
crons.daily(
  "cleanup old usage records",
  { hourUTC: 3, minuteUTC: 0 },
  internal.stripe.usage.cleanupOldRecords
);

export default crons;
```

## Enterprise Billing

### 1. Custom Quoting

```typescript
// convex/stripe/enterprise.ts
export const createEnterpriseQuote = mutation({
  args: {
    enterpriseId: v.id("enterprises"),
    seats: v.number(),
    apiCallLimit: v.number(),
    customFeatures: v.array(v.string()),
    contractLength: v.number(), // months
  },
  handler: async (ctx, args) => {
    const stripe = initStripe();
    
    // Calculate custom pricing
    const basePrice = 10000; // $100 base
    const seatPrice = args.seats * 500; // $5 per seat
    const apiPrice = Math.floor(args.apiCallLimit / 100000) * 1000; // $10 per 100k calls
    const featurePrice = args.customFeatures.length * 2000; // $20 per feature
    
    const monthlyPrice = basePrice + seatPrice + apiPrice + featurePrice;
    const totalPrice = monthlyPrice * args.contractLength;
    const discountedPrice = totalPrice * 0.85; // 15% discount for enterprise
    
    // Create quote in Stripe
    const quote = await stripe.quotes.create({
      customer: enterprise.stripeCustomerId,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Pactwise Enterprise',
            description: `${args.seats} seats, ${args.apiCallLimit.toLocaleString()} API calls/month`,
          },
          unit_amount: Math.floor(discountedPrice / args.contractLength),
          recurring: {
            interval: 'month',
            interval_count: 1,
          },
        },
        quantity: 1,
      }],
      metadata: {
        enterpriseId: args.enterpriseId,
        contractLength: args.contractLength.toString(),
        features: JSON.stringify(args.customFeatures),
      },
    });
    
    return {
      quoteId: quote.id,
      quoteUrl: quote.url,
      monthlyPrice: discountedPrice / args.contractLength,
      totalPrice: discountedPrice,
    };
  },
});
```

## Security Considerations

### 1. Environment Variables

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Production
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2. Security Best Practices

1. **API Key Management**
   - Never expose secret keys in frontend code
   - Use environment variables for all keys
   - Rotate keys regularly

2. **Webhook Security**
   - Always verify webhook signatures
   - Use webhook endpoints only from Stripe IPs
   - Implement idempotency for webhook handlers

3. **PCI Compliance**
   - Never store card details
   - Use Stripe Checkout or Elements
   - Implement proper HTTPS

4. **Access Control**
   - Verify user permissions before subscription actions
   - Implement proper enterprise isolation
   - Audit all billing actions

## Testing Strategy

### 1. Test Mode Setup

```typescript
// Use Stripe test mode keys
const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
});
```

### 2. Test Scenarios

1. **Subscription Flows**
   - New subscription creation
   - Plan upgrades/downgrades
   - Cancellation and reactivation
   - Trial period handling

2. **Payment Scenarios**
   - Successful payments
   - Failed payments
   - Card updates
   - Refunds

3. **Usage Billing**
   - Usage recording
   - Overage calculations
   - Usage reset on billing cycle

4. **Enterprise Flows**
   - Custom quote generation
   - Contract negotiations
   - Invoice payments

### 3. Test Cards

```javascript
// Stripe test cards
const testCards = {
  success: "4242424242424242",
  decline: "4000000000000002",
  authentication: "4000002500003155",
  insufficient: "4000000000009995",
};
```

## Migration Plan

### Phase 1: Setup (Week 1)
1. Create Stripe account
2. Configure products and prices
3. Set up webhook endpoints
4. Update database schema

### Phase 2: Development (Weeks 2-3)
1. Implement backend APIs
2. Build frontend components
3. Integrate webhooks
4. Add usage tracking

### Phase 3: Testing (Week 4)
1. Complete test scenarios
2. Load testing for usage tracking
3. Security audit
4. User acceptance testing

### Phase 4: Launch (Week 5)
1. Migrate to production keys
2. Enable for subset of users
3. Monitor and fix issues
4. Full rollout

### Phase 5: Optimization (Ongoing)
1. Analyze pricing effectiveness
2. Optimize usage tracking
3. Improve billing UX
4. Add advanced features

## Monitoring & Analytics

### Key Metrics to Track
1. **Revenue Metrics**
   - MRR/ARR
   - Churn rate
   - Upgrade/downgrade rate
   - LTV

2. **Usage Metrics**
   - API call patterns
   - Feature adoption
   - Overage frequency
   - Cost per customer

3. **Operational Metrics**
   - Payment failure rate
   - Webhook processing time
   - Support ticket volume
   - Time to resolution

### Monitoring Tools
```typescript
// Example monitoring integration
export const logStripeEvent = (event: string, data: any) => {
  // Send to analytics
  analytics.track(event, {
    ...data,
    timestamp: new Date(),
  });
  
  // Log to monitoring service
  if (process.env.NODE_ENV === 'production') {
    Sentry.addBreadcrumb({
      category: 'stripe',
      message: event,
      data,
    });
  }
};
```

## Conclusion

This integration provides a complete billing solution for Pactwise with:
- Flexible subscription management
- Usage-based billing capabilities
- Enterprise-ready features
- Comprehensive security
- Scalable architecture

The implementation follows Stripe best practices and provides a solid foundation for monetizing the Pactwise platform.