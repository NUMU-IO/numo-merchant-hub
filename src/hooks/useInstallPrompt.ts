/**
 * Install affordance state.
 *
 * Three mutually exclusive outcomes, because the platforms differ so much:
 *
 *   "native"  — Chromium fired `beforeinstallprompt`; we can show a real
 *               one-tap install button.
 *   "ios"     — iOS Safari, which has NO install event. The merchant must be
 *               TAUGHT the Share → Add to Home Screen gesture.
 *   "webview" — an in-app browser (WhatsApp, Instagram, Facebook). Add to Home
 *               Screen is missing or degraded here. This matters more for NUMU
 *               than for most apps: merchants receive the hub link over
 *               WHATSAPP, so without this branch a large share of iOS merchants
 *               would tap "install", find nothing, and give up.
 *   null      — nothing to offer (already installed, or an unsupported browser).
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  getDeferredPrompt,
  showInstallPrompt,
  subscribeInstallPrompt,
  wasInstalled,
} from "@/lib/install-prompt";
import { useDisplayMode } from "./useDisplayMode";

const DISMISS_KEY = "numu.install-prompt-dismissed";

export type InstallAffordance = "native" | "ios" | "webview" | null;

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

const ua = () => (typeof navigator === "undefined" ? "" : navigator.userAgent);

function isIos(): boolean {
  const s = ua();
  // iPadOS 13+ reports as Macintosh; the touch-point check disambiguates.
  return (
    /iPad|iPhone|iPod/.test(s) ||
    (/Macintosh/.test(s) && typeof document !== "undefined" && navigator.maxTouchPoints > 1)
  );
}

/**
 * In-app browser detection.
 *
 * Deliberately conservative and FAIL-OPEN: user-agent sniffing is inherently
 * unreliable, and wrongly showing "open in Safari" to someone already in Safari
 * is a worse failure than missing a WebView. Only explicit, well-known tokens
 * count — we do NOT use the common "Mobile but no Safari token" heuristic,
 * which false-positives on several legitimate browsers.
 */
function isInAppWebView(): boolean {
  const s = ua();
  return (
    /FBAN|FBAV/.test(s) || // Facebook
    /Instagram/.test(s) ||
    /WhatsApp/i.test(s) ||
    /Line\//.test(s) ||
    /Snapchat/i.test(s) ||
    /TikTok|BytedanceWebview/i.test(s)
  );
}

export function useInstallPrompt() {
  const { isStandalone } = useDisplayMode();
  const [dismissed, setDismissed] = useState(readDismissed);

  // Bridge the module-level capture (which starts before React mounts) into
  // React. useSyncExternalStore keeps every consumer in step without polling.
  const deferred = useSyncExternalStore(
    subscribeInstallPrompt,
    getDeferredPrompt,
    () => null,
  );
  const installed = useSyncExternalStore(subscribeInstallPrompt, wasInstalled, () => false);

  const [platform] = useState(() => ({ ios: isIos(), webview: isInAppWebView() }));

  let affordance: InstallAffordance = null;
  if (!isStandalone && !installed && !dismissed) {
    if (platform.webview) affordance = "webview";
    else if (deferred) affordance = "native";
    else if (platform.ios) affordance = "ios";
  }

  const install = useCallback(async () => {
    const outcome = await showInstallPrompt();
    // A dismissal is NOT persisted: Chrome re-fires the event on a later visit,
    // and a merchant who said "not now" should be asked again then. Only an
    // explicit dismissal of OUR card is remembered (see `dismiss`).
    return outcome;
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode — the card simply reappears next session */
    }
    setDismissed(true);
  }, []);

  // Another tab dismissing should hide it here too.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DISMISS_KEY) setDismissed(readDismissed());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { affordance, install, dismiss, isStandalone, isInstalled: installed };
}
