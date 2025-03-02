'use client'

import React, { useState } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/app/_components/common/LoadingSpinner"
import { Eye, EyeOff, Shield, Lock, Mail } from "lucide-react";
import { login, logAuthFailure, setAuthData } from "@/lib/auths"
import { validatePassword } from "@/lib/validations";
import { Logo } from "@/app/_components/common/Logo"

const AuthPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignIn, setIsSignIn] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Basic validation
      if (!email.includes("@")) {
        throw new Error("Please enter a valid email address");
      }

      const passwordError = validatePassword(password);
      if (passwordError) {
        throw new Error(passwordError);
      }

      const response = await login({
        email,
        password,
        user_agent: navigator.userAgent,
      });

      // Store authentication data
      setAuthData(response);

      // Redirect based on user role
      router.push(response.is_superuser ? "/admin/dashboard" : "/dashboard");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);

      // Log authentication failure
      await logAuthFailure({
        email,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left Panel - Brand Section */}
      <div className="md:w-1/2 bg-gradient-to-br from-primary to-primary/80 text-white p-8 md:p-12 flex flex-col">
        <div className="mb-8">
          <Logo size="lg" />
        </div>
        
        <div className="mt-auto mb-auto flex flex-col items-start max-w-md">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold mb-6">
            Streamline Your<br />
            <span className="text-gold">Contract Management</span>
          </h1>
          
          <p className="text-black/80 text-lg mb-8">
            Securely access your dashboard to manage contracts, track approvals, and collaborate with your team.
          </p>
          
          <div className="space-y-4 mt-4">
            <div className="flex items-center">
              <div className="bg-white/10 p-2 rounded-full mr-3">
                <Shield className="h-5 w-5 text-gold" />
              </div>
              <p className="text-black/90">Enterprise-grade security protocols</p>
            </div>
            <div className="flex items-center">
              <div className="bg-white/10 p-2 rounded-full mr-3">
                <Lock className="h-5 w-5 text-gold" />
              </div>
              <p className="text-black/90">Multi-factor authentication available</p>
            </div>
          </div>
        </div>
        
        <div className="mt-auto">
          <p className="text-black/80 text-sm">
            © {new Date().getFullYear()} PactWise. All rights reserved.
          </p>
        </div>
      </div>
      
      {/* Right Panel - Auth Form */}
      <div className="md:w-1/2 bg-background flex flex-col justify-center p-6 md:p-12 lg:p-16">
        <Card className="border-gold/10 bg-white/80 backdrop-blur-sm shadow-elegant w-full max-w-md mx-auto">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-3xl font-bold tracking-tight text-primary font-serif">
              {isSignIn ? "Welcome Back" : "Create Account"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {isSignIn
                ? "Sign in to access your secure dashboard"
                : "Fill in your details to create a new account"}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="border border-destructive/20 bg-destructive/10">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="pl-10 border-gold/20 focus:border-gold/50"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="pl-10 pr-10 border-gold/20 focus:border-gold/50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="remember" className="rounded border-gold/20" />
                  <label htmlFor="remember" className="text-sm text-muted-foreground">Remember me</label>
                </div>
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-sm text-gold hover:text-gold-dark"
                >
                  Forgot password?
                </Button>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button 
                variant='outline'
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-black cursor-pointer" 
                disabled={isLoading}
              >
                {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                {isSignIn ? "Sign in" : "Create account"}
              </Button>

              <div className="relative my-2 w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gold/10"></span>
                </div>               
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSignIn(!isSignIn)}
                disabled={isLoading}
                className="w-full border-gold/20 hover:bg-gold/5 text-primary"
              >
                {isSignIn
                  ? "Create new account"
                  : "Sign in with existing account"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;