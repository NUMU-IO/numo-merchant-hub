/**
 * Vodafone Cash setup card for the PaymentSetup page.
 *
 * Same shape as the InstaPay card and for the same reason: there is no
 * API integration. The merchant hands us a wallet number, the customer
 * transfers to it out-of-band, and a screenshot is verified. Vodafone
 * does sell a merchant API, but it requires a commercial partnership
 * and an aggregator — not something a single store can obtain, and not
 * what this rail is.
 *
 * Two deliberate differences from the InstaPay card:
 *   - No QR section. A Vodafone Cash transfer starts by dialling *9#
 *     or in the Ana Vodafone app; there is nothing to scan, so we
 *     don't offer a QR the customer couldn't use.
 *   - A wider default amount tolerance, because Vodafone charges the
 *     sender a fee and the amount that lands is short of the total.
 *
 * The auto-approval + OCR controls come from ManualRailAutoApproval,
 * shared with the InstaPay card so the two can't drift.
 */

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/services/api";
import {
  deleteVodafoneCashCredentials,
  fetchVodafoneCashCredentials,
  saveVodafoneCashCredentials,
  type VodafoneCashCredentialsResponse,
} from "@/services/storeApi";
import { showError } from "@/lib/show-error";
import {
  ManualRailAutoApproval,
  type ManualRailAutoApprovalValues,
} from "@/components/payments/ManualRailAutoApproval";

interface Props {
  storeId: string;
  isAr: boolean;
}

const DEFAULT_THRESHOLD_CENTS = 50_000; // 500 EGP
const DEFAULT_DAILY_CAP_CENTS = 500_000; // 5,000 EGP
const DEFAULT_DAILY_COUNT = 10;
// 300 bps, not InstaPay's 100. Vodafone charges the sender a transfer
// fee, so what lands on the merchant's wallet is routinely a few pounds
// under the order total; a 1% window would send nearly every order to
// manual review. Keep in sync with DEFAULT_VC_AMOUNT_TOLERANCE_BPS.
const DEFAULT_TOLERANCE_PCT = 3;

