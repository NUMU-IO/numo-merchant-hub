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
  AlertTriangle,
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
  fetchSimilarPaymentProofs,
  rejectPaymentProof,
  type OcrStatus,
  type PaymentProof,
  type SimilarProof,
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

// Friendly text + tone class per OCR status discriminator. Kept
// outside the component so the bilingual lookup is a pure function;
// the UI just renders ocrStatusCopy[status][lang].
//
// "ok" is deliberately NOT called "Verified", and deliberately not green.
// It means the provider ran and returned text — nothing more. Whether the
// amount, recipient or reference actually matched is decided by the opt-in
// rules in payment settings, which are off unless the merchant turned them
// on. Labelling a successful read as "Verified" put a green tick on a
// screenshot of a GitHub page.
const ocrStatusCopy: Record<
  OcrStatus,
  { en: string; ar: string; tone: "ok" | "warn" | "muted" }
> = {
  ok: { en: "Image read", ar: "تمت قراءة الصورة", tone: "muted" },
  skipped: {
    en: "OCR not run",
    ar: "لم يتم التحقق",
    tone: "muted",
  },
  failed: {
    en: "Couldn't read image",
    ar: "تعذرت قراءة الصورة",
    tone: "warn",
  },
  failed_gpu: {
    en: "OCR engine busy — try again in a minute",
    ar: "محرك التحقق مشغول — حاول بعد دقيقة",
    tone: "warn",
  },
  failed_timeout: {
    en: "OCR engine timed out",
    ar: "انتهت مهلة محرك التحقق",
    tone: "warn",
  },
  failed_auth: {
    en: "OCR engine authentication failed",
    ar: "فشل المصادقة مع محرك التحقق",
    tone: "warn",
  },
  failed_transport: {
    en: "Couldn't reach OCR engine",
    ar: "تعذر الوصول إلى محرك التحقق",
    tone: "warn",
  },
  failed_parse: {
    en: "OCR engine returned an unexpected response",
    ar: "استجابة غير متوقعة من محرك التحقق",
    tone: "warn",
  },
  failed_empty: {
    en: "OCR found no readable text",
    ar: "لم يجد محرك التحقق نصاً مقروءاً",
    tone: "muted",
  },
};

const ocrToneClass: Record<"ok" | "warn" | "muted", string> = {
  ok: "border-emerald-300 bg-emerald-50/60 text-emerald-900",
  warn: "border-amber-300 bg-amber-50/60 text-amber-900",
  muted: "border-border bg-muted/30 text-muted-foreground",
};

