import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatMoney } from "@/lib/format-money";
import { Card, CardContent } from "@/components/ui/card";
import { StaleDataBanner } from "@/components/ui/stale-data-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import React, { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  getDashboardStats,
  getRevenueChart,
  getTopProducts,
  getOrderStreak,
  getConversionStats,
} from "@/services/analyticsApi";
import { dateRangeKey } from "@/services/dateRangeParams";
import {
  DateRangePicker,
  triggerLabel,
  useDateRangeUrlState,
} from "@/components/filters/DateRangePicker";
import { listOrders } from "@/services/orderApi";
import {
  getOnboarding,
  dismissOnboarding,
  undismissOnboarding,
} from "@/services/storeApi";
import type { OnboardingData } from "@/services/storeApi";
import { getPublicStoreUrl } from "@/lib/storefront";
import { toast } from "sonner";
import {
  TrendingUp,
  ShoppingCart,
  Users,
  ArrowUpRight,
  Hourglass,
  Clock,
  Package,
  ExternalLink,
  AlertTriangle,
  ChevronRight,
  Plus,
  CreditCard,
  Palette,
  CheckCircle2,
  Truck,
  Receipt,
  Gift,
  Zap,
  Check,
  Activity,
  Lightbulb,
  Wallet,
  ShoppingBag,
  Banknote,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCountUp } from "@/hooks/useCountUp";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { ActiveThemeCard } from "@/components/dashboard/ActiveThemeCard";
import { PromoSwiper } from "@/components/dashboard/PromoSwiper";
import { StoreHealthCard } from "@/components/dashboard/StoreHealthCard";
import { RecentlyViewed } from "@/components/dashboard/RecentlyViewed";

/* ─── Zone head — § eyebrow + question + hairline rule ──────────────── */
function ZoneHead({
  eyebrow,
  question,
}: {
  eyebrow: string;
  question: string;
}) {
  return (
    <div className="souq-zhead">
      <span className="souq-eyebrow">§ {eyebrow}</span>
      <span className="q hidden md:inline">{question}</span>
      <span className="line" />
    </div>
  );
}

