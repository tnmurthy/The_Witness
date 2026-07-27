import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Standard shadcn/ui utility: merges conditional class names (clsx) and
 * resolves conflicting Tailwind utility classes in favor of the last one
 * (tailwind-merge) — e.g. cn("p-2", condition && "p-4") correctly yields
 * just "p-4" instead of an invalid "p-2 p-4".
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
