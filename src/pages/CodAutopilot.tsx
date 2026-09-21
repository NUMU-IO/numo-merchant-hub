/**
 * COD Autopilot — the page a merchant checks to see whether it is working.
 *
 * Automates the shipped + delivered legs of COD orders for merchants who ship
 * with external couriers: one daily WhatsApp ship-digest tap marks the day's
 * orders shipped, a delivery-check message asks the customer directly, and
 * silent orders auto-close after a configurable window.
 *
 * It used to be a settings form and nothing else, which is how a store could
 * sit with the switch on and no message ever sent: the WhatsApp templates
 * were not approved for that store, or COD itself was off, and the page had
 * no way to say so. Readiness is now the first thing on the screen — the
 * switch is refused outright until the pieces Autopilot depends on are
 * actually in place — and the exception queue lives here rather than only on
 * Orders, so "is this running?" is answerable at a glance.
 *
 * Laid out like the courier page: header, status tiles, then tabs.
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  MessageCircle,
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
import { listAutopilotExceptions } from "@/services/orderApi";
import AutopilotExceptions from "@/components/orders/AutopilotExceptions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

type Tab = "settings" | "attention" | "how";

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
    <div className="rounded-xl border bg-card p-5">
      <Label className="block text-xs font-semibold">{title}</Label>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
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
    <div className="flex gap-3 rounded-xl border bg-card p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
        <Icon size={18} className="text-violet-600" />
      </div>
      <div>
        <p className="text-xs font-semibold">{title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

/** One blocker, said plainly, with what to do about it. */
function Blocker({ text }: { text: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
      <p className="text-xs text-amber-800 dark:text-amber-400">{text}</p>
    </div>
  );
}

