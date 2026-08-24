import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { HeartPulse } from "lucide-react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  getCustomerHealth,
  type HealthState,
} from "@/services/analyticsApi";
import { useState } from "react";

interface CustomerHealthCardProps {
  formatCurrency: (cents: number) => string;
}

/**
 * `chip` is the filter/row pill — a translucent tint behind dark text.
 * `bar` is the distribution bar's segment and is deliberately a SEPARATE,
 * fully opaque colour: the bar is 12px tall with no text on it, so reusing
 * the chip's 12-25% tint rendered it as a row of barely-distinguishable
 * pale blocks.
 */
const STATE_META: Record<
  HealthState,
  { en: string; ar: string; chip: string; bar: string }
> = {
  vip: { en: "VIP", ar: "كبار العملاء", chip: "bg-navy text-primary-foreground", bar: "bg-navy" },
  loyal: { en: "Loyal", ar: "أوفياء", chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", bar: "bg-emerald-500" },
  active: { en: "Active", ar: "نشطون", chip: "bg-sage/20 text-foreground", bar: "bg-sage" },
  growing: { en: "Growing", ar: "في نمو", chip: "bg-saffron/20 text-foreground", bar: "bg-saffron" },
  high_value_prospect: { en: "High-value prospect", ar: "عميل واعد", chip: "bg-saffron/25 text-foreground", bar: "bg-saffron-600" },
  coupon_hunter: { en: "Coupon hunter", ar: "صياد كوبونات", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400", bar: "bg-amber-500" },
  at_risk: { en: "At risk", ar: "في خطر", chip: "bg-destructive/12 text-destructive", bar: "bg-destructive" },
  churned: { en: "Churned", ar: "انقطعوا", chip: "bg-muted text-muted-foreground", bar: "bg-muted-foreground/40" },
};

const STATE_ORDER: HealthState[] = [
  "vip", "loyal", "active", "growing",
  "high_value_prospect", "coupon_hunter", "at_risk", "churned",
];

/** Customer health (AI-3): lifecycle-state distribution + a filterable
 *  ranked list. Recency decays on the STORE's own repurchase rhythm. */
export function CustomerHealthCard({ formatCurrency }: CustomerHealthCardProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";
  const [stateFilter, setStateFilter] = useState<HealthState | undefined>();

  const healthQuery = useQuery({
    queryKey: ["analytics", "customer-health", storeId, stateFilter ?? "all"],
    queryFn: () => getCustomerHealth(storeId!, stateFilter),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });

  const data = healthQuery.data ?? null;
  const total = data?.distribution.reduce((s, d) => s + d.count, 0) ?? 0;
  const byState = new Map(data?.distribution.map((d) => [d.state, d.count]) ?? []);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <HeartPulse className="h-3.5 w-3.5 text-muted-foreground" />
            {isAr ? "صحة العملاء" : "Customer Health"}
          </span>
          {data && data.median_gap_days > 0 && total > 0 && (
            <span className="text-[11px] font-medium text-muted-foreground">
              {isAr
                ? `إيقاع الشراء: كل ~${data.median_gap_days.toLocaleString("ar-EG")} يوم`
                : `Repurchase rhythm: ~every ${data.median_gap_days} days`}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {healthQuery.isLoading && !data ? (
          // Without this the card renders "No customers yet" for the whole
          // first fetch, so every visit opens on a false empty state.
          //
          // This one keeps a skeleton rather than taking the NumuLoader the
          // chart cards use: here the shapes are the information. A bar, a
          // row of chips and a stack of name rows tell the merchant what is
          // about to arrive and reserve its exact height. A chart card has
          // no such shape to promise, which is why the mark carries the
          // wait there instead.
          <div className="space-y-3">
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-20 rounded-full" />
              ))}
            </div>
            <div className="space-y-1.5 pt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ) : !data || total === 0 ? (
          <EmptyState
            icon={HeartPulse}
            title={isAr ? "مفيش عملاء بعد" : "No customers yet"}
            className="py-6"
          />
        ) : (
          <>
            {/* Distribution: stacked proportional bar + filter chips. */}
            <div className="flex h-3 rounded-full overflow-hidden bg-muted/50 mb-3">
              {STATE_ORDER.filter((s) => byState.get(s)).map((s) => (
                <div
                  key={s}
                  className={STATE_META[s].bar}
                  style={{ width: `${((byState.get(s) ?? 0) / total) * 100}%` }}
                  title={`${isAr ? STATE_META[s].ar : STATE_META[s].en}: ${byState.get(s)}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button
                onClick={() => setStateFilter(undefined)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${!stateFilter ? "bg-foreground text-background" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
              >
                {isAr ? "الكل" : "All"} ({total.toLocaleString(isAr ? "ar-EG" : undefined)})
              </button>
              {STATE_ORDER.filter((s) => byState.get(s)).map((s) => (
                <button
                  key={s}
                  onClick={() => setStateFilter(stateFilter === s ? undefined : s)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${stateFilter === s ? "ring-2 ring-foreground/30" : ""} ${STATE_META[s].chip}`}
                >
                  {isAr ? STATE_META[s].ar : STATE_META[s].en}{" "}
                  ({(byState.get(s) ?? 0).toLocaleString(isAr ? "ar-EG" : undefined)})
                </button>
              ))}
            </div>

            <div className="space-y-0.5">
              {data.customers.slice(0, 10).map((c) => (
                <div key={c.customer_id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors">
                  <span
                    className={`w-8 h-8 rounded-full grid place-items-center text-[11px] font-bold tabular-nums shrink-0 ${c.score >= 70 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : c.score >= 40 ? "bg-saffron/20 text-foreground" : "bg-destructive/12 text-destructive"}`}
                    title={isAr ? "درجة الصحة" : "Health score"}
                  >
                    {c.score}
                  </span>
                  {/* Name and state travel together. The name used to be the
                      only flex-1 child, which parked the state chip against
                      the far edge and opened a screen-wide void between them
                      on any short name. */}
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="text-[13px] font-medium truncate">
                      {c.name || (isAr ? "(بدون اسم)" : "(unnamed)")}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${STATE_META[c.state].chip}`}>
                      {isAr ? STATE_META[c.state].ar : STATE_META[c.state].en}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums w-20 text-end shrink-0 whitespace-nowrap hidden sm:inline">
                    {c.orders.toLocaleString(isAr ? "ar-EG" : undefined)} {isAr ? "طلب" : "orders"}
                  </span>
                  {/* w-20 clipped the currency suffix off larger amounts. */}
                  <span className="text-[12px] font-semibold tabular-nums w-24 text-end shrink-0 whitespace-nowrap">
                    {formatCurrency(c.total_spent_cents)}
                  </span>
                </div>
              ))}
            </div>
            {/* The list is capped at 10. Saying so beats letting a merchant
                with 40 at-risk customers believe they have 10. */}
            {data.customers.length > 10 && (
              <p className="text-[11px] text-muted-foreground text-center pt-2">
                {isAr
                  ? `أعلى ١٠ من ${data.customers.length.toLocaleString("ar-EG")}`
                  : `Showing top 10 of ${data.customers.length}`}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
