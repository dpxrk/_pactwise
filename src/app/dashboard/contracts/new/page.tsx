'use client';

import React from 'react';
import { ContractForm } from '@/app/_components/contracts/ContractForm';

const NewContractPage = () => {
  return (
    <div className="container mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Create New Contract</h1>
        <p className="text-muted-foreground mt-1">
          Fill out the form below to create a new contract.
        </p>
      </div>

      <ContractForm />
    </div>
  );
};

export default NewContractPage;