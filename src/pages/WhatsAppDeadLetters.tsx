/**
 * WhatsApp dead-letter inspection + replay page.
 *
 * Lists exhausted-retry + non-retriable send failures. The replay flow
 * is double-send-guarded server-side (FR-035): if a successful prior
 * send already exists in message_logs matching the DLQ's intent, the
 * backend marks the row replayed_success WITHOUT re-issuing. So
 * pressing "Replay" is always safe — the worst case is a no-op +
 * green checkmark.
 *
 * Access is restricted to the store-owner role (TASK-SEC-002): staff
 * tokens get 403 from the backend.
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { Loader2, RefreshCw, Search } from "lucide-react";
import {
  getDeadLetter,
  listDeadLetters,
  replayDeadLetter,
  type DeadLetter,
  type DeadLetterOriginatingContext,
  type DeadLetterReplayState,
} from "@/services/whatsappApi";

const CONTEXTS: DeadLetterOriginatingContext[] = [
  "order_created",
  "order_paid",
  "order_status_changed",
  "campaign",
  "scheduled_send",
  "abandoned_cart",
  "ad_hoc",
];

const REPLAY_STATES: DeadLetterReplayState[] = [
  "not_replayed",
  "replaying",
  "replayed_success",
  "replayed_failed",
];

const replayBadgeVariant = (
  state: DeadLetterReplayState
): "default" | "secondary" | "destructive" | "outline" => {
  if (state === "replayed_success") return "default";
  if (state === "replayed_failed") return "destructive";
  if (state === "replaying") return "secondary";
  return "outline";
};

export default function WhatsAppDeadLetters() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;

  const [rows, setRows] = useState<DeadLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [contextFilter, setContextFilter] = useState<
    DeadLetterOriginatingContext | ""
  >("");
  const [replayStateFilter, setReplayStateFilter] = useState<
    DeadLetterReplayState | ""
  >("");
  const [selected, setSelected] = useState<DeadLetter | null>(null);
  const [replaying, setReplaying] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await listDeadLetters(storeId, {
        originating_context: contextFilter || undefined,
        replay_state: replayStateFilter || undefined,
        limit: 100,
      });
      // apiClient unwraps { data: T } to T — guard the array so the
      // page renders empty state instead of crashing the table on
      // .length when the endpoint isn't deployed yet.
      setRows(Array.isArray(res) ? res : []);
    } catch (err) {
      const status = (err as { status?: number } | undefined)?.status;
      if (status === 403) {
        toast.error(
          isAr
            ? "هذه الصفحة لمالك المتجر فقط"
            : "Dead-letters are restricted to the store owner role"
        );
      } else {
        toast.error(
          isAr ? "فشل تحميل القائمة" : "Failed to load dead-letters"
        );
      }
    } finally {
      setLoading(false);
    }
  }, [storeId, contextFilter, replayStateFilter, isAr]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onReplay = async (row: DeadLetter) => {
    if (!storeId) return;
    if (row.replay_state !== "not_replayed") {
      toast.message(
        isAr
          ? `الصف بالفعل في حالة ${row.replay_state}`
          : `Row is already ${row.replay_state}`
      );
      return;
    }
    setReplaying(row.id);
    try {
      // apiClient already unwraps { data: T } to T.
      const res = await replayDeadLetter(storeId, row.id);
      if (res?.status === "replayed_success") {
        toast.success(
          isAr
            ? "تم بنجاح — كانت الرسالة قد أرسلت بالفعل"
            : res.reason === "already_sent"
            ? "Marked replayed_success — message had already been sent (double-send-guard)"
            : "Replay succeeded"
        );
      } else {
        toast.success(
          isAr ? "تمت إعادة الإرسال — تحقق من الحالة" : "Replay queued"
        );
      }
      refresh();
      setSelected(null);
    } catch (err) {
      const status = (err as { status?: number } | undefined)?.status;
      if (status === 409) {
        toast.error(
          isAr
            ? "أُعيد إرسال هذا الصف مسبقًا"
            : "This row has already been replayed"
        );
      } else {
        toast.error(isAr ? "فشلت إعادة الإرسال" : "Replay failed");
      }
    } finally {
      setReplaying(null);
    }
  };

  const onOpenDetail = async (row: DeadLetter) => {
    setSelected(row); // optimistic; refresh below
    if (!storeId) return;
    try {
      const fresh = await getDeadLetter(storeId, row.id);
      if (fresh) setSelected(fresh);
    } catch {
      // keep optimistic — list payload already has most of what we need
    }
  };

  return (
    <div className="space-y-4 p-6" dir={isAr ? "rtl" : "ltr"}>
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isAr ? "رسائل واتساب الفاشلة" : "WhatsApp dead-letters"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr
              ? "الرسائل التي فشلت بعد كل المحاولات. الاحتفاظ 90 يومًا. إعادة الإرسال مضمونة (لن تُكرر الرسالة)."
              : "Sends that exhausted retries or hit a non-retriable error. 90-day retention. Replay is double-send-guarded — safe to re-trigger."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="h-4 w-4 me-2" />
          {isAr ? "تحديث" : "Refresh"}
        </Button>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium block mb-1">
            {isAr ? "نوع المصدر" : "Context"}
          </label>
          <select
            className="border rounded-md px-2 py-1.5 text-sm bg-background"
            value={contextFilter}
            onChange={(e) =>
              setContextFilter(
                (e.target.value as DeadLetterOriginatingContext | "") || ""
              )
            }
          >
            <option value="">{isAr ? "الكل" : "All"}</option>
            {CONTEXTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">
            {isAr ? "حالة إعادة الإرسال" : "Replay state"}
          </label>
          <select
            className="border rounded-md px-2 py-1.5 text-sm bg-background"
            value={replayStateFilter}
            onChange={(e) =>
              setReplayStateFilter(
                (e.target.value as DeadLetterReplayState | "") || ""
              )
            }
          >
            <option value="">{isAr ? "الكل" : "All"}</option>
            {REPLAY_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{isAr ? "تاريخ الفشل" : "Failed at"}</TableHead>
            <TableHead>{isAr ? "الهاتف" : "Phone"}</TableHead>
            <TableHead>{isAr ? "المصدر" : "Context"}</TableHead>
            <TableHead>{isAr ? "التصنيف" : "Classification"}</TableHead>
            <TableHead>{isAr ? "حالة الإعادة" : "Replay state"}</TableHead>
            <TableHead className="text-end">
              {isAr ? "إجراء" : "Action"}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={`skel-${i}`}>
                <TableCell colSpan={6}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ))}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                {isAr
                  ? "لا توجد رسائل فاشلة — كل شيء على ما يرام!"
                  : "No dead-letters — everything is sending cleanly."}
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => onOpenDetail(row)}
              >
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString(
                    isAr ? "ar-EG" : "en-US"
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">{row.phone}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {row.originating_context}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      row.error_classification === "non_retriable"
                        ? "destructive"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {row.error_classification}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={replayBadgeVariant(row.replay_state)}
                    className="text-xs"
                  >
                    {row.replay_state}
                  </Badge>
                </TableCell>
                <TableCell className="text-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReplay(row);
                    }}
                    disabled={
                      replaying === row.id ||
                      row.replay_state !== "not_replayed"
                    }
                  >
                    {replaying === row.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3 me-1" />
                    )}
                    {isAr ? "إعادة الإرسال" : "Replay"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {isAr ? "تفاصيل الفشل" : "Dead-letter detail"}
                </SheetTitle>
                <SheetDescription className="font-mono text-xs">
                  {selected.id}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 mt-6 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {isAr ? "الهاتف" : "Phone"}
                  </p>
                  <p className="font-mono">{selected.phone}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {isAr ? "المصدر" : "Context"}
                    </p>
                    <p>
                      <Badge variant="outline" className="text-xs">
                        {selected.originating_context}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {isAr ? "التصنيف" : "Classification"}
                    </p>
                    <p>
                      <Badge
                        variant={
                          selected.error_classification === "non_retriable"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {selected.error_classification}
                      </Badge>
                    </p>
                  </div>
                </div>

                {selected.final_error_code && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {isAr ? "كود الخطأ النهائي" : "Final Meta error code"}
                    </p>
                    <p>
                      <code className="text-xs">{selected.final_error_code}</code>
                    </p>
                  </div>
                )}

                {selected.template_params && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {isAr ? "بيانات القالب" : "Template params"}
                    </p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                      {JSON.stringify(selected.template_params, null, 2)}
                    </pre>
                  </div>
                )}

                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {isAr ? "تاريخ المحاولات" : "Error history"} (
                    {selected.error_history?.length ?? 0})
                  </p>
                  <div className="space-y-2">
                    {(selected.error_history ?? []).map((entry, i) => (
                      <div key={i} className="border rounded-md p-2 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>#{entry.attempt_n}</span>
                          <span>
                            {new Date(entry.at).toLocaleString(
                              isAr ? "ar-EG" : "en-US"
                            )}
                          </span>
                        </div>
                        <p className="mt-1">
                          {entry.http_status != null && (
                            <code className="me-2">HTTP {entry.http_status}</code>
                          )}
                          {entry.meta_error_code && (
                            <code className="me-2">code {entry.meta_error_code}</code>
                          )}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {entry.error_message}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button
                    onClick={() => onReplay(selected)}
                    disabled={
                      replaying === selected.id ||
                      selected.replay_state !== "not_replayed"
                    }
                  >
                    {replaying === selected.id && (
                      <Loader2 className="h-4 w-4 animate-spin me-2" />
                    )}
                    {selected.replay_state !== "not_replayed"
                      ? `${selected.replay_state}`
                      : isAr
                      ? "إعادة الإرسال (آمن)"
                      : "Replay (safe — double-send-guarded)"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
