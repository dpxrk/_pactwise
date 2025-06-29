"use client";

import React, { useEffect, useState } from "react";
import { Menu, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Container } from "@/app/_components/common/Container";
import { useRouter } from "next/navigation";
import { useAuth, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

const navItems = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#contact", label: "Contact" },
];

export const NavigationPremium = () => {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`
        fixed top-0 z-50 w-full transition-all duration-300
        ${scrolled 
          ? "bg-black/80 backdrop-blur-xl border-b border-white/10" 
          : "bg-transparent"
        }
      `}
    >
      <Container>
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <a href="/" className="flex items-center gap-2 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-cyan-600 rounded-lg blur-lg opacity-60 group-hover:opacity-100 transition-opacity" />
                <div className="relative bg-black rounded-lg p-2">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
              </div>
              <span className="text-xl font-bold text-white">Pactwise</span>
            </a>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="relative px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors group"
              >
                {item.label}
                <span className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-teal-600 to-cyan-600 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              </a>
            ))}
          </div>

          {/* Desktop Auth */}
          <div className="hidden md:flex md:items-center md:gap-4">
            {isSignedIn ? (
              <>
                <Button
                  variant="ghost"
                  className="text-white hover:text-white hover:bg-white/10"
                  onClick={() => router.push("/dashboard")}
                >
                  Dashboard
                </Button>
                <div className="w-px h-6 bg-white/20" />
                <UserButton 
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "w-9 h-9 ring-2 ring-teal-500/50"
                    }
                  }}
                />
              </>
            ) : (
              <>
                <SignInButton
                  mode="modal"
                  forceRedirectUrl="/dashboard"
                  fallbackRedirectUrl="/dashboard"
                >
                  <Button 
                    variant="ghost" 
                    className="text-white hover:text-white hover:bg-white/10"
                  >
                    Sign In
                  </Button>
                </SignInButton>
                <SignUpButton
                  mode="modal"
                  forceRedirectUrl="/dashboard"
                  fallbackRedirectUrl="/dashboard"
                >
                  <Button className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-glow">
                    Get Started
                  </Button>
                </SignUpButton>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-white hover:bg-white/10"
                >
                  {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </Button>
              </SheetTrigger>
              <SheetContent 
                side="right" 
                className="w-full sm:w-[400px] bg-black/95 backdrop-blur-xl border-l border-white/10"
              >
                <div className="flex flex-col h-full">
                  {/* Mobile Logo */}
                  <div className="flex items-center gap-2 mb-8">
                    <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-lg p-2">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xl font-bold text-white">Pactwise</span>
                  </div>

                  {/* Mobile Nav Items */}
                  <nav className="flex flex-col gap-2">
                    {navItems.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-4 py-3 text-lg text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                      >
                        {item.label}
                      </a>
                    ))}
                  </nav>

                  {/* Mobile Auth */}
                  <div className="mt-auto pt-8 border-t border-white/10">
                    {isSignedIn ? (
                      <div className="flex flex-col gap-4">
                        <Button
                          variant="outline"
                          className="w-full border-white/20 text-white hover:bg-white/10"
                          onClick={() => {
                            router.push("/dashboard");
                            setMobileMenuOpen(false);
                          }}
                        >
                          Go to Dashboard
                        </Button>
                        <div className="flex items-center justify-center">
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
                          <Button
                            variant="outline"
                            className="w-full border-white/20 text-white hover:bg-white/10"
                          >
                            Sign In
                          </Button>
                        </SignInButton>
                        <SignUpButton
                          mode="modal"
                          forceRedirectUrl="/dashboard"
                          fallbackRedirectUrl="/dashboard"
                        >
                          <Button className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white">
                            Get Started Free
                          </Button>
                        </SignUpButton>
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </Container>
    </nav>
  );
};