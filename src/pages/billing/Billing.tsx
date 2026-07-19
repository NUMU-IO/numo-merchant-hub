import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/services/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Receipt, Tag, AlertTriangle } from "lucide-react";

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

const PLAN_DISPLAY: Record<string, { name: string; nameAr: string; price: string }> = {
  trial: { name: "Trial", nameAr: "تجربة مجانية", price: "Free" },
  payg: { name: "Pay as you Grow", nameAr: "ادفع وأنت تنمو", price: "0 EGP/mo + %/order" },
  starter: { name: "Starter", nameAr: "ستارتر", price: "99 EGP/mo" },
  pro: { name: "Pro", nameAr: "برو", price: "299 EGP/mo" },
  enterprise: { name: "Enterprise", nameAr: "إنتربرايز", price: "Custom" },
};

const Billing = () => {
  const { tenant, isTrialMode, isReadOnly } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [discountCode, setDiscountCode] = useState("");
  const [discountMsg, setDiscountMsg] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    apiClient<Invoice[]>("/billing/invoices").then(setInvoices).catch(() => {});
  }, []);

  const plan = PLAN_DISPLAY[tenant?.plan || "trial"] || PLAN_DISPLAY.trial;

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{isAr ? "الفواتير والاشتراك" : "Billing"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr ? "إدارة اشتراكك وطرق الدفع" : "Manage your subscription and payment methods"}
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {isAr ? "الباقة الحالية" : "Current Plan"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">{isAr ? plan.nameAr : plan.name}</p>
              <p className="text-sm text-muted-foreground">{plan.price}</p>
              {tenant?.days_remaining != null && (isTrialMode || isReadOnly) && (
                <p className="text-sm text-amber-600 mt-1">
                  {isAr ? `باقي ${tenant.days_remaining} يوم` : `${tenant.days_remaining} days remaining`}
                </p>
              )}
            </div>
            <Badge variant={isReadOnly ? "destructive" : isTrialMode ? "secondary" : "default"}>
              {tenant?.lifecycle_state || "active"}
            </Badge>
          </div>

          {(isTrialMode || isReadOnly) && (
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">
                {isAr ? "اختار باقتك" : "Choose your plan"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  onClick={() => handleSubscribe("payg")}
                  disabled={subscribing}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-start"
                >
                  <span className="font-bold">{isAr ? "ادفع وأنت تنمو — 0 ج.م/شهر" : "Pay as you Grow — 0 EGP/mo"}</span>
                  <span className="text-xs text-muted-foreground">
                    {isAr ? "بدون اشتراك — عمولة على كل طلب مدفوع من محفظة مسبقة الشحن، بسعر مثبّت من يوم تفعيلك" : "No subscription — a per-paid-order commission from a prepaid wallet, locked at the rate you sign up with"}
                  </span>
                </Button>
                <Button
                  onClick={() => handleSubscribe("starter")}
                  disabled={subscribing}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-start"
                >
                  <span className="font-bold">Starter — 99 EGP/mo</span>
                  <span className="text-xs text-muted-foreground">100 products, custom domain, all themes</span>
                </Button>
                <Button
                  onClick={() => handleSubscribe("pro")}
                  disabled={subscribing}
                  className="h-auto py-4 flex flex-col items-start"
                >
                  <span className="font-bold">Pro — 299 EGP/mo</span>
                  <span className="text-xs text-muted-foreground">Unlimited products, analytics, automations</span>
                </Button>
              </div>
            </div>
          )}

          {tenant?.lifecycle_state === "active" && (
            <div className="border-t pt-4">
              <Button variant="ghost" size="sm" className="text-destructive" onClick={handleCancel}>
                {isAr ? "إلغاء الاشتراك" : "Cancel subscription"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discount Code */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            {isAr ? "كود خصم" : "Discount Code"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
              placeholder={isAr ? "ادخل الكود" : "Enter code"}
              dir="ltr"
              className="max-w-xs"
            />
            <Button variant="outline" onClick={handleValidateCode}>
              {isAr ? "تحقق" : "Validate"}
            </Button>
          </div>
          {discountMsg && <p className="text-sm mt-2 text-muted-foreground">{discountMsg}</p>}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {isAr ? "الفواتير" : "Invoices"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{isAr ? "مفيش فواتير لسه" : "No invoices yet"}</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{new Date(inv.period_start).toLocaleDateString()} — {new Date(inv.period_end).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground">{inv.currency} {(inv.amount_cents / 100).toFixed(2)}</p>
                  </div>
                  <Badge variant={inv.status === "paid" ? "default" : "secondary"}>{inv.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Billing;
