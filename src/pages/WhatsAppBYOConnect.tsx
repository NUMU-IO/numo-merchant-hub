/**
 * BYO Meta WhatsApp Business Account connection page.
 *
 * Three modes the page renders:
 *
 * 1. Loading — initial /byo/status fetch.
 * 2. Platform-managed — the merchant is on NUMU's shared number.
 *    Shows a banner explaining the difference + a "Connect your own
 *    WABA" button that opens the form.
 * 3. BYO connected — shows the phone display name + last validation
 *    timestamp + a per-message-type toggle grid + a disconnect button.
 *
 * On submit, the 3-step Meta validation runs server-side. A 422 with a
 * BYOValidationFailure body lets us tell the merchant *which* step
 * failed (phone metadata / WABA info / template list) and surface
 * Meta's sanitized error code + message — way more actionable than a
 * generic "invalid credentials".
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Loader2,
  Unplug,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import {
  byoConnect,
  byoDisconnect,
  getByoStatus,
  updateByoNotifications,
  type BYOConnectRequest,
  type BYOValidationFailure,
  type WhatsAppNotificationSettings,
  type WhatsAppStatus,
} from "@/services/whatsappApi";

const NOTIFICATION_KEYS: (keyof WhatsAppNotificationSettings)[] = [
  "order_confirmation",
  "payment_received",
  "shipping_update",
  "delivery_confirmation",
  "abandoned_cart",
  "marketing",
];

export default function WhatsAppBYOConnect() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;

  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [formError, setFormError] =
    useState<BYOValidationFailure | string | null>(null);

  // Form state
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [appSecret, setAppSecret] = useState("");

  const refresh = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      // apiClient already unwraps { data: T } to T. Null means the
      // endpoint isn't deployed (test env without the WhatsApp PR
      // merged) — render the empty/disconnected state instead of
      // crashing the page.
      const res = await getByoStatus(storeId);
      if (res) setStatus(res);
    } catch {
      toast.error(
        isAr
          ? "تعذر تحميل حالة واتساب"
          : "Could not load WhatsApp status"
      );
    } finally {
      setLoading(false);
    }
  }, [storeId, isAr]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const body: BYOConnectRequest = {
        access_token: accessToken.trim(),
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim(),
        app_secret: appSecret.trim(),
      };
      const res = await byoConnect(storeId, body);
      if (res) setStatus(res);
      setShowForm(false);
      setAccessToken("");
      setPhoneNumberId("");
      setWabaId("");
      setAppSecret("");
      toast.success(
        isAr
          ? "تم ربط حساب واتساب الخاص بك"
          : "Your WhatsApp Business Account is connected"
      );
    } catch (err) {
      // The backend's 422 has a typed BYOValidationFailure body. The
      // api client surfaces it via err.detail when available; fall back
      // to a generic message otherwise.
      const detail =
        (err as { detail?: BYOValidationFailure | string } | undefined)?.detail ??
        null;
      if (detail && typeof detail === "object" && "failed_step" in detail) {
        setFormError(detail);
      } else {
        setFormError(
          isAr
            ? "فشل الاتصال بـ Meta. تحقق من البيانات وحاول مجددًا."
            : "Connection to Meta failed. Check the credentials and try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onDisconnect = async () => {
    if (!storeId) return;
    if (
      !window.confirm(
        isAr
          ? "هل تريد فصل واتساب الخاص بك والعودة إلى رقم NUMU المشترك؟ سيتم إعادة ضبط إعدادات الإشعارات."
          : "Disconnect your WhatsApp and revert to NUMU's shared number? Your notification toggles will be restored from the snapshot taken at connect time."
      )
    )
      return;
    setDisconnecting(true);
    try {
      const res = await byoDisconnect(storeId);
      if (res) setStatus(res);
      toast.success(
        isAr
          ? "تم فصل واتساب البيز الخاص بك"
          : "Your BYO WhatsApp has been disconnected"
      );
    } catch {
      toast.error(
        isAr ? "فشل الفصل" : "Disconnect failed"
      );
    } finally {
      setDisconnecting(false);
    }
  };

  const onToggleNotification = async (
    key: keyof WhatsAppNotificationSettings,
    value: boolean
  ) => {
    if (!storeId || !status) return;
    // Optimistic update
    setStatus({
      ...status,
      notifications: { ...status.notifications, [key]: value },
    });
    try {
      const res = await updateByoNotifications(storeId, { [key]: value });
      setStatus((prev) =>
        prev && res ? { ...prev, notifications: res } : prev
      );
    } catch {
      toast.error(
        isAr ? "تعذر حفظ الإعداد" : "Could not save toggle"
      );
      refresh(); // re-sync on failure
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" dir={isAr ? "rtl" : "ltr"}>
      <header>
        <h1 className="text-2xl font-bold">
          {isAr ? "اتصال واتساب الأعمال" : "WhatsApp Business Connection"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr
            ? "اربط رقمك الخاص أو استخدم رقم NUMU المشترك."
            : "Use NUMU's shared number, or connect your own Meta WhatsApp Business Account."}
        </p>
      </header>

      {/* Connection-state card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              {isAr ? "حالة الاتصال" : "Connection status"}
              {status?.mode === "byo" && (
                <Badge variant="default">
                  {isAr ? "رقمك الخاص" : "Your own number (BYO)"}
                </Badge>
              )}
              {status?.mode === "platform_managed" && (
                <Badge variant="secondary">
                  {isAr ? "رقم NUMU المشترك" : "NUMU shared number"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {status?.mode === "byo" && status?.display_phone_number
                ? `${status.phone_display_name ?? ""} (${status.display_phone_number})`
                : isAr
                ? "إشعارات الطلبات تُرسل من رقم NUMU."
                : "Order notifications are sent from NUMU's shared number."}
            </CardDescription>
          </div>
          {status?.mode === "byo" ? (
            <Button
              variant="outline"
              onClick={onDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="h-4 w-4 me-2" />
              )}
              {isAr ? "فصل" : "Disconnect"}
            </Button>
          ) : (
            <Button onClick={() => setShowForm((s) => !s)}>
              {showForm
                ? isAr
                  ? "إغلاق"
                  : "Cancel"
                : isAr
                ? "اربط رقمك الخاص"
                : "Connect your own WABA"}
            </Button>
          )}
        </CardHeader>

        {status?.credential_error && (
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {isAr ? "خطأ في بيانات الاعتماد" : "Credential error"}
              </AlertTitle>
              <AlertDescription>
                {status.credential_error}
                <br />
                <span className="text-xs">
                  {isAr
                    ? "أعد الاتصال أو حدّث الرمز في Meta."
                    : "Reconnect or refresh the token at Meta."}
                </span>
              </AlertDescription>
            </Alert>
          </CardContent>
        )}

        {status?.last_validated_at && status.mode === "byo" && (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {isAr ? "آخر تحقق:" : "Last validated:"}{" "}
              {new Date(status.last_validated_at).toLocaleString(
                isAr ? "ar-EG" : "en-US"
              )}
            </p>
          </CardContent>
        )}
      </Card>

      {/* BYO connect form (only shown when explicitly opened, and only on platform-managed) */}
      {showForm && status?.mode === "platform_managed" && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isAr
                ? "أدخل بيانات حساب واتساب الأعمال"
                : "Paste your Meta WABA credentials"}
            </CardTitle>
            <CardDescription>
              {isAr ? (
                <>
                  ستجدها في{" "}
                  <a
                    href="https://business.facebook.com/wa/manage/home/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline inline-flex items-center gap-0.5"
                  >
                    Meta Business Manager
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  . سنتحقق منها مع Meta قبل الحفظ.
                </>
              ) : (
                <>
                  Find them in your{" "}
                  <a
                    href="https://business.facebook.com/wa/manage/home/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline inline-flex items-center gap-0.5"
                  >
                    Meta Business Manager
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  . We'll validate them against Meta before saving.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="access_token">
                  {isAr ? "رمز الوصول (Access Token)" : "Access Token"}
                </Label>
                <Input
                  id="access_token"
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  required
                  autoComplete="off"
                  placeholder="EAA..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr
                    ? "System User token. لا يتم تخزينه بدون تشفير."
                    : "System User token. Stored encrypted (AES-256). Never logged in plaintext."}
                </p>
              </div>

              <div>
                <Label htmlFor="phone_number_id">
                  {isAr ? "معرّف رقم الهاتف" : "Phone Number ID"}
                </Label>
                <Input
                  id="phone_number_id"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  required
                  placeholder="123456789012345"
                />
              </div>

              <div>
                <Label htmlFor="waba_id">
                  {isAr ? "معرّف حساب الأعمال (WABA ID)" : "WhatsApp Business Account ID"}
                </Label>
                <Input
                  id="waba_id"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  required
                  placeholder="123456789012345"
                />
              </div>

              <div>
                <Label htmlFor="app_secret">
                  {isAr ? "سر التطبيق (App Secret)" : "App Secret"}
                </Label>
                <Input
                  id="app_secret"
                  type="password"
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                  required
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {isAr
                    ? "يُستخدم للتحقق من توقيع الويبهوك."
                    : "Used to verify webhook signatures from Meta."}
                </p>
              </div>

              {formError && typeof formError === "object" && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>
                    {isAr ? "فشل التحقق" : "Validation failed"}
                    {": "}
                    <code className="text-xs">{formError.failed_step}</code>
                  </AlertTitle>
                  <AlertDescription>
                    <p>{formError.message}</p>
                    {formError.meta_error?.message && (
                      <p className="text-xs mt-1 opacity-80">
                        Meta: {formError.meta_error.message}
                        {formError.meta_error.code != null && (
                          <> (code {formError.meta_error.code})</>
                        )}
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              {formError && typeof formError === "string" && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                  {isAr ? "تحقّق وحفظ" : "Validate & save"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Notification toggles. Always shown; in BYO mode they default to OFF
          per FR-019a so the merchant explicitly enables each one after
          confirming the corresponding template is approved at Meta. */}
      <Card>
        <CardHeader>
          <CardTitle>{isAr ? "إشعارات الرسائل" : "Message notifications"}</CardTitle>
          <CardDescription>
            {status?.mode === "byo"
              ? isAr
                ? "تُعطّل افتراضياً عند الاتصال البِيز. فعّل كل خيار بعد التأكد من اعتماد القالب في Meta."
                : "Default to OFF on BYO connect (FR-019a). Enable each one after confirming the matching template is APPROVED under your own WABA."
              : isAr
              ? "تُرسل تلقائيًا من رقم NUMU المشترك."
              : "Sent automatically from NUMU's shared number when enabled."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {NOTIFICATION_KEYS.map((key) => {
            const labelAr: Record<typeof key, string> = {
              order_confirmation: "تأكيد الطلب",
              payment_received: "تأكيد الدفع",
              shipping_update: "تحديث الشحن",
              delivery_confirmation: "تأكيد التسليم",
              abandoned_cart: "السلة المتروكة",
              marketing: "حملات تسويقية",
            };
            const labelEn: Record<typeof key, string> = {
              order_confirmation: "Order confirmation",
              payment_received: "Payment received",
              shipping_update: "Shipping update",
              delivery_confirmation: "Delivery confirmation",
              abandoned_cart: "Abandoned cart",
              marketing: "Marketing",
            };
            return (
              <div
                key={key}
                className="flex items-center justify-between border rounded-md p-3"
              >
                <div>
                  <p className="font-medium">{isAr ? labelAr[key] : labelEn[key]}</p>
                  <p className="text-xs text-muted-foreground">
                    <code>{key}</code>
                  </p>
                </div>
                <Switch
                  checked={Boolean(status?.notifications?.[key])}
                  onCheckedChange={(v) => onToggleNotification(key, v)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
