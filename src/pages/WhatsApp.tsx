import { useState, useEffect, useCallback, useMemo, useRef, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getByoStatus,
  getWhatsAppAnalytics,
  updateByoNotifications,
  updateWhatsAppSettings,
  listWhatsAppMessages,
  getWhatsAppAccess,
  requestWhatsAppAccess,
  type WhatsAppStatus,
  type WhatsAppNotificationSettings,
  type WhatsAppMessageLanguage,
  type WhatsAppAnalytics,
  type WhatsAppMessageLogItem,
  type WhatsAppAccessState,
} from "@/services/whatsappApi";
import { listTemplates, type WhatsAppTemplate } from "@/services/templatesApi";
import { ApiError } from "@/lib/api-error";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WhatsAppTemplatePreview } from "@/components/whatsapp/WhatsAppTemplatePreview";
import { WhatsAppGlyph } from "@/components/whatsapp/WhatsAppGlyph";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";
import {
  CheckCircle2,
  Send,
  Eye,
  Sparkles,
  Phone,
  Globe,
  Languages,
  ShoppingBag,
  ShoppingCart,
  CreditCard,
  Truck,
  PackageCheck,
  ArrowRight,
  Settings2,
  ShieldCheck,
  Clock,
  Inbox,
  ArrowDownLeft,
  ArrowUpRight,
  Lock,
  Hourglass,
  CircleX,
  Ban,
  LoaderCircle,
} from "lucide-react";

// WhatsApp brand green — used sparingly for the channel identity (hero,
// connected state, "delivered" series). Everything else uses the app's
// neutral design tokens so the page reads as part of the NUMU dashboard.
const WA_GREEN = "#25D366";

const PERIODS: Array<{ key: string; en: string; ar: string }> = [
  { key: "7d", en: "7 days", ar: "٧ أيام" },
  { key: "30d", en: "30 days", ar: "٣٠ يوم" },
  { key: "90d", en: "90 days", ar: "٩٠ يوم" },
];

// The four automated, order-lifecycle notifications a merchant can switch
// on. Keys match WhatsAppNotificationSettings / the backend canonical path
// `store.settings.whatsapp_notifications`.
const NOTIFICATION_EVENTS: Array<{
  key: keyof WhatsAppNotificationSettings;
  en: string;
  ar: string;
  descEn: string;
  descAr: string;
  icon: typeof ShoppingBag;
}> = [
  {
    key: "order_confirmation",
    en: "Order confirmation",
    ar: "تأكيد الطلب",
    descEn: "Sent the moment a customer places an order.",
    descAr: "تُرسل فور قيام العميل بإتمام الطلب.",
    icon: ShoppingBag,
  },
  {
    key: "require_order_confirmation",
    en: "Confirm order in WhatsApp",
    ar: "تأكيد الطلب على واتساب",
    descEn:
      "For COD orders: ask the customer to tap Confirm. The order is held until they do. Replaces the order-confirmation notice for COD.",
    descAr:
      "لطلبات الدفع عند الاستلام: اطلب من العميل الضغط على تأكيد، ويبقى الطلب معلقاً حتى يؤكده. يحل محل رسالة تأكيد الطلب لطلبات الدفع عند الاستلام.",
    icon: ShieldCheck,
  },
  {
    key: "payment_received",
    en: "Payment received",
    ar: "تأكيد الدفع",
    descEn: "Sent when an order's payment is confirmed.",
    descAr: "تُرسل عند تأكيد دفع الطلب.",
    icon: CreditCard,
  },
  {
    key: "shipping_update",
    en: "Shipping update",
    ar: "تحديث الشحن",
    descEn: "Sent with the tracking number when the order ships.",
    descAr: "تُرسل مع رقم التتبع عند شحن الطلب.",
    icon: Truck,
  },
  {
    key: "delivery_confirmation",
    en: "Delivery confirmation",
    ar: "تأكيد التسليم",
    descEn: "Sent once the order is marked delivered.",
    descAr: "تُرسل عند تسليم الطلب.",
    icon: PackageCheck,
  },
  {
    key: "abandoned_cart",
    en: "Abandoned cart",
    ar: "السلة المتروكة",
    descEn: "Recover carts customers left without paying. Send instantly from the Abandoned checkouts page.",
    descAr: "استرجع السلات التي تركها العملاء دون دفع. أرسل فوراً من صفحة السلات المتروكة.",
    icon: ShoppingCart,
  },
];

