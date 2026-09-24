import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  CreatedWebhookSubscription,
  WEBHOOK_EVENTS,
  WebhookDeliveryLog,
  WebhookSubscription,
  createWebhook,
  deleteWebhook,
  listWebhookLogs,
  listWebhooks,
  rotateWebhookSecret,
  testWebhook,
  updateWebhook,
} from "@/services/developerApi";
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
import { CopyBox } from "@/components/developers/CopyBox";
import {
  Activity,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Webhook,
  X,
} from "lucide-react";

const EVENT_LABELS: Record<string, { en: string; ar: string }> = {
  "order.created": { en: "Order placed", ar: "أوردر جديد" },
  "order.paid": { en: "Order paid", ar: "تم دفع الأوردر" },
  "order.status_changed": {
    en: "Order status changed (incl. shipping)",
    ar: "تغيّرت حالة الأوردر (يشمل الشحن)",
  },
  "product.created": { en: "Product created", ar: "تم إنشاء منتج" },
  "product.updated": { en: "Product updated", ar: "تم تعديل منتج" },
  "product.deleted": { en: "Product deleted", ar: "تم حذف منتج" },
  "customer.created": { en: "Customer created", ar: "عميل جديد" },
  "customer.updated": { en: "Customer updated", ar: "تم تعديل بيانات عميل" },
  "refund.created": { en: "Refund requested", ar: "طلب استرجاع فلوس جديد" },
  "refund.completed": { en: "Refund completed", ar: "تم استرجاع الفلوس" },
  "shipment.created": { en: "Shipment created", ar: "شحنة جديدة" },
  "shipment.status_changed": { en: "Shipment status or tracking changed", ar: "حالة الشحنة أو رقم التتبع اتغيّر" },
  "inventory.level_changed": { en: "Stock level changed", ar: "المخزون اتغيّر" },
  "checkout.abandoned": { en: "Checkout abandoned", ar: "سلة متروكة" },
};