// Phase D — friendly bilingual copy per auto-approval block reason.
// Keys must match the backend rule tags emitted in
// ``auto_approval.py``. Unknown tags fall back to the raw string so
// a new rule isn't invisible while a frontend deploy catches up.
const blockReasonCopy: Record<string, { en: string; ar: string }> = {
  intent_expired: {
    en: "Payment window expired before the proof was submitted",
    ar: "انتهت مهلة الدفع قبل إرسال الإثبات",
  },
  amount_above_auto_approve_threshold: {
    en: "Order total is above your auto-approve threshold",
    ar: "إجمالي الطلب أعلى من حد الموافقة التلقائية",
  },
  declared_amount_mismatch: {
    en: "Customer-declared amount doesn't match the order total",
    ar: "المبلغ الذي أدخله العميل لا يطابق إجمالي الطلب",
  },
  daily_auto_approve_count_exceeded: {
    en: "Today's auto-approval count cap has been reached",
    ar: "تم الوصول لحد عدد الموافقات التلقائية اليومي",
  },
  daily_auto_approve_amount_exceeded: {
    en: "Today's auto-approval amount cap has been reached",
    ar: "تم الوصول لحد مبلغ الموافقات التلقائية اليومي",
  },
  ocr_amount_mismatch: {
    en: "Amount on the screenshot doesn't match the order total",
    ar: "المبلغ في الصورة لا يطابق إجمالي الطلب",
  },
  ocr_ipa_mismatch: {
    en: "Recipient IPA on the screenshot doesn't match yours",
    ar: "حساب المستلم في الصورة لا يطابق حسابك",
  },
  ocr_note_missing_reference: {
    en: "Customer didn't include your reference code in the bank-app note",
    ar: "العميل لم يكتب رمز المرجع في خانة الملاحظات",
  },
  ocr_transaction_ref_mismatch: {
    en: "Transaction reference the customer typed doesn't match the screenshot",
    ar: "الرقم المرجعي الذي كتبه العميل لا يطابق ما في الصورة",
  },
  ocr_recipient_name_mismatch: {
    en: "Recipient name on the screenshot doesn't match yours",
    ar: "اسم المستلم في الصورة لا يطابق اسمك",
  },
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

  // Latest proof drives the similarity panel — the older ones are
  // historical retries, not what the merchant is reviewing right now.
  // Pulled out before the SimilarProof query is set up so the query's
  // ``enabled`` guard and ``queryKey`` can both reference it.
  const latestProofId = proofsQuery.data?.length
    ? proofsQuery.data[proofsQuery.data.length - 1].id
    : undefined;

  const similarQuery = useQuery<SimilarProof[]>({
    queryKey: ["paymentProofs", storeId, "similar", latestProofId],
    queryFn: () => fetchSimilarPaymentProofs(storeId, latestProofId!),
    // Skip pre-Phase-A proofs (no perceptual_hash → backend returns []
    // anyway, but skipping the call avoids a wasted request) — and
    // wait for the proofs list so we know what to ask about.
    enabled: !!storeId && !!latestProofId,
    // Similarity is a function of the historical corpus, which only
    // grows. Cache for the lifetime of the drawer; the hits aren't
    // sensitive enough to justify aggressive refetching.
    staleTime: 5 * 60_000,
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

        {/* ── OCR readout (Phase C) ─────────────────────────────────
             Renders only when an OCR provider was active for this
             store at submission time. Carries the verifier's verdict
             on the customer's screenshot — useful both for "OCR
             confirms 62 EGP matches order" and for "engine busy,
             retry the review later". The friendly copy comes from
             ``ocrStatusCopy``. */}
        {latest.ocr_status ? (
          <div
            className={`rounded-md border p-3 space-y-1 text-[11px] ${
              ocrToneClass[
                ocrStatusCopy[latest.ocr_status as OcrStatus]?.tone ?? "muted"
              ]
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">
                {isAr
                  ? ocrStatusCopy[latest.ocr_status as OcrStatus]?.ar ??
                    latest.ocr_status
                  : ocrStatusCopy[latest.ocr_status as OcrStatus]?.en ??
                    latest.ocr_status}
              </span>
              {latest.ocr_provider ? (
                <span className="font-mono text-[9px] uppercase opacity-70">
                  {latest.ocr_provider}
                </span>
              ) : null}
            </div>
            {/* Nothing found. A genuine receipt yields an amount at the
                very least, so "read fine, found nothing" is the loudest
                signal available that this image is not a receipt — and it
                used to render as blank space beneath a green tick. */}
            {latest.ocr_status === "ok" &&
              latest.ocr_extracted_amount_cents == null &&
              !latest.ocr_extracted_ipa &&
              !latest.ocr_extracted_note &&
              !latest.ocr_extracted_transaction_ref &&
              !latest.ocr_extracted_recipient_name && (
                <div className="pt-1 border-t border-current/20 font-medium text-amber-800">
                  {isAr
                    ? "لم يُعثر على أي بيانات دفع في هذه الصورة — لا مبلغ ولا رقم مرجعي ولا مستلم. راجعها بنفسك قبل القبول."
                    : "No payment details found in this image — no amount, no reference, no recipient. Check it yourself before accepting."}
                </div>
              )}
            {(latest.ocr_extracted_amount_cents != null ||
              latest.ocr_extracted_ipa ||
              latest.ocr_extracted_note ||
              latest.ocr_extracted_transaction_ref ||
              latest.ocr_extracted_recipient_name) && (
              <div className="space-y-0.5 pt-1 border-t border-current/20">
                {latest.ocr_extracted_amount_cents != null ? (
                  <div>
                    <span className="opacity-70">
                      {isAr ? "المبلغ المقروء: " : "Amount read: "}
                    </span>
                    <span className="tabular-nums">
                      {(latest.ocr_extracted_amount_cents / 100).toFixed(2)} EGP
                    </span>
                  </div>
                ) : null}
                {latest.ocr_extracted_ipa ? (
                  <div>
                    <span className="opacity-70">
                      {isAr ? "المستلم المقروء: " : "Recipient IPA: "}
                    </span>
                    <span className="font-mono">
                      {latest.ocr_extracted_ipa}
                    </span>
                  </div>
                ) : null}
                {latest.ocr_extracted_recipient_name ? (
                  <div>
                    <span className="opacity-70">
                      {isAr ? "اسم المستلم: " : "Recipient name: "}
                    </span>
                    {/* Pre-wrap so RTL Arabic + masking asterisks
                        don't get reflowed by the browser into a
                        misleading shape. The OCR'd block is the
                        ground truth. */}
                    <span className="whitespace-pre-wrap break-words">
                      {latest.ocr_extracted_recipient_name}
                    </span>
                  </div>
                ) : null}
                {latest.ocr_extracted_transaction_ref ? (
                  <div>
                    <span className="opacity-70">
                      {isAr ? "الرقم المرجعي المقروء: " : "Txn ref read: "}
                    </span>
                    <span className="font-mono tabular-nums">
                      {latest.ocr_extracted_transaction_ref}
                    </span>
                  </div>
                ) : null}
                {latest.ocr_extracted_note ? (
                  <div>
                    <span className="opacity-70">
                      {isAr ? "الملاحظة: " : "Note: "}
                    </span>
                    <span className="whitespace-pre-wrap break-words">
                      {latest.ocr_extracted_note}
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {/* ── Auto-approval block reasons (Phase D) ────────────────
             Persisted at submission time; surfaces every rule the
             engine tripped on the latest proof so the merchant can
             see exactly what to verify before approving manually.
             Hidden when the array is empty / null (approved proofs
             and pre-Phase-D rows). */}
        {latest.auto_approval_block_reasons &&
        latest.auto_approval_block_reasons.length > 0 ? (
          <div className="rounded-md border border-amber-300 bg-amber-50/60 p-3 space-y-1.5 text-[11px] text-amber-900">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              {isAr
                ? "لم تتم الموافقة التلقائية"
                : "Auto-approval was blocked"}
            </div>
            <ul className="list-disc ms-4 space-y-0.5">
              {latest.auto_approval_block_reasons.map((r) => {
                const copy = blockReasonCopy[r];
                const text = copy ? (isAr ? copy.ar : copy.en) : r;
                return <li key={r}>{text}</li>;
              })}
            </ul>
          </div>
        ) : null}

        {/* ── Possibly Related Submissions (Phase B) ────────────────
             Lists prior proofs in this store within Hamming distance
             ≤ 8. Surfaces e.g. the same screenshot resubmitted across
             two orders so the merchant can spot replay attacks before
             approving. Empty state → panel hides; loading state is
             silent so a slow query doesn't push the CTA buttons down. */}
        {similarQuery.data && similarQuery.data.length > 0 ? (
          <div className="rounded-md border border-amber-300 bg-amber-50/60 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
              <AlertTriangle className="w-3.5 h-3.5" />
              {isAr
                ? `قد تكون مرتبطة بـ ${similarQuery.data.length} إثبات سابق`
                : `Possibly related to ${similarQuery.data.length} prior submission${
                    similarQuery.data.length === 1 ? "" : "s"
                  }`}
            </div>
            <ul className="space-y-1.5">
              {similarQuery.data.map((sim) => (
                <li
                  key={sim.proof_id}
                  className="flex items-center gap-2 text-[11px]"
                >
                  <button
                    type="button"
                    onClick={() => setLightboxUrl(sim.signed_image_url)}
                    className="shrink-0 cursor-zoom-in"
                    aria-label={
                      isAr
                        ? `فتح صورة الطلب ${sim.order_number}`
                        : `Open image for order ${sim.order_number}`
                    }
                  >
                    <img
                      src={sim.signed_image_url}
                      alt=""
                      className="w-10 h-10 object-cover rounded border bg-muted/20"
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      #{sim.order_number}
                    </div>
                    <div className="text-muted-foreground truncate font-mono">
                      {sim.transaction_ref}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[9px] uppercase ${
                        proofStatusColor[sim.status] || "bg-muted"
                      }`}
                    >
                      {sim.status}
                    </span>
                    {/* Distance is the actionable fraud signal: 0 means
                        identical bytes (post-sanitisation), low single
                        digits mean re-saved/cropped, higher means
                        coincidental similarity. */}
                    <div className="text-[9px] text-muted-foreground tabular-nums mt-0.5">
                      Δ {sim.hamming_distance}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

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
