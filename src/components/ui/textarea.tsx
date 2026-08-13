import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    /* Souq textarea — matches Input: chunky 14px corners, 1.5px hairline,
       4px navy focus glow ring. */
    <textarea
      className={cn(
        // 16px below md so iOS doesn't zoom on focus; 14px from md up, matching
        // the previous desktop size exactly.
        "flex min-h-[88px] w-full rounded-xl border-[1.5px] border-input bg-card px-4 py-3 text-base md:text-sm transition-colors placeholder:text-ink-faint focus-visible:outline-none focus-visible:border-navy focus-visible:ring-4 focus-visible:ring-navy/15 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
