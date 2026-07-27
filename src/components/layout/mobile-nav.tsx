"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, ADMIN_NAV_ITEM, type NavItem } from "./nav-items";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

/**
 * Mobile navigation — the Sidebar (sidebar.tsx) is `hidden` below the md
 * breakpoint with nothing standing in for it; this component is that
 * replacement; a hamburger trigger in the Topbar opens the same nav item
 * list in a Sheet drawer. Closes itself on navigation (the `open` state
 * resets when pathname changes) so a tapped link doesn't leave the drawer
 * covering the page it just navigated to.
 */
export function MobileNav({ showAdmin = false }: { showAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const items: NavItem[] = showAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-navy-900 p-0 text-white">
        <VisuallyHidden>
          <SheetTitle>Navigation</SheetTitle>
        </VisuallyHidden>
        <div className="flex flex-col px-3 py-4">
          <div className="mb-6 flex items-center gap-2 px-2 font-voice text-lg font-semibold">
            <span className="h-4 w-1 bg-gold-500" aria-hidden="true" />
            The Witness
          </div>
          <nav className="flex flex-col gap-0.5">
            {items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm text-navy-300 transition-colors hover:bg-white/5 hover:text-white",
                    isActive && "bg-white/[0.06] text-white"
                  )}
                >
                  {isActive && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] bg-gold-500" aria-hidden="true" />}
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
