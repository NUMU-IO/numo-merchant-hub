import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  createCardIntent,
  createInstapayIntent,
  getInstapayIntent,
  savePlanCard,
  submitInstapayProof,
  type InstapayIntent,
} from "@/services/billingApi";
import PlatformCardFrame, { type IntentOutcome, type SavedCard } from "@/components/billing/PlatformCardFrame";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Copy, Upload, CheckCircle2, Clock, XCircle, CreditCard,
} from "lucide-react";

// Backend error details are English-only — map the known ones so the
// error screen reads naturally in Arabic (same pattern as TopUpDialog).
const AR_ERROR_MAP: [RegExp, string][] = [
  [/already submitted/i, "هذا الإيصال أو رقم العملية مستخدم من قبل — كل تحويل يحتاج إيصالاً ورقم عملية جديدين."],
  [/already confirmed/i, "تم تأكيد هذه العملية بالفعل."],
  [/already in progress/i, "لديك عملية دفع اشتراك قيد التنفيذ بالفعل — أكملها أولاً."],
  [/window .* expired|has expired/i, "انتهت مهلة الدفع لهذه العملية — ابدأ عملية دفع جديدة."],
  [/no longer accept/i, "لم يعد بالإمكان رفع إيصال لهذه العملية — ابدأ عملية دفع جديدة."],
  [/could not decode/i, "تعذر قراءة الصورة — جرّب لقطة شاشة أوضح."],
  [/not found/i, "لم يتم العثور على عملية الدفع — ابدأ عملية جديدة."],
  [/not configured/i, "الدفع عبر إنستاباي غير متاح حالياً — تواصل مع الدعم."],
];

const translateError = (message: string, isAr: boolean): string => {
  if (!isAr) return message;
  for (const [pattern, ar] of AR_ERROR_MAP) {
    if (pattern.test(message)) return ar;
  }
  return message;
};

const PLAN_AR: Record<string, string> = { starter: "ستارتر", pro: "برو", whatsapp: "واتساب" };
const PLAN_EN: Record<string, string> = { whatsapp: "WhatsApp" };
const CYCLE_LABEL: Record<string, [string, string]> = {
  monthly: ["Monthly", "شهري"],
  quarterly: ["Quarterly", "ربع سنوي"],
  annual: ["Annual", "سنوي"],
  yearly: ["Annual", "سنوي"],
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Plan + cycle the merchant picked on the Billing page. */
  plan: string;
  billingCycle: string;
  amountCents: number | null;
  /** An already-open intent to resume instead of creating a new one. */
  resumeIntent?: InstapayIntent | null;
  /** Opens the payment for something other than a plan (e.g. WhatsApp access). */
  createIntent?: () => Promise<InstapayIntent>;
  /** NUMU's card page is available (plan payments only). */
  cardAvailable?: boolean;
  /** Platform InstaPay is configured. */
  instapayAvailable?: boolean;
  /** Replaces the "your store is ready" line once payment activates. */
  activatedNote?: string;
  /** Called when the receipt landed (activated or queued for review). */
  onDone: (activated: boolean) => void;
}

