import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  /* Souq switch — chunkier 28×52 pill, navy when checked, 4px navy
     focus glow, larger thumb with soft shadow. */
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-7 w-[52px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors data-[state=checked]:bg-navy data-[state=unchecked]:bg-surface-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy/15 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-6 w-6 rounded-full bg-white shadow-md ring-0 transition-transform data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-0 rtl:data-[state=checked]:-translate-x-6 rtl:data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
