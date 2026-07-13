import { useCallback, useEffect, useState } from "react";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { SettingsBreadcrumb } from "@/components/layout/SettingsBreadcrumb";
import {
  AccessToken,
  CreatedAccessToken,
  SCOPE_DOMAINS,
  createAccessToken,
  listAccessTokens,
  revokeAccessToken,
} from "@/services/mcpApi";
import { showError } from "@/lib/show-error";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bot, Check, Copy, KeyRound, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";

const MCP_URL = "https://mcp.numueg.app/mcp";

const DOMAIN_LABELS: Record<string, { en: string; ar: string }> = {
  catalog: { en: "Products & catalog", ar: "المنتجات والكتالوج" },
  media: { en: "Images & media", ar: "الصور والوسائط" },
  orders: { en: "Orders & shipping", ar: "الطلبات والشحن" },
  customers: { en: "Customers", ar: "العملاء" },
  analytics: { en: "Analytics", ar: "التحليلات" },
  marketing: { en: "Marketing & pixels", ar: "التسويق والـ Pixels" },
  themes: { en: "Theme & pages", ar: "الثيم والصفحات" },
  risk: { en: "Trust network (COD risk)", ar: "شبكة الثقة (مخاطر الدفع عند الاستلام)" },
  settings: { en: "Store settings", ar: "إعدادات المتجر" },
};

/** Default recommendation: read everything + write catalog/media only. */
const RECOMMENDED_SCOPES = [
  ...SCOPE_DOMAINS.map((d) => `${d}:read`),
  "catalog:write",
  "media:write",
];

