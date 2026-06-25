import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tag, Megaphone, UsersRound, Ticket, Plus, Send,
  Sparkles, ArrowRight, Loader2,
} from "lucide-react";
import { listCoupons } from "@/services/couponApi";
import { listCampaigns } from "@/services/campaignApi";

/* Souq Marketing landing — single overview that aggregates:
   • 4 KPI tiles (Active discounts / Campaigns / Reach / Redeemed)
   • Segmented control: Overview / Discounts / Campaigns / WhatsApp
     - Overview (this view): mini-cards previewing each section
     - Discounts → /marketing/promotions (unified discounts list)
     - Campaigns → /campaigns
     - WhatsApp → /whatsapp
   Replaces the bare "/marketing redirects to coupons" path with a real
   landing that orients the merchant before they pick a workflow. */

/* WhatsApp brand mark — matches the OrderDrawer chip glyph. */
const WhatsAppGlyph = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 32 32"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M16.001 4C9.373 4 4 9.373 4 16c0 2.116.555 4.105 1.523 5.825L4 28l6.343-1.487A11.94 11.94 0 0 0 16.001 28C22.628 28 28 22.627 28 16S22.628 4 16.001 4Zm0 21.818c-1.85 0-3.585-.5-5.078-1.37l-.363-.214-3.766.884.91-3.664-.236-.376A9.79 9.79 0 0 1 6.185 16c0-5.412 4.404-9.816 9.816-9.816 5.413 0 9.815 4.404 9.815 9.816 0 5.412-4.402 9.818-9.815 9.818Zm5.387-7.354c-.295-.148-1.745-.86-2.015-.957-.27-.099-.467-.148-.664.148-.196.295-.762.957-.934 1.153-.172.197-.344.222-.638.074-.295-.148-1.245-.459-2.372-1.464-.876-.781-1.467-1.747-1.639-2.042-.172-.296-.018-.456.13-.604.133-.132.295-.345.443-.517.148-.172.197-.295.295-.492.099-.197.05-.369-.025-.517-.074-.148-.664-1.604-.91-2.196-.24-.577-.484-.499-.664-.508l-.566-.01a1.09 1.09 0 0 0-.787.369c-.27.296-1.032 1.008-1.032 2.461 0 1.453 1.057 2.857 1.204 3.054.148.197 2.081 3.18 5.045 4.456.706.305 1.256.487 1.685.624.708.225 1.351.193 1.86.117.567-.085 1.745-.713 1.991-1.402.246-.69.246-1.281.172-1.402-.074-.123-.27-.197-.566-.345Z" />
  </svg>
);

type Tab = "overview" | "discounts" | "campaigns" | "whatsapp";

