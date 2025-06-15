'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  CreditCard, 
  Download, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  Settings,
  Users,
  Database,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

export default function BillingSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);

  // Mock billing data
  const currentPlan = {
    name: 'Professional',
    price: 99,
    period: 'month',
    features: [
      'Unlimited contracts',
      'Advanced analytics',
      'API access',
      'Priority support',
      'Custom integrations'
    ],
    usage: {
      contracts: { current: 85, limit: 500 },
      users: { current: 8, limit: 25 },
      storage: { current: 2.1, limit: 10 }, // GB
      apiCalls: { current: 15420, limit: 50000 }
    }
  };

  const billingHistory = [
    {
      id: 'inv-001',
      date: new Date('2024-01-01'),
      amount: 99.00,
      status: 'paid',
      description: 'Professional Plan - January 2024'
    },
    {
      id: 'inv-002',
      date: new Date('2023-12-01'),
      amount: 99.00,
      status: 'paid',
      description: 'Professional Plan - December 2023'
    },
    {
      id: 'inv-003',
      date: new Date('2023-11-01'),
      amount: 99.00,
      status: 'paid',
      description: 'Professional Plan - November 2023'
    }
  ];

  const availablePlans = [
    {
      name: 'Starter',
      price: 29,
      period: 'month',
      description: 'Perfect for small teams',
      features: [
        'Up to 50 contracts',
        'Basic analytics',
        'Email support',
        '5 users',
        '2GB storage'
      ],
      recommended: false
    },
    {
      name: 'Professional',
      price: 99,
      period: 'month',
      description: 'For growing businesses',
      features: [
        'Up to 500 contracts',
        'Advanced analytics',
        'Priority support',
        '25 users',
        '10GB storage',
        'API access'
      ],
      recommended: true
    },
    {
      name: 'Enterprise',
      price: 299,
      period: 'month',
      description: 'For large organizations',
      features: [
        'Unlimited contracts',
        'Custom analytics',
        '24/7 support',
        'Unlimited users',
        'Unlimited storage',
        'Custom integrations',
        'Dedicated support'
      ],
      recommended: false
    }
  ];

  const handleDownloadInvoice = (invoiceId: string) => {
    toast.success(`Invoice ${invoiceId} download started`);
  };

  const handleChangePlan = (planName: string) => {
    toast.success(`Plan change to ${planName} initiated`);
  };

  const handleCancelSubscription = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Subscription cancellation requested');
    } catch (error) {
      toast.error('Failed to cancel subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const getUsagePercentage = (current: number, limit: number) => {
    return Math.round((current / limit) * 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-500';
    if (percentage >= 75) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="default" className="bg-green-100 text-green-800">Paid</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription, billing details, and payment methods.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan
            </CardTitle>
            <CardDescription>
              Your current subscription details and usage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{currentPlan.name} Plan</h3>
                <p className="text-2xl font-bold">
                  ${currentPlan.price}
                  <span className="text-base font-normal text-muted-foreground">/{currentPlan.period}</span>
                </p>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Active
              </Badge>
            </div>

            <Separator />

            {/* Usage Metrics */}
            <div className="space-y-4">
              <h4 className="font-medium">Usage This Month</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Contracts
                    </span>
                    <span className={getUsageColor(getUsagePercentage(currentPlan.usage.contracts.current, currentPlan.usage.contracts.limit))}>
                      {currentPlan.usage.contracts.current} / {currentPlan.usage.contracts.limit}
                    </span>
                  </div>
                  <Progress 
                    value={getUsagePercentage(currentPlan.usage.contracts.current, currentPlan.usage.contracts.limit)} 
                    className="h-2"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Users
                    </span>
                    <span className={getUsageColor(getUsagePercentage(currentPlan.usage.users.current, currentPlan.usage.users.limit))}>
                      {currentPlan.usage.users.current} / {currentPlan.usage.users.limit}
                    </span>
                  </div>
                  <Progress 
                    value={getUsagePercentage(currentPlan.usage.users.current, currentPlan.usage.users.limit)} 
                    className="h-2"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Storage
                    </span>
                    <span className={getUsageColor(getUsagePercentage(currentPlan.usage.storage.current, currentPlan.usage.storage.limit))}>
                      {currentPlan.usage.storage.current}GB / {currentPlan.usage.storage.limit}GB
                    </span>
                  </div>
                  <Progress 
                    value={getUsagePercentage(currentPlan.usage.storage.current, currentPlan.usage.storage.limit)} 
                    className="h-2"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      API Calls
                    </span>
                    <span className={getUsageColor(getUsagePercentage(currentPlan.usage.apiCalls.current, currentPlan.usage.apiCalls.limit))}>
                      {currentPlan.usage.apiCalls.current.toLocaleString()} / {currentPlan.usage.apiCalls.limit.toLocaleString()}
                    </span>
                  </div>
                  <Progress 
                    value={getUsagePercentage(currentPlan.usage.apiCalls.current, currentPlan.usage.apiCalls.limit)} 
                    className="h-2"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Manage Payment Method
              </Button>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Billing History
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Available Plans */}
        <Card>
          <CardHeader>
            <CardTitle>Available Plans</CardTitle>
            <CardDescription>
              Choose the plan that best fits your needs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {availablePlans.map((plan) => (
                <div 
                  key={plan.name}
                  className={`relative p-6 border rounded-lg ${
                    plan.recommended ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200'
                  }`}
                >
                  {plan.recommended && (
                    <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500">
                      Recommended
                    </Badge>
                  )}
                  
                  <div className="text-center space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    </div>
                    
                    <div className="text-3xl font-bold">
                      ${plan.price}
                      <span className="text-base font-normal text-muted-foreground">/{plan.period}</span>
                    </div>
                    
                    <ul className="space-y-2 text-sm">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    
                    <Button 
                      className="w-full"
                      variant={plan.name === currentPlan.name ? "secondary" : "default"}
                      disabled={plan.name === currentPlan.name}
                      onClick={() => handleChangePlan(plan.name)}
                    >
                      {plan.name === currentPlan.name ? 'Current Plan' : `Upgrade to ${plan.name}`}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Billing History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Billing History
            </CardTitle>
            <CardDescription>
              View and download your past invoices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billingHistory.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.id}</TableCell>
                    <TableCell>{invoice.date.toLocaleDateString()}</TableCell>
                    <TableCell>{invoice.description}</TableCell>
                    <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadInvoice(invoice.id)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Usage Alerts */}
        <Alert>
          <TrendingUp className="h-4 w-4" />
          <AlertTitle>Usage Alert</AlertTitle>
          <AlertDescription>
            You're approaching your contract limit (85/500 contracts used). 
            Consider upgrading to the Enterprise plan for unlimited contracts.
          </AlertDescription>
        </Alert>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible actions that will affect your subscription.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border border-red-200 rounded-lg bg-red-50">
              <h4 className="font-medium text-red-800 mb-2">Cancel Subscription</h4>
              <p className="text-sm text-red-700 mb-4">
                Once you cancel, you'll lose access to all premium features at the end of your billing period.
                Your data will be retained for 30 days before permanent deletion.
              </p>
              <Button 
                variant="destructive" 
                onClick={handleCancelSubscription}
                disabled={isLoading}
              >
                {isLoading ? 'Cancelling...' : 'Cancel Subscription'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}