const Dashboard = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const { user } = useAuth();
  const storeId = currentStore?.id;
  const { range, setRange } = useDateRangeUrlState();
  const rangeKey = dateRangeKey(range);
  const navigate = useNavigate();
  const isAr = language === "ar";
  const periodLabel = triggerLabel(range, isAr ? "ar" : "en");

  // Share the storefront link — native share sheet when available, otherwise
  // copy to clipboard with a toast. Used by the onboarding "Get your first
  // order" step (and the zero-orders card) so "Share" actually shares instead
  // of routing to store settings. Sharing does NOT tick the step — that
  // completes on its own when the first real order lands.
  const shareStoreLink = async () => {
    const url = getPublicStoreUrl(currentStore);
    if (!currentStore || !url) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: currentStore.name, url });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(isAr ? "تم نسخ رابط المتجر" : "Store link copied");
    } catch {
      window.open(url, "_blank");
    }
  };

  // Goals — orders/month or orders/year, persisted per-store in localStorage.
  // Lives in §GROW since "what should I do next?" is the natural home for
  // forward-looking targets. Editable inline.
  const [goalTarget, setGoalTarget] = useState(() => {
    try {
      return Number(localStorage.getItem(`numu_goal_${storeId}`) || "50");
    } catch {
      return 50;
    }
  });
  const [goalPeriodMode, setGoalPeriodMode] = useState<"monthly" | "yearly">("monthly");
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(goalTarget));

  const statsQuery = useQuery({
    queryKey: ["dashboard", "stats", storeId, ...rangeKey],
    queryFn: () => getDashboardStats(storeId!, range),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const chartQuery = useQuery({
    queryKey: ["dashboard", "chart", storeId, ...rangeKey],
    queryFn: () => getRevenueChart(storeId!, range),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  // Distinct-visitor truth for the Visitors/Conversion tiles. The old tiles
  // SUMMED the daily sparkline — i.e. total page VIEWS labelled "Visitors" —
  // which triple-counted every browsing session (a store with ~1.1k unique
  // visitors showed 2.5k) and made conversion look catastrophically low.
  const conversionQuery = useQuery({
    queryKey: ["dashboard", "conversion", storeId, ...rangeKey],
    queryFn: () => getConversionStats(storeId!, range),
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

  // Consecutive-days-with-orders streak (computed server-side, store tz).
  // Not range-scoped — independent of the date picker. Cache 30 min.
  const streakQuery = useQuery({
    queryKey: ["dashboard", "streak", storeId],
    queryFn: () => getOrderStreak(storeId!),
    enabled: !!storeId,
    staleTime: 1000 * 60 * 30,
  });
  const streak = streakQuery.data ?? null;

  const stats = statsQuery.data ?? null;
  const chartData = chartQuery.data ?? [];
  const topProducts = topProductsQuery.data ?? [];
  const recentOrders = recentOrdersQuery.data?.items ?? [];

  const formatCurrency = (cents: number) =>
    formatMoney(cents, { fromCents: true, locale: isAr ? "ar" : "en" });

  const todayRevenue = stats ? stats.total_revenue : 0;
  const todayOrders = stats ? stats.total_orders : 0;
  const newCustomers = stats ? stats.new_customers : 0;
  const todayProfit = stats ? stats.total_profit : 0;
  const productsWithCost = stats ? stats.products_with_cost : 0;
  const totalProductsWithCostHint = stats ? stats.total_products : 0;

  const animRevenue = useCountUp(todayRevenue / 100, 1400);
  const animOrders = useCountUp(todayOrders, 800);
  const animProfit = useCountUp(todayProfit / 100, 1400);

  const trendPercent = stats?.revenue_change_percent ?? 0;
  const trendStr =
    trendPercent >= 0
      ? `+${trendPercent.toFixed(1)}%`
      : `${trendPercent.toFixed(1)}%`;

  const pendingCount = stats
    ? stats.pending_orders + stats.processing_orders
    : 0;
  const lowStockCount = stats?.low_stock_count ?? 0;
  const isNewMerchant = (recentOrdersQuery.data?.total ?? 0) === 0;

  // Onboarding
  const onboardingQuery = useQuery({
    queryKey: ["onboarding", storeId],
    queryFn: () => getOnboarding(storeId!),
    enabled: !!storeId,
    staleTime: 1000 * 60 * 5,
  });
  const onboardingData: OnboardingData | null = onboardingQuery.data ?? null;
  const lifetimeOrderCount = recentOrdersQuery.data?.total ?? 0;
  const hasOrders = lifetimeOrderCount > 0;
  const canDismissOnboarding = !!onboardingData?.is_completed || hasOrders;
  const showSetup =
    !!onboardingData &&
    !onboardingData.is_completed &&
    !onboardingData.is_dismissed &&
    !hasOrders;

  const handleDismissOnboarding = async () => {
    if (!storeId) return;
    try {
      await dismissOnboarding(storeId);
      onboardingQuery.refetch();
    } catch {
      /* ignore */
    }
  };
  const handleShowOnboarding = async () => {
    if (!storeId) return;
    try {
      await undismissOnboarding(storeId);
      onboardingQuery.refetch();
    } catch {
      /* ignore */
    }
  };

  const revenueChartData = useMemo(
    () =>
      chartData.map((d) => ({
        day: d.date.slice(5),
        revenue: d.revenue / 100,
      })),
    [chartData],
  );

  if (statsQuery.isLoading && !stats) {
    return <DashboardSkeleton />;
  }

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return isAr ? "صباح الفل" : "Good morning";
    if (hour < 18) return isAr ? "نهارك سعيد" : "Good afternoon";
    return isAr ? "مساء النور" : "Good evening";
  })();

  // Order streak badge. Day 1 (only when today actually has an order) shows
  // a "let's start" nudge; 2+ days shows the celebratory run. A streak of 1
  // anchored on yesterday (no order today yet) shows nothing — saying "first
  // order today" would be wrong. Egyptian Arabic pluralization: يومين for 2,
  // أيام for 3–10, يوم for 11+.
  const streakDays = streak?.current_streak ?? 0;
  const isDayOneNudge = streakDays === 1 && (streak?.active_today ?? false);
  const showStreak = streakDays >= 2 || isDayOneNudge;
  const streakLabel = (() => {
    if (isDayOneNudge) {
      return isAr
        ? "أول طلب النهارده، يلا نبدأ!"
        : "First order today — let's start a streak!";
    }
    if (!isAr) return `${streakDays}-day order streak — you're on fire!`;
    const n = streakDays.toLocaleString("ar-EG");
    const dayPhrase =
      streakDays === 2 ? "يومين" : streakDays <= 10 ? `${n} أيام` : `${n} يوم`;
    return `${dayPhrase} ورا بعض وفيهم طلبات — مولّعها ما شاء الله!`;
  })();

  // Order status pills use the shared OrderStatusBadge ramp (this file
  // used to carry its own, slightly different, colour map).

  // Sparkline path builder (smooth bezier)
  const buildSparkPath = (data: number[], w: number, h: number) => {
    if (data.length < 2) return "";
    const max = Math.max(1, ...data);
    const pts = data.map((v, i) => ({
      x: (i / (data.length - 1)) * w,
      y: h - (v / max) * h * 0.8 - h * 0.1,
    }));
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cp1x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * 0.4;
      const cp2x = pts[i].x - (pts[i].x - pts[i - 1].x) * 0.4;
      d += ` C${cp1x},${pts[i - 1].y} ${cp2x},${pts[i].y} ${pts[i].x},${pts[i].y}`;
    }
    return d;
  };

  const revenueVals = revenueChartData.map((d) => d.revenue);
  const orderVals = chartData.map((d) => d.orders);
  const visitVals = chartData.map((d) => d.visits ?? 0);
  // Unique visitors from the analytics endpoint; the summed sparkline is
  // only the FALLBACK while that query loads (it counts views, not people).
  const totalVisits =
    conversionQuery.data?.total_visitors ??
    visitVals.reduce((s, v) => s + v, 0);
  const convRate =
    totalVisits > 0 ? Math.min(99.9, (animOrders / totalVisits) * 100) : 0;
  const heroSparkPath =
    revenueVals.length > 1 && revenueVals.some((v) => v > 0)
      ? buildSparkPath(revenueVals, 360, 48)
      : "";

  const profitHint =
    totalProductsWithCostHint > 0 &&
    productsWithCost < totalProductsWithCostHint
      ? isAr
        ? `${productsWithCost} من ${totalProductsWithCostHint} منتج لديهم تكلفة`
        : `${productsWithCost} of ${totalProductsWithCostHint} products have a cost set`
      : undefined;

  // §TODAY KPI tiles — Orders / Visitors / Conversion / Net Profit.
  // Each tile now carries its own analytics deep-link so the "View
  // Reports" footer link routes the merchant to the relevant page.
  const kpiTiles: Array<{
    label: string;
    value: string;
    Icon: typeof TrendingUp;
    chipClass: string;
    data: number[];
    stroke: string;
    hint?: string;
    /** Makes the hint a link (e.g. Net Profit → products missing a cost). */
    hintHref?: string;
    reportHref: string;
  }> = [
    {
      label: isAr ? "الطلبات" : "Orders",
      value: String(animOrders),
      Icon: ShoppingCart,
      chipClass: "ichip ichip-navy",
      data: orderVals,
      stroke: "hsl(var(--navy))",
      reportHref: "/analytics/orders",
    },
    {
      label: isAr ? "الزيارات" : "Visitors",
      value: String(totalVisits),
      Icon: Users,
      chipClass: "ichip ichip-sage",
      data: visitVals,
      stroke: "hsl(var(--sage))",
      reportHref: "/analytics/customers",
    },
    {
      label: isAr ? "نسبة التحويل" : "Conversion",
      value: totalVisits > 0 ? `${convRate.toFixed(2)}%` : "—",
      Icon: ArrowUpRight,
      chipClass: "ichip ichip-terra",
      data: [],
      stroke: "hsl(var(--terracotta))",
      reportHref: "/analytics/funnel",
    },
    {
      label: isAr ? "صافي الربح" : "Net Profit",
      value: formatCurrency(animProfit * 100),
      Icon: Receipt,
      chipClass: "ichip ichip-saffron",
      data: [],
      stroke: "hsl(var(--saffron))",
      hint: profitHint,
      hintHref: profitHint ? "/products?cost=missing" : undefined,
      reportHref: "/analytics/sales",
    },
  ];

  // §NEEDS YOU triage rows — derived from real signals
  type TriageRow = {
    tone: string;
    Icon: typeof TrendingUp;
    lead: string;
    desc: string;
    cta: string;
    value?: string;
    onClick: () => void;
  };
  const triageRows: TriageRow[] = [];
  if (pendingCount > 0) {
    triageRows.push({
      tone: "ichip-saffron",
      Icon: Hourglass,
      lead: isAr
        ? `${pendingCount} طلب${pendingCount > 1 ? "ات" : ""} مستنية التجهيز`
        : `${pendingCount} order${pendingCount > 1 ? "s" : ""} waiting to be fulfilled`,
      desc: isAr ? "اتصرف فيها بسرعة" : "Take action soon",
      cta: isAr ? "جهّز" : "Fulfill",
      onClick: () => navigate("/orders?status=pending"),
    });
  }
  if (lowStockCount > 0) {
    triageRows.push({
      tone: "ichip-terra",
      Icon: AlertTriangle,
      lead: isAr
        ? `${lowStockCount} منتج${lowStockCount > 1 ? "ات" : ""} قرب تخلص`
        : `${lowStockCount} product${lowStockCount > 1 ? "s" : ""} low on stock`,
      desc: isAr ? "محتاج إعادة تخزين" : "Restock needed",
      cta: isAr ? "خزّن" : "Restock",
      onClick: () => navigate("/products"),
    });
  }
  // COD reconcile row — always show as a navigational entry
  triageRows.push({
    tone: "ichip-navy",
    Icon: Banknote,
    lead: isAr ? "تسوية الدفع عند الاستلام" : "COD reconciliation",
    desc: isAr ? "طابق الفلوس المحصّلة" : "Match collected cash",
    cta: isAr ? "سوّي" : "Reconcile",
    onClick: () => navigate("/cod"),
  });
  triageRows.push({
    tone: "ichip-sage",
    Icon: ShoppingBag,
    lead: isAr ? "السلات المهجورة" : "Abandoned checkouts",
    desc: isAr ? "ذكّر العملاء يكملوا الشراء" : "Remind shoppers to complete",
    cta: isAr ? "ذكّر" : "Remind",
    onClick: () => navigate("/orders/abandoned"),
  });

  return (
    <div className="space-y-6">
      {/* Offline honesty. This dashboard is mostly money figures, and a
          merchant reading a cached revenue number as today's makes a real
          decision on a wrong one. Self-hides when online. */}
      <StaleDataBanner
        updatedAt={statsQuery.dataUpdatedAt}
        onRetry={() => void statsQuery.refetch()}
      />
      {/* Active theme card — surfaces the store's current V3 theme */}
      <ActiveThemeCard />
      {/* Zid-style pinned + recently opened pages */}
      <RecentlyViewed />
      {/* ─── Greeting strip — sits above the zones ────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <img
            src="/onboarding/welcome.webp"
            alt=""
            className="hidden sm:block w-[52px] h-[52px] object-contain shrink-0"
          />
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight leading-tight">
              {greeting}،{" "}
              {user?.first_name ||
                currentStore?.name ||
                (isAr ? "أحمد" : "Ahmed")}{" "}
              👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {pendingCount > 0
                ? isAr
                  ? `عندك ${pendingCount} طلب محتاج اهتمامك — والمبيعات في تحسّن`
                  : `You have ${pendingCount} order${pendingCount > 1 ? "s" : ""} needing attention — and sales are up`
                : trendPercent > 0
                  ? isAr
                    ? `الإيرادات زادت ${trendStr} عن الفترة السابقة`
                    : `Revenue is up ${trendStr} from last period`
                  : isAr
                    ? "كل حاجة تمام النهارده"
                    : "All good for today"}
            </p>
            {showStreak && (
              <Badge
                variant="accent"
                className="mt-2.5 gap-1.5 px-3 py-1 text-xs font-extrabold"
                title={
                  isDayOneNudge
                    ? undefined
                    : isAr
                      ? `أطول سلسلة ليك: ${(streak?.longest_streak ?? streakDays).toLocaleString("ar-EG")} يوم`
                      : `Your longest streak: ${streak?.longest_streak ?? streakDays} days`
                }
              >
                🔥 {streakLabel}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <DateRangePicker
            value={range}
            onChange={setRange}
            size="sm"
            align="end"
            className="rounded-full border border-border/60 bg-card hover:bg-muted/50"
          />
          {onboardingData?.is_dismissed && !onboardingData?.is_completed && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleShowOnboarding}
            >
              <Gift className="h-4 w-4" />
              {isAr ? "دليل الإعداد" : "Setup Guide"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              const url = getPublicStoreUrl(currentStore);
              if (url) window.open(url, "_blank");
            }}
          >
            <ExternalLink className="h-4 w-4" />
            {isAr ? "شوف المتجر" : "View store"}
          </Button>
          <Button
            variant="accent"
            size="sm"
            className="gap-2"
            onClick={() => navigate("/products/new")}
          >
            <Plus className="h-4 w-4" />
            {isAr ? "ضيف منتج" : "Add product"}
          </Button>
        </div>
      </div>

      {/* ─── Compact onboarding strip (first-time merchants) ──────────── */}
      {showSetup &&
        onboardingData &&
        (() => {
          const steps = onboardingData.steps.filter(
            (s) => s.key !== "create_store",
          );
          const done = steps.filter(
            (s) => s.status === "completed" || s.status === "skipped",
          ).length;
          const total = steps.length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const next = steps.find(
            (s) => s.status !== "completed" && s.status !== "skipped",
          );
          const NEXT_CTA: Record<
            string,
            { en: string; ar: string; href: string }
          > = {
            add_product: {
              en: "Add product",
              ar: "ضيف منتج",
              href: "/products/new",
            },
            set_identity: {
              en: "Set store identity",
              ar: "اضبط هويتك",
              href: "/store",
            },
            confirm_support: {
              en: "Confirm number",
              ar: "أكد الرقم",
              href: "/store",
            },
            add_shipping: {
              en: "Set up shipping",
              ar: "اضبط الشحن",
              href: "/logistics",
            },
            configure_payment: {
              en: "Activate payments",
              ar: "فعّل الدفع",
              href: "/payment-setup",
            },
            first_order: {
              en: "Share store link",
              ar: "شارك المتجر",
              href: "/store",
            },
          };
          const cta = next ? NEXT_CTA[next.key] : null;
          const runCta = (e: React.MouseEvent) => {
            e.stopPropagation();
            // The "first order" step is a share action, not a settings page —
            // route everything else, but share the store link here.
            if (next?.key === "first_order") shareStoreLink();
            else if (cta) navigate(cta.href);
          };
          const scrollToWizard = () => {
            document
              .getElementById("onboarding-wizard")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          };
          return (
            <button
              type="button"
              onClick={scrollToWizard}
              className="souq-onboard w-full text-start hover-lift cursor-pointer block"
            >
              <div className="flex items-center gap-4 flex-wrap">
                <div className="ichip ichip-saffron shrink-0">
                  <Gift className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-extrabold leading-tight">
                    {isAr ? "كمّل تجهيز متجرك" : "Finish setting up your store"}
                  </p>
                  <p className="text-[12px] text-white/60 mt-0.5">
                    {isAr
                      ? `كمّل الـ${total} خطوات واكسب شهر Premium مجاناً`
                      : `Complete all ${total} steps & get 1 month Premium — free`}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-saffron font-extrabold">
                  <span className="tabular-nums text-lg">
                    {isAr ? done.toLocaleString("ar-EG") : done}
                  </span>
                  <span className="text-white/30">/</span>
                  <span className="tabular-nums text-lg text-white/50">
                    {isAr ? total.toLocaleString("ar-EG") : total}
                  </span>
                </div>
                {cta && (
                  <Button
                    variant="accent"
                    size="sm"
                    className="shrink-0"
                    onClick={runCta}
                  >
                    {isAr ? cta.ar : cta.en}
                    <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                )}
              </div>
              <div className="progress">
                <i style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })()}

      {/* ─────────────────────────────── §TODAY ─────────────────────── */}
      <section>
        <ZoneHead
          eyebrow={isAr ? "النهارده" : "TODAY"}
          question={
            isAr
              ? "كسبت النهارده؟ وفيه حد مستنيني؟"
              : "Did I make money — and is anyone waiting on me?"
          }
        />

        <div className="grid gap-4 lg:[grid-template-columns:1.35fr_1fr]">
          {/* Sales hero — navy + saffron sparkline + watermark N */}
          <button
            type="button"
            onClick={() => navigate("/analytics")}
            className="souq-hero-navy text-start p-5 hover-lift min-h-[170px] flex flex-col"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-white/70">
                {isAr ? "المبيعات" : "Sales"} · {periodLabel}
              </span>
              {trendPercent !== 0 && animRevenue > 0 && (
                <span
                  className={`souq-pill ${trendPercent > 0 ? "souq-delta-up" : "souq-delta-down"}`}
                >
                  <span className="ltr-nums">{trendStr}</span>
                </span>
              )}
            </div>
            <div className="text-[35px] font-extrabold tabular-nums tracking-tight leading-none mt-3 text-white">
              {formatCurrency(animRevenue * 100)}
            </div>
            <div className="mt-auto pt-4 -mx-1 h-12">
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 360 48"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="hero-spark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E89A2C" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#E89A2C" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {heroSparkPath ? (
                  <>
                    <path
                      d={heroSparkPath + ` L360,48 L0,48 Z`}
                      fill="url(#hero-spark)"
                    />
                    <path
                      d={heroSparkPath}
                      fill="none"
                      stroke="#E89A2C"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </>
                ) : (
                  <line
                    x1="0"
                    y1="44"
                    x2="360"
                    y2="44"
                    stroke="rgba(255,255,255,.2)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                )}
              </svg>
            </div>
          </button>

          {/* Waiting-on-you card — three distinct states:
              (a) Pending orders: saffron urgency, big count, oldest-order
                  click-through and saffron Fulfill CTA.
              (b) All caught up but the store has shipped before: sage
                  celebration with today's shipped count + "create order".
              (c) Zero lifetime orders: navy invitation to share the
                  store link — this is "you haven't started yet". */}
          <Card className="flex flex-col">
            <CardContent className="p-5 flex flex-col gap-3 flex-1">
              {pendingCount > 0 ? (
                // ─── (a) Pending state ─────────────────────────────
                <>
                  <div className="flex items-center gap-4">
                    <Hourglass
                      className="h-10 w-10 text-saffron shrink-0"
                      strokeWidth={1.8}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[32px] font-extrabold tabular-nums leading-none">
                        {isAr ? pendingCount.toLocaleString("ar-EG") : pendingCount}
                      </div>
                      <div className="text-xs text-muted-foreground font-semibold mt-1">
                        {isAr ? "مستنيين تجهيزك" : "Waiting on you"}
                      </div>
                    </div>
                    <Button
                      variant="accent"
                      size="sm"
                      className="gap-1.5 ms-auto"
                      onClick={() => navigate("/orders?status=pending")}
                    >
                      <Truck className="h-4 w-4" strokeWidth={2.4} />
                      {isAr ? "جهّز دلوقتي" : "Fulfill now"}
                    </Button>
                  </div>
                  {recentOrders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => navigate(`/orders/${recentOrders[0].id}`)}
                      className="mt-auto pt-3 border-t border-border souq-hoverrow rounded-lg p-2 -m-2 text-start"
                    >
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold mb-1.5">
                        {isAr ? "أقدم طلب مستني" : "Oldest waiting"}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[13px] font-extrabold tabular-nums truncate">
                          {recentOrders[0].order_number}
                        </span>
                        <span className="text-[14px] font-extrabold tabular-nums text-foreground">
                          {formatCurrency(recentOrders[0].total)}
                        </span>
                      </div>
                      {recentOrders[0].customer_name && (
                        <div className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                          {recentOrders[0].customer_name}
                        </div>
                      )}
                    </button>
                  )}
                </>
              ) : isNewMerchant ? (
                // ─── (c) Brand-new store: invite to launch ────────
                <>
                  <div className="flex items-center gap-4">
                    <ExternalLink
                      className="h-10 w-10 text-navy shrink-0"
                      strokeWidth={1.8}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[16px] font-extrabold leading-tight">
                        {isAr ? "أول طلب لسه مجاش" : "Your first order awaits"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {isAr ? "شارك رابط متجرك وابدأ تستقبل طلبات" : "Share your store link and start receiving orders"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto pt-3 border-t border-border flex items-center gap-2">
                    <Button
                      variant="accent"
                      size="sm"
                      className="gap-1.5 flex-1"
                      onClick={async () => {
                        const url = getPublicStoreUrl(currentStore);
                        if (currentStore && url) {
                          if (navigator.share) {
                            try { await navigator.share({ title: currentStore.name, url }); } catch { /* cancelled */ }
                          } else {
                            try {
                              await navigator.clipboard.writeText(url);
                            } catch { /* ignore */ }
                          }
                        }
                      }}
                    >
                      <ExternalLink className="h-4 w-4" strokeWidth={2.2} />
                      {isAr ? "شارك المتجر" : "Share store"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => navigate("/products/new")}
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.4} />
                      {isAr ? "منتج" : "Product"}
                    </Button>
                  </div>
                </>
              ) : (
                // ─── (b) Caught up: sage celebration with today's win ──
                <>
                  <div className="flex items-center gap-4">
                    <CheckCircle2
                      className="h-10 w-10 text-sage shrink-0"
                      strokeWidth={1.8}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[16px] font-extrabold leading-tight">
                        {isAr ? "كل حاجة تمام 👏" : "All clear 👏"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {isAr ? "مفيش طلبات مستنية اهتمامك" : "Nothing's waiting on you right now"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto pt-3 border-t border-border grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-bold">
                        {isAr ? "اتشحن الفترة دي" : "Shipped this period"}
                      </div>
                      <div className="text-[20px] font-extrabold tabular-nums leading-none mt-1">
                        {isAr
                          ? (stats?.shipped_orders ?? 0).toLocaleString("ar-EG")
                          : (stats?.shipped_orders ?? 0)}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 self-end"
                      onClick={() => navigate("/orders/create")}
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.4} />
                      {isAr ? "طلب جديد" : "New order"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* KPI tiles row — Orders / Visitors / Conversion / Net Profit.
            Each tile: ichip + label + big value + sparkline (or hint),
            then a footer with the period chip on the left and a
            "View Reports" link on the right that deep-links to the
            relevant /analytics/* sub-page. Clicking inside the footer
            doesn't bubble to the card-level navigate (so the link wins). */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mt-4">
          {kpiTiles.map((kpi, i) => {
            const hasChart = kpi.data.length > 1 && kpi.data.some((v) => v > 0);
            return (
              <Card
                key={i}
                className="overflow-hidden hover-lift cursor-pointer group flex flex-col"
                onClick={() => navigate(kpi.reportHref)}
              >
                {/* p-4 below sm: at 360px the 2-up grid leaves ~156px per tile,
                    and p-5 spent 40px of that on padding. Unchanged from sm up. */}
                <CardContent className="p-4 sm:p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className={kpi.chipClass}>
                      <kpi.Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-[12.5px] font-semibold text-muted-foreground mb-1">
                    {kpi.label}
                  </p>
                  <p className="text-[23px] font-extrabold tracking-tight tabular-nums leading-none mb-3 text-foreground">
                    {kpi.value}
                  </p>
                  {hasChart ? (
                    <div className="h-9 -mb-1">
                      <svg
                        width="100%"
                        height="100%"
                        viewBox="0 0 200 40"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient
                            id={`spark-${i}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={kpi.stroke}
                              stopOpacity="0.18"
                            />
                            <stop
                              offset="100%"
                              stopColor={kpi.stroke}
                              stopOpacity="0"
                            />
                          </linearGradient>
                        </defs>
                        <path
                          d={
                            buildSparkPath(kpi.data, 200, 40) +
                            ` L200,40 L0,40 Z`
                          }
                          fill={`url(#spark-${i})`}
                        />
                        <path
                          d={buildSparkPath(kpi.data, 200, 40)}
                          fill="none"
                          stroke={kpi.stroke}
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  ) : kpi.hint && kpi.hintHref ? (
                    // "2 of 3 products have a cost set" was plain text — now
                    // it takes the merchant straight to the products missing one.
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navigate(kpi.hintHref!); }}
                      className="text-start text-[11px] leading-snug text-amber-700 dark:text-amber-400 underline-offset-2 hover:underline"
                    >
                      {kpi.hint} →
                    </button>
                  ) : kpi.hint ? (
                    <p className="text-[11px] text-muted-foreground/80 leading-snug">
                      {kpi.hint}
                    </p>
                  ) : (
                    <div className="h-9" />
                  )}
                  {/* Footer — period + View Reports */}
                  <div
                    className="mt-auto pt-3 border-t border-border/60 flex items-center justify-between gap-2 text-[11.5px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="inline-flex items-center gap-1 text-muted-foreground font-semibold">
                      <Clock className="h-3 w-3" strokeWidth={2.2} />
                      {periodLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(kpi.reportHref)}
                      className="font-bold text-navy hover:underline underline-offset-4"
                    >
                      {isAr ? "التقارير" : "View Reports"}
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ─────────────────────────── §NEEDS YOU ────────────────────── */}
      <section>
        <ZoneHead
          eyebrow={isAr ? "محتاج منك" : "NEEDS YOU"}
          question={isAr ? "فيه حاجة وقفت؟" : "Is anything broken?"}
        />

        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          {/* Triage list */}
          <Card>
            <CardContent className="p-2">
              {triageRows.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="h-8 w-8 text-sage mx-auto mb-2" />
                  <p className="text-sm font-bold">
                    {isAr ? "كل حاجة شغّالة تمام" : "Everything looks good"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAr
                      ? "مفيش حاجة محتاجة اهتمامك دلوقتي"
                      : "Nothing needs your attention right now"}
                  </p>
                </div>
              ) : (
                triageRows.map((row, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={row.onClick}
                    className="souq-triage-row w-full text-start"
                  >
                    <div className={`ichip ${row.tone}`}>
                      <row.Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="lead">{row.lead}</div>
                      <div className="desc">{row.desc}</div>
                    </div>
                    {row.value && (
                      <span className="tabular-nums font-extrabold text-sm me-2">
                        {row.value}
                      </span>
                    )}
                    <span className="cta">
                      {row.cta}
                      <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Promo swiper; once every slide is dismissed the Store-health
              hero takes the slot back. */}
          <PromoSwiper className="self-start" fallback={<StoreHealthCard />} />
        </div>
      </section>

      {/* ─────────────────────────────── §GROW ─────────────────────── */}
      {!isNewMerchant && (
        <section>
          <ZoneHead
            eyebrow={isAr ? "نمّي" : "GROW"}
            question={isAr ? "أعمل إيه بعد كده؟" : "What should I do next?"}
          />

          <div className="grid gap-4 lg:[grid-template-columns:1.7fr_1fr]">
            {/* Revenue chart */}
            <Card>
              <div className="souq-section-head px-5 pt-5 pb-2">
                <h2 className="text-[17px] font-bold tracking-tight">
                  {isAr ? "حركة الإيرادات" : "Revenue this period"}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 rounded-lg"
                  onClick={() => navigate("/analytics")}
                >
                  {isAr ? "شوف الكل" : "View all"} →
                </Button>
              </div>
              <CardContent className="pb-4">
                <div className="h-[230px]">
                  {chartQuery.isLoading && revenueChartData.length === 0 ? (
                    <Skeleton className="h-full w-full rounded-lg" />
                  ) : revenueChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueChartData}>
                        <defs>
                          <linearGradient
                            id="colorRevenue"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="hsl(var(--navy))"
                              stopOpacity={0.18}
                            />
                            <stop
                              offset="95%"
                              stopColor="hsl(var(--navy))"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 5"
                          className="stroke-border/40"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 10,
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 10,
                          }}
                          axisLine={false}
                          tickLine={false}
                          width={45}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "12px",
                            boxShadow: "var(--shadow-pop)",
                            fontSize: "12px",
                            padding: "8px 12px",
                          }}
                          formatter={(value: number) => [
                            formatCurrency(value * 100),
                            isAr ? "الإيراد" : "Revenue",
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="hsl(var(--navy))"
                          fill="url(#colorRevenue)"
                          strokeWidth={2.5}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState
                      icon={TrendingUp}
                      title={
                        isAr ? "لا توجد بيانات بعد" : "No revenue data yet"
                      }
                      description={
                        isAr
                          ? "البيانات هتظهر بعد أول طلبات"
                          : "Data appears after your first orders"
                      }
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top sellers */}
            <Card>
              <div className="souq-section-head px-5 pt-5 pb-2">
                <h2 className="text-[17px] font-bold tracking-tight">
                  {isAr ? "الأكتر مبيعاً" : "Top sellers"}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 rounded-lg"
                  onClick={() => navigate("/products")}
                >
                  {isAr ? "شوف الكل" : "View all"} →
                </Button>
              </div>
              <CardContent>
                {topProducts.length > 0 ? (
                  <div className="space-y-0.5">
                    {topProducts.map((p, i) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 rounded-lg p-2.5 -mx-1 souq-hoverrow cursor-pointer"
                        onClick={() => navigate(`/analytics/products?product=${p.id}`)}
                        title={isAr ? "اعرض تحليلات المنتج" : "View product analytics"}
                      >
                        <span className="text-[14px] font-extrabold text-muted-foreground/50 w-5 text-center tabular-nums">
                          {isAr ? (i + 1).toLocaleString("ar-EG") : i + 1}
                        </span>
                        <div className="souq-thumb h-9 w-9 overflow-hidden">
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold truncate">
                            {p.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            {isAr
                              ? p.quantity_sold.toLocaleString("ar-EG")
                              : p.quantity_sold}{" "}
                            {isAr ? "مبيعة" : "sold"}
                          </p>
                        </div>
                        <span className="text-[13px] font-extrabold tabular-nums">
                          {formatCurrency(p.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : topProductsQuery.isLoading ? (
                  <div className="space-y-2 py-1">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5">
                        <Skeleton className="h-9 w-9 rounded-lg" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-3.5 w-32" />
                          <Skeleton className="h-3 w-14" />
                        </div>
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                ) : totalProductsWithCostHint === 0 ? (
                  // Genuinely no catalog → point at adding a product.
                  <EmptyState
                    icon={Package}
                    title={isAr ? "لا توجد منتجات بعد" : "No products yet"}
                    className="py-6"
                    action={
                      <Button size="sm" className="h-8 text-xs rounded-lg" onClick={() => navigate("/products/new")}>
                        {isAr ? "أضف منتج" : "Add a product"}
                      </Button>
                    }
                  />
                ) : (
                  // This list is ranked BY SALES — an empty list with products
                  // in the catalog means "no sales yet", not "no products".
                  <EmptyState
                    icon={TrendingUp}
                    tone="sage"
                    title={t("dashboard.noSalesYet")}
                    description={t("dashboard.noSalesYetBody")}
                    className="py-6"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Goals — orders/month or orders/year tracker. Inline edit;
              progress bar; live + remaining counts. Restored from the
              pre-Souq dashboard; lives in §GROW since it answers
              "what should I do next?". */}
          {(() => {
            const currentOrders = stats?.total_orders ?? 0;
            const goalMultiplier = goalPeriodMode === "yearly" ? 12 : 1;
            const effectiveGoal = goalTarget * goalMultiplier;
            const progressPct = Math.min(100, Math.round((currentOrders / Math.max(1, effectiveGoal)) * 100));
            const remaining = Math.max(0, effectiveGoal - currentOrders);
            const fmtN = (n: number) => isAr ? n.toLocaleString("ar-EG") : n.toLocaleString();
            return (
              <Card className="mt-4">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                    <div>
                      <h2 className="text-[17px] font-bold tracking-tight">
                        {isAr ? "تابع أهدافك" : "Track your goals"}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                        {isAr
                          ? "حدد هدف الطلبات وتابع تقدمك — هنساعدك توصلّه"
                          : "Set an order goal and watch your progress — we'll help you get there"}
                      </p>
                    </div>
                    {/* Monthly / Yearly toggle */}
                    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setGoalPeriodMode("monthly")}
                        className={`h-7 px-3 text-[11px] font-bold rounded-md transition-all ${
                          goalPeriodMode === "monthly"
                            ? "bg-card shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {isAr ? "شهري" : "Monthly"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setGoalPeriodMode("yearly")}
                        className={`h-7 px-3 text-[11px] font-bold rounded-md transition-all ${
                          goalPeriodMode === "yearly"
                            ? "bg-card shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {isAr ? "سنوي" : "Yearly"}
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">{isAr ? "تقدمك" : "Your progress"}</span>
                      <span className="font-extrabold tabular-nums">{progressPct}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-saffron to-sage transition-all duration-700"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats row — stays 3-up on mobile (Current/Goal/Remaining
                      is a triplet; stacking it would lengthen the page for no
                      gain), but the tiles shed padding at 360px where each is
                      only ~101px wide. */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-xl border p-2.5 sm:p-3 text-center">
                      <p className="text-[10.5px] text-muted-foreground mb-1 font-semibold">
                        {isAr ? "الحالي" : "Current"}
                      </p>
                      <p className="text-lg font-extrabold tabular-nums">{fmtN(currentOrders)}</p>
                    </div>
                    <div className="rounded-xl border p-2.5 sm:p-3 text-center bg-navy/[0.03] dark:bg-navy/[0.10]">
                      <p className="text-[10.5px] text-muted-foreground mb-1 font-semibold">
                        {isAr ? "الهدف" : "Goal"}
                      </p>
                      <p className="text-lg font-extrabold tabular-nums">{fmtN(effectiveGoal)}</p>
                    </div>
                    <div className="rounded-xl border p-2.5 sm:p-3 text-center">
                      <p className="text-[10.5px] text-muted-foreground mb-1 font-semibold">
                        {isAr ? "المتبقي" : "Remaining"}
                      </p>
                      <p className="text-lg font-extrabold tabular-nums">{fmtN(remaining)}</p>
                    </div>
                  </div>

                  {/* Edit goal */}
                  {editingGoal ? (
                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                      <Input
                        type="number"
                        value={goalInput}
                        onChange={(e) => setGoalInput(e.target.value)}
                        className="h-9 w-24"
                        min={1}
                      />
                      <span className="text-xs text-muted-foreground">
                        {isAr ? "طلب/شهر" : "orders/mo"}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => {
                          const v = Math.max(1, Number(goalInput) || 50);
                          setGoalTarget(v);
                          setEditingGoal(false);
                          if (storeId) {
                            try { localStorage.setItem(`numu_goal_${storeId}`, String(v)); } catch { /* ignore */ }
                          }
                        }}
                      >
                        {isAr ? "حفظ" : "Save"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingGoal(false)}>
                        {isAr ? "إلغاء" : "Cancel"}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setGoalInput(String(goalTarget)); setEditingGoal(true); }}
                      >
                        {isAr ? "عدّل الهدف" : "Edit goal"}
                      </Button>
                      <Button variant="accent" size="sm" onClick={() => navigate("/grow")}>
                        {isAr ? "ساعدني أوصله" : "Help me reach it"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Recent orders — full width below */}
          <Card className="mt-4">
            <div className="souq-section-head px-5 pt-5 pb-2">
              <h2 className="text-[17px] font-bold tracking-tight">
                {isAr ? "آخر الطلبات" : "Recent orders"}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 rounded-lg"
                onClick={() => navigate("/orders")}
              >
                {isAr ? "شوف الكل" : "View all"} →
              </Button>
            </div>
            <CardContent>
              {recentOrders.length > 0 ? (
                <div className="space-y-1">
                  {recentOrders.slice(0, 5).map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center gap-3 rounded-lg p-2.5 -mx-1 souq-hoverrow"
                      onClick={() => navigate(`/orders/${o.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold font-mono tabular-nums">
                            {o.order_number}
                          </span>
                          <OrderStatusBadge status={o.status} dot={false} className="px-2 py-0 font-semibold" />
                        </div>
                        <p className="text-[11.5px] text-muted-foreground mt-0.5">
                          {o.customer_name || "—"}
                        </p>
                      </div>
                      <span className="text-[14px] font-extrabold tabular-nums shrink-0">
                        {formatCurrency(o.total)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : recentOrdersQuery.isLoading ? (
                <div className="space-y-1 py-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5">
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={ShoppingCart}
                  title={isAr ? "لا توجد طلبات بعد" : "No orders yet"}
                  className="py-6"
                />
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* ─── Full onboarding wizard (anchor target for compact strip) ── */}
      <div id="onboarding-wizard" />
      {showSetup &&
        onboardingData &&
        (() => {
          const STEP_UI: Record<
            string,
            {
              label: string;
              labelAr: string;
              desc: string;
              descAr: string;
              action: () => void;
              cta: string;
              ctaAr: string;
              Icon: typeof Package;
              time: string;
              timeAr: string;
            }
          > = {
            add_product: {
              label: "Add a Product",
              labelAr: "أضف منتج",
              desc: "Add your first product to start selling online",
              descAr: "أضف أول منتج لبدء البيع أونلاين",
              action: () => navigate("/products/new"),
              cta: "Add Product",
              ctaAr: "أضف منتج",
              Icon: Package,
              time: "2 min",
              timeAr: "دقيقتان",
            },
            set_identity: {
              label: "Add Store Identity",
              labelAr: "أضف هوية متجرك",
              desc: "Upload logo and add store description",
              descAr: "اعكس هويتك البصرية على متجرك",
              action: () => navigate("/store"),
              cta: "Add Details",
              ctaAr: "أضف تفاصيلك",
              Icon: Palette,
              time: "3 min",
              timeAr: "3 دقائق",
            },
            confirm_support: {
              label: "Add Support Number",
              labelAr: "أكد رقم الدعم",
              desc: "Add a phone number so customers can reach you",
              descAr: "أضف رقم للدعم لعملاؤك",
              action: () => navigate("/store"),
              cta: "Confirm Number",
              ctaAr: "أكد الرقم",
              Icon: CheckCircle2,
              time: "30 sec",
              timeAr: "30 ثانية",
            },
            add_shipping: {
              label: "Set Up Shipping",
              labelAr: "حدد الشحن",
              desc: "Configure shipping zones or connect a carrier",
              descAr: "اضبط مناطق الشحن",
              action: () => navigate("/logistics"),
              cta: "Set Up",
              ctaAr: "إعداد",
              Icon: Truck,
              time: "3 min",
              timeAr: "3 دقائق",
            },
            configure_payment: {
              label: "Activate Payments",
              labelAr: "فعّل المدفوعات",
              desc: "Connect a payment gateway",
              descAr: "أكمل التحقق وفعّل الدفع",
              action: () => navigate("/payment-setup"),
              cta: "Activate",
              ctaAr: "ابدأ التحقق",
              Icon: CreditCard,
              time: "5 min",
              timeAr: "5 دقائق",
            },
            first_order: {
              label: "Get Your First Order",
              labelAr: "أول طلب",
              desc: "Share your store link — this ticks itself when your first order lands",
              descAr: "شارك رابط متجرك — بتكمّل لوحدها أول ما يجيلك أول طلب",
              action: shareStoreLink,
              cta: "Share store link",
              ctaAr: "شارك الرابط",
              Icon: Zap,
              time: "1 min",
              timeAr: "دقيقة",
            },
          };
          const steps = onboardingData.steps
            .filter((s) => s.key !== "create_store" && STEP_UI[s.key])
            .map((s, i) => ({
              ...STEP_UI[s.key],
              key: s.key,
              num: i + 1,
              done: s.status === "completed" || s.status === "skipped",
            }));
          const doneCount = steps.filter((s) => s.done).length;
          const totalSteps = steps.length;
          const displayDone = doneCount;
          const progressPercent =
            totalSteps > 0 ? Math.round((displayDone / totalSteps) * 100) : 0;

          return (
            <section>
              <div className="souq-onboard">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="ichip ichip-saffron">
                      <Gift className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold leading-tight">
                        {isAr
                          ? "جهّز متجرك واحصل على شهر Premium مجاناً"
                          : "Set up your store & get 1 month Premium free"}
                      </h2>
                      <p className="text-[12px] text-white/60 mt-0.5">
                        <span className="tabular-nums font-bold text-saffron">
                          {displayDone}
                        </span>
                        <span className="text-white/30">/</span>
                        <span className="tabular-nums">{totalSteps}</span>{" "}
                        {isAr ? "مكتمل" : "completed"}
                      </p>
                    </div>
                  </div>
                  {canDismissOnboarding && (
                    <button
                      type="button"
                      onClick={handleDismissOnboarding}
                      className="text-[11px] text-white/40 hover:text-white/70 transition-colors shrink-0"
                    >
                      {isAr ? "إخفاء" : "Hide"}
                    </button>
                  )}
                </div>
                <div className="progress">
                  <i style={{ width: `${progressPercent}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                {steps.map((step) => {
                  const Icon = step.Icon;
                  return (
                    <Card
                      key={step.key}
                      className={`overflow-hidden transition-all ${step.done ? "opacity-60" : "hover-lift cursor-pointer"}`}
                      onClick={() => !step.done && step.action()}
                    >
                      <CardContent className="p-5 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div
                            className={`ichip ${step.done ? "ichip-sage" : "ichip-saffron"}`}
                          >
                            {step.done ? (
                              <Check className="h-5 w-5" />
                            ) : (
                              <Icon className="h-5 w-5" />
                            )}
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {isAr ? step.timeAr : step.time}
                          </span>
                        </div>
                        <div>
                          <h3
                            className={`text-sm font-extrabold ${step.done ? "line-through text-muted-foreground" : ""}`}
                          >
                            {isAr ? step.labelAr : step.label}
                          </h3>
                          <p className="text-[12px] text-muted-foreground mt-1 leading-snug">
                            {isAr ? step.descAr : step.desc}
                          </p>
                        </div>
                        {!step.done && (
                          <Button
                            size="sm"
                            variant="accent"
                            className="self-start mt-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              step.action();
                            }}
                          >
                            {isAr ? step.ctaAr : step.cta}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })()}
    </div>
  );
};

export default Dashboard;