export default function CodAutopilot() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;

  const [settings, setSettings] = useState<CodAutopilotSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("settings");

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    fetchCodAutopilotSettings(storeId)
      .then(setSettings)
      .catch((err) => showError(err, language))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const exceptions = useQuery({
    queryKey: ["autopilot-exceptions-count", storeId],
    queryFn: () => listAutopilotExceptions(storeId!, { limit: 1 }),
    enabled: !!storeId,
  });

  const handleUpdate = async (
    patch: Partial<
      Omit<
        CodAutopilotSettings,
        | "digest_deliverable"
        | "auto_rto_days"
        | "templates_ready"
        | "templates_pending"
        | "cod_enabled"
        | "whatsapp_access_active"
      >
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
    const period = h < 12 ? (isAr ? "ص" : "AM") : isAr ? "م" : "PM";
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

  const overlapWarning = settings.assumed_delivered_days >= settings.auto_rto_days;
  const needsAttention = exceptions.data?.total ?? 0;
  // Everything Autopilot needs before a single message can go out. Any one
  // missing and the sweeps skip this store in silence — which is the whole
  // reason this block exists.
  const blockers: string[] = [];
  if (!settings.cod_enabled) {
    blockers.push(
      isAr
        ? "الدفع عند الاستلام مقفول في إعدادات الدفع — الأوتوبايلوت بيشتغل على أوردرات الدفع عند الاستلام بس، فمفيش حاجة يعملها."
        : "Cash on delivery is switched off in your payment settings. Autopilot only ever touches COD orders, so it has nothing to work on.",
    );
  }
  if (settings.whatsapp_access_active === false) {
    blockers.push(
      isAr
        ? "اشتراك واتساب لمتجرك غير مفعّل — لا تخرج أي رسالة من الأوتوبايلوت. فعّله أو جدّده من صفحة واتساب."
        : "Your store's WhatsApp subscription is not active, so Autopilot cannot send a single message. Activate or renew it on the WhatsApp page.",
    );
  }
  if (!settings.digest_deliverable) {
    blockers.push(
      isAr
        ? "متجرك ليس له رقم تواصل — قايمة الشحن اليومية لن تُرسل. أضف رقم واتساب في إعدادات المتجر."
        : "Your store has no contact phone, so the daily ship digest cannot be sent. Add a WhatsApp number in store settings.",
    );
  }
  if (!settings.templates_ready) {
    const pending = (settings.templates_pending ?? []).join(", ");
    blockers.push(
      isAr
        ? `قوالب واتساب الخاصة بالأوتوبايلوت لسه مش معتمدة من Meta${pending ? ` (${pending})` : ""} — الرسائل مش هتخرج لحد ما تتعمد. الاعتماد بيتم أوتوماتيك، عادة خلال ساعات.`
        : `The Autopilot WhatsApp templates are not approved yet${pending ? ` (${pending})` : ""}. No message can go out until Meta approves them — that happens automatically, usually within hours.`,
    );
  }
  const ready = blockers.length === 0;
  const live = settings.enabled && ready;

  const tiles = [
    {
      label: isAr ? "الحالة" : "Status",
      value: live
        ? isAr
          ? "شغّال"
          : "Live"
        : settings.enabled
          ? isAr
            ? "محجوب"
            : "Blocked"
          : isAr
            ? "مقفول"
            : "Off",
      icon: Zap,
      bg: live
        ? "from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-900/10"
        : "from-slate-100 to-slate-50 dark:from-slate-800/40 dark:to-slate-800/20",
      iconColor: live
        ? "text-emerald-300 dark:text-emerald-800"
        : "text-slate-400 dark:text-slate-600",
    },
    {
      label: isAr ? "يحتاج تدخلك" : "Needs attention",
      value: exceptions.isLoading ? "—" : needsAttention,
      icon: Inbox,
      bg:
        needsAttention > 0
          ? "from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-900/10"
          : "from-slate-100 to-slate-50 dark:from-slate-800/40 dark:to-slate-800/20",
      iconColor:
        needsAttention > 0
          ? "text-amber-300 dark:text-amber-800"
          : "text-slate-400 dark:text-slate-600",
    },
    {
      label: isAr ? "قايمة الشحن" : "Ship digest",
      value: fmtHour(settings.digest_hour),
      icon: Clock,
      bg: "from-violet-100 to-violet-50 dark:from-violet-900/30 dark:to-violet-900/10",
      iconColor: "text-violet-300 dark:text-violet-800",
    },
    {
      label: isAr ? "الإقفال التلقائي" : "Auto-close",
      value: isAr
        ? `${settings.assumed_delivered_days} يوم`
        : `${settings.assumed_delivered_days} days`,
      icon: Timer,
      bg: "from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-900/10",
      iconColor: "text-blue-300 dark:text-blue-800",
    },
  ];

  return (
    <div className="mx-auto max-w-[1100px] md:p-6" dir={isAr ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
            <Zap size={22} className="text-violet-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">
                {isAr ? "أوتوبايلوت الدفع عند الاستلام" : "COD Autopilot"}
              </h1>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  live
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {live
                  ? isAr
                    ? "شغّال"
                    : "Live"
                  : settings.enabled
                    ? isAr
                      ? "محجوب"
                      : "Blocked"
                    : isAr
                      ? "مقفول"
                      : "Off"}
              </span>
            </div>
            <p className="mt-0.5 max-w-lg text-[11px] text-muted-foreground">
              {isAr
                ? "أوردراتك تتقفل لوحدها: ضغطة واتساب واحدة في اليوم للشحن، والعميل نفسه يأكد الاستلام."
                : "Your orders close themselves: one WhatsApp tap a day for shipping, and the customer confirms delivery directly."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-2.5">
          <div>
            <Label className="text-xs font-semibold">
              {isAr ? "تفعيل الأوتوبايلوت" : "Enable Autopilot"}
            </Label>
            <p className="text-[10px] text-muted-foreground">
              {isAr
                ? "أوردرات الدفع عند الاستلام المشحونة يدوياً"
                : "Manually-shipped COD orders"}
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(v) => handleUpdate({ enabled: v })}
          />
        </div>
      </div>

      {/* Status tiles */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((c) => (
          <div
            key={c.label}
            className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${c.bg} p-4`}
          >
            <c.icon
              className={`absolute -bottom-2 h-16 w-16 ltr:-right-2 rtl:-left-2 ${c.iconColor}`}
            />
            <p className="relative mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {c.label}
            </p>
            <p className="relative text-2xl font-bold tabular-nums tracking-tight">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* What is stopping it, if anything */}
      {blockers.length > 0 ? (
        <div className="mb-6 space-y-3">
          {blockers.map((text) => (
            <Blocker key={text} text={text} />
          ))}
        </div>
      ) : settings.enabled ? (
        <div className="mb-6 flex gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          <p className="text-xs text-emerald-800 dark:text-emerald-400">
            {isAr
              ? `كل حاجة جاهزة. قايمة الشحن بتوصلك كل يوم الساعة ${fmtHour(settings.digest_hour)}.`
              : `Everything is in place. Your ship digest arrives daily at ${fmtHour(settings.digest_hour)}.`}
          </p>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="space-y-4">
        <TabsList className="h-9 bg-muted/60 p-0.5">
          <TabsTrigger
            value="settings"
            className="h-8 gap-1.5 text-xs data-[state=active]:shadow-sm"
          >
            <Timer className="h-3.5 w-3.5" />
            {isAr ? "الإعدادات" : "Settings"}
          </TabsTrigger>
          <TabsTrigger
            value="attention"
            className="h-8 gap-1.5 text-xs data-[state=active]:shadow-sm"
          >
            <Inbox className="h-3.5 w-3.5" />
            {isAr ? "يحتاج تدخلك" : "Needs attention"}
            {needsAttention > 0 && (
              <span className="ms-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {needsAttention}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="how"
            className="h-8 gap-1.5 text-xs data-[state=active]:shadow-sm"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {isAr ? "بيشتغل إزاي" : "How it works"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <div
            className={`grid gap-4 md:grid-cols-2 ${
              settings.enabled ? "" : "pointer-events-none opacity-50"
            }`}
          >
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
                className="h-9 w-full rounded-lg border bg-background px-3 text-xs"
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
                className="h-9 w-24 rounded-lg border bg-background px-3 text-xs tabular-nums"
              />
            </SettingCard>

            <SettingCard
              title={isAr ? "المحاولات" : "Retries"}
              hint={
                isAr
                  ? "عدد مرات السؤال لكل أوردر وكام يوم بينهم."
                  : "Total asks per order and days between attempts."
              }
            >
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleUpdate({ delivery_check_max_attempts: n })}
                    className={`h-8 w-8 rounded-full text-xs font-semibold transition-colors ${
                      settings.delivery_check_max_attempts === n
                        ? "bg-violet-600 text-white"
                        : "border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {n}
                  </button>
                ))}
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
                  className="h-8 w-16 rounded-lg border bg-background px-2 text-xs tabular-nums"
                />
                <span className="text-[11px] text-muted-foreground">
                  {isAr ? "أيام" : "days"}
                </span>
              </div>
            </SettingCard>

            <SettingCard
              title={isAr ? "مدة الإقفال التلقائي" : "Assumed-delivered window"}
              hint={
                isAr
                  ? "لو مفيش رد خالص، الأوردر يتقفل كمُسلَّم بعد كام يوم من الشحن (٥-٣٠). مش بيتحسب إشارة في شبكة الثقة."
                  : "With zero response, the order closes as delivered this many days after shipping (5-30). Never counted as a trust-network signal."
              }
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  max={30}
                  value={settings.assumed_delivered_days}
                  onChange={(e) =>
                    handleUpdate({ assumed_delivered_days: Number(e.target.value) })
                  }
                  className="h-9 w-24 rounded-lg border bg-background px-3 text-xs tabular-nums"
                />
                {overlapWarning && (
                  <span className="text-[11px] text-amber-600">
                    {isAr
                      ? `لازم تكون أقل من مدة الإرجاع التلقائي (${settings.auto_rto_days} يوم).`
                      : `Should be under your auto-RTO window (${settings.auto_rto_days} days).`}
                  </span>
                )}
              </div>
            </SettingCard>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {isAr
              ? "الرسائل بتتبعت بعد اعتماد قوالب واتساب من Meta، وبتحترم إعدادات إشعارات الواتساب بتاعة متجرك."
              : "Messages only send once the WhatsApp templates are approved by Meta, and respect your store's WhatsApp notification settings."}
          </p>
        </TabsContent>

        <TabsContent value="attention">
          {storeId && (
            <AutopilotExceptions storeId={storeId} isAr={isAr} language={language} />
          )}
        </TabsContent>

        <TabsContent value="how" className="grid gap-3 md:grid-cols-3">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
