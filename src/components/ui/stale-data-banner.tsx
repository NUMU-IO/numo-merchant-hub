/**
 * "You're offline — this is what we last saw."
 *
 * Non-negotiable rule this exists to enforce: **money figures are never shown
 * from a cache without saying so.** A merchant who reads yesterday's revenue as
 * today's makes a real business decision on a wrong number — that is a
 * correctness bug wearing a UX costume, not a cosmetic issue.
 *
 * Only appears when BOTH are true: the browser is offline, and the data on
 * screen came from a previous session. Online behaviour is untouched.
 */
import { CloudOff, RotateCw } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface StaleDataBannerProps {
  /** `dataUpdatedAt` from the query backing this view. */
  updatedAt?: number | null;
  onRetry?: () => void;
}

export function StaleDataBanner({ updatedAt, onRetry }: StaleDataBannerProps) {
  const { isRTL, language } = useLanguage();
  const online = useOnlineStatus();

  if (online || !updatedAt) return null;

  const time = new Date(updatedAt).toLocaleTimeString(
    language === "ar" ? "ar-EG" : "en-US",
    { hour: "2-digit", minute: "2-digit" },
  );

  return (
    <div
      // polite, not assertive: it is context, not an emergency, and it must not
      // interrupt a screen-reader mid-sentence.
      role="status"
      aria-live="polite"
      className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 dark:border-amber-500/30 dark:bg-amber-950/40"
    >
      <CloudOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <p className="min-w-0 flex-1 text-[13px] font-semibold text-amber-900 dark:text-amber-200">
        {isRTL ? `إنت أوفلاين — البيانات دي من ${time}` : `You're offline — showing data from ${time}`}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-amber-800 transition-colors hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
          aria-label={isRTL ? "إعادة المحاولة" : "Retry"}
        >
          <RotateCw className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
