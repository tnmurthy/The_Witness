import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Container — Design System Section 4 grid system. Two deliberately
 * different max-widths: "app" is the general dashboard/page container;
 * "reading" is the 720px long-form measure reserved for issue/article
 * body copy (design-tokens.css --container-reading), never used for
 * general UI chrome — mixing the two would make every dashboard page as
 * narrow as an article, which is wrong for a data-dense app screen.
 */
interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "app" | "reading";
}

const Container = React.forwardRef<HTMLDivElement, ContainerProps>(({ className, variant = "app", ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mx-auto w-full px-4 sm:px-6", variant === "app" ? "max-w-7xl" : "max-w-reading", className)}
    {...props}
  />
));
Container.displayName = "Container";

/**
 * Grid — thin wrapper over the 12-column responsive grid (Design System
 * Section 4). `cols` sets the column count per breakpoint; omitted
 * breakpoints inherit the previous one, same as Tailwind's own mobile-
 * first convention. This exists mainly as living documentation of the
 * grid system's breakpoints — reaching for raw `grid grid-cols-…`
 * classes directly is equally correct and arguably more common in this
 * codebase; both compile to the same output.
 */
interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: { base?: number; md?: number; xl?: number };
}

const COLS_BASE: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 12: "grid-cols-12" };
const COLS_MD: Record<number, string> = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 12: "md:grid-cols-12" };
const COLS_XL: Record<number, string> = { 1: "xl:grid-cols-1", 2: "xl:grid-cols-2", 3: "xl:grid-cols-3", 4: "xl:grid-cols-4", 12: "xl:grid-cols-12" };

const Grid = React.forwardRef<HTMLDivElement, GridProps>(({ className, cols = { base: 1, md: 2, xl: 4 }, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "grid gap-4",
      cols.base && COLS_BASE[cols.base],
      cols.md && COLS_MD[cols.md],
      cols.xl && COLS_XL[cols.xl],
      className
    )}
    {...props}
  />
));
Grid.displayName = "Grid";

export { Container, Grid };
