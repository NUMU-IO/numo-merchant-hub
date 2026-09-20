/**
 * The payments the merchant recorded by hand against an order.
 *
 * Only rows carrying a `recorded_method` show here — customer-submitted
 * proofs keep their own review pane with the approve / reject CTA, because
 * those two things mean different things and need different actions.
 *
 * A voided payment stays in the list, struck through, so the merchant can see
 * that a correction happened rather than wondering where the money went.
 */

import { useState } from "react";
import { ImageOff, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  apiAssetUrl,
  type PaymentProof,
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
  proofs: PaymentProof[];
  isAr: boolean;
  language: string;
  canVoid: boolean;
  voidingId?: string;
  onVoid: (proofId: string, reason: string) => void;
}

export function RecordedPaymentsList({
  proofs,
  isAr,
  language,
  canVoid,
  voidingId,
  onVoid,
}: Props) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<PaymentProof | null>(null);
  const [reason, setReason] = useState("");

  const recorded = proofs.filter((p) => p.recorded_method);
  if (recorded.length === 0) return null;

  return (
    <>
      <div className="space-y-2 border-t pt-3">
        <p className="text-xs font-semibold">
          {isAr ? "الدفعات" : "Payments"}
        </p>
        <ul className="space-y-1.5">
          {recorded.map((p) => {
            const voided = p.status === "rejected";
            const method = p.recorded_method as RecordedPaymentMethod;
            const imageUrl = apiAssetUrl(p.signed_image_url);
            return (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-md border bg-background p-2 text-xs"
              >
                {imageUrl ? (
                  <button
                    type="button"
                    onClick={() => setLightboxUrl(imageUrl)}
                    className="shrink-0 cursor-zoom-in"
                    aria-label={
                      isAr ? "افتح صورة الإيصال" : "Open the receipt image"
                    }
                  >
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-10 w-10 rounded border bg-muted/20 object-cover"
                    />
                  </button>
                ) : (
                  // The retention sweeper deletes the R2 object 90 days after
                  // the order goes terminal. The amount survives; say so
                  // plainly instead of showing a broken image.
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-muted/20"
                    title={
                      isAr
                        ? "صورة الإيصال اتشالت بعد ٩٠ يوم. المبلغ لسه متسجل."
                        : "The receipt image was removed after 90 days. The amount is still recorded."
                    }
                  >
                    <ImageOff className="h-4 w-4 text-muted-foreground" />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div
                    className={
                      voided ? "line-through text-muted-foreground" : ""
                    }
                  >
                    <span dir="ltr" className="tabular-nums font-medium">
                      {formatOrderCurrency(
                        p.declared_amount_cents ?? 0,
                        language,
                      )}
                    </span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {isAr ? METHOD_LABELS[method]?.ar : METHOD_LABELS[method]?.en}
                    </span>
                  </div>
                  <div
                    dir="ltr"
                    className="truncate font-mono text-[10px] text-muted-foreground text-start"
                  >
                    {p.transaction_ref}
                  </div>
                  {voided && p.rejection_reason && (
                    <div className="text-[10px] text-muted-foreground">
                      {isAr ? "اتلغت: " : "Voided: "}
                      {p.rejection_reason}
                    </div>
                  )}
                </div>

                {!voided && canVoid && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setVoidTarget(p);
                      setReason("");
                    }}
                    disabled={voidingId === p.id}
                    aria-label={isAr ? "إلغاء الدفعة" : "Void this payment"}
                  >
                    {voidingId === p.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <Dialog
        open={lightboxUrl !== null}
        onOpenChange={(open) => !open && setLightboxUrl(null)}
      >
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>{isAr ? "صورة الإيصال" : "Receipt"}</DialogTitle>
          </DialogHeader>
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt={isAr ? "صورة الإيصال" : "Receipt"}
              className="h-auto w-full bg-black/5 object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={voidTarget !== null}
        onOpenChange={(open) => !open && setVoidTarget(null)}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isAr ? "إلغاء الدفعة" : "Void this payment"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "لو ألغيت الدفعة، المبلغ هيرجع يتحسب على العميل."
              : "Voiding puts this amount back on the customer's balance."}
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={
              isAr ? "سبب الإلغاء، مثلاً: المبلغ اتكتب غلط" : "e.g. Wrong amount typed"
            }
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVoidTarget(null)}>
              {isAr ? "رجوع" : "Cancel"}
            </Button>
            <Button
              disabled={reason.trim().length < 3}
              onClick={() => {
                if (!voidTarget) return;
                onVoid(voidTarget.id, reason.trim());
                setVoidTarget(null);
              }}
            >
              {isAr ? "أكّد الإلغاء" : "Void the payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default RecordedPaymentsList;
