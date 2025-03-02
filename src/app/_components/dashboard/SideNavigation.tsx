'use client'

import React, { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Home,
  Files,
  Building2,
  BarChart3,
  Settings,
  FileText,
  FileSignature,
  Clock,
  ChevronDown,
  Users,
} from "lucide-react";
import { useDashboardStore } from "@/stores/dashboard-store"
import type { NavSection } from "@/types/homedashboard.types"

const NavItem = React.memo(
  ({
    item,
    isActive,
    isExpanded,
    onExpand,
    onClick,
  }: {
    item: NavSection["items"][0];
    isActive: boolean;
    isExpanded: boolean;
    onExpand: () => void;
    onClick: (href: string, label: string) => void;
  }) => {
    const { setSelectedType } = useDashboardStore();
    

    const handleClick = useCallback(() => {
      if (item.subItems) {
        onExpand();
      } else {
        setSelectedType(item.label);
        onClick(item.href, item.label);
      }
    }, [item, onExpand, onClick, setSelectedType]);

    return (
      <div className="space-y-1">
        <Button
          variant={isActive ? "secondary" : "ghost"}
          className={cn("w-full justify-start", isActive && "bg-muted")}
          onClick={handleClick}
        >
          <item.icon className="mr-2 h-4 w-4 text-gold" />
          <span className="flex-1 text-left">{item.label}</span>
          {item.subItems && (
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                isExpanded && "rotate-180"
              )}
            />
          )}
        </Button>

        {isExpanded && item.subItems && (
          <div className="ml-6 space-y-1">
            {item.subItems.map((subItem) => (
              <Button
                key={subItem.href}
                variant="ghost"
                className={cn(
                  "w-full justify-start h-9",
                  location.pathname === subItem.href && "bg-muted" // This line changes
                )}
                onClick={() => onClick(subItem.href, subItem.label)}
              >
                <subItem.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{subItem.label}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }
);

export const SideNavigation = ({ className }: { className?: string }) => {
 
  const router = useRouter();

  const { expandedItems, setExpandedItems, setSelectedType } =
    useDashboardStore();

  const navigationSections: NavSection[] = [
    {
      items: [
        {
          label: "Dashboard",
          href: "/home",
          icon: Home,
        },
      ],
    },
    {
      label: "Contract Management",
      items: [
        {
          label: "Contracts",
          icon: Files,
          href: "/contracts",
          subItems: [
            {
              label: "All Contracts",
              href: "/contracts",
              icon: FileText,
            },
            {
              label: "Pending Signature",
              href: "/contracts/pending",
              icon: FileSignature,
            },
            {
              label: "Drafts",
              href: "/contracts/drafts",
              icon: Clock,
            },
            {
              label: "Expired",
              href: "/contracts/expired",
              icon: Clock,
            },
            {
              label: "Archived",
              href: "/contracts/archived",
              icon: Clock,
            },
          ],
        },
        {
          label: "Vendors",
          href: "/vendors",
          icon: Building2,
          subItems: [
            {
              label: "All Vendors",
              href: "/vendors",
              icon: Building2,
            },
            {
              label: "Active Vendors",
              href: "/vendors/active",
              icon: Users,
            },
            {
              label: "Inactive Vendors",
              href: "/vendors/inactive",
              icon: Users,
            },
          ],
        },
      ],
    },
    {
      label: "Analytics & Settings",
      items: [
        {
          label: "Analytics",
          href: "/analytics",
          icon: BarChart3,
        },
        {
          label: "Settings",
          href: "/settings",
          icon: Settings,
        },
      ],
    },
  ];

  const toggleExpanded = useCallback(
    (label: string) => {
      setExpandedItems((prev: string[]) =>
        prev.includes(label)
          ? prev.filter((item: string) => item !== label)
          : [...prev, label]
      );
    },
    [setExpandedItems]
  );

  const handleNavigate = useCallback(
    (href: string, label: string) => {
      router.push(href);
      setSelectedType(label);
    },
    [ setSelectedType]
  );

  const isItemActive = useCallback(
    (href: string, subItems?: NavSection["items"][0]["subItems"]) => {
      // If this item has subitems and matches the base path
      if (subItems && location.pathname.startsWith(href)) {
        // Check if we're on the exact base path
        if (location.pathname === href) {
          return true;
        }
        // Check if any subitem paths match
        return subItems.some((subItem: { href: string }) =>
          location.pathname.startsWith(subItem.href)
        );
      }
      // Regular path matching for items without subitems
      return (
        location.pathname === href || location.pathname.startsWith(`${href}/`)
      );
    },
    [location]
  );

  return (
    <aside className={cn("flex flex-col border-r bg-card", className)}>
      <div className="p-6">
        <h2 className="text-2xl font-serif font-bold text-primary">PactWise</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4">
          {navigationSections.map((section, idx) => (
            <div key={idx}>
              {section.label && (
                <>
                  <div className="flex items-center px-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {section.label}
                    </span>
                    <Separator className="ml-2 flex-1" />
                  </div>
                  <div className="mt-2" />
                </>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavItem
                    key={item.href}
                    item={item}
                    isActive={isItemActive(item.href, item.subItems)}
                    isExpanded={expandedItems.includes(item.label)}
                    onExpand={() => toggleExpanded(item.label)}
                    onClick={handleNavigate}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
};

export default SideNavigation;
