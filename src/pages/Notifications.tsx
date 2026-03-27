import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Bell, BellOff, CheckCheck, ShoppingCart, Package, Users,
  CreditCard, Info, Settings2, Loader2,
} from "lucide-react";
import { listOrders, type OrderListItem } from "@/services/orderApi";

interface Notification {
  id: string;
  type: "order" | "payment" | "customer" | "system";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

/** Build notification items from recent orders. */
function ordersToNotifications(orders: OrderListItem[], isAr: boolean): Notification[] {
  const notifications: Notification[] = [];
  const now = Date.now();

  for (const o of orders) {
    const created = new Date(o.created_at).getTime();
    const ago = formatTimeAgo(now - created, isAr);
    const amount = (o.total / 100).toLocaleString(isAr ? "ar-EG" : "en-US");
    const currency = isAr ? "ج.م" : o.currency;

    // New order notification
    notifications.push({
      id: `order-${o.id}`,
      type: "order",
      title: isAr ? `طلب جديد #${o.order_number}` : `New Order #${o.order_number}`,
      message: isAr
        ? `${o.customer_name || "عميل"} قام بطلب بقيمة ${amount} ${currency}`
        : `${o.customer_name || "Customer"} placed an order for ${currency} ${amount}`,
      time: ago,
      read: (now - created) > 24 * 60 * 60 * 1000,
    });

    // Payment notification
    if (o.payment_status === "paid") {
      notifications.push({
        id: `payment-${o.id}`,
        type: "payment",
        title: isAr ? `دفعة مستلمة` : `Payment Received`,
        message: isAr
          ? `تم تأكيد الدفع للطلب #${o.order_number} — ${amount} ${currency}`
          : `Payment confirmed for Order #${o.order_number} — ${currency} ${amount}`,
        time: ago,
        read: (now - created) > 24 * 60 * 60 * 1000,
      });
    }
  }

  // Sort by most recent first (derive from the original order)
  return notifications;
}

function formatTimeAgo(ms: number, isAr: boolean): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return isAr ? "الآن" : "Just now";
  if (minutes < 60) return isAr ? `منذ ${minutes} دقيقة` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return isAr ? `منذ ${hours} ساعة` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return isAr ? `منذ ${days} يوم` : `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return isAr ? `منذ ${weeks} أسبوع` : `${weeks}w ago`;
}

export default function Notifications() {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";
  const storeId = currentStore?.id;

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("numu-read-notifications");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
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

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    listOrders(storeId, { limit: 20 })
      .then((res) => setOrders(res.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storeId]);

  const notifications = useMemo(() => {
    const items = ordersToNotifications(orders, isAr);
    // Apply read state from localStorage
    return items.map((n) => ({ ...n, read: n.read || readIds.has(n.id) }));
  }, [orders, isAr, readIds]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const filtered = filter === "unread" ? notifications.filter(n => !n.read) : notifications;

  const persistReadIds = (ids: Set<string>) => {
    setReadIds(ids);
    try { localStorage.setItem("numu-read-notifications", JSON.stringify([...ids])); } catch { /* ignore */ }
  };

  const markAllRead = () => {
    const all = new Set([...readIds, ...notifications.map(n => n.id)]);
    persistReadIds(all);
  };
  const markRead = (id: string) => {
    if (readIds.has(id)) return;
    persistReadIds(new Set([...readIds, id]));
  };

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
            </div>
          </div>

          {/* Notification List */}
          <Card className="border-border/60">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12">
                  <EmptyState
                    icon={BellOff}
                    title={filter === "unread" ? (isAr ? "مفيش إشعارات جديدة" : "No unread notifications") : (isAr ? "مفيش إشعارات" : "No notifications")}
                    description={isAr ? "هتظهر التحديثات هنا عند استلام طلبات جديدة" : "Updates will appear here when you receive new orders"}
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
