/**
 * InstaPay proof review block for the order detail drawer.
 *
 * Shown only when ``payment_method === "instapay"`` and the order has
 * at least one proof. Lists proofs chronologically; the latest one
 * drives the approve/reject CTA. Approval flips the order to PAID
 * end-to-end (the backend fires OrderPaidEvent — same downstream as
 * auto-approved proofs).
 *
 * State is sourced via React Query (``queryKey: ["paymentProofs",
 * orderId]``) so the pending-verification chip's count badge and the
 * orders list refresh in lockstep with approve / reject mutations.
 */

import { useState } from "react";
import {
  AlertCircle,
  Check,
  ImageOff,
  Loader2,
  RefreshCw,
  X as XIcon,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
  approvePaymentProof,
  fetchPaymentProofs,
  rejectPaymentProof,
  type PaymentProof,
} from "@/services/storeApi";
import { showError } from "@/lib/show-error";

interface Props {
  storeId: string;
  orderId: string;
  onPaid?: () => void; // parent refreshes order when approval flips it
  isAr: boolean;
}

const proofStatusColor: Record<string, string> = {
  awaiting_review: "bg-amber-100 text-amber-900",
  auto_approved: "bg-emerald-100 text-emerald-900",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-red-100 text-red-900",
  expired: "bg-slate-100 text-slate-700",
};

export const paymentProofsQueryKey = (storeId: string, orderId: string) =>
  ["paymentProofs", storeId, orderId] as const;

