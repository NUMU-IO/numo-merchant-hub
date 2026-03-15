import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Bell, BellOff, Check, CheckCheck, ShoppingCart, Package, Users,
  CreditCard, AlertTriangle, Info, Trash2, Settings2,
} from "lucide-react";

interface Notification {
  id: string;
  type: "order" | "product" | "customer" | "payment" | "system";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: "1", type: "order", title: "New Order #1042", message: "Ahmed placed a new order for EGP 450", time: "2 min ago", read: false },
  { id: "2", type: "payment", title: "Payment Received", message: "Payment confirmed for Order #1041", time: "15 min ago", read: false },
  { id: "3", type: "customer", title: "New Customer", message: "Sara signed up and created an account", time: "1 hour ago", read: false },
  { id: "4", type: "product", title: "Low Stock Alert", message: "Cotton T-Shirt has only 3 items left", time: "2 hours ago", read: true },
  { id: "5", type: "system", title: "System Update", message: "New theme options are available in the marketplace", time: "1 day ago", read: true },
  { id: "6", type: "order", title: "Order Delivered", message: "Order #1038 was delivered successfully", time: "2 days ago", read: true },
];

export default function Notifications() {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [tab, setTab] = useState<"notifications" | "preferences">("notifications");

  // Preferences state
  const [prefs, setPrefs] = useState({
    orderNew: true,
    orderStatus: true,
    orderCancelled: true,
    paymentReceived: true,
    paymentFailed: true,
    customerNew: true,
    productLowStock: true,
    systemUpdates: false,
    emailNotifications: true,
    pushNotifications: false,
  });

  const unreadCount = notifications.filter(n => !n.read).length;
  const filtered = filter === "unread" ? notifications.filter(n => !n.read) : notifications;

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const markRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const deleteNotification = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));
  const clearAll = () => setNotifications([]);

  const typeIcon = (type: string) => {
    switch (type) {
      case "order": return <ShoppingCart className="h-4 w-4" />;
      case "product": return <Package className="h-4 w-4" />;
      case "customer": return <Users className="h-4 w-4" />;
      case "payment": return <CreditCard className="h-4 w-4" />;
      case "system": return <Info className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case "order": return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      case "product": return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
      case "customer": return "bg-violet-500/10 text-violet-600 dark:text-violet-400";
      case "payment": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
      case "system": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {isAr ? "الإشعارات" : "Notifications"}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {isAr ? "تابع آخر التحديثات والتنبيهات" : "Stay updated with alerts and activity"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5">
            {unreadCount} {isAr ? "جديد" : "new"}
          </Badge>
        )}
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-0.5 rounded-lg bg-muted/60 p-0.5 w-fit">
        <Button
          variant={tab === "notifications" ? "default" : "ghost"}
          size="sm"
          className="h-8 text-xs px-3 rounded-md gap-1.5"
          onClick={() => setTab("notifications")}
        >
          <Bell className="h-3.5 w-3.5" />
          {isAr ? "الإشعارات" : "Activity"}
        </Button>
        <Button
          variant={tab === "preferences" ? "default" : "ghost"}
          size="sm"
          className="h-8 text-xs px-3 rounded-md gap-1.5"
          onClick={() => setTab("preferences")}
        >
          <Settings2 className="h-3.5 w-3.5" />
          {isAr ? "التفضيلات" : "Preferences"}
        </Button>
      </div>

      {tab === "notifications" ? (
        <>
          {/* Actions Bar */}
          <div className="flex items-center justify-between">
            <div className="flex gap-0.5 rounded-lg bg-muted/60 p-0.5">
              {(["all", "unread"] as const).map(f => (
                <Button
                  key={f}
                  variant={filter === f ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 text-[11px] px-2.5 rounded-md ${filter === f ? "" : "text-muted-foreground"}`}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? (isAr ? "الكل" : "All") : (isAr ? "غير مقروء" : "Unread")}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 rounded-lg" onClick={markAllRead}>
                  <CheckCheck className="h-3 w-3" />
                  {isAr ? "قراءة الكل" : "Mark all read"}
                </Button>
              )}
              {notifications.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 rounded-lg text-destructive hover:text-destructive" onClick={clearAll}>
                  <Trash2 className="h-3 w-3" />
                  {isAr ? "مسح الكل" : "Clear all"}
                </Button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <Card className="border-border/60">
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="py-12">
                  <EmptyState
                    icon={BellOff}
                    title={filter === "unread" ? (isAr ? "مفيش إشعارات جديدة" : "No unread notifications") : (isAr ? "مفيش إشعارات" : "No notifications")}
                    description={isAr ? "هتظهر التحديثات هنا" : "Updates will appear here"}
                  />
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {filtered.map((n) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 p-4 transition-colors hover:bg-muted/30 cursor-pointer ${!n.read ? "bg-primary/[0.02]" : ""}`}
                      onClick={() => markRead(n.id)}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 mt-0.5 ${typeColor(n.type)}`}>
                        {typeIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-[13px] font-medium ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>
                            {n.title}
                          </p>
                          {!n.read && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{n.time}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        /* Notification Preferences */
        <div className="space-y-4">
          {/* Order Notifications */}
          <Card className="border-border/60">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
                  <ShoppingCart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-sm">{isAr ? "إشعارات الطلبات" : "Order Notifications"}</CardTitle>
                  <CardDescription className="text-xs">{isAr ? "تنبيهات متعلقة بالطلبات" : "Alerts related to orders"}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "orderNew" as const, label: isAr ? "طلب جديد" : "New Order", desc: isAr ? "عند استلام طلب جديد" : "When a new order is placed" },
                { key: "orderStatus" as const, label: isAr ? "تحديث حالة الطلب" : "Order Status Update", desc: isAr ? "عند تغيير حالة الطلب" : "When order status changes" },
                { key: "orderCancelled" as const, label: isAr ? "إلغاء طلب" : "Order Cancelled", desc: isAr ? "عند إلغاء طلب" : "When an order is cancelled" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-[13px] cursor-pointer">{item.label}</Label>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch checked={prefs[item.key]} onCheckedChange={(v) => setPrefs(p => ({ ...p, [item.key]: v }))} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Payment Notifications */}
          <Card className="border-border/60">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
                  <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-sm">{isAr ? "إشعارات الدفع" : "Payment Notifications"}</CardTitle>
                  <CardDescription className="text-xs">{isAr ? "تنبيهات متعلقة بالمدفوعات" : "Alerts related to payments"}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "paymentReceived" as const, label: isAr ? "دفعة مستلمة" : "Payment Received", desc: isAr ? "عند استلام دفعة" : "When payment is received" },
                { key: "paymentFailed" as const, label: isAr ? "فشل الدفع" : "Payment Failed", desc: isAr ? "عند فشل عملية دفع" : "When a payment fails" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-[13px] cursor-pointer">{item.label}</Label>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch checked={prefs[item.key]} onCheckedChange={(v) => setPrefs(p => ({ ...p, [item.key]: v }))} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Other Notifications */}
          <Card className="border-border/60">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10">
                  <Bell className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <CardTitle className="text-sm">{isAr ? "إشعارات أخرى" : "Other Notifications"}</CardTitle>
                  <CardDescription className="text-xs">{isAr ? "تنبيهات عامة" : "General alerts"}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "customerNew" as const, label: isAr ? "عميل جديد" : "New Customer", desc: isAr ? "عند تسجيل عميل جديد" : "When a new customer signs up" },
                { key: "productLowStock" as const, label: isAr ? "مخزون منخفض" : "Low Stock", desc: isAr ? "عند انخفاض المخزون" : "When product stock is low" },
                { key: "systemUpdates" as const, label: isAr ? "تحديثات النظام" : "System Updates", desc: isAr ? "ميزات وتحديثات جديدة" : "New features and updates" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-[13px] cursor-pointer">{item.label}</Label>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch checked={prefs[item.key]} onCheckedChange={(v) => setPrefs(p => ({ ...p, [item.key]: v }))} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Delivery Channels */}
          <Card className="border-border/60">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <Settings2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm">{isAr ? "طرق الإرسال" : "Delivery Channels"}</CardTitle>
                  <CardDescription className="text-xs">{isAr ? "كيف تريد استلام الإشعارات" : "How you want to receive notifications"}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-[13px] cursor-pointer">{isAr ? "البريد الإلكتروني" : "Email Notifications"}</Label>
                  <p className="text-[11px] text-muted-foreground">{isAr ? "استلام الإشعارات عبر الإيميل" : "Receive notifications via email"}</p>
                </div>
                <Switch checked={prefs.emailNotifications} onCheckedChange={(v) => setPrefs(p => ({ ...p, emailNotifications: v }))} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-[13px] cursor-pointer">{isAr ? "إشعارات المتصفح" : "Push Notifications"}</Label>
                  <p className="text-[11px] text-muted-foreground">{isAr ? "إشعارات فورية في المتصفح" : "Real-time browser notifications"}</p>
                </div>
                <Switch checked={prefs.pushNotifications} onCheckedChange={(v) => setPrefs(p => ({ ...p, pushNotifications: v }))} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
