import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Filter, ArrowDown, ShoppingCart, Clock, DollarSign, TrendingUp,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getFunnel } from "@/services/analyticsApi";
import { dateRangeKey } from "@/services/dateRangeParams";
import type { DateRange } from "@/components/filters/DateRangePicker";

interface FunnelTabProps {
  range: DateRange;
  formatCurrency: (cents: number) => string;
}

const STEP_LABELS: Record<string, { en: string; ar: string }> = {
  page_view: { en: "Page Views", ar: "مشاهدات الصفحة" },
  product_view: { en: "Product Views", ar: "مشاهدات المنتج" },
  add_to_cart: { en: "Add to Cart", ar: "إضافة للسلة" },
  checkout_started: { en: "Checkout", ar: "بدء الدفع" },
  order_completed: { en: "Completed", ar: "اكتمال الطلب" },
  order_delivered: { en: "Delivered", ar: "تم التسليم" },
};

const TIMING_LABELS: Record<string, { en: string; ar: string }> = {
  "page_view→add_to_cart": { en: "Browse → Cart", ar: "تصفح → سلة" },
  "add_to_cart→checkout_started": { en: "Cart → Checkout", ar: "سلة → دفع" },
  "checkout_started→order_completed": { en: "Checkout → Paid", ar: "دفع → مدفوع" },
};

const STEP_COLORS = [
  "#3b82f6", "#06b6d4", "#8b5cf6",
  "#f59e0b", "#10b981", "#16a34a",
];

