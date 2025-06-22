// src/app/_components/onboarding/CreateEnterpriseStep.tsx
'use client';

import React, { useState } from 'react';
import { useConvexMutation } from '@/lib/api-client';
import { api } from '@/../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Building, Loader2 } from 'lucide-react';

interface CreateEnterpriseStepProps {
  onStepComplete: () => void; // Callback to advance to the next onboarding step
}

const CreateEnterpriseStep: React.FC<CreateEnterpriseStepProps> = ({ onStepComplete }) => {
  const [enterpriseName, setEnterpriseName] = useState('');
  const [domain, setDomain] = useState(''); // Optional domain
  const [error, setError] = useState<string | null>(null);
  
  const createEnterpriseMutation = useConvexMutation(api.enterprises.createEnterpriseWithOwner);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!enterpriseName.trim()) {
      setError("Enterprise name is required.");
      return;
    }

    try {
      const args: any = { 
        enterpriseName: enterpriseName.trim(),
      };
      
      if (domain.trim()) {
        args.domain = domain.trim();
      }
      
      await createEnterpriseMutation.execute(args);
      onStepComplete(); // Advance to the next step in the onboarding flow
    } catch (err: any) {
      setError(err.message || 'Failed to create enterprise.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-transparent p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <Building className="mx-auto h-12 w-12 text-gold mb-4" />
          <CardTitle className="text-2xl font-sans text-primary">Create Your Enterprise</CardTitle>
          <CardDescription>Let's set up your company's workspace in PactWise.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="enterpriseName">Enterprise Name <span className="text-destructive">*</span></Label>
              <Input
                id="enterpriseName"
                value={enterpriseName}
                onChange={(e) => setEnterpriseName(e.target.value)}
                placeholder="e.g., Acme Corporation"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">Company Domain (Optional)</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g., acme.com"
              />
              <p className="text-xs text-muted-foreground">
                If provided, users with this email domain might be able to join automatically.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={createEnterpriseMutation.isLoading}>
              {createEnterpriseMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Enterprise
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default CreateEnterpriseStep;