const SubscribeInstapayDialog = ({
  open, onOpenChange, plan, billingCycle, amountCents, resumeIntent, createIntent,
  activatedNote, onDone, cardAvailable = false, instapayAvailable = true,
}: Props) => {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [creating, setCreating] = useState(false);
  const [intent, setIntent] = useState<InstapayIntent | null>(null);
  const [cardIntent, setCardIntent] = useState<InstapayIntent | null>(null);
  const [saveCard, setSaveCard] = useState(true);
  const [txRef, setTxRef] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<"activated" | "under_review" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resume an open payment instead of minting a duplicate (the backend
  // enforces one open intent per tenant anyway).
  useEffect(() => {
    if (open && resumeIntent && resumeIntent.status === "awaiting_proof" && resumeIntent.destination) {
      setIntent(resumeIntent);
    }
  }, [open, resumeIntent]);

  const reset = () => {
    setIntent(null);
    setCardIntent(null);
    setTxRef("");
    setProofFile(null);
    setResult(null);
    setError(null);
  };

  const planName = isAr
    ? (PLAN_AR[plan] ?? plan)
    : (PLAN_EN[plan] ?? plan.charAt(0).toUpperCase() + plan.slice(1));
  const cycleLabel = (CYCLE_LABEL[billingCycle] ?? CYCLE_LABEL.monthly)[isAr ? 1 : 0];
  const egp = (cents: number) =>
    `${(cents / 100).toLocaleString(isAr ? "ar-EG" : "en-US")} ${isAr ? "ج.م" : "EGP"}`;

  const startPayment = async () => {
    setCreating(true);
    try {
      const created = createIntent
        ? await createIntent()
        : await createInstapayIntent(plan, billingCycle);
      setIntent(created);
    } catch (e) {
      const raw = e instanceof Error && e.message
        ? e.message
        : (isAr ? "تعذر إنشاء عملية الدفع" : "Could not start the payment");
      setError(translateError(raw, isAr));
    } finally {
      setCreating(false);
    }
  };

  // Card is for plans only; other purchases (e.g. WhatsApp) pass createIntent.
  const offerCard = cardAvailable && !createIntent;

  const startCardPayment = async () => {
    setCreating(true);
    try {
      setCardIntent(await createCardIntent(plan, billingCycle, saveCard));
    } catch (e) {
      const raw = e instanceof Error && e.message
        ? e.message
        : (isAr ? "تعذر إنشاء عملية الدفع" : "Could not start the payment");
      setError(translateError(raw, isAr));
    } finally {
      setCreating(false);
    }
  };

  const cardIntentStatus = async (): Promise<IntentOutcome> => {
    const current = await getInstapayIntent(cardIntent!.id);
    if (current.status === "succeeded") return "succeeded";
    if (current.status === "failed") return "failed";
    return "pending";
  };

  const submitProof = async () => {
    if (!intent || !proofFile || txRef.trim().length < 3) {
      toast.error(isAr
        ? "أدخل رقم العملية وأرفق لقطة شاشة الإيصال"
        : "Enter the transaction reference and attach the receipt screenshot");
      return;
    }
    setUploading(true);
    try {
      const res = await submitInstapayProof(intent.id, txRef, proofFile);
      const activated = res.activated;
      setResult(activated ? "activated" : "under_review");
      onDone(activated);
    } catch (e) {
      const raw = e instanceof Error && e.message
        ? e.message
        : (isAr ? "تعذر رفع الإيصال" : "Could not upload the receipt");
      setError(translateError(raw, isAr));
    } finally {
      setUploading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(isAr ? "تم النسخ" : "Copied");
  };

  const displayAmount = intent?.amount_cents ?? amountCents;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent
        className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] overflow-y-auto p-4 sm:max-w-[520px] sm:p-6"
        dir={isAr ? "rtl" : "ltr"}
      >
        <DialogHeader className="pe-10 text-start">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-navy/10 text-navy">
              <CreditCard className="h-4 w-4" aria-hidden="true" />
            </span>
            {isAr
              ? `الاشتراك في ${planName} — ${cycleLabel}`
              : `Subscribe to ${planName} — ${cycleLabel}`}
          </DialogTitle>
        </DialogHeader>

        {error ? (
          /* ── Failed: large X + translated reason ──────────────────── */
          <div className="flex flex-col items-center py-8 text-center gap-3">
            <XCircle className="h-20 w-20 text-red-500" strokeWidth={1.5} />
            <p className="text-lg font-bold">
              {isAr ? "حدث خطأ" : "Something went wrong"}
            </p>
            <p className="text-sm text-muted-foreground max-w-[340px]">{error}</p>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
                {isAr ? "إغلاق" : "Close"}
              </Button>
              <Button onClick={() => setError(null)}>
                {isAr ? "المحاولة مرة أخرى" : "Try again"}
              </Button>
            </div>
          </div>
        ) : result ? (
          /* ── Done: activated instantly OR queued for review ───────── */
          <div className="flex flex-col items-center py-6 text-center gap-3">
            <img
              src="/wallet-topup-success.png"
              alt=""
              className="h-52 w-52 select-none"
              draggable={false}
            />
            {result === "activated" ? (
              <>
                <p className="text-lg font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  {isAr ? "تم تفعيل اشتراكك!" : "Your subscription is active!"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activatedNote ?? (isAr
                    ? `أهلاً بيك في باقة ${planName} — متجرك جاهز.`
                    : `Welcome to ${planName} — your store is ready.`)}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  {isAr ? "الإيصال قيد التحقق" : "Receipt under review"}
                </p>
                <p className="text-sm text-muted-foreground max-w-[360px]">
                  {isAr
                    ? "استلمنا الإيصال وجارٍ التحقق منه (عادةً خلال ساعات قليلة). سيتم تفعيل اشتراكك تلقائياً فور اكتمال المراجعة."
                    : "We received your receipt and it's being verified (usually within a few hours). Your subscription activates automatically once approved."}
                </p>
              </>
            )}
            <Button className="mt-2" onClick={() => { reset(); onOpenChange(false); }}>
              {isAr ? "تم" : "Done"}
            </Button>
          </div>
        ) : cardIntent?.card_form ? (
          /* ── Card: NUMU's card page, posted straight to Kashier ───── */
          <PlatformCardFrame
            cardForm={cardIntent.card_form}
            amountLabel={egp(cardIntent.amount_cents)}
            checkStatus={cardIntentStatus}
            onSucceeded={async (saved: SavedCard | null) => {
              if (saved) {
                // The plan is paid either way; a failed save only means
                // the next renewal is paid by hand.
                await savePlanCard(cardIntent.id, saved).catch(() =>
                  toast.error(isAr ? "تعذر حفظ البطاقة للتجديد التلقائي" : "Couldn't save the card for auto-renew"),
                );
              }
              setCardIntent(null);
              setResult("activated");
              onDone(true);
            }}
            onRetry={() => setCardIntent(null)}
          />
        ) : intent ? (
          /* ── Pay + upload proof ────────────────────────────────────── */
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                {isAr
                  ? "حوّل المبلغ عبر تطبيق إنستاباي أو تطبيق البنك إلى العنوان التالي، واكتب الرمز المرجعي في خانة الملاحظات:"
                  : "Transfer the amount via InstaPay or your bank app to the address below, and include the reference code in the transfer note:"}
              </p>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{isAr ? "العنوان (IPA)" : "Address (IPA)"}</p>
                  <p className="font-mono font-semibold" dir="ltr">{intent.destination}</p>
                </div>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => copy(intent.destination || "")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{isAr ? "الرمز المرجعي (مهم)" : "Reference code (important)"}</p>
                  <p className="font-mono font-semibold">{intent.reference_code}</p>
                </div>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => copy(intent.reference_code)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm">{isAr ? "المبلغ (بالضبط)" : "Amount (exact)"}</p>
                <p className="font-bold tabular-nums">{egp(intent.amount_cents)}</p>
              </div>
              {intent.qr_payload && (
                <div className="flex justify-center pt-1">
                  <div className="bg-white p-2 rounded-lg">
                    <QRCodeSVG value={intent.qr_payload} size={120} />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">
                {isAr ? "بعد التحويل، ارفع إيصال العملية:" : "After transferring, upload the receipt:"}
              </p>
              <Input
                placeholder={isAr ? "رقم العملية من الإيصال" : "Transaction reference from the receipt"}
                value={txRef}
                onChange={(e) => setTxRef(e.target.value)}
              />
              <Input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button className="w-full gap-2" onClick={submitProof} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isAr ? "رفع الإيصال وتفعيل الاشتراك" : "Upload receipt & activate"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {isAr
                ? "لو تطابق الإيصال، يتفعّل اشتراكك فوراً — وإلا يُراجع يدوياً خلال ساعات."
                : "If the receipt matches, your subscription activates instantly — otherwise it's reviewed manually within hours."}
            </p>
          </div>
        ) : (
          /* ── Confirm: plan + price → create the payment ────────────── */
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{isAr ? "الباقة" : "Plan"}</p>
                <p className="font-semibold">{planName} · {cycleLabel}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{isAr ? "المبلغ" : "Amount"}</p>
                <p className="font-bold tabular-nums">
                  {displayAmount != null ? egp(displayAmount) : "…"}
                </p>
              </div>
            </div>
            {offerCard && (
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox checked={saveCard} onCheckedChange={(c) => setSaveCard(c === true)} className="mt-0.5" />
                <span>
                  {isAr
                    ? "احفظ البطاقة وجدّد الاشتراك تلقائياً كل دورة. يمكنك إيقافه في أي وقت من صفحة الفوترة."
                    : "Save my card and renew automatically each cycle. You can turn this off anytime on Billing."}
                </span>
              </label>
            )}
            {offerCard && (
              <Button className="w-full gap-2" onClick={startCardPayment} disabled={creating}>
                {creating
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><CreditCard className="h-4 w-4" />{isAr ? "الدفع بالبطاقة" : "Pay with card"}</>}
              </Button>
            )}
            {instapayAvailable && (
              <>
                <p className="text-sm text-muted-foreground">
                  {isAr
                    ? "هننشئ لك عنوان تحويل ورمزاً مرجعياً — حوّل المبلغ من تطبيق إنستاباي أو البنك، وارفع الإيصال، ويتفعّل اشتراكك."
                    : "We'll generate a transfer address and a reference code — transfer from your InstaPay or bank app, upload the receipt, and your subscription activates."}
                </p>
                <Button
                  className="w-full"
                  variant={offerCard ? "outline" : "default"}
                  onClick={startPayment}
                  disabled={creating}
                >
                  {creating
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : (isAr ? "متابعة الدفع عبر إنستاباي" : "Continue with InstaPay")}
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubscribeInstapayDialog;
