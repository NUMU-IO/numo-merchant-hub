import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  DollarSign, TrendingUp, Tag, ArrowDown, ShoppingCart, CreditCard, Percent,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  getSalesChart, getRevenueBreakdown, getOrdersBreakdown,
} from "@/services/analyticsApi";
import type { SalesDataPoint } from "@/services/analyticsApi";
import { dateRangeKey } from "@/services/dateRangeParams";
import type { DateRange } from "@/components/filters/DateRangePicker";
import { useState } from "react";

type Granularity = "day" | "week" | "month";

interface SalesTabProps {
  range: DateRange;
  formatCurrency: (cents: number) => string;
}

function aggregateByGranularity(data: SalesDataPoint[], granularity: Granularity): SalesDataPoint[] {
  if (granularity === "day") return data;
  const chunkSize = granularity === "week" ? 7 : 30;
  const result: SalesDataPoint[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    result.push({
      date: chunk[0].date,
      sales: chunk.reduce((sum, d) => sum + d.sales, 0),
      orders: chunk.reduce((sum, d) => sum + d.orders, 0),
    });
  }
  return result;
}

export function SalesTab({ range, formatCurrency }: SalesTabProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";
  const [granularity, setGranularity] = useState<Granularity>("day");
  const rangeKey = dateRangeKey(range);

  const chartQuery = useQuery({
    queryKey: ["analytics", "chart", storeId, ...rangeKey],
    queryFn: () => getSalesChart(storeId!, range),
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

  const chartData = chartQuery.data ? aggregateByGranularity(chartQuery.data, granularity) : [];
  const revenue = revenueQuery.data ?? null;
  const ordersBreakdown = ordersBreakdownQuery.data ?? null;

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
                    formatter={(value: number) => [formatCurrency(value), isAr ? "الإيرادات" : "Revenue"]}
                  />
                  <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" fill="url(#colorRevenue)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={TrendingUp} title={isAr ? "مفيش بيانات" : "No data available"} />
            )}
          </div>
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
    </div>
  );
}
