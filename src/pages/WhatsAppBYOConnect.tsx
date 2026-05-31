import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getByoStatus,
  byoConnect,
  byoDisconnect,
  type WhatsAppStatus,
  type BYOConnectRequest,
  type BYOValidationFailure,
} from "@/services/whatsappApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Phone,
  KeyRound,
  Info,
} from "lucide-react";

// ── BYO (Bring-Your-Own Meta WABA) connection page ──
// Manual credential-paste path: a merchant enters their own Meta
// access_token + phone_number_id + waba_id + app_secret. On submit we
// POST /byo/connect; the backend runs Meta's 3-step validation and
// returns either a connected WhatsAppStatus or a 422 with the failed
// step. See whatsappApi.byoConnect. Reachable from the WhatsApp Overview
// "Use your own number" button and the sidebar (Connect / BYO).

const META_DEV_URL = "https://developers.facebook.com/apps";

// Map the backend's sanitized error code to a merchant-friendly,
// bilingual hint. Falls back to the raw Meta message when unknown.
const ERROR_HINTS: Record<
  BYOValidationFailure["code"],
  { en: string; ar: string }
> = {
  phone_number_unreachable: {
    en: "We couldn't reach that phone number. Double-check the Phone Number ID.",
    ar: "تعذّر الوصول إلى رقم الهاتف. تأكّد من معرّف رقم الهاتف.",
  },
  waba_mismatch: {
    en: "The WhatsApp Business Account ID doesn't match this token. Re-check the WABA ID.",
    ar: "معرّف حساب واتساب للأعمال لا يطابق الرمز. راجع معرّف WABA.",
  },
  insufficient_scope: {
    en: "This token is missing required permissions (whatsapp_business_management + messaging).",
    ar: "الرمز ينقصه الصلاحيات المطلوبة (إدارة + مراسلة واتساب للأعمال).",
  },
  meta_api_unavailable: {
    en: "Meta's API didn't respond. Please try again in a moment.",
    ar: "لم تستجب واجهة Meta. حاول مرة أخرى بعد قليل.",
  },
  unknown: {
    en: "Something went wrong validating these credentials.",
    ar: "حدث خطأ أثناء التحقق من البيانات.",
  },
};

