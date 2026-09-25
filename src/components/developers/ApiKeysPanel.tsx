import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AccessToken,
  CreatedAccessToken,
  SCOPE_DOMAINS,
  createAccessToken,
  listAccessTokens,
  revokeAccessToken,
  rotateAccessToken,
} from "@/services/mcpApi";
import { showError } from "@/lib/show-error";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import { CopyBox } from "@/components/developers/CopyBox";
import { KeyRound, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

export const DOMAIN_LABELS: Record<string, { en: string; ar: string }> = {
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

interface Props {
  storeId: string | undefined;
  /** Copy blocks shown alongside the raw key, e.g. an MCP connect command. */
  createdExtra?: (rawToken: string) => ReactNode;
  title?: string;
  description?: string;
  /** Hidden when the store has no API access — nothing here would work. */
  disabled?: boolean;
}

export function ApiKeysPanel({
  storeId,
  createdExtra,
  title,
  description,
  disabled = false,
}: Props) {
  const { isRTL } = useLanguage();
  const t = (en: string, ar: string) => (isRTL ? ar : en);

  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [fullAccess, setFullAccess] = useState(false);
  const [scopes, setScopes] = useState<Set<string>>(new Set(RECOMMENDED_SCOPES));
  const [expiry, setExpiry] = useState("365");
  const [creating, setCreating] = useState(false);

  const [created, setCreated] = useState<CreatedAccessToken | null>(null);
  const [revoking, setRevoking] = useState<AccessToken | null>(null);
  const [rotating, setRotating] = useState<AccessToken | null>(null);

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
        expires_in_days: Number(expiry),
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

  const doRotate = async () => {
    if (!storeId || !rotating) return;
    try {
      setCreated(await rotateAccessToken(storeId, rotating.id));
      setRotating(null);
      refresh();
    } catch (err) {
      showError(err, t("Failed to rotate the key", "فشل تجديد المفتاح"));
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

  /** "2 minutes ago" — last use matters in minutes, not days. */
  const fmtAgo = (iso: string | null) => {
    if (!iso) return t("never", "لم يُستخدم");
    const rtf = new Intl.RelativeTimeFormat(isRTL ? "ar-EG" : "en", { numeric: "auto" });
    const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
    if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
    if (Math.abs(minutes) < 1440) return rtf.format(Math.round(minutes / 60), "hour");
    return rtf.format(Math.round(minutes / 1440), "day");
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {title ?? t("API keys", "مفاتيح API")}
            </CardTitle>
            <CardDescription>
              {description ??
                t(
                  "Each key is bound to THIS store only, with the permissions you pick.",
                  "كل مفتاح مرتبط بهذا المتجر فقط، وبالصلاحيات اللي تختارها.",
                )}
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)} disabled={disabled}>
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
                "No keys yet. Create one to start calling the API.",
                "لا توجد مفاتيح بعد. أنشئ مفتاحًا للبدء في استخدام الـ API.",
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
                      {t("Last used", "آخر استخدام")}: {fmtAgo(token.last_used_at)} ·{" "}
                      {t("Expires", "ينتهي")}: {fmtDate(token.expires_at)}
                    </div>
                  </div>
                  {!token.revoked_at && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRotating(token)}
                        title={t("Rotate", "تجديد")}
                        aria-label={t("Rotate", "تجديد")}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRevoking(token)}
                        title={t("Revoke", "إلغاء")}
                        aria-label={t("Revoke", "إلغاء")}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Create ---- */}
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
                placeholder={t("e.g. ERP sync", "مثال: ربط ERP")}
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
                  <SelectItem value="3650">{t("10 years", "١٠ سنوات")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>{t("Full access", "صلاحية كاملة")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "Everything the owner can do. Not recommended.",
                    "كل صلاحيات المالك. غير مُوصى به.",
                  )}
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
                    <div
                      key={d}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 py-1"
                    >
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

      {/* ---- Key shown once ---- */}
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
              {createdExtra?.(created.token)}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>
              {t("Done — I saved it", "تم — خزّنته")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Rotate ---- */}
      <AlertDialog open={!!rotating} onOpenChange={(open) => !open && setRotating(null)}>
        <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Rotate this key?", "تجديد هذا المفتاح؟")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                `"${rotating?.name}" gets a new secret with the same permissions. The current secret stops working immediately, so update your integration right after.`,
                `"${rotating?.name}" هياخد مفتاح سري جديد بنفس الصلاحيات. المفتاح الحالي هيتوقف فورًا، فحدّث الربط بتاعك على طول.`,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel", "إلغاء")}</AlertDialogCancel>
            <AlertDialogAction onClick={doRotate}>{t("Rotate", "تجديد")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- Revoke ---- */}
      <AlertDialog open={!!revoking} onOpenChange={(open) => !open && setRevoking(null)}>
        <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Revoke this key?", "إلغاء هذا المفتاح؟")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                `"${revoking?.name}" will stop working immediately. Anything using it loses access. This cannot be undone.`,
                `"${revoking?.name}" هيتوقف فورًا وأي حاجة بتستخدمه هتفقد الوصول. لا يمكن التراجع.`,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel", "إلغاء")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={doRevoke}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t("Revoke", "إلغاء المفتاح")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
