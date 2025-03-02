import React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/app/_components/common/Logo"

interface HeaderProps {
  isSearchOpen: boolean;
  onSearchOpen: () => void;
  onSearchClose: () => void;
  enterpriseName?: string;
  userName?: string;
}

const MobileNavigation = () => {
  const navigationLinks = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Contracts", href: "/contracts" },
    { label: "Vendors", href: "/vendors" },
    { label: "Analytics", href: "/analytics" },
    { label: "Settings", href: "/settings" },
  ];

  return (
    <nav className="flex flex-col space-y-2">
      {navigationLinks.map((link) => (
        <Button
          key={link.label}
          variant="ghost"
          className="justify-start w-full"
          onClick={() => (window.location.href = link.href)}
        >
          {link.label}
        </Button>
      ))}
    </nav>
  );
};

const UserMenu = ({ userName = "User" }: { userName?: string }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src="" alt={userName} />
            <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-600">Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const Header: React.FC<HeaderProps> = ({
  isSearchOpen,
  onSearchOpen,
  onSearchClose,
  enterpriseName = "PactWise",
  userName = "Danny Park",
}) => {
  return (
    <header className="h-16 border-b bg-card px-6 flex items-center justify-between">
      {/* Mobile Navigation Trigger */}
      <div className="flex items-center gap-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <div className="mb-6 mt-2">
              <h2 className="text-xl font-semibold">Menu</h2>
            </div>
            <MobileNavigation />
          </SheetContent>
        </Sheet>

        {/* Enterprise Logo/Name for Desktop */}
        <div className="hidden md:block">
          <Logo size="md" />
        </div>
      </div>

      {/* Global Search */}
      <div className="flex-1 max-w-2xl mx-4">
        <GlobalSearch
          isOpen={isSearchOpen}
          onOpen={onSearchOpen}
          onClose={onSearchClose}
        />
      </div>

      {/* Right Section: Enterprise Info & User Menu */}
      <div className="flex items-center gap-4">
        <div className="hidden md:block text-right">
          <p className="text-sm font-medium text-muted-foreground">
            {enterpriseName}
          </p>
        </div>
        <UserMenu userName={userName} />
      </div>
    </header>
  );
};