export default function VodafoneCashSetupCard({ storeId, isAr }: Props) {
  const [creds, setCreds] = useState<VodafoneCashCredentialsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [walletNumber, setWalletNumber] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fallbackPhone, setFallbackPhone] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [togglingEnabled, setTogglingEnabled] = useState(false);

  const [rules, setRules] = useState<ManualRailAutoApprovalValues>({
    thresholdEgp: DEFAULT_THRESHOLD_CENTS / 100,
    dailyCapEgp: DEFAULT_DAILY_CAP_CENTS / 100,
    dailyCount: DEFAULT_DAILY_COUNT,
    requireOcrAmount: false,
    requireOcrDestination: false,
    ocrAmountTolerancePct: DEFAULT_TOLERANCE_PCT,
    requireNoteContainsRef: false,
    requireTxnRefMatch: false,
    requireRecipientNameMatch: false,
    recipientNameToken: "",
  });

  const setRule = <K extends keyof ManualRailAutoApprovalValues>(
    key: K,
    value: ManualRailAutoApprovalValues[K],
  ) => setRules((prev) => ({ ...prev, [key]: value }));

  // Persist the "Offer at checkout" toggle independently of Save,
  // mirroring the other gateway toggles. The backend refuses to enable
  // the rail until a wallet number is stored.
  const handleToggleEnabled = async (next: boolean) => {
    setTogglingEnabled(true);
    const previous = enabled;
    setEnabled(next); // optimistic — revert on failure
    try {
      await apiClient(`/stores/${storeId}/settings/payment`, {
        method: "PATCH",
        body: JSON.stringify({ vodafone_cash_enabled: next }),
      });
      toast.success(
        next
          ? isAr
            ? "تم تفعيل فودافون كاش في الدفع"
            : "Vodafone Cash is now live at checkout"
          : isAr
            ? "تم إيقاف عرض فودافون كاش"
            : "Vodafone Cash hidden from checkout",
      );
    } catch (err) {
      setEnabled(previous);
      showError(err);
    } finally {
      setTogglingEnabled(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchVodafoneCashCredentials(storeId)
      .then((c) => {
        if (cancelled) return;
        setCreds(c);
        setEnabled(!!c.enabled);
        setDisplayName(c.display_name || "");
        setFallbackPhone(c.fallback_phone || "");
        setRules({
          thresholdEgp:
            (c.auto_approve_threshold_cents ?? DEFAULT_THRESHOLD_CENTS) / 100,
          dailyCapEgp:
            (c.auto_approve_daily_cap_cents ?? DEFAULT_DAILY_CAP_CENTS) / 100,
          dailyCount: c.auto_approve_daily_count ?? DEFAULT_DAILY_COUNT,
          requireOcrAmount: !!c.require_ocr_amount_match,
          requireOcrDestination: !!c.require_ocr_ipa_match,
          // Backend stores basis points (100 bps = 1%); render percent.
          ocrAmountTolerancePct:
            (c.ocr_amount_tolerance_bps ?? DEFAULT_TOLERANCE_PCT * 100) / 100,
          requireNoteContainsRef: !!c.require_note_contains_reference,
          requireTxnRefMatch: !!c.require_transaction_ref_match,
          requireRecipientNameMatch: !!c.require_recipient_name_match,
          recipientNameToken: c.recipient_name_token || "",
        });
      })
      .catch(() =>
        setCreds({ is_configured: false } as VodafoneCashCredentialsResponse),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const handleSave = async () => {
    if (!walletNumber.trim() && !creds?.is_configured) {
      toast.error(
        isAr
          ? "الرجاء إدخال رقم محفظة فودافون كاش"
          : "Please enter your Vodafone Cash wallet number",
      );
      return;
    }
    setSaving(true);
    try {
      // On update, send null so the backend keeps the encrypted value —
      // the form only ever shows it masked, and posting the mask back
      // would corrupt the stored number.
      const trimmed = walletNumber.trim();
      const saved = await saveVodafoneCashCredentials(storeId, {
        wallet_number: trimmed ? trimmed : null,
        display_name: displayName.trim() || null,
        fallback_phone: fallbackPhone.trim() || null,
        auto_approve_threshold_cents: Math.round(rules.thresholdEgp * 100),
        auto_approve_daily_cap_cents: Math.round(rules.dailyCapEgp * 100),
        auto_approve_daily_count: Math.max(0, Math.floor(rules.dailyCount)),
        require_ocr_amount_match: rules.requireOcrAmount,
        require_ocr_ipa_match: rules.requireOcrDestination,
        ocr_amount_tolerance_bps: Math.max(
          0,
          Math.round(rules.ocrAmountTolerancePct * 100),
        ),
        require_note_contains_reference: rules.requireNoteContainsRef,
        require_transaction_ref_match: rules.requireTxnRefMatch,
        require_recipient_name_match: rules.requireRecipientNameMatch,
        recipient_name_token: rules.recipientNameToken.trim() || null,
      });
      setCreds(saved);
      setWalletNumber("");
      setEnabled(!!saved.enabled);
      toast.success(
        isAr ? "تم حفظ إعدادات فودافون كاش" : "Vodafone Cash settings saved",
      );
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        isAr
          ? "حذف إعدادات فودافون كاش؟ لن يظهر للعملاء الجدد."
          : "Remove Vodafone Cash? New customers won't see it at checkout.",
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const cleared = await deleteVodafoneCashCredentials(storeId);
      setCreds(cleared);
      setWalletNumber("");
      setDisplayName("");
      setFallbackPhone("");
      setEnabled(false);
      toast.success(isAr ? "تم حذف الإعدادات" : "Vodafone Cash removed");
    } catch (err) {
      showError(err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">
          {isAr ? "جارٍ تحميل إعدادات فودافون كاش..." : "Loading Vodafone Cash…"}
        </span>
      </div>
    );
  }

  const isConfigured = creds?.is_configured;

  return (
    <div className="rounded-xl border bg-card">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/vodafone-cash-logo.png"
            alt="Vodafone Cash"
            className="h-10 w-auto object-contain shrink-0"
          />
          <div>
            <h2 className="text-base font-bold">
              {isAr ? "فودافون كاش" : "Vodafone Cash"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "استقبل تحويلات المحفظة مع التحقق اليدوي من الإثبات"
                : "Accept wallet transfers with manual proof verification"}
            </p>
          </div>
        </div>
        {isConfigured ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
            <CheckCircle2 className="w-3 h-3" />
            {enabled ? (isAr ? "نشط" : "Live") : isAr ? "مُعد" : "Ready"}
          </span>
        ) : null}
      </div>

      <div className="p-5 space-y-4">
        {isConfigured && creds?.wallet_number_masked ? (
          <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
            {isAr ? "الرقم الحالي: " : "Current wallet number: "}
            <span className="font-mono" dir="ltr">
              {creds.wallet_number_masked}
            </span>
            {creds.last_configured ? (
              <span className="ml-2">
                ({isAr ? "آخر تحديث " : "last updated "}
                {new Date(creds.last_configured).toLocaleDateString()})
              </span>
            ) : null}
          </div>
        ) : null}

        <div>
          <Label>
            {isAr ? "رقم محفظة فودافون كاش" : "Vodafone Cash wallet number"}{" "}
            {!isConfigured ? <span className="text-red-600">*</span> : null}
          </Label>
          <Input
            value={walletNumber}
            onChange={(e) => setWalletNumber(e.target.value)}
            placeholder={isConfigured ? "•••••" : "01012345678"}
            autoComplete="off"
            dir="ltr"
            inputMode="tel"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            {isAr
              ? "الرقم الذي يحوّل إليه العملاء من محفظتهم. يجب أن يبدأ بـ 010 (فودافون)."
              : "The number customers transfer to from their own wallet. Must be a Vodafone line (starts with 010)."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{isAr ? "الاسم المعروض" : "Display name"}</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={isAr ? "متجر نمو" : "Your store"}
            />
          </div>
          <div>
            <Label>{isAr ? "رقم احتياطي" : "Fallback phone"}</Label>
            <Input
              value={fallbackPhone}
              onChange={(e) => setFallbackPhone(e.target.value)}
              placeholder="+20 10…"
            />
          </div>
        </div>

        <ManualRailAutoApproval
          isAr={isAr}
          values={rules}
          onChange={setRule}
          ocrProvider={creds?.ocr_provider}
          destinationNoun={isAr ? "رقم المحفظة" : "wallet number"}
          referenceExample="VF-XXXXXX"
          toleranceHint={
            isAr
              ? "فودافون تخصم رسوم التحويل من المُرسِل، لذا قد يصل مبلغ أقل قليلاً من إجمالي الطلب. الافتراضي 3% لتفادي تحويل كل طلب للمراجعة اليدوية."
              : "Vodafone charges the sender a transfer fee, so slightly less than the order total can land. The 3% default absorbs that — a tighter window sends every order to manual review."
          }
        />

        {isConfigured ? (
          <div className="flex items-center justify-between border-t pt-4">
            <div>
              <p className="text-sm font-semibold">
                {isAr ? "تفعيل في الدفع" : "Offer at checkout"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isAr
                  ? "عرض فودافون كاش كطريقة دفع للعملاء."
                  : "Show Vodafone Cash as a payment option to customers."}
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={handleToggleEnabled}
              disabled={togglingEnabled}
            />
          </div>
        ) : null}

        <div className="pt-2 flex gap-2">
          <Button
            onClick={handleSave}
            disabled={saving || deleting}
            className="flex-1"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isConfigured
              ? isAr
                ? "تحديث"
                : "Update settings"
              : isAr
                ? "حفظ"
                : "Save"}
          </Button>
          {isConfigured ? (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={saving || deleting}
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
