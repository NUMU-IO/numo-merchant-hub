/**
 * ResponsiveTable — one row of data, two renderings.
 *
 * ─── WHY IT IS SHAPED THIS WAY ───────────────────────────────────────────────
 * The obvious design is a declarative column API (`columns=[{header, cell}]`)
 * that renders a table on desktop and stacks the same columns as label/value
 * pairs on mobile. We deliberately did NOT do that, for two reasons:
 *
 *  1. MIGRATION RISK. The existing tables are rich, hand-tuned JSX — badges with
 *     per-status colour logic, truncation, two-line cells. Orders.tsx alone is
 *     ~1400 LOC. Rewriting eight pages into a column API is a large refactor
 *     with real desktop-regression risk, and desktop is the surface merchants
 *     currently rely on.
 *
 *  2. IT WOULD PRODUCE BAD MOBILE UX. Invoices and Payments have 14 columns.
 *     Stacking all 14 as label/value pairs is a wall of text — strictly worse
 *     than the sideways-scrolling table it replaces. On a phone a merchant
 *     wants order #, customer, total and status; not currency, pay-status and
 *     shipping-method.
 *
 * So: the desktop `<Table>` markup is passed through UNCHANGED as `children`,
 * and each page supplies a purpose-built card list as `mobile`. That forces a
 * deliberate mobile hierarchy per page instead of a mechanical dump, and it
 * means a migration cannot regress desktop — the desktop branch is untouched.
 *
 * The card primitives below exist so pages don't each reinvent the card.
 *
 * NOTE: the shadcn `Table` primitive already wraps itself in
 * `<div class="relative w-full overflow-auto">`, so tables ALREADY scroll
 * sideways. This component replaces that rendering below the breakpoint; it
 * must never add another scroll wrapper.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/contexts/LanguageContext";

interface ResponsiveTableProps {
  /** Desktop (>= md): the existing `<Table>` markup, passed through untouched. */
  children: React.ReactNode;
  /** Mobile (< md): a purpose-built card list, usually `<MobileCardList>`. */
  mobile: React.ReactNode;
}

/**
 * Renders exactly ONE branch, not both.
 *
 * A CSS-only switch (`md:hidden` / `hidden md:block`) would avoid the one-frame
 * settle on mount, but it puts BOTH renderings in the DOM — for a 50-row order
 * list of badge-heavy cells that doubles the React work on every render. Lists
 * are the whole point of this component, so we pay the mount frame instead.
 */
export function ResponsiveTable({ children, mobile }: ResponsiveTableProps) {
  const isMobile = useIsMobile();
  return <>{isMobile ? mobile : children}</>;
}

/** Vertical stack of cards. Use in place of `<TableBody>` on mobile. */
export function MobileCardList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-2.5", className)}>{children}</div>;
}

interface MobileCardProps {
  /** Primary identifier — order number, product name, customer name. */
  title: React.ReactNode;
  /** Secondary line under the title. */
  subtitle?: React.ReactNode;
  /** Right-aligned emphasis — almost always the money value. */
  trailing?: React.ReactNode;
  /** Small line under `trailing` (currency, unit). */
  trailingMeta?: React.ReactNode;
  /** Status badges. Keep to two — more is a wall of colour on a phone. */
  badges?: React.ReactNode;
  /** Bottom-row metadata: date, channel. De-emphasised. */
  meta?: React.ReactNode;
  /** Leading slot — a selection checkbox or thumbnail. Not part of the tap target. */
  leading?: React.ReactNode;
  /** Makes the whole card a button. Omit for non-navigable rows. */
  onClick?: () => void;
  /** Row-level actions. Rendered outside the tap target so they don't conflict. */
  actions?: React.ReactNode;
  selected?: boolean;
  className?: string;
}

/**
 * One record as a card.
 *
 * Accessibility: when `onClick` is set the card body is a real `<button>` so it
 * is keyboard-reachable and announces correctly. `leading` and `actions` sit
 * OUTSIDE that button — nesting interactive elements inside a button is invalid
 * and breaks both keyboard use and screen readers. The body is min-h-[44px] to
 * meet the touch-target floor.
 */
export function MobileCard({
  title,
  subtitle,
  trailing,
  trailingMeta,
  badges,
  meta,
  leading,
  onClick,
  actions,
  selected,
  className,
}: MobileCardProps) {
  const { isRTL } = useLanguage();
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold leading-tight">{title}</div>
            {subtitle ? (
              <div className="mt-0.5 truncate text-[13px] text-muted-foreground">{subtitle}</div>
            ) : null}
          </div>
          {trailing ? (
            <div className="shrink-0 text-end">
              <div className="text-[15px] font-bold tabular-nums leading-tight">{trailing}</div>
              {trailingMeta ? (
                <div className="text-[11px] text-muted-foreground">{trailingMeta}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        {badges ? <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div> : null}
        {meta ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {meta}
          </div>
        ) : null}
      </div>
      {onClick ? (
        <Chevron className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-3.5 transition-colors",
        selected ? "border-navy ring-1 ring-navy/20" : "border-border",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}

        {/* min-w-0 is load-bearing, not tidying: a flex item defaults to
            min-width:auto, so without it this element refuses to shrink below
            its content's min-content width. One long unbreakable string (an
            email + phone in the title) then blows the card open — measured at
            427px inside a 302px card, giving the content pane a 120px sideways
            scroll, which is the exact thing this component exists to remove.
            The inner `min-w-0 flex-1` in `body` cannot help: the overflow
            happens one level up, on this element. */}
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            className="flex min-h-[44px] min-w-0 flex-1 items-start gap-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
          >
            {body}
          </button>
        ) : (
          <div className="flex min-h-[44px] min-w-0 flex-1 items-start gap-3">{body}</div>
        )}
      </div>

      {actions ? (
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/60 pt-3">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** Card-shaped loading placeholder — mirrors MobileCard's proportions. */
export function MobileCardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <MobileCardList>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-muted/70" />
            </div>
            <div className="h-4 w-16 shrink-0 animate-pulse rounded bg-muted" />
          </div>
          <div className="mt-3 flex gap-1.5">
            <div className="h-5 w-16 animate-pulse rounded-md bg-muted/70" />
            <div className="h-5 w-20 animate-pulse rounded-md bg-muted/70" />
          </div>
        </div>
      ))}
    </MobileCardList>
  );
}
