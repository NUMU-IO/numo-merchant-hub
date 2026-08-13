/**
 * Is the hub running as an installed app rather than a browser tab?
 *
 * Two detection paths, because the platforms disagree:
 *   • `display-mode: standalone` — the standard, honoured by Chromium and by
 *     Safari 17+.
 *   • `navigator.standalone` — Apple's non-standard legacy flag, still the
 *     only reliable signal on older iOS home-screen apps.
 *
 * Used to decide whether to offer installation (pointless when already
 * installed) and, in Phase 2, whether iOS can subscribe to push at all — iOS
 * only permits Web Push from a Home-Screen app, never from a Safari tab.
 */
import { useEffect, useState } from "react";

/** `window-controls-overlay` is desktop-installed with a custom title bar. */
const STANDALONE_QUERIES = [
  "(display-mode: standalone)",
  "(display-mode: window-controls-overlay)",
  "(display-mode: minimal-ui)",
];

function detect(): boolean {
  if (typeof window === "undefined") return false;
  const byQuery = STANDALONE_QUERIES.some((q) => window.matchMedia?.(q).matches);
  // iOS legacy flag — absent from TypeScript's Navigator type.
  const byApple = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return byQuery || byApple;
}

export function useDisplayMode() {
  // Computed synchronously on first render, not in an effect: a one-frame
  // "browser" flash would make the install CTA blink into view inside an
  // already-installed app.
  const [isStandalone, setIsStandalone] = useState(detect);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mqls = STANDALONE_QUERIES.map((q) => window.matchMedia(q));
    const onChange = () => setIsStandalone(detect());
    for (const m of mqls) m.addEventListener("change", onChange);
    return () => {
      for (const m of mqls) m.removeEventListener("change", onChange);
    };
  }, []);

  return { isStandalone, isBrowserTab: !isStandalone };
}
