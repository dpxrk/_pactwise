'use client';

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import ContractFormModal from './ContractFormModal';
import { Id } from '../../../../convex/_generated/dataModel';

interface NewContractButtonProps {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  buttonText?: string;
  showIcon?: boolean;
  onContractCreated?: (contractId: Id<"contracts">) => void;
  className?:string
}

export const NewContractButton: React.FC<NewContractButtonProps> = ({
  variant = 'default',
  size = 'default',
  buttonText = 'New Contract',
  showIcon = true,
  onContractCreated,
  className,
  ...props
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSuccess = (contractId: Id<"contracts">) => {
    if (onContractCreated) {
      onContractCreated(contractId);
    }
    setIsModalOpen(false);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsModalOpen(true)}
        className={className}
        {...props}
      >
        {showIcon && <PlusCircle className="mr-2 h-4 w-4" />}
        {buttonText}
      </Button>

      <ContractFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
};

export default NewContractButton;