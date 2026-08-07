import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { apiClient } from "@/services/api";
import {
  getBillingPlans, listInstapayIntents, updateReminderSettings,
  type BillingPlansResponse, type InstapayIntent,
} from "@/services/billingApi";
import SubscribeInstapayDialog from "@/components/billing/SubscribeInstapayDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  CreditCard, Receipt, Tag, Wallet as WalletIcon, ArrowUpRight,
  CheckCircle2, Check, Sparkle, Clock, Hourglass, BellRing, History, Download, Building2,
} from "lucide-react";
import {
  printInvoice, downloadInvoicesCsv, invoiceNumber,
} from "@/lib/subscriptionInvoice";

const NUMU_PRIMARY = "hsl(222.2, 47.4%, 11.2%)";

interface Invoice {
  id: string;
  period_start: string;
  period_end: string;
  amount_cents: number;
  currency: string;
  status: string;
  discount_amount_cents: number;
  paid_at: string | null;
  created_at: string;
}

interface WalletSummary {
  balance_cents: number;
  effective_commission_bps: number;
}

const PLAN_DISPLAY: Record<string, { name: string; nameAr: string }> = {
  trial: { name: "Trial", nameAr: "تجربة مجانية" },
  demo: { name: "Trial", nameAr: "تجربة مجانية" },
  free: { name: "Free", nameAr: "مجانية" },
  // Legacy/manual tier — without this entry a beta tenant fell through
  // to the `trial` default and the hero claimed "Trial · Free".
  beta: { name: "Beta", nameAr: "بيتا" },
  payg: { name: "Pay as you Grow", nameAr: "ادفع وأنت تنمو" },
  starter: { name: "Starter", nameAr: "ستارتر" },
  pro: { name: "Pro", nameAr: "برو" },
  enterprise: { name: "Enterprise", nameAr: "إنتربرايز" },
};

// Per-plan feature lists, mirroring the landing page's pricing cards so a
// merchant who compared tiers before signing up meets the same claims here.
//
// Hardcoded rather than fetched: /billing/plans returns pricing only, and three
// short lists are not worth an API change. They MUST stay in step with
// PLAN_LIMITS in the API — edit both together, or this page starts promising
// ceilings the backend will not honour.
const PLAN_FEATURES: Record<string, { en: string; ar: string }[]> = {
  payg: [
    { en: "No monthly fee — you pay only when you sell", ar: "بدون اشتراك شهري — بتدفع لما تبيع بس" },
    { en: "100 products, custom domain, all themes", ar: "١٠٠ منتج، دومين مخصص، كل الثيمات" },
    { en: "Rate locked at the day you activate", ar: "السعر مثبّت من يوم تفعيلك" },
    { en: "Prepaid wallet — top up as you go", ar: "محفظة مسبقة الشحن — اشحن وقت ما تحب" },
  ],
  starter: [
    { en: "100 products", ar: "١٠٠ منتج" },
    { en: "Custom domain + all themes", ar: "دومين مخصص + كل الثيمات" },
    { en: "3 staff members", ar: "٣ أعضاء فريق" },
    { en: "Discount codes + webhooks", ar: "أكواد خصم + ويبهوكس" },
    { en: "0% commission — keep every pound", ar: "٠٪ عمولة — الإيراد كله ليك" },
  ],
  pro: [
    { en: "Unlimited products and customers", ar: "منتجات وعملاء بلا حدود" },
    { en: "Up to 3 stores on one account", ar: "لحد ٣ متاجر على نفس الحساب" },
    { en: "10 staff members", ar: "١٠ أعضاء فريق" },
    { en: "Advanced analytics + automations", ar: "تحليلات متقدمة + أتمتة" },
    { en: "Full API access", ar: "وصول كامل للـ API" },
  ],
};

// Self-serve paid tiers — the only plans payable via InstaPay.
const PAID_SELF_SERVE = ["starter", "pro"];

const OPEN_INTENT_STATUSES = new Set(["awaiting_proof", "under_review"]);

