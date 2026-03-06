import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useState, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import {
  getDashboardStats, getRevenueChart, getTopProducts,
} from "@/services/analyticsApi";
import { listOrders } from "@/services/orderApi";
import { TrendingUp, ShoppingCart, Users, DollarSign, ArrowUpRight, Package, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCountUp } from "@/hooks/useCountUp";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";

const Dashboard = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const { user } = useAuth();
  const storeId = currentStore?.id;
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");
  const navigate = useNavigate();
  const isAr = language === "ar";

  const periodDays = { "7d": 7, "30d": 30, "90d": 90 };

  const statsQuery = useQuery({
    queryKey: ["dashboard", "stats", storeId, period],
    queryFn: () => getDashboardStats(storeId!, periodDays[period]),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const chartQuery = useQuery({
    queryKey: ["dashboard", "chart", storeId, period],
    queryFn: () => getRevenueChart(storeId!, periodDays[period]),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const topProductsQuery = useQuery({
    queryKey: ["dashboard", "topProducts", storeId],
    queryFn: () => getTopProducts(storeId!, 5),
    enabled: !!storeId,
  });

  const recentOrdersQuery = useQuery({
    queryKey: ["dashboard", "recentOrders", storeId],
    queryFn: () => listOrders(storeId!, { page: 1, limit: 5 }),
    enabled: !!storeId,
  });

  const stats = statsQuery.data ?? null;
  const chartData = chartQuery.data ?? [];
  const topProducts = topProductsQuery.data ?? [];
  const recentOrders = recentOrdersQuery.data?.items ?? [];

  const formatCurrency = (cents: number) => {
    const val = cents / 100;
    return isAr ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;
  };

  const todayRevenue = stats ? stats.total_revenue : 0;
  const todayOrders = stats ? stats.total_orders : 0;
  const newCustomers = stats ? stats.new_customers : 0;
  const avgOrder = stats ? stats.avg_order_value : 0;

  const animRevenue = useCountUp(todayRevenue / 100, 1400);
  const animOrders = useCountUp(todayOrders, 800);
  const animCustomers = useCountUp(newCustomers, 800);
  const animAvg = useCountUp(avgOrder / 100, 1200);

  const trendPercent = stats?.revenue_change_percent ?? 0;
  const trendStr = trendPercent >= 0 ? `+${trendPercent.toFixed(0)}%` : `${trendPercent.toFixed(0)}%`;

  const kpis = [
    { label: t("dashboard.todayRevenue"), value: formatCurrency(animRevenue * 100), icon: DollarSign, trend: trendStr, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
    { label: t("dashboard.todayOrders"), value: animOrders, icon: ShoppingCart, trend: `${todayOrders}`, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
    { label: t("dashboard.newCustomers"), value: animCustomers, icon: Users, trend: `${newCustomers}`, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10" },
    { label: t("dashboard.avgOrderValue"), value: formatCurrency(animAvg * 100), icon: TrendingUp, trend: "-", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
  ];

  const statusColorMap: Record<string, string> = {
    delivered: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    fulfilled: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    shipped: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    confirmed: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
    processing: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    pending: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive",
  };

  const orderStatusData = useMemo(() => stats ? [
    { name: "Delivered", nameAr: "تم التسليم", value: stats.completed_orders, fill: "hsl(142 71% 45%)" },
    { name: "Shipped", nameAr: "تم الشحن", value: stats.shipped_orders, fill: "hsl(210 90% 55%)" },
    { name: "Processing", nameAr: "قيد المعالجة", value: stats.processing_orders, fill: "hsl(38 92% 50%)" },
    { name: "Confirmed", nameAr: "تم التأكيد", value: stats.confirmed_orders, fill: "hsl(170 70% 45%)" },
    { name: "Pending", nameAr: "في الانتظار", value: stats.pending_orders, fill: "hsl(215 16% 47%)" },
    { name: "Cancelled", nameAr: "ملغي", value: stats.cancelled_orders, fill: "hsl(0 84% 60%)" },
  ].filter(d => d.value > 0) : [], [stats]);

  const revenueChartData = useMemo(() => chartData.map(d => ({
    day: d.date.slice(5),
    revenue: d.revenue / 100,
  })), [chartData]);

  if (statsQuery.isLoading && !stats) {
    return <DashboardSkeleton />;
  }

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard.goodMorning");
    if (hour < 18) return t("dashboard.goodAfternoon");
    return t("dashboard.goodEvening");
  })();

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {greeting}, {user?.first_name || currentStore?.name || t("dashboard.merchantName")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("dashboard.storeOverview")}
          </p>
        </div>
        <div className="hidden sm:flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <Eye className="h-3.5 w-3.5" />
            {t("dashboard.viewStore")}
          </Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => navigate("/products")}>
            <Package className="h-3.5 w-3.5" />
            {t("products.addProduct")}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <Card key={kpi.label} className="animate-fade-up" style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.bg}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight tabular-nums">{kpi.value}</p>
              {i === 0 && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${trendPercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    <ArrowUpRight className={`h-3 w-3 ${trendPercent < 0 ? "rotate-90" : ""}`} />
                    {trendStr}
                  </span>
                  <span className="text-xs text-muted-foreground">{t("dashboard.vsYesterday")}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("dashboard.revenueTrend")}</CardTitle>
              <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                {(["7d", "30d", "90d"] as const).map((p) => (
                  <Button
                    key={p}
                    variant={period === p ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs px-2.5 rounded-md"
                    onClick={() => setPeriod(p)}
                  >
                    {t(`dashboard.last${p === "7d" ? "7days" : p === "30d" ? "30days" : "90days"}`)}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {revenueChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        boxShadow: "var(--shadow-lg)",
                        fontSize: "13px",
                      }}
                      formatter={(value: number) => [formatCurrency(value * 100), t("dashboard.todayRevenue")]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#colorRevenue)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  icon={TrendingUp}
                  title={isAr ? "لا توجد بيانات بعد" : "No revenue data yet"}
                  description={isAr ? "ستظهر البيانات هنا مع أول طلب" : "Data will appear here with your first order"}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Order Status Donut */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.orderStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            {orderStatusData.length > 0 ? (
              <>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={orderStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} strokeWidth={2} stroke="hsl(var(--card))">
                        {orderStatusData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "13px",
                        }}
                        formatter={(value: number, name: string) => {
                          const item = orderStatusData.find(d => d.name === name);
                          return [value, isAr && item ? item.nameAr : name];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {orderStatusData.map((s) => (
                    <div key={s.name} className="flex items-center gap-2 text-xs rounded-md p-1.5 hover:bg-muted/50 transition-colors">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.fill }} />
                      <span className="text-muted-foreground truncate">{isAr ? s.nameAr : s.name}</span>
                      <span className="font-semibold ms-auto tabular-nums">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                icon={ShoppingCart}
                title={isAr ? "لا توجد طلبات بعد" : "No orders yet"}
                className="py-8"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("dashboard.topProducts")}</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" onClick={() => navigate("/products")}>
                {t("dashboard.viewAll")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <div className="space-y-1">
                {topProducts.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg p-2 -mx-2 transition-colors hover:bg-muted/50 cursor-pointer">
                    <span className="text-xs font-bold text-muted-foreground/50 w-5 text-center tabular-nums">{i + 1}</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-sm shrink-0">📦</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.quantity_sold} {t("dashboard.units")}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(p.revenue)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Package} title={isAr ? "لا توجد منتجات بعد" : "No products yet"} className="py-6" />
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("dashboard.recentOrders")}</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" onClick={() => navigate("/orders")}>
                {t("dashboard.viewAll")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentOrders.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-xs">{t("dashboard.order")}</TableHead>
                    <TableHead className="text-xs">{t("dashboard.customer")}</TableHead>
                    <TableHead className="text-xs">{t("dashboard.total")}</TableHead>
                    <TableHead className="text-xs">{t("dashboard.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((o) => (
                    <TableRow key={o.id} className="table-row-interactive" onClick={() => navigate("/orders")}>
                      <TableCell className="font-medium text-sm">{o.order_number}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{o.customer_name || "-"}</TableCell>
                      <TableCell className="text-sm tabular-nums font-medium">{formatCurrency(o.total)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-[11px] font-medium px-2 py-0.5 ${statusColorMap[o.status] || ""}`}>
                          {t(`orders.${o.status}`)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState icon={ShoppingCart} title={isAr ? "لا توجد طلبات بعد" : "No orders yet"} className="py-6" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
