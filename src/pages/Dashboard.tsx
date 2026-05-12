import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import React, { useState, useMemo, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  getDashboardStats, getRevenueChart, getTopProducts, getHealthScore,
  getRealtimeSnapshot,
} from "@/services/analyticsApi";
import type { HealthScoreData } from "@/services/analyticsApi";
import { listOrders } from "@/services/orderApi";
import { getOnboarding, dismissOnboarding, undismissOnboarding } from "@/services/storeApi";
import type { OnboardingData } from "@/services/storeApi";
import { getStoreUrl } from "@/lib/storefront";
import {
  TrendingUp, ShoppingCart, Users, ArrowUpRight, ArrowDownRight,
  Package, ExternalLink, AlertTriangle, Clock, ChevronRight,
  Plus, CreditCard, Palette, CheckCircle2, Circle, Truck, Receipt,
  Gift, Star, Crown, Lock, Zap, Check, Activity, Lightbulb,
  ChevronDown,
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

  // Goals state — persisted in localStorage
  const [goalTarget, setGoalTarget] = useState(() => {
    try { return Number(localStorage.getItem(`numu_goal_${storeId}`) || "50"); } catch { return 50; }
  });
  const [goalPeriodMode, setGoalPeriodMode] = useState<"monthly" | "yearly">("monthly");
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(goalTarget));

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

  const healthScoreQuery = useQuery({
    queryKey: ["dashboard", "healthScore", storeId],
    queryFn: () => getHealthScore(storeId!, false, language),
    enabled: !!storeId,
    staleTime: 1000 * 60 * 60, // 1 hour — cached daily by Celery
  });

  // Live-visitor pill in the top header. Refetches every 30s so the count
  // ticks in near-real-time without overloading the analytics endpoint.
  const realtimeQuery = useQuery({
    queryKey: ["dashboard", "realtime", storeId],
    queryFn: () => getRealtimeSnapshot(storeId!),
    enabled: !!storeId,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
  const liveVisitors = realtimeQuery.data?.active_now ?? 0;

  const healthScore: HealthScoreData | null = healthScoreQuery.data ?? null;


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
  const todayProfit = stats ? stats.total_profit : 0;
  const productsWithCost = stats ? stats.products_with_cost : 0;
  const totalProductsWithCostHint = stats ? stats.total_products : 0;

  const animRevenue = useCountUp(todayRevenue / 100, 1400);
  const animOrders = useCountUp(todayOrders, 800);
  const animCustomers = useCountUp(newCustomers, 800);
  const animAvg = useCountUp(avgOrder / 100, 1200);
  const animProfit = useCountUp(todayProfit / 100, 1400);

  const trendPercent = stats?.revenue_change_percent ?? 0;
  const trendStr = trendPercent >= 0 ? `+${trendPercent.toFixed(1)}%` : `${trendPercent.toFixed(1)}%`;

  // Action items
  const pendingCount = stats ? stats.pending_orders + stats.processing_orders : 0;
  const lowStockCount = stats?.low_stock_count ?? 0;
  const totalProducts = stats?.total_products ?? 0;
  const shippedCount = stats?.shipped_orders ?? 0;

  // New merchant detection — hide analytics until the FIRST order arrives,
  // not just "no orders in the current period". Using lifetime order count
  // (same source as hasOrders below) so a store with historical orders
  // doesn't see the new-merchant view after a quiet week.
  const isNewMerchant = (recentOrdersQuery.data?.total ?? 0) === 0;

  // Onboarding — single API call to backend
  const onboardingQuery = useQuery({
    queryKey: ["onboarding", storeId],
    queryFn: () => getOnboarding(storeId!),
    enabled: !!storeId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const onboardingData: OnboardingData | null = onboardingQuery.data ?? null;
  // `stats.total_orders` is period-limited (last N days). Using it here meant
  // a store with historical orders but no recent activity would re-show the
  // "waiting for first order" onboarding card. `recentOrdersQuery.data.total`
  // is the all-time non-draft order count (the orders list endpoint already
  // excludes drafts by default), which is the right signal.
  const lifetimeOrderCount = recentOrdersQuery.data?.total ?? 0;
  const hasOrders = lifetimeOrderCount > 0;
  const canDismissOnboarding = !!onboardingData?.is_completed || hasOrders;
  const showSetup = !!onboardingData && !onboardingData.is_completed && !onboardingData.is_dismissed && !hasOrders;


  const handleDismissOnboarding = async () => {
    if (!storeId) return;
    try {
      await dismissOnboarding(storeId);
      onboardingQuery.refetch();
    } catch { /* ignore */ }
  };
  const handleShowOnboarding = async () => {
    if (!storeId) return;
    try {
      await undismissOnboarding(storeId);
      onboardingQuery.refetch();
    } catch { /* ignore */ }
  };

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
      {showSetup ? (
        /* Zid-style big welcome banner during onboarding */
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {isAr
                ? "أهلاً وسهلاً بتاجرنا في نُمو، يلا نبدأ رحلة تجهيز متجرك"
                : "Welcome to NUMU! Let's start setting up your store"}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-[700px]">
              {isAr
                ? "كمّل الخطوات التالية بالترتيب حتى يكون عندك متجر متكامل لبيع منتجاتك وخدماتك أونلاين وتحصل على المكافأة يلا!"
                : "Complete the following steps in order to have a fully integrated store for selling your products and services online and earn your reward!"}
            </p>
          </div>
          <img src="/onboarding/welcome.webp" alt="" className="hidden sm:block w-16 h-16 object-contain shrink-0" />
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/onboarding/welcome.webp" alt="" className="hidden sm:block w-14 h-14 object-contain shrink-0" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                {greeting}, {user?.first_name || currentStore?.name || t("dashboard.merchantName")}
              </h1>
              <p className="text-[13px] text-muted-foreground/80 mt-0.5">{summaryLine}</p>
            </div>
          </div>
          <div className="hidden sm:flex gap-2 shrink-0">
            {onboardingData?.is_dismissed && !onboardingData?.is_completed && (
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs rounded-lg border-amber-200/60 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30" onClick={handleShowOnboarding}>
                <Gift className="h-3 w-3" />
                {isAr ? "دليل الإعداد" : "Setup Guide"}
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs rounded-lg border-border/60" onClick={() => {
              if (currentStore?.subdomain) window.open(getStoreUrl(currentStore.subdomain), "_blank");
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
      )}

      {/* Top header chips: period selector + live-visitor pill.
          Mirrors Shopify's compact analytics-context bar. Hidden during the
          setup wizard since there's nothing meaningful to filter yet. */}
      {!showSetup && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as "7d" | "30d" | "90d")}
              className="appearance-none h-8 text-xs font-medium rounded-full border border-border/60 bg-card hover:bg-muted/50 ps-3 pe-7 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
              title={isAr ? "الفترة الزمنية" : "Time range"}
              aria-label={isAr ? "الفترة الزمنية" : "Time range"}
            >
              <option value="7d">{isAr ? "آخر 7 أيام" : "Last 7 days"}</option>
              <option value="30d">{isAr ? "آخر 30 يوم" : "Last 30 days"}</option>
              <option value="90d">{isAr ? "آخر 90 يوم" : "Last 90 days"}</option>
            </select>
            <ChevronDown
              className={`pointer-events-none absolute top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground ${isAr ? "left-2.5" : "right-2.5"}`}
            />
          </div>

          <div
            className="inline-flex items-center gap-1.5 h-8 text-xs font-medium rounded-full border border-border/60 bg-card px-3"
            title={isAr ? "زوار يتصفحون متجرك الآن" : "Visitors browsing your store right now"}
          >
            <span className="relative flex h-2 w-2">
              {liveVisitors > 0 && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${liveVisitors > 0 ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
              />
            </span>
            <span className="tabular-nums">
              {isAr
                ? `${liveVisitors.toLocaleString("ar-EG")} زائر مباشر`
                : `${liveVisitors.toLocaleString()} live visitor${liveVisitors === 1 ? "" : "s"}`}
            </span>
          </div>
        </div>
      )}

      {/* Attention Needed — hidden during setup wizard */}
      {!showSetup && stats && (pendingCount > 0 || lowStockCount > 0) && (
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

      {/* Quick Actions — hidden during setup wizard */}
      {!showSetup && <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
      </div>}

      {/* Onboarding checklist — single instance, shown for all merchants with pending setup */}

      {/* KPI Cards + Analytics — hidden for brand-new merchants with zero data */}
      {!isNewMerchant && (
      <>
      {/* KPI Cards — live sparklines from chart data */}
      {(() => {
        const sparkData = revenueChartData.length > 0 ? revenueChartData : [];
        const buildSparkPath = (data: number[], w: number, h: number) => {
          if (data.length < 2) return "";
          const max = Math.max(1, ...data);
          const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * w, y: h - (v / max) * h * 0.8 - h * 0.1 }));
          let d = `M${pts[0].x},${pts[0].y}`;
          for (let i = 1; i < pts.length; i++) {
            const cp1x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * 0.4;
            const cp2x = pts[i].x - (pts[i].x - pts[i - 1].x) * 0.4;
            d += ` C${cp1x},${pts[i - 1].y} ${cp2x},${pts[i].y} ${pts[i].x},${pts[i].y}`;
          }
          return d;
        };
        const revenueVals = sparkData.map(d => d.revenue);
        const orderVals = chartData.map(d => d.orders);
        const visitVals = chartData.map(d => d.visits ?? 0);
        const totalVisits = visitVals.reduce((s, v) => s + v, 0);
        const convRate = totalVisits > 0 ? Math.min(99.9, (animOrders / totalVisits) * 100) : 0;

        const profitHint = totalProductsWithCostHint > 0 && productsWithCost < totalProductsWithCostHint
          ? (isAr
              ? `${productsWithCost} من ${totalProductsWithCostHint} منتج لديهم تكلفة`
              : `${productsWithCost} of ${totalProductsWithCostHint} products have a cost set`)
          : undefined;

        const cards: Array<{
          label: string;
          value: string;
          icon: React.ReactNode;
          data: number[];
          stroke: string;
          hint?: string;
        }> = [
          { label: isAr ? "المبيعات" : "Sales", value: formatCurrency(animRevenue * 100), icon: <TrendingUp className="h-4 w-4 text-muted-foreground/40" />, data: revenueVals, stroke: "hsl(var(--primary))" },
          { label: isAr ? "صافي الربح" : "Net Profit", value: formatCurrency(animProfit * 100), icon: <Receipt className="h-4 w-4 text-muted-foreground/40" />, data: [], stroke: "hsl(160,84%,39%)", hint: profitHint },
          { label: isAr ? "الطلبات" : "Orders", value: String(animOrders), icon: <ShoppingCart className="h-4 w-4 text-muted-foreground/40" />, data: orderVals, stroke: "hsl(142,71%,45%)" },
          { label: isAr ? "الزيارات" : "Visits", value: String(totalVisits), icon: <Users className="h-4 w-4 text-muted-foreground/40" />, data: visitVals, stroke: "hsl(263,70%,50%)" },
          { label: isAr ? "نسبة التحويل" : "Conversion", value: `${convRate.toFixed(2)}%`, icon: <ArrowUpRight className="h-4 w-4 text-muted-foreground/40" />, data: [], stroke: "hsl(38,92%,50%)" },
        ];

        return (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {cards.map((kpi, i) => (
              <Card key={i} className="overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer group" onClick={() => navigate("/analytics")}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold">{kpi.label}</p>
                    {kpi.icon}
                  </div>
                  <p className="text-2xl font-bold tracking-tight tabular-nums leading-none mb-2">{kpi.value}</p>
                  {kpi.hint && (
                    <p className="text-[10px] text-muted-foreground/70 mb-2 truncate">{kpi.hint}</p>
                  )}
                  {/* SVG sparkline */}
                  <div className="h-10 mb-2">
                    <svg width="100%" height="100%" viewBox="0 0 200 40" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id={`spark-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={kpi.stroke} stopOpacity="0.15" />
                          <stop offset="100%" stopColor={kpi.stroke} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {kpi.data.length > 1 && kpi.data.some(v => v > 0) ? (
                        <>
                          <path d={buildSparkPath(kpi.data, 200, 40) + ` L200,40 L0,40 Z`} fill={`url(#spark-${i})`} />
                          <path d={buildSparkPath(kpi.data, 200, 40)} fill="none" stroke={kpi.stroke} strokeWidth="2" strokeLinecap="round" />
                        </>
                      ) : (
                        <line x1="0" y1="38" x2="200" y2="38" stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" />
                      )}
                    </svg>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <select
                      value={period}
                      onChange={e => { e.stopPropagation(); setPeriod(e.target.value as "7d" | "30d" | "90d"); }}
                      onClick={e => e.stopPropagation()}
                      title={isAr ? "الفترة الزمنية" : "Time range"}
                      aria-label={isAr ? "الفترة الزمنية" : "Time range"}
                      className="text-[10px] text-muted-foreground bg-transparent border-none outline-none cursor-pointer hover:text-foreground transition-colors"
                    >
                      <option value="7d">{isAr ? "آخر 7 أيام" : "Last 7 days"}</option>
                      <option value="30d">{isAr ? "آخر 30 يوم" : "Last 30 days"}</option>
                      <option value="90d">{isAr ? "كل الأيام" : "All days"}</option>
                    </select>
                    <span className="text-[10px] text-primary group-hover:underline">{isAr ? "عرض التقارير" : "View Reports"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })()}

      {/* Goals Card — fully wired */}
      {(() => {
        const currentOrders = stats?.total_orders ?? 0;
        const goalMultiplier = goalPeriodMode === "yearly" ? 12 : 1;
        const effectiveGoal = goalTarget * goalMultiplier;
        const progressPct = Math.min(100, Math.round((currentOrders / Math.max(1, effectiveGoal)) * 100));
        const remaining = Math.max(0, effectiveGoal - currentOrders);
        const scaleSteps = [0, Math.round(effectiveGoal * 0.25), Math.round(effectiveGoal * 0.5), Math.round(effectiveGoal * 0.75), effectiveGoal];
        const scaleLabels = scaleSteps.map(n => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

        return (
          <div className="grid gap-4 lg:grid-cols-2 min-h-[280px]">
            <Card>
              <CardContent className="p-5">
                <h3 className="text-base font-bold mb-1">{isAr ? "تابع أهدافك" : "Track Your Goals"}</h3>
                <p className="text-xs text-muted-foreground mb-4">{isAr ? "يساعد تحديد أهداف الطلبات في فهم احتياجاتك بشكل أدق، لنقترح عليك ما يعزز أداءك ويقربك من أهدافك." : "Setting order goals helps you understand your needs and track progress."}</p>
                {/* Monthly/Yearly toggle */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 w-fit mb-4">
                  <button onClick={() => setGoalPeriodMode("monthly")} className={`h-7 px-3 text-[11px] font-medium rounded-md transition-all cursor-pointer ${goalPeriodMode === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{isAr ? "شهري" : "Monthly"}</button>
                  <button onClick={() => setGoalPeriodMode("yearly")} className={`h-7 px-3 text-[11px] font-medium rounded-md transition-all cursor-pointer ${goalPeriodMode === "yearly" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{isAr ? "سنوي" : "Yearly"}</button>
                </div>
                {/* Progress */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{isAr ? "نسبة تقدمك" : "Your progress"}</span>
                    <span className="text-xs font-bold tabular-nums">{progressPct}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] text-muted-foreground tabular-nums">
                    {scaleLabels.map((l, i) => <span key={i}>{l}</span>)}
                  </div>
                </div>
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">{isAr ? "عدد الطلبات الحالية" : "Current Orders"}</p>
                    <p className="text-lg font-bold tabular-nums">{currentOrders.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">{isAr ? "الهدف" : "Goal"}</p>
                    <p className="text-lg font-bold tabular-nums">{effectiveGoal.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">{isAr ? "المتبقية للهدف" : "Remaining"}</p>
                    <p className="text-lg font-bold tabular-nums">{remaining.toLocaleString()}</p>
                  </div>
                </div>
                {/* Goal editing */}
                {editingGoal ? (
                  <div className="flex items-center gap-2 mt-4">
                    <Input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)} className="h-8 text-sm w-24 rounded-lg" min={1} />
                    <span className="text-xs text-muted-foreground">{isAr ? "طلب/شهر" : "orders/mo"}</span>
                    <Button size="sm" className="h-8 text-xs rounded-lg" onClick={() => {
                      const v = Math.max(1, Number(goalInput) || 50);
                      setGoalTarget(v); setEditingGoal(false);
                      if (storeId) try { localStorage.setItem(`numu_goal_${storeId}`, String(v)); } catch { /* ignore */ }
                    }}>{isAr ? "حفظ" : "Save"}</Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg" onClick={() => setEditingGoal(false)}>{isAr ? "إلغاء" : "Cancel"}</Button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" onClick={() => { setGoalInput(String(goalTarget)); setEditingGoal(true); }}>{isAr ? "تعديل الأهداف" : "Edit Goals"}</Button>
                    <Button size="sm" className="h-8 text-xs rounded-lg" onClick={() => navigate("/analytics")}>{isAr ? "دعنا نساعدك في الوصول إلى أهدافك" : "Help me reach my goals"}</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Store Health Score */}
            <div className="rounded-xl overflow-hidden text-white cursor-pointer transition-transform hover:scale-[1.01]" style={{ background: "hsl(222.2, 47.4%, 11.2%)" }} onClick={() => navigate("/health-score")}>
              <div className="relative">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url('/numu_v3.webp')", backgroundSize: "100px", backgroundRepeat: "repeat" }} />

                {/* Header */}
                <div className="relative z-10 px-5 pt-5 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-white/50" />
                    <h3 className="text-sm font-bold text-white">{t("dashboard.healthTitle")}</h3>
                  </div>
                  {healthScore && (
                    <span className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md ${
                      healthScore.grade === "A" ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20" :
                      healthScore.grade === "B" ? "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/20" :
                      healthScore.grade === "C" ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20" :
                      healthScore.grade === "D" ? "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/20" :
                      "bg-red-500/15 text-red-300 ring-1 ring-red-500/20"
                    }`}>
                      {t("dashboard.healthGrade")} {healthScore.grade}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="relative z-10 px-5 pb-5">
                  {healthScoreQuery.isLoading ? (
                    <div className="rounded-xl bg-white/[0.05] border border-white/[0.06] flex items-center justify-center py-12">
                      <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-transparent animate-spin" />
                    </div>
                  ) : healthScore ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* Score Ring */}
                      <div className="rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/[0.08] p-5 flex flex-col items-center justify-center">
                        <div className="relative w-24 h-24">
                          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="6" className="stroke-white/[0.06]" />
                            <circle
                              cx="50" cy="50" r="40" fill="none" strokeWidth="6" strokeLinecap="round"
                              strokeDasharray={`${healthScore.score * 2.51} 251`}
                              className={
                                healthScore.grade === "A" ? "stroke-emerald-400" :
                                healthScore.grade === "B" ? "stroke-blue-400" :
                                healthScore.grade === "C" ? "stroke-amber-400" :
                                healthScore.grade === "D" ? "stroke-orange-400" :
                                "stroke-red-400"
                              }
                              style={{ transition: "stroke-dasharray 1s ease-out" }}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold tabular-nums text-white leading-none">{healthScore.score}</span>
                            <span className="text-[9px] text-white/30 mt-0.5">{t("dashboard.healthOf100")}</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-white/35 mt-3">
                          {t("dashboard.healthPeriod")} · {healthScore.orders_analyzed} {t("dashboard.healthOrders")}
                        </p>
                      </div>

                      {/* Metrics */}
                      <div className="rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/[0.08] p-4 flex flex-col justify-center">
                        <div className="space-y-3">
                          {[
                            { label: t("dashboard.healthDelivery"), value: healthScore.metrics.delivery_success_rate, sub: healthScore.sub_scores.delivery_success },
                            { label: t("dashboard.healthCodAccept"), value: healthScore.metrics.cod_acceptance_rate, sub: healthScore.sub_scores.cod_acceptance },
                            { label: t("dashboard.healthCompletion"), value: healthScore.metrics.order_completion_rate, sub: healthScore.sub_scores.order_completion },
                            { label: t("dashboard.healthReturns"), value: healthScore.metrics.return_rate, sub: healthScore.sub_scores.low_return, isReturn: true },
                            { label: t("dashboard.healthFulfillment"), value: healthScore.metrics.avg_response_hours, sub: healthScore.sub_scores.response_time, isHours: true },
                          ].map((m) => (
                            <div key={m.label}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] text-white/60">{m.label}</span>
                                <span className="text-[11px] font-semibold tabular-nums text-white/80">
                                  {m.isHours ? `${m.value}${t("dashboard.healthHours")}` : `${m.value}%`}
                                </span>
                              </div>
                              <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ${m.sub >= 75 ? "bg-emerald-400/80" : m.sub >= 50 ? "bg-amber-400/80" : "bg-red-400/80"}`}
                                  style={{ width: `${Math.min(100, m.sub)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recommendations */}
                      {healthScore.recommendations.length > 0 && (
                        <div className="sm:col-span-2 rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/[0.08] px-4 py-3 space-y-1.5">
                          {healthScore.recommendations.slice(0, 2).map((rec: string, i: number) => (
                            <div key={i} className="flex items-start gap-2">
                              <Lightbulb className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <p className="text-[11px] text-white/50 leading-relaxed">{rec}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Activity className="h-8 w-8 text-white/20 mb-2" />
                      <p className="text-xs text-white/50">{t("dashboard.healthNoData")}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{t("dashboard.healthNoDataSub")}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      </>
      )}

      {/* Onboarding checklist — single unified block */}
      {showSetup && onboardingData && (() => {
        /* Illustrations from /onboarding/ folder */
        const stepIllustrations: Record<string, string> = {
          add_product: "", // no illustration — uses icon
          set_identity: "/onboarding/identity.svg",
          confirm_support: "/onboarding/support.svg",
          add_shipping: "/onboarding/shipping.svg",
          configure_payment: "/onboarding/verify.svg",
          first_order: "",
        };
        const stepColors: Record<string, { bg: string; badge: string; badgeText: string; border: string }> = {
          add_product:       { bg: "bg-green-50 dark:bg-green-950/30",   badge: "bg-emerald-500", badgeText: "text-white", border: "border-green-200/50 dark:border-green-800/40" },
          set_identity:      { bg: "bg-amber-50 dark:bg-amber-950/30",  badge: "bg-amber-500",   badgeText: "text-white", border: "border-amber-200/50 dark:border-amber-800/40" },
          confirm_support:   { bg: "bg-fuchsia-50 dark:bg-fuchsia-950/30", badge: "bg-fuchsia-500", badgeText: "text-white", border: "border-fuchsia-200/50 dark:border-fuchsia-800/40" },
          add_shipping:      { bg: "bg-rose-50 dark:bg-rose-950/30",    badge: "bg-rose-500",    badgeText: "text-white", border: "border-rose-200/50 dark:border-rose-800/40" },
          configure_payment: { bg: "bg-cyan-50 dark:bg-cyan-950/30",    badge: "bg-teal-500",    badgeText: "text-white", border: "border-cyan-200/50 dark:border-cyan-800/40" },
          first_order:       { bg: "bg-sky-50 dark:bg-sky-950/30",      badge: "bg-sky-500",     badgeText: "text-white", border: "border-sky-200/50 dark:border-sky-800/40" },
        };
        const STEP_UI: Record<string, { label: string; labelAr: string; desc: string; descAr: string; action: () => void; cta: string; ctaAr: string; icon: React.ReactNode; time: string; timeAr: string }> = {
          add_product: { label: "Add a Product", labelAr: "أضف منتج", desc: "Add your first product to start selling online", descAr: "أضف أول منتج لبدء البيع أونلاين", action: () => navigate("/products/new"), cta: "Add Product", ctaAr: "أضف منتج", icon: <Package className="h-5 w-5" />, time: "2 min", timeAr: "دقيقتان" },
          set_identity: { label: "Add Store Identity", labelAr: "أضف هوية متجرك", desc: "Upload logo and add store description", descAr: "اعكس هويتك البصرية على متجرك من ألوان وشعار وأيقونة", action: () => navigate("/store"), cta: "Add Details", ctaAr: "أضف تفاصيل هويتك", icon: <Palette className="h-5 w-5" />, time: "3 min", timeAr: "3 دقائق" },
          confirm_support: { label: "Add Support Number", labelAr: "أكد رقم الدعم الفني لمتجرك", desc: "Add a phone number so customers can reach you", descAr: "أضف رقم للدعم الفني لعملاؤك", action: () => navigate("/store"), cta: "Confirm Number", ctaAr: "أكد الرقم المسجل", icon: <CheckCircle2 className="h-5 w-5" />, time: "30 sec", timeAr: "30 ثانية" },
          add_shipping: { label: "Set Up Shipping", labelAr: "حدد موقع تسليم الشحنات", desc: "Configure shipping zones or connect a carrier", descAr: "اضبط مناطق الشحن أو اربط شركة شحن", action: () => navigate("/logistics"), cta: "Set Up", ctaAr: "إعداد", icon: <Truck className="h-5 w-5" />, time: "3 min", timeAr: "3 دقائق" },
          configure_payment: { label: "Activate Payments", labelAr: "فعّل المدفوعات", desc: "Connect a payment gateway to accept money", descAr: "أكمل عملية تحقق سريعة وآمنة لفتح جميع الميزات وبدء البيع", action: () => navigate("/payment-setup"), cta: "Start Verification", ctaAr: "ابدأ إجراءات التحقق", icon: <CreditCard className="h-5 w-5" />, time: "5 min", timeAr: "5 دقائق" },
          first_order: { label: "Get Your First Order", labelAr: "احصل على أول طلب", desc: "Share your store link and start receiving orders", descAr: "شارك رابط متجرك وابدأ استقبال الطلبات", action: () => { if (currentStore?.subdomain) window.open(getStoreUrl(currentStore.subdomain), "_blank"); }, cta: "Share", ctaAr: "مشاركة", icon: <Zap className="h-5 w-5" />, time: "1 min", timeAr: "دقيقة" },  // excluded from grid below

        };
        const steps = onboardingData.steps
          .filter(s => s.key !== "create_store" && s.key !== "first_order" && STEP_UI[s.key])
          .map((s, i) => ({ ...STEP_UI[s.key], key: s.key, num: i + 1, done: s.status === "completed" || s.status === "skipped", colors: stepColors[s.key], illustration: stepIllustrations[s.key] }));
        const doneCount = steps.filter(s => s.done).length;
        const allStepsDone = doneCount === steps.length;
        const totalSteps = steps.length + 1; // +1 for first order
        const displayDone = allStepsDone ? steps.length : doneCount; // show X/6, last one is "first order"
        const progressPercent = Math.round((displayDone / totalSteps) * 100);

        return (
          <div>
            {/* Dark banner header */}
            <div className="relative text-white rounded-xl overflow-hidden" style={{ background: "hsl(222.2, 47.4%, 11.2%)" }}>
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url('/numu_v3.webp')", backgroundSize: "80px", backgroundRepeat: "repeat" }} />
              <div className="relative z-10 px-5 py-4 sm:px-6 sm:py-5">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-400/15 flex items-center justify-center">
                      <Gift className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold leading-tight">{isAr ? "جهّز متجرك واحصل على شهر Premium مجاناً" : "Set up your store & get 1 month Premium free"}</h2>
                      <p className="text-[11px] text-white/40 mt-0.5">{displayDone}/{totalSteps} {isAr ? "مكتمل" : "completed"}</p>
                    </div>
                  </div>
                  {canDismissOnboarding && (
                    <button type="button" onClick={handleDismissOnboarding} className="text-[10px] text-white/30 hover:text-white/60 transition-colors shrink-0">{isAr ? "إخفاء" : "Hide"}</button>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-700" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>

            {/* Zid-style cards grid */}
            <div className="pt-3 sm:pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

                {/* ── Reward card (left, tall — spans 2 rows) ── */}
                <div className="relative overflow-hidden rounded-2xl sm:row-span-2 min-h-[260px] flex flex-col items-center justify-center text-center p-8" style={{ background: "hsl(222.2, 47.4%, 11.2%)" }}>
                  <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "url('/numu_v3.webp')", backgroundSize: "60px", backgroundRepeat: "repeat" }} />
                  <div className="relative z-10 flex flex-col items-center">
                  {/* Counter badge */}
                  <div className="mb-5 flex items-center gap-1.5 rounded-full bg-white/10 border border-white/10 px-3.5 py-1">
                    <span className="text-sm font-bold text-white tabular-nums">{displayDone}</span>
                    <span className="text-sm text-white/40">/</span>
                    <span className="text-sm font-bold text-white tabular-nums">{totalSteps}</span>
                  </div>
                  <img src="/onboarding/reward.svg" alt="" className="w-36 h-36 mb-5 object-contain" />
                  <p className="text-lg font-bold text-white leading-snug">
                    {isAr ? "اكسب شهر Premium مجاناً" : "Earn 1 month Premium free"}
                  </p>
                  <p className="text-sm text-white/50 mt-2 max-w-[240px] leading-relaxed">
                    {isAr ? "إذا أكملت كل خطوات تجهيز متجرك" : "Complete all setup steps to unlock your reward"}
                  </p>
                  </div>
                </div>

                {allStepsDone ? (
                  <>
                    {/* ── All steps done — waiting for first order ── */}
                    <div className="relative overflow-hidden rounded-2xl lg:col-span-2 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-emerald-500/30 bg-emerald-500/[0.03]">
                      <div className="relative z-10 flex flex-col items-center">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-3">
                          <ShoppingCart className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <p className="text-sm font-bold leading-snug">
                            {isAr ? "متجرك جاهز!" : "Store is ready!"}
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px] leading-relaxed">
                          {isAr ? "في انتظار أول طلب... شارك رابط متجرك" : "Waiting for your first order... share your store link"}
                        </p>
                        <div className="flex flex-col gap-2 mt-3 w-full">
                          <Button size="sm" className="h-8 text-xs rounded-lg font-semibold gap-1.5 w-full" onClick={() => {
                            if (currentStore?.subdomain) {
                              const url = getStoreUrl(currentStore.subdomain);
                              if (navigator.share) {
                                navigator.share({ title: currentStore.name, url }).catch(() => {});
                              } else {
                                navigator.clipboard.writeText(url);
                              }
                            }
                          }}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            {isAr ? "شارك رابط متجرك" : "Share Store Link"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg font-semibold gap-1.5 w-full" onClick={() => {
                            if (currentStore?.subdomain) window.open(getStoreUrl(currentStore.subdomain), "_blank");
                          }}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            {isAr ? "زُر متجرك" : "Visit Store"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* ── Referral card — spans 2 cols ── */}
                    <div className="relative overflow-hidden rounded-2xl p-5 sm:col-span-1 lg:col-span-2 flex items-center" style={{ background: "linear-gradient(135deg, hsl(222.2, 47.4%, 11.2%) 0%, hsl(250, 40%, 16%) 100%)" }}>
                      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "url('/numu_v3.webp')", backgroundSize: "60px", backgroundRepeat: "repeat" }} />
                      <img src="/onboarding/referral.webp" alt="" className={`relative z-10 h-[160px] shrink-0 ${isAr ? "-ml-2 -mr-1" : "-mr-2 -ml-1"} drop-shadow-lg`} />
                      <div className={`relative z-10 flex flex-col ${isAr ? "mr-3" : "ml-3"}`}>
                        <p className="text-sm font-bold text-white leading-snug">
                          {isAr ? "ادعُ تاجر واحصل على نسبة من كل طلباته للأبد" : "Refer a merchant & earn a % of all their orders forever"}
                        </p>
                        <p className="text-[11px] text-white/50 mt-1.5 leading-relaxed">
                          {isAr ? "شارك رابط الدعوة مع أصحاب المتاجر واكسب عمولة مستمرة من كل طلب يستقبلوه" : "Share your referral link with store owners and earn ongoing commission from every order they receive"}
                        </p>
                        <Button size="sm" className="mt-3 h-8 text-xs rounded-lg bg-white text-gray-900 hover:bg-white/90 font-semibold gap-1.5 w-fit" onClick={async () => {
                          if (currentStore?.subdomain) {
                            const url = getStoreUrl(currentStore.subdomain);
                            if (navigator.share) {
                              try { await navigator.share({ title: currentStore.name, url }); } catch { /* cancelled */ }
                            } else {
                              await navigator.clipboard.writeText(url);
                            }
                          }
                        }}>
                          <Gift className="h-3.5 w-3.5" />
                          {isAr ? "شارك رابط الدعوة" : "Share Referral Link"}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                {/* ── Step cards ── */}
                {steps.map((step) => {
                  const c = step.colors;
                  return (
                    <div
                      key={step.key}
                      className={`group relative rounded-2xl overflow-hidden flex flex-col transition-all duration-200 ${c.bg} border ${c.border} ${
                        step.done
                          ? "opacity-75"
                          : "hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                      }`}
                      onClick={() => !step.done && step.action()}
                    >
                      {/* Top area: step badge + time + illustration */}
                      <div className="relative px-5 pt-4 pb-2">
                        <div className="flex items-center justify-between mb-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            step.done ? "bg-emerald-500 text-white" : `${c.badge} ${c.badgeText}`
                          }`}>
                            {step.done ? <Check className="h-4 w-4" /> : String(step.num).padStart(2, "0")}
                          </div>
                          {!step.done && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70 bg-white/70 dark:bg-white/10 rounded-full px-2.5 py-1 border border-black/5 dark:border-white/10">
                              <Clock className="h-3 w-3" />
                              {isAr ? step.timeAr : step.time}
                            </div>
                          )}
                          {step.done && (
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2.5 py-1">
                              {isAr ? "أكملت الخطوة بنجاح ✓" : "Completed ✓"}
                            </span>
                          )}
                        </div>
                        {/* Illustration */}
                        {step.illustration ? (
                          <div className="flex justify-center py-2">
                            <img src={step.illustration} alt="" className="h-16 sm:h-20 object-contain opacity-90" />
                          </div>
                        ) : (
                          <div className="flex justify-center py-3">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                              step.done ? "bg-muted text-muted-foreground" : `${c.badge}/10 ${c.badge.replace("bg-", "text-")}`
                            }`}>
                              {React.cloneElement(step.icon as React.ReactElement, { className: "h-7 w-7" })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Bottom area: text + CTA */}
                      <div className="px-5 pb-4 flex flex-col flex-1">
                        <h3 className={`text-sm font-bold leading-snug ${step.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {isAr ? step.labelAr : step.label}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2 flex-1">
                          {isAr ? step.descAr : step.desc}
                        </p>

                        {!step.done && (
                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              size="sm"
                              className={`h-8 text-xs rounded-lg px-4 font-semibold ${c.badge} hover:opacity-90 text-white border-0 shadow-sm`}
                              onClick={(e) => { e.stopPropagation(); step.action(); }}
                            >
                              {isAr ? step.ctaAr : step.cta}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* ── Referral card — fills remaining grid space ── */}
                <div className="relative overflow-hidden rounded-2xl p-5 sm:col-span-1 lg:col-span-2 flex items-center" style={{ background: "linear-gradient(135deg, hsl(222.2, 47.4%, 11.2%) 0%, hsl(250, 40%, 16%) 100%)" }}>
                  <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "url('/numu_v3.webp')", backgroundSize: "60px", backgroundRepeat: "repeat" }} />
                  <img src="/onboarding/referral.webp" alt="" className={`relative z-10 h-[160px] shrink-0 ${isAr ? "-ml-2 -mr-1" : "-mr-2 -ml-1"} drop-shadow-lg`} />
                  <div className={`relative z-10 flex flex-col ${isAr ? "mr-3" : "ml-3"}`}>
                    <p className="text-sm font-bold text-white leading-snug">
                      {isAr ? "ادعُ تاجر واحصل على نسبة من كل طلباته للأبد" : "Refer a merchant & earn a % of all their orders forever"}
                    </p>
                    <p className="text-[11px] text-white/50 mt-1.5 leading-relaxed">
                      {isAr ? "شارك رابط الدعوة مع أصحاب المتاجر واكسب عمولة مستمرة من كل طلب يستقبلوه" : "Share your referral link with store owners and earn ongoing commission from every order they receive"}
                    </p>
                    <Button size="sm" className="mt-3 h-8 text-xs rounded-lg bg-white text-gray-900 hover:bg-white/90 font-semibold gap-1.5 w-fit" onClick={async () => {
                      if (currentStore?.subdomain) {
                        const url = getStoreUrl(currentStore.subdomain);
                        if (navigator.share) {
                          try { await navigator.share({ title: currentStore.name, url }); } catch { /* cancelled */ }
                        } else {
                          await navigator.clipboard.writeText(url);
                        }
                      }
                    }}>
                      <Gift className="h-3.5 w-3.5" />
                      {isAr ? "شارك رابط الدعوة" : "Share Referral Link"}
                    </Button>
                  </div>
                </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Charts Row — hidden for new merchants */}
      {!isNewMerchant && (
      <>
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
      </>
      )}

    </div>
  );
};

export default Dashboard;
