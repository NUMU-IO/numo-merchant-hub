/**
 * Trust Network — dedicated page for the cross-merchant COD reputation layer.
 *
 * Previously buried at the bottom of Payment Setup; promoted to its own page
 * because it's a standalone differentiator ("a credit score for COD"), not a
 * payment gateway. Owns the full settings surface (enable / threshold /
 * confidence / action incl. Recover + promo / auto-RTO) plus the live
 * decisions feed.
 *
 * Impact row is per-store only (screened / high-risk / blocked / recovered),
 * served by GET /stores/{id}/cod-trust/stats — never the network-wide
 * moat-metrics (internal-key, data-room artifact). The decisions feed below
 * is the per-order detail behind those numbers.
 */

import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { showError } from "@/lib/show-error";
import {
  fetchCodTrustSettings,
  updateCodTrustSettings,
  fetchTrustStats,
  type CodTrustSettings,
  type TrustStats,
} from "@/services/storeApi";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import CodTrustDecisions from "@/components/payments/CodTrustDecisions";

function SettingCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-background p-5">
      <Label className="text-xs font-semibold block">{title}</Label>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone = "violet",
}: {
  label: string;
  value: number;
  tone?: "violet" | "amber" | "red" | "green";
}) {
  const toneClass = {
    violet: "text-violet-600",
    amber: "text-amber-600",
    red: "text-red-600",
    green: "text-emerald-600",
  }[tone];
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className={`text-2xl font-extrabold tabular-nums ${toneClass}`}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

export default function TrustNetwork() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;

  const [codTrust, setCodTrust] = useState<CodTrustSettings>({
    enabled: false,
    threshold: 70,
    min_confidence: "medium",
    action: "block",
    auto_rto_days: 14,
    auto_rto_disabled: false,
  });
  const [stats, setStats] = useState<TrustStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    fetchCodTrustSettings(storeId)
      .then((ct) => {
        if (ct) setCodTrust(ct);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
    // Impact stats — non-blocking; the page renders fine without them.
    fetchTrustStats(storeId).then(setStats).catch(() => null);
  }, [storeId]);

  const handleUpdate = async (patch: Partial<CodTrustSettings>) => {
    if (!storeId) return;
    const previous = codTrust;
    setCodTrust({ ...codTrust, ...patch });
    try {
      const result = await updateCodTrustSettings(storeId, patch);
      setCodTrust(result);
    } catch (err) {
      setCodTrust(previous);
      showError(err, language);
    }
  };

  const actionBtn = (
    value: CodTrustSettings["action"],
    labelEn: string,
    labelAr: string,
  ) => (
    <button
      type="button"
      onClick={() => handleUpdate({ action: value })}
      className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
        codTrust.action === value
          ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300"
          : "border-border bg-background text-muted-foreground hover:bg-muted"
      }`}
    >
      {isAr ? labelAr : labelEn}
    </button>
  );

  return (
    <div className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
            {isAr ? "شبكة الثقة" : "Trust Network"}
          </h1>
          <span className="text-[9px] font-bold uppercase tracking-wider text-violet-600 bg-violet-500/10 px-1.5 py-0.5 rounded">
            {isAr ? "شبكة نمو" : "NUMU NETWORK"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {isAr
            ? "درجة ثقة للدفع عند الاستلام — سمعة العميل عبر كل متاجر نمو. عميل بمعدل رفض عالٍ في متجر آخر يُكتشف عندك حتى لو كان أول طلب له."
            : "A credit score for COD — customer reputation across every NUMU store. A serial refuser flagged at another store is caught at yours, even on their first order with you."}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Master enable card */}
          <div className="rounded-xl border bg-background p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold">
                    {isAr ? "حماية من احتيال الدفع عند الاستلام" : "COD Fraud Protection"}
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isAr
                      ? "فعّل الحماية ليتم تقييم كل طلب دفع عند الاستلام مقابل شبكة الثقة."
                      : "Turn on to score every COD order against the cross-merchant trust network."}
                  </p>
                </div>
              </div>
              <Switch
                checked={codTrust.enabled}
                onCheckedChange={(v) => handleUpdate({ enabled: v })}
              />
            </div>
          </div>

          {codTrust.enabled && (
            <>
              {/* Impact row — per-store, last N days */}
              {stats && (
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatTile
                      label={isAr ? "طلبات تم فحصها" : "Orders screened"}
                      value={stats.screened}
                    />
                    <StatTile
                      label={isAr ? "عالية المخاطرة" : "High-risk caught"}
                      value={stats.high_risk}
                      tone="amber"
                    />
                    <StatTile
                      label={isAr ? "تم حظرها" : "Blocked"}
                      value={stats.blocked}
                      tone="red"
                    />
                    <StatTile
                      label={isAr ? "تحوّلت لمدفوع" : "Recovered to prepaid"}
                      value={stats.recovered}
                      tone="green"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {isAr
                      ? `آخر ${stats.period_days} يوماً`
                      : `Last ${stats.period_days} days`}
                  </p>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {/* Risk threshold */}
                <SettingCard
                  title={isAr ? "حد المخاطرة" : "Risk threshold"}
                  hint={
                    isAr
                      ? `العملاء بدرجة مخاطرة ≥ ${codTrust.threshold} (بثقة متوسطة فأعلى).`
                      : `Customers with a risk score ≥ ${codTrust.threshold} (medium+ confidence).`
                  }
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-muted-foreground">
                      {isAr ? "حساس" : "Strict"}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-violet-600">
                      {codTrust.threshold}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {isAr ? "متساهل" : "Lenient"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={95}
                    step={5}
                    value={codTrust.threshold}
                    onChange={(e) =>
                      handleUpdate({ threshold: Number(e.target.value) })
                    }
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-violet-600"
                    aria-label={isAr ? "حد المخاطرة" : "Risk threshold"}
                  />
                </SettingCard>

                {/* Minimum confidence */}
                <SettingCard
                  title={isAr ? "الحد الأدنى للثقة" : "Minimum confidence to act"}
                  hint={
                    codTrust.min_confidence === "low"
                      ? isAr
                        ? "حظر العملاء الجدد بإشارات الموقع وحدها — الأقوى في مرحلة الإطلاق."
                        : "Act on first-time customers using location signals alone — strongest at pre-launch scale."
                      : codTrust.min_confidence === "medium"
                        ? isAr
                          ? "الانتظار حتى ٣ طلبات على الأقل قبل التصرف."
                          : "Wait for at least 3 orders of history before acting."
                        : isAr
                          ? "حظر ذوي السجل الطويل من الإساءة فقط (١٠ طلبات+)."
                          : "Only act on established serial abusers (10+ orders)."
                  }
                >
                  <div className="grid grid-cols-3 gap-2">
                    {(["low", "medium", "high"] as const).map((level) => {
                      const active = codTrust.min_confidence === level;
                      const labelAr =
                        level === "low" ? "منخفض" : level === "medium" ? "متوسط" : "عالٍ";
                      const labelEn =
                        level === "low" ? "Low" : level === "medium" ? "Medium" : "High";
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => handleUpdate({ min_confidence: level })}
                          className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                            active
                              ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                              : "border-border bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {isAr ? labelAr : labelEn}
                          {level === "medium" && (
                            <span className="ml-1 text-[9px] uppercase tracking-wider opacity-70">
                              {isAr ? "موصى" : "Rec"}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </SettingCard>

                {/* Action */}
                <SettingCard
                  title={isAr ? "الإجراء عند تجاوز الحد" : "Action when flagged"}
                  hint={
                    codTrust.action === "warn"
                      ? isAr
                        ? "السماح بالطلب وتسجيل تحذير في السجلات."
                        : "Allow the order and log a warning."
                      : codTrust.action === "recover"
                        ? isAr
                          ? "السماح بالطلب وإرسال عرض عبر واتساب للدفع أونلاين (تحويل الدفع عند الاستلام إلى مدفوع مسبقاً)."
                          : "Allow the order and send a WhatsApp offer to pay online (converts COD → prepaid)."
                        : isAr
                          ? "رفض الطلب واقتراح الدفع الإلكتروني."
                          : "Reject the order and suggest online payment."
                  }
                >
                  <div className="grid grid-cols-3 gap-2">
                    {actionBtn("warn", "Warn only", "تحذير فقط")}
                    {actionBtn("block", "Block order", "حظر الطلب")}
                    {actionBtn("recover", "Recover", "استرداد")}
                  </div>
                  {codTrust.action === "recover" && (
                    <div className="mt-3">
                      <Label className="text-[11px] font-medium mb-1.5 block">
                        {isAr ? "نص العرض الترويجي (اختياري)" : "Promo line (optional)"}
                      </Label>
                      <Input
                        className="h-9 text-xs"
                        maxLength={120}
                        dir={isAr ? "rtl" : "ltr"}
                        placeholder={
                          isAr
                            ? "مثال: خصم ١٠٪ عند الدفع أونلاين"
                            : "e.g. 10% off when you pay online"
                        }
                        value={codTrust.recovery_promo ?? ""}
                        onChange={(e) =>
                          setCodTrust({ ...codTrust, recovery_promo: e.target.value })
                        }
                        onBlur={(e) =>
                          handleUpdate({ recovery_promo: e.target.value.trim() })
                        }
                      />
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        {isAr
                          ? "يظهر في رسالة واتساب. إذا تُرك فارغاً، نستخدم رسالة افتراضية."
                          : "Shown in the WhatsApp offer. Left blank, a default line is used."}
                      </p>
                    </div>
                  )}
                </SettingCard>

                {/* Auto-RTO sweep */}
                <SettingCard
                  title={isAr ? "تحديد المرتجعات تلقائياً" : "Auto-mark stale orders as returned"}
                  hint={
                    isAr
                      ? "إذا تشحن بنفسك ونسيت التحديث، نُعلِّم الطلبات الراكدة كمرتجعة لتغذية الشبكة."
                      : "If you ship manually and forget to update, we auto-flag stale orders so the network learns from them."
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {isAr ? "مُفعّل" : "Enabled"}
                    </span>
                    <Switch
                      checked={!codTrust.auto_rto_disabled}
                      onCheckedChange={(v) => handleUpdate({ auto_rto_disabled: !v })}
                    />
                  </div>
                  {!codTrust.auto_rto_disabled && (
                    <div className="flex items-center gap-2 mt-3">
                      <Label className="text-[11px] text-muted-foreground shrink-0">
                        {isAr ? "بعد كم يوم؟" : "After how many days?"}
                      </Label>
                      <input
                        type="number"
                        min={7}
                        max={60}
                        value={codTrust.auto_rto_days}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (n >= 7 && n <= 60) handleUpdate({ auto_rto_days: n });
                        }}
                        className="w-16 h-7 px-2 rounded border bg-background text-xs tabular-nums"
                        aria-label={isAr ? "أيام قبل تحديد المرتجع تلقائياً" : "Days before auto-RTO"}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {isAr ? "يوم (٧-٦٠)" : "days (7-60)"}
                      </span>
                    </div>
                  )}
                </SettingCard>
              </div>

              {/* Decisions feed */}
              {storeId && <CodTrustDecisions storeId={storeId} isAr={isAr} />}
            </>
          )}
        </>
      )}
    </div>
  );
}
