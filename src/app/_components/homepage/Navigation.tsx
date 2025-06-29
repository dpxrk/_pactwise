
"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Container } from "@/app/_components/common/Container";
import { Logo } from "@/app/_components/common/Logo";
import { useRouter } from "next/navigation";
import { useAuth, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

const navItems = [
  { href: "#contact", label: "Contact" },
];

export const Navigation = () => {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-emerald-900/30 bg-[#0d1f1f]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0d1f1f]/60">
      <Container>
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Logo size="md" />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-6">
            {navItems.map((item) => (    
              <a
              key={item.href}          
                href={item.href}
                className="text-sm font-medium text-gray-300 hover:text-emerald-400 transition-colors"
              >
                {item.label}
              </a>
            ))}
            
            {isSignedIn ? (
              <div className="flex items-center space-x-4">
                <Button 
                  variant="outline"
                  className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-400" 
                  onClick={() => router.push('/dashboard')}
                >
                  Dashboard
                </Button>
                <UserButton afterSignOutUrl="/" />
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <SignInButton 
                  mode="modal"
                  forceRedirectUrl="/dashboard"
                  fallbackRedirectUrl="/dashboard"
                >
                  <Button variant="outline" className="border-emerald-500/50 text-white hover:bg-emerald-500/10 hover:border-emerald-400">
                    Sign In
                  </Button>
                </SignInButton>
                <SignUpButton 
                  mode="modal"
                  forceRedirectUrl="/dashboard"
                  fallbackRedirectUrl="/dashboard"
                >
                  <Button variant="outline" className="border-emerald-500/50 text-white hover:bg-emerald-500/10 hover:border-emerald-400 w-half">
                    Sign Up
                  </Button>
                </SignUpButton>
              </div>
            )}
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <nav className="flex flex-col gap-4 mt-8">
                  {navItems.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                    >
                      {item.label}
                    </a>
                  ))}
                  
                  <div className="border-t border-gold/10 my-4 pt-4">
                    {isSignedIn ? (
                      <div className="flex flex-col gap-4">
                        <Button 
                          variant="outline"
                          className="border-gold/50 text-primary hover:bg-gold/5 w-full" 
                          onClick={() => router.push('/dashboard')}
                        >
                          Dashboard
                        </Button>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Your Account</span>
                          <UserButton afterSignOutUrl="/" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <SignInButton 
                          mode="modal"
                          forceRedirectUrl="/dashboard"
                          fallbackRedirectUrl="/dashboard"
                        >
                          <Button variant="outline" className="border-emerald-500/50 text-white hover:bg-emerald-500/10 hover:border-emerald-400 w-full">
                            Sign In
                          </Button>
                        </SignInButton>
                        <SignUpButton 
                          mode="modal"
                          forceRedirectUrl="/dashboard"
                          fallbackRedirectUrl="/dashboard"
                        >
                          <Button variant="outline" className="border-emerald-500/50 text-white hover:bg-emerald-500/10 hover:border-emerald-400 w-full">
                            Sign Up
                          </Button>
                        </SignUpButton>
                      </div>
                    )}
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </Container>
    </nav>
  );
};