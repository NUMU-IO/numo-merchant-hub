import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, RefreshCw, X } from "lucide-react";
import {
  useQuery, useMutation, useQueryClient, keepPreviousData,
} from "@tanstack/react-query";
import {
  getSignals, dismissSignal, refreshSignals,
  type AdvisorSignal,
} from "@/services/analyticsApi";
import { formatMoney } from "@/lib/format-money";

const SEVERITY_STYLE: Record<AdvisorSignal["severity"], string> = {
  critical: "bg-destructive/12 text-destructive",
  warning: "bg-amber-500/14 text-amber-700 dark:text-amber-400",
  opportunity: "bg-emerald-500/14 text-emerald-700 dark:text-emerald-400",
  info: "bg-muted text-muted-foreground",
};

const SEVERITY_LABEL: Record<AdvisorSignal["severity"], { en: string; ar: string }> = {
  critical: { en: "Critical", ar: "حرج" },
  warning: { en: "Warning", ar: "تنبيه" },
  opportunity: { en: "Opportunity", ar: "فرصة" },
  info: { en: "Info", ar: "معلومة" },
};

/** The Advisor: rule-engine signals ranked by expected EGP impact, each
 *  with a plain-language finding + suggested action + dismiss. */
export function AdvisorFeed() {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";
  const queryClient = useQueryClient();

  const signalsQuery = useQuery({
    queryKey: ["analytics", "signals", storeId, isAr ? "ar" : "en"],
    queryFn: () => getSignals(storeId!, isAr ? "ar" : "en"),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["analytics", "signals", storeId] });
    // The executive view ranks the same signal rows — keep it in sync.
    queryClient.invalidateQueries({ queryKey: ["analytics", "executive", storeId] });
  };

  const dismissMutation = useMutation({
    mutationFn: (signalId: string) => dismissSignal(storeId!, signalId),
    onSuccess: invalidate,
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshSignals(storeId!),
    onSuccess: invalidate,
  });

  const signals = signalsQuery.data?.signals ?? [];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
            {isAr ? "المستشار" : "Advisor"}
            {signals.length > 0 && (
              <span className="text-[11px] font-bold text-muted-foreground">
                ({signals.length.toLocaleString(isAr ? "ar-EG" : undefined)})
              </span>
            )}
          </span>
          <Button
            variant="ghost" size="icon" className="h-7 w-7 rounded-lg"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            title={isAr ? "إعادة الفحص" : "Re-check now"}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {signals.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground py-3 text-center">
            {isAr
              ? "مفيش حاجة محتاجة انتباهك دلوقتي — كله تمام. ✅"
              : "Nothing needs your attention right now — all clear. ✅"}
          </p>
        ) : (
          <div className="space-y-2.5">
            {signals.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-border/60 p-3.5 flex items-start gap-3"
              >
                <span
                  className={`souq-pill shrink-0 mt-0.5 text-[10.5px] font-bold px-2 py-0.5 rounded-full ${SEVERITY_STYLE[s.severity]}`}
                >
                  {isAr ? SEVERITY_LABEL[s.severity].ar : SEVERITY_LABEL[s.severity].en}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-snug">{s.title}</p>
                  <p className="text-[12px] text-muted-foreground mt-1">{s.action}</p>
                  {s.expected_impact_cents != null && s.expected_impact_cents > 0 && (
                    <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-1.5 tabular-nums">
                      {isAr ? "التأثير المتوقع ≈ " : "Estimated impact ≈ "}
                      {formatMoney(s.expected_impact_cents, {
                        fromCents: true,
                        locale: isAr ? "ar" : "en",
                      })}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost" size="icon"
                  className="h-6 w-6 rounded-md shrink-0 text-muted-foreground"
                  onClick={() => dismissMutation.mutate(s.id)}
                  title={isAr ? "تجاهل" : "Dismiss"}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
