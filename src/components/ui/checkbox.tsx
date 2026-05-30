import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  /* Souq checkbox — 22×22 chunky tile (matches NHUB order-row select),
     1.5px hairline, navy fill when checked, 4px navy focus glow. */
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-[22px] w-[22px] shrink-0 rounded-lg border-[1.5px] border-[hsl(var(--border-strong))] bg-card transition-colors data-[state=checked]:bg-navy data-[state=checked]:border-navy data-[state=checked]:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy/15 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <Check className="h-3.5 w-3.5 stroke-[3]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
