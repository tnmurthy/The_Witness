import { Search } from "lucide-react";
import { UserMenu } from "@/components/auth/user-menu";
import { MobileNav } from "./mobile-nav";

interface TopbarProps {
  email: string;
  fullName?: string | null;
  showAdmin?: boolean;
}

/**
 * Top bar — Design System Section 12: 56px fixed height, global search
 * trigger, user menu. The search trigger is a static affordance in
 * Milestone 1; it becomes a real ⌘K command palette in Milestone 8
 * (Search) per the Implementation Plan. The hamburger trigger (MobileNav)
 * only renders its icon below the md breakpoint — it's what replaces the
 * Sidebar once that's hidden (Design System Section 15, "Responsive
 * layouts").
 */
export function Topbar({ email, fullName, showAdmin = false }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-card px-4 sm:px-5">
      <div className="flex items-center gap-2">
        <MobileNav showAdmin={showAdmin} />
        <button
          type="button"
          className="hidden items-center gap-2 rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-muted-foreground hover:border-neutral-300 sm:flex sm:w-56"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Search…
          <kbd className="ml-auto font-mono text-xs text-muted-foreground">⌘K</kbd>
        </button>
        <button
          type="button"
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 text-muted-foreground hover:border-neutral-300 sm:hidden"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <UserMenu email={email} fullName={fullName} />
    </header>
  );
}
