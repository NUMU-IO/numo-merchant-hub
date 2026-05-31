import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getByoStatus,
  getWhatsAppAnalytics,
  updateByoNotifications,
  updateWhatsAppSettings,
  type WhatsAppStatus,
  type WhatsAppNotificationSettings,
  type WhatsAppMessageLanguage,
  type WhatsAppAnalytics,
} from "@/services/whatsappApi";
import { listTemplates, type WhatsAppTemplate } from "@/services/templatesApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WhatsAppTemplatePreview } from "@/components/whatsapp/WhatsAppTemplatePreview";
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
  MessageCircle,
  CheckCircle2,
  Send,
  Eye,
  Sparkles,
  Phone,
  Globe,
  Languages,
  ShoppingBag,
  CreditCard,
  Truck,
  PackageCheck,
  ArrowRight,
  Settings2,
  ShieldCheck,
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

export default function WhatsApp() {
  const { currentStore } = useDashboardStore();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const navigate = useNavigate();
  const storeId = currentStore?.id;

  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [analytics, setAnalytics] = useState<WhatsAppAnalytics | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<WhatsAppTemplate | null>(null);

  const loadData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const [statusRes, analyticsRes, templatesRes] = await Promise.allSettled([
      getByoStatus(storeId),
      getWhatsAppAnalytics(storeId, period),
      listTemplates(storeId),
    ]);
    if (statusRes.status === "fulfilled") setStatus(statusRes.value);
    if (analyticsRes.status === "fulfilled") setAnalytics(analyticsRes.value);
    if (templatesRes.status === "fulfilled") setTemplates(templatesRes.value.templates);
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
      await updateByoNotifications(storeId, { [key]: value });
      toast.success(isAr ? "تم الحفظ" : "Saved");
    } catch {
      setStatus({ ...status, notifications: { ...status.notifications, [key]: !value } });
      toast.error(isAr ? "فشل الحفظ" : "Failed to save");
    } finally {
      setSavingKey(null);
    }
  };

  const handleLanguage = async (lang: WhatsAppMessageLanguage) => {
    if (!storeId || !status || status.message_language === lang) return;
    const prev = status.message_language;
    setSavingKey(`lang:${lang}`);
    setStatus({ ...status, message_language: lang });
    try {
      const res = await updateWhatsAppSettings(storeId, { message_language: lang });
      setStatus(res);
      toast.success(isAr ? "تم تحديث لغة الرسائل" : "Message language updated");
    } catch {
      setStatus({ ...status, message_language: prev });
      toast.error(isAr ? "فشل تحديث اللغة" : "Failed to update language");
    } finally {
      setSavingKey(null);
    }
  };

  const connected = status?.connected ?? false;
  const isByo = status?.mode === "byo";

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

  const approvedTemplates = useMemo(
    () => templates.filter((t) => t.status === "APPROVED"),
    [templates]
  );

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
              <MessageCircle className="h-7 w-7 text-white" />
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

        {/* Not-connected explainer */}
        {!connected && (
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
              icon={MessageCircle}
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

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              {isAr ? "الإشعارات التلقائية" : "Automatic notifications"}
            </CardTitle>
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
                      {active && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
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
            {approvedTemplates.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {isAr ? "لا توجد قوالب معتمدة بعد." : "No approved templates yet."}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {approvedTemplates.slice(0, 6).map((t) => (
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
                      <Badge className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px]">
                        {isAr ? "معتمد" : "Approved"}
                      </Badge>
                    </div>
                    <p className="font-medium text-sm truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{templateBody(t)}</p>
                    <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <Eye className="h-3.5 w-3.5" />
                      {isAr ? "معاينة" : "Preview"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connection / BYO entry */}
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
  icon: typeof Send;
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
