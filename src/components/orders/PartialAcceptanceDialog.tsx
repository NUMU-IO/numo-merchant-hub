import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Minus, PackageOpen, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Order, PartialAcceptanceLineInput } from "@/services/orderApi";
import { formatOrderCurrency } from "./_shared";
import { cn } from "@/lib/utils";

interface Props {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  onSubmit: (payload: { lines: PartialAcceptanceLineInput[]; reason?: string; restock: boolean }) => void;
}

const COD_METHODS = new Set(["cod", "cash_on_delivery", "cash"]);

/**
 * "Customer kept 2 of 3 pieces": per-line stepper for how many came BACK,
 * live preview of the value returned and the cash to collect. Mirrors the
 * backend maths (effective unit price = total_price / quantity; shipping
 * is still collected) so the preview equals what the API will record.
 */
export function PartialAcceptanceDialog({ order, open, onOpenChange, submitting, onSubmit }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const fmt = (cents: number) => formatOrderCurrency(cents, language);
  const [returned, setReturned] = useState<Record<number, number>>({});
  const [restock, setRestock] = useState(true);
  const [reason, setReason] = useState("");

  const isCod = COD_METHODS.has((order.payment_method ?? "").toLowerCase());

  const preview = useMemo(() => {
    let value = 0;
    order.line_items.forEach((li, i) => {
      const qty = returned[i] ?? 0;
      if (qty > 0) value += Math.round(li.total_price / Math.max(li.quantity, 1)) * qty;
    });
    return { value, collect: Math.max(order.total - value, 0) };
  }, [order, returned]);

  const anyReturned = Object.values(returned).some((q) => q > 0);
  const allReturned = order.line_items.every((li, i) => (returned[i] ?? 0) >= li.quantity);

  const step = (i: number, delta: number, max: number) =>
    setReturned((prev) => {
      const next = Math.min(max, Math.max(0, (prev[i] ?? 0) + delta));
      return { ...prev, [i]: next };
    });

  const submit = () => {
    const lines = Object.entries(returned)
      .filter(([, q]) => q > 0)
      .map(([i, q]) => ({ order_line_index: Number(i), returned_quantity: q }));
    onSubmit({ lines, reason: reason.trim() || undefined, restock });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageOpen className="h-5 w-5 text-navy dark:text-saffron" />
            {t("orders.partial.title")}
          </DialogTitle>
          <DialogDescription>{t("orders.partial.description")}</DialogDescription>
        </DialogHeader>

        <ul className="divide-y divide-border/70 rounded-xl border border-border">
          {order.line_items.map((li, i) => {
            const r = returned[i] ?? 0;
            return (
              <li key={`${li.product_id}-${i}`} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{li.product_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {li.variant_name ? `${li.variant_name} · ` : ""}
                    {t("orders.partial.ordered", { count: li.quantity })} · {fmt(li.total_price)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="me-1 text-[11px] text-muted-foreground">{t("orders.partial.returned")}</span>
                  <Button type="button" size="icon" variant="outline" className="h-7 w-7 rounded-md" disabled={r <= 0} onClick={() => step(i, -1, li.quantity)} aria-label="-">
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className={cn("w-6 text-center text-sm font-bold tabular-nums", r > 0 && "text-terracotta")}>{r}</span>
                  <Button type="button" size="icon" variant="outline" className="h-7 w-7 rounded-md" disabled={r >= li.quantity} onClick={() => step(i, 1, li.quantity)} aria-label="+">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3 text-sm">
          <div>
            <div className="text-[11px] text-muted-foreground">{t("orders.partial.returnedValue")}</div>
            <div className="font-bold tabular-nums text-terracotta">{fmt(preview.value)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">
              {isCod ? t("orders.partial.toCollect") : order.is_paid ? t("orders.partial.refundDue") : t("orders.partial.newTotal")}
            </div>
            <div className="font-bold tabular-nums">
              {fmt(!isCod && order.is_paid ? preview.value : preview.collect)}
            </div>
          </div>
          <p className="col-span-2 text-[11px] text-muted-foreground">{t("orders.partial.shippingNote")}</p>
        </div>

        {allReturned && anyReturned && (
          <p className="rounded-lg border border-amber-300/50 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-800 dark:text-amber-300">
            {t("orders.partial.allReturnedHint")}
          </p>
        )}

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={restock} onCheckedChange={(v) => setRestock(Boolean(v))} />
            {t("orders.partial.restock")}
          </label>
          <div>
            <Label htmlFor="partial-reason" className="text-[12px] text-muted-foreground">{t("orders.partial.reason")}</Label>
            <Textarea id="partial-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1" placeholder={t("orders.partial.reasonPlaceholder")} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={!anyReturned || allReturned || submitting} className="gap-1.5">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("orders.partial.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PartialAcceptanceDialog;
