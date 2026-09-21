import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { SettingsBreadcrumb } from "@/components/layout/SettingsBreadcrumb";
import { ApiKeysPanel } from "@/components/developers/ApiKeysPanel";
import { CopyBox } from "@/components/developers/CopyBox";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Code2, ShieldAlert } from "lucide-react";

const MCP_URL = "https://mcp.numueg.app/mcp";
const KEY_PLACEHOLDER = "numu_pat_YOUR_KEY_HERE";

const headerSnippet = (key: string) => `Authorization: Bearer ${key}`;

const claudeCodeSnippet = (key: string) =>
  `claude mcp add --transport http numu ${MCP_URL} --header "Authorization: Bearer ${key}"`;

const jsonSnippet = (key: string) =>
  JSON.stringify(
    {
      mcpServers: {
        numu: { url: MCP_URL, headers: { Authorization: `Bearer ${key}` } },
      },
    },
    null,
    2,
  );

export default function McpConnectPage() {
  const { currentStore } = useDashboardStore();
  const { isRTL } = useLanguage();
  const t = (en: string, ar: string) => (isRTL ? ar : en);
  const storeId = currentStore?.id;

  return (
    <div className="space-y-6 md:p-6" dir={isRTL ? "rtl" : "ltr"}>
      <SettingsBreadcrumb current={t("Connect your AI (MCP)", "اربط الذكاء الاصطناعي (MCP)")} />

      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Bot className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {t("Connect your AI (MCP)", "اربط الذكاء الاصطناعي (MCP)")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "Let Claude, ChatGPT, Cursor or any AI assistant manage this store — create products, upload images, read analytics and more.",
              "خلّي Claude أو ChatGPT أو أي مساعد ذكاء اصطناعي يدير متجرك — إنشاء منتجات، رفع صور، قراءة التحليلات وأكثر.",
            )}
          </p>
        </div>
      </div>

      <ApiKeysPanel
        storeId={storeId}
        createdExtra={(token) => (
          <CopyBox
            label={t("Ready-to-paste for Claude Code", "جاهز للصق في Claude Code")}
            text={claudeCodeSnippet(token)}
          />
        )}
      />

      {/* ---- Connection instructions ---- */}
      <Card>
        <CardHeader>
          <CardTitle>{t("How to connect", "طريقة الربط")}</CardTitle>
          <CardDescription>
            {t(
              "Create a key above, then follow the steps for your AI app. Server URL:",
              "أنشئ مفتاحًا بالأعلى، ثم اتبع خطوات تطبيق الذكاء الاصطناعي بتاعك. رابط الخادم:",
            )}{" "}
            <code dir="ltr">{MCP_URL}</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="claude" dir={isRTL ? "rtl" : "ltr"}>
            <TabsList>
              <TabsTrigger value="claude">Claude</TabsTrigger>
              <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
              <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
              <TabsTrigger value="cursor">Cursor / {t("Other", "أخرى")}</TabsTrigger>
            </TabsList>
            <TabsContent value="claude" className="space-y-3 pt-3 text-sm">
              <ol className="list-decimal space-y-1 ps-5">
                <li>
                  {t(
                    "Open claude.ai → Settings → Connectors",
                    "افتح claude.ai ← الإعدادات ← Connectors",
                  )}
                </li>
                <li>{t('Click "Add custom connector"', 'اضغط "Add custom connector"')}</li>
                <li>
                  {t(
                    "Paste the server URL and add the header below",
                    "الصق رابط الخادم وأضف الهيدر التالي",
                  )}
                </li>
              </ol>
              <CopyBox label="Server URL" text={MCP_URL} />
              <CopyBox label="Header" text={headerSnippet(KEY_PLACEHOLDER)} />
            </TabsContent>
            <TabsContent value="claude-code" className="space-y-3 pt-3 text-sm">
              <p>
                {t("Run this once in your terminal:", "شغّل الأمر ده مرة واحدة في التيرمينال:")}
              </p>
              <CopyBox text={claudeCodeSnippet(KEY_PLACEHOLDER)} />
            </TabsContent>
            <TabsContent value="chatgpt" className="space-y-3 pt-3 text-sm">
              <ol className="list-decimal space-y-1 ps-5">
                <li>
                  {t(
                    "In ChatGPT: Settings → Apps & Connectors → Advanced → enable Developer mode",
                    "في ChatGPT: الإعدادات ← Apps & Connectors ← Advanced ← فعّل وضع المطوّر",
                  )}
                </li>
                <li>
                  {t(
                    'Create a new app with the server URL, auth type "Custom headers"',
                    'أنشئ تطبيقًا جديدًا برابط الخادم ونوع مصادقة "Custom headers"',
                  )}
                </li>
                <li>{t("Add the Authorization header below", "أضف هيدر Authorization التالي")}</li>
              </ol>
              <CopyBox label="Server URL" text={MCP_URL} />
              <CopyBox label="Header" text={headerSnippet(KEY_PLACEHOLDER)} />
            </TabsContent>
            <TabsContent value="cursor" className="space-y-3 pt-3 text-sm">
              <p>
                {t(
                  "Add this to your MCP config (e.g. .cursor/mcp.json or any MCP-capable app):",
                  "أضف ده لملف إعدادات MCP (مثلاً ‎.cursor/mcp.json أو أي تطبيق يدعم MCP):",
                )}
              </p>
              <CopyBox text={jsonSnippet(KEY_PLACEHOLDER)} />
            </TabsContent>
          </Tabs>
          <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            {t(
              "Treat keys like passwords. Prefer read-only keys unless your AI needs to make changes; revoke any key you no longer use.",
              "عامل المفاتيح زي كلمات السر. يفضَّل مفتاح قراءة فقط إلا لو الذكاء الاصطناعي محتاج يعدّل؛ وألغِ أي مفتاح مش مستخدم.",
            )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center">
          <div className="flex-1 space-y-1">
            <h2 className="flex items-center gap-2 font-semibold">
              <Code2 className="h-4 w-4" />
              {t("Building your own integration?", "بتبني تكامل بنفسك؟")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t(
                "The same keys work against the REST API, and webhooks tell your system when something happens.",
                "نفس المفاتيح بتشتغل مع REST API، والـ webhooks بتبلّغ نظامك أول ما يحصل أي حاجة.",
              )}
            </p>
          </div>
          <Button variant="outline" asChild>
            <a href="/settings/developers">{t("Open Developers", "افتح المطوّرين")}</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
