import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, Crown, Heart, AlertTriangle, UserX, UserPlus, Sparkles, DollarSign } from "lucide-react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getCustomerSegments } from "@/services/analyticsApi";

interface CustomersTabProps {
  period: number;
  formatCurrency: (cents: number) => string;
}

const SEGMENT_CONFIG: Record<string, { icon: typeof Crown; color: string; bg: string }> = {
  Champions: { icon: Crown, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
  Loyal: { icon: Heart, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
  Potential: { icon: Sparkles, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10" },
  New: { icon: UserPlus, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  "At Risk": { icon: AlertTriangle, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10" },
  Lost: { icon: UserX, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
};

const SEGMENT_LABELS_AR: Record<string, string> = {
  Champions: "الأبطال",
  Loyal: "الأوفياء",
  Potential: "محتملون",
  New: "جدد",
  "At Risk": "معرضون للخطر",
  Lost: "مفقودون",
};

export function CustomersTab({ period, formatCurrency }: CustomersTabProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const segmentsQuery = useQuery({
    queryKey: ["analytics", "customer-segments", storeId, period],
    queryFn: () => getCustomerSegments(storeId!, period),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
    // RFM + cohort + CLV is expensive (multi-CTE SQL). Cohort
    // membership doesn't move minute-to-minute; 5 min is plenty.
    staleTime: 5 * 60 * 1000,
  });

  const data = segmentsQuery.data ?? null;

  return (
    <div className="space-y-4">
      {/* RFM Segment Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data && data.segments.length > 0 ? (
          data.segments.map((seg) => {
            const config = SEGMENT_CONFIG[seg.segment] || SEGMENT_CONFIG.Potential;
            const Icon = config.icon;
            return (
              <Card key={seg.segment} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${config.bg}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold">
                        {isAr ? (SEGMENT_LABELS_AR[seg.segment] || seg.segment) : seg.segment}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {seg.count} {isAr ? "عميل" : seg.count === 1 ? "customer" : "customers"} ({seg.percentage}%)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-muted-foreground">{isAr ? "متوسط الإنفاق" : "Avg Revenue"}</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(seg.avg_revenue)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[12px] mt-1">
                    <span className="text-muted-foreground">{isAr ? "متوسط الطلبات" : "Avg Orders"}</span>
                    <span className="font-semibold tabular-nums">{seg.avg_orders}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full">
            <Card className="border-border/60">
              <CardContent className="p-6">
                <EmptyState icon={Users} title={isAr ? "مفيش بيانات عملاء" : "No customer data"} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cohort Retention Heatmap */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "الاحتفاظ بالعملاء" : "Cohort Retention"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data && data.cohorts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr>
                      <th className="text-start font-medium text-muted-foreground p-1.5">
                        {isAr ? "الشهر" : "Cohort"}
                      </th>
                      <th className="text-center font-medium text-muted-foreground p-1.5">
                        {isAr ? "العدد" : "Size"}
                      </th>
                      {[1, 2, 3, 4, 5, 6].map((m) => (
                        <th key={m} className="text-center font-medium text-muted-foreground p-1.5">
                          M+{m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.cohorts.map((cohort) => (
                      <tr key={cohort.cohort}>
                        <td className="font-medium p-1.5 whitespace-nowrap">{cohort.cohort}</td>
                        <td className="text-center font-semibold p-1.5 tabular-nums">{cohort.size}</td>
                        {[0, 1, 2, 3, 4, 5].map((i) => {
                          const val = cohort.retention[i];
                          if (val === undefined) {
                            return <td key={i} className="p-1.5" />;
                          }
                          const intensity = Math.min(val / 50, 1);
                          return (
                            <td key={i} className="text-center p-1.5">
                              <div
                                className="rounded px-1.5 py-0.5 font-semibold tabular-nums mx-auto w-fit"
                                style={{
                                  backgroundColor: `hsl(var(--primary) / ${0.08 + intensity * 0.35})`,
                                  color: intensity > 0.4 ? "hsl(var(--primary-foreground))" : undefined,
                                }}
                              >
                                {val}%
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Users} title={isAr ? "مفيش بيانات كافية" : "Not enough data"} className="py-6" />
            )}
          </CardContent>
        </Card>

        {/* CLV Stats */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "قيمة العميل مدى الحياة" : "Customer Lifetime Value"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: isAr ? "متوسط CLV" : "Average CLV", value: formatCurrency(data.clv.avg_clv), color: "text-blue-600 dark:text-blue-400" },
                    { label: isAr ? "وسيط CLV" : "Median CLV", value: formatCurrency(data.clv.median_clv), color: "text-emerald-600 dark:text-emerald-400" },
                    { label: isAr ? "أعلى ١٠٪" : "Top 10% CLV", value: formatCurrency(data.clv.top_10_pct_clv), color: "text-amber-600 dark:text-amber-400" },
                    { label: isAr ? "إجمالي العملاء" : "Total Customers", value: data.clv.total_customers.toLocaleString(isAr ? "ar-EG" : undefined), color: "text-violet-600 dark:text-violet-400" },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center rounded-lg bg-muted/40 p-3">
                      <p className={`text-lg font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border/60 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-muted-foreground">
                      {isAr ? "عملاء بطلب واحد فقط" : "Single-order customers"}
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums">
                      {data.clv.single_order_pct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-amber-500/70 rounded-full transition-all duration-500"
                      style={{ width: `${data.clv.single_order_pct}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState icon={DollarSign} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