const LANGUAGE_OPTIONS: Array<{
  key: WhatsAppMessageLanguage;
  en: string;
  ar: string;
  subEn: string;
  subAr: string;
}> = [
  { key: "auto", en: "Auto", ar: "تلقائي", subEn: "Follow store language", subAr: "حسب لغة المتجر" },
  { key: "ar", en: "Arabic", ar: "العربية", subEn: "Always Arabic", subAr: "دائماً بالعربية" },
  { key: "en", en: "English", ar: "الإنجليزية", subEn: "Always English", subAr: "دائماً بالإنجليزية" },
];

// Short body preview — the first BODY component's text.
function templateBody(t: WhatsAppTemplate): string {
  const body = t.components?.find((c) => c.type === "BODY");
  return body?.text || "";
}

// Compact "time ago" label for the recent-messages list. Falls back to
// a localized date once a message is older than a day.
function timeAgo(iso: string | null, isAr: boolean): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return isAr ? "الآن" : "now";
  if (mins < 60) return isAr ? `${mins} د` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isAr ? `${hrs} س` : `${hrs}h`;
  return new Date(iso).toLocaleDateString(isAr ? "ar-EG" : "en-US", {
    day: "numeric",
    month: "short",
  });
}

// "order_confirmation_v2" → "Order confirmation v2" — a readable label
// for a sent template message when it carried no inline content.
function humanizeTemplate(name: string): string {
  const cleaned = name.replace(/_/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// Delivery-status pill for a row in the recent-messages feed. Only the
// states worth calling out get a badge; plain "sent"/"queued" stay
// unbadged to keep the list calm.
function messageStatusStyle(
  status: string,
  isAr: boolean
): { label: string; cls: string } | null {
  switch (status) {
    case "read":
      return {
        label: isAr ? "قُرئت" : "Read",
        cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
      };
    case "delivered":
      return {
        label: isAr ? "وصلت" : "Delivered",
        cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
      };
    case "failed":
      return {
        label: isAr ? "فشلت" : "Failed",
        cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
      };
    default:
      return null;
  }
}

// Status badge colour + label for a template across its Meta lifecycle.
function templateStatusStyle(status: string, isAr: boolean): { label: string; cls: string } {
  const s = status.toUpperCase();
  if (s === "APPROVED")
    return {
      label: isAr ? "معتمد" : "Approved",
      cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    };
  if (s === "REJECTED")
    return {
      label: isAr ? "مرفوض" : "Rejected",
      cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    };
  return {
    label: isAr ? "قيد المراجعة" : "Pending",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  };
}

export default function WhatsApp() {
  const { currentStore } = useDashboardStore();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const navigate = useNavigate();
  const storeId = currentStore?.id;

  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  // Platform access-gate state (request → approve). Until status is
  // "approved" the connect + notifications endpoints 403, so the UI hides
  // those and shows the access-gate panel instead.
  const [access, setAccess] = useState<WhatsAppAccessState | null>(null);
  const [analytics, setAnalytics] = useState<WhatsAppAnalytics | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessageLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  // Briefly marks a row as just-persisted so the merchant gets a visible
  // "Saved ✓" confirmation that the change reached the backend (the toast
  // is transient and easy to miss).
  const [savedKey, setSavedKey] = useState<string | null>(null);
  // Session-scoped time of the last successful settings save — a durable
  // "saved just now" reassurance. Not persisted server-side; resets on
  // reload (the authoritative proof is that the toggles come back set).
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<WhatsAppTemplate | null>(null);
  // Editable draft for the COD confirm-order delay. Stored server-side as a
  // single minutes value; the UI lets the merchant pick minutes or hours.
  const [delayValue, setDelayValue] = useState<number>(30);
  const [delayUnitHours, setDelayUnitHours] = useState<boolean>(false);

  const flashSaved = useCallback((key: string) => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSavedKey(key);
    setLastSavedAt(new Date());
    savedTimer.current = setTimeout(() => setSavedKey(null), 2500);
  }, []);

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  const loadData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const [statusRes, analyticsRes, templatesRes, messagesRes, accessRes] = await Promise.allSettled([
      getByoStatus(storeId),
      getWhatsAppAnalytics(storeId, period),
      listTemplates(storeId),
      listWhatsAppMessages(storeId, { limit: 8 }),
      getWhatsAppAccess(storeId),
    ]);
    if (statusRes.status === "fulfilled") setStatus(statusRes.value);
    if (analyticsRes.status === "fulfilled") setAnalytics(analyticsRes.value);
    if (templatesRes.status === "fulfilled") setTemplates(templatesRes.value.templates);
    if (messagesRes.status === "fulfilled") setMessages(messagesRes.value.messages);
    if (accessRes.status === "fulfilled") setAccess(accessRes.value);
    if (statusRes.status === "rejected" && analyticsRes.status === "rejected") {
      toast.error(isAr ? "فشل تحميل بيانات واتساب" : "Failed to load WhatsApp data");
    }
    setLoading(false);
  }, [storeId, period, isAr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggle = async (key: keyof WhatsAppNotificationSettings, value: boolean) => {
    if (!storeId || !status) return;
    setSavingKey(key);
    setStatus({ ...status, notifications: { ...status.notifications, [key]: value } });
    try {
      // The PATCH returns the full, server-persisted notification set —
      // reconcile against it instead of trusting the optimistic flip, so
      // the switch reflects exactly what's now in the backend.
      const saved = await updateByoNotifications(storeId, { [key]: value });
      setStatus((s) => (s ? { ...s, notifications: { ...s.notifications, ...saved } } : s));
      flashSaved(key);
    } catch {
      setStatus({ ...status, notifications: { ...status.notifications, [key]: !value } });
      toast.error(isAr ? "فشل الحفظ" : "Failed to save");
    } finally {
      setSavingKey(null);
    }
  };

  // Mirror the persisted delay into the editable draft whenever it changes
  // (initial load + after a save). Only re-derives when a delay is set so
  // it doesn't clobber the merchant's in-progress edit before they apply.
  const confirmDelayMinutes = status?.confirm_order_delay_minutes ?? 0;
  useEffect(() => {
    if (confirmDelayMinutes > 0) {
      if (confirmDelayMinutes % 60 === 0) {
        setDelayUnitHours(true);
        setDelayValue(confirmDelayMinutes / 60);
      } else {
        setDelayUnitHours(false);
        setDelayValue(confirmDelayMinutes);
      }
    }
  }, [confirmDelayMinutes]);

  const saveConfirmDelay = async (minutes: number) => {
    if (!storeId || !status) return;
    const prev = status.confirm_order_delay_minutes;
    if (prev === minutes) return;
    setSavingKey("confirm_delay");
    setStatus({ ...status, confirm_order_delay_minutes: minutes });
    try {
      const res = await updateWhatsAppSettings(storeId, {
        confirm_order_delay_minutes: minutes,
      });
      setStatus(res);
      flashSaved("confirm_delay");
    } catch {
      setStatus({ ...status, confirm_order_delay_minutes: prev });
      toast.error(isAr ? "فشل الحفظ" : "Failed to save");
    } finally {
      setSavingKey(null);
    }
  };

  // Apply the current draft (value + unit) as a minutes total.
  const applyDelayDraft = () => {
    const v = Math.max(1, Math.floor(delayValue || 0));
    saveConfirmDelay(delayUnitHours ? v * 60 : v);
  };

  const handleLanguage = async (lang: WhatsAppMessageLanguage) => {
    if (!storeId || !status || status.message_language === lang) return;
    const prev = status.message_language;
    setSavingKey(`lang:${lang}`);
    setStatus({ ...status, message_language: lang });
    try {
      const res = await updateWhatsAppSettings(storeId, { message_language: lang });
      setStatus(res);
      flashSaved(`lang:${lang}`);
    } catch {
      setStatus({ ...status, message_language: prev });
      toast.error(isAr ? "فشل تحديث اللغة" : "Failed to update language");
    } finally {
      setSavingKey(null);
    }
  };

  const connected = status?.connected ?? false;
  const isByo = status?.mode === "byo";
  // The platform gate that sits ABOVE `connected`: a store can only connect
  // a number / switch on notifications once an admin has approved access.
  const approved = access?.status === "approved";

  const fmtNum = (n: number) => new Intl.NumberFormat(isAr ? "ar-EG" : "en-US").format(n);

  const chartData = useMemo(
    () =>
      (analytics?.daily_stats ?? []).map((d) => ({
        date: d.date.slice(5),
        sent: d.sent,
        delivered: d.delivered,
      })),
    [analytics]
  );

  // Show every template the store has, not only Meta-APPROVED ones —
  // a merchant who created/submitted templates expects to see them here
  // (with their real status) rather than an empty card. Approved first,
  // then pending, then rejected.
  const visibleTemplates = useMemo(() => {
    const rank = (s: string) =>
      s.toUpperCase() === "APPROVED" ? 0 : s.toUpperCase() === "REJECTED" ? 2 : 1;
    return [...templates].sort((a, b) => rank(a.status) - rank(b.status));
  }, [templates]);

  if (loading) {
    return (
      <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <>
      <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto" dir={dir}>
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-50 to-teal-50/40 dark:from-emerald-950/30 dark:to-teal-950/10 p-6 md:p-8">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-5">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm"
              style={{ backgroundColor: WA_GREEN }}
            >
              <WhatsAppGlyph className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {isAr ? "واتساب للأعمال" : "WhatsApp Business"}
                </h1>
                {connected ? (
                  <Badge className="gap-1 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {isByo
                      ? isAr
                        ? "متصل برقمك"
                        : "Your number"
                      : isAr
                      ? "مفعّل عبر NUMU"
                      : "Live via NUMU"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    {isAr ? "غير مفعّل" : "Not active"}
                  </Badge>
                )}
              </div>
              <p className="mt-1.5 text-sm md:text-base text-muted-foreground max-w-2xl">
                {isAr
                  ? "أبلغ عملاءك تلقائياً بكل خطوة في طلبهم عبر واتساب — تأكيد الطلب، الدفع، الشحن، والتسليم. تصل الرسائل من رقم NUMU الموثّق دون أي إعداد."
                  : "Automatically keep customers updated at every step on WhatsApp — order, payment, shipping and delivery. Messages go out from NUMU's verified number with zero setup."}
              </p>
            </div>
          </div>
        </div>

        {/* Platform access gate — shown until an admin approves WhatsApp
            access. It stands in for the connection + notifications cards,
            which stay hidden while unapproved so the merchant can't trigger
            a backend 403. */}
        {access && !approved && storeId && (
          <WhatsAppAccessGate
            access={access}
            isAr={isAr}
            storeId={storeId}
            onChange={setAccess}
          />
        )}

        {/* Not-connected explainer — only meaningful once access is granted */}
        {approved && !connected && (
          <Card className="border-emerald-200 dark:border-emerald-900/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 mt-0.5 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="font-semibold">
                    {isAr ? "واتساب غير مُعدّ لهذا المتجر بعد" : "WhatsApp isn't set up for this store yet"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isAr
                      ? "بمجرد تفعيل رقم NUMU المشترك، يمكنك تشغيل الإشعارات أدناه فوراً — أو اربط رقم واتساب الخاص بك."
                      : "Once the shared NUMU number is enabled, switch on the notifications below — or connect your own WhatsApp number."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analytics */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{isAr ? "الأداء" : "Performance"}</h2>
            <div className="inline-flex rounded-lg border bg-card p-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    period === p.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isAr ? p.ar : p.en}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={isAr ? "أُرسلت" : "Sent"} value={fmtNum(analytics?.total_sent ?? 0)} icon={Send} tone="default" />
            <StatCard
              label={isAr ? "وصلت" : "Delivered"}
              value={fmtNum(analytics?.total_delivered ?? 0)}
              icon={CheckCircle2}
              tone="success"
              sub={analytics ? `${analytics.delivery_rate}%` : undefined}
            />
            <StatCard
              label={isAr ? "قُرئت" : "Read"}
              value={fmtNum(analytics?.total_read ?? 0)}
              icon={Eye}
              tone="info"
              sub={analytics ? `${analytics.read_rate}%` : undefined}
            />
            <StatCard
              label={isAr ? "محادثات نشطة" : "Active chats"}
              value={fmtNum(analytics?.active_conversations ?? 0)}
              icon={WhatsAppGlyph}
              tone="default"
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isAr ? "الرسائل اليومية" : "Daily messages"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                  {isAr ? "لا توجد بيانات بعد لهذه الفترة" : "No data yet for this period"}
                </div>
              ) : (
                <div className="h-56" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <RechartsTooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--popover))",
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="sent" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="delivered" fill={WA_GREEN} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent messages — live feed of what's actually been sent to /
            received from this store's customers on WhatsApp. */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <WhatsAppGlyph className="h-4 w-4" style={{ color: WA_GREEN }} />
                  {isAr ? "أحدث الرسائل" : "Recent messages"}
                </CardTitle>
                <CardDescription>
                  {isAr
                    ? "آخر الرسائل المُرسلة والمستلمة عبر واتساب لهذا المتجر."
                    : "The latest messages sent to and received from this store's customers."}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 shrink-0"
                onClick={() => navigate("/whatsapp/inbox")}
              >
                {isAr ? "صندوق الوارد" : "Open inbox"}
                <ArrowRight className={`h-4 w-4 ${isAr ? "rotate-180" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-2 text-center">
                <Inbox className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {isAr ? "لا توجد رسائل بعد." : "No messages yet."}
                </p>
              </div>
            ) : (
              <div className="divide-y rounded-xl border">
                {messages.map((m) => {
                  const outbound = m.direction === "outbound";
                  const DirIcon = outbound ? ArrowUpRight : ArrowDownLeft;
                  const st = messageStatusStyle(m.status, isAr);
                  const preview =
                    m.content ||
                    (m.template_name
                      ? humanizeTemplate(m.template_name)
                      : isAr
                      ? "بدون معاينة"
                      : "No preview");
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => navigate("/whatsapp/inbox")}
                      className="flex w-full items-center gap-3 p-3.5 text-start transition-colors hover:bg-muted/40"
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          outbound
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-muted text-foreground/70"
                        }`}
                      >
                        <DirIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm truncate" dir="ltr">
                            {m.phone}
                          </p>
                          {st && (
                            <Badge className={`border-0 text-[10px] px-1.5 py-0 h-4 ${st.cls}`}>
                              {st.label}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{preview}</p>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                        {timeAgo(m.created_at, isAr)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications — only once WhatsApp access is approved */}
        {approved && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                {isAr ? "الإشعارات التلقائية" : "Automatic notifications"}
              </CardTitle>
              {lastSavedAt && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {isAr ? "حُفظ " : "Saved "}
                  {lastSavedAt.toLocaleTimeString(isAr ? "ar-EG" : "en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
            <CardDescription>
              {isAr
                ? "اختر أي رسائل تُرسَل لعملائك تلقائياً عند كل خطوة في الطلب."
                : "Choose which messages go to customers automatically at each order step."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {NOTIFICATION_EVENTS.map((evt) => {
              const Icon = evt.icon;
              const enabled = status?.notifications?.[evt.key] ?? false;
              return (
                <div
                  key={evt.key}
                  className="flex items-center gap-4 rounded-xl border p-3.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-5 w-5 text-foreground/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{isAr ? evt.ar : evt.en}</p>
                    <p className="text-xs text-muted-foreground">{isAr ? evt.descAr : evt.descEn}</p>
                  </div>
                  {savingKey === evt.key ? (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {isAr ? "جارٍ الحفظ…" : "Saving…"}
                    </span>
                  ) : savedKey === evt.key ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isAr ? "تم الحفظ" : "Saved"}
                    </span>
                  ) : null}
                  <Switch
                    checked={enabled}
                    disabled={!connected || savingKey === evt.key}
                    onCheckedChange={(v) => handleToggle(evt.key, v)}
                  />
                </div>
              );
            })}
            {!connected && (
              <p className="text-xs text-muted-foreground pt-1">
                {isAr ? "فعّل واتساب أولاً لتشغيل الإشعارات." : "Connect WhatsApp first to switch these on."}
              </p>
            )}
          </CardContent>
        </Card>
        )}

        {/* Confirm-order timing — only relevant when the feature is on */}
        {connected && status?.notifications?.require_order_confirmation && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-emerald-600" />
                {isAr ? "توقيت رسالة التأكيد" : "Confirmation timing"}
              </CardTitle>
              <CardDescription>
                {isAr
                  ? "متى تُرسل رسالة «تأكيد الطلب» إلى العميل بعد إنشاء الطلب؟"
                  : "When should the “confirm order” request be sent after an order is placed?"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => saveConfirmDelay(0)}
                  disabled={savingKey === "confirm_delay"}
                  className={`flex flex-col items-start gap-0.5 rounded-xl border p-4 text-start transition-all disabled:opacity-60 ${
                    confirmDelayMinutes === 0
                      ? "border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "hover:border-foreground/20 hover:bg-muted/40"
                  }`}
                >
                  <span className="font-semibold text-sm">
                    {isAr ? "فوراً" : "Immediately"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {isAr ? "تُرسل لحظة إنشاء الطلب" : "Sent the moment the order is placed"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmDelayMinutes === 0) {
                      saveConfirmDelay(delayUnitHours ? delayValue * 60 : delayValue);
                    }
                  }}
                  disabled={savingKey === "confirm_delay"}
                  className={`flex flex-col items-start gap-0.5 rounded-xl border p-4 text-start transition-all disabled:opacity-60 ${
                    confirmDelayMinutes > 0
                      ? "border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "hover:border-foreground/20 hover:bg-muted/40"
                  }`}
                >
                  <span className="font-semibold text-sm">
                    {isAr ? "بعد فترة" : "After a delay"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {isAr ? "أمهل العميل بعض الوقت" : "Give the customer some time first"}
                  </span>
                </button>
              </div>
              {confirmDelayMinutes > 0 && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={delayValue}
                    onChange={(e) => setDelayValue(Number(e.target.value))}
                    onBlur={applyDelayDraft}
                    disabled={savingKey === "confirm_delay"}
                    aria-label={isAr ? "مدة التأخير" : "Delay amount"}
                    title={isAr ? "مدة التأخير" : "Delay amount"}
                    className="h-9 w-24 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <select
                    value={delayUnitHours ? "hours" : "minutes"}
                    onChange={(e) => {
                      const hours = e.target.value === "hours";
                      setDelayUnitHours(hours);
                      const v = Math.max(1, Math.floor(delayValue || 0));
                      saveConfirmDelay(hours ? v * 60 : v);
                    }}
                    disabled={savingKey === "confirm_delay"}
                    aria-label={isAr ? "وحدة التأخير" : "Delay unit"}
                    title={isAr ? "وحدة التأخير" : "Delay unit"}
                    className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="minutes">{isAr ? "دقيقة" : "minutes"}</option>
                    <option value="hours">{isAr ? "ساعة" : "hours"}</option>
                  </select>
                  {savingKey === "confirm_delay" ? (
                    <span className="text-xs text-muted-foreground">
                      {isAr ? "جارٍ الحفظ…" : "Saving…"}
                    </span>
                  ) : savedKey === "confirm_delay" ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isAr ? "تم الحفظ" : "Saved"}
                    </span>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Language */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Languages className="h-4 w-4 text-emerald-600" />
              {isAr ? "لغة الرسائل" : "Message language"}
            </CardTitle>
            <CardDescription>
              {isAr
                ? "بأي لغة تصل الإشعارات التلقائية إلى عملائك؟"
                : "Which language should automatic notifications be sent in?"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {LANGUAGE_OPTIONS.map((opt) => {
                const active = (status?.message_language ?? "auto") === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleLanguage(opt.key)}
                    disabled={!status || savingKey === `lang:${opt.key}`}
                    className={`flex flex-col items-start gap-0.5 rounded-xl border p-4 text-start transition-all disabled:opacity-60 ${
                      active
                        ? "border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                        : "hover:border-foreground/20 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-semibold text-sm">{isAr ? opt.ar : opt.en}</span>
                      {savingKey === `lang:${opt.key}` ? (
                        <span className="text-[11px] text-muted-foreground">
                          {isAr ? "جارٍ الحفظ…" : "Saving…"}
                        </span>
                      ) : active && savedKey === `lang:${opt.key}` ? (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {isAr ? "تم الحفظ" : "Saved"}
                        </span>
                      ) : (
                        active && <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{isAr ? opt.subAr : opt.subEn}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Templates preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="h-4 w-4 text-emerald-600" />
                  {isAr ? "معاينة القوالب" : "Message previews"}
                </CardTitle>
                <CardDescription>
                  {isAr ? "هكذا تظهر رسائلك على واتساب العميل." : "Exactly how your messages land on a customer's WhatsApp."}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 shrink-0"
                onClick={() => navigate("/channels/whatsapp/templates")}
              >
                {isAr ? "كل القوالب" : "All templates"}
                <ArrowRight className={`h-4 w-4 ${isAr ? "rotate-180" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {visibleTemplates.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {isAr ? "لم تُرسل أي قوالب إلى Meta بعد." : "No templates submitted to Meta yet."}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {visibleTemplates.slice(0, 6).map((t) => {
                  const st = templateStatusStyle(t.status, isAr);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPreviewTemplate(t)}
                      className="group flex flex-col gap-2 rounded-xl border p-4 text-start transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.language}
                        </span>
                        <Badge className={`border-0 text-[10px] ${st.cls}`}>{st.label}</Badge>
                      </div>
                      <p className="font-medium text-sm truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{templateBody(t)}</p>
                      <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <Eye className="h-3.5 w-3.5" />
                        {isAr ? "معاينة" : "Preview"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connection / BYO entry — hidden until WhatsApp access is approved */}
        {approved && (
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                {isByo ? <Phone className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">
                    {isByo
                      ? isAr
                        ? "متصل برقم واتساب الخاص بك"
                        : "Connected with your own WhatsApp number"
                      : isAr
                      ? "تستخدم رقم NUMU المشترك"
                      : "Using the shared NUMU number"}
                  </p>
                  {isByo && <ShieldCheck className="h-4 w-4 text-emerald-600" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isByo
                    ? status?.display_phone_number || status?.phone_display_name || ""
                    : isAr
                    ? "مناسب لمعظم المتاجر. تريد رقمك الخاص وعلامتك التجارية؟ اربط حساب Meta WABA."
                    : "Great for most stores. Want your own branded number? Connect your Meta WABA."}
                </p>
              </div>
              <Button
                variant={isByo ? "outline" : "default"}
                className="gap-1.5 shrink-0"
                onClick={() => navigate("/whatsapp/byo")}
              >
                <Settings2 className="h-4 w-4" />
                {isByo
                  ? isAr
                    ? "إدارة الاتصال"
                    : "Manage connection"
                  : isAr
                  ? "استخدم رقمك الخاص"
                  : "Use your own number"}
                <ArrowRight className={`h-4 w-4 ${isAr ? "rotate-180" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>
        )}
      </div>

      {previewTemplate && (
        <WhatsAppTemplatePreview
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          isAr={isAr}
        />
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  sub,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  tone: "default" | "success" | "info";
  sub?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
      : tone === "info"
      ? "text-sky-600 bg-sky-50 dark:bg-sky-950/30"
      : "text-foreground/70 bg-muted";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>
            <Icon className="h-4 w-4" />
          </span>
          {sub && <span className="text-xs font-medium text-muted-foreground">{sub}</span>}
        </div>
        <p className="mt-3 text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

// Expected-volume buckets for the access request. The stored value is the
// English label (self-describing for the admin who reviews the request);
// the Arabic string is display-only.
const VOLUME_OPTIONS: Array<{ value: string; en: string; ar: string }> = [
  { value: "", en: "Select an estimate…", ar: "اختر تقديراً…" },
  { value: "Under 500 / month", en: "Under 500 / month", ar: "أقل من ٥٠٠ شهرياً" },
  { value: "500–2,000 / month", en: "500–2,000 / month", ar: "٥٠٠–٢٠٠٠ شهرياً" },
  { value: "2,000–10,000 / month", en: "2,000–10,000 / month", ar: "٢٠٠٠–١٠٠٠٠ شهرياً" },
  { value: "10,000+ / month", en: "10,000+ / month", ar: "أكثر من ١٠٠٠٠ شهرياً" },
];

// Static Tailwind class sets per tone — declared in full so the classes
// survive Tailwind's content scan (no dynamic class-name construction).
const ACCESS_TONE = {
  emerald: {
    card: "border-emerald-200 dark:border-emerald-900/50",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  amber: {
    card: "border-amber-200 dark:border-amber-900/50",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  rose: {
    card: "border-rose-200 dark:border-rose-900/50",
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  },
} as const;

// The access-gate panel. Stands in for the connection + notifications cards
// until a platform admin approves the store's WhatsApp access. Covers all
// four non-approved states and, when the store `can_request`, a short
// request form (use-case note + optional contact phone + expected volume).
function WhatsAppAccessGate({
  access,
  isAr,
  storeId,
  onChange,
}: {
  access: WhatsAppAccessState;
  isAr: boolean;
  storeId: string;
  onChange: (a: WhatsAppAccessState) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [expectedVolume, setExpectedVolume] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const status = access.status;
  const canRequest = access.can_request;

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(isAr ? "ar-EG" : "en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";

  const submit = async () => {
    setSubmitting(true);
    try {
      const updated = await requestWhatsAppAccess(storeId, {
        note: note.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        expected_volume: expectedVolume || undefined,
      });
      toast.success(isAr ? "تم إرسال طلبك للمراجعة" : "Access request sent for review");
      setShowForm(false);
      onChange(updated); // optimistic → pending, straight from the server's response
    } catch (err) {
      // The store's status changed out from under us (already pending /
      // approved / disabled): explain, then re-sync to the true state.
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        (err.body as { detail?: { code?: string } } | null)?.detail?.code ===
          "whatsapp_access_not_requestable"
      ) {
        toast.error(
          isAr
            ? "تعذّر إرسال الطلب في الحالة الحالية. يتم تحديث الحالة."
            : "This request can't be submitted right now. Refreshing status."
        );
        try {
          onChange(await getWhatsAppAccess(storeId));
        } catch {
          /* keep the current view if the refresh also fails */
        }
        return;
      }
      toast.error(isAr ? "فشل إرسال الطلب" : "Failed to send request");
    } finally {
      setSubmitting(false);
    }
  };

  const tone =
    status === "pending" ? "amber" : status === "none" ? "emerald" : "rose";
  const t = ACCESS_TONE[tone];
  const HeaderIcon =
    status === "pending"
      ? Hourglass
      : status === "rejected"
      ? CircleX
      : status === "disabled"
      ? Ban
      : Lock;

  const title =
    status === "pending"
      ? isAr
        ? "طلبك قيد المراجعة"
        : "Your request is under review"
      : status === "rejected"
      ? isAr
        ? "لم تتم الموافقة على الطلب"
        : "Access request not approved"
      : status === "disabled"
      ? isAr
        ? "تم إيقاف تفعيل واتساب"
        : "WhatsApp access disabled"
      : isAr
      ? "فعِّل واتساب لأعمالك"
      : "Enable WhatsApp for your store";

  const blurb =
    status === "pending"
      ? isAr
        ? "شكراً لك! يراجع فريق NUMU طلب تفعيل واتساب لمتجرك، وسيُفعَّل هنا فور الموافقة — عادةً خلال يوم عمل واحد."
        : "Thanks! The NUMU team is reviewing your WhatsApp access request. We'll switch it on here as soon as it's approved — usually within one business day."
      : status === "disabled"
      ? isAr
        ? "قام أحد مسؤولي NUMU بإيقاف تفعيل واتساب لهذا المتجر. تواصل مع الدعم إن كنت تعتقد أن هذا خطأ."
        : "A NUMU admin has turned off WhatsApp access for this store. Contact support if you think this is a mistake."
      : status === "rejected"
      ? isAr
        ? "لم تتم الموافقة على طلب تفعيل واتساب هذه المرة. راجع السبب أدناه، ويمكنك إرسال الطلب من جديد."
        : "Your WhatsApp access request wasn't approved this time. Review the reason below — you're welcome to request again."
      : isAr
      ? "يجب أن يفعّل فريق NUMU واتساب للأعمال لمتجرك قبل أن تتمكن من ربط رقم أو تشغيل الإشعارات التلقائية. أخبرنا كيف تنوي استخدامه وسنراجع طلبك."
      : "The NUMU team needs to enable WhatsApp Business for your store before you can connect a number or switch on automatic notifications. Tell us how you plan to use it and we'll review your request.";

  const optionalLabel = isAr ? " (اختياري)" : " (optional)";

  return (
    <Card className={t.card}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${t.icon}`}
          >
            <HeaderIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="font-semibold text-base">{title}</h3>
            <p className="text-sm text-muted-foreground max-w-2xl">{blurb}</p>

            {status === "pending" && access.requested_at && (
              <p className="text-xs text-muted-foreground pt-1">
                {isAr ? "أُرسل الطلب في " : "Requested on "}
                {fmtDate(access.requested_at)}
              </p>
            )}

            {(status === "rejected" || status === "disabled") &&
              access.review_reason && (
                <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
                  <span className="font-medium">{isAr ? "السبب: " : "Reason: "}</span>
                  {access.review_reason}
                </div>
              )}
          </div>
        </div>

        {canRequest && (
          <div className="mt-5">
            {!showForm ? (
              <Button className="gap-1.5" onClick={() => setShowForm(true)}>
                <Send className="h-4 w-4" />
                {status === "rejected"
                  ? isAr
                    ? "إرسال الطلب من جديد"
                    : "Request again"
                  : isAr
                  ? "طلب تفعيل واتساب"
                  : "Request access"}
              </Button>
            ) : (
              <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                <div className="space-y-1.5">
                  <label htmlFor="wa-access-note" className="text-sm font-medium">
                    {isAr ? "كيف ستستخدم واتساب؟" : "How will you use WhatsApp?"}
                    <span className="font-normal text-muted-foreground">{optionalLabel}</span>
                  </label>
                  <textarea
                    id="wa-access-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    disabled={submitting}
                    placeholder={
                      isAr
                        ? "مثال: إرسال تأكيدات الطلب وتحديثات الشحن لعملائنا."
                        : "e.g. Send order confirmations and shipping updates to our customers."
                    }
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="wa-access-phone" className="text-sm font-medium">
                      {isAr ? "رقم للتواصل" : "Contact phone"}
                      <span className="font-normal text-muted-foreground">{optionalLabel}</span>
                    </label>
                    <input
                      id="wa-access-phone"
                      type="tel"
                      dir="ltr"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      disabled={submitting}
                      placeholder="+20 100 000 0000"
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="wa-access-volume" className="text-sm font-medium">
                      {isAr ? "عدد الرسائل الشهري المتوقع" : "Expected monthly messages"}
                      <span className="font-normal text-muted-foreground">{optionalLabel}</span>
                    </label>
                    <select
                      id="wa-access-volume"
                      value={expectedVolume}
                      onChange={(e) => setExpectedVolume(e.target.value)}
                      disabled={submitting}
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {VOLUME_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {isAr ? o.ar : o.en}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button className="gap-1.5" onClick={submit} disabled={submitting}>
                    {submitting ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {isAr ? "إرسال الطلب" : "Submit request"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowForm(false)}
                    disabled={submitting}
                  >
                    {isAr ? "إلغاء" : "Cancel"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
