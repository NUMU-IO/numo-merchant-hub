import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

/**
 * Signed Kashier order from the API (wallet top-up or plan payment) plus the
 * NUMU card page that collects the card.
 */
export interface PlatformCardForm {
  page_url: string;
  endpoint: string;
  hash: string;
  body: Record<string, unknown>;
  /** Plan auto-renew: save/agreement fields the card page adds to the card. */
  card_extra?: Record<string, unknown>;
}

export type IntentOutcome = "succeeded" | "failed" | "pending";

/** Kashier card token from a plan payment that asked to save the card. */
export interface SavedCard {
  card_token: string;
  agreement_id: string | null;
  last4: string;
}

interface Props {
  cardForm: PlatformCardForm;
  amountLabel: string;
  /** Reads our intent's status; the platform webhook is the source of truth. */
  checkStatus: () => Promise<IntentOutcome>;
  onSucceeded: (saved: SavedCard | null) => void;
  /** A card try failed; the caller mints a fresh intent (new order reference). */
  onRetry: () => void;
}

const POLL_MS = 2000;
const POLL_TRIES = 30;

// The card page must sit on NUMU's API origin, never the hub's own, so no
// hub script can read the card fields.
const pageOrigin = (url: string): string | null => {
  try {
    const u = new URL(url);
    const numu = u.protocol === "https:" && /(^|\.)numueg\.app$/.test(u.hostname);
    const dev = u.protocol === "http:" && u.hostname === "localhost";
    return (numu || dev) && u.origin !== window.location.origin ? u.origin : null;
  } catch {
    return null;
  }
};

const toFragment = (value: unknown) =>
  encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(value)))));

type Stage = "card" | "verifying" | "done" | "failed";

/**
 * Frames NUMU's card page (API origin, strict CSP) for platform payments.
 * The card goes from that page straight to Kashier; this component only
 * hears the outcome and confirms it against our API.
 */
const PlatformCardFrame = ({ cardForm, amountLabel, checkStatus, onSucceeded, onRetry }: Props) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [stage, setStage] = useState<Stage>("card");
  const [error, setError] = useState<string | null>(null);
  const polling = useRef(false);
  const saved = useRef<SavedCard | null>(null);
  const origin = pageOrigin(cardForm.page_url);

  const fail = (message: string) => {
    setError(message);
    setStage("failed");
  };

  const verify = async () => {
    if (polling.current) return;
    polling.current = true;
    setStage("verifying");
    for (let i = 0; i < POLL_TRIES; i++) {
      const outcome = await checkStatus().catch(() => "pending" as const);
      if (outcome === "succeeded") {
        setStage("done");
        onSucceeded(saved.current);
        return;
      }
      if (outcome === "failed") {
        polling.current = false;
        fail(isAr ? "تم رفض الدفع." : "The payment was declined.");
        return;
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    polling.current = false;
    fail(
      isAr
        ? "لم يصلنا تأكيد الدفع بعد. إذا خُصم المبلغ فسيتم التفعيل تلقائياً خلال دقائق."
        : "We haven't received the payment confirmation yet. If you were charged, it will apply automatically within minutes.",
    );
  };

  useEffect(() => {
    if (!origin) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.data?.source !== "numu-pay") return;
      if (event.data.status === "submitted") {
        saved.current = event.data.saved ?? null;
        void verify();
      }
      else if (event.data.status === "failed") {
        fail(event.data.message || (isAr ? "تعذر إتمام الدفع." : "Payment failed."));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin]);

  if (!origin) {
    return (
      <p className="py-6 text-center text-sm text-red-600">
        {isAr ? "الدفع بالبطاقة غير متاح حالياً." : "Card payment is unavailable right now."}
      </p>
    );
  }

  if (stage === "failed") {
    return (
      <div className="flex flex-col items-center py-8 gap-3 text-center">
        <XCircle className="h-14 w-14 text-red-500" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground max-w-[340px]">{error}</p>
        <Button onClick={onRetry}>{isAr ? "حاول مرة أخرى" : "Try again"}</Button>
      </div>
    );
  }

  if (stage === "verifying" || stage === "done") {
    return (
      <div className="flex flex-col items-center py-8 gap-3 text-center">
        {stage === "done" ? (
          <CheckCircle2 className="h-14 w-14 text-green-500" />
        ) : (
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        )}
        <p className="font-semibold">
          {stage === "done"
            ? isAr ? "تم الدفع بنجاح" : "Payment successful"
            : isAr ? "جارٍ تأكيد الدفع..." : "Confirming your payment..."}
        </p>
      </div>
    );
  }

  const { page_url, ...params } = cardForm;
  const src = `${page_url}#${toFragment({
    params,
    parent: window.location.origin,
    lang: isAr ? "ar" : "en",
    amount: amountLabel,
  })}`;

  return (
    <iframe
      title={isAr ? "الدفع بالبطاقة" : "Card payment"}
      src={src}
      className="w-full h-[540px] border-0"
      referrerPolicy="no-referrer"
    />
  );
};

export default PlatformCardFrame;
