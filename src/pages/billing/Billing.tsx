import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, Receipt, Tag, Wallet as WalletIcon, ArrowUpRight,
  CheckCircle2, Sparkle,
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

const Billing = () => {
  const { tenant, isTrialMode, isReadOnly } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [discountMsg, setDiscountMsg] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  const planKey = tenant?.plan || "trial";
  const isPayg = planKey === "payg";

  useEffect(() => {
    apiClient<Invoice[]>("/billing/invoices").then(setInvoices).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isPayg) return;
    apiClient<WalletSummary>("/wallet").then(setWallet).catch(() => {});
  }, [isPayg]);

  const plan = PLAN_DISPLAY[planKey] || PLAN_DISPLAY.trial;
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString(isAr ? "ar-EG" : "en-US", { minimumFractionDigits: 2 });
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(isAr ? "ar-EG" : "en-US", {
      day: "numeric", month: "short", year: "numeric",
    });
  const commissionPct = wallet
    ? (wallet.effective_commission_bps / 100).toLocaleString(isAr ? "ar-EG" : "en-US")
    : null;

  const priceLine = isPayg
    ? commissionPct !== null
      ? (isAr ? `${commissionPct}٪ لكل طلب مدفوع — بدون اشتراك شهري` : `${commissionPct}% per paid order — no monthly fee`)
      : (isAr ? "عمولة على كل طلب مدفوع — بدون اشتراك شهري" : "Commission per paid order — no monthly fee")
    : planKey === "starter"
      ? (isAr ? "٩٩ ج.م / شهر" : "99 EGP / month")
      : planKey === "pro"
        ? (isAr ? "٢٩٩ ج.م / شهر" : "299 EGP / month")
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
          <CardHeader>
            <CardTitle className="text-base">{isAr ? "اختار باقتك" : "Choose your plan"}</CardTitle>
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
              <button
                onClick={() => handleSubscribe("starter")}
                disabled={subscribing}
                className="text-start rounded-xl border p-4 hover:border-foreground/30 transition-colors disabled:opacity-60"
              >
                <p className="font-bold mt-6">Starter</p>
                <p className="text-lg font-extrabold mt-0.5">{isAr ? "٩٩ ج.م/شهر" : "99 EGP/mo"}</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {isAr ? "١٠٠ منتج، دومين مخصص، كل الثيمات" : "100 products, custom domain, all themes"}
                </p>
              </button>
              <button
                onClick={() => handleSubscribe("pro")}
                disabled={subscribing}
                className="text-start rounded-xl border p-4 hover:border-foreground/30 transition-colors disabled:opacity-60"
              >
                <p className="font-bold mt-6">Pro</p>
                <p className="text-lg font-extrabold mt-0.5">{isAr ? "٢٩٩ ج.م/شهر" : "299 EGP/mo"}</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {isAr ? "منتجات بلا حدود، تحليلات، أتمتة" : "Unlimited products, analytics, automations"}
                </p>
              </button>
            </div>
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
    </div>
  );
};

export default Billing;
