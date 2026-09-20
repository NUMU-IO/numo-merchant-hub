/**
 * Record an out-of-band payment against an order.
 *
 * The merchant took the order by hand — WhatsApp, Instagram DM, a phone call
 * — and the customer sent part of the money on Vodafone Cash or InstaPay with
 * a screenshot of the receipt. This dialog attaches that screenshot and the
 * amount actually paid; the order page then shows paid / remaining until the
 * running total settles it.
 *
 * The amount is typed by the merchant. Nothing reads the image — it is a
 * record for the merchant, not an input to the arithmetic.
 */

import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

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
import {
  RECORDED_PAYMENT_METHODS,
  type RecordPaymentInput,
  type RecordedPaymentMethod,
} from "@/services/storeApi";
import { formatOrderCurrency } from "./_shared";

const METHOD_LABELS: Record<RecordedPaymentMethod, { en: string; ar: string }> =
  {
    vodafone_cash: { en: "Vodafone Cash", ar: "فودافون كاش" },
    instapay: { en: "InstaPay", ar: "انستاباي" },
    cash: { en: "Cash", ar: "كاش" },
    bank_transfer: { en: "Bank transfer", ar: "تحويل بنكي" },
    other: { en: "Other", ar: "طريقة تانية" },
  };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is still owed, in cents. Pre-fills the amount — the common case is
   *  the customer paying it in full, and the merchant edits it down when they
   *  underpaid. */
  balanceDueCents: number;
  currencyLanguage: string;
  submitting: boolean;
  onSubmit: (input: RecordPaymentInput) => void;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  balanceDueCents,
  currencyLanguage,
  submitting,
  onSubmit,
}: Props) {
  const isAr = currencyLanguage === "ar";
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<RecordedPaymentMethod>("vodafone_cash");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Generated once per dialog opening, so a retry of the same submission —
  // a dropped connection, an impatient second click — returns the payment
  // that was already recorded instead of recording the money twice.
  const [idempotencyKey, setIdempotencyKey] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount(balanceDueCents > 0 ? (balanceDueCents / 100).toString() : "");
    setMethod("vodafone_cash");
    setReference("");
    setFile(null);
    setIdempotencyKey(
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
  }, [open, balanceDueCents]);

  // Object URLs leak until revoked; tie each one to the file that made it.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const amountCents = useMemo(() => {
    const parsed = Number.parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.round(parsed * 100);
  }, [amount]);

  const overBalance = balanceDueCents > 0 && amountCents > balanceDueCents;
  const canSubmit = amountCents > 0 && file !== null && !submitting;

  const submit = () => {
    if (!canSubmit || !file) return;
    onSubmit({
      amountCents,
      method,
      image: file,
      reference: reference.trim() || undefined,
      idempotencyKey,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isAr ? "تسجيل دفعة على الطلب" : "Record a payment on this order"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="payment-amount" className="text-[12px]">
              {isAr ? "المبلغ اللي اتدفع" : "Amount paid"}
            </Label>
            {/* Money stays LTR even in the Arabic UI. */}
            <Input
              id="payment-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              dir="ltr"
              className="tabular-nums text-start"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={submitting}
            />
            {balanceDueCents > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {isAr ? "الباقي على الطلب: " : "Remaining on this order: "}
                <span dir="ltr" className="tabular-nums">
                  {formatOrderCurrency(balanceDueCents, currencyLanguage)}
                </span>
              </p>
            )}
            {overBalance && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                {isAr
                  ? "المبلغ ده أكبر من الباقي على الطلب."
                  : "This is more than what's left on the order."}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px]">
              {isAr ? "اتدفع بإيه" : "Paid with"}
            </Label>
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as RecordedPaymentMethod)}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECORDED_PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {isAr ? METHOD_LABELS[m].ar : METHOD_LABELS[m].en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-reference" className="text-[12px]">
              {isAr
                ? "رقم العملية (اختياري)"
                : "Transaction reference (optional)"}
            </Label>
            <Input
              id="payment-reference"
              dir="ltr"
              className="font-mono text-start"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-receipt" className="text-[12px]">
              {isAr ? "صورة الإيصال" : "Receipt screenshot"}
            </Label>
            {previewUrl ? (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt={isAr ? "صورة الإيصال" : "Receipt screenshot"}
                  className="max-h-48 w-full rounded-lg border bg-muted/10 object-contain"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute top-2 h-7 w-7"
                  // Logical inset so the button sits on the correct edge in
                  // both LTR and the Arabic RTL layout.
                  style={{ insetInlineEnd: "0.5rem" }}
                  onClick={() => setFile(null)}
                  disabled={submitting}
                  aria-label={isAr ? "شيل الصورة" : "Remove image"}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <label
                htmlFor="payment-receipt"
                className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground hover:bg-muted/40"
              >
                <ImagePlus className="h-5 w-5" />
                {isAr ? "اختار صورة الإيصال" : "Choose the receipt image"}
              </label>
            )}
            <input
              id="payment-receipt"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
            {isAr ? "سجّل الدفعة" : "Save the payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RecordPaymentDialog;