function formatMinutes(minutes: number, isAr: boolean): string {
  if (minutes < 60) return `${Math.round(minutes)} ${isAr ? "د" : "min"}`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours} ${isAr ? "س" : "hr"}`;
  return `${hours}${isAr ? "س" : "h"} ${mins}${isAr ? "د" : "m"}`;
}

export function FunnelTab({ range, formatCurrency }: FunnelTabProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const funnelQuery = useQuery({
    queryKey: ["analytics", "funnel", storeId, ...dateRangeKey(range)],
    queryFn: () => getFunnel(storeId!, range),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const data = funnelQuery.data ?? null;

  // Check if there's any meaningful funnel data (at least 1 page view)
  const hasData = data && data.steps.some((s) => s.count > 0);
  const maxCount = data?.steps[0]?.count || 1;
  // Suppress drop-off labels until the prior step has at least this many
  // sessions. With 1 page view and 0 product views the math says "−100%",
  // which looks alarming but is statistical noise on a tiny baseline.
  const DROP_OFF_MIN_SAMPLE = 5;

  // No data at all — show a friendly empty state
  if (data && !hasData) {
    return (
      <div className="space-y-4">
        <Card className="border-border/60">
          <CardContent className="py-16">
            <EmptyState
              icon={Filter}
              title={isAr ? "مفيش بيانات قمع بعد" : "No funnel data yet"}
              description={isAr
                ? "البيانات هتظهر لما العملاء يبدأوا يتصفحوا المتجر. تأكد إن كود التتبع شغال."
                : "Funnel data will appear as customers browse your store. Make sure tracking is enabled."}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      {data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "معدل ترك السلة" : "Cart Abandonment"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10">
                  <ShoppingCart className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${data.cart_abandonment.carts_created > 0 ? (data.cart_abandonment.abandonment_rate > 60 ? "text-destructive" : data.cart_abandonment.abandonment_rate > 40 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400") : "text-muted-foreground"}`}>
                {data.cart_abandonment.carts_created > 0 ? `${data.cart_abandonment.abandonment_rate}%` : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {data.cart_abandonment.carts_created > 0
                  ? `${data.cart_abandonment.carts_created - data.cart_abandonment.checkouts_started} ${isAr ? "سلة متروكة" : "abandoned"}`
                  : (isAr ? "لا توجد بيانات سلة" : "No cart data yet")}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "الإيرادات المفقودة" : "Lost Revenue"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                  <DollarSign className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {data.cart_abandonment.estimated_lost_revenue > 0
                  ? formatCurrency(data.cart_abandonment.estimated_lost_revenue)
                  : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isAr ? "تقدير بناءً على متوسط الطلب" : "Based on avg order value"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "التحويل الكلي" : "Overall Conversion"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${data.overall_conversion_pct > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                {data.overall_conversion_pct > 0 ? `${data.overall_conversion_pct}%` : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isAr ? "من المشاهدة للشراء" : "View to purchase"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "سلة → دفع" : "Cart → Checkout"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10">
                  <Filter className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${data.cart_abandonment.carts_created > 0 ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"}`}>
                {data.cart_abandonment.carts_created > 0
                  ? `${((data.cart_abandonment.checkouts_started / data.cart_abandonment.carts_created) * 100).toFixed(1)}%`
                  : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {data.cart_abandonment.carts_created > 0
                  ? `${data.cart_abandonment.checkouts_started} / ${data.cart_abandonment.carts_created}`
                  : (isAr ? "لا توجد بيانات" : "No data yet")}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Funnel Visualization */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            {isAr ? "قمع التحويل" : "Conversion Funnel"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data && hasData ? (
            <div className="space-y-1">
              {data.steps.map((step, i) => {
                const label = STEP_LABELS[step.step] || { en: step.step, ar: step.step };
                const width = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
                const color = STEP_COLORS[i % STEP_COLORS.length];
                const showDropOff =
                  i > 0 &&
                  step.drop_off_pct > 0 &&
                  data.steps[i - 1].count >= DROP_OFF_MIN_SAMPLE;

                return (
                  <div key={step.step}>
                    {/* Drop-off indicator — only show when there's actual data in previous step */}
                    {showDropOff && (
                      <div className="flex items-center justify-center gap-1 py-0.5">
                        <ArrowDown className="h-2.5 w-2.5 text-red-400/50" />
                        <span className="text-[9px] font-medium text-red-400/70">
                          −{step.drop_off_pct}%
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 py-1">
                      <span className="text-[11px] font-medium text-muted-foreground w-24 shrink-0 truncate">
                        {isAr ? label.ar : label.en}
                      </span>
                      <div className="flex-1 h-7 bg-muted/30 rounded-md overflow-hidden relative">
                        {step.count > 0 ? (
                          <div
                            className="h-full rounded-md transition-all duration-700"
                            style={{
                              width: `${Math.max(width, 3)}%`,
                              backgroundColor: color,
                              opacity: 0.75,
                            }}
                          />
                        ) : null}
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums">
                          {step.count > 0
                            ? step.count.toLocaleString(isAr ? "ar-EG" : undefined)
                            : <span className="text-muted-foreground/40">0</span>}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold tabular-nums text-muted-foreground w-12 text-end shrink-0">
                        {step.count > 0 && maxCount > 0
                          ? `${((step.count / maxCount) * 100).toFixed(0)}%`
                          : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Filter}
              title={isAr ? "مفيش بيانات قمع بعد" : "No funnel data yet"}
              description={isAr ? "البيانات هتظهر لما العملاء يبدأوا يتصفحوا المتجر" : "Data will appear as customers browse your store"}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Conversion Rate Trend */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "اتجاه معدل التحويل" : "Conversion Rate Trend"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data && data.trend.length > 1 && data.trend.some((t) => t.conversion_rate > 0) ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trend}>
                    <defs>
                      <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px" }}
                      formatter={(value: number) => [`${value}%`, isAr ? "معدل التحويل" : "Conversion Rate"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="conversion_rate"
                      stroke="hsl(142 71% 45%)"
                      fill="url(#colorConv)"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon={TrendingUp} title={isAr ? "مفيش بيانات كافية" : "Not enough data"} description={isAr ? "محتاجين يومين على الأقل مع بيانات تحويل" : "Need at least 2 days with conversion data"} className="py-6" />
            )}
          </CardContent>
        </Card>

        {/* Average Time Between Steps */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "الوقت بين الخطوات" : "Time Between Steps"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data && data.step_timings.length > 0 ? (
              <div className="space-y-5 py-2">
                {data.step_timings.map((timing) => {
                  const key = `${timing.from_step}→${timing.to_step}`;
                  const label = TIMING_LABELS[key] || { en: key, ar: key };
                  const isLong = timing.avg_minutes > 120;
                  const isMedium = timing.avg_minutes > 30;

                  return (
                    <div key={key} className="text-center">
                      <p className={`text-2xl font-bold tabular-nums ${isLong ? "text-amber-600 dark:text-amber-400" : isMedium ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {formatMinutes(timing.avg_minutes, isAr)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {isAr ? label.ar : label.en}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={Clock} title={isAr ? "مفيش بيانات كافية" : "Not enough data"} description={isAr ? "محتاجين عملاء يمروا بأكتر من خطوة" : "Need customers completing multiple steps"} className="py-6" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