export default function WhatsAppBYOConnect() {
  const { currentStore } = useDashboardStore();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const navigate = useNavigate();
  const storeId = currentStore?.id;

  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<BYOValidationFailure | null>(null);

  const [form, setForm] = useState<BYOConnectRequest>({
    access_token: "",
    phone_number_id: "",
    waba_id: "",
    app_secret: "",
  });

  const loadStatus = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await getByoStatus(storeId);
      setStatus(res);
    } catch {
      // ignore — page still usable for first connect
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleConnect = async () => {
    if (!storeId) return;
    setSubmitting(true);
    setValidationError(null);
    try {
      const res = await byoConnect(storeId, form);
      setStatus(res);
      toast.success(isAr ? "تم الاتصال بنجاح" : "Connected successfully");
    } catch (e: unknown) {
      const err = e as { detail?: BYOValidationFailure; body?: { detail?: BYOValidationFailure } };
      const detail = err?.detail || err?.body?.detail;
      if (detail && typeof detail === "object" && "failed_step" in detail) {
        setValidationError(detail as BYOValidationFailure);
      } else {
        toast.error(isAr ? "فشل الاتصال" : "Connection failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!storeId) return;
    if (!confirm(isAr ? "فصل رقمك والعودة لرقم NUMU؟" : "Disconnect your number and revert to NUMU?")) return;
    try {
      const res = await byoDisconnect(storeId);
      setStatus(res);
      toast.success(isAr ? "تم الفصل" : "Disconnected");
    } catch {
      toast.error(isAr ? "فشل الفصل" : "Disconnect failed");
    }
  };

  const isByo = status?.mode === "byo";
  const formValid = Object.values(form).every((v) => v.trim().length > 0);

  const fields: Array<{
    key: keyof BYOConnectRequest;
    label_en: string;
    label_ar: string;
    hint_en: string;
    hint_ar: string;
    mono?: boolean;
  }> = [
    {
      key: "phone_number_id",
      label_en: "Phone Number ID",
      label_ar: "معرّف رقم الهاتف",
      hint_en: "WhatsApp > API Setup",
      hint_ar: "واتساب > إعداد API",
    },
    {
      key: "waba_id",
      label_en: "WhatsApp Business Account ID",
      label_ar: "معرّف حساب واتساب للأعمال",
      hint_en: "Business Settings > Accounts",
      hint_ar: "إعدادات الأعمال > الحسابات",
    },
    {
      key: "access_token",
      label_en: "Access Token",
      label_ar: "رمز الوصول",
      hint_en: "System User > Generate Token",
      hint_ar: "مستخدم النظام > إنشاء رمز",
      mono: true,
    },
    {
      key: "app_secret",
      label_en: "App Secret",
      label_ar: "سر التطبيق",
      hint_en: "App > Settings > Basic",
      hint_ar: "التطبيق > الإعدادات > أساسي",
      mono: true,
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6" dir={dir}>
        {/* Back to overview */}
        <button
          onClick={() => navigate("/whatsapp")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className={`h-4 w-4 ${isAr ? "rotate-180" : ""}`} />
          {isAr ? "رجوع إلى واتساب" : "Back to WhatsApp"}
        </button>

        {loading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
                <Phone className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {isAr ? "اربط رقم واتساب الخاص بك" : "Connect your own WhatsApp number"}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {isAr
                    ? "استخدم حساب Meta WhatsApp Business الخاص بك بدلاً من رقم NUMU المشترك — رسائلك تصل من اسم علامتك التجارية."
                    : "Use your own Meta WhatsApp Business account instead of the shared NUMU number — messages arrive from your own brand name."}
                </p>
              </div>
            </div>

            {isByo ? (
              /* ── Connected state ── */
              <Card className="border-emerald-200 dark:border-emerald-900/50">
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                      <ShieldCheck className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{status?.phone_display_name || (isAr ? "متصل" : "Connected")}</p>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <p className="text-sm text-muted-foreground">{status?.display_phone_number}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {status?.waba_id && (
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">WABA ID</p>
                        <p className="font-mono text-xs truncate mt-0.5">{status.waba_id}</p>
                      </div>
                    )}
                    {status?.last_validated_at && (
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">{isAr ? "آخر تحقق" : "Last validated"}</p>
                        <p className="text-xs mt-0.5">
                          {new Date(status.last_validated_at).toLocaleString(isAr ? "ar-EG" : "en-US")}
                        </p>
                      </div>
                    )}
                  </div>

                  {status?.credential_error && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{status.credential_error}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="outline" onClick={handleDisconnect}>
                      {isAr ? "فصل الرقم والعودة لـ NUMU" : "Disconnect & revert to NUMU"}
                    </Button>
                    <Button variant="ghost" onClick={() => navigate("/whatsapp")}>
                      {isAr ? "إدارة الإشعارات" : "Manage notifications"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* ── Connect form ── */
              <>
                {/* What you'll need */}
                <Card className="bg-muted/30 border-dashed">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Info className="h-4 w-4 text-muted-foreground" />
                      {isAr ? "ما الذي تحتاجه؟" : "What you'll need"}
                    </CardTitle>
                    <CardDescription>
                      {isAr
                        ? "أربع قيم من لوحة مطوّري Meta. لا نخزّن رمزك إلا مشفّراً، وللإرسال فقط."
                        : "Four values from your Meta developer dashboard. Your token is stored encrypted and used only to send."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <a
                      href={META_DEV_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:underline"
                    >
                      {isAr ? "افتح لوحة مطوّري Meta" : "Open Meta developer dashboard"}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </CardContent>
                </Card>

                {/* Validation error */}
                {validationError && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-destructive">
                          {isAr ? "فشل التحقق" : "Validation failed"}
                          <span className="text-muted-foreground font-normal"> · {validationError.failed_step}</span>
                        </p>
                        <p className="text-foreground/80 mt-1">
                          {ERROR_HINTS[validationError.code]
                            ? isAr
                              ? ERROR_HINTS[validationError.code].ar
                              : ERROR_HINTS[validationError.code].en
                            : validationError.message}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Credential fields */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <KeyRound className="h-4 w-4 text-emerald-600" />
                      {isAr ? "بيانات الاعتماد" : "Credentials"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {fields.map((f) => (
                      <div key={f.key} className="space-y-1.5">
                        <Label htmlFor={f.key}>{isAr ? f.label_ar : f.label_en}</Label>
                        <Input
                          id={f.key}
                          type={f.mono ? "password" : "text"}
                          value={form[f.key]}
                          onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                          className={f.mono ? "font-mono text-xs" : ""}
                          dir="ltr"
                        />
                        <p className="text-xs text-muted-foreground">
                          {isAr ? "من: " : "From: "}
                          {isAr ? f.hint_ar : f.hint_en}
                        </p>
                      </div>
                    ))}

                    <Button
                      onClick={handleConnect}
                      disabled={submitting || !formValid}
                      className="w-full gap-2"
                    >
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {isAr ? "ربط الحساب" : "Connect account"}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      {isAr
                        ? "تذكّر: يمكنك العودة لرقم NUMU في أي وقت."
                        : "You can switch back to the NUMU number anytime."}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
  );
}
