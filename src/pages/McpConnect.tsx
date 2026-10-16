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
import { Bot, Code2, Download, ShieldAlert } from "lucide-react";
import { MCP_URL } from "@/services/mcpApi";

const KEY_PLACEHOLDER = "numu_pat_YOUR_KEY_HERE";
/** The archive for ChatGPT's "Upload plugin archive" (numu-mcp oauth.py). */
const CHATGPT_PLUGIN_URL = `${new URL(MCP_URL).origin}/chatgpt-plugin.zip`;

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
              "ChatGPT and Claude connect by signing in to NUMU — no key needed. Claude Code, Cursor and other apps use a key from above. Server URL:",
              "ChatGPT و Claude بيتربطوا لما تدخل حساب NUMU — من غير مفتاح. Claude Code و Cursor وباقي التطبيقات بتستخدم مفتاح من اللي فوق. رابط الخادم:",
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
                <li>
                  {t(
                    'Click "Add custom connector" and paste the server URL',
                    'اضغط "Add custom connector" والصق رابط الخادم',
                  )}
                </li>
                <li>
                  {t(
                    "Click Connect, then sign in to NUMU and approve",
                    "اضغط Connect، وبعدين ادخل حساب NUMU ووافق",
                  )}
                </li>
              </ol>
              <CopyBox label="Server URL" text={MCP_URL} />
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
                    'On the web, open chatgpt.com/plugins → + → "Add custom MCP server"',
                    'من المتصفح افتح chatgpt.com/plugins ← + ← "Add custom MCP server"',
                  )}
                </li>
                <li>
                  {t(
                    'Type NUMU in Name, paste the server URL below, and pick "OAuth" in Authentication',
                    'اكتب NUMU في Name، والصق رابط الخادم اللي تحت، واختار "OAuth" في Authentication',
                  )}
                </li>
                <li>
                  {t(
                    'Tick "I understand…", click "Create as a plugin", then sign in to NUMU and approve',
                    'علّم على "I understand…" واضغط "Create as a plugin"، وبعدين ادخل حساب NUMU ووافق',
                  )}
                </li>
              </ol>
              <CopyBox label="Server URL" text={MCP_URL} />
              <p className="text-muted-foreground">
                {t(
                  'Or download the NUMU plugin and upload it with "Upload plugin archive" in the same window:',
                  'أو نزّل ملف NUMU وارفعه من "Upload plugin archive" في نفس الشاشة:',
                )}
              </p>
              <Button variant="outline" asChild>
                <a href={CHATGPT_PLUGIN_URL}>
                  <Download className="me-2 h-4 w-4" />
                  {t("Download the ChatGPT plugin", "نزّل ملف ChatGPT")}
                </a>
              </Button>
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
