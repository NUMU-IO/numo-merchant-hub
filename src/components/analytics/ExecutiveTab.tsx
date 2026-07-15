import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertTriangle, Sparkles, Check, CalendarClock, Compass,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  getExecutiveDashboard,
  dismissSignal,
  type AdvisorSignal,
  type ExecutiveGauges,
} from "@/services/analyticsApi";
import { Link } from "react-router-dom";

interface ExecutiveTabProps {
  formatCurrency: (cents: number) => string;
}

const GAUGES: {
  key: keyof ExecutiveGauges;
  en: string;
  ar: string;
  to: string;
}[] = [
  { key: "revenue", en: "Revenue", ar: "الإيراد", to: "/analytics/sales" },
  { key: "profit", en: "Profit", ar: "الربحية", to: "/analytics/orders" },
  { key: "store", en: "Store", ar: "المتجر", to: "/health-score" },
  { key: "marketing", en: "Marketing", ar: "التسويق", to: "/analytics/marketing" },
  { key: "inventory", en: "Inventory", ar: "المخزون", to: "/analytics/products" },
  { key: "customer", en: "Customers", ar: "العملاء", to: "/analytics/customers" },
];

function gaugeColor(v: number) {
  if (v >= 70) return { bar: "bg-emerald-500/80", text: "text-emerald-700 dark:text-emerald-400" };
  if (v >= 40) return { bar: "bg-saffron", text: "text-foreground" };
  return { bar: "bg-destructive/80", text: "text-destructive" };
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-destructive/12 text-destructive",
  warning: "bg-saffron/25 text-foreground",
  opportunity: "bg-emerald-500/14 text-emerald-700 dark:text-emerald-400",
  info: "bg-muted text-muted-foreground",
};

/** Executive dashboard (AI-6): "what should I do today?" — ranked
 *  instructions and gauges only; drill-downs lead to the classic tabs. */
export function ExecutiveTab({ formatCurrency }: ExecutiveTabProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const queryClient = useQueryClient();
  const storeId = currentStore?.id;
  const isAr = language === "ar";
  const lang = isAr ? "ar" : "en";

  const executiveQuery = useQuery({
    queryKey: ["analytics", "executive", storeId, lang],
    queryFn: () => getExecutiveDashboard(storeId!, lang),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60 * 1000,
  });

  const dismissMutation = useMutation({
    mutationFn: (signalId: string) => dismissSignal(storeId!, signalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics", "executive"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "signals"] });
    },
  });

  const data = executiveQuery.data ?? null;
  if (!data) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-8">
          <EmptyState
            icon={Compass}
            title={isAr ? "بيتجهز الملخص..." : "Composing your briefing..."}
          />
        </CardContent>
      </Card>
    );
  }

  const renderSignalRow = (s: AdvisorSignal, showDone: boolean) => (
    <div
      key={s.id}
      className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 transition-colors"
    >
      <span
        className={`souq-pill shrink-0 mt-0.5 text-[10.5px] font-bold px-2 py-0.5 rounded-full ${SEVERITY_STYLE[s.severity] ?? SEVERITY_STYLE.info}`}
      >
        {s.rule_id}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-snug">{s.title}</p>
        <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
          {s.action}
        </p>
        {s.expected_impact_cents != null && s.expected_impact_cents > 0 && (
          <p className="text-[11px] font-semibold tabular-nums mt-0.5">
            {isAr ? "≈ تأثير " : "≈ impact "}
            {formatCurrency(s.expected_impact_cents)}
          </p>
        )}
      </div>
      {showDone && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 h-7 px-2 text-[11px]"
          disabled={dismissMutation.isPending}
          onClick={() => dismissMutation.mutate(s.id)}
        >
          <Check className="h-3 w-3 me-1" />
          {isAr ? "تم" : "Done"}
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Briefing line */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <p className="text-[14px] font-medium leading-relaxed">{data.briefing}</p>
        </CardContent>
      </Card>

      {/* Six gauges */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {GAUGES.map((g) => {
          const value = data.gauges[g.key];
          const colors = value != null ? gaugeColor(value) : null;
          return (
            <Link key={g.key} to={g.to} className="group">
              <Card className="border-border/60 transition-shadow group-hover:shadow-sm">
                <CardContent className="p-3">
                  <p className="text-[11px] text-muted-foreground mb-1">
                    {isAr ? g.ar : g.en}
                  </p>
                  <p className={`text-xl font-bold tabular-nums ${colors?.text ?? "text-muted-foreground"}`}>
                    {value != null ? value : "—"}
                  </p>
                  <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
                    {value != null && (
                      <div
                        className={`h-full rounded-full ${colors!.bar}`}
                        style={{ width: `${value}%` }}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top problems */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "أهم المشاكل النهارده" : "Top Problems Today"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.problems.length > 0 ? (
              <div className="space-y-1">
                {data.problems.map((s) => renderSignalRow(s, true))}
              </div>
            ) : (
              <EmptyState
                icon={Check}
                title={isAr ? "مفيش مشاكل — تمام" : "Nothing needs attention"}
                className="py-4"
              />
            )}
          </CardContent>
        </Card>

        {/* Top opportunities */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "أهم الفرص" : "Top Opportunities"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.opportunities.length > 0 ? (
              <div className="space-y-1">
                {data.opportunities.map((s) => renderSignalRow(s, true))}
              </div>
            ) : (
              <EmptyState
                icon={Sparkles}
                title={isAr ? "مفيش فرص جديدة دلوقتي" : "No new opportunities right now"}
                className="py-4"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly priorities — signals that persisted ≥3 days */}
      {data.weekly_priorities.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "أولويات الأسبوع" : "This Week's Priorities"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {data.weekly_priorities.map((s) => renderSignalRow(s, false))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