const MarketingLanding = () => {
  const { isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const storeId = currentStore?.id;
  const tab = (params.get("tab") as Tab) || "overview";
  const setTab = (t: Tab) => {
    if (t === "overview") {
      // Land back on the bare landing
      params.delete("tab");
      setParams(params);
      return;
    }
    if (t === "discounts") return navigate("/marketing/promotions");
    if (t === "campaigns") return navigate("/campaigns");
    if (t === "whatsapp") return navigate("/whatsapp");
  };

  // Real data so the KPIs/preview lists aren't empty placeholders.
  const couponsQuery = useQuery({
    queryKey: ["coupons", storeId, "marketing-landing"],
    queryFn: () => listCoupons(storeId!),
    enabled: !!storeId,
  });
  const campaignsQuery = useQuery({
    queryKey: ["campaigns", storeId, "marketing-landing"],
    queryFn: () => listCampaigns(storeId!),
    enabled: !!storeId,
  });

  const coupons = couponsQuery.data?.items ?? [];
  const campaigns = campaignsQuery.data ?? [];

  const activeDiscounts = coupons.filter((c) => c.is_active).length;
  const totalRedeemed = coupons.reduce((sum, c) => sum + (c.usage_count ?? 0), 0);
  const totalReach = campaigns.reduce(
    (sum, c) => sum + (c.total_recipients ?? 0),
    0,
  );

  const fmtN = (n: number) => (isRTL ? n.toLocaleString("ar-EG") : n.toLocaleString());

  const segItems: { key: Tab; label: string; labelAr: string }[] = [
    { key: "overview", label: "Overview", labelAr: "نظرة عامة" },
    { key: "discounts", label: "Discounts", labelAr: "الخصومات" },
    { key: "campaigns", label: "Campaigns", labelAr: "الحملات" },
    { key: "whatsapp", label: "WhatsApp", labelAr: "واتساب" },
  ];

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* ─── Page head ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
            {isRTL ? "التسويق" : "Marketing"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL ? "زوّد مبيعاتك بالخصومات والحملات" : "Grow sales with discounts and campaigns"}
          </p>
        </div>
        <Button
          variant="accent"
          size="sm"
          className="gap-1.5"
          onClick={() => navigate("/marketing/promotions/new")}
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          {isRTL ? "خصم جديد" : "New discount"}
        </Button>
      </div>

      {/* ─── 4 KPI tiles — icons sit as a small top-right accent
          (no chip background) so they read as labels, not as the
          generic-SaaS tinted-square pattern. */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {([
          { label: isRTL ? "خصومات شغّالة" : "Active discounts", value: activeDiscounts, Icon: Tag, color: "text-navy" },
          { label: isRTL ? "الحملات" : "Campaigns", value: campaigns.length, Icon: Megaphone, color: "text-saffron" },
          { label: isRTL ? "الوصول" : "Reach", value: totalReach, Icon: UsersRound, color: "text-sage" },
          { label: isRTL ? "اتستخدم" : "Redeemed", value: totalRedeemed, Icon: Ticket, color: "text-terracotta" },
        ] as const).map((tile) => (
          <Card key={tile.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[12.5px] font-semibold text-muted-foreground">
                  {tile.label}
                </p>
                <tile.Icon
                  className={`h-5 w-5 ${tile.color}`}
                  strokeWidth={1.8}
                />
              </div>
              <p className="text-[26px] font-extrabold tabular-nums leading-none">
                {fmtN(tile.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── Segmented control ─────────────────────────────────── */}
      <div className="flex items-center bg-muted/50 rounded-full p-1 w-fit overflow-x-auto">
        {segItems.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setTab(s.key)}
            className={`h-9 px-4 text-[13px] font-bold rounded-full transition-all shrink-0 ${
              tab === s.key
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isRTL ? s.labelAr : s.label}
          </button>
        ))}
      </div>

      {/* ─── Overview content — preview cards into each workflow ──
          Three previews stack:
          1) Discounts (top 4 coupons table)
          2) Campaigns (two campaign cards)
          3) WhatsApp broadcast card */}
      <div className="grid gap-4 lg:[grid-template-columns:1.4fr_1fr]">
        {/* Discounts preview */}
        <Card>
          <div className="souq-section-head px-5 pt-5 pb-2">
            <h2 className="text-[17px] font-bold tracking-tight">
              {isRTL ? "الخصومات" : "Discounts"}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 rounded-lg gap-1"
              onClick={() => navigate("/marketing/promotions")}
            >
              {isRTL ? "شوف الكل" : "View all"}
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" strokeWidth={2.2} />
            </Button>
          </div>
          <CardContent>
            {couponsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : coupons.length === 0 ? (
              <div className="text-center py-10">
                <Tag
                  className="h-10 w-10 mx-auto mb-3 text-saffron"
                  strokeWidth={1.6}
                />
                <p className="text-sm font-bold">{isRTL ? "مفيش كوبونات لسه" : "No discount codes yet"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isRTL ? "أنشئ أول كوبون عشان تجذب العملاء" : "Create your first code to attract shoppers"}
                </p>
                <Button
                  variant="accent"
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => navigate("/marketing/promotions/new")}
                >
                  <Plus className="h-4 w-4" strokeWidth={2.4} />
                  {isRTL ? "كوبون جديد" : "New code"}
                </Button>
              </div>
            ) : (
              <div className="space-y-0.5">
                {coupons.slice(0, 5).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate("/marketing/promotions")}
                    className="w-full flex items-center gap-3 px-2 py-3 rounded-lg souq-hoverrow text-start"
                  >
                    <span className="font-mono text-[13px] font-extrabold text-navy">{c.code}</span>
                    <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate">
                      {c.coupon_type === "percentage"
                        ? `${c.value}% ${isRTL ? "خصم" : "off"}`
                        : c.coupon_type === "free_shipping"
                          ? (isRTL ? "شحن مجاني" : "Free shipping")
                          : c.coupon_type === "buy_x_get_y"
                            ? (isRTL ? "BOGO" : "BOGO")
                            : c.coupon_type === "tiered"
                              ? (isRTL ? "متدرّج" : "Tiered")
                              : `${c.value} ${isRTL ? "ج.م خصم" : "EGP off"}`}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                      {fmtN(c.usage_count ?? 0)} {isRTL ? "مرة" : "used"}
                    </span>
                    <span
                      className={`souq-pill ${
                        c.is_active
                          ? "bg-emerald-500/14 text-emerald-700 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <span className="dot" />
                      {c.is_active
                        ? (isRTL ? "شغّال" : "Active")
                        : (isRTL ? "موقّف" : "Inactive")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* WhatsApp broadcast card */}
        <Card>
          <CardContent className="p-5 flex flex-col gap-3 h-full">
            <div className="flex items-center gap-4">
              <WhatsAppGlyph className="h-9 w-9 text-[#1F7A35] dark:text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-extrabold leading-tight">
                  {isRTL ? "رسالة واتساب جماعية" : "WhatsApp broadcast"}
                </div>
                <div className="text-[12px] text-muted-foreground mt-0.5">
                  {isRTL ? "ابعت رسالة لكل عملاءك مرة واحدة" : "Reach all your customers at once"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-5 mt-1 text-[12.5px] tabular-nums">
              <div>
                <span className="text-muted-foreground">{isRTL ? "اتبعت" : "Sent"}: </span>
                <span className="font-extrabold">—</span>
              </div>
              <div>
                <span className="text-muted-foreground">{isRTL ? "اتفتحت" : "Opened"}: </span>
                <span className="font-extrabold text-sage">—</span>
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              className="gap-1.5 mt-auto"
              onClick={() => navigate("/whatsapp/campaigns")}
            >
              <Send className="h-4 w-4" strokeWidth={2.2} />
              {isRTL ? "ابعت حملة" : "New broadcast"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns preview */}
      <Card>
        <div className="souq-section-head px-5 pt-5 pb-2">
          <h2 className="text-[17px] font-bold tracking-tight">
            {isRTL ? "الحملات" : "Campaigns"}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 rounded-lg gap-1"
            onClick={() => navigate("/campaigns")}
          >
            {isRTL ? "شوف الكل" : "View all"}
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" strokeWidth={2.2} />
          </Button>
        </div>
        <CardContent>
          {campaignsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-10">
              <Megaphone
                className="h-10 w-10 mx-auto mb-3 text-saffron"
                strokeWidth={1.6}
              />
              <p className="text-sm font-bold">{isRTL ? "مفيش حملات لسه" : "No campaigns yet"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? "اعمل حملة تتبع الإسناد لكل قناة" : "Launch a campaign to track attribution per channel"}
              </p>
              <Button
                variant="accent"
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => navigate("/campaigns")}
              >
                <Plus className="h-4 w-4" strokeWidth={2.4} />
                {isRTL ? "حملة جديدة" : "New campaign"}
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {campaigns.slice(0, 4).map((c, i) => {
                const accent = ["text-navy", "text-saffron", "text-sage", "text-terracotta"][i % 4];
                const Icon = i % 2 === 0 ? Megaphone : Sparkles;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/campaigns/${c.id}`)}
                    className="rounded-xl border border-border bg-card p-4 hover-lift text-start flex flex-col gap-3"
                  >
                    <div className="flex items-center gap-4">
                      <Icon className={`h-8 w-8 ${accent} shrink-0`} strokeWidth={1.8} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-extrabold truncate">{c.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{c.channel || "—"}</div>
                      </div>
                      <span
                        className={`souq-pill ${
                          c.status === "active"
                            ? "bg-emerald-500/14 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <span className="dot" />
                        {c.status === "active"
                          ? (isRTL ? "شغّالة" : "Live")
                          : (isRTL ? "موقّفة" : "Paused")}
                      </span>
                    </div>
                    <div className="flex gap-5 text-[12.5px] tabular-nums">
                      <div>
                        <div className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">{isRTL ? "اتبعت" : "Sent"}</div>
                        <div className="text-[15px] font-extrabold mt-0.5">
                          {fmtN(c.sent_count ?? 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">{isRTL ? "اتسلمت" : "Delivered"}</div>
                        <div className="text-[15px] font-extrabold mt-0.5">
                          {fmtN(c.delivered_count ?? 0)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingLanding;
