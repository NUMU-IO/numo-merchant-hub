import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Lightbulb, AlertTriangle, AlertCircle, CheckCircle2, Info,
  TrendingUp, TrendingDown, Sparkles, ArrowRight,
} from "lucide-react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getInsights } from "@/services/analyticsApi";

interface InsightsTabProps {
  formatCurrency: (cents: number) => string;
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    border: "border-red-500/40",
    bg: "bg-red-500/5",
    iconBg: "bg-red-500/10",
    iconColor: "text-red-600 dark:text-red-400",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    label_en: "Critical",
    label_ar: "حرج",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-amber-500/40",
    bg: "bg-amber-500/5",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    label_en: "Warning",
    label_ar: "تحذير",
  },
  info: {
    icon: Info,
    border: "border-blue-500/40",
    bg: "bg-blue-500/5",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    label_en: "Info",
    label_ar: "معلومة",
  },
  success: {
    icon: CheckCircle2,
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/5",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    label_en: "Positive",
    label_ar: "إيجابي",
  },
};

export function InsightsTab({ formatCurrency }: InsightsTabProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const insightsQuery = useQuery({
    queryKey: ["analytics", "insights", storeId, language],
    queryFn: () => getInsights(storeId!, isAr ? "ar" : "en"),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
    staleTime: 60 * 60 * 1000, // 1 hour — LLM-generated, server regenerates daily
  });

  const data = insightsQuery.data ?? null;

  // Sort: critical first, then warning, info, success
  const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
  const sortedSignals = [...(data?.signals ?? [])].sort(
    (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
  );

  const criticalCount = sortedSignals.filter((s) => s.severity === "critical").length;
  const warningCount = sortedSignals.filter((s) => s.severity === "warning").length;
  const successCount = sortedSignals.filter((s) => s.severity === "success").length;

  // Loading + error fallbacks. Insights are LLM-backed; if generation
  // times out (server caps at 20s) the rule-based signals still come
  // through, but a hard error means we render nothing — surface that
  // explicitly so the page doesn't look broken.
  if (insightsQuery.isLoading && !data) {
    return (
      <div className="rounded-lg border border-border/60 p-8 text-center text-sm text-muted-foreground">
        {isAr ? "جاري إعداد التحليل..." : "Generating insights..."}
      </div>
    );
  }
  if (insightsQuery.isError && !data) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-6 text-center">
        <p className="text-sm font-medium mb-2">
          {isAr ? "تعذّر تحميل التحليل" : "Insights unavailable"}
        </p>
        <p className="text-[12px] text-muted-foreground mb-3">
          {isAr
            ? "نعتذر، حدث خطأ أثناء توليد التحليل. حاول مرة أخرى."
            : "We couldn't load the AI analysis right now. Try again."}
        </p>
        <button
          type="button"
          onClick={() => insightsQuery.refetch()}
          className="text-[12px] font-semibold text-violet-600 hover:underline"
        >
          {isAr ? "إعادة المحاولة" : "Retry"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI Narrative (if available) */}
      {data?.narrative && data.narrative.summary && (
        <Card className="border-border/60 border-violet-500/30 bg-violet-500/[0.02]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
              <Sparkles className="h-3.5 w-3.5" />
              {isAr ? "تحليل الذكاء الاصطناعي" : "AI Analysis"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[13px] leading-relaxed mb-3">
              {data.narrative.summary}
            </p>

            {data.narrative.top_actions.length > 0 && (
              <div className="space-y-1.5 mb-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {isAr ? "الإجراءات المقترحة" : "Recommended Actions"}
                </p>
                {data.narrative.top_actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12px]">
                    <ArrowRight className="h-3 w-3 text-violet-500 mt-0.5 shrink-0" />
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            )}

            {data.narrative.outlook && (
              <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                {data.narrative.outlook.includes("positive") || data.narrative.outlook.includes("إيجابي") ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-amber-500" />
                )}
                <span className="text-[12px] text-muted-foreground italic">
                  {data.narrative.outlook}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary KPIs */}
      {data && data.signals.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-border/60">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold tabular-nums ${criticalCount > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                {criticalCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isAr ? "تنبيهات حرجة" : "Critical Alerts"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold tabular-nums ${warningCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                {warningCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isAr ? "تحذيرات" : "Warnings"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {successCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isAr ? "إشارات إيجابية" : "Positive Signals"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Insight Signal Cards */}
      {sortedSignals.length > 0 ? (
        <div className="space-y-3">
          {sortedSignals.map((signal, i) => {
            const config = SEVERITY_CONFIG[signal.severity] || SEVERITY_CONFIG.info;
            const Icon = config.icon;

            return (
              <Card key={`${signal.type}-${i}`} className={`border-border/60 ${config.border} ${config.bg}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${config.iconBg} shrink-0 mt-0.5`}>
                      <Icon className={`h-4 w-4 ${config.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[13px] font-semibold">
                          {isAr ? signal.title_ar : signal.title_en}
                        </h3>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${config.badge}`}>
                          {isAr ? config.label_ar : config.label_en}
                        </span>
                      </div>
                      <p className="text-[12px] text-muted-foreground leading-relaxed">
                        {isAr ? signal.body_ar : signal.body_en}
                      </p>

                      {/* Metric details */}
                      {signal.deviation_pct !== null && signal.deviation_pct !== undefined && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[11px] font-semibold ${(signal.deviation_pct ?? 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {(signal.deviation_pct ?? 0) > 0 ? "+" : ""}{signal.deviation_pct}%
                          </span>
                          {signal.metric && (
                            <span className="text-[10px] text-muted-foreground">
                              {signal.metric.replace("_", " ")}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Action */}
                      {(signal.action_en || signal.action_ar) && (
                        <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-border/30">
                          <Lightbulb className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                          <span className="text-[11px] font-medium">
                            {isAr ? signal.action_ar : signal.action_en}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-border/60">
          <CardContent className="p-6">
            <EmptyState
              icon={Lightbulb}
              title={isAr ? "مفيش تحليلات بعد" : "No insights yet"}
              description={isAr ? "التحليلات هتظهر بعد ما يبقى عندك ٧ أيام بيانات على الأقل" : "Insights will appear after at least 7 days of data"}
            />
          </CardContent>
        </Card>
      )}

      {/* Generated at */}
      {data?.generated_at && (
        <p className="text-[10px] text-muted-foreground text-center">
          {isAr ? "تم التحديث: " : "Updated: "}
          {new Date(data.generated_at).toLocaleString(isAr ? "ar-EG" : "en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}
    </div>
  );
}
