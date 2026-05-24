/**
 * CampaignAutoMatchPanel — feature 002 US4.
 *
 * Sidebar panel that lists this campaign's auto-match rule groups
 * with an "Add rule" CTA. Each group is one or more conditions joined
 * by AND/OR; per-group priority orders precedence store-globally.
 *
 * Overlap warnings from POST responses are toasted (non-blocking).
 */

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
  createAutoMatchRule,
  deleteAutoMatchRule,
  listAutoMatchRules,
  type AutoMatchCondition,
  type AutoMatchCombinator,
  type AutoMatchField,
  type AutoMatchOperator,
  type AutoMatchRule,
} from "@/services/campaignApi";

const FIELD_OPTIONS: AutoMatchField[] = ["utm_source", "utm_medium", "utm_campaign"];
const OPERATOR_OPTIONS: AutoMatchOperator[] = ["equals", "starts_with", "contains"];

export function CampaignAutoMatchPanel({
  storeId,
  campaignId,
}: {
  storeId: string;
  campaignId: string;
}) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [rules, setRules] = useState<AutoMatchRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Draft state for the editor dialog
  const [combinator, setCombinator] = useState<AutoMatchCombinator>("AND");
  const [priority, setPriority] = useState(50);
  const [conditions, setConditions] = useState<AutoMatchCondition[]>([
    { field: "utm_source", operator: "equals", value: "" },
  ]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await listAutoMatchRules(storeId, campaignId);
      setRules(r);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, campaignId]);

  const resetDraft = () => {
    setCombinator("AND");
    setPriority(50);
    setConditions([{ field: "utm_source", operator: "equals", value: "" }]);
  };

  const onCreate = async () => {
    if (conditions.some((c) => !c.value.trim())) return;
    setCreating(true);
    try {
      const res = await createAutoMatchRule(storeId, campaignId, {
        combinator,
        priority,
        conditions,
      });
      if (res.warnings.length > 0) {
        toast.warning(res.warnings[0].message);
      } else {
        toast.success(isAr ? "تم إضافة القاعدة" : "Rule added");
      }
      setDialogOpen(false);
      resetDraft();
      await load();
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  const onDelete = async (groupId: string) => {
    try {
      await deleteAutoMatchRule(storeId, campaignId, groupId);
      toast.success(isAr ? "تم حذف القاعدة" : "Rule deleted");
      await load();
    } catch (err) {
      showError(err);
    }
  };

  const updateCondition = (idx: number, patch: Partial<AutoMatchCondition>) => {
    setConditions((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">
          {isAr ? "قواعد المطابقة التلقائية" : "Auto-match rules"}
        </Label>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setDialogOpen(true)}
          title={isAr ? "إضافة قاعدة" : "Add rule"}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : rules.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          {isAr
            ? "لا توجد قواعد بعد. أضف قاعدة لإسناد حركة المرور تلقائياً."
            : "No rules yet. Add a rule to auto-attribute traffic."}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rules.map((rule) => (
            <li
              key={rule.group_id}
              className="text-xs flex items-start gap-2 rounded-md border bg-muted/30 p-2"
            >
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider">
                  {isAr ? `الأولوية ${rule.priority}` : `Priority ${rule.priority}`} ·{" "}
                  {rule.combinator}
                </div>
                {rule.conditions.map((c, i) => (
                  <div key={i} className="font-mono text-[11px] truncate">
                    {c.field} {c.operator} <span className="text-primary">{c.value}</span>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                onClick={() => onDelete(rule.group_id)}
                title={isAr ? "حذف" : "Delete"}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
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
              {isAr ? "قاعدة مطابقة تلقائية جديدة" : "New auto-match rule"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {isAr ? "التركيب" : "Combinator"}
                </Label>
                <Select
                  value={combinator}
                  onValueChange={(v) => setCombinator(v as AutoMatchCombinator)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">AND</SelectItem>
                    <SelectItem value="OR">OR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {isAr ? "الأولوية" : "Priority"}
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value || "0"))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                {isAr ? "الشروط" : "Conditions"}
              </Label>
              {conditions.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1.5fr_auto] gap-1.5">
                  <Select
                    value={c.field}
                    onValueChange={(v) =>
                      updateCondition(i, { field: v as AutoMatchField })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_OPTIONS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={c.operator}
                    onValueChange={(v) =>
                      updateCondition(i, { operator: v as AutoMatchOperator })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATOR_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-8 text-xs"
                    value={c.value}
                    onChange={(e) =>
                      updateCondition(i, { value: e.target.value })
                    }
                    placeholder={isAr ? "القيمة" : "value"}
                  />
                  {conditions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() =>
                        setConditions((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              {conditions.length < 10 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setConditions((prev) => [
                      ...prev,
                      { field: "utm_source", operator: "equals", value: "" },
                    ])
                  }
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {isAr ? "إضافة شرط" : "Add condition"}
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={onCreate}
              disabled={creating || conditions.some((c) => !c.value.trim())}
              className="gap-2"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              {isAr ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
