import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Small uppercase label above the title (Souq eyebrow). */
  eyebrow?: ReactNode;
  /** Right-side (LTR) action cluster. */
  actions?: ReactNode;
  /** Renders a back link above the title. */
  backTo?: { to: string; label: ReactNode };
  className?: string;
}

/* Souq page head — display title + muted subtitle + action cluster.
   This exact markup was copy-pasted into ~30 pages with small drifts
   (gutters, alignment classes). Pages touched by the UX pass adopt it;
   the rest migrate during the redesign. Uses logical `text-start` so
   RTL is handled by `dir`, not by per-page `isAr` ternaries. */
export function PageHeader({ title, subtitle, eyebrow, actions, backTo, className }: PageHeaderProps) {
  return (
    // Mobile-first: title block, then actions on their own row, full width.
    // `flex-wrap` alone never wrapped here — the title block has `min-w-0`, so
    // it shrank indefinitely instead, crushing the title to one word a line
    // beside the buttons on a phone.
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4", className)}>
      <div className="text-start min-w-0">
        {backTo && (
          <Link
            to={backTo.to}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            {backTo.label}
          </Link>
        )}
        {eyebrow && <p className="souq-eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">
          {actions}
        </div>
      )}
    </div>
  );
}
