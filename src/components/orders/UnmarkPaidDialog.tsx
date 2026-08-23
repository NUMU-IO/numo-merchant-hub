import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Undo2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const REASONS = ["mistake", "cancelled", "not_collected", "other"] as const;
type Reason = (typeof REASONS)[number];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  onConfirm: (reason: string) => void;
}

/** Undo a manual "Mark as paid". Reason is recorded on the order timeline. */
export function UnmarkPaidDialog({ open, onOpenChange, submitting, onConfirm }: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<Reason>("mistake");
  const [note, setNote] = useState("");

  const confirm = () => {
    const label = t(`orders.unmark.reasons.${reason}`);
    onConfirm(note.trim() ? `${label} — ${note.trim()}` : label);
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("orders.unmark.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("orders.unmark.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[12px] text-muted-foreground">{t("orders.unmark.reason")}</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as Reason)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`orders.unmark.reasons.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="unpaid-note" className="text-[12px] text-muted-foreground">{t("orders.unmark.note")}</Label>
            <Textarea id="unpaid-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              confirm();
            }}
            disabled={submitting}
            className="gap-1.5 bg-terracotta text-white hover:bg-terracotta/90"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            {t("orders.unmark.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default UnmarkPaidDialog;
