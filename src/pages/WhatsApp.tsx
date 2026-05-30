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
} from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [tab, setTab] = useState("overview");

  const loadData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const [statusRes, notifsRes, analyticsRes] = await Promise.all([
        getWhatsAppStatus(storeId),
        getNotificationSettings(storeId),
        getWhatsAppAnalytics(storeId, "30d"),
      ]);
      setStatus(statusRes.data);
      setNotifications(notifsRes.data);
      setAnalytics(analyticsRes.data);
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

  // ── Not Connected State ──
  if (!connected || status?.connection_type === "shared") {
    return (
      <div className="space-y-6 max-w-3xl mx-auto py-8" dir={isAr ? "rtl" : "ltr"}>
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
            <MessageSquare className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">
            {isAr ? "كن حيث يوجد عملاؤك" : "Be Where Your Customers Are"}
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            {isAr
              ? "اربط رقم واتساب للأعمال الخاص بك وأرسل تحديثات الطلبات والحملات التسويقية مباشرة"
              : "Connect your WhatsApp Business number to send order updates and marketing campaigns directly"}
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: <Zap className="h-5 w-5 text-yellow-500" />,
              title: isAr ? "98% معدل فتح" : "98% Open Rate",
              desc: isAr ? "أعلى بكتير من الإيميل" : "Way higher than email",
            },
            {
              icon: <ShoppingCart className="h-5 w-5 text-blue-500" />,
              title: isAr ? "استرجع السلات المتروكة" : "Recover Abandoned Carts",
              desc: isAr ? "رسالة تذكير تلقائية" : "Auto reminder messages",
            },
            {
              icon: <TrendingUp className="h-5 w-5 text-green-500" />,
              title: isAr ? "زود مبيعاتك" : "Boost Sales",
              desc: isAr ? "حملات تسويقية مستهدفة" : "Targeted campaigns",
            },
          ].map((b, i) => (
            <Card key={i}>
              <CardContent className="pt-6 text-center space-y-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                  {b.icon}
                </div>
                <h3 className="font-semibold text-sm">{b.title}</h3>
                <p className="text-xs text-muted-foreground">{b.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Connect Button */}
        <div className="text-center">
          <Button
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white gap-2 px-8"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Phone className="h-4 w-4" />
            )}
            {isAr ? "ربط واتساب للأعمال" : "Connect WhatsApp Business"}
          </Button>
          {status?.connection_type === "shared" && (
            <p className="text-xs text-muted-foreground mt-2">
              {isAr
                ? "حالياً بتستخدم رقم NUMU المشترك. اربط رقمك الخاص لتجربة أفضل"
                : "Currently using shared NUMU number. Connect your own for a branded experience"}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Connected State ──
  const notifItems: {
    key: keyof NotificationSettings;
    icon: React.ReactNode;
    label: string;
    labelAr: string;
  }[] = [
    { key: "order_confirmation", icon: <ShoppingCart className="h-4 w-4" />, label: "Order Confirmation", labelAr: "تأكيد الطلب" },
    { key: "order_shipped", icon: <Truck className="h-4 w-4" />, label: "Order Shipped", labelAr: "تم الشحن" },
    { key: "out_for_delivery", icon: <Package className="h-4 w-4" />, label: "Out for Delivery", labelAr: "في الطريق" },
    { key: "order_delivered", icon: <CheckCheck className="h-4 w-4" />, label: "Delivered", labelAr: "تم التوصيل" },
    { key: "payment_received", icon: <CreditCard className="h-4 w-4" />, label: "Payment Received", labelAr: "تم الدفع" },
    { key: "abandoned_cart", icon: <Clock className="h-4 w-4" />, label: "Abandoned Cart", labelAr: "سلة متروكة" },
  ];

  return (
    <div className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{isAr ? "واتساب للأعمال" : "WhatsApp Business"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr ? "إدارة الرسائل والحملات" : "Manage messages and campaigns"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            {isAr ? "متصل" : "Connected"}
          </Badge>
          <Button variant="ghost" size="sm" onClick={handleDisconnect}>
            <Unplug className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Connection Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <Phone className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{status?.phone_display_name || "WhatsApp Business"}</p>
              <p className="text-sm text-muted-foreground">{status?.phone_number || ""}</p>
            </div>
            {status?.quality_rating && (
              <Badge variant={status.quality_rating === "GREEN" ? "default" : "destructive"}>
                {status.quality_rating}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">{isAr ? "نظرة عامة" : "Overview"}</TabsTrigger>
          <TabsTrigger value="notifications">{isAr ? "الإشعارات" : "Notifications"}</TabsTrigger>
          <TabsTrigger value="analytics">{isAr ? "التحليلات" : "Analytics"}</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
