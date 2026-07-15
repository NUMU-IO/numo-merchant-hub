import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BarChart3, TrendingUp, ShoppingCart, Users, DollarSign,
  MapPin, ArrowUpRight, ArrowDownRight, Package, AlertTriangle,
  Filter,
} from "lucide-react";
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import type {
  SalesOverview, SalesDataPoint, TopProduct,
  LocationSales, CustomerAnalytics, ConversionStats,
  CodRejectionStats, FunnelData,
} from "@/services/analyticsApi";

interface OverviewTabProps {
  overview: SalesOverview | null;
  chartData: SalesDataPoint[];
  topProducts: TopProduct[];
  locations: LocationSales[];
  customerStats: CustomerAnalytics | null;
  conversion: ConversionStats | null;
  codRejection: CodRejectionStats | null;
  funnel: FunnelData | null;
  formatCurrency: (cents: number) => string;
}

export function OverviewTab({
  overview, chartData, topProducts, locations,
  customerStats, conversion, codRejection, funnel, formatCurrency,
}: OverviewTabProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isAr = language === "ar";

  // Compare mode is detected from the data itself: the chart query only
  // attaches prev_* when the layout's Compare toggle asked for it.
  const hasCompare = chartData.some(
    (p) => p.prev_sales !== null && p.prev_sales !== undefined,
  );

  // AOV delta derived from the previous-window absolutes (backend sends
  // change % for sales/orders but ratios must be derived client-side).
  const prevAov =
    overview?.previous_total_orders && overview.previous_total_sales !== undefined
      ? overview.previous_total_sales / overview.previous_total_orders
      : 0;
  const aovChange =
    overview && prevAov > 0
      ? Math.round(((overview.avg_order_value - prevAov) / prevAov) * 1000) / 10
      : undefined;

  const TrendBadge = ({ value }: { value: number | undefined }) => {
    if (value === undefined || value === null) return null;
    const positive = value >= 0;
    return (
      <span className={`souq-pill ${positive ? "bg-emerald-500/14 text-emerald-700 dark:text-emerald-400" : "bg-destructive/14 text-destructive"}`}>
        {positive ? <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} /> : <ArrowDownRight className="h-3 w-3" strokeWidth={2.4} />}
        <span className="ltr-nums">{positive ? "+" : ""}{value.toFixed(1)}%</span>
      </span>
    );
  };

  return (
    <>
      {/* Souq KPI tiles — brand-tinted ichip + soft delta pill +
          tabular display value. */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          // Booked vs collected split (Shopify-style gross/net): the
          // headline stays booked revenue — in a COD market an order
          // booked today is usually collected on delivery days later —
          // with the actually-received money right under it so
          // merchants see both realities.
          {
            label: isAr ? "المبيعات المسجلة" : "Booked Sales",
            value: overview ? formatCurrency(overview.total_sales) : "—",
            sub: overview?.collected_revenue !== undefined
              ? `${isAr ? "المحصّل: " : "Collected: "}${formatCurrency(overview.collected_revenue)}`
              : undefined,
            trend: overview?.sales_change_percent, icon: DollarSign, chip: "ichip-navy",
          },
          { label: isAr ? "إجمالي الطلبات" : "Total Orders", value: overview?.total_orders ?? "—", trend: overview?.orders_change_percent, icon: ShoppingCart, chip: "ichip-sage" },
          { label: isAr ? "متوسط قيمة الطلب" : "Avg Order Value", value: overview ? formatCurrency(overview.avg_order_value) : "—", trend: aovChange, icon: TrendingUp, chip: "ichip-saffron" },
          { label: isAr ? "معدل التحويل" : "Conversion Rate", value: conversion ? `${conversion.conversion_rate.toFixed(1)}%` : "—", trend: undefined, icon: BarChart3, chip: "ichip-terra" },
        ].map((kpi) => (
          <Card key={kpi.label} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className={`ichip ${kpi.chip}`}><kpi.icon className="h-5 w-5" strokeWidth={2.2} /></div>
                {kpi.trend !== undefined && <TrendBadge value={kpi.trend} />}
              </div>
              <p className="text-[12.5px] font-semibold text-muted-foreground mb-1">{kpi.label}</p>
              <p className="text-[23px] font-extrabold tracking-tight tabular-nums leading-none">{kpi.value}</p>
              {"sub" in kpi && kpi.sub && (
                <p className="text-[11.5px] font-semibold text-muted-foreground mt-1.5 tabular-nums">
                  {kpi.sub}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="souq-section-head px-5 pt-5 pb-2">
            <h2 className="text-[17px] font-bold tracking-tight">{isAr ? "المبيعات" : "Sales"}</h2>
          </div>
          <CardContent>
            <div className="h-[260px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSalesNavy" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--navy))" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="hsl(var(--navy))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 5" className="stroke-border/40" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 100).toLocaleString()}`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", boxShadow: "var(--shadow-pop)", fontSize: "12px" }}
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === "prev_sales"
                          ? (isAr ? "الفترة السابقة" : "Previous period")
                          : (isAr ? "المبيعات" : "Sales"),
                      ]}
                    />
                    {/* Previous-period overlay (Compare toggle) — dashed,
                        muted, no fill so the current series stays primary. */}
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
                    <Area type="monotone" dataKey="sales" stroke="hsl(var(--navy))" fill="url(#colorSalesNavy)" strokeWidth={2.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={TrendingUp} title={isAr ? "مفيش بيانات" : "No data available"} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <div className="souq-section-head px-5 pt-5 pb-2">
            <h2 className="text-[17px] font-bold tracking-tight">{isAr ? "الطلبات" : "Orders"}</h2>
            <span className="text-xs text-muted-foreground">
              {isAr ? "آخر فترة" : "Current period"}
            </span>
          </div>
          <CardContent>
            <div className="h-[260px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 5" className="stroke-border/40" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", boxShadow: "var(--shadow-pop)", fontSize: "12px" }}
                      formatter={(value: number, name: string) => [
                        value,
                        name === "prev_orders"
                          ? (isAr ? "الفترة السابقة" : "Previous period")
                          : (isAr ? "الطلبات" : "Orders"),
                      ]}
                    />
                    {/* Previous-period overlay — thin muted bars beside
                        the current ones. */}
                    {hasCompare && (
                      <Bar
                        dataKey="prev_orders"
                        radius={[4, 4, 0, 0]}
                        fill="hsl(var(--muted-foreground))"
                        opacity={0.35}
                      />
                    )}
                    {/* Souq spec: last bar saffron to highlight current, rest navy. */}
                    <Bar dataKey="orders" radius={[6, 6, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell
                          key={`bar-${i}`}
                          fill={i === chartData.length - 1 ? "hsl(var(--saffron))" : "hsl(var(--navy))"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={ShoppingCart} title={isAr ? "مفيش بيانات" : "No data available"} />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversion funnel — Souq spec: navy-gradient bars with the
          count inside + % at the end. Real event counts from the same
          /analytics/funnel endpoint FunnelTab uses — this card used to
          FABRICATE the cart stage from a hardcoded 25%-of-visits guess
          when abandonment data was absent. If there's no funnel data,
          the card hides instead of inventing numbers. */}
      {(() => {
        const stepCount = (name: string) =>
          funnel?.steps.find((s) => s.step === name)?.count ?? 0;
        const visits = stepCount("page_view");
        const carts = stepCount("add_to_cart");
        const purchases = stepCount("order_completed");
        const stages = [
          { label: isAr ? "زيارات" : "Visits", value: visits },
          { label: isAr ? "ضافوا للسلة" : "Added to cart", value: carts },
          { label: isAr ? "اشتروا" : "Purchased", value: purchases },
        ];
        const top = Math.max(stages[0].value, 1);
        if (!funnel || top <= 1) return null;
        return (
          <Card>
            <div className="souq-section-head px-5 pt-5 pb-2">
              <h2 className="text-[17px] font-bold tracking-tight flex items-center gap-2">
                <Filter className="h-4 w-4 text-ink-faint" strokeWidth={2.2} />
                {isAr ? "مسار التحويل" : "Conversion funnel"}
              </h2>
            </div>
            <CardContent className="pb-4">
              <div className="space-y-2.5">
                {stages.map((s, i) => {
                  const pct = (s.value / top) * 100;
                  // % of the PREVIOUS stage (real step-to-step
                  // conversion), not share-of-visits — the old column
                  // read like a conversion rate but wasn't one.
                  const prev = i === 0 ? s.value : stages[i - 1].value;
                  const conversionPct =
                    i === 0 ? 100 : prev > 0 ? (s.value / prev) * 100 : 0;
                  return (
                    <div key={s.label} className="flex items-center gap-3">
                      <div className="w-28 sm:w-36 text-[12.5px] font-bold text-muted-foreground shrink-0">
                        {s.label}
                      </div>
                      <div className="flex-1 h-9 rounded-xl bg-muted/50 overflow-hidden relative">
                        <div
                          className="h-full rounded-xl flex items-center px-3 transition-all duration-700"
                          style={{
                            width: `${Math.max(pct, 14)}%`,
                            background: "linear-gradient(90deg, hsl(var(--navy-700)), hsl(var(--navy)))",
                          }}
                        >
                          <span className="text-[12.5px] font-extrabold tabular-nums text-white ltr-nums">
                            {s.value.toLocaleString(isAr ? "ar-EG" : undefined)}
                          </span>
                        </div>
                      </div>
                      <div className="w-12 text-end text-[12.5px] font-extrabold tabular-nums ltr-nums shrink-0">
                        {conversionPct.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Bottom section */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top Products */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{isAr ? "أكتر المنتجات مبيعاً" : "Top Products"}</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <div className="space-y-0.5">
                {topProducts.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-bold text-muted-foreground/40 w-4 tabular-nums">{i + 1}</span>
                      <span className="text-[13px] font-medium truncate">{p.name}</span>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-[13px] font-semibold tabular-nums">{formatCurrency(p.revenue)}</p>
                      <p className="text-[10px] text-muted-foreground">{p.quantity_sold} {isAr ? "مبيع" : "sold"}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={BarChart3}
                title={isAr ? "مفيش مبيعات لسه" : "No sales yet"}
                description={
                  isAr
                    ? "أول لما تتعمل أوردرات، أكتر منتج هيتباع هيظهر هنا"
                    : "Once you have orders, your bestsellers will appear here"
                }
                className="py-6"
              />
            )}
          </CardContent>
        </Card>

        {/* Sales by Location */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "المبيعات حسب الموقع" : "Sales by Location"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {locations.length > 0 ? (
              <div className="space-y-3">
                {locations.map((loc) => (
                  <div key={loc.location}>
                    <div className="flex items-center justify-between text-[13px] mb-1.5">
                      <span className="font-medium">{loc.location}</span>
                      <span className="font-semibold tabular-nums">{formatCurrency(loc.sales)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/70 rounded-full transition-all duration-500" style={{ width: `${loc.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={MapPin} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>

        {/* Customer Stats */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "إحصائيات العملاء" : "Customer Stats"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customerStats ? (
              <div className="space-y-3">
                {[
                  { label: isAr ? "إجمالي العملاء" : "Total Customers", value: customerStats.total_customers.toLocaleString(isAr ? "ar-EG" : undefined) },
                  { label: isAr ? "عملاء جدد" : "New Customers", value: customerStats.new_customers.toLocaleString(isAr ? "ar-EG" : undefined) },
                  { label: isAr ? "عملاء عائدين" : "Returning", value: customerStats.returning_customers.toLocaleString(isAr ? "ar-EG" : undefined) },
                  { label: isAr ? "متوسط قيمة العميل" : "Avg Customer Value", value: formatCurrency(customerStats.avg_customer_value) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors">
                    <span className="text-[13px] text-muted-foreground">{item.label}</span>
                    <span className="text-[13px] font-semibold tabular-nums">{item.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Users} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* COD Rejection Stats */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "رفض الدفع عند الاستلام" : "COD Rejection Rate"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {codRejection ? (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <p className={`text-4xl font-bold tabular-nums ${codRejection.rejection_rate > 20 ? "text-destructive" : codRejection.rejection_rate > 10 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {codRejection.rejection_rate.toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {isAr ? "معدل الرفض" : "Rejection Rate"}
                  </p>
                </div>
                <div className="space-y-2">
                  {[
                    { label: isAr ? "إجمالي شحنات COD" : "Total COD Shipments", value: codRejection.total_cod_shipments.toLocaleString(isAr ? "ar-EG" : undefined) },
                    { label: isAr ? "تم التسليم" : "Delivered", value: codRejection.delivered_count.toLocaleString(isAr ? "ar-EG" : undefined) },
                    { label: isAr ? "مرفوض" : "Rejected", value: codRejection.rejected_count.toLocaleString(isAr ? "ar-EG" : undefined) },
                    { label: isAr ? "مرتجع" : "Returned", value: codRejection.returned_count.toLocaleString(isAr ? "ar-EG" : undefined) },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors">
                      <span className="text-[13px] text-muted-foreground">{item.label}</span>
                      <span className="text-[13px] font-semibold tabular-nums">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState icon={Package} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "مبالغ COD" : "COD Amounts"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {codRejection ? (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    {isAr ? "إجمالي مبلغ COD" : "Total COD Amount"}
                  </p>
                  <p className="text-2xl font-bold tabular-nums">{formatCurrency(codRejection.total_cod_amount)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    {isAr ? "المبلغ المعرض للخطر" : "Amount at Risk"}
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-destructive">{formatCurrency(codRejection.rejected_amount)}</p>
                </div>
                {codRejection.total_cod_amount > 0 && (
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-destructive/70 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((codRejection.rejected_amount / codRejection.total_cod_amount) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <EmptyState icon={DollarSign} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "الرفض حسب الموقع" : "Rejections by Location"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {codRejection && codRejection.by_location.length > 0 ? (
              <div className="space-y-3">
                {codRejection.by_location.map((loc) => (
                  <div key={loc.location}>
                    <div className="flex items-center justify-between text-[13px] mb-1.5">
                      <span className="font-medium">{loc.location}</span>
                      <span className={`font-semibold tabular-nums ${loc.rate > 20 ? "text-destructive" : ""}`}>
                        {loc.rejected}/{loc.total} ({loc.rate}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${loc.rate > 20 ? "bg-destructive/70" : loc.rate > 10 ? "bg-amber-500/70" : "bg-emerald-500/70"}`}
                        style={{ width: `${loc.rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={MapPin} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
