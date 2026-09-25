import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ApiUsage, ApiUsageWarning, fetchApiUsage } from "@/services/developerApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle } from "lucide-react";

/** "/api/v1/stores/{store_id}/orders" → "/orders" */
const shortRoute = (route: string) => route.replace(/^\/api\/v1\/stores\/\{[^}]+\}/, "") || "/";

export function ApiUsagePanel({ storeId }: { storeId: string | undefined }) {
  const { isRTL } = useLanguage();
  const t = (en: string, ar: string) => (isRTL ? ar : en);
  const [usage, setUsage] = useState<ApiUsage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    fetchApiUsage(storeId)
      .then(setUsage)
      .catch(() => setFailed(true));
  }, [storeId]);

  // An API without the usage endpoint yet: the page works without this card.
  if (failed) return null;

  const num = (n: number) => n.toLocaleString(isRTL ? "ar-EG" : "en-US");
  const unlimited = t("Unlimited", "غير محدود");

  const warningText = (w: ApiUsageWarning) => {
    switch (w.code) {
      case "quota_80":
        return t(
          `You've used ${w.percent}% of your monthly API quota.`,
          `استخدمت ${w.percent}% من حصة الـ API الشهرية.`,
        );
      case "quota_reached":
        return t(
          "You've reached your monthly API quota. Requests are refused until the 1st of next month.",
          "وصلت لحصة الـ API الشهرية. الطلبات هتترفض لحد أول الشهر الجاي.",
        );
      case "polling":
        return t(
          `We detected frequent polling of ${shortRoute(w.route)} (about ${w.per_minute} requests a minute). Subscribe to webhooks instead and NUMU will tell you when something changes.`,
          `لاحظنا استعلام متكرر على ${shortRoute(w.route)} (حوالي ${w.per_minute} طلب في الدقيقة). اشترك في الـ webhooks بدل كده وNUMU هتبلغك لما حاجة تتغير.`,
        );
      case "throttled":
        return t(
          `${num(w.count)} requests were rate-limited today. Respect the Retry-After header and back off.`,
          `${num(w.count)} طلب اترفض النهارده بسبب حد السرعة. التزم بـ Retry-After وقلّل المعدل.`,
        );
    }
  };

  const quota = usage?.month.quota ?? null;
  const quotaPct = usage && quota ? Math.min(100, (usage.month.used / quota) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          {t("API usage", "استخدام الـ API")}
        </CardTitle>
        <CardDescription>
          {t(
            "Limits apply to the whole store, across all keys.",
            "الحدود على المتجر كله، لكل المفاتيح مع بعض.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!usage ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            {usage.warnings.length > 0 && (
              <ul className="space-y-2">
                {usage.warnings.map((w, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{warningText(w)}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={t("Today", "النهارده")} value={num(usage.today.requests)} sub={t("requests", "طلب")} />
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">{t("This month", "الشهر ده")}</p>
                <p className="text-lg font-bold" dir="ltr">
                  {num(usage.month.used)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" / "}
                    {quota === null ? unlimited : num(quota)}
                  </span>
                </p>
                {quota !== null && <Progress value={quotaPct} className="mt-2 h-1.5" />}
              </div>
              <Stat
                label={t("Rate limit", "حد السرعة")}
                value={usage.limits.per_minute === null ? unlimited : `${num(usage.limits.per_minute)}/${t("min", "دقيقة")}`}
                sub={
                  usage.limits.per_second === null
                    ? undefined
                    : t(`burst ${usage.limits.per_second}/sec`, `دفعة ${usage.limits.per_second}/ثانية`)
                }
              />
              <Stat
                label={t("Rate-limited today", "اترفض النهارده")}
                value={num(usage.today.throttled)}
                sub={t(
                  `error rate ${(usage.today.error_rate * 100).toFixed(1)}%`,
                  `نسبة الأخطاء ${(usage.today.error_rate * 100).toFixed(1)}%`,
                )}
              />
            </div>

            {usage.top_endpoints.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold">{t("Most used this month", "الأكثر استخدامًا الشهر ده")}</p>
                <ul className="divide-y rounded-lg border text-sm">
                  {usage.top_endpoints.map((e) => (
                    <li key={`${e.method} ${e.route}`} className="flex items-center justify-between gap-3 px-3 py-2">
                      <code className="truncate text-xs" dir="ltr">
                        <span className="font-bold">{e.method}</span> {shortRoute(e.route)}
                      </code>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{num(e.requests)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
