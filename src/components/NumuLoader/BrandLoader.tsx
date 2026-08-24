/**
 * NUMU Brand Loader — the canonical loading indicator.
 *
 * The N mark fills with saffron from the bottom up. Replaces the earlier
 * ring loader (a breathing tile inside a spinning saffron arc): the mark
 * alone carries the wait now, and the fill IS the motion.
 *
 * Kept in sync with the inline `#numu-splash` in index.html, which paints
 * before the CSS bundle exists and so must duplicate the animation. Same
 * mask, same size ratio, same easing — change one, change the other, or
 * the splash-to-React handoff visibly jumps.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { NumuLoader } from "@/components/ui/numu-loader";

interface BrandLoaderProps {
  /** Box the mark is centred in. The mark itself is 66% of this. */
  size?: number;
}

export function BrandLoader({ size = 104 }: BrandLoaderProps) {
  // 0.66 lands the mark at the optical weight the old 60px tile had
  // inside its 104px ring, so nothing shifts where this drops in.
  const mark = Math.round(size * 0.66);
  return (
    <div className="grid place-items-center" style={{ width: size, height: size }}>
      <NumuLoader size={mark} variant="rise" />
    </div>
  );
}

interface BrandLoadingScreenProps {
  /** Show the "taking longer than usual" affordance after this many ms. */
  slowAfterMs?: number;
  /** Boot failed (no network, no cached session) — show an error + retry. */
  error?: boolean;
  onRetry?: () => void;
}

/**
 * Full-screen loader — auth/session/store resolution. Styled to be
 * indistinguishable from the index.html `#numu-splash` it takes over
 * from. Background follows the `.dark` class, which the blocking script
 * in index.html applies before first paint from the stored theme (or the
 * OS scheme), so the splash → React handoff never flashes.
 *
 * A hung /auth/me used to mean an indefinite loader with no way out.
 * After `slowAfterMs` it offers a Retry; with `error` it says so plainly.
 */
export function BrandLoadingScreen({
  slowAfterMs = 8000,
  error = false,
  onRetry,
}: BrandLoadingScreenProps) {
  const { t } = useTranslation();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (error) return;
    const id = window.setTimeout(() => setSlow(true), slowAfterMs);
    return () => window.clearTimeout(id);
  }, [slowAfterMs, error]);

  const retry = onRetry ?? (() => window.location.reload());
  const showHelp = error || slow;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white dark:bg-[#0B1420]"
      role={error ? "alert" : undefined}
    >
      <BrandLoader />
      {showHelp && (
        <div className="mt-7 max-w-xs px-6 text-center text-[#6B7280] dark:text-[#C7D0DC]">
          <p className={`text-sm font-semibold ${error ? "text-[#14253D] dark:text-white" : ""}`}>
            {error ? t("shell.offlineTitle") : t("shell.slowLoad")}
          </p>
          {error && <p className="mt-1 text-[13px] leading-relaxed">{t("shell.offlineBody")}</p>}
          <button
            type="button"
            onClick={retry}
            className="mt-4 inline-flex h-9 items-center rounded-lg px-4 text-[13px] font-bold shadow-sm"
            style={{ background: "#E89A2C", color: "#14253D" }}
          >
            {t("shell.retry")}
          </button>
        </div>
      )}
    </div>
  );
}
