import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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

const STATE_META: Record<
  HealthState,
  { en: string; ar: string; chip: string }
> = {
  vip: { en: "VIP", ar: "كبار العملاء", chip: "bg-navy text-primary-foreground" },
  loyal: { en: "Loyal", ar: "أوفياء", chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  active: { en: "Active", ar: "نشطون", chip: "bg-sage/20 text-foreground" },
  growing: { en: "Growing", ar: "في نمو", chip: "bg-saffron/20 text-foreground" },
  high_value_prospect: { en: "High-value prospect", ar: "عميل واعد", chip: "bg-saffron/25 text-foreground" },
  coupon_hunter: { en: "Coupon hunter", ar: "صياد كوبونات", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  at_risk: { en: "At risk", ar: "في خطر", chip: "bg-destructive/12 text-destructive" },
  churned: { en: "Churned", ar: "انقطعوا", chip: "bg-muted text-muted-foreground" },
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
        {!data || total === 0 ? (
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
                  className={STATE_META[s].chip.split(" ")[0]}
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
                  <span className="text-[13px] font-medium truncate min-w-0 flex-1">
                    {c.name || (isAr ? "(بدون اسم)" : "(unnamed)")}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${STATE_META[c.state].chip}`}>
                    {isAr ? STATE_META[c.state].ar : STATE_META[c.state].en}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums w-16 text-end shrink-0 hidden sm:inline">
                    {c.orders.toLocaleString(isAr ? "ar-EG" : undefined)} {isAr ? "طلب" : "orders"}
                  </span>
                  <span className="text-[12px] font-semibold tabular-nums w-20 text-end shrink-0">
                    {formatCurrency(c.total_spent_cents)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