function CopyBox({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div className="space-y-1">
      {label && <div className="text-xs text-muted-foreground">{label}</div>}
      <div className="flex items-start gap-2">
        <pre
          dir="ltr"
          className="flex-1 rounded-md border bg-muted p-3 text-xs font-mono break-words whitespace-pre-wrap [overflow-wrap:anywhere]"
        >
          {text}
        </pre>
        <Button variant="outline" size="icon" onClick={copy} className="shrink-0">
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function McpConnectPage() {
  const { currentStore } = useDashboardStore();
  const { isRTL } = useLanguage();
  const t = (en: string, ar: string) => (isRTL ? ar : en);
  const storeId = currentStore?.id;

  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [loading, setLoading] = useState(true);

  // create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [fullAccess, setFullAccess] = useState(false);
  const [scopes, setScopes] = useState<Set<string>>(new Set(RECOMMENDED_SCOPES));
  const [expiry, setExpiry] = useState<string>("365");
  const [creating, setCreating] = useState(false);

  // token-shown-once dialog
  const [created, setCreated] = useState<CreatedAccessToken | null>(null);

  // revoke dialog
  const [revoking, setRevoking] = useState<AccessToken | null>(null);

  const refresh = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      setTokens(await listAccessTokens(storeId));
    } catch (err) {
      showError(err, t("Failed to load API keys", "فشل تحميل مفاتيح API"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleScope = (scope: string) => {
    setScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  const create = async () => {
    if (!storeId || !name.trim()) return;
    if (!fullAccess && scopes.size === 0) {
      toast.error(t("Pick at least one permission", "اختر صلاحية واحدة على الأقل"));
      return;
    }
    setCreating(true);
    try {
      const result = await createAccessToken(storeId, {
        name: name.trim(),
        scopes: fullAccess ? ["*"] : Array.from(scopes),
        expires_in_days: expiry === "never" ? undefined : Number(expiry),
      });
      setCreated(result);
      setCreateOpen(false);
      setName("");
      setFullAccess(false);
      setScopes(new Set(RECOMMENDED_SCOPES));
      refresh();
    } catch (err) {
      showError(err, t("Failed to create the key", "فشل إنشاء المفتاح"));
    } finally {
      setCreating(false);
    }
  };

  const doRevoke = async () => {
    if (!storeId || !revoking) return;
    try {
      await revokeAccessToken(storeId, revoking.id);
      toast.success(t("Key revoked", "تم إلغاء المفتاح"));
      setRevoking(null);
      refresh();
    } catch (err) {
      showError(err, t("Failed to revoke the key", "فشل إلغاء المفتاح"));
    }
  };

  const scopeBadges = (token: AccessToken) => {
    if (!token.scopes || token.scopes.includes("*")) {
      return <Badge variant="destructive">{t("Full access", "صلاحية كاملة")}</Badge>;
    }
    const domains = new Set(token.scopes.map((s) => s.split(":")[0]));
    return (
      <div className="flex flex-wrap gap-1">
        {Array.from(domains).map((d) => {
          const write = token.scopes!.includes(`${d}:write`);
          return (
            <Badge key={d} variant={write ? "default" : "secondary"} className="text-[10px]">
              {DOMAIN_LABELS[d] ? t(DOMAIN_LABELS[d].en, DOMAIN_LABELS[d].ar) : d}
              {write ? "" : ` · ${t("read", "قراءة")}`}
            </Badge>
          );
        })}
      </div>
    );
  };

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(isRTL ? "ar-EG" : "en-GB") : "—";

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
  const KEY_PLACEHOLDER = "numu_pat_YOUR_KEY_HERE";

  return (
    <div className="space-y-6 p-4 md:p-6" dir={isRTL ? "rtl" : "ltr"}>
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

      {/* ---- API keys ---- */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {t("API keys", "مفاتيح API")}
            </CardTitle>
            <CardDescription>
              {t(
                "Each key is bound to THIS store only, with the permissions you pick.",
                "كل مفتاح مرتبط بهذا المتجر فقط، وبالصلاحيات اللي تختارها.",
              )}
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 me-1" />
            {t("Create key", "إنشاء مفتاح")}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : tokens.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t(
                "No keys yet. Create one to connect your AI.",
                "لا توجد مفاتيح بعد. أنشئ مفتاحًا لربط الذكاء الاصطناعي.",
              )}
            </p>
          ) : (
            <div className="divide-y">
              {tokens.map((token) => (
                <div key={token.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{token.name}</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs" dir="ltr">
                        {token.token_prefix}…
                      </code>
                      {token.revoked_at && (
                        <Badge variant="outline" className="text-destructive">
                          {t("Revoked", "ملغي")}
                        </Badge>
                      )}
                    </div>
                    {scopeBadges(token)}
                    <div className="text-xs text-muted-foreground">
                      {t("Created", "أُنشئ")}: {fmtDate(token.created_at)} ·{" "}
                      {t("Last used", "آخر استخدام")}: {fmtDate(token.last_used_at)} ·{" "}
                      {t("Expires", "ينتهي")}: {fmtDate(token.expires_at)}
                    </div>
                  </div>
                  {!token.revoked_at && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRevoking(token)}
                      title={t("Revoke", "إلغاء")}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                <li>{t("Open claude.ai → Settings → Connectors", "افتح claude.ai ← الإعدادات ← Connectors")}</li>
                <li>{t('Click "Add custom connector"', 'اضغط "Add custom connector"')}</li>
                <li>
                  {t("Paste the server URL and add the header below", "الصق رابط الخادم وأضف الهيدر التالي")}
                </li>
              </ol>
              <CopyBox label="Server URL" text={MCP_URL} />
              <CopyBox label="Header" text={headerSnippet(KEY_PLACEHOLDER)} />
            </TabsContent>
            <TabsContent value="claude-code" className="space-y-3 pt-3 text-sm">
              <p>{t("Run this once in your terminal:", "شغّل الأمر ده مرة واحدة في التيرمينال:")}</p>
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
                <li>{t('Create a new app with the server URL, auth type "Custom headers"', 'أنشئ تطبيقًا جديدًا برابط الخادم ونوع مصادقة "Custom headers"')}</li>
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

      {/* ---- Create dialog ---- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("Create API key", "إنشاء مفتاح API")}</DialogTitle>
            <DialogDescription>
              {t(
                "The key is shown once after creation — copy it immediately.",
                "المفتاح بيظهر مرة واحدة بعد الإنشاء — انسخه فورًا.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("Name", "الاسم")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("e.g. Claude", "مثال: Claude")}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Expires", "ينتهي بعد")}</Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">{t("30 days", "٣٠ يوم")}</SelectItem>
                  <SelectItem value="90">{t("90 days", "٩٠ يوم")}</SelectItem>
                  <SelectItem value="365">{t("1 year", "سنة")}</SelectItem>
                  <SelectItem value="never">{t("Never", "بدون انتهاء")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>{t("Full access", "صلاحية كاملة")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("Everything the owner can do. Not recommended.", "كل صلاحيات المالك. غير مُوصى به.")}
                </p>
              </div>
              <Switch checked={fullAccess} onCheckedChange={setFullAccess} />
            </div>
            {!fullAccess && (
              <div className="space-y-2">
                <Label>{t("Permissions", "الصلاحيات")}</Label>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-3">
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 pb-1 text-xs font-medium text-muted-foreground">
                    <span />
                    <span>{t("Read", "قراءة")}</span>
                    <span>{t("Write", "تعديل")}</span>
                  </div>
                  {SCOPE_DOMAINS.map((d) => (
                    <div key={d} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 py-1">
                      <span className="text-sm">
                        {DOMAIN_LABELS[d] ? t(DOMAIN_LABELS[d].en, DOMAIN_LABELS[d].ar) : d}
                      </span>
                      <Checkbox
                        className="justify-self-center"
                        checked={scopes.has(`${d}:read`)}
                        onCheckedChange={() => toggleScope(`${d}:read`)}
                      />
                      <Checkbox
                        className="justify-self-center"
                        checked={scopes.has(`${d}:write`)}
                        onCheckedChange={() => toggleScope(`${d}:write`)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button onClick={create} disabled={creating || !name.trim()}>
              {creating && <Loader2 className="h-4 w-4 me-1 animate-spin" />}
              {t("Create", "إنشاء")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Token shown once ---- */}
      <Dialog open={!!created} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent className="max-w-lg" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("Copy your key now", "انسخ مفتاحك الآن")}</DialogTitle>
            <DialogDescription>
              {t(
                "This is the ONLY time the key is shown. Store it somewhere safe.",
                "دي المرة الوحيدة اللي المفتاح هيظهر فيها. خزّنه في مكان آمن.",
              )}
            </DialogDescription>
          </DialogHeader>
          {created && (
            <div className="space-y-3">
              <CopyBox label={created.name} text={created.token} />
              <CopyBox
                label={t("Ready-to-paste for Claude Code", "جاهز للصق في Claude Code")}
                text={claudeCodeSnippet(created.token)}
              />
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>{t("Done — I saved it", "تم — خزّنته")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Revoke confirm ---- */}
      <AlertDialog open={!!revoking} onOpenChange={(open) => !open && setRevoking(null)}>
        <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("Revoke this key?", "إلغاء هذا المفتاح؟")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                `"${revoking?.name}" will stop working immediately. Any AI using it loses access. This cannot be undone.`,
                `"${revoking?.name}" هيتوقف فورًا وأي ذكاء اصطناعي بيستخدمه هيفقد الوصول. لا يمكن التراجع.`,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel", "إلغاء")}</AlertDialogCancel>
            <AlertDialogAction onClick={doRevoke} className="bg-destructive hover:bg-destructive/90">
              {t("Revoke", "إلغاء المفتاح")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
