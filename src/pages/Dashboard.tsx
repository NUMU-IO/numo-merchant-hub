import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useState, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  getDashboardStats, getRevenueChart, getTopProducts,
} from "@/services/analyticsApi";
import { listOrders } from "@/services/orderApi";
import { getStoreUrl } from "@/lib/storefront";
import {
  TrendingUp, ShoppingCart, Users, ArrowUpRight, ArrowDownRight,
  Package, ExternalLink, AlertTriangle, Clock, ChevronRight,
  Plus, CreditCard, Palette, CheckCircle2, Circle, Truck, Receipt,
  Gift, Star, Crown, Lock, Zap,
} from "lucide-react";
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
  const trendStr = trendPercent >= 0 ? `+${trendPercent.toFixed(1)}%` : `${trendPercent.toFixed(1)}%`;

  // Action items
  const pendingCount = stats ? stats.pending_orders + stats.processing_orders : 0;
  const lowStockCount = stats?.low_stock_count ?? 0;
  const totalProducts = stats?.total_products ?? 0;
  const shippedCount = stats?.shipped_orders ?? 0;

  // Setup progress — determine if store is new/incomplete
  const setupSteps = useMemo(() => {
    if (!currentStore || !stats) return [];
    const steps = [
      {
        key: "products",
        label: isAr ? "أضف أول منتج" : "Add your first product",
        done: totalProducts > 0,
        action: () => navigate("/products/new"),
        cta: isAr ? "إضافة منتج" : "Add product",
      },
      {
        key: "store",
        label: isAr ? "خصّص متجرك" : "Customize your store",
        done: !!(currentStore.logo_url || currentStore.description),
        action: () => navigate("/store"),
        cta: isAr ? "تخصيص" : "Customize",
      },
      {
        key: "order",
        label: isAr ? "استلم أول طلب" : "Get your first order",
        done: stats.total_orders > 0,
        action: () => {
          const url = getStoreUrl(currentStore);
          if (url) window.open(url, "_blank");
        },
        cta: isAr ? "شارك متجرك" : "Share store",
      },
    ];
    return steps;
  }, [currentStore, stats, totalProducts, isAr, navigate]);

  const setupComplete = setupSteps.length > 0 && setupSteps.every(s => s.done);
  const setupProgress = setupSteps.length > 0 ? setupSteps.filter(s => s.done).length : 0;
  const showSetup = setupSteps.length > 0 && !setupComplete;

  // Milestones — gamification for early merchants
  const milestones = useMemo(() => {
    if (!stats) return [];
    const orderCount = stats.total_orders;
    if (orderCount >= 100) return []; // All done — hide for mature stores
    return [
      {
        target: 5,
        label: isAr ? "أول 5 طلبات" : "First 5 orders",
        reward: isAr ? "خصم 10% على اشتراكك" : "10% off subscription",
        rewardFull: isAr ? "خصم 10% على اشتراكك الشهري القادم" : "10% off your next monthly subscription",
        current: Math.min(orderCount, 5),
        percent: Math.min(100, Math.round((orderCount / 5) * 100)),
        done: orderCount >= 5,
        gradient: "from-amber-500 to-orange-500",
        bgGradient: "from-amber-500/[0.08] via-orange-500/[0.04] to-transparent",
        borderColor: "border-amber-300/40 dark:border-amber-700/30",
        textColor: "text-amber-700 dark:text-amber-300",
        barColor: "from-amber-400 to-orange-500",
        icon: Zap,
      },
      {
        target: 25,
        label: isAr ? "25 طلب" : "25 orders",
        reward: isAr ? "شهر مجاني" : "1 free month",
        rewardFull: isAr ? "شهر مجاني على باقتك الحالية" : "1 free month on your current plan",
        current: Math.min(orderCount, 25),
        percent: Math.min(100, Math.round((orderCount / 25) * 100)),
        done: orderCount >= 25,
        gradient: "from-blue-500 to-indigo-500",
        bgGradient: "from-blue-500/[0.08] via-indigo-500/[0.04] to-transparent",
        borderColor: "border-blue-300/40 dark:border-blue-700/30",
        textColor: "text-blue-700 dark:text-blue-300",
        barColor: "from-blue-400 to-indigo-500",
        icon: Star,
      },
      {
        target: 100,
        label: isAr ? "100 طلب" : "100 orders",
        reward: isAr ? "ترقية مجانية" : "Free plan upgrade",
        rewardFull: isAr ? "ترقية مجانية للباقة الأعلى لمدة شهر" : "Free upgrade to next plan for 1 month",
        current: Math.min(orderCount, 100),
        percent: Math.min(100, Math.round((orderCount / 100) * 100)),
        done: orderCount >= 100,
        gradient: "from-violet-500 to-purple-600",
        bgGradient: "from-violet-500/[0.08] via-purple-500/[0.04] to-transparent",
        borderColor: "border-violet-300/40 dark:border-violet-700/30",
        textColor: "text-violet-700 dark:text-violet-300",
        barColor: "from-violet-400 to-purple-600",
        icon: Crown,
      },
    ];
  }, [stats, isAr]);

  const statusColorMap: Record<string, string> = {
    delivered: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    fulfilled: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    shipped: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    confirmed: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800",
    processing: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    pending: "bg-muted text-muted-foreground border-border",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  };

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

  // Contextual summary line
  const summaryLine = (() => {
    if (!stats) return t("dashboard.storeOverview");
    if (stats.total_orders === 0) return isAr ? "ابدأ بإضافة منتجاتك واستقبال أول طلب" : "Start by adding products and getting your first order";
    if (pendingCount > 0) return isAr ? `عندك ${pendingCount} طلبات محتاجة اهتمامك` : `You have ${pendingCount} order${pendingCount > 1 ? "s" : ""} needing attention`;
    if (trendPercent > 0) return isAr ? `الإيرادات زادت ${trendStr} عن الفترة السابقة` : `Revenue is up ${trendStr} from last period`;
    return t("dashboard.storeOverview");
  })();

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {greeting}, {user?.first_name || currentStore?.name || t("dashboard.merchantName")}
          </h1>
          <p className="text-[13px] text-muted-foreground/80 mt-0.5">{summaryLine}</p>
        </div>
        <div className="hidden sm:flex gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs rounded-lg border-border/60" onClick={() => {
            const url = getStoreUrl(currentStore!);
            if (url) window.open(url, "_blank");
          }}>
            <ExternalLink className="h-3 w-3" />
            {t("dashboard.viewStore")}
          </Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs rounded-lg" onClick={() => navigate("/products/new")}>
            <Plus className="h-3 w-3" />
            {t("products.addProduct")}
          </Button>
        </div>
      </div>

      {/* Setup Progress — only show for new/incomplete stores */}
      {showSetup && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-semibold">{isAr ? "جهّز متجرك" : "Set up your store"}</p>
              <span className="text-[11px] text-muted-foreground tabular-nums">{setupProgress}/{setupSteps.length}</span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-muted/60 mb-4 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(setupProgress / setupSteps.length) * 100}%` }}
              />
            </div>
            <div className="space-y-2">
              {setupSteps.map((step) => (
                <div key={step.key} className="flex items-center gap-3">
                  {step.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                  )}
                  <span className={`text-[13px] flex-1 ${step.done ? "text-muted-foreground line-through" : "font-medium"}`}>
                    {step.label}
                  </span>
                  {!step.done && (
                    <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg" onClick={step.action}>
                      {step.cta}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attention Needed */}
      {(pendingCount > 0 || lowStockCount > 0) && (
        <div className="flex flex-col sm:flex-row gap-2">
          {pendingCount > 0 && (
            <button
              onClick={() => navigate("/orders")}
              className="flex items-center gap-3 flex-1 p-3.5 rounded-xl border border-amber-200/70 dark:border-amber-800/40 bg-amber-500/[0.04] hover:bg-amber-500/[0.07] transition-colors text-left group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 shrink-0">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold">
                  {pendingCount} {isAr ? "طلبات تحتاج تنفيذ" : `order${pendingCount > 1 ? "s" : ""} need fulfillment`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isAr ? "طلبات في الانتظار أو قيد المعالجة" : "Pending or processing — take action"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
            </button>
          )}
          {lowStockCount > 0 && (
            <button
              onClick={() => navigate("/products")}
              className="flex items-center gap-3 flex-1 p-3.5 rounded-xl border border-red-200/70 dark:border-red-800/40 bg-red-500/[0.04] hover:bg-red-500/[0.07] transition-colors text-left group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 shrink-0">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold">
                  {lowStockCount} {isAr ? "منتجات مخزونها منخفض" : `product${lowStockCount > 1 ? "s" : ""} low on stock`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isAr ? "يحتاج إعادة تخزين" : "Restock needed"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
            </button>
          )}
        </div>
      )}

      {/* Quick Actions — mobile + always visible */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button onClick={() => navigate("/orders")} className="flex items-center gap-2.5 p-3 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors text-left">
          <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-[12px] font-medium">{isAr ? "الطلبات" : "Orders"}</span>
          {pendingCount > 0 && <span className="ms-auto text-[10px] font-bold text-amber-600 bg-amber-500/10 rounded-full px-1.5 py-0.5">{pendingCount}</span>}
        </button>
        <button onClick={() => navigate("/products/new")} className="flex items-center gap-2.5 p-3 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors text-left">
          <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-[12px] font-medium">{isAr ? "منتج جديد" : "Add Product"}</span>
        </button>
        <button onClick={() => navigate("/invoices")} className="flex items-center gap-2.5 p-3 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors text-left">
          <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-[12px] font-medium">{isAr ? "الفواتير" : "Invoices"}</span>
        </button>
        <button onClick={() => navigate("/customers")} className="flex items-center gap-2.5 p-3 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors text-left">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-[12px] font-medium">{isAr ? "العملاء" : "Customers"}</span>
          {newCustomers > 0 && <span className="ms-auto text-[10px] font-bold text-primary bg-primary/10 rounded-full px-1.5 py-0.5">+{newCustomers}</span>}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t("dashboard.todayRevenue"), value: formatCurrency(animRevenue * 100), trend: trendPercent, trendLabel: trendStr, sub: t("dashboard.vsYesterday") },
          { label: t("dashboard.todayOrders"), value: animOrders, trend: null, trendLabel: null, sub: null },
          { label: t("dashboard.newCustomers"), value: animCustomers, trend: null, trendLabel: null, sub: null },
          { label: t("dashboard.avgOrderValue"), value: formatCurrency(animAvg * 100), trend: null, trendLabel: null, sub: null },
        ].map((kpi, i) => (
          <Card key={kpi.label} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">{kpi.label}</p>
              <p className="text-2xl font-bold tracking-tight tabular-nums leading-none">{kpi.value}</p>
              {kpi.trend !== null && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${kpi.trend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {kpi.trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {kpi.trendLabel}
                  </span>
                  {kpi.sub && <span className="text-[11px] text-muted-foreground">{kpi.sub}</span>}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">{t("dashboard.revenueTrend")}</CardTitle>
              <div className="flex gap-0.5 rounded-lg bg-muted/50 dark:bg-muted/30 p-0.5">
                {(["7d", "30d", "90d"] as const).map((p) => (
                  <button
                    key={p}
                    className={`h-6 text-[10px] font-medium px-2.5 rounded-md transition-all duration-150 ${period === p ? "bg-background dark:bg-white/10 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setPeriod(p)}
                  >
                    {t(`dashboard.last${p === "7d" ? "7days" : p === "30d" ? "30days" : "90days"}`)}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[260px]">
              {revenueChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "10px",
                        boxShadow: "var(--shadow-lg)",
                        fontSize: "12px",
                        padding: "8px 12px",
                      }}
                      formatter={(value: number) => [formatCurrency(value * 100), t("dashboard.todayRevenue")]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#colorRevenue)" strokeWidth={1.5} dot={false} />
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

        {/* NUMU Rewards */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">{isAr ? "مكافآت نُمو" : "NUMU Rewards"}</CardTitle>
              {milestones.length > 0 && (
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {milestones.filter(m => m.done).length}/{milestones.length}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {milestones.length > 0 ? (
              <div className="space-y-3">
                {milestones.map((m) => {
                  const IconComp = m.icon;
                  const barWidth = `${Math.max(m.percent, 3)}%`;
                  return (
                    <div
                      key={m.target}
                      className={`rounded-lg border p-3 transition-colors ${
                        m.done ? "border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-500/[0.03]" : "border-border/40"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                          m.done ? "bg-emerald-500/10" : "bg-muted/60"
                        }`}>
                          {m.done ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <IconComp className={`h-4 w-4 ${m.textColor}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold leading-tight">{m.label}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Gift className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                            <p className="text-[10px] text-muted-foreground truncate">{m.reward}</p>
                          </div>
                        </div>
                        <span className={`text-[12px] font-bold tabular-nums shrink-0 ${
                          m.done ? "text-emerald-600 dark:text-emerald-400" : m.textColor
                        }`}>
                          {m.done ? "✓" : `${m.current}/${m.target}`}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${
                            m.done ? "bg-emerald-500 w-full" : `bg-gradient-to-r ${m.barColor}`
                          }`}
                          style={m.done ? undefined : { width: barWidth }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Gift className="h-6 w-6 text-muted-foreground/30" />
                <p className="text-[12px] text-muted-foreground">{isAr ? "أكملت كل الأهداف!" : "All milestones completed!"}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">{t("dashboard.recentOrders")}</CardTitle>
              <Button variant="ghost" size="sm" className="text-[11px] text-muted-foreground h-7 rounded-lg" onClick={() => navigate("/orders")}>
                {t("dashboard.viewAll")} →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentOrders.length > 0 ? (
              <div className="space-y-1">
                {recentOrders.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center gap-3 rounded-lg p-2.5 -mx-1 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate("/orders")}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold tabular-nums">{o.order_number}</span>
                        <Badge variant="outline" className={`text-[9px] font-medium px-1.5 py-0 border ${statusColorMap[o.status] || ""}`}>
                          {t(`orders.${o.status}`)}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{o.customer_name || "—"}</p>
                    </div>
                    <span className="text-[13px] font-semibold tabular-nums shrink-0">{formatCurrency(o.total)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={ShoppingCart} title={isAr ? "لا توجد طلبات بعد" : "No orders yet"} className="py-6" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">{t("dashboard.topProducts")}</CardTitle>
              <Button variant="ghost" size="sm" className="text-[11px] text-muted-foreground h-7 rounded-lg" onClick={() => navigate("/products")}>
                {t("dashboard.viewAll")} →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <div className="space-y-0.5">
                {topProducts.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg p-2.5 -mx-1 transition-colors hover:bg-muted/50 cursor-pointer" onClick={() => navigate("/products")}>
                    <span className="text-[11px] font-bold text-muted-foreground/40 w-4 text-center tabular-nums">{i + 1}</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs shrink-0">📦</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.quantity_sold} {t("dashboard.units")}</p>
                    </div>
                    <span className="text-[13px] font-semibold tabular-nums">{formatCurrency(p.revenue)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Package} title={isAr ? "لا توجد منتجات بعد" : "No products yet"} className="py-6" />
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default Dashboard;
