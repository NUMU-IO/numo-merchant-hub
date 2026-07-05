/**
 * NUMU Ring Loader — the canonical loading indicator.
 *
 * React port of the inline `#numu-splash` in index.html (NHUB UI kit
 * Loader): N-mark tile breathing in place, encircled by a saffron arc
 * spinner on a warm cream track. Keep both in sync when tweaking.
 */

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

/**
 * Full-screen ring loader — auth/session/store resolution. Styled to be
 * indistinguishable from the index.html `#numu-splash` it takes over
 * from (white background always, track follows the OS color scheme).
 */
export function NumuRingScreen() {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "#FFFFFF" }}
    >
      <RingLoader scheme="system" />
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
