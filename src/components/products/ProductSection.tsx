/**
 * ProductSection — one collapsible block of the product editor.
 *
 * The editor carries far more than the essentials (variants, size charts,
 * metafields, bundles, SEO, templates, labels). Rendered flat, that is a
 * very long page in which the fields a merchant edits daily — images,
 * name, price, stock — are buried among fields they touch once a year.
 *
 * So the daily fields stay open and everything else collapses to a titled
 * row with a line explaining what is inside, which is the only way to make
 * a row worth expanding without opening it first.
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ProductSectionProps {
  title: string;
  /** One line on what the section holds. Shown collapsed — this is what a
   *  merchant scans to decide whether to open it. */
  description?: string;
  defaultOpen?: boolean;
  /** Right-aligned in the header — a count, a badge, a state pill. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ProductSection({
  title,
  description,
  defaultOpen = false,
  aside,
  children,
  className,
}: ProductSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-6 py-4 text-start transition-colors hover:bg-muted/30"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold">{title}</span>
          {description && (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {description}
            </span>
          )}
        </span>
        {aside}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Unmounted rather than hidden: several of these bodies are heavy
          (the variant matrix, the metafield editor), and keeping them all
          mounted made every keystroke in the name field re-render them. */}
      {open && <div className="border-t border-border/60 px-6 py-5">{children}</div>}
    </Card>
  );
}
