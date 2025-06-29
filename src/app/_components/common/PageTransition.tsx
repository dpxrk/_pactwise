"use client";

import React, { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const PageTransition = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    // Simulate loading progress
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(() => setIsLoading(false), 500);
          return 100;
        }
        return prev + Math.random() * 30;
      });
    }, 200);

    return () => clearInterval(progressInterval);
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center transition-opacity duration-500"
         style={{ opacity: isLoading ? 1 : 0, pointerEvents: isLoading ? 'auto' : 'none' }}>
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-purple-900/20 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-pink-900/20 to-transparent rounded-full blur-3xl animate-pulse animation-delay-1000" />
      </div>

      <div className="relative text-center">
        {/* Logo */}
        <div className="mb-8 animate-fade-in">
          <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 animate-float">
            <Sparkles className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* Loading text */}
        <h2 className="text-2xl font-bold text-white mb-8 animate-fade-in animation-delay-200">
          Preparing your experience...
        </h2>

        {/* Progress bar */}
        <div className="w-64 mx-auto animate-fade-in animation-delay-400">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            >
              <div className="h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
          
          {/* Progress percentage */}
          <p className="mt-4 text-sm text-gray-400">
            {Math.round(loadingProgress)}%
          </p>
        </div>

        {/* Loading tips */}
        <div className="mt-12 animate-fade-in animation-delay-600">
          <p className="text-sm text-gray-500">
            Did you know? Pactwise analyzes contracts 90% faster than manual review.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PageTransition;