export default function InstapayProofReview({
  storeId,
  orderId,
  onPaid,
  isAr,
}: Props) {
  const queryClient = useQueryClient();

  const proofsQuery = useQuery<PaymentProof[]>({
    queryKey: paymentProofsQueryKey(storeId, orderId),
    queryFn: () => fetchPaymentProofs(storeId, orderId),
    enabled: !!storeId && !!orderId,
    // Latest proof is the only one the CTA reads — a short staleness
    // window avoids refetching on every drawer re-open yet still
    // picks up auto-approvals that fire after the customer uploads.
    staleTime: 30_000,
  });

  const invalidateRelated = () => {
    queryClient.invalidateQueries({
      queryKey: paymentProofsQueryKey(storeId, orderId),
    });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({
      queryKey: ["instapay-pending-count", storeId],
    });
    queryClient.invalidateQueries({
      queryKey: ["instapay-pending-orders", storeId],
    });
  };

  const approveMutation = useMutation({
    mutationFn: (proofId: string) => approvePaymentProof(storeId, proofId),
    onSuccess: () => {
      toast.success(isAr ? "تمت الموافقة على الدفع" : "Payment approved");
      invalidateRelated();
      onPaid?.();
    },
    onError: (err) => showError(err),
  });

  const rejectMutation = useMutation({
    mutationFn: (args: { proofId: string; reason: string }) =>
      rejectPaymentProof(storeId, args.proofId, args.reason),
    onSuccess: () => {
      toast.success(isAr ? "تم رفض الإثبات" : "Proof rejected");
      setRejectOpen(false);
      invalidateRelated();
    },
    onError: (err) => showError(err),
  });

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [activeProofId, setActiveProofId] = useState<string | null>(null);
  // Lightbox state — the proof image is small on the card but the
  // merchant often needs to zoom to read tiny bank-app receipt text.
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  // Tracks proof IDs whose signed URL failed to load. Signed URLs are
  // 1-hour TTL; a merchant who leaves the drawer open longer (or whose
  // browser blocks the storage origin) sees a broken-image icon. We
  // swap the broken image for an explicit "image unavailable" panel
  // with a Refresh button that re-fetches the URL.
  const [imageFailed, setImageFailed] = useState<Record<string, boolean>>({});

  const refreshSignedUrl = () => {
    setImageFailed({});
    proofsQuery.refetch();
  };

  const openReject = (proofId: string) => {
    setActiveProofId(proofId);
    setRejectReason("");
    setRejectOpen(true);
  };

  const handleReject = () => {
    if (!activeProofId || rejectReason.trim().length < 3) return;
    rejectMutation.mutate({
      proofId: activeProofId,
      reason: rejectReason.trim(),
    });
  };

  const busy = approveMutation.isPending || rejectMutation.isPending;

  if (proofsQuery.isLoading) {
    return (
      <div className="rounded-md border bg-muted/20 p-3 text-xs flex items-center gap-2">
        <Loader2 className="w-3 h-3 animate-spin" />
        {isAr ? "تحميل الإثبات..." : "Loading proof…"}
      </div>
    );
  }

  const proofs = proofsQuery.data ?? [];
  if (proofs.length === 0) {
    return (
      <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
        {isAr
          ? "لم يرسل العميل إثباتاً بعد."
          : "Customer hasn't uploaded a proof yet."}
      </div>
    );
  }

  const latest = proofs[proofs.length - 1];
  const canReview = latest.status === "awaiting_review";
  const approvingThis =
    approveMutation.isPending && approveMutation.variables === latest.id;

  return (
    <>
      <div className="rounded-md border bg-background p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold">
            {isAr ? "إثبات الدفع" : "Payment proof"}
          </span>
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
              proofStatusColor[latest.status] || "bg-muted"
            }`}
          >
            {latest.status}
          </span>
        </div>

        {latest.signed_image_url && !imageFailed[latest.id] ? (
          <button
            type="button"
            onClick={() => setLightboxUrl(latest.signed_image_url)}
            className="block w-full cursor-zoom-in"
            aria-label={isAr ? "فتح الصورة بالحجم الكامل" : "Open image full size"}
          >
            <img
              src={latest.signed_image_url}
              alt="Payment proof"
              className="w-full max-h-48 object-contain rounded border bg-muted/10"
              onError={() =>
                setImageFailed((prev) => ({ ...prev, [latest.id]: true }))
              }
            />
          </button>
        ) : (
          <div className="w-full max-h-48 rounded border bg-muted/20 p-6 flex flex-col items-center gap-2 text-center">
            <ImageOff className="w-6 h-6 text-muted-foreground" />
            <div className="text-xs text-muted-foreground">
              {isAr
                ? "تعذر تحميل صورة الإثبات. قد يكون الرابط الموقّع قد انتهى."
                : "Could not load the proof image. The signed URL may have expired."}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={refreshSignedUrl}
              disabled={proofsQuery.isFetching}
            >
              {proofsQuery.isFetching ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="w-3 h-3 mr-1" />
              )}
              {isAr ? "تحديث" : "Refresh"}
            </Button>
          </div>
        )}

        <div className="text-xs">
          <div>
            <span className="text-muted-foreground">
              {isAr ? "رقم المعاملة: " : "Transaction ref: "}
            </span>
            <span className="font-mono">{latest.transaction_ref}</span>
          </div>
          {latest.declared_amount_cents != null ? (
            <div>
              <span className="text-muted-foreground">
                {isAr ? "المبلغ المُصرح به: " : "Declared amount: "}
              </span>
              <span>
                {(latest.declared_amount_cents / 100).toFixed(2)} EGP
              </span>
            </div>
          ) : null}
          {latest.rejection_reason ? (
            <div className="text-red-700 mt-1 flex items-start gap-1">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{latest.rejection_reason}</span>
            </div>
          ) : null}
        </div>

        {canReview ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={busy}
              onClick={() => approveMutation.mutate(latest.id)}
            >
              {approvingThis ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <Check className="w-3 h-3 mr-1" />
              )}
              {isAr ? "موافقة" : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => openReject(latest.id)}
            >
              <XIcon className="w-3 h-3 mr-1" />
              {isAr ? "رفض" : "Reject"}
            </Button>
          </div>
        ) : null}

        {proofs.length > 1 ? (
          <div className="text-[11px] text-muted-foreground pt-2 border-t">
            {isAr
              ? `${proofs.length} إثبات تم إرساله`
              : `${proofs.length} proofs submitted`}
          </div>
        ) : null}
      </div>

      {/* Lightbox — clicking the proof card opens the signed URL in a
          full-width shadcn Dialog so merchants can zoom in without
          losing context. Click anywhere on the overlay to close. */}
      <Dialog
        open={lightboxUrl !== null}
        onOpenChange={(open) => !open && setLightboxUrl(null)}
      >
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {isAr ? "إثبات الدفع" : "Payment proof"}
            </DialogTitle>
          </DialogHeader>
          {lightboxUrl ? (
            <img
              src={lightboxUrl}
              alt="Payment proof (full size)"
              className="w-full h-auto object-contain bg-black/5"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isAr ? "سبب الرفض" : "Rejection reason"}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={
              isAr
                ? "مثال: المبلغ غير صحيح، أرسل الفرق أو تواصل معنا."
                : "e.g. Amount mismatch — please send the missing X EGP or contact support."
            }
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRejectOpen(false)}
              disabled={busy}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleReject}
              disabled={busy || rejectReason.trim().length < 3}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : null}
              {isAr ? "إرسال الرفض" : "Send rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
