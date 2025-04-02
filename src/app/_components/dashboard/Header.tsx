import React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
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
    <nav className="flex flex-col space-y-1 mt-2">
      {navigationLinks.map((link) => (
        <Button
          key={link.label}
          variant="ghost"
          className="justify-start w-full text-primary hover:bg-primary/5 hover:text-primary/90 px-4"
          onClick={() => (window.location.href = link.href)}
        >
          {link.label}
        </Button>
      ))}
    </nav>
  );
};

const UserMenu = () => {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  
  const userName = user?.firstName || "User";
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 w-9 rounded-full p-0 hover:bg-primary/5">
          <Avatar className="h-8 w-8 border border-gold/20 cursor-pointer">
            <AvatarImage src={user?.imageUrl || ""} alt={userName} />
            <AvatarFallback className="bg-primary/5 text-primary font-medium">{userName.charAt(0)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-card border border-border shadow-md" sideOffset={5}>
        <DropdownMenuLabel className="cursor-pointer font-normal bg-white dark:bg-card">
          <div className="flex flex-col space-y-1">
            <p className="font-medium text-primary">{userName}</p>
            <p className="text-xs text-muted-foreground">Enterprise Admin</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/50" />
        <DropdownMenuItem className="cursor-pointer focus:bg-primary/5 bg-white dark:bg-card hover:bg-muted" onClick={() => router.push('/profile')}>Profile</DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer focus:bg-primary/5 bg-white dark:bg-card hover:bg-muted" onClick={() => router.push('/settings')}>Settings</DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border/50" />
        <DropdownMenuItem 
          className="text-red-600 focus:bg-red-50 focus:text-red-600 cursor-pointer bg-white dark:bg-card hover:bg-red-50"
          onClick={() => signOut(() => router.push('/'))}
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const Header: React.FC<HeaderProps> = ({
  isSearchOpen,
  onSearchOpen,
  onSearchClose,
}) => {
  const { user } = useUser();
  const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}` : "User";


  return (
    <header className="h-16 border-b border-border/50 bg-white dark:bg-card px-4 md:px-6 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      {/* Mobile Navigation Trigger & Logo */}
      <div className="flex items-center gap-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden text-primary hover:bg-primary/5">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 border-r border-border/50">
            <div className="mb-4 mt-2 px-2">
              <Logo size="sm" />
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

      {/* Right Section: User Menu */}
      <div className="flex items-center gap-3">
        <div className="hidden md:block text-right mr-1">
          <p className="text-sm font-medium text-primary">{userName}</p>
          <p className="text-xs text-muted-foreground">USER ROLE WILL BE HERE FOR LATER</p>
        </div>
        <UserMenu />
      </div>
    </header>
  );
};