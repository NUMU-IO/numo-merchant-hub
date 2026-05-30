import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      /* Souq input — 46px tall, chunky 14px corners, 1.5px hairline,
         4px navy focus glow ring (no offset). Matches NHUB `.input`. */
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border-[1.5px] border-input bg-card px-4 py-2 text-[15px] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-ink-faint focus-visible:outline-none focus-visible:border-navy focus-visible:ring-4 focus-visible:ring-navy/15 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
