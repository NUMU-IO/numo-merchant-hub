/**
 * COD deposit-to-confirm policy card.
 *
 * Rendered under the COD toggle on PaymentSetup. Lets the merchant
 * require a fixed deposit paid via one of the gateways they pick,
 * before a COD order is created. Reduces "ghost" COD orders that
 * customers never open the door for — a common Egyptian e-commerce
 * pain point.
 *
 * MVP: fixed amount only. Percentage / "cover shipping" variants
 * come later as alternate policy shapes.
 *
 * Merchant controls surfaced here:
 *   • Enable / disable
 *   • Fixed deposit amount (EGP)
 *   • Payment window TTL (minutes — after which the order auto-cancels)
 *   • Auto-refund on cancel (vs. manual refund through the gateway console)
 *   • Allowed gateways (from the set of currently-configured online gateways)
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { showError } from "@/lib/show-error";
import {
  DEPOSIT_GATEWAY_VALUES,
  fetchPaymentSettings,
  updatePaymentSettings,
  type CodDepositPolicy,
  type DepositGateway,
  type PaymentSettings,
} from "@/services/storeApi";

interface Props {
  storeId: string;
  isAr: boolean;
  /** True when the COD toggle itself is off — disables this card. */
  codEnabled: boolean;
}

const DEFAULT_AMOUNT_EGP = 50;
const DEFAULT_TTL_MINUTES = 30;

const GATEWAY_LABELS: Record<DepositGateway, { en: string; ar: string }> = {
  paymob: { en: "Paymob", ar: "بايموب" },
  kashier: { en: "Kashier", ar: "كاشير" },
  fawry: { en: "Fawry", ar: "فوري" },
  fawaterak: { en: "Fawaterak", ar: "فواتيرك" },
  instapay: { en: "InstaPay", ar: "انستاباي" },
};

function emptyPolicy(): CodDepositPolicy {
  return {
    enabled: false,
    amount_cents: DEFAULT_AMOUNT_EGP * 100,
    ttl_minutes: DEFAULT_TTL_MINUTES,
    auto_refund_on_cancel: false,
    allowed_gateways: [],
  };
}

