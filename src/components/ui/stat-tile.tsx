import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type StatTone = "navy" | "saffron" | "sage" | "terra";

const CHIP: Record<StatTone, string> = {
  navy: "ichip ichip-navy",
  saffron: "ichip ichip-saffron",
  sage: "ichip ichip-sage",
  terra: "ichip ichip-terra",
};

/* Souq delta pill — soft emerald/red tint + arrow. Lifted from the
   analytics OverviewTab so every KPI row renders the same trend mark. */
export function TrendBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "souq-pill",
        positive
          ? "bg-emerald-500/14 text-emerald-700 dark:text-emerald-400"
          : "bg-destructive/14 text-destructive",
      )}
    >
      {positive ? (
        <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} />
      ) : (
        <ArrowDownRight className="h-3 w-3" strokeWidth={2.4} />
      )}
      <span className="ltr-nums">
        {positive ? "+" : ""}
        {value.toFixed(1)}%
      </span>
    </span>
  );
}

export interface StatTileProps {
  icon: LucideIcon;
  /** ichip tone. */
  tone?: StatTone;
  label: ReactNode;
  value: ReactNode;
  /** Small line under the value — a definition, a window, a secondary figure. */
  sub?: ReactNode;
  /** Percent delta vs the comparison period; omit to hide the pill. */
  trend?: number;
  /** Makes the whole tile a router link. */
  href?: string;
  /** Makes the whole tile a button (ignored when `href` is set). */
  onClick?: () => void;
  loading?: boolean;
  className?: string;
  /** Test / analytics hook. */
  "data-testid"?: string;
}

/* Souq KPI tile — brand-tinted ichip, optional delta pill, tabular
   display value, optional sub-line. One component for every "number in
   a card" surface (dashboard, analytics, finance, COD, logistics) so
   they stop drifting apart, and so a tile can be a real link: the
   logistics "Ready to ship · 0" tiles used to be dead cards. */
export function StatTile({
  icon: Icon,
  tone = "navy",
  label,
  value,
  sub,
  trend,
  href,
  onClick,
  loading = false,
  className,
  ...rest
}: StatTileProps) {
  const interactive = Boolean(href || onClick);

  const body = (
    <CardContent className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={CHIP[tone]}>
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>
        {!loading && trend !== undefined && <TrendBadge value={trend} />}
      </div>
      <p className="text-[12.5px] font-semibold text-muted-foreground mb-1">{label}</p>
      {loading ? (
        <Skeleton className="h-6 w-24 mt-1" />
      ) : (
        <p className="text-[23px] font-extrabold tracking-tight tabular-nums leading-none">
          {value}
        </p>
      )}
      {sub && !loading && (
        <p className="text-[11.5px] font-semibold text-muted-foreground mt-1.5 tabular-nums">
          {sub}
        </p>
      )}
    </CardContent>
  );

  const cardClass = cn(
    "overflow-hidden",
    interactive &&
      "hover-lift cursor-pointer transition-shadow hover:ring-2 hover:ring-saffron/40 focus-visible:ring-2 focus-visible:ring-saffron outline-none",
    className,
  );

  if (href) {
    return (
      <Link to={href} className="block rounded-xl focus:outline-none" {...rest}>
        <Card className={cardClass}>{body}</Card>
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-start rounded-xl focus:outline-none"
        {...rest}
      >
        <Card className={cardClass}>{body}</Card>
      </button>
    );
  }
  return (
    <Card className={cardClass} {...rest}>
      {body}
    </Card>
  );
}
