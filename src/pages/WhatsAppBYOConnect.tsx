import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  byoDisconnect,
  completeSignup,
  getByoStatus,
  getSignupConfig,
  type EmbeddedSignupConfig,
  type WhatsAppStatus,
} from "@/services/whatsappApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WhatsAppGlyph } from "@/components/whatsapp/WhatsAppGlyph";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock3,
  Globe2,
  Loader2,
  LockKeyhole,
  MessageCircleMore,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  Zap,
} from "lucide-react";

const META_SDK_ID = "meta-jssdk";
const META_SDK_URL = "https://connect.facebook.net/en_US/sdk.js";

type MetaLoginResponse = {
  authResponse?: { code?: string };
  status?: string;
};

type MetaSignupSelection = {
  waba_id?: string;
  phone_number_id?: string;
  business_id?: string;
};

declare global {
  interface Window {
    FB?: {
      init: (options: {
        appId: string;
        cookie: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: MetaLoginResponse) => void,
        options: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

function loadMetaSdk(appId: string, graphApiVersion: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const initialize = () => {
      if (!window.FB) {
        reject(new Error("Meta SDK did not load"));
        return;
      }
      window.FB.init({
        appId,
        cookie: true,
        xfbml: true,
        version: graphApiVersion,
      });
      resolve();
    };

    if (window.FB) {
      initialize();
      return;
    }

    window.fbAsyncInit = initialize;
    const existing = document.getElementById(META_SDK_ID);
    if (existing) {
      existing.addEventListener("load", initialize, { once: true });
      existing.addEventListener("error", () => reject(new Error("Meta SDK failed to load")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = META_SDK_ID;
    script.src = META_SDK_URL;
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => reject(new Error("Meta SDK failed to load"));
    document.body.appendChild(script);
  });
}

export default function WhatsAppBYOConnect() {
  const { currentStore } = useDashboardStore();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const navigate = useNavigate();
  const storeId = currentStore?.id;

  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [config, setConfig] = useState<EmbeddedSignupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState("");
  const selectionRef = useRef<MetaSignupSelection>({});

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const [statusResult, configResult] = await Promise.allSettled([
      getByoStatus(storeId),
      getSignupConfig(storeId),
    ]);
    if (statusResult.status === "fulfilled") setStatus(statusResult.value);
    if (configResult.status === "fulfilled") setConfig(configResult.value);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!config?.enabled || !config.app_id) return;
    setSdkError("");
    loadMetaSdk(config.app_id, config.graph_api_version)
      .then(() => setSdkReady(true))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Meta SDK failed to load";
        setSdkError(message);
        console.error("Meta Embedded Signup SDK failed", error);
      });
  }, [config]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      ) {
        return;
      }

      try {
        const payload =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;

        if (payload.event === "FINISH" && payload.data) {
          selectionRef.current = {
            waba_id: payload.data.waba_id,
            phone_number_id: payload.data.phone_number_id,
            business_id: payload.data.business_id,
          };
        }
      } catch {
        // Meta also posts non-JSON SDK messages; they are unrelated.
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const connectOwnNumber = () => {
    if (!storeId || !config?.enabled || !config.app_id || !config.config_id) {
      toast.error(
        isAr
          ? "إعداد الربط مع Meta غير مكتمل. تواصل مع دعم NUMU."
          : "Meta signup is not configured yet. Contact NUMU support."
      );
      return;
    }
    if (!sdkReady || !window.FB) {
      toast.error(
        sdkError ||
          (isAr
            ? "نافذة Meta لا تزال قيد التحميل. حاول مرة أخرى."
            : "Meta signup is still loading. Try again.")
      );
      return;
    }

    setConnecting(true);
    selectionRef.current = {};

    try {
      window.FB.login(
        (response) => {
          void (async () => {
            const code = response.authResponse?.code;
            if (!code) {
              setConnecting(false);
              if (response.status !== "unknown") {
                toast.error(
                  isAr
                    ? "لم يكتمل ربط واتساب. حاول مرة أخرى."
                    : "WhatsApp connection was not completed. Please try again."
                );
              }
              return;
            }

            try {
              await completeSignup(storeId, code, selectionRef.current);
              setConnecting(false);
              toast.success(
                isAr
                  ? "تم ربط رقم واتساب الخاص بك بنجاح"
                  : "Your WhatsApp number is now connected"
              );
              navigate("/whatsapp", { replace: true });
            } catch {
              toast.error(
                isAr
                  ? "تعذّر إكمال الربط مع Meta. حاول مرة أخرى."
                  : "NUMU could not finish the Meta connection. Please try again."
              );
            } finally {
              setConnecting(false);
            }
          })();
        },
        {
          config_id: config.config_id,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: "whatsapp_business_app_onboarding",
            sessionInfoVersion: "3",
            version: "v4",
            features: [{ name: "app_only_install" }],
          },
        }
      );
    } catch (error) {
      setConnecting(false);
      const detail = error instanceof Error ? error.message : "Meta SDK unavailable";
      console.error("Meta Embedded Signup could not open", error);
      toast.error(
        isAr
          ? "تعذّر تحميل نافذة Meta. تحقق من المتصفح وحاول مرة أخرى."
          : `Meta signup could not open: ${detail}`
      );
    }
  };

  const useSharedNumber = async () => {
    if (!storeId) return;
    if (status?.mode !== "byo") {
      navigate("/whatsapp");
      return;
    }

    if (
      !window.confirm(
        isAr
          ? "هل تريد فصل رقمك والعودة إلى رقم NUMU المشترك؟"
          : "Disconnect your number and switch back to the shared NUMU number?"
      )
    ) {
      return;
    }

    setSwitching(true);
    try {
      const updated = await byoDisconnect(storeId);
      setStatus(updated);
      toast.success(
        isAr
          ? "تم التبديل إلى رقم NUMU المشترك"
          : "Switched to the shared NUMU number"
      );
    } catch {
      toast.error(isAr ? "تعذّر تغيير الاتصال" : "Could not change the connection");
    } finally {
      setSwitching(false);
    }
  };

  const isOwnNumber = status?.mode === "byo";

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto max-w-6xl space-y-6 p-4 md:p-8"
      dir={isAr ? "rtl" : "ltr"}
    >
      <button
        type="button"
        onClick={() => navigate("/whatsapp")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className={isAr ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
        {isAr ? "العودة إلى واتساب" : "Back to WhatsApp"}
      </button>

      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-slate-950 via-emerald-950 to-emerald-800 p-6 text-white md:p-8">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-emerald-300/15 blur-3xl" />
        <div className="relative max-w-3xl">
          <Badge className="mb-4 gap-1.5 border-white/15 bg-white/10 text-white hover:bg-white/10">
            <ShieldCheck className="h-3.5 w-3.5" />
            {isAr ? "اتصال رسمي من Meta" : "Official Meta connection"}
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight md:text-4xl">
            {isAr ? "اختر هوية واتساب لمتجرك" : "Choose how your store appears on WhatsApp"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 md:text-base">
            {isAr
              ? "ابدأ فوراً برقم NUMU المشترك، أو اربط رقم علامتك التجارية عبر إعداد Meta الآمن."
              : "Start instantly with NUMU's shared number, or connect your brand's own number through Meta's secure signup."}
          </p>
        </div>
      </section>

      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        <ConnectionOption
          selected={!isOwnNumber}
          recommended
          recommendedLabel={isAr ? "موصى به" : "Recommended"}
          icon={<WhatsAppGlyph className="h-7 w-7 text-white" />}
          iconClassName="bg-[#25D366]"
          eyebrow={isAr ? "أسرع إعداد" : "Fastest setup"}
          title={isAr ? "رقم NUMU المشترك" : "NUMU shared WhatsApp"}
          description={
            isAr
              ? "أرسل تحديثات الطلب فوراً من رقم NUMU الموثق دون الحاجة إلى حساب Meta."
              : "Send order updates immediately from NUMU's verified number with no Meta setup."
          }
          features={[
            isAr ? "تفعيل فوري" : "Instant activation",
            isAr ? "القوالب يديرها NUMU" : "Templates managed by NUMU",
            isAr ? "تأكيدات الطلب والدفع والشحن" : "Order, payment and shipping updates",
            isAr ? "صندوق وارد داخل NUMU" : "Inbox inside NUMU",
          ]}
          action={
            <Button
              className="w-full gap-2"
              variant={!isOwnNumber ? "outline" : "default"}
              disabled={switching}
              onClick={useSharedNumber}
            >
              {switching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {!isOwnNumber
                ? isAr ? "الخيار الحالي" : "Current option"
                : isAr ? "التبديل إلى NUMU" : "Switch to NUMU"}
            </Button>
          }
        />

        <ConnectionOption
          selected={isOwnNumber}
          icon={<Store className="h-6 w-6" />}
          iconClassName="bg-primary/10 text-primary"
          eyebrow={isAr ? "هوية علامتك التجارية" : "Your brand identity"}
          title={isAr ? "رقم واتساب الخاص بك" : "Your own WhatsApp number"}
          description={
            isAr
              ? "اربط حساب واتساب للأعمال الذي تملكه، واجعل الرسائل تظهر باسم علامتك التجارية."
              : "Connect a WhatsApp Business account you own and send from your brand identity."
          }
          features={[
            isAr ? "رقم واسم علامتك التجارية" : "Your number and business name",
            isAr ? "ربط آمن عبر Meta" : "Secure Meta Embedded Signup",
            isAr ? "قوالب خاصة بمتجرك" : "Store-specific templates",
            isAr ? "يمكنك الفصل أو التغيير لاحقاً" : "Disconnect or switch later",
          ]}
          detail={
            isOwnNumber ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-medium">
                    {status?.phone_display_name || (isAr ? "متصل عبر Meta" : "Connected through Meta")}
                  </p>
                </div>
                {status?.display_phone_number && (
                  <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                    {status.display_phone_number}
                  </p>
                )}
              </div>
            ) : !config?.enabled || sdkError ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                {sdkError || (isAr
                  ? "يجب إضافة App ID وConfig ID الخاصين بـ Meta في إعدادات NUMU أولاً."
                  : "NUMU's Meta App ID and configuration ID must be added before signup can open.")}
              </div>
            ) : null
          }
          action={
            <Button
              className="w-full gap-2"
              disabled={connecting || isOwnNumber || !config?.enabled || !sdkReady}
              onClick={connectOwnNumber}
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isOwnNumber ? (
                <BadgeCheck className="h-4 w-4" />
              ) : (
                <Globe2 className="h-4 w-4" />
              )}
              {isOwnNumber
                ? isAr ? "متصل" : "Connected"
                : connecting
                ? isAr ? "جارٍ فتح Meta..." : "Opening Meta..."
                : !sdkReady
                ? isAr ? "جارٍ تجهيز Meta..." : "Preparing Meta..."
                : isAr ? "الربط باستخدام Meta" : "Connect with Meta"}
            </Button>
          }
        />
      </div>

      <Card className="border-border/70 bg-muted/20 shadow-none">
        <CardContent className="grid gap-5 p-5 md:grid-cols-3 md:p-6">
          <TrustItem
            icon={LockKeyhole}
            title={isAr ? "بيانات آمنة" : "Secure credentials"}
            text={isAr ? "يحفظ NUMU رمز الربط مشفراً." : "NUMU stores the connection token encrypted."}
          />
          <TrustItem
            icon={RefreshCw}
            title={isAr ? "يمكنك التغيير" : "Switch any time"}
            text={isAr ? "ارجع للرقم المشترك دون فقد إعدادات الطلب." : "Return to the shared number without losing order settings."}
          />
          <TrustItem
            icon={MessageCircleMore}
            title={isAr ? "نفس أدوات NUMU" : "Same NUMU tools"}
            text={isAr ? "الصندوق والقوالب والأتمتة تعمل في الخيارين." : "Inbox, templates and automation work with either option."}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionOption({
  selected,
  recommended = false,
  recommendedLabel,
  icon,
  iconClassName,
  eyebrow,
  title,
  description,
  features,
  detail,
  action,
}: {
  selected: boolean;
  recommended?: boolean;
  recommendedLabel?: string;
  icon: ReactNode;
  iconClassName: string;
  eyebrow: string;
  title: string;
  description: string;
  features: string[];
  detail?: ReactNode;
  action: ReactNode;
}) {
  const cardClass = selected
    ? "relative overflow-hidden rounded-2xl border-emerald-500 shadow-md shadow-emerald-950/5 ring-1 ring-emerald-500"
    : "relative overflow-hidden rounded-2xl border-border/70 shadow-sm transition-all hover:border-foreground/20";

  return (
    <Card className={cardClass}>
      {recommended && (
        <Badge className="absolute right-4 top-4 border-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300">
          <Sparkles className="mr-1 h-3 w-3" />
          {recommendedLabel}
        </Badge>
      )}
      <CardContent className="flex h-full flex-col p-5 md:p-6">
        <div className={"flex h-12 w-12 items-center justify-center rounded-2xl " + iconClassName}>
          {icon}
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {eyebrow}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <h2 className="text-xl font-bold">{title}</h2>
          {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />}
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>

        <div className="my-5 space-y-3 border-y py-5">
          {features.map((feature) => (
            <div key={feature} className="flex items-center gap-2.5 text-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30">
                <Check className="h-3.5 w-3.5" />
              </span>
              {feature}
            </div>
          ))}
        </div>

        {detail && <div className="mb-4">{detail}</div>}
        <div className="mt-auto">{action}</div>
      </CardContent>
    </Card>
  );
}

function TrustItem({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Phone;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm">
        <Icon className="h-4 w-4 text-emerald-600" />
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
