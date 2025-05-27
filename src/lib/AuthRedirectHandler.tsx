'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

const AuthRedirectHandler = () => {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect once auth is loaded and user is signed in
    if (isLoaded && isSignedIn) {
      console.log('User is authenticated, redirecting to dashboard...');
      router.push('/dashboard');
    }
  }, [isLoaded, isSignedIn, router]);

  // This component doesn't render anything
  return null;
};

export default AuthRedirectHandler;