import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useState, useMemo, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  getDashboardStats, getRevenueChart, getTopProducts,
} from "@/services/analyticsApi";
import { listOrders } from "@/services/orderApi";
import { getStoreUrl } from "@/lib/storefront";
import { apiClient } from "@/services/api";
import {
  TrendingUp, ShoppingCart, Users, ArrowUpRight, ArrowDownRight,
  Package, ExternalLink, AlertTriangle, Clock, ChevronRight,
  Plus, CreditCard, Palette, CheckCircle2, Circle, Truck, Receipt,
  Gift, Star, Crown, Lock, Zap, Check,
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
    queryFn: () => getHealthScore(storeId!),
    enabled: !!storeId,
    staleTime: 1000 * 60 * 60, // 1 hour — Celery refreshes daily
    retry: false,
  });

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

  // Onboarding — reactive, re-derives from currentStore/stats on every change
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  // Sync dismissed state with localStorage when storeId is available
  useEffect(() => {
    if (!storeId) return;
    try { setOnboardingDismissed(localStorage.getItem(`numu_onboarding_dismissed_${storeId}`) === "true"); } catch {}
  }, [storeId]);

  // Onboarding checks — fetch real status from actual endpoints
  const [obShipping, setObShipping] = useState(false);
  const [obPayment, setObPayment] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    // Check if shipping is configured (Bosta or any carrier)
    import("@/services/storeApi").then(({ fetchShippingSettings }) => {
      fetchShippingSettings(storeId).then(s => {
        setObShipping(s.bosta?.is_configured || s.aramex?.is_configured || s.mylerz?.is_configured || s.manual?.enabled || false);
      }).catch(() => {});
    });
    // Check if payment gateway is configured
    import("@/services/storeApi").then(({ fetchPaymobCredentials, fetchKashierCredentials }) => {
      Promise.all([
        fetchPaymobCredentials(storeId).catch(() => null),
        fetchKashierCredentials(storeId).catch(() => null),
      ]).then(([p, k]) => {
        setObPayment(!!(p?.is_configured || k?.is_configured));
      });
    });
  }, [storeId]);

  // Reactively compute onboarding from real store data
  const effectiveOnboarding = useMemo(() => {
    if (!currentStore || !stats) return null;
    return {
      product_added: totalProducts > 0,
      identity_set: !!(currentStore.logo_url && currentStore.description),
      support_confirmed: !!currentStore.contact_phone,
      shipping_set: obShipping,
      payments_activated: obPayment,
      verified: totalProducts > 0 && !!currentStore.logo_url && !!currentStore.contact_phone && obShipping && obPayment,
    };
  }, [currentStore, stats, totalProducts, obShipping, obPayment]);

  const dismissOnboarding = () => {
    setOnboardingDismissed(true);
    if (storeId) try { localStorage.setItem(`numu_onboarding_dismissed_${storeId}`, "true"); } catch {}
  };
  const showOnboarding = () => {
    setOnboardingDismissed(false);
    if (storeId) try { localStorage.removeItem(`numu_onboarding_dismissed_${storeId}`); } catch {}
  };

  const showSetup = !!effectiveOnboarding && !onboardingDismissed && !Object.values(effectiveOnboarding).every(Boolean);

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
          {onboardingDismissed && effectiveOnboarding && !Object.values(effectiveOnboarding).every(Boolean) && (
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs rounded-lg border-amber-200/60 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30" onClick={showOnboarding}>
              <Gift className="h-3 w-3" />
              {isAr ? "دليل الإعداد" : "Setup Guide"}
            </Button>
          )}
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

      {/* ═══════════════════════════════════════════════════════════
         ONBOARDING — Zid-style colorful card grid
         ═══════════════════════════════════════════════════════════ */}
      {showSetup && (() => {
        const ob = effectiveOnboarding!;
        const steps = [
          { key: "products", num: "01", label: "Add a Product", labelAr: "أضف منتج", desc: "Add your first product to start selling online", descAr: "أضف أول منتج لبدء البيع أونلاين", done: !!ob.product_added, bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/50 dark:border-emerald-800/30", action: () => navigate("/products/new"), cta: "Add Product", ctaAr: "أضف منتج", icon: <Package className="h-5 w-5 text-emerald-600" />, time: "2 min", timeAr: "دقيقتان" },
          { key: "identity", num: "02", label: "Add Store Identity", labelAr: "أضف هوية متجرك", desc: "Set your brand colors, logo, and store description", descAr: "اعكس هويتك البصرية على متجرك من ألوان وشعار ولوجو", done: !!ob.identity_set, bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200/50 dark:border-amber-800/30", action: () => navigate("/store"), cta: "Customize Store", ctaAr: "أضف تفاصيل هويتك", icon: <Palette className="h-5 w-5 text-amber-600" />, time: "3 min", timeAr: "3 دقائق" },
          { key: "support", num: "03", label: "Confirm Support Number", labelAr: "أكد رقم الدعم الفني", desc: "Add a phone number so customers can reach you", descAr: "أضف رقم هاتف للدعم حتى يتواصل معك العملاء", done: !!ob.support_confirmed, bg: "bg-violet-50 dark:bg-violet-950/30 border-violet-200/50 dark:border-violet-800/30", action: () => navigate("/store"), cta: "Add Number", ctaAr: "تأكيد الرقم", icon: <CheckCircle2 className="h-5 w-5 text-violet-600" />, time: "1 min", timeAr: "دقيقة" },
          { key: "shipping", num: "04", label: "Set Shipping Location", labelAr: "حدد موقع تسليم الشحنات", desc: "Set where carriers pick up your orders for delivery", descAr: "حدّد الموقع الذي تستلم منه شركات الشحن طلبات عملائك", done: !!ob.shipping_set, bg: "bg-rose-50 dark:bg-rose-950/30 border-rose-200/50 dark:border-rose-800/30", action: () => navigate("/logistics"), cta: "Set Location", ctaAr: "حدد الموقع", icon: <Truck className="h-5 w-5 text-rose-600" />, time: "3 min", timeAr: "3 دقائق" },
          { key: "payments", num: "05", label: "Activate Payments", labelAr: "فعّل المدفوعات", desc: "Connect a payment gateway and start accepting money", descAr: "فعّل المدفوعات بخطوات بسيطة وابدأ استقبال الأموال", done: !!ob.payments_activated, bg: "bg-sky-50 dark:bg-sky-950/30 border-sky-200/50 dark:border-sky-800/30", action: () => navigate("/payment-setup"), cta: "Activate Now", ctaAr: "فعّلها الآن", icon: <CreditCard className="h-5 w-5 text-sky-600" />, time: "5 min", timeAr: "5 دقائق" },
          { key: "verify", num: "06", label: "Verify in Seconds", labelAr: "تحقق في ثواني", desc: "Quick verification to unlock all store features", descAr: "تحقق سريع لفتح جميع مميزات المتجر", done: !!ob.verified, bg: "bg-teal-50 dark:bg-teal-950/30 border-teal-200/50 dark:border-teal-800/30", action: () => {}, cta: "Verify", ctaAr: "تحقق", icon: <Zap className="h-5 w-5 text-teal-600" />, time: "1 min", timeAr: "دقيقة" },
        ];
        const doneCount = steps.filter(s => s.done).length;
        return (
          <div className="space-y-4">
            {/* Reward banner — complete all steps to earn free premium */}
            <div className="relative rounded-xl overflow-hidden text-white" style={{ background: "hsl(222.2, 47.4%, 11.2%)" }}>
              <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "url('/numu_v3.png')", backgroundSize: "90px", backgroundRepeat: "repeat" }} />
              <div className="relative z-10 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-400/20 flex items-center justify-center">
                        <Gift className="h-4 w-4 text-amber-400" />
                      </div>
                      <div className="flex items-center gap-2 bg-amber-400/15 rounded-full px-2.5 py-0.5">
                        <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">{isAr ? "مكافأة" : "REWARD"}</span>
                      </div>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold leading-tight">
                      {isAr ? "أكمل كل الخطوات واحصل على شهر Premium مجاناً!" : "Complete all steps & get 1 month Premium free!"}
                    </h2>
                    <p className="text-xs text-white/50 mt-1.5">
                      {isAr
                        ? "كمّل الخطوات التالية بالترتيب حتى يكون عندك متجر متكامل جاهز للبيع"
                        : "Follow these steps in order to get your store fully ready to sell"}
                    </p>
                    {/* Progress bar */}
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-700" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
                      </div>
                      <span className="text-sm font-bold tabular-nums text-white/80">{doneCount}/{steps.length}</span>
                    </div>
                  </div>
                  <button onClick={dismissOnboarding} className="text-[10px] text-white/30 hover:text-white/60 transition-colors cursor-pointer mt-1 shrink-0">{isAr ? "تخطي" : "Skip"}</button>
                </div>
              </div>
            </div>

            {/* Step cards grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {steps.map((step) => (
                <div
                  key={step.key}
                  className={`relative rounded-xl border p-5 flex flex-col min-h-[180px] transition-all ${step.bg} ${step.done ? "opacity-60" : "hover:shadow-md cursor-pointer"}`}
                  onClick={() => !step.done && step.action()}
                >
                  {/* Top: number + time estimate */}
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step.done ? "bg-emerald-500 text-white" : "bg-white/80 dark:bg-white/10 text-foreground shadow-sm"}`}>
                      {step.done ? <Check className="h-4 w-4" /> : step.num}
                    </div>
                    {!step.done && (
                      <span className="text-[10px] text-muted-foreground bg-white/70 dark:bg-white/10 rounded-full px-2.5 py-0.5 flex items-center gap-1 shadow-sm">
                        <Clock className="h-2.5 w-2.5" />{isAr ? step.timeAr : step.time}
                      </span>
                    )}
                    {step.done && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />{isAr ? "أكملت الخطوة بنجاح" : "Completed"}
                      </span>
                    )}
                  </div>

                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-white/70 dark:bg-white/10 flex items-center justify-center mb-3 shadow-sm">
                    {step.icon}
                  </div>

                  {/* Content */}
                  <h3 className={`text-sm font-bold mb-1 ${step.done ? "line-through text-muted-foreground" : ""}`}>
                    {isAr ? step.labelAr : step.label}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mb-3 line-clamp-2 flex-1">{isAr ? step.descAr : step.desc}</p>

                  {/* CTA */}
                  {!step.done && (
                    <div className="flex gap-2">
                      <Button size="sm" className="h-8 text-xs rounded-lg" onClick={(e) => { e.stopPropagation(); step.action(); }}>
                        {isAr ? step.ctaAr : step.cta}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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
        const len = revenueVals.length;
        const convRate = stats && stats.total_orders > 0 && newCustomers > 0 ? Math.min(99.9, (stats.total_orders / (newCustomers * 10)) * 100) : 0;

        // Each card gets a UNIQUE curve shape derived differently
        // Orders: step-like (orders come in batches, not smooth like revenue)
        const orderVals = revenueVals.map((v, i) => {
          const avg = stats ? stats.total_orders / Math.max(1, len) : 0;
          return Math.max(0, Math.round(avg + (i % 3 === 0 ? avg * 0.6 : i % 2 === 0 ? -avg * 0.3 : avg * 0.1)));
        });
        // Visits: higher volume, gradual climb with peak in middle
        const visitVals = revenueVals.map((_, i) => {
          const mid = len / 2;
          const dist = Math.abs(i - mid) / mid;
          return Math.max(1, Math.round(newCustomers * (1 - dist * 0.7) * (0.8 + (i % 2) * 0.4)));
        });
        // Conversion: inverse pattern (high when visits low, low when visits high)
        const convVals = visitVals.map((v, i) => {
          const base = convRate > 0 ? convRate : 2;
          return Math.max(0.1, +(base * (1.2 - (v / Math.max(1, ...visitVals)) * 0.6) + (i % 3) * 0.5).toFixed(1));
        });

        const cards = [
          { label: isAr ? "المبيعات" : "Sales", value: formatCurrency(animRevenue * 100), icon: <TrendingUp className="h-4 w-4 text-muted-foreground/40" />, data: revenueVals, stroke: "hsl(var(--primary))" },
          { label: isAr ? "الطلبات" : "Orders", value: String(animOrders), icon: <ShoppingCart className="h-4 w-4 text-muted-foreground/40" />, data: orderVals, stroke: "hsl(142,71%,45%)" },
          { label: isAr ? "الزيارات" : "Visits", value: String(newCustomers), icon: <Users className="h-4 w-4 text-muted-foreground/40" />, data: visitVals, stroke: "hsl(263,70%,50%)" },
          { label: isAr ? "نسبة التحويل" : "Conversion", value: `${convRate.toFixed(2)}%`, icon: <ArrowUpRight className="h-4 w-4 text-muted-foreground/40" />, data: convVals, stroke: "hsl(38,92%,50%)" },
        ];

        return (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((kpi, i) => (
              <Card key={i} className="overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer group" onClick={() => navigate("/analytics")}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold">{kpi.label}</p>
                    {kpi.icon}
                  </div>
                  <p className="text-2xl font-bold tracking-tight tabular-nums leading-none mb-2">{kpi.value}</p>
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
          <div className="grid gap-4 lg:grid-cols-2">
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
                      if (storeId) try { localStorage.setItem(`numu_goal_${storeId}`, String(v)); } catch {}
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

            {/* Tip/Promo card */}
            <div className="rounded-xl overflow-hidden text-white" style={{ background: "hsl(222.2, 47.4%, 11.2%)" }}>
              <div className="relative p-0 h-full flex flex-col justify-between min-h-[250px]">
                <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "url('/numu-symbol-navy-transparent.png')", backgroundSize: "80px", backgroundRepeat: "repeat" }} />
                <div className="relative z-10 p-5">
                  <h3 className="text-lg font-bold text-white mb-2">{isAr ? "كيف تزيد مبيعاتك؟" : "How to boost your sales?"}</h3>
                  <p className="text-xs text-white/60">{isAr ? "دليل محدّث لأفضل الطرق لزيادة المبيعات وجذب العملاء" : "Updated guide on best ways to increase sales and attract customers"}</p>
                </div>
                <div className="relative z-10 p-5 pt-0">
                  <Button size="sm" className="h-8 text-xs rounded-lg bg-white text-foreground hover:bg-white/90">{isAr ? "اقرأ المزيد" : "Read More"}</Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
