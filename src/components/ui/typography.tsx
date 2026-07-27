import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Typography — Design System Section 3 type scale, as components rather
 * than memorized Tailwind class strings. H1/H2 use the editorial serif
 * (--font-voice) per the design system's rule that the serif is reserved
 * for headlines/hero moments, not general UI chrome; H3/H4 and body
 * copy use the UI sans. Using these instead of raw <h1 className="...">
 * everywhere means the heading hierarchy (h1 → h4) and the visual size
 * are set independently — a card titled with <H4> is still semantically
 * a level below the page's <H1>, even though visually it might be styled
 * larger or smaller depending on context.
 */

const H1 = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h1 ref={ref} className={cn("font-voice text-4xl font-semibold tracking-tight text-foreground", className)} {...props} />
));
H1.displayName = "H1";

const H2 = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn("font-voice text-3xl font-semibold tracking-tight text-foreground", className)} {...props} />
));
H2.displayName = "H2";

const H3 = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-2xl font-semibold text-foreground", className)} {...props} />
));
H3.displayName = "H3";

const H4 = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h4 ref={ref} className={cn("text-xl font-semibold text-foreground", className)} {...props} />
));
H4.displayName = "H4";

const Lead = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-lg text-muted-foreground", className)} {...props} />
));
Lead.displayName = "Lead";

const Text = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-base text-foreground", className)} {...props} />
));
Text.displayName = "Text";

const Muted = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
Muted.displayName = "Muted";

/** Small, uppercase, tracked label — the "eyebrow" pattern used above Signal Card / Wisdom card headlines throughout the product. */
const Eyebrow = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(({ className, ...props }, ref) => (
  <span ref={ref} className={cn("text-xs font-semibold uppercase tracking-wide text-gold-700", className)} {...props} />
));
Eyebrow.displayName = "Eyebrow";

const InlineCode = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ className, ...props }, ref) => (
  <code ref={ref} className={cn("rounded bg-surface-2 px-1.5 py-0.5 font-mono text-sm", className)} {...props} />
));
InlineCode.displayName = "InlineCode";

export { H1, H2, H3, H4, Lead, Text, Muted, Eyebrow, InlineCode };
