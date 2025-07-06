"use client";

import React, { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, AlertCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Id } from "../../../convex/_generated/dataModel";
import { PLAN_DETAILS, PRICING } from "../../../convex/stripe/types";

interface SubscriptionManagerProps {
  enterpriseId: Id<"enterprises">;
}

export function SubscriptionManager({ enterpriseId }: SubscriptionManagerProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  // Queries
  const subscription = useQuery(api.stripe.subscriptions.getActiveSubscription, {
    enterpriseId,
  });
  const usage = useQuery(api.stripe.subscriptions.getCurrentPeriodUsage, {
    enterpriseId,
  });
  const upcomingInvoice = useQuery(api.stripe.invoices.getUpcomingInvoiceAmount, {
    enterpriseId,
  });
  
  // Actions
  const createPortalSession = useAction(api.stripe.checkout.createPortalSession);
  const cancelSubscription = useAction(api.stripe.subscriptions.cancelSubscription);
  const resumeSubscription = useAction(api.stripe.subscriptions.resumeSubscription);

  const handleManageBilling = async () => {
    setIsLoading(true);
    try {
      const { url } = await createPortalSession({
        enterpriseId,
        returnUrl: window.location.href,
      });
      
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Portal session error:", error);
      toast.error("Failed to open billing portal");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm("Are you sure you want to cancel your subscription?")) {
      return;
    }
    
    setIsLoading(true);
    try {
      await cancelSubscription({
        enterpriseId,
        immediately: false,
      });
      toast.success("Subscription will be canceled at the end of the billing period");
    } catch (error) {
      console.error("Cancel subscription error:", error);
      toast.error("Failed to cancel subscription");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResumeSubscription = async () => {
    setIsLoading(true);
    try {
      await resumeSubscription({ enterpriseId });
      toast.success("Subscription resumed successfully");
    } catch (error) {
      console.error("Resume subscription error:", error);
      toast.error("Failed to resume subscription");
    } finally {
      setIsLoading(false);
    }
  };

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Active Subscription</CardTitle>
          <CardDescription>
            Start your free trial to access all features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.location.href = "/pricing"}>
            View Plans
          </Button>
        </CardContent>
      </Card>
    );
  }

  const planDetails = PLAN_DETAILS[subscription.plan];
  const statusColor = {
    active: "bg-green-500",
    trialing: "bg-blue-500",
    past_due: "bg-red-500",
    canceled: "bg-gray-500",
    incomplete: "bg-yellow-500",
    incomplete_expired: "bg-red-500",
    unpaid: "bg-red-500",
  }[subscription.status];

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>
                {planDetails.name} - {subscription.billingPeriod}
              </CardDescription>
            </div>
            <Badge className={statusColor}>
              {subscription.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Plan details */}
          <div>
            <p className="text-sm text-muted-foreground">
              {planDetails.description}
            </p>
          </div>

          {/* Billing info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Current period</p>
              <p className="font-medium">
                {format(subscription.currentPeriodStart, "MMM d, yyyy")} -{" "}
                {format(subscription.currentPeriodEnd, "MMM d, yyyy")}
              </p>
            </div>
            {upcomingInvoice && (
              <div>
                <p className="text-muted-foreground">Next payment</p>
                <p className="font-medium">
                  ${(upcomingInvoice.amount / 100).toFixed(2)} on{" "}
                  {format(upcomingInvoice.nextPaymentDate, "MMM d, yyyy")}
                </p>
              </div>
            )}
          </div>

          {/* Trial info */}
          {subscription.trialEnd && subscription.trialEnd > Date.now() && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <p className="text-sm text-blue-600">
                  Free trial ends on {format(subscription.trialEnd, "MMM d, yyyy")}
                </p>
              </div>
            </div>
          )}

          {/* Cancellation warning */}
          {subscription.cancelAtPeriodEnd && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950 p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <p className="text-sm text-red-600">
                  Subscription will end on {format(subscription.currentPeriodEnd, "MMM d, yyyy")}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              onClick={handleManageBilling}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Manage Billing
            </Button>
            
            {subscription.cancelAtPeriodEnd ? (
              <Button
                onClick={handleResumeSubscription}
                disabled={isLoading}
                variant="outline"
              >
                Resume Subscription
              </Button>
            ) : (
              <Button
                onClick={handleCancelSubscription}
                disabled={isLoading}
                variant="outline"
                className="text-red-600 hover:text-red-700"
              >
                Cancel Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle>Current Usage</CardTitle>
            <CardDescription>
              Usage for the current billing period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(usage.usage).map(([metric, used]) => {
                const limit = usage.limits[metric];
                const percentage = limit > 0 ? (used / limit) * 100 : 0;
                const isUnlimited = limit === -1;
                
                return (
                  <div key={metric} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {metric.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span className="font-medium">
                        {used.toLocaleString()}
                        {!isUnlimited && ` / ${limit.toLocaleString()}`}
                        {isUnlimited && " (Unlimited)"}
                      </span>
                    </div>
                    {!isUnlimited && (
                      <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            percentage >= 90
                              ? "bg-red-500"
                              : percentage >= 70
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {planDetails.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}