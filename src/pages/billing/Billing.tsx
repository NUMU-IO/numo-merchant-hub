import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/services/api";
import {
  getBillingPlans, listInstapayIntents,
  type BillingPlansResponse, type InstapayIntent,
} from "@/services/billingApi";
import SubscribeInstapayDialog from "@/components/billing/SubscribeInstapayDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, Receipt, Tag, Wallet as WalletIcon, ArrowUpRight,
  CheckCircle2, Sparkle, Clock, Hourglass,
} from "lucide-react";

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
  payg: { name: "Pay as you Grow", nameAr: "ادفع وأنت تنمو" },
  starter: { name: "Starter", nameAr: "ستارتر" },
  pro: { name: "Pro", nameAr: "برو" },
  enterprise: { name: "Enterprise", nameAr: "إنتربرايز" },
};

const OPEN_INTENT_STATUSES = new Set(["awaiting_proof", "under_review"]);

const Billing = () => {
  const { tenant, isTrialMode, isReadOnly } = useAuth();
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

  const planKey = tenant?.plan || "trial";
  const isPayg = planKey === "payg";

  const refresh = useCallback(() => {
    apiClient<Invoice[]>("/billing/invoices").then(setInvoices).catch(() => {});
    getBillingPlans().then(setPlansData).catch(() => {});
    listInstapayIntents().then(setIntents).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

      {/* ── Plan picker (trial / read-only) ───────────────────────────── */}
      {(isTrialMode || isReadOnly) && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">{isAr ? "اختار باقتك" : "Choose your plan"}</CardTitle>
            {cycleToggle}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => handleSubscribe("payg")}
                disabled={subscribing}
                className="group text-start rounded-xl border-2 border-primary/60 p-4 hover:border-primary transition-colors disabled:opacity-60"
              >
                <div className="flex items-center gap-1.5 text-primary text-xs font-semibold mb-2">
                  <Sparkle className="h-3.5 w-3.5" />
                  {isAr ? "الأنسب للبداية" : "Best to start"}
                </div>
                <p className="font-bold">{isAr ? "ادفع وأنت تنمو" : "Pay as you Grow"}</p>
                <p className="text-lg font-extrabold mt-0.5">{isAr ? "٠ ج.م/شهر" : "0 EGP/mo"}</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {isAr
                    ? "بدون اشتراك — عمولة على كل طلب مدفوع من محفظة مسبقة الشحن، بسعر مثبّت من يوم تفعيلك"
                    : "No subscription — a per-paid-order commission from a prepaid wallet, locked at the rate you sign up with"}
                </p>
              </button>
              {(["starter", "pro"] as const).map((key) => {
                const cents = planPrice(key);
                const per = cycle === "annual" ? (isAr ? "سنة" : "yr") : (isAr ? "شهر" : "mo");
                const intended = planIntent === key;
                return (
                  <button
                    key={key}
                    onClick={() => openPaidPlanDialog(key)}
                    disabled={subscribing || !instapayOn || Boolean(openIntent)}
                    className={`relative text-start rounded-xl border p-4 transition-colors disabled:opacity-60 ${
                      intended ? "border-primary ring-1 ring-primary/40" : "hover:border-foreground/30"
                    }`}
                  >
                    {intended && (
                      <span className="absolute top-3 end-3 text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                        {isAr ? "اخترتها عند التسجيل" : "Your signup pick"}
                      </span>
                    )}
                    <p className="font-bold mt-6">{key === "starter" ? "Starter" : "Pro"}</p>
                    <p className="text-lg font-extrabold mt-0.5 tabular-nums">
                      {cents != null ? `${fmtEgp(cents)}/${per}` : "…"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {key === "starter"
                        ? (isAr ? "١٠٠ منتج، دومين مخصص، كل الثيمات" : "100 products, custom domain, all themes")
                        : (isAr ? "منتجات بلا حدود، تحليلات، أتمتة" : "Unlimited products, analytics, automations")}
                    </p>
                    {instapayOn && (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        {isAr ? "الدفع عبر إنستاباي" : "Pay via InstaPay"}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4" />
              {isAr ? "الفواتير" : "Invoices"}
            </CardTitle>
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
              <div className="space-y-1">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {fmtDate(inv.period_start)} — {fmtDate(inv.period_end)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {fmt(inv.amount_cents)} {inv.currency}
                        {inv.discount_amount_cents > 0 && (
                          <span className="text-emerald-600"> · {isAr ? "خصم" : "discount"} −{fmt(inv.discount_amount_cents)}</span>
                        )}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        inv.status === "paid"
                          ? "border-emerald-300 text-emerald-700 gap-1"
                          : "text-muted-foreground"
                      }
                    >
                      {inv.status === "paid" && <CheckCircle2 className="h-3 w-3" />}
                      {inv.status}
                    </Badge>
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
