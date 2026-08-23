import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpTip } from "@/components/ui/help-tip";
import {
  BarChart3, TrendingUp, ShoppingCart, Users, DollarSign,
  MapPin, ArrowUpRight, ArrowDownRight, Package, AlertTriangle,
  Filter,
} from "lucide-react";
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrapezoidFunnel } from "./TrapezoidFunnel";
import { FUNNEL_COLORS } from "./chart-palette";
import { BreakdownPie } from "./BreakdownPie";
import type {
  SalesOverview, SalesDataPoint, TopProduct,
  LocationSales, CustomerAnalytics, ConversionStats,
  CodRejectionStats, FunnelData, TrafficSourceData, OrdersBreakdown,
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
  trafficSources: TrafficSourceData[];
  ordersBreakdown: OrdersBreakdown | null;
  formatCurrency: (cents: number) => string;
}

export function OverviewTab({
  overview, chartData, topProducts, locations,
  customerStats, conversion, codRejection, funnel,
  trafficSources, ordersBreakdown, formatCurrency,
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

  const locale = isAr ? "ar-EG" : undefined;
  const fmtNum = (n: number) => n.toLocaleString(locale);

  // ── Funnel stages (Zid order) from the real /analytics/funnel counts ──
  const stepCount = (name: string) => funnel?.steps.find((s) => s.step === name)?.count ?? 0;
  const funnelStages = [
    { key: "page_view", label: isAr ? "زيارة" : "Visit", value: stepCount("page_view") },
    { key: "product_view", label: isAr ? "شاف منتج" : "View product", value: stepCount("product_view") },
    { key: "add_to_cart", label: isAr ? "ضاف للسلة" : "Add to cart", value: stepCount("add_to_cart") },
    { key: "checkout_started", label: isAr ? "بدأ الدفع" : "Checkout started", value: stepCount("checkout_started") },
    { key: "order_completed", label: isAr ? "اشترى" : "Purchase done", value: stepCount("order_completed") },
  ];
  const visits = funnelStages[0].value || conversion?.total_visitors || 0;
  const midFunnel = funnelStages.some((s, i) => i > 0 && s.value > funnelStages[i - 1].value);

  // ── Pie data ──
  const PAYMENT_LABELS: Record<string, string> = {
    cod: isAr ? "الدفع عند الاستلام" : "Cash on delivery",
    cash_on_delivery: isAr ? "الدفع عند الاستلام" : "Cash on delivery",
    cash: isAr ? "كاش" : "Cash",
    instapay: "InstaPay",
    vodafone_cash: isAr ? "فودافون كاش" : "Vodafone Cash",
    card: isAr ? "بطاقة" : "Card",
    credit_card: isAr ? "بطاقة" : "Card",
    wallet: isAr ? "محفظة" : "Wallet",
    unknown: isAr ? "غير محدد" : "Undefined",
  };
  const pretty = (raw: string, map?: Record<string, string>) => {
    const k = raw.toLowerCase();
    if (map?.[k]) return map[k];
    if (k === "unknown" || k === "") return isAr ? "غير محدد" : "Undefined";
    return raw.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };
  const paymentPie = (ordersBreakdown?.by_payment_method ?? [])
    .filter((m) => m.count > 0)
    .map((m) => ({ name: pretty(m.method, PAYMENT_LABELS), value: m.count }));
  const shippingPie = (ordersBreakdown?.by_shipping_method ?? [])
    .filter((m) => m.count > 0)
    .map((m) => ({ name: pretty(m.method), value: m.count }));
  const sourcesPie = trafficSources
    .filter((s) => s.orders > 0)
    .map((s) => ({ name: pretty(s.source || "direct"), value: s.orders }));

  const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", boxShadow: "var(--shadow-pop)", fontSize: "12px" } as const;
  const axisTick = { fill: "hsl(var(--muted-foreground))", fontSize: 10 };

  const SectionHead = ({ title, sub, aside }: { title: string; sub?: string; aside?: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-1">
      <div>
        <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</p>}
      </div>
      {aside}
    </div>
  );

  return (
    <>
      {/* KPI strip — Zid-style: label, value + unit, icon box */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: isAr ? "إجمالي المبيعات" : "Total sales",
            value: overview ? formatCurrency(overview.total_sales) : "—",
            sub: overview?.collected_revenue !== undefined
              ? `${isAr ? "المحصّل: " : "Collected: "}${formatCurrency(overview.collected_revenue)}`
              : undefined,
            trend: overview?.sales_change_percent, icon: DollarSign,
          },
          { label: isAr ? "عدد الطلبات" : "Number of orders", value: overview ? `${fmtNum(overview.total_orders)} ${isAr ? "طلب" : "Orders"}` : "—", sub: undefined, trend: overview?.orders_change_percent, icon: ShoppingCart },
          { label: isAr ? "الجلسات" : "Sessions", value: `${fmtNum(visits)} ${isAr ? "زيارة" : "Visit"}`, sub: undefined, trend: undefined, icon: Filter },
          { label: isAr ? "العملاء" : "Customers", value: customerStats ? `${fmtNum(customerStats.total_customers)} ${isAr ? "عميل" : "Customers"}` : "—", sub: undefined, trend: undefined, icon: Users },
        ].map((kpi) => (
          <Card key={kpi.label} className="overflow-hidden">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-[11.5px] font-semibold text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 truncate text-[17px] font-extrabold tracking-tight tabular-nums leading-none">{kpi.value}</p>
                {(kpi.sub || kpi.trend !== undefined) && (
                  <div className="mt-1.5 flex items-center gap-2">
                    {kpi.trend !== undefined && <TrendBadge value={kpi.trend} />}
                    {kpi.sub && <span className="truncate text-[11px] font-semibold text-muted-foreground tabular-nums">{kpi.sub}</span>}
                  </div>
                )}
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground">
                <kpi.icon className="h-4 w-4" strokeWidth={2} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 1: Sales over time · Customer funnel */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHead title={isAr ? "قيمة المبيعات عبر الوقت" : "Sales value over time"} />
          <CardContent>
            <div className="h-[260px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSalesNavy" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--navy))" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="hsl(var(--navy))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 5" className="stroke-border/40" vertical={false} />
                    <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 100).toLocaleString()}`} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === "prev_sales" ? (isAr ? "الفترة السابقة" : "Previous period") : (isAr ? "المبيعات" : "Sales"),
                      ]}
                    />
                    {hasCompare && (
                      <Line type="monotone" dataKey="prev_sales" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 4" dot={false} opacity={0.7} />
                    )}
                    <Area type="monotone" dataKey="sales" stroke="hsl(var(--navy))" fill="url(#colorSalesNavy)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={TrendingUp} title={isAr ? "مفيش بيانات" : "No data available"} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <SectionHead
            title={isAr ? "مسار العميل" : "Customer funnel"}
            sub={isAr ? "عدد الزيارات في كل مرحلة من رحلة العميل" : "Number of visits at each stage in customer funnel"}
          />
          <CardContent className="pb-4">
            {funnel && visits > 0 ? (
              <>
                <TrapezoidFunnel stages={funnelStages} locale={locale} rtl={isAr} className="max-h-[240px]" />
                <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1">
                  {funnelStages.map((s, i) => (
                    <div key={s.key} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: FUNNEL_COLORS[i] }} />
                      <span className="text-[11px] text-muted-foreground">{s.label}</span>
                    </div>
                  ))}
                </div>
                {midFunnel && (
                  <HelpTip title={t("analytics.funnel.midFunnel")} className="mt-3">
                    <p className="px-4 pb-3 text-xs text-blue-900/80 dark:text-blue-200/80">
                      {t("analytics.funnel.stepRateHint")}
                    </p>
                  </HelpTip>
                )}
              </>
            ) : (
              <div className="h-[240px]">
                <EmptyState icon={Filter} title={isAr ? "مفيش زيارات في الفترة دي" : "No visits in this range"} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Orders over time · Visit sources */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHead title={isAr ? "الطلبات عبر الوقت" : "Orders over time"} />
          <CardContent>
            <div className="h-[260px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorOrdersNavy" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--navy))" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="hsl(var(--navy))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 5" className="stroke-border/40" vertical={false} />
                    <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number, name: string) => [
                        value,
                        name === "prev_orders" ? (isAr ? "الفترة السابقة" : "Previous period") : (isAr ? "الطلبات" : "Orders"),
                      ]}
                    />
                    {hasCompare && (
                      <Line type="monotone" dataKey="prev_orders" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 4" dot={false} opacity={0.7} />
                    )}
                    <Area type="monotone" dataKey="orders" stroke="hsl(var(--navy))" fill="url(#colorOrdersNavy)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={ShoppingCart} title={isAr ? "مفيش بيانات" : "No data available"} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <SectionHead
            title={isAr ? "مصادر الزيارات" : "Visit sources"}
            sub={isAr ? "العملاء اللي طلبوا جم منين" : "Where your ordering customers come from"}
          />
          <CardContent>
            {sourcesPie.length > 0 ? (
              <BreakdownPie data={sourcesPie} locale={locale} />
            ) : (
              <div className="h-[240px]"><EmptyState icon={TrendingUp} title={isAr ? "مفيش بيانات" : "No data"} /></div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Payment method · Shipping method */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHead
            title={isAr ? "طريقة الدفع" : "Payment method"}
            sub={isAr ? "توزيع طرق الدفع المستخدمة" : "Distribution of payment methods used"}
          />
          <CardContent>
            {paymentPie.length > 0 ? (
              <BreakdownPie data={paymentPie} locale={locale} />
            ) : (
              <div className="h-[240px]"><EmptyState icon={DollarSign} title={isAr ? "مفيش بيانات" : "No data"} /></div>
            )}
          </CardContent>
        </Card>
        <Card>
          <SectionHead
            title={isAr ? "طريقة الشحن" : "Shipping method"}
            sub={isAr ? "عدد الطلبات حسب طريقة الشحن" : "Share of orders by shipping method"}
          />
          <CardContent>
            {shippingPie.length > 0 ? (
              <BreakdownPie data={shippingPie} locale={locale} />
            ) : (
              <div className="h-[240px]"><EmptyState icon={Package} title={isAr ? "مفيش بيانات" : "No data"} /></div>
            )}
          </CardContent>
        </Card>
      </div>

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
                    // Backend: rejected = returned ∪ cancelled, so "Rejected"
                    // and "Returned" are NOT disjoint rows — label it so.
                    { label: t("analytics.cod.rejectedOrReturned"), value: codRejection.rejected_count.toLocaleString(isAr ? "ar-EG" : undefined) },
                    { label: isAr ? "منها مرتجع" : "of which returned", value: codRejection.returned_count.toLocaleString(isAr ? "ar-EG" : undefined) },
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
                    {/* Was "Amount at Risk" — but the backend sums orders
                        already cancelled/returned. That's money lost, not
                        money at risk. */}
                    {t("analytics.cod.lostToRejections")}
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-destructive">{formatCurrency(codRejection.rejected_amount)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{t("analytics.cod.lostHint")}</p>
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
      {/* Which cohort these COD numbers describe, and where cash matching
          lives — the reviewer couldn't tell how this section relates to
          the reconciliation page. */}
      <p className="text-[11.5px] text-muted-foreground -mt-2">
        {t("analytics.cod.footnote")}{" "}
        <Link to="/cod" className="font-semibold underline underline-offset-2 hover:text-foreground">
          {t("analytics.cod.seeReconcile")}
        </Link>
        .
      </p>
    </>
  );
}