// Enterprise is sold, not self-served. Prefilled subject + body so the reply
// lands in the right queue with the store already identified — an empty
// mailto puts the burden of explaining themselves on the merchant.
const ENTERPRISE_MAILTO =
  "mailto:sales@numueg.app" +
  "?subject=" + encodeURIComponent("Enterprise plan enquiry") +
  "&body=" +
    encodeURIComponent(
      [
        "Hi numu team,",
        "",
        "I would like to talk about an Enterprise plan.",
        "",
        "Store: ",
        "Monthly orders: ",
        "What we need: ",
      ].join("\n"),
    );


const Billing = () => {
  const { tenant, isTrialMode, isReadOnly, refreshUser } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [plansData, setPlansData] = useState<BillingPlansResponse | null>(null);
  const [intents, setIntents] = useState<InstapayIntent[]>([]);
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [discountCode, setDiscountCode] = useState("");
  const [discountMsg, setDiscountMsg] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const [payDialog, setPayDialog] = useState<{ plan: string } | null>(null);
  const [reminderDays, setReminderDays] = useState<string>("");
  const [reminderEmails, setReminderEmails] = useState(true);
  const [reminderLoaded, setReminderLoaded] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);

  const planKey = tenant?.plan || "trial";
  const isPayg = planKey === "payg";
  const isActivePaid = PAID_SELF_SERVE.includes(planKey) && !isTrialMode && !isReadOnly;
  // Anyone NOT already on a self-serve paid plan can subscribe: trial,
  // demo, free, beta (legacy manual tier), payg. Enterprise is excluded —
  // it's a bespoke contract and self-serve cards would be a downgrade
  // trap. Gating this on isTrialMode||isReadOnly (the old rule) left
  // beta/free/payg merchants with a Billing page that offered nothing.
  const canSubscribe = !PAID_SELF_SERVE.includes(planKey) && planKey !== "enterprise";

  const refresh = useCallback(() => {
    apiClient<Invoice[]>("/billing/invoices").then(setInvoices).catch(() => {});
    getBillingPlans().then(setPlansData).catch(() => {});
    listInstapayIntents().then(setIntents).catch(() => {});
    // The current plan is read from the auth context, which is only populated
    // at app mount and on tab focus — everything else on this page is fetched
    // fresh. Without this the two disagree, and an InstaPay activation makes
    // that visible: approval lands server-side minutes after the merchant
    // pays, with no client event, so the page would show a PAID invoice for
    // Pro sitting directly above a "Current plan: Beta" hero. The tenant row
    // was already correct; only this screen was stale.
    refreshUser().catch(() => {});
  }, [refreshUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Seed the reminder form once from the API (don't clobber edits on refetch).
  useEffect(() => {
    const r = plansData?.current?.reminder;
    if (r && !reminderLoaded) {
      setReminderDays(r.days != null ? String(r.days) : "");
      setReminderEmails(r.emails_enabled);
      setReminderLoaded(true);
    }
  }, [plansData, reminderLoaded]);

  useEffect(() => {
    if (!isPayg) return;
    apiClient<WalletSummary>("/wallet").then(setWallet).catch(() => {});
  }, [isPayg]);

  const plan = PLAN_DISPLAY[planKey] || PLAN_DISPLAY.trial;
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString(isAr ? "ar-EG" : "en-US", { minimumFractionDigits: 2 });
  const fmtEgp = (cents: number) =>
    `${(cents / 100).toLocaleString(isAr ? "ar-EG" : "en-US")} ${isAr ? "ج.م" : "EGP"}`;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(isAr ? "ar-EG" : "en-US", {
      day: "numeric", month: "short", year: "numeric",
    });
  const commissionPct = wallet
    ? (wallet.effective_commission_bps / 100).toLocaleString(isAr ? "ar-EG" : "en-US")
    : null;

  const catalog = plansData?.plans ?? [];
  const planPrice = (key: string, c: "monthly" | "annual" = cycle): number | null => {
    const entry = catalog.find((p) => p.plan === key);
    if (!entry) return null;
    return c === "annual" ? entry.annual_price_cents : entry.monthly_price_cents;
  };
  const instapayOn = plansData?.instapay_available ?? false;
  const planIntent = plansData?.plan_intent;
  const currentCycle = (plansData?.current?.billing_cycle === "annual" ? "annual" : "monthly") as
    | "monthly"
    | "annual";
  const renewalDue = Boolean(
    plansData?.current?.renewal_due && ["starter", "pro"].includes(planKey),
  );

  const openIntent = intents.find((i) => OPEN_INTENT_STATUSES.has(i.status));

  const priceLine = isPayg
    ? commissionPct !== null
      ? (isAr ? `${commissionPct}٪ لكل طلب مدفوع — بدون اشتراك شهري` : `${commissionPct}% per paid order — no monthly fee`)
      : (isAr ? "عمولة على كل طلب مدفوع — بدون اشتراك شهري" : "Commission per paid order — no monthly fee")
    : ["starter", "pro"].includes(planKey)
      ? (() => {
          const cents = planPrice(planKey, currentCycle);
          if (cents == null) return "…";
          const per = currentCycle === "annual" ? (isAr ? "سنة" : "year") : (isAr ? "شهر" : "month");
          return `${fmtEgp(cents)} / ${per}`;
        })()
      : (isAr ? "مجاناً" : "Free");

  const handleSubscribe = async (selectedPlan: string) => {
    setSubscribing(true);
    try {
      await apiClient("/billing/subscribe", {
        method: "POST",
        body: JSON.stringify({
          plan: selectedPlan,
          billing_cycle: "monthly",
          discount_code: discountCode || null,
        }),
      });
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed";
      setDiscountMsg(msg);
      setSubscribing(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm(isAr ? "متأكد إنك عايز تلغي الاشتراك؟" : "Are you sure you want to cancel?")) return;
    try {
      await apiClient("/billing/cancel", { method: "POST" });
      window.location.reload();
    } catch {
      // handled
    }
  };

  const handleValidateCode = async () => {
    if (!discountCode) return;
    try {
      const result = await apiClient<{ valid: boolean; description: string | null; message: string }>(
        "/billing/discount-code/validate",
        { method: "POST", body: JSON.stringify({ code: discountCode, plan: "starter" }) }
      );
      setDiscountMsg(result.message);
    } catch {
      setDiscountMsg(isAr ? "كود غير صالح" : "Invalid code");
    }
  };

  const openPaidPlanDialog = (selectedPlan: string) => {
    setPayDialog({ plan: selectedPlan });
  };

  const onPaymentDone = (activated: boolean) => {
    if (activated) {
      // Plan changed server-side — full reload refreshes AuthContext too.
      setTimeout(() => window.location.reload(), 1600);
    } else {
      refresh();
    }
  };

  // Which plan the payment dialog is for: an explicit pick, or the open
  // intent being resumed, or (renewal) the current plan.
  const dialogPlan = payDialog?.plan ?? openIntent?.plan ?? planKey;
  const dialogCycle = (payDialog
    ? cycle
    : openIntent
      ? (openIntent.billing_cycle === "annual" ? "annual" : "monthly")
      : currentCycle) as "monthly" | "annual";

  const cycleToggle = (
    <div className="inline-flex rounded-lg border p-0.5 text-xs font-semibold">
      <button
        onClick={() => setCycle("monthly")}
        className={`px-3 py-1.5 rounded-md transition-colors ${cycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
      >
        {isAr ? "شهري" : "Monthly"}
      </button>
      <button
        onClick={() => setCycle("annual")}
        className={`px-3 py-1.5 rounded-md transition-colors ${cycle === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
      >
        {isAr ? "سنوي (شهرين مجاناً)" : "Annual (2 months free)"}
      </button>
    </div>
  );

  return (
    <div className="max-w-[1000px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
          {isAr ? "الفواتير والاشتراك" : "Billing"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr ? "إدارة اشتراكك وطرق الدفع" : "Manage your subscription and payment methods"}
        </p>
      </div>

      {/* ── Pending InstaPay payment strip ────────────────────────────── */}
      {openIntent && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            {openIntent.status === "under_review"
              ? <Hourglass className="h-5 w-5 text-amber-600 shrink-0" />
              : <Clock className="h-5 w-5 text-amber-600 shrink-0" />}
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {openIntent.status === "under_review"
                  ? (isAr ? "إيصال الدفع قيد التحقق" : "Payment receipt under review")
                  : (isAr ? "عملية دفع بانتظار الإيصال" : "Payment awaiting your receipt")}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {(PLAN_DISPLAY[openIntent.plan] ? (isAr ? PLAN_DISPLAY[openIntent.plan].nameAr : PLAN_DISPLAY[openIntent.plan].name) : openIntent.plan)}
                {" · "}{fmtEgp(openIntent.amount_cents)}
                {" · "}<span className="font-mono">{openIntent.reference_code}</span>
                {openIntent.rejection_reason && (
                  <span className="text-red-600"> · {openIntent.rejection_reason}</span>
                )}
              </p>
            </div>
          </div>
          {openIntent.status === "awaiting_proof" && (
            <Button size="sm" onClick={setPayDialogFromIntent}>
              {isAr ? "إكمال الدفع" : "Resume payment"}
            </Button>
          )}
        </div>
      )}

      {/* ── Current plan hero ─────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden text-white" style={{ background: NUMU_PRIMARY }}>
        <div className="relative">
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage: "url('/numu-n-mark-transparent.png')",
              backgroundSize: "80px",
              backgroundRepeat: "repeat",
            }}
          />
          <div className="relative z-10 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                    <CreditCard className="h-4.5 w-4.5 text-white/80" />
                  </div>
                  <p className="text-sm text-white/60">{isAr ? "الباقة الحالية" : "Current plan"}</p>
                </div>
                <p className="text-3xl font-bold tracking-tight">{isAr ? plan.nameAr : plan.name}</p>
                <p className="text-sm text-white/70 mt-1.5">{priceLine}</p>
                {tenant?.days_remaining != null && (isTrialMode || isReadOnly) && (
                  <p className="text-sm text-amber-300 mt-2">
                    {isAr ? `باقي ${tenant.days_remaining} يوم على انتهاء التجربة` : `${tenant.days_remaining} days left in your trial`}
                  </p>
                )}
                {plansData?.current?.next_renewal_at && !isTrialMode && !isReadOnly && (
                  <p className="text-sm text-white/60 mt-2">
                    {isAr ? "التجديد القادم: " : "Next renewal: "}
                    {fmtDate(plansData.current.next_renewal_at)}
                  </p>
                )}
              </div>
              <Badge
                className={`border-transparent ${
                  isReadOnly
                    ? "bg-red-400/20 text-red-200"
                    : isTrialMode
                      ? "bg-amber-400/20 text-amber-200"
                      : "bg-emerald-400/20 text-emerald-200"
                }`}
              >
                {tenant?.lifecycle_state || "active"}
              </Badge>
            </div>

            {/* Renewal due: pay now via InstaPay */}
            {renewalDue && instapayOn && !openIntent && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-400/10 border border-amber-300/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-amber-300" />
                  <div>
                    <p className="text-sm font-semibold text-amber-200">
                      {isAr ? "موعد تجديد اشتراكك اقترب" : "Your renewal is due"}
                    </p>
                    <p className="text-xs text-white/60">
                      {isAr
                        ? "جدد الآن عبر إنستاباي قبل انتهاء الفترة الحالية"
                        : "Renew now via InstaPay before the current period ends"}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setPayDialog({ plan: planKey })}>
                  {isAr ? "ادفع الآن" : "Pay now"}
                </Button>
              </div>
            )}

            {/* payg: wallet strip */}
            {isPayg && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/[0.07] border border-white/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <WalletIcon className="h-5 w-5 text-white/70" />
                  <div>
                    <p className="text-xs text-white/50">{isAr ? "رصيد المحفظة" : "Wallet balance"}</p>
                    <p className="font-bold tabular-nums">
                      {wallet ? `${fmt(wallet.balance_cents)} ${isAr ? "ج.م" : "EGP"}` : "…"}
                    </p>
                  </div>
                </div>
                <Button asChild size="sm" variant="secondary" className="gap-1.5">
                  <Link to="/wallet">
                    {isAr ? "إدارة المحفظة" : "Manage wallet"}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Change plan (active paid merchants) ───────────────────────── */}
      {isActivePaid && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">{isAr ? "غيّر باقتك" : "Change plan"}</CardTitle>
            {cycleToggle}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["starter", "pro"] as const).map((key) => {
                const cents = planPrice(key);
                const per = cycle === "annual" ? (isAr ? "سنة" : "yr") : (isAr ? "شهر" : "mo");
                const isCurrent = planKey === key && currentCycle === cycle;
                return (
                  <div
                    key={key}
                    className={`relative rounded-xl border p-4 ${
                      isCurrent ? "border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20" : ""
                    }`}
                  >
                    {isCurrent && (
                      <span className="absolute top-3 end-3 text-[10px] font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                        {isAr ? "باقتك الحالية" : "Current plan"}
                      </span>
                    )}
                    <p className="font-bold">{key === "starter" ? "Starter" : "Pro"}</p>
                    <p className="text-lg font-extrabold mt-0.5 tabular-nums">
                      {cents != null ? `${fmtEgp(cents)}/${per}` : "…"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {key === "starter"
                        ? (isAr ? "١٠٠ منتج، دومين مخصص، كل الثيمات" : "100 products, custom domain, all themes")
                        : (isAr ? "منتجات بلا حدود، تحليلات، أتمتة" : "Unlimited products, analytics, automations")}
                    </p>
                    {!isCurrent && (
                      <Button
                        size="sm"
                        className="mt-3"
                        disabled={!instapayOn || Boolean(openIntent)}
                        onClick={() => openPaidPlanDialog(key)}
                      >
                        {planKey === key
                          ? (isAr ? "التبديل لهذه الدورة" : "Switch to this cycle")
                          : key === "pro"
                            ? (isAr ? "ترقية إلى Pro" : "Upgrade to Pro")
                            : (isAr ? "التبديل إلى Starter" : "Switch to Starter")}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              {isAr
                ? "الدفع عبر إنستاباي — الباقة الجديدة تتفعّل فور تأكيد التحويل، وتُحسب فترتها من نهاية فترتك الحالية."
                : "Paid via InstaPay — the new plan activates once the transfer is verified, and its period starts where your current one ends."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Plan picker (anyone not already on a self-serve paid plan) ── */}
      {canSubscribe && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">{isAr ? "اختار باقتك" : "Choose your plan"}</CardTitle>
            {cycleToggle}
          </CardHeader>
          <CardContent>
            {/* Structure ported from the landing page's pricing section: one
                card per tier, a highlighted recommendation, and a checked
                feature list so the tiers are comparable at a glance rather
                than by reading three different one-line summaries.

                Styling stays in the merchant-hub language (near-white ground,
                Inter, Stripe-ish borders) — the design system keeps the two
                surfaces apart deliberately. What IS shared is the brand
                palette: sage/saffron/navy are defined as hub Tailwind tokens
                for exactly this, so the checks and the highlight read as numu
                without importing the storefront's cream-and-Reem-Kufi world. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
              <button
                onClick={() => handleSubscribe("payg")}
                disabled={subscribing || isPayg}
                className="group flex flex-col text-start rounded-xl border p-5 transition-colors hover:border-navy/40 disabled:opacity-60"
              >
                <div className="flex items-center gap-1.5 text-navy text-[11px] font-bold uppercase tracking-wide mb-3">
                  <Sparkle className="h-3.5 w-3.5" />
                  {isPayg
                    ? (isAr ? "باقتك الحالية" : "Current plan")
                    : (isAr ? "الأنسب للبداية" : "Best to start")}
                </div>
                <p className="font-bold text-base">{isAr ? "ادفع وأنت تنمو" : "Pay as you Grow"}</p>
                <p className="text-2xl font-extrabold mt-1 tabular-nums">
                  {isAr ? "٠ ج.م" : "0 EGP"}
                  <span className="text-sm font-medium text-muted-foreground">
                    {isAr ? " /شهر" : " /mo"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {commissionPct !== null
                    ? (isAr ? `${commissionPct}٪ على كل طلب مدفوع` : `${commissionPct}% per paid order`)
                    : (isAr ? "عمولة على كل طلب مدفوع" : "Commission per paid order")}
                </p>
                <ul className="mt-4 space-y-2 flex-1">
                  {PLAN_FEATURES.payg.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                      <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-sage" />
                      <span>{isAr ? f.ar : f.en}</span>
                    </li>
                  ))}
                </ul>
              </button>
              {(["starter", "pro"] as const).map((key) => {
                const cents = planPrice(key);
                const per = cycle === "annual" ? (isAr ? "سنة" : "yr") : (isAr ? "شهر" : "mo");
                const intended = planIntent === key;
                // Pro carries the recommendation, as on the landing page —
                // unless the merchant already picked a tier at signup, in
                // which case echoing their own choice back beats overriding
                // it with ours.
                const featured = planIntent ? intended : key === "pro";
                const monthly = planPrice(key, "monthly");
                const annual = planPrice(key, "annual");
                // Months saved by paying yearly, shown only when it is real.
                const saved =
                  monthly && annual && monthly > 0
                    ? Math.round(12 - annual / monthly)
                    : 0;
                return (
                  <button
                    key={key}
                    onClick={() => openPaidPlanDialog(key)}
                    disabled={subscribing || !instapayOn || Boolean(openIntent)}
                    className={`relative flex flex-col text-start rounded-xl border p-5 transition-colors disabled:opacity-60 ${
                      featured
                        ? "border-saffron ring-1 ring-saffron/40 bg-saffron/[0.04]"
                        : "hover:border-foreground/30"
                    }`}
                  >
                    {featured && (
                      <span className="absolute -top-2.5 start-5 rounded-full bg-saffron px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy-900">
                        {intended
                          ? (isAr ? "اخترتها عند التسجيل" : "Your signup pick")
                          : (isAr ? "الأكثر اختياراً" : "Most popular")}
                      </span>
                    )}
                    <p className="font-bold text-base">{key === "starter" ? "Starter" : "Pro"}</p>
                    <p className="text-2xl font-extrabold mt-1 tabular-nums">
                      {cents != null ? fmtEgp(cents) : "…"}
                      <span className="text-sm font-medium text-muted-foreground">{` /${per}`}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">
                      {cycle === "annual" && saved > 0
                        ? (isAr ? `وفّر ${saved} شهور` : `${saved} months free`)
                        : instapayOn
                          ? (isAr ? "الدفع عبر إنستاباي" : "Pay via InstaPay")
                          : ""}
                    </p>
                    <ul className="mt-4 space-y-2 flex-1">
                      {PLAN_FEATURES[key].map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                          <Check
                            className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                              featured ? "text-saffron" : "text-sage"
                            }`}
                          />
                          <span>{isAr ? f.ar : f.en}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            {/* Enterprise — a contract, not a checkout.
                Deliberately outside the plan grid and styled as a row rather
                than a fourth priced card: putting "Contact us" where a price
                belongs makes the other three read as incomplete, and a merchant
                scanning for a number finds a dead end. */}
            <a
              href={ENTERPRISE_MAILTO}
              className="mt-3 flex items-center gap-4 rounded-xl border border-dashed p-4 transition-colors hover:border-foreground/30 hover:bg-muted/40"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  Enterprise
                  <span className="ms-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {isAr ? "بالاتفاق" : "Custom"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {isAr
                    ? "حجم أوردرات كبير، أكتر من متجر، تكاملات خاصة، أو اتفاق SLA — نظبّطها معاك."
                    : "High order volume, multiple stores, custom integrations or an SLA — we'll shape it with you."}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
                {isAr ? "كلّمنا" : "Contact us"}
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </a>

            {!instapayOn && (
              <p className="text-xs text-muted-foreground mt-3">
                {isAr
                  ? "الدفع للباقات المدفوعة غير متاح حالياً — تواصل مع الدعم."
                  : "Payments for paid plans aren't available yet — contact support."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Renewal reminder + payment history ────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {["starter", "pro"].includes(planKey) && (
          <Card className="lg:col-span-2 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BellRing className="h-4 w-4" />
                {isAr ? "تذكير التجديد" : "Renewal reminder"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center justify-between gap-3 text-sm font-medium">
                {isAr ? "ذكّرني قبل التجديد بالإيميل" : "Email me before my renewal"}
                <Switch checked={reminderEmails} onCheckedChange={setReminderEmails} />
              </label>
              {reminderEmails && (
                <div className="space-y-1">
                  <p className="text-sm">{isAr ? "قبل التجديد بكام يوم؟" : "How many days before?"}</p>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    className="w-28 tabular-nums"
                    placeholder={String(plansData?.current?.reminder?.platform_default_days ?? 7)}
                    value={reminderDays}
                    onChange={(e) => setReminderDays(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {isAr
                      ? `اتركه فارغاً للإعداد الافتراضي (${plansData?.current?.reminder?.platform_default_days ?? 7} أيام)`
                      : `Leave empty for the default (${plansData?.current?.reminder?.platform_default_days ?? 7} days)`}
                  </p>
                </div>
              )}
              <Button
                size="sm"
                disabled={savingReminder}
                onClick={async () => {
                  setSavingReminder(true);
                  try {
                    const days = reminderDays.trim() === "" ? null : Math.min(30, Math.max(1, Number(reminderDays)));
                    await updateReminderSettings(days, reminderEmails);
                    toast.success(isAr ? "تم حفظ إعدادات التذكير" : "Reminder settings saved");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : (isAr ? "تعذر الحفظ" : "Could not save"));
                  } finally {
                    setSavingReminder(false);
                  }
                }}
              >
                {isAr ? "حفظ" : "Save"}
              </Button>
            </CardContent>
          </Card>
        )}

        {intents.length > 0 && (
          <Card className={["starter", "pro"].includes(planKey) ? "lg:col-span-3" : "lg:col-span-5"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                {isAr ? "مدفوعات الاشتراك" : "Subscription payments"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {intents.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {(PLAN_DISPLAY[it.plan] ? (isAr ? PLAN_DISPLAY[it.plan].nameAr : PLAN_DISPLAY[it.plan].name) : it.plan)}
                        {" · "}
                        {it.billing_cycle === "annual" ? (isAr ? "سنوي" : "Annual") : (isAr ? "شهري" : "Monthly")}
                        {it.purpose === "renewal" && (
                          <span className="text-muted-foreground"> · {isAr ? "تجديد" : "Renewal"}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {fmtEgp(it.amount_cents)} · <span className="font-mono">{it.reference_code}</span>
                        {it.created_at && <> · {fmtDate(it.created_at)}</>}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        it.status === "succeeded"
                          ? "border-emerald-300 text-emerald-700 gap-1"
                          : it.status === "under_review"
                            ? "border-amber-300 text-amber-700"
                            : it.status === "awaiting_proof"
                              ? "border-blue-300 text-blue-700"
                              : "text-muted-foreground"
                      }
                    >
                      {it.status === "succeeded" && <CheckCircle2 className="h-3 w-3" />}
                      {it.status === "succeeded"
                        ? (isAr ? "مكتمل" : "Paid")
                        : it.status === "under_review"
                          ? (isAr ? "قيد التحقق" : "Under review")
                          : it.status === "awaiting_proof"
                            ? (isAr ? "بانتظار الإيصال" : "Awaiting receipt")
                            : it.status === "expired"
                              ? (isAr ? "منتهي" : "Expired")
                              : (isAr ? "فشل" : "Failed")}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Discount + invoices ───────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4" />
              {isAr ? "كود خصم" : "Discount code"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                placeholder={isAr ? "ادخل الكود" : "Enter code"}
                dir="ltr"
              />
              <Button variant="outline" onClick={handleValidateCode}>
                {isAr ? "تحقق" : "Validate"}
              </Button>
            </div>
            {discountMsg && <p className="text-sm mt-2 text-muted-foreground">{discountMsg}</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0 gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4" />
              {isAr ? "الفواتير" : "Invoices"}
              {invoices.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  ({invoices.length})
                </span>
              )}
            </CardTitle>
            {invoices.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 shrink-0"
                onClick={() =>
                  downloadInvoicesCsv(
                    invoices,
                    `numu-invoices-${tenant?.subdomain || "store"}.csv`,
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                {isAr ? "تصدير CSV" : "Export CSV"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="py-8 text-center">
                <Receipt className="h-10 w-10 mx-auto text-muted-foreground/25 mb-2" />
                <p className="text-sm font-medium">{isAr ? "مفيش فواتير لسه" : "No invoices yet"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isPayg
                    ? (isAr ? "باقة ادفع وأنت تنمو بدون فواتير شهرية — العمولات تُخصم من محفظتك" : "Pay as you Grow has no monthly invoices — commissions come from your wallet")
                    : (isAr ? "هتظهر فواتيرك هنا مع أول دورة اشتراك" : "Your invoices will appear here with your first billing cycle")}
                </p>
              </div>
            ) : (
              <div className="-mx-2">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="group flex items-center gap-3 px-2 py-3 rounded-lg border-b last:border-0 transition-colors hover:bg-muted/40"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        inv.status === "paid"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {inv.status === "paid" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {fmtDate(inv.period_start)} — {fmtDate(inv.period_end)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums" dir="ltr">
                        {invoiceNumber(inv)}
                        {inv.discount_amount_cents > 0 && (
                          <span className="text-emerald-600">
                            {" · "}
                            {isAr ? "خصم" : "discount"} −{fmt(inv.discount_amount_cents)}
                          </span>
                        )}
                      </p>
                    </div>

                    <p className="text-sm font-semibold tabular-nums shrink-0" dir="ltr">
                      {fmt(inv.amount_cents)} {inv.currency}
                    </p>

                    {/* Always rendered, not hover-revealed: a download you cannot
                        see on touch is a download that does not exist. */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                      title={isAr ? "تحميل الفاتورة" : "Download invoice"}
                      aria-label={`${isAr ? "تحميل الفاتورة" : "Download invoice"} ${invoiceNumber(inv)}`}
                      onClick={() => {
                        const ok = printInvoice(
                          inv,
                          {
                            name: tenant?.name || "—",
                            subdomain: tenant?.subdomain,
                            plan: PLAN_DISPLAY[planKey]?.name,
                          },
                          isAr,
                        );
                        if (!ok) {
                          // sonner, not shadcn's useToast — different signature.
                          toast.error(
                            isAr ? "المتصفح منع النافذة" : "Popup blocked",
                            {
                              description: isAr
                                ? "اسمح بالنوافذ المنبثقة لهذا الموقع عشان تحمّل الفاتورة."
                                : "Allow popups for this site to download the invoice.",
                            },
                          );
                        }
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cancel — deliberately quiet, at the very bottom */}
      {tenant?.lifecycle_state === "active" && !isTrialMode && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="text-destructive/80 hover:text-destructive" onClick={handleCancel}>
            {isAr ? "إلغاء الاشتراك" : "Cancel subscription"}
          </Button>
        </div>
      )}

      <SubscribeInstapayDialog
        open={Boolean(payDialog)}
        onOpenChange={(o) => { if (!o) setPayDialog(null); }}
        plan={dialogPlan}
        billingCycle={dialogCycle}
        amountCents={planPrice(dialogPlan, dialogCycle)}
        resumeIntent={openIntent && openIntent.status === "awaiting_proof" ? openIntent : null}
        onDone={onPaymentDone}
      />
    </div>
  );

  // Resume the open intent: opening the dialog with payDialog set to the
  // intent's own plan keeps the header/labels consistent.
  function setPayDialogFromIntent() {
    if (openIntent) setPayDialog({ plan: openIntent.plan });
  }
};

export default Billing;
