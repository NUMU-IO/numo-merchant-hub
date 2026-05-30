import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/* Souq badge — pill, font-bold tabular-friendly. New `accent` variant
   for saffron count badges (the brand's signature saffron-on-navy
   pairing), plus soft tinted `success` / `warning` / `info` for
   status pills at ~14% bg saturation. */
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
        accent: "border-transparent bg-saffron text-navy-900 hover:bg-saffron-600",
        secondary: "border-transparent bg-muted text-foreground hover:bg-surface-3",
        destructive: "border-transparent bg-destructive/15 text-destructive",
        success: "border-transparent bg-success/15 text-success",
        warning: "border-transparent bg-warning/15 text-warning",
        outline: "text-foreground border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
