/**
 * InstaPay setup card for the PaymentSetup page.
 *
 * Different shape from the card-processor gateways (Paymob/Kashier/…):
 * there is no API integration — the merchant only needs to hand us
 * their IPA + auto-approval thresholds. A flat inline form matches
 * the simpler mental model better than a detail sub-view.
 */

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  deleteInstapayCredentials,
  fetchInstapayCredentials,
  saveInstapayCredentials,
  type InstapayCredentialsResponse,
} from "@/services/storeApi";
import { showError } from "@/lib/show-error";

interface Props {
  storeId: string;
  isAr: boolean;
}

const DEFAULT_THRESHOLD_CENTS = 50_000;      // 500 EGP
const DEFAULT_DAILY_CAP_CENTS = 500_000;     // 5,000 EGP
const DEFAULT_DAILY_COUNT = 10;

export default function InstapaySetupCard({ storeId, isAr }: Props) {
  const [creds, setCreds] = useState<InstapayCredentialsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [ipa, setIpa] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fallbackPhone, setFallbackPhone] = useState("");
  const [thresholdEgp, setThresholdEgp] = useState<number>(
    DEFAULT_THRESHOLD_CENTS / 100,
  );
  const [dailyCapEgp, setDailyCapEgp] = useState<number>(
    DEFAULT_DAILY_CAP_CENTS / 100,
  );
  const [dailyCount, setDailyCount] = useState<number>(DEFAULT_DAILY_COUNT);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchInstapayCredentials(storeId)
      .then((c) => {
        if (cancelled) return;
        setCreds(c);
        setEnabled(!!c.enabled);
        setDisplayName(c.ipa_display_name || "");
        setFallbackPhone(c.fallback_phone || "");
        setThresholdEgp(
          (c.auto_approve_threshold_cents ?? DEFAULT_THRESHOLD_CENTS) / 100,
        );
        setDailyCapEgp(
          (c.auto_approve_daily_cap_cents ?? DEFAULT_DAILY_CAP_CENTS) / 100,
        );
        setDailyCount(c.auto_approve_daily_count ?? DEFAULT_DAILY_COUNT);
      })
      .catch(() => setCreds({ is_configured: false } as InstapayCredentialsResponse))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const handleSave = async () => {
    if (!ipa.trim() && !creds?.is_configured) {
      toast.error(
        isAr
          ? "الرجاء إدخال عنوان الدفع الفوري (IPA)"
          : "Please enter your InstaPay IPA",
      );
      return;
    }
    setSaving(true);
    try {
      const saved = await saveInstapayCredentials(storeId, {
        ipa: ipa.trim() || creds?.ipa_masked?.replace(/\*+/g, "") || "",
        ipa_display_name: displayName.trim() || null,
        fallback_phone: fallbackPhone.trim() || null,
        auto_approve_threshold_cents: Math.round(thresholdEgp * 100),
        auto_approve_daily_cap_cents: Math.round(dailyCapEgp * 100),
        auto_approve_daily_count: Math.max(0, Math.floor(dailyCount)),
      });
      setCreds(saved);
      setIpa("");
      setEnabled(!!saved.enabled);
      toast.success(
        isAr ? "تم حفظ إعدادات إنستاباي" : "InstaPay settings saved",
      );
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">
          {isAr ? "جارٍ تحميل إعدادات إنستاباي..." : "Loading InstaPay…"}
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
            src="/instapay-logo.svg"
            alt="InstaPay"
            className="h-10 w-auto object-contain"
          />
          <div>
            <h2 className="text-base font-bold">
              {isAr ? "انستاباي" : "InstaPay"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "قبول المدفوعات المباشرة إلى حسابك البنكي"
                : "Accept direct bank-to-bank payments with manual verification"}
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
        {isConfigured && creds?.ipa_masked ? (
          <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
            {isAr ? "العنوان الحالي: " : "Current IPA: "}
            <span className="font-mono">{creds.ipa_masked}</span>
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
            {isAr ? "عنوان الدفع (IPA)" : "InstaPay address (IPA)"}{" "}
            {!isConfigured ? <span className="text-red-600">*</span> : null}
          </Label>
          <Input
            value={ipa}
            onChange={(e) => setIpa(e.target.value)}
            placeholder={
              isConfigured ? "•••••" : "merchant@cib"
            }
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            {isAr
              ? "العنوان الذي يرسل إليه العملاء الأموال من تطبيق البنك."
              : "The address customers will send funds to from their bank app."}
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

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold">
                {isAr ? "الموافقة التلقائية" : "Auto-approval"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isAr
                  ? "للطلبات الصغيرة، يتم قبول الإثبات تلقائياً بناءً على القواعد أدناه."
                  : "Small orders auto-approve based on the rules below."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">
                {isAr ? "حد القبول (ج.م)" : "Threshold (EGP)"}
              </Label>
              <Input
                type="number"
                min={0}
                value={thresholdEgp}
                onChange={(e) => setThresholdEgp(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">
                {isAr ? "الحد اليومي (ج.م)" : "Daily cap (EGP)"}
              </Label>
              <Input
                type="number"
                min={0}
                value={dailyCapEgp}
                onChange={(e) => setDailyCapEgp(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">
                {isAr ? "عدد الطلبات/اليوم" : "Orders/day"}
              </Label>
              <Input
                type="number"
                min={0}
                value={dailyCount}
                onChange={(e) => setDailyCount(Number(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        {isConfigured ? (
          <div className="flex items-center justify-between border-t pt-4">
            <div>
              <p className="text-sm font-semibold">
                {isAr ? "تفعيل في الدفع" : "Offer at checkout"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {isAr
                  ? "عرض إنستاباي كطريقة دفع للعملاء."
                  : "Show InstaPay as a payment option to customers."}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} disabled />
          </div>
        ) : null}

        <div className="pt-2 flex gap-2">
          <Button onClick={handleSave} disabled={saving || deleting} className="flex-1">
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
              onClick={async () => {
                if (
                  !confirm(
                    isAr
                      ? "حذف إعدادات إنستاباي؟ لن يظهر للعملاء الجدد."
                      : "Remove InstaPay? New customers won't see it at checkout.",
                  )
                ) {
                  return;
                }
                setDeleting(true);
                try {
                  const cleared = await deleteInstapayCredentials(storeId);
                  setCreds(cleared);
                  setIpa("");
                  setDisplayName("");
                  setFallbackPhone("");
                  setEnabled(false);
                  toast.success(
                    isAr ? "تم حذف الإعدادات" : "InstaPay removed",
                  );
                } catch (err) {
                  showError(err);
                } finally {
                  setDeleting(false);
                }
              }}
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
