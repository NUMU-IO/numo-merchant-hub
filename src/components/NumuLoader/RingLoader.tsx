/**
 * NUMU Ring Loader — the canonical loading indicator.
 *
 * React port of the inline `#numu-splash` in index.html (NHUB UI kit
 * Loader): N-mark tile breathing in place, encircled by a saffron arc
 * spinner on a warm cream track. Keep both in sync when tweaking.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface RingLoaderProps {
  size?: number;
  /**
   * Track color driver. "app" follows the dashboard theme (Tailwind
   * `dark` class); "system" mirrors the index.html splash exactly
   * (prefers-color-scheme media query) so the splash → React handoff
   * is pixel-identical.
   */
  scheme?: "app" | "system";
}

export function RingLoader({ size = 104, scheme = "app" }: RingLoaderProps) {
  const tile = Math.round(size * (60 / 104));
  const radius = Math.round(size * (17 / 104));

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      <style>{ringStyles}</style>
      <div
        className="overflow-hidden shadow-[0_1px_3px_rgba(20,37,61,.05),0_12px_28px_-16px_rgba(20,37,61,.32)]"
        style={{
          width: tile,
          height: tile,
          borderRadius: radius,
          animation: "nl-breathe 1.8s ease-in-out infinite",
        }}
      >
        <img
          src="/numu-n-mark.jpg"
          alt="NUMU"
          width={tile}
          height={tile}
          className="block h-full w-full object-cover"
        />
      </div>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 104 104">
        <circle
          cx="52"
          cy="52"
          r="50"
          fill="none"
          strokeWidth="4"
          className={scheme === "system" ? "nl-track-sys" : "nl-track-app"}
        />
        <circle
          cx="52"
          cy="52"
          r="50"
          fill="none"
          stroke="#E89A2C"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="80 220"
          style={{
            transformOrigin: "center",
            animation: "nl-spin 1.05s cubic-bezier(.5,.15,.4,.9) infinite",
          }}
        />
      </svg>
    </div>
  );
}

interface NumuRingScreenProps {
  /** Show the "taking longer than usual" affordance after this many ms. */
  slowAfterMs?: number;
  /** Boot failed (no network, no cached session) — show an error + retry. */
  error?: boolean;
  onRetry?: () => void;
}

/**
 * Full-screen ring loader — auth/session/store resolution. Styled to be
 * indistinguishable from the index.html `#numu-splash` it takes over
 * from. Background follows the `.dark` class, which the blocking script
 * in index.html applies before first paint from the stored theme (or the
 * OS scheme), so the splash → React handoff never flashes.
 *
 * The reviewer's complaint was that this screen "gives no progress,
 * fallback, or error state" — a hung /auth/me meant an infinite ring.
 * After `slowAfterMs` it offers a Retry; with `error` it says so plainly.
 */
export function NumuRingScreen({ slowAfterMs = 8000, error = false, onRetry }: NumuRingScreenProps) {
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
      <RingLoader scheme="app" />
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

const ringStyles = `
  @keyframes nl-spin { to { transform: rotate(360deg) } }
  @keyframes nl-breathe { 0%,100% { transform: scale(1) } 50% { transform: scale(1.06) } }
  .nl-track-app { stroke: #ECEAE3 }
  .dark .nl-track-app { stroke: #25344A }
  .nl-track-sys { stroke: #ECEAE3 }
  @media (prefers-color-scheme: dark) { .nl-track-sys { stroke: #25344A } }
`;
