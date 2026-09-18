import { useEffect, useState } from "react";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { SettingsBreadcrumb } from "@/components/layout/SettingsBreadcrumb";
import { ApiKeysPanel } from "@/components/developers/ApiKeysPanel";
import { WebhooksPanel } from "@/components/developers/WebhooksPanel";
import { ApiAccessState, fetchApiAccess } from "@/services/developerApi";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Code2, Lock, ShieldAlert, Terminal } from "lucide-react";

const DOCS = "https://docs.numueg.app";

export default function DevelopersPage() {
  const { currentStore } = useDashboardStore();
  const { isRTL } = useLanguage();
  const t = (en: string, ar: string) => (isRTL ? ar : en);
  const storeId = currentStore?.id;

  const [access, setAccess] = useState<ApiAccessState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    fetchApiAccess(storeId)
      .then(setAccess)
      // An older API (or a network blip) must not lock the merchant out of
      // their own keys: fall back to showing the panels.
      .catch(() =>
        setAccess({
          allowed: true,
          source: null,
          plan: "",
          in_plan: true,
          granted: false,
        }),
      )
      .finally(() => setLoading(false));
  }, [storeId]);

  const allowed = access?.allowed ?? false;

  return (
    <div className="space-y-6 p-4 md:p-6" dir={isRTL ? "rtl" : "ltr"}>
      <SettingsBreadcrumb current={t("Developers", "المطوّرين")} />

      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Code2 className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{t("Developers", "المطوّرين")}</h1>
            {access?.allowed && (
              <Badge className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {access.source === "grant"
                  ? t("Enabled by NUMU", "مفعّل من NUMU")
                  : t("Included in your plan", "ضمن باقتك")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {t(
              "Connect this store to your own systems: an API key for reading and writing, webhooks for hearing about what happens.",
              "اربط متجرك بأنظمتك: مفتاح API للقراءة والتعديل، وwebhooks عشان تعرف أول بأول اللي بيحصل.",
            )}
          </p>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : !allowed ? (
        <Card className="border-amber-200 dark:border-amber-900/50">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <Lock className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="font-semibold">
                {t("API access is not enabled yet", "الـ API مش مفعّل لحد دلوقتي")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t(
                  "The API and webhooks are included in the Pro plan. On any other plan, NUMU can switch them on for your store — tell us what you are building and we will enable it.",
                  "الـ API والـ webhooks ضمن باقة Pro. ولو على باقة تانية، NUMU تقدر تفعّلهم لمتجرك — قولنا بتبني إيه وهنفعّلهم.",
                )}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild>
                  <a href="mailto:engineering@numueg.app?subject=API access">
                    {t("Request access", "اطلب التفعيل")}
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href={`${DOCS}/api/overview`} target="_blank" rel="noreferrer">
                    <BookOpen className="h-4 w-4 me-1" />
                    {t("See what the API does", "شوف الـ API بيعمل إيه")}
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ApiKeysPanel storeId={storeId} disabled={!allowed} />

      {allowed && <WebhooksPanel storeId={storeId} />}

      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <div className="flex-1 space-y-1">
            <h2 className="flex items-center gap-2 font-semibold">
              <BookOpen className="h-4 w-4" />
              {t("Documentation", "التوثيق")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t(
                "460 endpoints with examples in cURL, JavaScript, Python and PHP, plus the webhook contract and a 5-minute quickstart.",
                "٤٦٠ endpoint بأمثلة بـ cURL وJavaScript وPython وPHP، مع شرح الـ webhooks وبداية سريعة في ٥ دقايق.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href={`${DOCS}/api/quickstart`} target="_blank" rel="noreferrer">
                {t("Quickstart", "ابدأ بسرعة")}
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`${DOCS}/api/reference/orders`} target="_blank" rel="noreferrer">
                {t("Endpoints", "الـ endpoints")}
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/settings/mcp">
                <Terminal className="h-4 w-4 me-1" />
                {t("Connect an AI", "اربط ذكاء اصطناعي")}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        {t(
          "Keys act as you, within the permissions you give them. Keep them out of browsers and phone apps, give each integration its own key, and revoke anything you no longer use.",
          "المفاتيح بتشتغل باسمك في حدود الصلاحيات اللي تديها. متحطهاش في المتصفح أو تطبيق الموبايل، اعمل مفتاح لكل تكامل، وألغِ أي مفتاح مش مستخدم.",
        )}
      </p>
    </div>
  );
}
