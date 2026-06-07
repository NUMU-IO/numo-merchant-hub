/**
 * Trust Network — dedicated page for the cross-merchant COD reputation layer.
 *
 * A standalone differentiator ("a credit score for COD"), not a payment
 * gateway. Owns: a how-it-works intro, the per-store impact row (with a
 * period selector + trend vs the prior window + recovered revenue), a phone
 * lookup tool (cross-merchant reputation for any number), the full settings
 * surface (enable / threshold / confidence / action incl. Recover + promo /
 * auto-RTO), and the live decisions feed.
 *
 * Impact + lookup are per-store / per-phone only — never the network-wide
 * moat metrics (internal-key, data-room artifact).
 */

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  Loader2,
  ScanSearch,
  AlertTriangle,
  Ban,
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  Search,
  Network,
  Radar,
  Sparkles,
} from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { showError } from "@/lib/show-error";
import {
  fetchCodTrustSettings,
  updateCodTrustSettings,
  fetchTrustStats,
  lookupTrustPhone,
  type CodTrustSettings,
  type TrustStats,
  type TrustLookup,
} from "@/services/storeApi";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import CodTrustDecisions from "@/components/payments/CodTrustDecisions";

const PERIODS = [7, 30, 90] as const;

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

function Delta({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (diff === 0) return null;
  const up = diff > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${
        up ? "text-emerald-600" : "text-muted-foreground"
      }`}
    >
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(diff)}
    </span>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  current,
  previous,
  tone = "violet",
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  current: number;
  previous: number;
  tone?: "violet" | "amber" | "red" | "green";
}) {
  const toneText = {
    violet: "text-violet-600",
    amber: "text-amber-600",
    red: "text-red-600",
    green: "text-emerald-600",
  }[tone];
  const toneBg = {
    violet: "bg-violet-500/10",
    amber: "bg-amber-500/10",
    red: "bg-red-500/10",
    green: "bg-emerald-500/10",
  }[tone];
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${toneBg}`}>
          <Icon size={16} className={toneText} />
        </div>
        <Delta current={current} previous={previous} />
      </div>
      <div className={`text-2xl font-extrabold tabular-nums mt-3 ${toneText}`}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

const TIER: Record<
  string,
  { en: string; ar: string; text: string; bg: string }
> = {
  trusted_buyer: {
    en: "Trusted buyer",
    ar: "عميل موثوق",
    text: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-500/10 border-emerald-500/30",
  },
  new_to_network: {
    en: "New to network",
    ar: "جديد على الشبكة",
    text: "text-muted-foreground",
    bg: "bg-muted border-border",
  },
  risky: {
    en: "Risky",
    ar: "مخاطرة",
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-500/10 border-amber-500/30",
  },
  serial_abuser: {
    en: "Serial abuser",
    ar: "مُسيء متكرر",
    text: "text-red-700 dark:text-red-300",
    bg: "bg-red-500/10 border-red-500/30",
  },
};

export default function TrustNetwork() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const currency = currentStore?.default_currency || "EGP";

  const [codTrust, setCodTrust] = useState<CodTrustSettings>({
    enabled: false,
    threshold: 70,
    min_confidence: "medium",
    action: "block",
    auto_rto_days: 14,
    auto_rto_disabled: false,
  });
  const [stats, setStats] = useState<TrustStats | null>(null);
  const [periodDays, setPeriodDays] = useState<(typeof PERIODS)[number]>(30);
  const [loading, setLoading] = useState(true);

  // Phone lookup tool state.
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupResult, setLookupResult] = useState<TrustLookup | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupErr, setLookupErr] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    fetchCodTrustSettings(storeId)
      .then((ct) => {
        if (ct) setCodTrust(ct);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    fetchTrustStats(storeId, periodDays).then(setStats).catch(() => null);
  }, [storeId, periodDays]);

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

  const doLookup = useCallback(async () => {
    if (!storeId || !lookupPhone.trim()) return;
    setLookupBusy(true);
    setLookupErr(null);
    setLookupResult(null);
    try {
      setLookupResult(await lookupTrustPhone(storeId, lookupPhone.trim()));
    } catch (err) {
      setLookupErr(
        err instanceof Error
          ? err.message
          : isAr
            ? "تعذّر البحث"
            : "Lookup failed",
      );
    } finally {
      setLookupBusy(false);
    }
  }, [storeId, lookupPhone, isAr]);

  const money = (cents: number) =>
    `${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;

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

  const c = stats?.current;
  const p = stats?.previous;

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
          {/* How it works — gradient hero with three steps */}
          <div className="rounded-2xl border bg-gradient-to-br from-violet-500/10 via-background to-background p-5">
            <div className="flex items-center gap-2 mb-4">
              <Network size={16} className="text-violet-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                {isAr ? "كيف تعمل" : "How it works"}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: Radar,
                  t: isAr ? "تقييم" : "Screen",
                  d: isAr
                    ? "كل طلب دفع عند الاستلام يُقيَّم مقابل سمعة الرقم عبر الشبكة."
                    : "Every COD order is scored against the phone's network-wide reputation.",
                },
                {
                  icon: AlertTriangle,
                  t: isAr ? "اكتشاف" : "Flag",
                  d: isAr
                    ? "أصحاب معدلات الرفض العالية يُكتشفون قبل الشحن — حتى الجدد عندك."
                    : "High-RTO buyers are caught before you ship — even first-timers to your store.",
                },
                {
                  icon: Sparkles,
                  t: isAr ? "تصرّف" : "Act",
                  d: isAr
                    ? "احظر، أو حذّر، أو حوّل الطلب لمدفوع مسبقاً عبر عرض واتساب."
                    : "Block, warn, or convert the order to prepaid via a WhatsApp offer.",
                },
              ].map((s) => (
                <div key={s.t} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                    <s.icon size={15} className="text-violet-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold">{s.t}</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

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
              {/* Impact row + period selector */}
              {c && p && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold">
                      {isAr ? "الأثر" : "Impact"}
                    </h2>
                    <div className="inline-flex rounded-lg border bg-background p-0.5">
                      {PERIODS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setPeriodDays(d)}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                            periodDays === d
                              ? "bg-violet-500/10 text-violet-700 dark:text-violet-300"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {isAr ? `${d}ي` : `${d}d`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatTile
                      icon={ScanSearch}
                      label={isAr ? "طلبات تم فحصها" : "Orders screened"}
                      value={c.screened}
                      current={c.screened}
                      previous={p.screened}
                    />
                    <StatTile
                      icon={AlertTriangle}
                      label={isAr ? "عالية المخاطرة" : "High-risk caught"}
                      value={c.high_risk}
                      current={c.high_risk}
                      previous={p.high_risk}
                      tone="amber"
                    />
                    <StatTile
                      icon={Ban}
                      label={isAr ? "تم حظرها" : "Blocked"}
                      value={c.blocked}
                      current={c.blocked}
                      previous={p.blocked}
                      tone="red"
                    />
                    <StatTile
                      icon={CircleDollarSign}
                      label={isAr ? "قيمة تم استردادها" : "Revenue recovered"}
                      value={money(c.recovered_value)}
                      current={c.recovered}
                      previous={p.recovered}
                      tone="green"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {isAr
                      ? `آخر ${periodDays} يوماً · المقارنة مع الفترة السابقة`
                      : `Last ${periodDays} days · change vs the prior period`}
                  </p>
                </div>
              )}

              {/* Phone lookup tool */}
              <div className="rounded-xl border bg-background p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Search size={15} className="text-violet-600" />
                  <span className="text-sm font-bold">
                    {isAr ? "فحص رقم عميل" : "Check a customer"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  {isAr
                    ? "اعرف سمعة أي رقم عبر الشبكة قبل تأكيد الطلب."
                    : "See any phone's cross-merchant reputation before you confirm an order."}
                </p>
                <div className="flex gap-2">
                  <Input
                    className="h-9 text-sm flex-1"
                    dir="ltr"
                    inputMode="tel"
                    placeholder="+201234567890"
                    value={lookupPhone}
                    onChange={(e) => setLookupPhone(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") doLookup();
                    }}
                  />
                  <button
                    type="button"
                    onClick={doLookup}
                    disabled={lookupBusy || !lookupPhone.trim()}
                    className="h-9 px-4 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors disabled:opacity-40 inline-flex items-center gap-1.5"
                  >
                    {lookupBusy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Search size={14} />
                    )}
                    {isAr ? "بحث" : "Look up"}
                  </button>
                </div>
                {lookupErr && (
                  <p className="text-[11px] text-red-600 mt-2">{lookupErr}</p>
                )}
                {lookupResult && (
                  <div className="mt-3 flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
                    <div className="text-2xl font-extrabold tabular-nums text-violet-600">
                      {lookupResult.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span
                        className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded border ${
                          (TIER[lookupResult.label] || TIER.new_to_network).bg
                        } ${(TIER[lookupResult.label] || TIER.new_to_network).text}`}
                      >
                        {isAr
                          ? (TIER[lookupResult.label] || TIER.new_to_network).ar
                          : (TIER[lookupResult.label] || TIER.new_to_network).en}
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {lookupResult.phone_last4
                          ? `•••• ${lookupResult.phone_last4} · `
                          : ""}
                        {isAr ? "درجة المخاطرة" : "risk score"} {lookupResult.score}/100
                        {" · "}
                        {isAr ? "ثقة" : "confidence"} {lookupResult.confidence}
                        {!lookupResult.known &&
                          (isAr
                            ? " · لا سجل سابق"
                            : " · no prior history")}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Settings */}
              <h2 className="text-sm font-bold pt-1">
                {isAr ? "الإعدادات" : "Settings"}
              </h2>
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
