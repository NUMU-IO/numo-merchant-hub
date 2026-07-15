import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  DollarSign, TrendingUp, Tag, ArrowDown, ShoppingCart, CreditCard, Percent, Receipt,
} from "lucide-react";
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, ReferenceLine,
} from "recharts";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  getSalesChart, getRevenueBreakdown, getOrdersBreakdown, getAnnotations,
} from "@/services/analyticsApi";
import { dateRangeKey } from "@/services/dateRangeParams";
import type { DateRange } from "@/components/filters/DateRangePicker";
import { useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";
import { useState } from "react";

type Granularity = "day" | "week" | "month";

// Compact glyphs for chart-event markers, by annotation type.
const ANNOTATION_ICON: Record<string, string> = {
  product: "🏷️",
  coupon: "🎟️",
  campaign: "📣",
  theme: "🎨",
};

interface SalesTabProps {
  range: DateRange;
  formatCurrency: (cents: number) => string;
}

export function SalesTab({ range, formatCurrency }: SalesTabProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const { compare } = useAnalyticsContext();
  const storeId = currentStore?.id;
  const isAr = language === "ar";
  const [granularity, setGranularity] = useState<Granularity>("day");
  const rangeKey = dateRangeKey(range);

  // Week/month buckets come from the BACKEND (real store-local calendar
  // weeks and months) — the old client-side fixed 7/30-row chunking
  // produced rolling pseudo-periods labeled with arbitrary dates.
  const chartQuery = useQuery({
    queryKey: ["analytics", "chart", storeId, granularity, compare, ...rangeKey],
    queryFn: () =>
      getSalesChart(storeId!, range, {
        granularity,
        compare: compare ? "previous_period" : undefined,
      }),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const revenueQuery = useQuery({
    queryKey: ["analytics", "revenue-breakdown", storeId, ...rangeKey],
    queryFn: () => getRevenueBreakdown(storeId!, range),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const ordersBreakdownQuery = useQuery({
    queryKey: ["analytics", "orders-breakdown", storeId, ...rangeKey],
    queryFn: () => getOrdersBreakdown(storeId!, range),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const annotationsQuery = useQuery({
    queryKey: ["analytics", "annotations", storeId, ...rangeKey],
    queryFn: () => getAnnotations(storeId!, range),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const chartData = chartQuery.data ?? [];
  const hasCompare = chartData.some(
    (p) => p.prev_sales !== null && p.prev_sales !== undefined,
  );
  const revenue = revenueQuery.data ?? null;
  const ordersBreakdown = ordersBreakdownQuery.data ?? null;

  // Annotations → one marker per chart bucket that has ≥1 event, but only
  // when the bucket label exists on the current chart (day granularity;
  // week/month buckets don't line up with per-day event labels). Grouped
  // so a busy launch day shows a single marker, not a wall of lines.
  const chartLabels = new Set(chartData.map((d) => d.date));
  const annotationsByDate = new Map<string, { type: string; label: string }[]>();
  if (granularity === "day") {
    for (const a of annotationsQuery.data?.annotations ?? []) {
      if (!chartLabels.has(a.date)) continue;
      const list = annotationsByDate.get(a.date) ?? [];
      list.push({ type: a.type, label: a.label });
      annotationsByDate.set(a.date, list);
    }
  }
  const annotationMarkers = [...annotationsByDate.entries()];

  // Compute AOV trend from raw daily chart data
  const aovTrendData = (chartQuery.data ?? [])
    .filter((d) => d.orders > 0)
    .map((d) => ({
      date: d.date,
      aov: Math.round(d.sales / d.orders),
    }));

  // Compute KPI values
  const totalOrders = chartData.reduce((sum, d) => sum + d.orders, 0);
  const totalRevenue = revenue?.gross_revenue ?? 0;
  const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const discountRate = totalRevenue > 0 ? ((revenue?.discounts ?? 0) / totalRevenue * 100) : 0;

  const granularityLabels: Record<Granularity, string> = {
    day: isAr ? "يومي" : "Day",
    week: isAr ? "أسبوعي" : "Week",
    month: isAr ? "شهري" : "Month",
  };

  const waterfallData = revenue ? [
    { name: isAr ? "إجمالي الإيرادات" : "Gross Revenue", value: revenue.gross_revenue, fill: "hsl(var(--primary))" },
    { name: isAr ? "الشحن" : "Shipping", value: revenue.shipping_collected, fill: "hsl(142 71% 45%)" },
    { name: isAr ? "الخصومات" : "Discounts", value: -revenue.discounts, fill: "hsl(38 92% 50%)" },
    { name: isAr ? "المسترد" : "Refunds", value: -revenue.refunds, fill: "hsl(0 84% 60%)" },
    { name: isAr ? "صافي الإيرادات" : "Net Revenue", value: revenue.net_revenue, fill: "hsl(var(--primary))" },
  ] : [];

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      {revenue && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "صافي الإيرادات" : "Net Revenue"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(revenue.net_revenue)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "إجمالي الطلبات" : "Total Orders"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
                  <ShoppingCart className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">{totalOrders.toLocaleString(isAr ? "ar-EG" : undefined)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "متوسط قيمة الطلب" : "Avg Order Value"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10">
                  <TrendingUp className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(aov)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "معدل الخصم" : "Discount Rate"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                  <Percent className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">{discountRate.toFixed(1)}%</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {formatCurrency(revenue.discounts)} {isAr ? "خصومات" : "in discounts"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Revenue chart with granularity toggle */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">{isAr ? "اتجاه الإيرادات" : "Revenue Trend"}</CardTitle>
            <div className="flex gap-0.5 rounded-lg bg-muted/60 p-0.5">
              {(["day", "week", "month"] as Granularity[]).map((g) => (
                <Button
                  key={g}
                  variant={granularity === g ? "default" : "ghost"}
                  size="sm"
                  className={`h-6 text-[10px] px-2 rounded-md ${granularity === g ? "" : "text-muted-foreground"}`}
                  onClick={() => setGranularity(g)}
                >
                  {granularityLabels[g]}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 100).toLocaleString()}`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px" }}
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === "prev_sales"
                        ? (isAr ? "الفترة السابقة" : "Previous period")
                        : (isAr ? "الإيرادات" : "Revenue"),
                    ]}
                  />
                  {/* Previous-period overlay (Compare toggle). */}
                  {hasCompare && (
                    <Line
                      type="monotone"
                      dataKey="prev_sales"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                      dot={false}
                      opacity={0.7}
                    />
                  )}
                  <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" fill="url(#colorRevenue)" strokeWidth={1.5} dot={false} />
                  {/* Store-event markers (item 13) — dashed vertical lines
                      at the day a coupon/campaign/product/theme event
                      happened, so a spike/dip has visible context. */}
                  {annotationMarkers.map(([date, evs]) => (
                    <ReferenceLine
                      key={date}
                      x={date}
                      stroke="hsl(var(--saffron))"
                      strokeDasharray="3 3"
                      strokeOpacity={0.7}
                      label={{
                        value: evs.length > 1 ? `${ANNOTATION_ICON[evs[0].type]}·${evs.length}` : ANNOTATION_ICON[evs[0].type],
                        position: "top",
                        fontSize: 11,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={TrendingUp} title={isAr ? "مفيش بيانات" : "No data available"} />
            )}
          </div>
          {/* Annotation legend — lists what each marker means. */}
          {annotationMarkers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground border-t border-border/60 pt-2">
              {annotationMarkers.slice(0, 6).map(([date, evs]) => (
                <span key={date} className="inline-flex items-center gap-1">
                  <span aria-hidden>{ANNOTATION_ICON[evs[0].type]}</span>
                  <span className="font-medium text-foreground/70">{date}</span>
                  <span className="truncate max-w-[160px]">
                    {evs[0].label}{evs.length > 1 ? ` +${evs.length - 1}` : ""}
                  </span>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AOV Trend + Revenue by Payment Method */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* AOV Trend */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "اتجاه متوسط قيمة الطلب" : "Avg Order Value Trend"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aovTrendData.length > 0 ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={aovTrendData}>
                    <defs>
                      <linearGradient id="colorAov" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(262 83% 58%)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(262 83% 58%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 100).toLocaleString()}`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px" }}
                      formatter={(value: number) => [formatCurrency(value), isAr ? "متوسط الطلب" : "AOV"]}
                    />
                    <Area type="monotone" dataKey="aov" stroke="hsl(262 83% 58%)" fill="url(#colorAov)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon={TrendingUp} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>

        {/* Revenue by Payment Method */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "الإيرادات حسب طريقة الدفع" : "Revenue by Payment Method"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ordersBreakdown && ordersBreakdown.by_payment_method.length > 0 ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ordersBreakdown.by_payment_method} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${(v / 100).toLocaleString()}`}
                    />
                    <YAxis
                      type="category"
                      dataKey="method"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                      tickFormatter={(v) => v === "cod" ? "COD" : v.charAt(0).toUpperCase() + v.slice(1)}
                    />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px" }}
                      formatter={(value: number) => [formatCurrency(value), isAr ? "الإيرادات" : "Revenue"]}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon={CreditCard} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown + Coupon Impact */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Waterfall breakdown */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "تفاصيل الإيرادات" : "Revenue Breakdown"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenue ? (
              <div className="space-y-3">
                {waterfallData.map((item) => {
                  const isNegative = item.value < 0;
                  const absValue = Math.abs(item.value);
                  const maxValue = revenue.gross_revenue + revenue.shipping_collected;
                  const width = maxValue > 0 ? (absValue / maxValue) * 100 : 0;
                  return (
                    <div key={item.name}>
                      <div className="flex items-center justify-between text-[13px] mb-1.5">
                        <span className="font-medium">{item.name}</span>
                        <span className={`font-semibold tabular-nums ${isNegative ? "text-destructive" : ""}`}>
                          {isNegative ? "−" : ""}{formatCurrency(absValue)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(width, 100)}%`, backgroundColor: item.fill }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={DollarSign} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>

        {/* Coupon Impact */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "تأثير الكوبونات" : "Coupon Impact"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenue && revenue.coupon_usage.length > 0 ? (
              <div className="space-y-0.5">
                {revenue.coupon_usage.map((c) => (
                  <div key={c.code} className="flex items-center justify-between rounded-lg p-2.5 -mx-2 hover:bg-muted/50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold font-mono truncate">{c.code}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.uses} {isAr ? "استخدام" : c.uses === 1 ? "use" : "uses"}
                      </p>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-[13px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                        −{formatCurrency(c.revenue_impact)}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="border-t border-border/60 mt-2 pt-2">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[12px] font-medium text-muted-foreground">
                      {isAr ? "إجمالي الخصومات" : "Total Discounts"}
                    </span>
                    <span className="text-[13px] font-bold tabular-nums text-amber-600 dark:text-amber-400">
                      −{formatCurrency(revenue.discounts)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState icon={Tag} title={isAr ? "مفيش كوبونات مستخدمة" : "No coupons used"} className="py-6" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tax collected — for ETA (Egypt) / ZATCA (Saudi) filing. Egyptian
          VAT is inclusive (already in the price), so this is what the
          merchant owes out of collected revenue, not an addition. */}
      {revenue && (revenue.tax_collected ?? 0) > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                {isAr ? "الضريبة المحصّلة" : "Tax Collected"}
              </span>
              <span className="text-[14px] font-bold tabular-nums">
                {formatCurrency(revenue.tax_collected ?? 0)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11.5px] text-muted-foreground mb-3">
              {isAr
                ? "الضريبة جزء من السعر (شاملة) — دي اللي بتدفعها للمصلحة، مش إضافة على المبيعات."
                : "Tax is included in prices — this is what you remit to the authority, not added to sales."}
            </p>
            {(revenue.tax_by_rate?.length ?? 0) > 0 && (
              <div className="space-y-0.5 mb-3">
                {revenue.tax_by_rate!.map((t) => (
                  <div key={t.rate_pct} className="flex items-center justify-between rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors">
                    <span className="text-[12.5px] font-medium tabular-nums">
                      {t.rate_pct.toLocaleString(isAr ? "ar-EG" : undefined)}% VAT
                      <span className="text-[10.5px] text-muted-foreground ms-1.5">
                        · {t.orders.toLocaleString(isAr ? "ar-EG" : undefined)} {isAr ? "طلب" : "orders"}
                      </span>
                    </span>
                    <span className="text-[12.5px] font-semibold tabular-nums">
                      {formatCurrency(t.tax_cents)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
              <div>
                <p className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "شاملة السعر" : "Included in price"}
                </p>
                <p className="text-[14px] font-bold tabular-nums">
                  {formatCurrency(revenue.tax_inclusive ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "مضافة" : "Added on top"}
                </p>
                <p className="text-[14px] font-bold tabular-nums">
                  {formatCurrency(revenue.tax_added ?? 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
