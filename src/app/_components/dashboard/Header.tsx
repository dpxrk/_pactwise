import React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Bell, Search } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { Logo } from "@/app/_components/common/Logo";
import { useConvexQuery } from "@/lib/api-client";
import { api } from "../../../../convex/_generated/api";
import { SideNavigation } from "./SideNavigation";

interface HeaderProps {
  isSearchOpen: boolean;
  onSearchOpen: () => void;
  onSearchClose: () => void;
}

const UserMenu = () => {
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  
  // Get user context from Convex to get role and enterprise info
  const { data: userContext, isLoading } = useConvexQuery(
    api.users.getUserContext,
    {}
  );
  
  const userName = clerkUser?.firstName 
    ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim()
    : clerkUser?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || "User";
  
  const displayName = userContext?.user?.firstName 
    ? `${userContext.user.firstName} ${userContext.user.lastName || ''}`.trim()
    : userName;
  
  // Format role for display
  const formatRole = (role: string) => {
    const roleMap: Record<string, string> = {
      'owner': 'Enterprise Owner',
      'admin': 'Administrator', 
      'manager': 'Manager',
      'user': 'User',
      'viewer': 'Viewer'
    };
    return roleMap[role] || role.charAt(0).toUpperCase() + role.slice(1);
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 w-9 rounded-full p-0 hover:bg-accent/50 hover:scale-105 transition-all duration-200 ease-out">
          <Avatar className="h-8 w-8 border border-border/30 cursor-pointer shadow-sm">
            <AvatarImage src={clerkUser?.imageUrl || ""} alt={displayName} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 !bg-white border border-gray-200 shadow-lg" sideOffset={8}>
        <DropdownMenuLabel className="font-normal p-4 !bg-white">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-gray-200">
                <AvatarImage src={clerkUser?.imageUrl || ""} alt={displayName} />
                <AvatarFallback className="bg-blue-50 text-blue-600 font-medium text-sm">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{displayName}</p>
                <p className="text-xs text-gray-500 truncate">
                  {userContext?.user?.email || clerkUser?.emailAddresses?.[0]?.emailAddress}
                </p>
              </div>
            </div>
            <div className="flex flex-col space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Role</span>
                <span className="text-xs font-semibold text-gray-900">
                  {isLoading ? "Loading..." : formatRole(userContext?.user?.role || 'user')}
                </span>
              </div>
              {userContext?.enterprise && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Enterprise</span>
                  <span className="text-xs font-semibold text-gray-900 text-right" title={userContext.enterprise.name}>
                    {userContext.enterprise.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="cursor-pointer !bg-white hover:!bg-gray-50 focus:!bg-gray-50 text-gray-900" 
          onClick={() => router.push('/dashboard/profile')}
        >
          Profile Settings
        </DropdownMenuItem>
        <DropdownMenuItem 
          className="cursor-pointer !bg-white hover:!bg-gray-50 focus:!bg-gray-50 text-gray-900" 
          onClick={() => router.push('/dashboard/settings')}
        >
          Enterprise Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator className="!bg-gray-200" />
        <DropdownMenuItem 
          className="text-red-600 focus:text-red-600 cursor-pointer !bg-white hover:!bg-red-50 focus:!bg-red-50"
          onClick={() => signOut(() => router.push('/'))}
        >
          Sign Out
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
  const { user: clerkUser } = useUser();
  const { data: userContext, isLoading } = useConvexQuery(
    api.users.getUserContext,
    {}
  );

  const userName = clerkUser?.firstName 
    ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim()
    : clerkUser?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || "User";

  const displayName = userContext?.user?.firstName 
    ? `${userContext.user.firstName} ${userContext.user.lastName || ''}`.trim()
    : userName;

  // Format role for display
  const formatRole = (role: string) => {
    const roleMap: Record<string, string> = {
      'owner': 'Enterprise Owner',
      'admin': 'Administrator', 
      'manager': 'Manager',
      'user': 'User',
      'viewer': 'Viewer'
    };
    return roleMap[role] || role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <header className="h-16 border-b border-border/50 bg-background/95 backdrop-blur-sm px-4 md:px-6 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      {/* Mobile Navigation Trigger - Only show on mobile when left nav is hidden */}
      <div className="flex items-center gap-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden hover:bg-accent/50 hover:scale-105 transition-all duration-200 ease-out">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 border-r border-border/50">
            <div className="h-full">
              <div className="p-4 border-b border-border/50">
                <Logo size="sm" />
              </div>
              <SideNavigation className="h-[calc(100vh-5rem)]" />
            </div>
          </SheetContent>
        </Sheet>

        {/* Breadcrumb or Page Title - Only show on larger screens */}
        <div className="hidden lg:block">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {userContext?.enterprise && (
              <>
                <span className="font-medium text-foreground">{userContext.enterprise.name}</span>
                <span>/</span>
              </>
            )}
            <span>Dashboard</span>
          </div>
        </div>
      </div>

      {/* Global Search */}
      <div className="flex-1 max-w-xl mx-4">
        <GlobalSearch
          isOpen={isSearchOpen}
          onOpen={onSearchOpen}
          onClose={onSearchClose}
        />
      </div>

      {/* Right Section: Notifications & User Menu */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 hover:bg-accent/50 hover:scale-105 transition-all duration-200 ease-out relative"
        >
          <Bell className="h-4 w-4" />
          {/* Notification dot - can be conditionally shown */}
          <div className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full"></div>
        </Button>

        {/* User Info - Show on larger screens */}
        <div className="hidden xl:flex items-center gap-3 mr-2">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground leading-tight">{displayName}</p>
            <p className="text-xs text-muted-foreground leading-tight">
              {isLoading ? "Loading..." : formatRole(userContext?.user?.role || 'user')}
            </p>
          </div>
        </div>

        {/* User Menu */}
        <UserMenu />
      </div>
    </header>
  );
};