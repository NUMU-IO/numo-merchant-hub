import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BarChart3, TrendingUp, ShoppingCart, Users, DollarSign,
  MapPin, ArrowUpRight, ArrowDownRight, Package, AlertTriangle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import type {
  SalesOverview, SalesDataPoint, TopProduct,
  LocationSales, CustomerAnalytics, ConversionStats,
  CodRejectionStats,
} from "@/services/analyticsApi";

interface OverviewTabProps {
  overview: SalesOverview | null;
  chartData: SalesDataPoint[];
  topProducts: TopProduct[];
  locations: LocationSales[];
  customerStats: CustomerAnalytics | null;
  conversion: ConversionStats | null;
  codRejection: CodRejectionStats | null;
  formatCurrency: (cents: number) => string;
}

export function OverviewTab({
  overview, chartData, topProducts, locations,
  customerStats, conversion, codRejection, formatCurrency,
}: OverviewTabProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const TrendBadge = ({ value }: { value: number | undefined }) => {
    if (value === undefined || value === null) return null;
    const positive = value >= 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
        {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {positive ? "+" : ""}{value.toFixed(1)}%
      </span>
    );
  };

  return (
    <>
      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: isAr ? "إجمالي المبيعات" : "Total Sales", value: overview ? formatCurrency(overview.total_sales) : "—", trend: overview?.sales_change_percent, icon: DollarSign, bg: "bg-emerald-500/8 dark:bg-emerald-500/15", iconColor: "text-emerald-600 dark:text-emerald-400" },
          { label: isAr ? "إجمالي الطلبات" : "Total Orders", value: overview?.total_orders ?? "—", trend: overview?.orders_change_percent, icon: ShoppingCart, bg: "bg-blue-500/8 dark:bg-blue-500/15", iconColor: "text-blue-600 dark:text-blue-400" },
          { label: isAr ? "متوسط قيمة الطلب" : "Avg Order Value", value: overview ? formatCurrency(overview.avg_order_value) : "—", trend: undefined, icon: TrendingUp, bg: "bg-amber-500/8 dark:bg-amber-500/15", iconColor: "text-amber-600 dark:text-amber-400" },
          { label: isAr ? "معدل التحويل" : "Conversion Rate", value: conversion ? `${conversion.conversion_rate.toFixed(1)}%` : "—", trend: undefined, icon: BarChart3, bg: "bg-violet-500/8 dark:bg-violet-500/15", iconColor: "text-violet-600 dark:text-violet-400" },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${kpi.bg}`}>
                  <kpi.icon className={`h-3.5 w-3.5 ${kpi.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">{kpi.value}</p>
              {kpi.trend !== undefined && <TrendBadge value={kpi.trend} />}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{isAr ? "المبيعات" : "Sales"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 100).toLocaleString()}`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px" }}
                      formatter={(value: number) => [formatCurrency(value), isAr ? "المبيعات" : "Sales"]}
                    />
                    <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" fill="url(#colorSales)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={TrendingUp} title={isAr ? "مفيش بيانات" : "No data available"} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{isAr ? "الطلبات" : "Orders"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px" }}
                      formatter={(value: number) => [value, isAr ? "الطلبات" : "Orders"]}
                    />
                    <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={ShoppingCart} title={isAr ? "مفيش بيانات" : "No data available"} />
              )}
            </div>
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
