import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva("relative w-full rounded-lg border p-4 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7", {
  variants: {
    variant: {
      info: "border-info-600/25 bg-info-100 text-info-700",
      success: "border-success-600/25 bg-success-100 text-success-700",
      warning: "border-warning-600/25 bg-warning-100 text-warning-700",
      danger: "border-danger-600/25 bg-danger-100 text-danger-700",
    },
  },
  defaultVariants: { variant: "info" },
});

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: AlertCircle,
} as const;

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

/**
 * Alert — non-dismissible, in-flow status messaging (form-level errors,
 * empty states with a call to action, informational banners). For
 * transient, dismissible feedback after an action, use the Sonner toast
 * (src/components/ui/sonner.tsx) instead — Alert and toast are
 * deliberately not the same component, since they solve different
 * problems (persistent context vs. a fire-and-forget notification).
 *
 * role="alert" on the danger/warning variants makes screen readers
 * announce the content immediately when it mounts (Accessibility Section
 * 14, "live regions"); info/success use role="status" since they're not
 * urgent enough to interrupt.
 */
const Alert = React.forwardRef<HTMLDivElement, AlertProps>(({ className, variant = "info", children, ...props }, ref) => {
  const Icon = ICONS[variant ?? "info"];
  const isUrgent = variant === "warning" || variant === "danger";

  return (
    <div
      ref={ref}
      role={isUrgent ? "alert" : "status"}
      aria-live={isUrgent ? "assertive" : "polite"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </div>
  );
});
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 font-medium leading-none", className)} {...props} />
  )
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
