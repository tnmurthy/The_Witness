"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, ADMIN_NAV_ITEM, type NavItem } from "./nav-items";

/**
 * Sidebar navigation. Design System Section 12: navy-900 background
 * regardless of light/dark mode (the sidebar is a constant, not a themed
 * surface), active item marked with a 3px gold-500 left tick — the same
 * "signal" device used for AI-generated content and required form
 * fields elsewhere in the product.
 */
export function Sidebar({ showAdmin = false }: { showAdmin?: boolean }) {
  const pathname = usePathname();
  const items: NavItem[] = showAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  return (
    <aside
      className="hidden w-60 shrink-0 flex-col bg-navy-900 px-3 py-4 md:flex"
      aria-label="Main navigation"
    >
      <div className="mb-6 flex items-center gap-2 px-2 font-voice text-lg font-semibold text-white">
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
                "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-navy-300 transition-colors hover:bg-white/5 hover:text-white",
                isActive && "bg-white/[0.06] text-white"
              )}
            >
              {isActive && (
                <span
                  className="absolute -left-3 bottom-1.5 top-1.5 w-[3px] bg-gold-500"
                  aria-hidden="true"
                />
              )}
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
