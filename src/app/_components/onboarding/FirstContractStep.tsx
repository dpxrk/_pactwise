'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FilePlus2, SkipForward, CheckCircle } from 'lucide-react';
import ContractFormModal from '@/app/_components/contracts/ContractFormModal'; // Re-use the existing modal
import { Id } from '@/../convex/_generated/dataModel';
import { ONBOARDING_STEPS, OnboardingStep } from '@/../convex/onboarding';
import { useConvexMutation } from '@/lib/api-client';
import { api } from '@/../convex/_generated/api';

interface FirstContractStepProps {
  onStepComplete: (nextStep?: OnboardingStep, metadata?: any) => void;
  onSkip: (nextStep?: OnboardingStep) => void;
}

const FirstContractStep: React.FC<FirstContractStepProps> = ({ onStepComplete, onSkip }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const updateStepMutation = useConvexMutation(api.onboarding.updateOnboardingStep);

  const handleContractCreated = async (contractId: Id<"contracts">) => {
    setIsModalOpen(false);
    // Mark this step as completed in the backend
    await updateStepMutation.execute({ step: ONBOARDING_STEPS.FIRST_CONTRACT, completed: true, metadata: { firstContractId: contractId } });
    onStepComplete(ONBOARDING_STEPS.COMPLETE); // Proceed to the final onboarding step or dashboard
  };

  const handleSkip = async () => {
     await updateStepMutation.execute({ step: ONBOARDING_STEPS.FIRST_CONTRACT, completed: false, metadata: { skipped: true } });
    onSkip(ONBOARDING_STEPS.COMPLETE); // Skip to the final step
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-transparent p-4">
      <Card className="w-full max-w-lg shadow-xl text-center">
        <CardHeader>
          <FilePlus2 className="mx-auto h-12 w-12 text-gold mb-4" />
          <CardTitle className="text-2xl font-serif text-primary">Create Your First Contract</CardTitle>
          <CardDescription>
            Ready to dive in? Add your first contract to see PactWise in action.
            You can also skip this for now.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6">
          <p className="text-muted-foreground">
            Click the button below to open the contract creation form.
          </p>
          <Button size="lg" onClick={() => setIsModalOpen(true)}>
            <FilePlus2 className="mr-2 h-5 w-5" /> Add First Contract
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-3 pt-6">
          <Button variant="ghost" onClick={handleSkip} className="w-full sm:w-auto">
            <SkipForward className="mr-2 h-4 w-4" /> Skip This Step
          </Button>
        </CardFooter>
      </Card>

      {isModalOpen && (
        <ContractFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleContractCreated}
        />
      )}
    </div>
  );
};

export default FirstContractStep;