export default function CodDepositPolicyCard({ storeId, isAr, codEnabled }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [policy, setPolicy] = useState<CodDepositPolicy>(emptyPolicy);
  const [amountDraft, setAmountDraft] = useState<string>(
    String(DEFAULT_AMOUNT_EGP),
  );
  const [ttlDraft, setTtlDraft] = useState<string>(String(DEFAULT_TTL_MINUTES));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPaymentSettings(storeId)
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
        setPolicy(s.cod_deposit_policy);
        setAmountDraft(String(s.cod_deposit_policy.amount_cents / 100));
        setTtlDraft(String(s.cod_deposit_policy.ttl_minutes));
      })
      .catch(() => {
        // Fresh store / no settings saved yet — keep defaults.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  // Gateways the store currently has ready to accept a deposit. We
  // drive the checkbox list from this set rather than hard-coding —
  // merchants shouldn't be offered gateways they haven't configured.
  const availableGateways = useMemo<DepositGateway[]>(() => {
    if (!settings) return [];
    return DEPOSIT_GATEWAY_VALUES.filter((g) => {
      const status = settings[g];
      return Boolean(status?.enabled && status?.is_configured);
    });
  }, [settings]);

  const persist = async (next: CodDepositPolicy) => {
    const previous = policy;
    setPolicy(next);
    setSaving(true);
    try {
      const result = await updatePaymentSettings(storeId, {
        cod_deposit_policy: next,
      });
      setSettings(result);
      setPolicy(result.cod_deposit_policy);
      toast.success(
        isAr ? "تم حفظ سياسة التأمين" : "Deposit policy saved",
      );
    } catch (err) {
      setPolicy(previous);
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (next: boolean) => {
    if (next) {
      // Pre-flight checks so the merchant sees the real blocker
      // immediately, not after the server rejects.
      if (availableGateways.length === 0) {
        toast.error(
          isAr
            ? "فعّل بوابة دفع واحدة على الأقل قبل تفعيل التأمين."
            : "Enable at least one online gateway before requiring a deposit.",
        );
        return;
      }
      const amount = Math.max(0, Math.round(Number(amountDraft || 0) * 100));
      const amount_cents = amount > 0 ? amount : DEFAULT_AMOUNT_EGP * 100;
      // Default to ALL available gateways on first enable — merchants
      // can uncheck from there. Empty allow-list with enabled=true is
      // rejected server-side.
      const allowed_gateways =
        policy.allowed_gateways.length > 0
          ? policy.allowed_gateways
          : [...availableGateways];
      await persist({
        enabled: true,
        amount_cents,
        ttl_minutes: policy.ttl_minutes || DEFAULT_TTL_MINUTES,
        auto_refund_on_cancel: policy.auto_refund_on_cancel,
        allowed_gateways,
      });
      setAmountDraft(String(amount_cents / 100));
    } else {
      // Disabling — no validation needed. Keep other fields so re-enable
      // restores the merchant's last config.
      await persist({ ...policy, enabled: false });
    }
  };

  const handleAmountCommit = async () => {
    const parsed = Number(amountDraft);
    const amount_cents = Number.isFinite(parsed) && parsed >= 0
      ? Math.round(parsed * 100)
      : 0;
    if (amount_cents === policy.amount_cents) return;
    if (policy.enabled && amount_cents <= 0) {
      toast.error(
        isAr ? "حدد مبلغ التأمين" : "Set a deposit amount greater than 0",
      );
      setAmountDraft(String(policy.amount_cents / 100));
      return;
    }
    await persist({ ...policy, amount_cents });
  };

  const handleTtlCommit = async () => {
    const parsed = parseInt(ttlDraft, 10);
    const ttl_minutes = Number.isFinite(parsed) ? parsed : DEFAULT_TTL_MINUTES;
    if (ttl_minutes === policy.ttl_minutes) return;
    if (ttl_minutes < 5 || ttl_minutes > 1440) {
      toast.error(
        isAr
          ? "نافذة الدفع بين 5 دقائق و 24 ساعة"
          : "Payment window must be between 5 minutes and 24 hours",
      );
      setTtlDraft(String(policy.ttl_minutes));
      return;
    }
    await persist({ ...policy, ttl_minutes });
  };

  const handleAutoRefundToggle = async (next: boolean) => {
    await persist({ ...policy, auto_refund_on_cancel: next });
  };

  const handleGatewayToggle = async (gateway: DepositGateway, checked: boolean) => {
    const set = new Set(policy.allowed_gateways);
    if (checked) set.add(gateway);
    else set.delete(gateway);
    const allowed_gateways = DEPOSIT_GATEWAY_VALUES.filter((g) => set.has(g));
    if (policy.enabled && allowed_gateways.length === 0) {
      toast.error(
        isAr
          ? "اختر بوابة واحدة على الأقل للدفع."
          : "Select at least one gateway.",
      );
      return;
    }
    await persist({ ...policy, allowed_gateways });
  };

  const disabled = !codEnabled || saving;
  const hasNoAvailableGateway =
    !loading && codEnabled && availableGateways.length === 0;

  return (
    <div
      className={
        "rounded-xl border bg-background p-5 " +
        (!codEnabled ? "opacity-60" : "")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">
                {isAr
                  ? "تأمين تأكيد الطلب"
                  : "Require deposit to confirm COD"}
              </span>
              {policy.enabled && codEnabled ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  {isAr ? "مفعّل" : "ACTIVE"}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
              {isAr
                ? "قبل تأكيد طلب الدفع عند الاستلام، يدفع العميل مبلغاً بسيطاً عبر الإنترنت والباقي عند الاستلام. يقلل الطلبات الوهمية."
                : "Before confirming a COD order, customers pay a small deposit online; the rest is collected on delivery. Cuts down on ghost orders."}
            </p>
          </div>
        </div>
        <Switch
          checked={policy.enabled}
          onCheckedChange={handleToggle}
          disabled={disabled || hasNoAvailableGateway}
        />
      </div>

      {hasNoAvailableGateway ? (
        <p className="text-xs text-destructive mt-3 ms-[52px]">
          {isAr
            ? "قم بتفعيل بوابة دفع واحدة على الأقل (بايموب / كاشير / فوري / فواتيرك / إنستاباي) قبل تفعيل التأمين."
            : "Enable at least one online gateway (Paymob / Kashier / Fawry / Fawaterak / InstaPay) before turning this on."}
        </p>
      ) : null}

      {policy.enabled && codEnabled ? (
        <div className="mt-4 border-t pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">
                {isAr ? "مبلغ التأمين (ج.م)" : "Deposit amount (EGP)"}
              </Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={amountDraft}
                onChange={(e) => setAmountDraft(e.target.value)}
                onBlur={handleAmountCommit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                disabled={disabled}
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {isAr
                  ? "اجعله قريبًا من سعر الشحن (40-80 ج.م)."
                  : "Keep it near your delivery fee (40–80 EGP)."}
              </p>
            </div>
            <div>
              <Label className="text-xs">
                {isAr ? "نافذة الدفع (بالدقائق)" : "Payment window (minutes)"}
              </Label>
              <Input
                type="number"
                min={5}
                max={1440}
                step={1}
                value={ttlDraft}
                onChange={(e) => setTtlDraft(e.target.value)}
                onBlur={handleTtlCommit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                disabled={disabled}
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {isAr
                  ? "بعد انقضاء النافذة، يُلغى الطلب تلقائيًا."
                  : "After this, the order auto-cancels."}
              </p>
            </div>
          </div>

          <div>
            <Label className="text-xs mb-2 block">
              {isAr ? "بوابات الدفع المسموح بها" : "Allowed deposit gateways"}
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DEPOSIT_GATEWAY_VALUES.map((g) => {
                const status = settings?.[g];
                const isReady = Boolean(status?.enabled && status?.is_configured);
                const checked = policy.allowed_gateways.includes(g);
                return (
                  <label
                    key={g}
                    className={
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer " +
                      (!isReady
                        ? "opacity-40 cursor-not-allowed"
                        : checked
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/40")
                    }
                    title={
                      !isReady
                        ? (isAr
                            ? "هذه البوابة غير مُعدّة في إعدادات الدفع"
                            : "Not configured in Payment Setup")
                        : undefined
                    }
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled || !isReady}
                      onCheckedChange={(v) =>
                        handleGatewayToggle(g, Boolean(v))
                      }
                    />
                    <span className="font-medium">
                      {isAr ? GATEWAY_LABELS[g].ar : GATEWAY_LABELS[g].en}
                    </span>
                    {!isReady ? (
                      <span className="text-[9px] text-muted-foreground ms-auto">
                        {isAr ? "غير مُعدّ" : "not ready"}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 border-t pt-4">
            <div>
              <p className="text-sm font-semibold">
                {isAr
                  ? "استرداد التأمين تلقائيًا عند الإلغاء"
                  : "Auto-refund deposit on cancel"}
              </p>
              <p className="text-[11px] text-muted-foreground max-w-md mt-0.5">
                {isAr
                  ? "عند إلغاء الطلب بعد دفع التأمين، يُسترد المبلغ تلقائيًا عبر نفس البوابة. عند الإيقاف، يُعالج الاسترداد يدويًا من لوحة البوابة."
                  : "When you cancel an order with a paid deposit, the amount is auto-refunded via the original gateway. When off, refunds are handled manually in the gateway console."}
              </p>
            </div>
            <Switch
              checked={policy.auto_refund_on_cancel}
              onCheckedChange={handleAutoRefundToggle}
              disabled={disabled}
            />
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-[11px] text-muted-foreground mt-3">
          <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
          {isAr ? "جارٍ التحميل…" : "Loading…"}
        </p>
      ) : null}
    </div>
  );
}
