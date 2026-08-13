/**
 * Push subscription lifecycle for the merchant hub.
 *
 * Three rules encoded here, each with a reason:
 *
 *  1. NEVER prompt on load. `Notification.requestPermission()` is a one-shot
 *     with no undo: a browser-level "Block" is close to permanent, so the
 *     caller must show its own dialog first and only reach `subscribe()` once
 *     the merchant has said yes to that.
 *  2. Must be called from a USER GESTURE. iOS enforces this; Chrome is moving
 *     the same way.
 *  3. iOS can only subscribe in STANDALONE mode. Web Push on iOS requires the
 *     app to be on the Home Screen — from a Safari tab the call fails, so we
 *     report "unsupported" rather than offering a toggle that cannot work.
 */
import { useCallback, useEffect, useState } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import {
  getPushKey,
  isImpersonating,
  registerPushSubscription,
  revokePushSubscription,
  urlBase64ToUint8Array,
} from "@/services/pushApi";
import { useDisplayMode } from "./useDisplayMode";

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

function isIos(): boolean {
  const s = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(s) ||
    (/Macintosh/.test(s) && navigator.maxTouchPoints > 1)
  );
}

export function usePushNotifications() {
  const { language } = useLanguage();
  const { isStandalone } = useDisplayMode();
  const [permission, setPermission] = useState<PushPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const apiSupported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  // iOS only permits Web Push from a Home-Screen app. Offering the toggle in a
  // Safari tab would produce a failure the merchant can't act on.
  const supported = apiSupported && (!isIos() || isStandalone);

  useEffect(() => {
    if (!apiSupported) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PushPermission);

    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => setSubscribed(false));
  }, [apiSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;

    // See pushApi.isImpersonating — the backend cannot tell, so this is the
    // only place the check can happen.
    if (isImpersonating()) return false;

    setBusy(true);
    try {
      const key = await getPushKey();
      if (!key.enabled || !key.public_key) return false;

      // MUST be inside the user-gesture call stack (iOS requirement).
      const result = await Notification.requestPermission();
      setPermission(result as PushPermission);
      if (result !== "granted") return false;

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          // Chrome refuses a subscription without this; a silent push would be
          // invisible to the merchant anyway.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key.public_key),
        }));

      await registerPushSubscription(sub, language);
      setSubscribed(true);
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported, language]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      // Revoke server-side FIRST: if the browser unsubscribe succeeds but the
      // API call doesn't, the row lingers and the backend keeps pushing to a
      // dead endpoint until it 410s.
      await revokePushSubscription(sub?.endpoint);
      await sub?.unsubscribe();
      setSubscribed(false);
    } catch {
      /* best-effort — logout also revokes server-side */
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    supported,
    permission,
    subscribed,
    busy,
    subscribe,
    unsubscribe,
    /** True when the merchant blocked it in the browser — needs settings, not a retry. */
    blocked: permission === "denied",
    /** iOS in a Safari tab: installing is the prerequisite, not a permission. */
    needsInstallFirst: apiSupported && isIos() && !isStandalone,
  };
}