export function WebhooksPanel({ storeId }: { storeId: string | undefined }) {
  const { isRTL } = useLanguage();
  const t = (en: string, ar: string) => (isRTL ? ar : en);

  const [subs, setSubs] = useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<Set<string>>(new Set(["order.paid"]));
  const [creating, setCreating] = useState(false);

  const [secret, setSecret] = useState<CreatedWebhookSubscription | null>(null);
  const [deleting, setDeleting] = useState<WebhookSubscription | null>(null);
  const [rotating, setRotating] = useState<WebhookSubscription | null>(null);

  const [logsFor, setLogsFor] = useState<WebhookSubscription | null>(null);
  const [logs, setLogs] = useState<WebhookDeliveryLog[] | null>(null);

  const refresh = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      setSubs(await listWebhooks(storeId));
    } catch (err) {
      showError(err, t("Failed to load webhooks", "فشل تحميل الـ webhooks"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleEvent = (event: string) => {
    setEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  };

  const create = async () => {
    if (!storeId || !url.trim() || events.size === 0) return;
    setCreating(true);
    try {
      const created = await createWebhook(storeId, {
        url: url.trim(),
        events: Array.from(events),
        description: description.trim() || undefined,
      });
      setSecret(created);
      setCreateOpen(false);
      setUrl("");
      setDescription("");
      setEvents(new Set(["order.paid"]));
      refresh();
    } catch (err) {
      showError(err, t("Failed to add the endpoint", "فشل إضافة الـ endpoint"));
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (sub: WebhookSubscription) => {
    if (!storeId) return;
    setBusyId(sub.id);
    try {
      const updated = await updateWebhook(storeId, sub.id, {
        is_active: !sub.is_active,
      });
      setSubs((prev) => prev.map((s) => (s.id === sub.id ? updated : s)));
    } catch (err) {
      showError(err, t("Failed to update", "فشل التحديث"));
    } finally {
      setBusyId(null);
    }
  };

  const runTest = async (sub: WebhookSubscription) => {
    if (!storeId) return;
    setBusyId(sub.id);
    try {
      const result = await testWebhook(storeId, sub.id);
      if (result.delivered) {
        toast.success(
          t(
            `Delivered — your endpoint answered ${result.status_code}`,
            `تم الإرسال — الـ endpoint رد بـ ${result.status_code}`,
          ),
        );
      } else {
        toast.error(
          t(
            `Not delivered${result.status_code ? ` — answered ${result.status_code}` : ""}: ${result.error ?? ""}`,
            `لم يتم الإرسال${result.status_code ? ` — رد بـ ${result.status_code}` : ""}: ${result.error ?? ""}`,
          ),
        );
      }
    } catch (err) {
      showError(err, t("Test failed", "فشل الاختبار"));
    } finally {
      setBusyId(null);
    }
  };

  const doRotate = async () => {
    if (!storeId || !rotating) return;
    try {
      setSecret(await rotateWebhookSecret(storeId, rotating.id));
      setRotating(null);
    } catch (err) {
      showError(err, t("Failed to rotate the secret", "فشل تغيير السر"));
    }
  };

  const doDelete = async () => {
    if (!storeId || !deleting) return;
    try {
      await deleteWebhook(storeId, deleting.id);
      toast.success(t("Endpoint removed", "تم حذف الـ endpoint"));
      setDeleting(null);
      refresh();
    } catch (err) {
      showError(err, t("Failed to remove it", "فشل الحذف"));
    }
  };

  const openLogs = async (sub: WebhookSubscription) => {
    if (!storeId) return;
    setLogsFor(sub);
    setLogs(null);
    try {
      setLogs(await listWebhookLogs(storeId, sub.id));
    } catch (err) {
      setLogs([]);
      showError(err, t("Failed to load deliveries", "فشل تحميل السجل"));
    }
  };

  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(isRTL ? "ar-EG" : "en-GB") : "—";

  const statusTone: Record<string, string> = {
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    failed: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    exhausted: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              {t("Webhooks", "الـ Webhooks")}
            </CardTitle>
            <CardDescription>
              {t(
                "We POST to your URL when something happens in the store — signed, and retried if your server is down.",
                "بنبعت طلب لرابطك أول ما يحصل حاجة في المتجر — موقّع، وبيتعاد لو سيرفرك واقع.",
              )}
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 me-1" />
            {t("Add endpoint", "إضافة endpoint")}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : subs.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t(
                  "No endpoints yet. Add one to receive events instead of polling for them.",
                  "مفيش endpoints. ضيف واحد عشان تستقبل الأحداث بدل ما تسأل عليها كل شوية.",
                )}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {subs.map((sub) => (
                <div key={sub.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-sm font-medium break-all" dir="ltr">
                      {sub.url}
                    </code>
                    {sub.is_active ? (
                      <Badge className="gap-1 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <Check className="h-3 w-3" />
                        {t("Active", "شغّال")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <X className="h-3 w-3" />
                        {t("Off", "متوقف")}
                      </Badge>
                    )}
                  </div>

                  {sub.description && (
                    <p className="text-xs text-muted-foreground">{sub.description}</p>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {sub.events.map((event) => (
                      <Badge key={event} variant="secondary" className="text-[10px]">
                        {EVENT_LABELS[event]
                          ? t(EVENT_LABELS[event].en, EVENT_LABELS[event].ar)
                          : event}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === sub.id}
                      onClick={() => runTest(sub)}
                    >
                      {busyId === sub.id ? (
                        <Loader2 className="h-3.5 w-3.5 me-1 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5 me-1" />
                      )}
                      {t("Send test", "إرسال تجربة")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openLogs(sub)}>
                      <Activity className="h-3.5 w-3.5 me-1" />
                      {t("Deliveries", "السجل")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setRotating(sub)}>
                      <RefreshCw className="h-3.5 w-3.5 me-1" />
                      {t("New secret", "سر جديد")}
                    </Button>
                    <div className="flex items-center gap-2 ms-auto">
                      <Switch
                        checked={sub.is_active}
                        disabled={busyId === sub.id}
                        onCheckedChange={() => toggleActive(sub)}
                        aria-label={t("Active", "شغّال")}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting(sub)}
                        title={t("Remove", "حذف")}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Add endpoint ---- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("Add a webhook endpoint", "إضافة webhook")}</DialogTitle>
            <DialogDescription>
              {t(
                "A public HTTPS address we can reach. The signing secret is shown once after you add it.",
                "رابط HTTPS عام نقدر نوصله. سر التوقيع بيظهر مرة واحدة بعد الإضافة.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("Endpoint URL", "رابط الـ endpoint")}</Label>
              <Input
                dir="ltr"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-app.example.com/hooks/numu"
              />
              <p className="text-xs text-muted-foreground">
                {t(
                  "Local addresses are refused — use a tunnel while developing.",
                  "العناوين المحلية مرفوضة — استخدم tunnel وقت التطوير.",
                )}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Label (optional)", "وصف (اختياري)")}</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("e.g. ERP sync", "مثال: ربط ERP")}
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Events", "الأحداث")}</Label>
              <div className="space-y-1 rounded-md border p-3">
                {WEBHOOK_EVENTS.map((event) => (
                  <label
                    key={event}
                    className="flex cursor-pointer items-center gap-3 py-1 text-sm"
                  >
                    <Checkbox
                      checked={events.has(event)}
                      onCheckedChange={() => toggleEvent(event)}
                    />
                    <span className="flex-1">
                      {t(EVENT_LABELS[event].en, EVENT_LABELS[event].ar)}
                    </span>
                    <code className="text-[10px] text-muted-foreground" dir="ltr">
                      {event}
                    </code>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("Cancel", "إلغاء")}
            </Button>
            <Button
              onClick={create}
              disabled={creating || !url.trim() || events.size === 0}
            >
              {creating && <Loader2 className="h-4 w-4 me-1 animate-spin" />}
              {t("Add endpoint", "إضافة")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Secret shown once ---- */}
      <Dialog open={!!secret} onOpenChange={(open) => !open && setSecret(null)}>
        <DialogContent className="max-w-lg" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("Copy the signing secret", "انسخ سر التوقيع")}</DialogTitle>
            <DialogDescription>
              {t(
                "Every delivery is signed with it, and this is the only time it is shown. Your endpoint must verify the signature.",
                "كل رسالة بتتوقّع بيه، ودي المرة الوحيدة اللي هيظهر فيها. لازم الـ endpoint يتحقق من التوقيع.",
              )}
            </DialogDescription>
          </DialogHeader>
          {secret && <CopyBox label={secret.url} text={secret.secret} />}
          <DialogFooter className="sm:justify-between">
            <a
              href="https://docs.numueg.app/go/Webhooks"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted-foreground underline underline-offset-2"
            >
              {t("How to verify it", "طريقة التحقق")}
            </a>
            <Button onClick={() => setSecret(null)}>
              {t("Done — I saved it", "تم — خزّنته")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Deliveries ---- */}
      <Dialog open={!!logsFor} onOpenChange={(open) => !open && setLogsFor(null)}>
        <DialogContent className="max-w-2xl" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t("Recent deliveries", "آخر المحاولات")}</DialogTitle>
            <DialogDescription dir="ltr" className="break-all">
              {logsFor?.url}
            </DialogDescription>
          </DialogHeader>
          {logs === null ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : logs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t(
                "Nothing delivered yet. Send a test to check the endpoint.",
                "لسه مفيش محاولات. ابعت تجربة عشان تتأكد من الـ endpoint.",
              )}
            </p>
          ) : (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={`border-0 ${statusTone[log.status] ?? ""}`}>
                      {log.status}
                    </Badge>
                    <code className="text-xs" dir="ltr">
                      {log.event_type}
                    </code>
                    <span className="text-xs text-muted-foreground">
                      {fmtTime(log.last_attempt_at ?? log.created_at)}
                    </span>
                    <span className="ms-auto text-xs text-muted-foreground">
                      {t("Attempt", "محاولة")} {log.attempt_count}
                      {log.last_status_code ? ` · HTTP ${log.last_status_code}` : ""}
                    </span>
                  </div>
                  {(log.last_error || log.last_response_body) && (
                    <pre
                      dir="ltr"
                      className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap break-words rounded bg-muted p-2 text-[11px]"
                    >
                      {log.last_error || log.last_response_body}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---- Rotate confirm ---- */}
      <AlertDialog open={!!rotating} onOpenChange={(open) => !open && setRotating(null)}>
        <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("Issue a new signing secret?", "إصدار سر توقيع جديد؟")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "The current secret stops working immediately, so deliveries will fail your signature check until you deploy the new one.",
                "السر الحالي هيبطل يشتغل فورًا، فالرسائل هتفشل في التحقق لحد ما تنشر السر الجديد.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel", "إلغاء")}</AlertDialogCancel>
            <AlertDialogAction onClick={doRotate}>
              {t("Rotate", "تغيير")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- Delete confirm ---- */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("Remove this endpoint?", "حذف الـ endpoint؟")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "It stops receiving events immediately. Adding it again issues a new secret.",
                "هيبطل يستقبل أحداث فورًا. ولو ضفته تاني هياخد سر جديد.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel", "إلغاء")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t("Remove", "حذف")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
