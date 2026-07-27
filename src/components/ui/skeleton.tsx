import { cn } from "@/lib/utils";

/**
 * Skeleton — loading placeholder. Respects prefers-reduced-motion
 * globally (src/app/globals.css caps all animation-duration at 0.01ms
 * under that media query), so the pulse automatically becomes a static
 * placeholder for users who've asked for reduced motion, with no
 * component-level opt-out needed.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-neutral-200", className)} {...props} />;
}

export { Skeleton };
