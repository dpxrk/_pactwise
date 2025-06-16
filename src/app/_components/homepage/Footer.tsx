import React from "react";
import {
  Mail,
  Phone,
  MapPin,
  Github,
  Twitter,
  Linkedin,
  ChevronRight,
  Globe,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Footer = () => {
  const currentYear = new Date().getFullYear();
  // const [email, setEmail] = React.useState("");
  // const [subscriptionStatus, setSubscriptionStatus] = React.useState("");

  // const handleSubscribe = (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setSubscriptionStatus("Thank you for subscribing!");
  //   setEmail("");
  // };

  return (
    <footer className="bg-background border-t">
      <div className="container px-4 py-8 mx-auto">
        {/* Newsletter Section */}
        <div className="mb-8 pb-8 border-b">
          {/* <div className="max-w-xl mx-auto text-center">
            <h3 className="text-xl font-semibold mb-3">Stay Updated</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Subscribe to our newsletter for the latest updates on contract
              management.
            </p>
            <form
              onSubmit={handleSubscribe}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <Input
                type="email"
                placeholder="Enter your email"
                className="max-w-xs"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" size="sm">
                Subscribe
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
            {subscriptionStatus && (
              <Alert className="mt-3 max-w-sm mx-auto">
                <AlertDescription>{subscriptionStatus}</AlertDescription>
              </Alert>
            )}
          </div> */}
        </div>

        {/* Main Categories */}
        <div className="grid grid-cols-3 gap-8 mb-6 text-center">
          <div>
            <h3 className="text-sm font-semibold">Solutions</h3>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Resources</h3>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Contact</h3>
          </div>
        </div>

    
        <div className="grid grid-cols-3 gap-8 mb-8">
        
          <div className="flex justify-center">
            <ul className="space-y-1.5 text-center">
              <li>
                <a
                  // href="#"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Contract Management
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Document Analytics
                </a>
              </li>
              <li>
                <a
                  // href="#"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  E-Signature Platform
                </a>
              </li>
              <li>
                <a
                  // href="#"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Template Library
                </a>
              </li>
            </ul>
          </div>

          {/* Resources Subcategories */}
          <div className="flex justify-center">
            <ul className="space-y-1.5 text-center">
              <li>
                <a
                  href="#"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Documentation
                </a>
              </li>
             
              {/* <li>
                <a
                  href="#"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Customer Stories
                </a>
              </li> */}
              <li>
                <a
                  href="#"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Support Center
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Information */}
          <div className="flex justify-center">
            <ul className="space-y-1.5 text-center">
              <li className="flex items-center justify-center space-x-2">
                <Mail className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  danielpark0503@gmail.com
                </span>
              </li>
              <li className="flex items-center justify-center space-x-2">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  +1 (908) 239 4019
                </span>
              </li>
              <li className="flex items-center justify-center space-x-2">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  New York
                </span>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Company Info and Social */}
        {/* <div className="flex flex-col items-center mb-6 space-y-4">
          <div className="text-center">
            <h3 className="text-sm font-semibold mb-2">ContractFlow</h3>
            <p className="text-xs text-muted-foreground mb-3 max-w-md">
              Enterprise-grade contract management platform with advanced
              analytics and secure collaboration.
            </p>
          </div>
          <div className="flex space-x-4">
            <a
              href="#"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <Github className="h-4 w-4" />
            </a>
            <a
              href="#"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <Twitter className="h-4 w-4" />
            </a>
            <a
              href="#"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <Linkedin className="h-4 w-4" />
            </a>
          </div>
        </div> */}

        {/* Footer Bottom */}
        <div className="flex flex-col-reverse md:flex-row md:justify-between items-center space-y-4 md:space-y-0 text-xs text-muted-foreground">
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <span>© {currentYear} PactWise</span>
            <Separator orientation="vertical" className="h-3" />
            <div className="flex items-center space-x-1">
              <Globe className="h-3 w-3" />
              <select className="bg-transparent border-none cursor-pointer hover:text-primary transition-colors focus:outline-none text-xs">
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="#" className="hover:text-primary transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
