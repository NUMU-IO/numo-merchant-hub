/**
 * CampaignActivitiesPanel — feature 002 US5.
 *
 * Sidebar panel listing the campaign's activity audit log + "Run
 * backfill" CTA. While a backfill is running we poll every 3s until
 * the row flips to completed/failed (per the contract).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, PlayCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";
import {
  listActivities,
  runBackfill,
  type AutoMatchOperator,
  type BackfillFilter,
  type BackfillFilterField,
  type CampaignActivity,
} from "@/services/campaignApi";

const FILTER_FIELDS: BackfillFilterField[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "referrer",
];

const OPERATORS: AutoMatchOperator[] = ["equals", "starts_with", "contains"];

export function CampaignActivitiesPanel({
  storeId,
  campaignId,
}: {
  storeId: string;
  campaignId: string;
}) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [activities, setActivities] = useState<CampaignActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Draft state
  const [filters, setFilters] = useState<BackfillFilter[]>([
    { field: "utm_source", operator: "equals", value: "" },
  ]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listActivities(storeId, campaignId, 10);
      setActivities(rows);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [storeId, campaignId]);

  // Initial load + polling loop while any activity is in flight.
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const isRunning = activities.some((a) => a.status === "running");
    if (!isRunning) {
      if (pollTimer.current) clearTimeout(pollTimer.current);
      return;
    }
    pollTimer.current = setTimeout(() => {
      void load();
    }, 3000);
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [activities, load]);

  const resetDraft = () => {
    setFilters([{ field: "utm_source", operator: "equals", value: "" }]);
    setStartsAt("");
    setEndsAt("");
  };

  const onSubmit = async () => {
    if (filters.some((f) => !f.value.trim())) return;
    if (!startsAt || !endsAt) return;
    setSubmitting(true);
    try {
      await runBackfill(storeId, campaignId, {
        utm_filters: filters,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
      });
      toast.success(isAr ? "تم بدء الإعادة" : "Backfill queued");
      setDialogOpen(false);
      resetDraft();
      await load();
    } catch (err) {
      showError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const updateFilter = (idx: number, patch: Partial<BackfillFilter>) => {
    setFilters((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">
          {isAr ? "سجل النشاط" : "Activity log"}
        </Label>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setDialogOpen(true)}
          title={isAr ? "تشغيل إعادة إسناد" : "Run backfill"}
        >
          <PlayCircle className="h-3.5 w-3.5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          {isAr ? "لا يوجد نشاط بعد." : "No activity yet."}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {activities.map((a) => (
            <li
              key={a.id}
              className="text-xs rounded-md border bg-muted/30 p-2 space-y-0.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {a.type === "backfill_attribution"
                    ? isAr
                      ? "إعادة إسناد"
                      : "Backfill"
                    : a.type}
                </span>
                <StatusBadge status={a.status} />
              </div>
              <div className="text-[10px] text-muted-foreground">
                {new Date(a.run_at).toLocaleString(isAr ? "ar-EG" : "en-EG")}
              </div>
              {a.status === "completed" && a.affected_count !== null && (
                <div className="text-[11px]">
                  {isAr
                    ? `${a.affected_count.toLocaleString()} صف تم تحديثه`
                    : `${a.affected_count.toLocaleString()} rows updated`}
                </div>
              )}
              {a.status === "failed" && a.error_message && (
                <div className="text-[11px] text-destructive truncate">
                  {a.error_message}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetDraft();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isAr ? "تشغيل إعادة إسناد" : "Run backfill"}
            </DialogTitle>
            <DialogDescription>
              {isAr
                ? "إسناد حركة المرور السابقة لهذه الحملة بناءً على فلاتر UTM."
                : "Attribute past traffic to this campaign by UTM filters."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">
                  {isAr ? "من" : "From"}
                </Label>
                <Input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  {isAr ? "إلى" : "To"}
                </Label>
                <Input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                {isAr ? "الفلاتر" : "Filters"}
              </Label>
              {filters.map((f, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1.5fr_auto] gap-1.5">
                  <Select
                    value={f.field}
                    onValueChange={(v) =>
                      updateFilter(i, { field: v as BackfillFilterField })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_FIELDS.map((field) => (
                        <SelectItem key={field} value={field}>
                          {field}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={f.operator}
                    onValueChange={(v) =>
                      updateFilter(i, { operator: v as AutoMatchOperator })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op} value={op}>
                          {op}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-8 text-xs"
                    value={f.value}
                    onChange={(e) => updateFilter(i, { value: e.target.value })}
                    placeholder={isAr ? "القيمة" : "value"}
                  />
                  {filters.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() =>
                        setFilters((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              {filters.length < 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setFilters((prev) => [
                      ...prev,
                      { field: "utm_source", operator: "equals", value: "" },
                    ])
                  }
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {isAr ? "إضافة فلتر" : "Add filter"}
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={onSubmit}
              disabled={
                submitting ||
                !startsAt ||
                !endsAt ||
                filters.some((f) => !f.value.trim())
              }
              className="gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isAr ? "بدء" : "Start"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: CampaignActivity["status"] }) {
  const map: Record<CampaignActivity["status"], string> = {
    running: "bg-blue-50 text-blue-800 border-blue-200",
    completed: "bg-green-50 text-green-800 border-green-200",
    failed: "bg-red-50 text-red-800 border-red-200",
  };
  return (
    <span
      className={`text-[10px] font-medium uppercase tracking-wider rounded-full px-1.5 py-0.5 border ${map[status]}`}
    >
      {status}
    </span>
  );
}
