import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tag, ShareNetwork, ChatCircleText, Image as ImageIcon,
  Truck, Package, ArrowsLeftRight, Megaphone, ChartLineUp,
  Clock, CheckCircle, Gift, Sparkle, Repeat, Storefront,
  ArrowRight, MapPin, Users,
} from "@phosphor-icons/react";
import {
  getDashboardStats, getConversionStats, getCodRejectionStats,
} from "@/services/analyticsApi";
import { useDateRangeUrlState } from "@/components/filters/DateRangePicker";
import { listOrders } from "@/services/orderApi";

/* Growth Guide — concrete, ranked tactics a merchant can act on today
   to reach their order goal. Not a marketing brochure: every card is
   either (a) a deep link to a real action in the app, or (b) a
   stat-derived diagnosis (e.g. "your conversion is 1.2% — try X"). */

interface PlayCard {
  Icon: typeof Tag;
  tone: string;
  title: string;
  desc: string;
  cta: string;
  href: string;
  /** Soft priority signal — driven by the merchant's own data. */
  badge?: { label: string; tone: "navy" | "saffron" | "sage" | "terra" };
}

const GrowthGuide = () => {
  const { isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const navigate = useNavigate();
  const storeId = currentStore?.id;
  const { range } = useDateRangeUrlState();

  // Pull the same data the Dashboard reads so the guide reflects real
  // store state — not generic advice.
  const statsQuery = useQuery({
    queryKey: ["growth", "stats", storeId],
    queryFn: () => getDashboardStats(storeId!, range),
    enabled: !!storeId,
  });
  const conversionQuery = useQuery({
    queryKey: ["growth", "conversion", storeId],
    queryFn: () => getConversionStats(storeId!, range),
    enabled: !!storeId,
  });
  const codRejectionQuery = useQuery({
    queryKey: ["growth", "codRejection", storeId],
    queryFn: () => getCodRejectionStats(storeId!, range),
    enabled: !!storeId,
  });
  const recentOrdersQuery = useQuery({
    queryKey: ["growth", "recentOrders", storeId],
    queryFn: () => listOrders(storeId!, { page: 1, limit: 1 }),
    enabled: !!storeId,
  });

  const stats = statsQuery.data;
  const conv = conversionQuery.data;
  const codRej = codRejectionQuery.data;
  const totalOrders = recentOrdersQuery.data?.total ?? 0;

  // Goal target — same localStorage key the Dashboard Goals card writes.
  const goalTarget = (() => {
    try { return Number(localStorage.getItem(`numu_goal_${storeId}`) || "50"); }
    catch { return 50; }
  })();
  const currentMonthOrders = stats?.total_orders ?? 0;
  const remaining = Math.max(0, goalTarget - currentMonthOrders);
  const progressPct = Math.min(100, Math.round((currentMonthOrders / Math.max(1, goalTarget)) * 100));
  const fmtN = (n: number) => (isRTL ? n.toLocaleString("ar-EG") : n.toLocaleString());
  const fmtCurrency = (cents: number) => {
    const v = cents / 100;
    return isRTL ? `${v.toLocaleString("ar-EG")} ج.م` : `EGP ${v.toLocaleString()}`;
  };

  // ─── Diagnosis: figure out what's actually limiting growth ─────
  const diagnosis = useMemo(() => {
    const findings: { Icon: typeof ChartLineUp; tone: string; label: string; detail: string }[] = [];

    // Low conversion?
    if (conv && conv.conversion_rate < 1.5 && conv.total_visitors > 50) {
      findings.push({
        Icon: ChartLineUp,
        tone: "ichip-terra",
        label: isRTL ? "نسبة التحويل منخفضة" : "Conversion rate is low",
        detail: isRTL
          ? `${conv.conversion_rate.toFixed(1)}٪ من الزوار بيشتروا — المعدل الصحي ٢-٣٪`
          : `${conv.conversion_rate.toFixed(1)}% of visitors buy — healthy is 2-3%`,
      });
    }

    // High cart abandonment?
    if (conv && conv.cart_abandonment_rate > 65) {
      findings.push({
        Icon: ArrowsLeftRight,
        tone: "ichip-saffron",
        label: isRTL ? "سلال متروكة كتير" : "High cart abandonment",
        detail: isRTL
          ? `${conv.cart_abandonment_rate.toFixed(0)}٪ من السلال بيتسابوا — جرّب رسائل تذكير`
          : `${conv.cart_abandonment_rate.toFixed(0)}% of carts are abandoned — try reminder messages`,
      });
    }

    // Low traffic?
    if (conv && conv.total_visitors < 100) {
      findings.push({
        Icon: ShareNetwork,
        tone: "ichip-navy",
        label: isRTL ? "زيارات قليلة" : "Low traffic",
        detail: isRTL
          ? `${conv.total_visitors} زائر بس — متجرك محتاج وصول أكتر`
          : `Only ${conv.total_visitors} visitors — your store needs more reach`,
      });
    }

    // COD rejection
    if (codRej && codRej.rejection_rate > 15) {
      findings.push({
        Icon: Truck,
        tone: "ichip-terra",
        label: isRTL ? "رفض استلام عالي" : "High COD rejection",
        detail: isRTL
          ? `${codRej.rejection_rate.toFixed(0)}٪ بيرفضوا الاستلام — راجع الشحن والتأكيد`
          : `${codRej.rejection_rate.toFixed(0)}% reject delivery — review shipping & confirmation`,
      });
    }

    // Low repeat?
    if (stats && stats.total_orders > 10) {
      // Simple repeat proxy: low new_customers fraction means low retention
      const newRatio = stats.new_customers / Math.max(1, stats.total_orders);
      if (newRatio > 0.85) {
        findings.push({
          Icon: Repeat,
          tone: "ichip-sage",
          label: isRTL ? "عملاء بيشتروا مرة واحدة بس" : "One-time buyers dominate",
          detail: isRTL
            ? "أغلب العملاء بيشتروا مرة واحدة — جرّب حملة استرجاع"
            : "Most customers buy once — try a win-back campaign",
        });
      }
    }

    // Empty state — no orders yet
    if (totalOrders === 0) {
      findings.push({
        Icon: Sparkle,
        tone: "ichip-saffron",
        label: isRTL ? "متجرك جاهز للانطلاق" : "Your store is ready to launch",
        detail: isRTL
          ? "محتاج أول بيعة — ابدأ بمشاركة الرابط ودعاية بسيطة"
          : "You need your first sale — start with sharing the link and a small ad",
      });
    }

    return findings;
  }, [stats, conv, codRej, totalOrders, isRTL]);

  // ─── Playbook — concrete tactics with deep links into the app ──
  // Priority-tagged based on the diagnosis above.
  const playbook: PlayCard[] = useMemo(() => {
    const cards: PlayCard[] = [
      {
        Icon: Tag,
        tone: "ichip-saffron",
        title: isRTL ? "أنشئ كوبون خصم" : "Create a discount code",
        desc: isRTL
          ? "خصم ١٠-١٥٪ على أول طلب بيرفع التحويل بنسبة كبيرة"
          : "10-15% off the first order is the highest-ROI lever for new shoppers",
        cta: isRTL ? "كوبون جديد" : "New code",
        href: "/marketing/promotions/new",
        badge: conv && conv.conversion_rate < 1.5
          ? { label: isRTL ? "موصى به" : "Recommended", tone: "saffron" }
          : undefined,
      },
      {
        Icon: ChatCircleText,
        tone: "ichip-sage",
        title: isRTL ? "ابعت حملة واتساب" : "Send a WhatsApp broadcast",
        desc: isRTL
          ? "في مصر، الواتساب بيوصل ٩٠٪+ من العملاء — أعلى بكتير من الإيميل"
          : "In Egypt, WhatsApp reaches 90%+ of customers — way higher than email",
        cta: isRTL ? "حملة جديدة" : "New broadcast",
        href: "/whatsapp/campaigns",
      },
      {
        Icon: ShareNetwork,
        tone: "ichip-navy",
        title: isRTL ? "اربط فيسبوك وإنستجرام" : "Connect Facebook & Instagram",
        desc: isRTL
          ? "بيع المنتجات مباشرة من البوستات — مصدر زيارات قوي للمتاجر الصغيرة"
          : "Sell products straight from posts — a strong traffic source for small stores",
        cta: isRTL ? "اربط القنوات" : "Connect channels",
        href: "/channels",
        badge: conv && conv.total_visitors < 100
          ? { label: isRTL ? "محتاج زيارات" : "Need traffic", tone: "navy" }
          : undefined,
      },
      {
        Icon: ImageIcon,
        tone: "ichip-terra",
        title: isRTL ? "حسّن صور المنتجات" : "Upgrade your product photos",
        desc: isRTL
          ? "خلفية بيضاء + ٣ زوايا على الأقل بترفع التحويل ٢٠-٣٠٪"
          : "White background + 3+ angles boosts conversion by 20-30%",
        cta: isRTL ? "افتح المنتجات" : "Open products",
        href: "/products",
        badge: conv && conv.conversion_rate < 1.5
          ? { label: isRTL ? "أولوية عالية" : "High priority", tone: "terra" }
          : undefined,
      },
      {
        Icon: Truck,
        tone: "ichip-sage",
        title: isRTL ? "اعرض شحن مجاني فوق حد معين" : "Offer free shipping above a threshold",
        desc: isRTL
          ? "شحن مجاني فوق ٥٠٠ ج.م بيرفع متوسط الطلب — اضبطه في مناطق الشحن"
          : "Free shipping above 500 EGP raises avg. order value — set it in zones",
        cta: isRTL ? "اضبط المناطق" : "Edit zones",
        href: "/shipping/zones",
      },
      {
        Icon: Repeat,
        tone: "ichip-navy",
        title: isRTL ? "حملة استرجاع عملاء" : "Win-back campaign",
        desc: isRTL
          ? "ابعت كوبون خاص للعملاء اللي مشتروش من ٦٠ يوم — الـROI الأعلى دايماً"
          : "Send a private code to customers who haven't bought in 60 days — the highest-ROI campaign always",
        cta: isRTL ? "ابدأ حملة" : "Launch campaign",
        href: "/campaigns",
      },
      {
        Icon: Megaphone,
        tone: "ichip-saffron",
        title: isRTL ? "أعلان مدفوع صغير" : "Run a small paid ad",
        desc: isRTL
          ? "٣٠٠-٥٠٠ ج.م على إنستجرام بيكفي عشان تختبر منتج جديد"
          : "300-500 EGP on Instagram is enough to test a new product",
        cta: isRTL ? "تابع التحليلات" : "View analytics",
        href: "/analytics/marketing",
      },
      {
        Icon: Storefront,
        tone: "ichip-terra",
        title: isRTL ? "خصّص واجهة متجرك" : "Customize your storefront",
        desc: isRTL
          ? "صفحة هبوط جذابة + ألوان متناسقة بترفع المصداقية والتحويل"
          : "A polished landing + consistent colors raise trust and conversion",
        cta: isRTL ? "خصّص الثيم" : "Customize theme",
        href: "/online-store",
      },
    ];
    return cards;
  }, [conv, isRTL]);

  // ─── Quick wins — 5-minute actions ─────────────────────────────
  const quickWins: { Icon: typeof Clock; title: string; href: string }[] = [
    {
      Icon: Sparkle,
      title: isRTL ? "ضيف وصف لكل منتج" : "Add a description to every product",
      href: "/products",
    },
    {
      Icon: ChatCircleText,
      title: isRTL ? "أكد رقم الدعم في إعدادات المتجر" : "Confirm your support number in settings",
      href: "/store",
    },
    {
      Icon: MapPin,
      title: isRTL ? "اضبط مناطق الشحن لكل المحافظات" : "Set shipping zones for all governorates",
      href: "/shipping/zones",
    },
    {
      Icon: Package,
      title: isRTL ? "اعمل فئات للمنتجات" : "Group products into categories",
      href: "/categories",
    },
    {
      Icon: Users,
      title: isRTL ? "صدّر قائمة عملاءك" : "Export your customer list for marketing",
      href: "/customers",
    },
  ];

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* ─── Hero ───────────────────────────────────────────────── */}
      <div className="souq-hero-navy p-6 sm:p-7">
        <div className="souq-eyebrow" style={{ color: "rgba(255,255,255,0.6)" }}>
          § {isRTL ? "نمّي متجرك" : "Grow your store"}
        </div>
        <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight leading-tight mt-3 text-white">
          {totalOrders === 0
            ? (isRTL ? "خلينا نجيب أول طلب" : "Let's get your first order")
            : (isRTL ? "ساعدني أوصلك لهدفك" : "Let's help you hit your goal")}
        </h1>
        <p className="text-white/70 text-[14px] mt-2 max-w-xl">
          {totalOrders === 0
            ? (isRTL
                ? "متجرك جاهز — كل اللي محتاجه شوية وصول وكوبون أول طلب"
                : "Your store is ready — all you need is some reach and a first-order discount")
            : (isRTL
                ? `محتاج ${fmtN(remaining)} طلب تاني الشهر ده عشان توصل هدفك`
                : `You need ${fmtN(remaining)} more order${remaining === 1 ? "" : "s"} this month to hit your goal`)}
        </p>

        {/* Progress strip */}
        {totalOrders > 0 && (
          <div className="mt-5 max-w-md">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-white/80">
                {isRTL ? "تقدمك الشهر ده" : "This month's progress"}
              </span>
              <span className="font-extrabold tabular-nums text-white">
                {fmtN(currentMonthOrders)} / {fmtN(goalTarget)}
                <span className="text-white/50 ms-1.5">({progressPct}%)</span>
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-white/12 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-saffron to-sage transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* CTA row */}
        <div className="mt-6 flex items-center gap-2 flex-wrap">
          <Button
            variant="accent"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate("/marketing/promotions/new")}
          >
            <Tag size={16} weight="bold" />
            {isRTL ? "ابدأ بكوبون خصم" : "Start with a discount"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
            onClick={() => navigate("/channels")}
          >
            <ShareNetwork size={16} weight="bold" />
            {isRTL ? "اربط قنوات" : "Connect channels"}
          </Button>
        </div>
      </div>

      {/* ─── Diagnosis — only renders when there's something to flag ── */}
      {diagnosis.length > 0 && (
        <section>
          <div className="souq-zhead">
            <span className="souq-eyebrow">§ {isRTL ? "ما لاحظناه" : "WHAT WE NOTICED"}</span>
            <span className="line" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {diagnosis.map((d, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`ichip ${d.tone} shrink-0`}>
                    <d.Icon size={20} weight="duotone" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-extrabold leading-tight">
                      {d.label}
                    </div>
                    <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
                      {d.detail}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ─── Playbook ──────────────────────────────────────────── */}
      <section>
        <div className="souq-zhead">
          <span className="souq-eyebrow">§ {isRTL ? "خطة النمو" : "GROWTH PLAYBOOK"}</span>
          <span className="q hidden md:inline">
            {isRTL ? "تكتيكات اتأكدنا منها مع تجار مصريين" : "Tactics proven with Egyptian merchants"}
          </span>
          <span className="line" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {playbook.map((p, i) => (
            <Card key={i} className="hover-lift">
              <CardContent className="p-5 flex flex-col gap-3 h-full">
                <div className="flex items-start justify-between">
                  <div className={`ichip ${p.tone}`}>
                    <p.Icon size={22} weight="duotone" />
                  </div>
                  {p.badge && (
                    <span
                      className={`souq-pill text-[11px] ${
                        p.badge.tone === "saffron" ? "bg-saffron-100 text-saffron-600"
                        : p.badge.tone === "terra" ? "bg-destructive/14 text-terracotta"
                        : p.badge.tone === "sage" ? "bg-emerald-500/14 text-emerald-700 dark:text-emerald-400"
                        : "bg-navy/10 text-navy"
                      }`}
                    >
                      {p.badge.label}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] font-extrabold leading-tight">{p.title}</h3>
                  <p className="text-[12.5px] text-muted-foreground mt-1.5 leading-relaxed">
                    {p.desc}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start gap-1.5 mt-1"
                  onClick={() => navigate(p.href)}
                >
                  {p.cta}
                  <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" strokeWidth={2.4} />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ─── Quick wins ─────────────────────────────────────────── */}
      <section>
        <div className="souq-zhead">
          <span className="souq-eyebrow">§ {isRTL ? "مكاسب سريعة" : "QUICK WINS"}</span>
          <span className="q hidden md:inline">
            {isRTL ? "كل واحدة منها أقل من ٥ دقايق" : "Each one takes under 5 minutes"}
          </span>
          <span className="line" />
        </div>
        <Card>
          <CardContent className="p-2">
            {quickWins.map((w, i) => (
              <button
                key={i}
                type="button"
                onClick={() => navigate(w.href)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl souq-hoverrow text-start border-b border-border/60 last:border-b-0"
              >
                <div className="ichip ichip-sage !w-9 !h-9">
                  <CheckCircle size={18} weight="duotone" />
                </div>
                <span className="flex-1 text-[13.5px] font-semibold">{w.title}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock size={14} weight="duotone" />
                  <span>{isRTL ? "<5 د" : "<5 min"}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" strokeWidth={2.2} />
              </button>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* ─── Stats snapshot at the bottom for context ──────────── */}
      {(stats || conv || codRej) && (
        <section>
          <div className="souq-zhead">
            <span className="souq-eyebrow">§ {isRTL ? "وضعك الحالي" : "YOUR NUMBERS"}</span>
            <span className="line" />
          </div>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {stats && (
              <Card><CardContent className="p-4">
                <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
                  {isRTL ? "إيراد الشهر" : "Month revenue"}
                </p>
                <p className="text-[20px] font-extrabold tabular-nums leading-none mt-1.5">
                  {fmtCurrency(stats.total_revenue)}
                </p>
              </CardContent></Card>
            )}
            {conv && (
              <Card><CardContent className="p-4">
                <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
                  {isRTL ? "تحويل" : "Conversion"}
                </p>
                <p className="text-[20px] font-extrabold tabular-nums leading-none mt-1.5">
                  {conv.conversion_rate.toFixed(1)}%
                </p>
              </CardContent></Card>
            )}
            {conv && (
              <Card><CardContent className="p-4">
                <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
                  {isRTL ? "زيارات" : "Visitors"}
                </p>
                <p className="text-[20px] font-extrabold tabular-nums leading-none mt-1.5">
                  {fmtN(conv.total_visitors)}
                </p>
              </CardContent></Card>
            )}
            {codRej && (
              <Card><CardContent className="p-4">
                <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
                  {isRTL ? "رفض استلام" : "COD rejection"}
                </p>
                <p className="text-[20px] font-extrabold tabular-nums leading-none mt-1.5">
                  {codRej.rejection_rate.toFixed(0)}%
                </p>
              </CardContent></Card>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default GrowthGuide;
