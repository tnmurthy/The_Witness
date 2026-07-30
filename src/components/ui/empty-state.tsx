import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void } | { label: string; href: string };
}

/**
 * One empty-state treatment used everywhere a list/collection page has
 * nothing to show — previously each page (issues, wisdom, publications)
 * improvised its own `<Muted>No X yet</Muted>` line with no icon, no
 * consistent spacing, and no next-action affordance. This is what "empty
 * states" as its own named requirement actually means: not just
 * "doesn't crash on zero results," but a deliberate, recognizable UI
 * moment that tells the person what to do next.
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 px-6 py-16 text-center">
      <Icon className="h-10 w-10 text-neutral-300" strokeWidth={1.5} aria-hidden="true" />
      <p className="mt-4 text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action &&
        ("href" in action ? (
          <Button asChild variant="outline" size="sm" className="mt-5">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="mt-5" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
