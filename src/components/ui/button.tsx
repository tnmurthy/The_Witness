import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button — shadcn/ui pattern, with one addition beyond the shadcn default
 * variant set: `signal`. Per the Design System document (Section 7),
 * signal is reserved for AI-initiated actions (Generate Issue, Regenerate
 * block) and uses gold-700 rather than gold-600 for the fill, since
 * gold-600 fails WCAG contrast for white text at button-fill sizes — see
 * Design System Section 2.5 for the measured contrast ratios.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:shadow-focus-gold disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-brand-primary-hover",
        destructive: "bg-destructive text-destructive-foreground hover:bg-danger-700",
        outline: "border border-neutral-300 bg-transparent hover:bg-secondary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-neutral-100",
        ghost: "hover:bg-secondary",
        link: "text-navy-700 underline-offset-4 hover:underline h-auto p-0",
        signal: "bg-gold-700 text-white hover:bg-gold-800",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-md px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
