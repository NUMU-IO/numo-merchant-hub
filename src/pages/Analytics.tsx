import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3, TrendingUp, ShoppingCart, Users, DollarSign,
  MapPin, ArrowUpRight, ArrowDownRight, RefreshCw,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  getSalesOverview, getSalesChart, getAnalyticsTopProducts,
  getSalesByLocation, getCustomerAnalytics, getConversionStats,
} from "@/services/analyticsApi";
import type {
  SalesOverview, SalesDataPoint, TopProduct,
  LocationSales, CustomerAnalytics, ConversionStats,
} from "@/services/analyticsApi";
import { AnalyticsSkeleton } from "@/components/skeletons/AnalyticsSkeleton";

type Period = 7 | 30 | 90;

export default function Analytics() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const [period, setPeriod] = useState<Period>(30);

  // React Query hooks
  const overviewQuery = useQuery({
    queryKey: ["analytics", "overview", storeId, period],
    queryFn: () => getSalesOverview(storeId!, period),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const chartQuery = useQuery({
    queryKey: ["analytics", "chart", storeId, period],
    queryFn: () => getSalesChart(storeId!, period),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const topProductsQuery = useQuery({
    queryKey: ["analytics", "topProducts", storeId, period],
    queryFn: () => getAnalyticsTopProducts(storeId!, period, 5),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const locationsQuery = useQuery({
    queryKey: ["analytics", "locations", storeId, period],
    queryFn: () => getSalesByLocation(storeId!, period),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const customerStatsQuery = useQuery({
    queryKey: ["analytics", "customers", storeId, period],
    queryFn: () => getCustomerAnalytics(storeId!, period),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const conversionQuery = useQuery({
    queryKey: ["analytics", "conversion", storeId, period],
    queryFn: () => getConversionStats(storeId!, period),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const overview = overviewQuery.data ?? null;
  const chartData = chartQuery.data ?? [];
  const topProducts = topProductsQuery.data ?? [];
  const locations = locationsQuery.data ?? [];
  const customerStats = customerStatsQuery.data ?? null;
  const conversion = conversionQuery.data ?? null;

  const isLoading = overviewQuery.isLoading;
  const isRefetching = overviewQuery.isFetching;

  const handleRefresh = () => {
    overviewQuery.refetch();
    chartQuery.refetch();
    topProductsQuery.refetch();
    locationsQuery.refetch();
    customerStatsQuery.refetch();
    conversionQuery.refetch();
  };

  const formatCurrency = (cents: number) => {
    const val = cents / 100;
    return isAr ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;
  };

  const TrendBadge = ({ value }: { value: number | undefined }) => {
    if (value === undefined || value === null) return null;
    const positive = value >= 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? "text-emerald-600" : "text-red-500"}`}>
        {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {positive ? "+" : ""}{value.toFixed(1)}%
      </span>
    );
  };

  const periodLabels: Record<Period, string> = {
    7: isAr ? "٧ أيام" : "7 days",
    30: isAr ? "٣٠ يوم" : "30 days",
    90: isAr ? "٩٠ يوم" : "90 days",
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            {t("nav.analytics")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAr ? "تقارير وإحصائيات متجرك" : "Your store reports and statistics"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {([7, 30, 90] as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {periodLabels[p]}
            </Button>
          ))}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isLoading && !overview ? (
        <AnalyticsSkeleton />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{isAr ? "إجمالي المبيعات" : "Total Sales"}</p>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold mt-2">{overview ? formatCurrency(overview.total_sales) : "—"}</p>
                <TrendBadge value={overview?.sales_change_percent} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{isAr ? "إجمالي الطلبات" : "Total Orders"}</p>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold mt-2">{overview?.total_orders ?? "—"}</p>
                <TrendBadge value={overview?.orders_change_percent} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{isAr ? "متوسط قيمة الطلب" : "Avg Order Value"}</p>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold mt-2">{overview ? formatCurrency(overview.avg_order_value) : "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{isAr ? "معدل التحويل" : "Conversion Rate"}</p>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold mt-2">{conversion ? `${conversion.conversion_rate.toFixed(1)}%` : "—"}</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{isAr ? "المبيعات" : "Sales"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 100).toLocaleString()}`} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                          formatter={(value: number) => [formatCurrency(value), isAr ? "المبيعات" : "Sales"]}
                        />
                        <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" fill="url(#colorSales)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      {isAr ? "مفيش بيانات" : "No data available"}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{isAr ? "الطلبات" : "Orders"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                          formatter={(value: number) => [value, isAr ? "الطلبات" : "Orders"]}
                        />
                        <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      {isAr ? "مفيش بيانات" : "No data available"}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom section: Top Products, Locations, Customer Stats */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{isAr ? "أكتر المنتجات مبيعاً" : "Top Products"}</CardTitle>
              </CardHeader>
              <CardContent>
                {topProducts.length > 0 ? (
                  <div className="space-y-3">
                    {topProducts.map((p, i) => (
                      <div key={p.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                          <span className="text-sm truncate">{p.name}</span>
                        </div>
                        <div className="text-end shrink-0">
                          <p className="text-sm font-medium tabular-nums">{formatCurrency(p.revenue)}</p>
                          <p className="text-xs text-muted-foreground">{p.quantity_sold} {isAr ? "مبيع" : "sold"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {isAr ? "مفيش بيانات" : "No data"}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Sales by Location */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {isAr ? "المبيعات حسب الموقع" : "Sales by Location"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {locations.length > 0 ? (
                  <div className="space-y-3">
                    {locations.map((loc) => (
                      <div key={loc.location}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>{loc.location}</span>
                          <span className="font-medium tabular-nums">{formatCurrency(loc.sales)}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${loc.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {isAr ? "مفيش بيانات" : "No data"}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Customer Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {isAr ? "إحصائيات العملاء" : "Customer Stats"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {customerStats ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{isAr ? "إجمالي العملاء" : "Total Customers"}</span>
                      <span className="text-sm font-bold tabular-nums">{customerStats.total_customers.toLocaleString(isAr ? "ar-EG" : undefined)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{isAr ? "عملاء جدد" : "New Customers"}</span>
                      <span className="text-sm font-bold tabular-nums">{customerStats.new_customers.toLocaleString(isAr ? "ar-EG" : undefined)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{isAr ? "عملاء عائدين" : "Returning"}</span>
                      <span className="text-sm font-bold tabular-nums">{customerStats.returning_customers.toLocaleString(isAr ? "ar-EG" : undefined)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{isAr ? "متوسط قيمة العميل" : "Avg Customer Value"}</span>
                      <span className="text-sm font-bold tabular-nums">{formatCurrency(customerStats.avg_customer_value)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {isAr ? "مفيش بيانات" : "No data"}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
