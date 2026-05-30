import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  MessageSquare,
  Phone,
  Zap,
  TrendingUp,
  Send,
  CheckCheck,
  Eye,
  AlertCircle,
  Unplug,
  RefreshCw,
  ShoppingCart,
  Truck,
  Package,
  CreditCard,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { listTemplates, type WhatsAppTemplate } from "@/services/templatesApi";
import { WhatsAppTemplatePreview } from "@/components/whatsapp/WhatsAppTemplatePreview";
import {
  getWhatsAppStatus,
  getSignupConfig,
  completeSignup,
  disconnectWhatsApp,
  getNotificationSettings,
  updateNotificationSettings,
  getWhatsAppAnalytics,
  type WhatsAppConnectionStatus,
  type NotificationSettings,
  type WhatsAppAnalytics as AnalyticsType,
} from "@/services/whatsappApi";

declare global {
  interface Window {
    FB?: {
      init: (config: Record<string, unknown>) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } }) => void,
        config: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export default function WhatsApp() {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";
  const storeId = currentStore?.id;

  const [status, setStatus] = useState<WhatsAppConnectionStatus | null>(null);
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsType | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [previewTemplate, setPreviewTemplate] = useState<WhatsAppTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  // Templates is the suite's "what you're getting" view — make it the
  // landing tab so merchants immediately see the WhatsApp messages
  // their customers will receive, with previews.
  const [tab, setTab] = useState("templates");

  const loadData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      // Templates load is best-effort — the page still works without
      // them (the Notifications + Analytics tabs don't need them).
      const [statusRes, notifsRes, analyticsRes, templatesRes] = await Promise.all([
        getWhatsAppStatus(storeId),
        getNotificationSettings(storeId),
        getWhatsAppAnalytics(storeId, "30d"),
        listTemplates(storeId, undefined, 50).catch(() => ({
          templates: [] as WhatsAppTemplate[],
          next_cursor: null,
        })),
      ]);
      setStatus(statusRes.data);
      setNotifications(notifsRes.data);
      setAnalytics(analyticsRes.data);
      setTemplates(templatesRes?.templates ?? []);
    } catch {
      toast.error(isAr ? "فشل تحميل بيانات واتساب" : "Failed to load WhatsApp data");
    } finally {
      setLoading(false);
    }
  }, [storeId, isAr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConnect = async () => {
    if (!storeId) return;
    setConnecting(true);
    try {
      const config = await getSignupConfig(storeId);
      if (!config.app_id) {
        toast.error(isAr ? "ربط واتساب غير متاح حالياً" : "WhatsApp connection not available yet");
        return;
      }

      // Load Facebook SDK
      if (!window.FB) {
        await new Promise<void>((resolve) => {
          window.fbAsyncInit = () => {
            window.FB!.init({
              appId: config.app_id,
              cookie: true,
              xfbml: false,
              version: "v18.0",
            });
            resolve();
          };
          const script = document.createElement("script");
          script.src = "https://connect.facebook.net/en_US/sdk.js";
          script.async = true;
          document.body.appendChild(script);
        });
      }

      // Trigger embedded signup.
      //
      // FB.login validates the callback shape with
      //   typeof callback === 'function'
      // and explicitly rejects async functions with
      //   `Expression is of type asyncfunction, not function`.
      // (async functions ARE functions but typeof returns "asyncfunction"
      // in their internal check.) We pass a SYNC callback that fires the
      // async post-processing via a fire-and-forget IIFE — same UX, but
      // the SDK accepts it.
      window.FB!.login(
        (response) => {
          void (async () => {
            const code = response.authResponse?.code;
            if (!code) {
              toast.error(isAr ? "تم إلغاء الربط" : "Connection cancelled");
              setConnecting(false);
              return;
            }
            try {
              const result = await completeSignup(storeId, code);
              // apiClient unwraps `{ data: T }` to T — same drop-`.data`
              // pattern as elsewhere in this file.
              if (result?.connected) {
                toast.success(
                  isAr
                    ? `تم ربط واتساب بنجاح! ${result.phone_number || ""}`
                    : `WhatsApp connected! ${result.phone_number || ""}`
                );
                loadData();
              }
            } catch (err) {
              console.error("[whatsapp-connect/complete]", err);
              toast.error(isAr ? "فشل ربط واتساب" : "Failed to connect WhatsApp");
            } finally {
              setConnecting(false);
            }
          })();
        },
        {
          // apiClient already unwraps `{ data: T }` to T, so config_id
          // sits directly on `config`.
          config_id: config.config_id,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: "",
            sessionInfoVersion: 2,
          },
        }
      );
    } catch (err) {
      // Surface the actual error class in the console so future debugs
      // don't get stuck on a generic toast.
      console.error("[whatsapp-connect]", err);
      toast.error(isAr ? "خطأ في التحميل" : "Failed to load signup config");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!storeId || !confirm(isAr ? "هل أنت متأكد من فصل واتساب؟" : "Disconnect WhatsApp?"))
      return;
    try {
      await disconnectWhatsApp(storeId);
      toast.success(isAr ? "تم فصل واتساب" : "WhatsApp disconnected");
      loadData();
    } catch {
      toast.error(isAr ? "فشل فصل واتساب" : "Failed to disconnect");
    }
  };

  const handleToggle = async (key: keyof NotificationSettings, value: boolean) => {
    if (!storeId) return;
    try {
      const res = await updateNotificationSettings(storeId, { [key]: value });
      setNotifications(res.data);
      toast.success(isAr ? "تم التحديث" : "Updated");
    } catch {
      toast.error(isAr ? "فشل التحديث" : "Failed to update");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const connected = status?.connected ?? false;
  const isShared = status?.connection_type === "shared";

  // The landing page shows the same suite to everyone — connected via
  // Numu (default), connected via BYO, or not yet configured. The
  // status banner at the top tells the merchant which path they're
  // on. The old "empty state → Connect WhatsApp Business" gate has
  // been removed; BYO connect is now a sub-action under the Settings
  // tab so it doesn't dominate the first-touch experience.

  // ── Suite Landing ──
  // Toggle keys MUST match the backend's canonical schema at
  // store.settings.whatsapp_notifications.{...} (see NUMU-api
  // src/api/v1/schemas/stores/whatsapp.py::NotificationSettings).
  //   shipping_update         — fires on OrderStatusChangedEvent(shipped)
  //   delivery_confirmation   — fires on OrderStatusChangedEvent(delivered)
  // Previous keys (order_shipped / order_delivered / out_for_delivery)
  // wrote to a path the backend handler doesn't read, so the toggle
  // appeared to work but had no effect on actual sends.
  //
  // abandoned_cart and out_for_delivery intentionally absent — no
  // Meta template + dispatcher landed yet. They'll be added back when
  // US3 ships the scheduled-send dispatcher.
  //
  // `require_order_confirmation` is different from the other toggles —
  // it doesn't add/remove a notification, it changes the SHAPE of the
  // order_confirmation send (receipt vs interactive Confirm-button).
  // Rendered in its own card below so it doesn't get visually conflated
  // with the on/off rows.
  const notifItems: {
    key: keyof NotificationSettings;
    icon: React.ReactNode;
    label: string;
    labelAr: string;
  }[] = [
    { key: "order_confirmation", icon: <ShoppingCart className="h-4 w-4" />, label: "Order Confirmation", labelAr: "تأكيد الطلب" },
    { key: "payment_received", icon: <CreditCard className="h-4 w-4" />, label: "Payment Received", labelAr: "تم الدفع" },
    { key: "shipping_update", icon: <Truck className="h-4 w-4" />, label: "Shipping Update", labelAr: "تم الشحن" },
    { key: "delivery_confirmation", icon: <CheckCheck className="h-4 w-4" />, label: "Delivery Confirmation", labelAr: "تم التوصيل" },
  ];

  // Status of the merchant's WhatsApp setup, displayed as a chip in
  // the hero. Three states: connected via Numu's platform-managed
  // WABA (the default — every store gets this for free), connected
  // via the merchant's own WABA (BYO mode), or not yet configured
  // (rare — would mean platform creds aren't set in the backend).
  const statusBadge = !connected
    ? {
        label: isAr ? "غير متصل" : "Not configured",
        dotClass: "bg-red-500",
        chipClass: "text-red-600 border-red-200 bg-red-50",
      }
    : isShared
      ? {
          label: isAr ? "متصل عبر رقم نُمو" : "Connected via Numu",
          dotClass: "bg-green-500",
          chipClass: "text-green-600 border-green-200 bg-green-50",
        }
      : {
          label: isAr ? "متصل برقمك الخاص" : "Connected via your own WABA",
          dotClass: "bg-blue-500",
          chipClass: "text-blue-600 border-blue-200 bg-blue-50",
        };

  // Suite features showcased in the hero. The merchant lands here and
  // immediately sees what NUMU's WhatsApp pipeline does for them —
  // not a generic "connect Meta" pitch. Mirrors the four notification
  // toggles below + the customer-confirmation interactive flow.
  const suiteFeatures = [
    {
      icon: <ShoppingCart className="h-5 w-5 text-blue-500" />,
      title: isAr ? "تأكيد الطلب" : "Order Confirmation",
      desc: isAr ? "بمجرد إنشاء الطلب" : "The moment an order is placed",
    },
    {
      icon: <ShieldCheck className="h-5 w-5 text-emerald-500" />,
      title: isAr ? "تأكيد العميل" : "Customer Confirmation",
      desc: isAr ? "زر تأكيد قبل الشحن" : "One-tap Confirm before shipping",
    },
    {
      icon: <Truck className="h-5 w-5 text-amber-500" />,
      title: isAr ? "تحديثات الشحن" : "Shipping Updates",
      desc: isAr ? "شحن وتسليم تلقائي" : "Auto on shipped + delivered",
    },
    {
      icon: <CreditCard className="h-5 w-5 text-purple-500" />,
      title: isAr ? "إيصال الدفع" : "Payment Receipts",
      desc: isAr ? "بعد تأكيد الدفع" : "Right after payment clears",
    },
  ];

  return (
    <div className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
      {/* Hero */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
              {isAr ? "أتمتة واتساب للمتجر" : "WhatsApp Automation Suite"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              {isAr
                ? "تأكيد الطلب، تأكيد العميل، تحديثات الشحن، وإيصالات الدفع — كلها على واتساب وبدون إعدادات."
                : "Order confirmation, customer confirmation, shipping updates, and payment receipts — all on WhatsApp, zero setup."}
            </p>
          </div>
          <Badge variant="outline" className={`gap-1 ${statusBadge.chipClass}`}>
            <span className={`w-2 h-2 rounded-full ${statusBadge.dotClass}`} />
            {statusBadge.label}
            {connected && !isShared && status?.phone_number && (
              <span className="text-xs opacity-70 ms-1">({status.phone_number})</span>
            )}
          </Badge>
        </div>

        {/* Feature showcase — what the suite actually does */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {suiteFeatures.map((f, i) => (
            <Card key={i} className="border-muted">
              <CardContent className="pt-4 pb-3 space-y-1.5">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-muted">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-sm leading-tight">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-snug">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="templates">{isAr ? "القوالب" : "Templates"}</TabsTrigger>
          <TabsTrigger value="notifications">{isAr ? "الإشعارات" : "Notifications"}</TabsTrigger>
          <TabsTrigger value="overview">{isAr ? "نظرة عامة" : "Overview"}</TabsTrigger>
          <TabsTrigger value="analytics">{isAr ? "التحليلات" : "Analytics"}</TabsTrigger>
          <TabsTrigger value="settings">{isAr ? "إعدادات" : "Settings"}</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: isAr ? "مرسلة" : "Sent", value: analytics?.total_sent ?? 0, icon: <Send className="h-4 w-4 text-blue-500" /> },
              { label: isAr ? "وصلت" : "Delivered", value: analytics?.total_delivered ?? 0, icon: <CheckCheck className="h-4 w-4 text-green-500" /> },
              { label: isAr ? "مقروءة" : "Read", value: analytics?.total_read ?? 0, icon: <Eye className="h-4 w-4 text-purple-500" /> },
              { label: isAr ? "فشلت" : "Failed", value: analytics?.total_failed ?? 0, icon: <AlertCircle className="h-4 w-4 text-red-500" /> },
            ].map((stat, i) => (
              <Card key={i}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    {stat.icon}
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">{isAr ? "نسبة التوصيل" : "Delivery Rate"}</p>
                <p className="text-2xl font-bold text-green-600">{analytics?.delivery_rate ?? 0}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">{isAr ? "نسبة القراءة" : "Read Rate"}</p>
                <p className="text-2xl font-bold text-purple-600">{analytics?.read_rate ?? 0}%</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Templates — the suite's "what your customers get" view.
            Lists every approved (or pending) template the platform-managed
            WABA has registered, plus a Preview button that opens the
            WhatsApp-styled chat bubble showing what the actual message
            will look like with realistic sample values. */}
        <TabsContent value="templates" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {isAr ? "قوالب الرسائل" : "Message Templates"}
              </CardTitle>
              <CardDescription className="text-xs">
                {isAr
                  ? "ده اللي بيوصل لعميلك على واتساب. كل القوالب موافق عليها من Meta وجاهزة للإرسال. اضغط معاينة لتشوف الرسالة كاملة."
                  : "This is what lands on your customer's WhatsApp. Every template is Meta-approved and ready to fire. Tap Preview to see the full bubble."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {isAr
                    ? "لسة مفيش قوالب متاحة على متجرك. لما القوالب الافتراضية تتزامن من Meta هتظهر هنا."
                    : "No templates available for this store yet. The defaults sync from Meta on next deploy."}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templates.map((t) => (
                    <Card key={t.id} className="border-muted">
                      <CardContent className="pt-4 pb-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{t.name}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-[10px] py-0">
                                {t.category}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] py-0 uppercase">
                                {t.language}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-[10px] py-0 ${
                                  t.status === "APPROVED"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-200/50"
                                    : t.status === "PENDING"
                                      ? "bg-amber-500/10 text-amber-600 border-amber-200/50"
                                      : "bg-red-500/10 text-red-600 border-red-200/50"
                                }`}
                              >
                                {t.status}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPreviewTemplate(t)}
                            disabled={t.status !== "APPROVED"}
                          >
                            <Eye className="h-3.5 w-3.5 me-1" />
                            {isAr ? "معاينة" : "Preview"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{isAr ? "إشعارات تلقائية" : "Automated Notifications"}</CardTitle>
              <CardDescription className="text-xs">
                {isAr
                  ? "اختر الرسائل اللي تتبعت تلقائياً لعملاءك"
                  : "Choose which messages are automatically sent to your customers"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifItems.map((item) => {
                const toggle = notifications?.[item.key];
                return (
                  <div key={item.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        {item.icon}
                      </div>
                      <span className="text-sm font-medium">{isAr ? item.labelAr : item.label}</span>
                    </div>
                    <Switch
                      checked={toggle?.enabled ?? false}
                      onCheckedChange={(v) => handleToggle(item.key, v)}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/*
            Customer-confirmation card — separate from the on/off
            notifications above because it changes the SHAPE of the
            order_confirmation send (interactive QUICK_REPLY vs the
            receipt-style default), not whether it fires at all.
            Backend handler reads the same dict key
            (require_order_confirmation) at order-creation time.
          */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {isAr ? "تأكيد العميل للطلب" : "Customer Order Confirmation"}
              </CardTitle>
              <CardDescription className="text-xs">
                {isAr
                  ? "لما تشغل الخيار ده، العميل بيستلم رسالة واتساب فيها تفاصيل الطلب والعنوان، وزرار تأكيد. لحد ما يضغط، الطلب يفضل 'بانتظار تأكيد العميل' في لوحة التحكم."
                  : "When ON, the customer gets a WhatsApp message showing the order + shipping address with a Confirm button. Until they tap, the order stays 'awaiting customer confirmation' in the dashboard."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">
                    {isAr ? "اطلب تأكيد العميل" : "Require customer to confirm order"}
                  </span>
                </div>
                <Switch
                  checked={notifications?.require_order_confirmation?.enabled ?? false}
                  onCheckedChange={(v) => handleToggle("require_order_confirmation", v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{isAr ? "الرسائل يومياً" : "Messages Per Day"}</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.daily_stats && analytics.daily_stats.length > 0 ? (
                <div className="space-y-2">
                  {analytics.daily_stats.slice(-14).map((day) => (
                    <div key={day.date} className="flex items-center gap-3 text-xs">
                      <span className="w-20 text-muted-foreground">{day.date}</span>
                      <div className="flex-1 flex gap-1 h-4">
                        {day.sent > 0 && (
                          <div
                            className="bg-blue-400 rounded-sm"
                            style={{ width: `${Math.min((day.sent / Math.max(...analytics.daily_stats.map(d => d.sent || 1))) * 100, 100)}%` }}
                            title={`Sent: ${day.sent}`}
                          />
                        )}
                      </div>
                      <span className="w-8 text-right">{day.sent}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {isAr ? "لا توجد بيانات بعد" : "No data yet"}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings — sub-nav location for the BYO connect flow + the
            disconnect action. Demoted from the page's primary CTA
            (which used to dominate the empty state) to a secondary
            tab; most merchants stay on Numu's platform WABA and
            never need to touch BYO. */}
        <TabsContent value="settings" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {isAr ? "وضع الاتصال" : "Connection Mode"}
              </CardTitle>
              <CardDescription className="text-xs">
                {isAr
                  ? "افتراضياً، الرسايل بتطلع من رقم نُمو المشترك — صفر إعدادات. لو عايز ترسل من رقم بزنس بتاعك (Meta WABA الخاص بيك) عشان ظهور الاسم تبعك على واتساب، اربطه من هنا."
                  : "By default messages go out from Numu's shared number — zero setup. If you want them branded with your own Meta WABA so your name shows on customers' WhatsApp, connect it here."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current state summary */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {connected
                        ? isShared
                          ? isAr
                            ? "رقم نُمو المشترك"
                            : "Numu shared number"
                          : status?.phone_display_name || (isAr ? "رقمك الخاص" : "Your own WABA")
                        : isAr
                          ? "غير متصل"
                          : "Not configured"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {status?.phone_number || (isAr ? "—" : "—")}
                    </p>
                  </div>
                </div>
                {connected && !isShared && (
                  <Button variant="ghost" size="sm" onClick={handleDisconnect}>
                    <Unplug className="h-4 w-4 me-1" />
                    {isAr ? "فصل" : "Disconnect"}
                  </Button>
                )}
              </div>

              {/* BYO connect button — only relevant when not already on BYO */}
              {(!connected || isShared) && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {isAr ? "ربط رقم بزنس بتاعك" : "Bring your own WABA"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isAr
                      ? "هتحتاج: حساب Meta Business، رقم تم التحقق منه، وقالب موافق عليه. الإعداد عبر شاشة Meta Embedded Signup."
                      : "Requires: a Meta Business Account, a verified phone number, and at least one approved template. Setup via Meta Embedded Signup."}
                  </p>
                  <Button
                    onClick={handleConnect}
                    disabled={connecting}
                    variant="outline"
                    className="gap-2"
                  >
                    {connecting ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Phone className="h-4 w-4" />
                    )}
                    {isAr ? "ربط واتساب للأعمال" : "Connect WhatsApp Business"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template preview modal — opens from the Templates tab. Renders
          the body text with realistic sample values in a WhatsApp-styled
          chat bubble + any URL/QUICK_REPLY buttons the template declares. */}
      {previewTemplate && (
        <WhatsAppTemplatePreview
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          isAr={isAr}
        />
      )}
    </div>
  );
}
