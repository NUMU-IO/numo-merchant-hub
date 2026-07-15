import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageX, Repeat, Banknote, Gauge } from "lucide-react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getPredictions } from "@/services/analyticsApi";

interface PredictionsCardProps {
  formatCurrency: (cents: number) => string;
}

const CONFIDENCE_LABEL: Record<string, { en: string; ar: string; cls: string }> = {
  high: { en: "High confidence", ar: "ثقة عالية", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  medium: { en: "Medium confidence", ar: "ثقة متوسطة", cls: "bg-saffron/20 text-foreground" },
  low: { en: "Low confidence", ar: "ثقة منخفضة", cls: "bg-muted text-muted-foreground" },
};

function ConfidenceChip({ level, isAr }: { level: string; isAr: boolean }) {
  const meta = CONFIDENCE_LABEL[level] ?? CONFIDENCE_LABEL.low;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>
      {isAr ? meta.ar : meta.en}
    </span>
  );
}

function fmtDate(iso: string, isAr: boolean) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(isAr ? "ar-EG" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Predictions v1 (AI-5): statistical forecasts with explicit
 *  uncertainty — every number ships with its band or confidence tier. */
export function PredictionsCard({ formatCurrency }: PredictionsCardProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const predictionsQuery = useQuery({
    queryKey: ["analytics", "predictions", storeId],
    queryFn: () => getPredictions(storeId!),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
    // Inputs move on daily granularity; hourly refetch is already generous.
    staleTime: 60 * 60 * 1000,
  });

  const data = predictionsQuery.data ?? null;
  if (!data) return null;

  const { revenue_month: month, orders_today: today, repeat, cod, stockouts } = data;
  const hasAnything =
    month || today || stockouts.length > 0 || cod || repeat.repeat_customers > 0;
  if (!hasAnything) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Month-end revenue + today's orders bands */}
      {(month || today) && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "التوقعات" : "Expected Pace"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {month && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-muted-foreground">
                    {isAr ? "إيراد الشهر المتوقع" : "This month, on track for"}
                  </span>
                  <ConfidenceChip level={month.confidence} isAr={isAr} />
                </div>
                <p className="text-xl font-bold tabular-nums">
                  {formatCurrency(month.lower_cents)} – {formatCurrency(month.upper_cents)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isAr
                    ? `محقق حتى الآن ${formatCurrency(month.mtd_cents)} · باقي ${month.remaining_days.toLocaleString("ar-EG")} يوم`
                    : `${formatCurrency(month.mtd_cents)} so far · ${month.remaining_days} days left`}
                </p>
              </div>
            )}
            {today && (
              <div className="border-t border-border/60 pt-3">
                <span className="text-[12px] text-muted-foreground">
                  {isAr ? "طلبات اليوم المتوقعة" : "Orders expected today"}
                </span>
                <p className="text-lg font-bold tabular-nums">
                  {today.lower.toLocaleString(isAr ? "ar-EG" : undefined)} – {today.upper.toLocaleString(isAr ? "ar-EG" : undefined)}
                </p>
              </div>
            )}
            {repeat.repeat_customers > 0 && (
              <div className="border-t border-border/60 pt-3 flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                  <Repeat className="h-3 w-3" />
                  {isAr ? "احتمال شراء متكرر خلال ٣٠ يوم" : "Repeat purchase within 30d"}
                </span>
                <span className="text-[13px] font-bold tabular-nums flex items-center gap-2">
                  {repeat.p_next_30d_pct.toLocaleString(isAr ? "ar-EG" : undefined)}%
                  <ConfidenceChip level={repeat.confidence} isAr={isAr} />
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stockout dates */}
      {stockouts.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <PackageX className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "توقع نفاد المخزون" : "Stockout Forecast"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {stockouts.slice(0, 6).map((s) => (
              <div
                key={s.product_id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${s.urgent ? "bg-destructive" : "bg-saffron"}`}
                />
                <span className="text-[13px] font-medium truncate min-w-0 flex-1">
                  {s.name}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {isAr
                    ? `~${fmtDate(s.run_out_date, true)} (${fmtDate(s.early_date, true)}–${s.late_date ? fmtDate(s.late_date, true) : "؟"})`
                    : `~${fmtDate(s.run_out_date, false)} (${fmtDate(s.early_date, false)}–${s.late_date ? fmtDate(s.late_date, false) : "?"})`}
                </span>
                <span className="text-[11px] font-semibold tabular-nums shrink-0 hidden sm:inline">
                  {isAr ? `اطلب ${s.suggested_reorder_qty.toLocaleString("ar-EG")}` : `reorder ${s.suggested_reorder_qty}`}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* COD rejection risk */}
      {cod && (
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                {isAr ? "مخاطر رفض الدفع عند الاستلام" : "COD Rejection Risk"}
              </span>
              <ConfidenceChip level={cod.confidence} isAr={isAr} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="rounded-lg bg-muted/40 p-3 text-center">
                <p className="text-lg font-bold tabular-nums">
                  {cod.store_rate_pct.toLocaleString(isAr ? "ar-EG" : undefined)}%
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {isAr
                    ? `معدل الرفض (${cod.wilson_low_pct.toLocaleString("ar-EG")}–${cod.wilson_high_pct.toLocaleString("ar-EG")}٪)`
                    : `rejection rate (${cod.wilson_low_pct}–${cod.wilson_high_pct}%)`}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-center">
                <p className="text-lg font-bold tabular-nums">
                  {cod.pending_orders.toLocaleString(isAr ? "ar-EG" : undefined)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {isAr ? "طلبات COD جارية" : "COD orders in flight"}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 text-center">
                <p className="text-lg font-bold tabular-nums">
                  {formatCurrency(cod.pending_value_cents)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {isAr ? "قيمة معرضة للخطر" : "value at risk"}
                </p>
              </div>
              <div className="rounded-lg bg-destructive/8 p-3 text-center">
                <p className="text-lg font-bold tabular-nums text-destructive">
                  {formatCurrency(cod.expected_loss_cents)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {isAr ? "خسارة متوقعة" : "expected loss"}
                </p>
              </div>
            </div>
            {cod.by_governorate.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {cod.by_governorate.slice(0, 8).map((g) => (
                  <span
                    key={g.governorate}
                    className="rounded-full bg-muted/60 px-2.5 py-1 text-[11px] tabular-nums"
                    title={
                      isAr
                        ? `${g.returned} مرفوض من ${g.resolved}`
                        : `${g.returned} rejected of ${g.resolved}`
                    }
                  >
                    <span className="font-medium capitalize">{g.governorate}</span>{" "}
                    <span className="font-bold">{g.shrunk_rate_pct.toLocaleString(isAr ? "ar-EG" : undefined)}%</span>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
