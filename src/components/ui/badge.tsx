import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge — Design System doc Section 7 "Badges (status & signal
 * indicators)". Color alone never carries meaning (Accessibility Section
 * 14) — every badge is always paired with a text label by the caller,
 * never rendered as a bare color dot.
 */
const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      neutral: "bg-secondary text-secondary-foreground",
      success: "bg-success-100 text-success-700",
      warning: "bg-warning-100 text-warning-700",
      danger: "bg-danger-100 text-danger-700",
      info: "bg-info-100 text-info-700",
      // Reserved for AI-generated content, matching Button's `signal`
      // variant and the platform-wide convention that gold marks
      // AI-originated or otherwise "signal" content.
      signal: "bg-gold-100 text-gold-900",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
