import { useState } from "react";
import { Lightbulb, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface HelpTipProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function HelpTip({ title, children, defaultOpen = false, className }: HelpTipProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn(
      "rounded-xl border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/30 overflow-hidden transition-all",
      className,
    )}>
      <button
        type="button"
        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-start hover:bg-blue-100/40 dark:hover:bg-blue-900/20 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <Lightbulb className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        <span className="text-xs font-medium text-blue-800 dark:text-blue-300 flex-1">{title}</span>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 text-blue-400 transition-transform duration-200",
          open && "rotate-180",
        )} />
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0.5 text-xs text-blue-700/80 dark:text-blue-300/70 leading-relaxed space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}
