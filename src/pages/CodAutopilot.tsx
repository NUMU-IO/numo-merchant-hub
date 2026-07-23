/**
 * COD Autopilot — settings page (004-cod-autopilot, US5).
 *
 * Automates the shipped + delivered legs of COD orders for merchants who
 * ship with external couriers (no API): one daily WhatsApp ship-digest tap
 * marks the day's orders shipped; a delivery-check message asks the
 * customer directly; silent orders auto-close after a configurable window.
 * The merchant only ever touches the "Needs attention" queue on Orders.
 *
 * Clone of the TrustNetwork settings surface: optimistic PATCH-on-change
 * with rollback + toast, SettingCard grid, inline ar/en ternaries, RTL via
 * dir on the page root.
 */

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  MessageCircle,
  PackageCheck,
  Send,
  Timer,
  Zap,
} from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { showError } from "@/lib/show-error";
import {
  fetchCodAutopilotSettings,
  updateCodAutopilotSettings,
  type CodAutopilotSettings,
} from "@/services/storeApi";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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

function StepCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4 flex gap-3">
      <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-violet-600" />
      </div>
      <div>
        <p className="text-xs font-semibold">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{body}</p>
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

export default function CodAutopilot() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;

  const [settings, setSettings] = useState<CodAutopilotSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    fetchCodAutopilotSettings(storeId)
      .then(setSettings)
      .catch((err) => showError(err, language))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const handleUpdate = async (
    patch: Partial<
      Omit<CodAutopilotSettings, "digest_deliverable" | "auto_rto_days">
    >,
  ) => {
    if (!storeId || !settings) return;
    const previous = settings;
    setSettings({ ...settings, ...patch });
    try {
      setSettings(await updateCodAutopilotSettings(storeId, patch));
    } catch (err) {
      setSettings(previous);
      showError(err, language);
    }
  };

  const fmtHour = (h: number) => {
    const period = h < 12 ? (isAr ? "ص" : "AM") : (isAr ? "م" : "PM");
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}:00 ${period}`;
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const overlapWarning =
    settings.assumed_delivered_days >= settings.auto_rto_days;

  return (
    <div className="space-y-6 max-w-4xl" dir={isAr ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
          <Zap size={22} className="text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">
            {isAr ? "أوتوبايلوت الدفع عند الاستلام" : "COD Autopilot"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-lg">
            {isAr
              ? "أوردراتك تتقفل لوحدها: ضغطة واتساب واحدة في اليوم للشحن، والعميل نفسه يأكد الاستلام. انت بس تراجع اللي محتاج تدخلك."
              : "Your orders close themselves: one WhatsApp tap a day for shipping, and the customer confirms delivery directly. You only review what needs attention."}
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="grid gap-3 md:grid-cols-3">
        <StepCard
          icon={Send}
          title={isAr ? "١. قايمة الشحن اليومية" : "1. Daily ship digest"}
          body={
            isAr
              ? "رسالة واتساب واحدة بأوردرات اليوم المتأكدة — اضغط “تم شحن الكل” أو رد بأرقام اللي ماتشحنش."
              : "One WhatsApp message listing today's confirmed orders — tap All shipped, or reply with the numbers you didn't ship."
          }
        />
        <StepCard
          icon={MessageCircle}
          title={isAr ? "٢. تأكيد الاستلام" : "2. Delivery check"}
          body={
            isAr
              ? "بعد الشحن بأيام، العميل يستلم أزرار: استلمته / لسه / رفضته. “استلمته” تقفل الأوردر وتسجل الكاش."
              : "Days after shipping, the customer gets buttons: Received / Not yet / Refused. Received closes the order and records the cash."
          }
        />
        <StepCard
          icon={Timer}
          title={isAr ? "٣. الإقفال التلقائي" : "3. Auto-close"}
          body={
            isAr
              ? "لو مفيش رد خالص، الأوردر يتقفل كمُسلَّم بعد المدة اللي تحددها — والرفض يظهر في “يحتاج تدخلك”."
              : "If nobody ever answers, the order auto-closes as delivered after your window — refusals land in the Needs-attention queue."
          }
        />
      </div>

      {/* Master switch */}
      <div className="rounded-xl border bg-background p-5 flex items-center justify-between gap-4">
        <div>
          <Label className="text-sm font-semibold">
            {isAr ? "تفعيل الأوتوبايلوت" : "Enable Autopilot"}
          </Label>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-md">
            {isAr
              ? "يعمل فقط على أوردرات الدفع عند الاستلام المشحونة يدوياً (بدون شركة شحن مربوطة). الإيقاف يوقف كل الرسائل فوراً."
              : "Applies only to manually-shipped COD orders (no connected courier). Turning it off stops all messages immediately."}
          </p>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(v) => handleUpdate({ enabled: v })}
        />
      </div>

      {/* Digest-deliverability warning */}
      {settings.enabled && !settings.digest_deliverable && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-400">
            {isAr
              ? "متجرك ليس له رقم هاتف تواصل — قايمة الشحن اليومية لن تُرسل. أضف رقم واتساب في إعدادات المتجر."
              : "Your store has no contact phone — the daily ship digest cannot be sent. Add a WhatsApp number in store settings."}
          </p>
        </div>
      )}

      {/* Settings grid */}
      <div className={`grid gap-4 md:grid-cols-2 ${settings.enabled ? "" : "opacity-50 pointer-events-none"}`}>
        <SettingCard
          title={isAr ? "موعد قايمة الشحن" : "Ship digest time"}
          hint={
            isAr
              ? "الساعة المحلية اللي توصلك فيها رسالة الشحن اليومية."
              : "The local hour your daily shipping digest arrives."
          }
        >
          <select
            value={settings.digest_hour}
            onChange={(e) => handleUpdate({ digest_hour: Number(e.target.value) })}
            className="w-full h-9 rounded-lg border bg-background px-3 text-xs"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {fmtHour(h)}
              </option>
            ))}
          </select>
        </SettingCard>

        <SettingCard
          title={isAr ? "سؤال العميل بعد الشحن" : "Delivery check delay"}
          hint={
            isAr
              ? "بعد كام يوم من الشحن نسأل العميل “استلمت؟” (١-٧ أيام)."
              : "Days after shipping before we ask the customer “did you receive it?” (1-7)."
          }
        >
          <input
            type="number"
            min={1}
            max={7}
            value={settings.delivery_check_delay_days}
            onChange={(e) =>
              handleUpdate({ delivery_check_delay_days: Number(e.target.value) })
            }
            className="w-24 h-9 rounded-lg border bg-background px-3 text-xs tabular-nums"
            dir="ltr"
          />
        </SettingCard>

        <SettingCard
          title={isAr ? "إعادة المحاولة" : "Retries"}
          hint={
            isAr
              ? "عدد مرات السؤال الكلي وأيام الانتظار بين كل محاولة."
              : "Total asks per order and days between attempts."
          }
        >
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleUpdate({ delivery_check_max_attempts: n })}
                  className={`h-9 w-9 rounded-lg border text-xs font-semibold transition-colors ${
                    settings.delivery_check_max_attempts === n
                      ? "bg-violet-600 text-white border-violet-600"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {isAr ? "كل" : "every"}
            </span>
            <input
              type="number"
              min={1}
              max={7}
              value={settings.delivery_check_retry_days}
              onChange={(e) =>
                handleUpdate({ delivery_check_retry_days: Number(e.target.value) })
              }
              className="w-16 h-9 rounded-lg border bg-background px-2 text-xs tabular-nums"
              dir="ltr"
            />
            <span className="text-[11px] text-muted-foreground">
              {isAr ? "يوم" : "days"}
            </span>
          </div>
        </SettingCard>

        <SettingCard
          title={isAr ? "الإقفال التلقائي كمُسلَّم" : "Assumed-delivered window"}
          hint={
            isAr
              ? "لو مفيش أي رد، الأوردر يتقفل كمُسلَّم بعد كذا يوم من الشحن (٥-٣٠). لا يُحتسب في شبكة الثقة."
              : "With zero response, the order closes as delivered this many days after shipping (5-30). Never counted as a trust-network signal."
          }
        >
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={5}
              max={30}
              value={settings.assumed_delivered_days}
              onChange={(e) =>
                handleUpdate({ assumed_delivered_days: Number(e.target.value) })
              }
              className="w-24 h-9 rounded-lg border bg-background px-3 text-xs tabular-nums"
              dir="ltr"
            />
            <PackageCheck size={16} className="text-muted-foreground" />
          </div>
          {overlapWarning && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2 flex items-start gap-1">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              {isAr
                ? `مسح المرتجعات التلقائي يعمل بعد ${settings.auto_rto_days} يوم — الأوردرات اللي توصله الأول هتتحسب مرتجعة مش مُسلَّمة.`
                : `Your auto-RTO sweep runs at ${settings.auto_rto_days} days — orders reaching it first count as returned, not delivered.`}
            </p>
          )}
        </SettingCard>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {isAr
          ? "ملحوظة: الرسائل تُرسل فقط بعد اعتماد قوالب واتساب من Meta، وتخضع لإعدادات إشعارات واتساب الخاصة بمتجرك."
          : "Note: messages only send once the WhatsApp templates are approved by Meta, and respect your store's WhatsApp notification settings."}
      </p>
    </div>
  );
}
