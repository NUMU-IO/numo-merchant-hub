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
    <div className={cn("flex items-start justify-between gap-4 flex-wrap", className)}>
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
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
