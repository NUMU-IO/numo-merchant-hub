import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Loader2, Plus, Webhook, Trash2, ScrollText,
  CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, Copy, Check, Eye, EyeOff,
} from "lucide-react";
import { format } from "date-fns";
import {
  listWebhooks, createWebhook, deleteWebhook, getWebhookDeliveries,
  WebhookSubscription, WebhookEventType, WebhookDeliveryLog,
  CreateWebhookRequest,
} from "@/services/webhookApi";

// ── Constants ──

const ALL_EVENTS: Array<{ value: WebhookEventType; en: string; ar: string }> = [
  { value: "order.created",        en: "Order Created",        ar: "إنشاء طلب" },
  { value: "order.status_changed", en: "Order Status Changed", ar: "تغيير حالة الطلب" },
  { value: "order.paid",           en: "Order Paid",           ar: "دفع الطلب" },
  { value: "order.cancelled",      en: "Order Cancelled",      ar: "إلغاء الطلب" },
  { value: "product.created",      en: "Product Created",      ar: "إنشاء منتج" },
  { value: "product.updated",      en: "Product Updated",      ar: "تحديث منتج" },
  { value: "product.deleted",      en: "Product Deleted",      ar: "حذف منتج" },
];

// ── Copy button ──

function CopyButton({ text, isAr }: { text: string; isAr: boolean }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button type="button" variant="ghost" size="sm" onClick={handle} className="h-7 w-7 p-0 shrink-0">
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

// ── Delivery status badge ──

function DeliveryStatusBadge({ status, isAr }: { status: string; isAr: boolean }) {
  const map: Record<string, { icon: React.ReactNode; label: string; arLabel: string; cls: string }> = {
    success:   { icon: <CheckCircle2 className="h-3 w-3" />, label: "Success",   arLabel: "ناجح",              cls: "text-green-700 dark:text-green-400" },
    failed:    { icon: <XCircle className="h-3 w-3" />,      label: "Failed",    arLabel: "فشل",               cls: "text-red-600 dark:text-red-400" },
    exhausted: { icon: <AlertCircle className="h-3 w-3" />,  label: "Exhausted", arLabel: "استُنفد",           cls: "text-orange-600 dark:text-orange-400" },
    pending:   { icon: <Clock className="h-3 w-3" />,        label: "Pending",   arLabel: "معلق",              cls: "text-muted-foreground" },
  };
  const m = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${m.cls}`}>
      {m.icon}
      {isAr ? m.arLabel : m.label}
    </span>
  );
}

// ── Secret reveal card (shown once after creation) ──

function SecretCard({ secret, isAr, onDone }: { secret: string; isAr: boolean; onDone: () => void }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3 flex gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-300">
          {isAr
            ? "هذا هو المفتاح السري الذي يُستخدم للتحقق من توقيع الـ Webhook. لن يُعرض مرة أخرى. احتفظ به الآن."
            : "This signing secret is used to verify webhook authenticity. It will never be shown again. Save it now."}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>{isAr ? "مفتاح التوقيع" : "Signing Secret"}</Label>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-sm rounded-md border bg-muted px-3 py-2 select-all break-all">
            {revealed ? secret : "••••••••••••••••••••••••••••••••"}
          </code>
          <Button variant="ghost" size="sm" onClick={() => setRevealed((v) => !v)} className="h-8 w-8 p-0 shrink-0">
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          {revealed && <CopyButton text={secret} isAr={isAr} />}
        </div>
      </div>
      <Button onClick={onDone} className="w-full">
        {isAr ? "تم، لقد احتفظت بالمفتاح" : "Done, I've saved the secret"}
      </Button>
    </div>
  );
}

// ── Create Webhook Dialog ──

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (secret: string) => void;
  storeId: string;
  isAr: boolean;
}

function CreateWebhookDialog({ open, onClose, onCreated, storeId, isAr }: CreateDialogProps) {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState<Set<WebhookEventType>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const reset = () => { setUrl(""); setDescription(""); setIsActive(true); setSelectedEvents(new Set()); };

  const toggleEvent = (ev: WebhookEventType) =>
    setSelectedEvents((s) => { const n = new Set(s); if (n.has(ev)) n.delete(ev); else n.add(ev); return n; });

  const handleSave = async () => {
    if (!url.trim()) { toast.error(isAr ? "أدخل رابط الـ Webhook" : "Enter a webhook URL"); return; }
    if (selectedEvents.size === 0) { toast.error(isAr ? "اختر حدثًا واحدًا على الأقل" : "Select at least one event"); return; }
    setIsSaving(true);
    try {
      const result = await createWebhook(storeId, {
        url: url.trim(),
        events: Array.from(selectedEvents),
        description: description.trim() || undefined,
        is_active: isActive,
      });
      reset();
      onClose();
      // Pass secret to parent so it can show it in a separate step
      onCreated(result.secret ?? "");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : (isAr ? "فشل إنشاء الـ Webhook" : "Failed to create webhook"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isAr ? "إضافة Webhook جديد" : "Add Webhook"}</DialogTitle>
          <DialogDescription>
            {isAr
              ? "سيتم إرسال البيانات إلى هذا الرابط عند وقوع الأحداث المختارة"
              : "Payload will be sent to this URL when the selected events occur"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-1.5">
            <Label>{isAr ? "رابط الاستقبال (URL)" : "Endpoint URL"}</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourapp.com/webhooks" dir="ltr" />
          </div>
          <div className="grid gap-1.5">
            <Label>{isAr ? "الوصف (اختياري)" : "Description (optional)"}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder={isAr ? "وصف مختصر" : "Brief description"} rows={2} />
          </div>
          <div className="grid gap-2">
            <Label>{isAr ? "الأحداث" : "Events"}</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_EVENTS.map((ev) => (
                <div key={ev.value} className="flex items-center gap-2">
                  <Checkbox id={`ev-${ev.value}`} checked={selectedEvents.has(ev.value)} onCheckedChange={() => toggleEvent(ev.value)} />
                  <Label htmlFor={`ev-${ev.value}`} className="font-normal text-sm cursor-pointer">{isAr ? ev.ar : ev.en}</Label>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label className="cursor-pointer" onClick={() => setIsActive((v) => !v)}>{isAr ? "مفعّل" : "Active"}</Label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={isSaving}>{isAr ? "إلغاء" : "Cancel"}</Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isAr ? "إنشاء" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Secret reveal dialog (shown once after creation) ──

function SecretRevealDialog({ secret, isAr, onDone }: { secret: string | null; isAr: boolean; onDone: () => void }) {
  return (
    <Dialog open={!!secret} onOpenChange={(o) => { if (!o) onDone(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            {isAr ? "تم إنشاء Webhook بنجاح!" : "Webhook created!"}
          </DialogTitle>
        </DialogHeader>
        {secret && <SecretCard secret={secret} isAr={isAr} onDone={onDone} />}
      </DialogContent>
    </Dialog>
  );
}

// ── Delivery Logs Dialog ──

interface DeliveryLogsProps {
  open: boolean;
  onClose: () => void;
  webhook: WebhookSubscription | null;
  storeId: string;
  isAr: boolean;
}

function DeliveryLogsDialog({ open, onClose, webhook, storeId, isAr }: DeliveryLogsProps) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["webhook-logs", storeId, webhook?.id],
    queryFn: () => getWebhookDeliveries(storeId, webhook!.id),
    enabled: open && !!webhook,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            {isAr ? "سجل التسليم" : "Delivery Logs"}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs truncate">{webhook?.url}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <ScrollText className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{isAr ? "لا توجد سجلات تسليم بعد" : "No delivery logs yet"}</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isAr ? "الحدث" : "Event"}</TableHead>
                  <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isAr ? "كود HTTP" : "HTTP"}</TableHead>
                  <TableHead>{isAr ? "المحاولات" : "Attempts"}</TableHead>
                  <TableHead>{isAr ? "التاريخ" : "Date"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.event_type}</TableCell>
                    <TableCell><DeliveryStatusBadge status={log.status} isAr={isAr} /></TableCell>
                    <TableCell>
                      {log.last_status_code ? (
                        <span className={`text-xs font-mono ${log.last_status_code >= 200 && log.last_status_code < 300 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {log.last_status_code}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.attempt_count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "MMM d, HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ──

const Webhooks = () => {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const qc = useQueryClient();
  const storeId = currentStore?.id ?? "";
  const isAr = language === "ar";

  const [createOpen, setCreateOpen] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WebhookSubscription | null>(null);
  const [logsTarget, setLogsTarget] = useState<WebhookSubscription | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: webhooks = [], isLoading, isFetching } = useQuery({
    queryKey: ["webhooks", storeId],
    queryFn: () => listWebhooks(storeId),
    enabled: !!storeId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["webhooks", storeId] });

  const handleCreated = (secret: string) => {
    invalidate();
    if (secret) setNewSecret(secret);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteWebhook(storeId, deleteTarget.id);
      toast.success(isAr ? "تم حذف Webhook" : "Webhook deleted");
      invalidate();
      setDeleteTarget(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : (isAr ? "فشل الحذف" : "Delete failed"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">
            {isAr ? "إدارة Webhooks" : "Webhook Management"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={invalidate} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            {isAr ? "تحديث" : "Refresh"}
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {isAr ? "إضافة Webhook" : "Add Webhook"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{isAr ? "نقاط الاستقبال" : "Webhook Endpoints"}</CardTitle>
          <CardDescription>
            {isAr
              ? "يتم إرسال بيانات الأحداث تلقائيًا إلى هذه الروابط عند حدوثها"
              : "Event payloads are automatically sent to these URLs when they occur"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Webhook className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-medium">{isAr ? "لا توجد Webhooks مسجلة" : "No webhooks registered"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isAr ? "أضف Webhook لتلقي الأحداث تلقائيًا" : "Add a webhook to receive events automatically"}
                </p>
              </div>
              <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                {isAr ? "أضف أول Webhook" : "Add first webhook"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((wh) => (
                <div key={wh.id} className="rounded-lg border bg-card p-4 space-y-3">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm truncate">{wh.url}</span>
                        <Badge variant={wh.is_active ? "default" : "secondary"} className="shrink-0 text-[10px] h-5">
                          {wh.is_active ? (isAr ? "مفعّل" : "Active") : (isAr ? "معطّل" : "Inactive")}
                        </Badge>
                      </div>
                      {wh.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{wh.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs"
                        onClick={() => setLogsTarget(wh)}>
                        <ScrollText className="h-3.5 w-3.5" />
                        {isAr ? "السجل" : "Logs"}
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(wh)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Event badges */}
                  <div className="flex flex-wrap gap-1">
                    {wh.events.map((ev) => (
                      <span key={ev} className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted/50">
                        {ev}
                      </span>
                    ))}
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    {isAr ? "أُنشئ في: " : "Created: "}
                    {format(new Date(wh.created_at), "MMM d, yyyy")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <CreateWebhookDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
        storeId={storeId}
        isAr={isAr}
      />

      {/* Secret reveal (shown once after creation) */}
      <SecretRevealDialog
        secret={newSecret}
        isAr={isAr}
        onDone={() => setNewSecret(null)}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? "حذف Webhook" : "Delete Webhook"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr
                ? "هل أنت متأكد؟ لن تتلقى أحداثًا على هذا الرابط بعد الحذف."
                : "Are you sure? You will no longer receive events at this URL."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isAr ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isAr ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delivery logs */}
      <DeliveryLogsDialog
        open={!!logsTarget}
        onClose={() => setLogsTarget(null)}
        webhook={logsTarget}
        storeId={storeId}
        isAr={isAr}
      />
    </div>
  );
};

export default Webhooks;
