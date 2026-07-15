import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  getMetricTargets, putMetricTargets,
  type MetricTargetProgress, type TargetMetric,
} from "@/services/analyticsApi";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface MetricTargetsCardProps {
  storeId: string;
  formatCurrency: (cents: number) => string;
}

const METRIC_META: Record<
  TargetMetric,
  { en: string; ar: string; kind: "money" | "count" | "bps" }
> = {
  revenue: { en: "Revenue", ar: "الإيرادات", kind: "money" },
  orders: { en: "Orders", ar: "الطلبات", kind: "count" },
  aov: { en: "Avg Order Value", ar: "متوسط قيمة الطلب", kind: "money" },
  conversion: { en: "Conversion Rate", ar: "معدل التحويل", kind: "bps" },
};

const PACE_STYLE: Record<string, string> = {
  ahead: "text-emerald-600 dark:text-emerald-400",
  on_track: "text-navy dark:text-blue-300",
  behind: "text-amber-600 dark:text-amber-400",
};

/** Format a stored integer value for display, per metric kind. */
function formatValue(
  metric: TargetMetric,
  value: number,
  formatCurrency: (c: number) => string,
  isAr: boolean,
): string {
  const kind = METRIC_META[metric].kind;
  if (kind === "money") return formatCurrency(value);
  if (kind === "bps") return `${(value / 100).toLocaleString(isAr ? "ar-EG" : undefined)}%`;
  return value.toLocaleString(isAr ? "ar-EG" : undefined);
}

/** Convert a stored integer to the dialog's human input value. */
function toInput(metric: TargetMetric, value: number): string {
  if (value === 0) return "";
  const kind = METRIC_META[metric].kind;
  if (kind === "money") return String(value / 100); // cents → major
  if (kind === "bps") return String(value / 100); // bps → percent
  return String(value);
}

/** Convert a dialog input back to the stored integer. */
function fromInput(metric: TargetMetric, raw: string): number {
  const n = parseFloat(raw);
  if (!isFinite(n) || n < 0) return 0;
  const kind = METRIC_META[metric].kind;
  if (kind === "money") return Math.round(n * 100); // major → cents
  if (kind === "bps") return Math.round(n * 100); // percent → bps
  return Math.round(n);
}

const ALL_METRICS: TargetMetric[] = ["revenue", "orders", "aov", "conversion"];

export function MetricTargetsCard({ storeId, formatCurrency }: MetricTargetsCardProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const queryClient = useQueryClient();

  const targetsQuery = useQuery({
    queryKey: ["analytics", "targets", storeId],
    queryFn: () => getMetricTargets(storeId),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const targets = targetsQuery.data?.targets ?? [];
  const byMetric = new Map<TargetMetric, MetricTargetProgress>(
    targets.map((t) => [t.metric, t]),
  );

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<TargetMetric, string>>({
    revenue: "", orders: "", aov: "", conversion: "",
  });

  // Seed the dialog from current targets whenever it opens.
  useEffect(() => {
    if (open) {
      setDraft({
        revenue: toInput("revenue", byMetric.get("revenue")?.target_value ?? 0),
        orders: toInput("orders", byMetric.get("orders")?.target_value ?? 0),
        aov: toInput("aov", byMetric.get("aov")?.target_value ?? 0),
        conversion: toInput("conversion", byMetric.get("conversion")?.target_value ?? 0),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: () =>
      putMetricTargets(
        storeId,
        ALL_METRICS.map((m) => ({
          metric: m,
          period: "month" as const,
          target_value: fromInput(m, draft[m]),
        })),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics", "targets", storeId] });
      setOpen(false);
      toast.success(isAr ? "تم حفظ الأهداف" : "Targets saved");
    },
    onError: () => toast.error(isAr ? "فشل الحفظ" : "Couldn't save targets"),
  });

  const monthLabel = isAr ? "هذا الشهر" : "this month";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[17px] font-bold tracking-tight flex items-center gap-2">
            <Target className="h-4 w-4 text-ink-faint" strokeWidth={2.2} />
            {isAr ? "الأهداف" : "Targets"}
            <span className="text-[12px] font-medium text-muted-foreground">
              {monthLabel}
            </span>
          </h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-[12px] rounded-lg">
                {targets.length > 0
                  ? (isAr ? "تعديل" : "Edit")
                  : (isAr ? "حدد أهدافك" : "Set targets")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isAr ? "أهداف الشهر" : "Monthly targets"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {ALL_METRICS.map((m) => (
                  <div key={m} className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <Label htmlFor={`target-${m}`} className="text-[13px]">
                      {isAr ? METRIC_META[m].ar : METRIC_META[m].en}
                      <span className="text-[11px] text-muted-foreground ms-1.5">
                        {METRIC_META[m].kind === "money"
                          ? (isAr ? "(ج.م)" : "(EGP)")
                          : METRIC_META[m].kind === "bps"
                            ? "(%)"
                            : ""}
                      </span>
                    </Label>
                    <Input
                      id={`target-${m}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      placeholder={isAr ? "مفيش هدف" : "No target"}
                      value={draft[m]}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [m]: e.target.value }))
                      }
                      className="w-36 h-8 text-[13px] tabular-nums"
                      dir="ltr"
                    />
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">
                  {isAr
                    ? "اسيب الخانة فاضية أو صفر لإلغاء الهدف."
                    : "Leave blank or 0 to remove a target."}
                </p>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  {isAr ? "حفظ" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {targets.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-4 text-center">
            {isAr
              ? "حدد أهداف شهرية عشان تتابع تقدمك مقابلها."
              : "Set monthly goals to track your pace against them."}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {targets.map((t) => {
              const capped = Math.min(t.progress_pct, 100);
              return (
                <div key={`${t.metric}-${t.period}`} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold text-muted-foreground">
                      {isAr ? METRIC_META[t.metric].ar : METRIC_META[t.metric].en}
                    </span>
                    <span className={`text-[12px] font-bold ${PACE_STYLE[t.pace]}`}>
                      {t.pace === "ahead"
                        ? (isAr ? "متقدم" : "Ahead")
                        : t.pace === "behind"
                          ? (isAr ? "متأخر" : "Behind")
                          : (isAr ? "في المسار" : "On track")}
                    </span>
                  </div>
                  {/* Progress track with an expected-pace marker so the
                      merchant sees goal AND schedule at a glance. */}
                  <div className="relative h-2.5 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-navy transition-all duration-700"
                      style={{ width: `${capped}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-foreground/40"
                      style={{
                        [isAr ? "right" : "left"]: `${Math.min(t.expected_pct, 100)}%`,
                      }}
                      title={isAr ? "المفروض دلوقتي" : "Expected by now"}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="font-semibold tabular-nums">
                      {formatValue(t.metric, t.actual_value, formatCurrency, isAr)}
                      <span className="text-muted-foreground font-medium">
                        {" / "}
                        {formatValue(t.metric, t.target_value, formatCurrency, isAr)}
                      </span>
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {t.progress_pct.toLocaleString(isAr ? "ar-EG" : undefined)}%
                    </span>
                  </div>
                  {t.days_remaining > 0 && (
                    <p className="text-[10.5px] text-muted-foreground">
                      {isAr
                        ? `متبقي ${t.days_remaining.toLocaleString("ar-EG")} يوم`
                        : `${t.days_remaining} days left`}
                      {(t.metric === "revenue" || t.metric === "orders") && (
                        <>
                          {" · "}
                          {isAr ? "متوقع" : "projected"}{" "}
                          {formatValue(t.metric, t.projected_value, formatCurrency, isAr)}
                        </>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
