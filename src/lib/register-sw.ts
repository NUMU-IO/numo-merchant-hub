/**
 * Service-worker registration + the "new version available" prompt.
 *
 * WHY A PROMPT AND NOT autoUpdate
 * The hub is code-split into ~343 chunks and lazy-loads every page. If a new
 * worker activated silently it would purge the old precache, and the merchant's
 * next route change would throw "Failed to fetch dynamically imported module" —
 * mid-order, mid-product-edit, with unsaved work on screen. Workbox's own
 * guidance says to avoid skipWaiting when lazily-loaded assets are versioned by
 * hash, which is exactly our case.
 *
 * So: the new worker installs and WAITS. The old one keeps serving the old
 * chunks, nothing breaks, and we offer the merchant a reload they choose to
 * take. `skipWaiting` is only ever sent from the toast action.
 *
 * Registration runs AFTER React mounts (see main.tsx) so the worker fetch never
 * competes with first paint.
 *
 * WHY THE PROMPT IS PWA-ONLY
 * The toast is an APP-update affordance: it asks the merchant to relaunch
 * something they installed. In a browser tab that framing is simply wrong —
 * nobody installed anything, and a tab already updates by being reloaded. It
 * was firing in desktop Chrome and interrupting merchants mid-task.
 *
 * So the worker still registers everywhere (it backs push notifications and
 * the offline shell) and still WAITS everywhere; we just do not nag outside
 * the installed app. A browser tab picks the new worker up when the app's
 * last tab closes, which is the normal web lifecycle.
 */
import { Workbox } from "workbox-window";
import { toast } from "sonner";
import i18n from "@/i18n";
import { isInstalledApp } from "@/hooks/useDisplayMode";

/** How often a foregrounded tab may ask the browser to check for a new worker. */
const UPDATE_CHECK_THROTTLE_MS = 60_000;

let reloading = false;

export function registerServiceWorker(): void {
  // Dev uses `npm run dev` with devOptions disabled — the worker is validated
  // against `npm run preview`. Registering in dev would serve stale modules
  // and make HMR behave bizarrely.
  if (!import.meta.env.PROD) return;
  if (import.meta.env.VITE_PWA_ENABLED === "false") return;
  if (!("serviceWorker" in navigator)) return;

  const wb = new Workbox("/sw.js", { scope: "/" });

  // Fired when a NEW worker has installed and is waiting because an old one is
  // still controlling this page. `isUpdate` distinguishes that from the very
  // first install, where there is nothing to prompt about.
  //
  // Checked at event time, not at registration: a merchant can install the
  // app while this tab is open, and the next update should then prompt.
  const onWaiting = () => {
    if (!isInstalledApp()) return;
    promptForUpdate(wb);
  };
  wb.addEventListener("waiting", onWaiting);

  // The old worker handed over. Reload once so the page runs the new assets.
  wb.addEventListener("controlling", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  void wb.register().then((registration) => {
    if (!registration) return;

    // A merchant can leave this tab open for a whole working day. Without a
    // nudge the browser may not check for a new worker for hours, so a deploy
    // would go unnoticed. Throttled so backgrounding/foregrounding repeatedly
    // does not hammer the network.
    let lastCheck = 0;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastCheck < UPDATE_CHECK_THROTTLE_MS) return;
      lastCheck = now;
      void registration.update().catch(() => {
        /* offline or the check failed — the next foreground will retry */
      });
    });
  });
}

/**
 * Delete every cache this app owns. Called on logout.
 *
 * SECURITY, not housekeeping. Shared phones are common among Egyptian
 * merchants and their staff, and cached shell assets plus any future
 * app-layer cache must not survive a sign-out. Pairs with the
 * `queryClient.clear()` that Phase 3 will add.
 *
 * Resolves (never rejects) and self-limits, so a wedged or absent worker can
 * never block or delay the merchant signing out.
 */
export function purgeServiceWorkerCaches(timeoutMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    const controller = navigator.serviceWorker?.controller;
    if (!controller) return resolve();

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    try {
      const channel = new MessageChannel();
      channel.port1.onmessage = done;
      controller.postMessage({ type: "PURGE_CACHES" }, [channel.port2]);
      // Belt and braces: proceed even if the worker never acknowledges.
      setTimeout(done, timeoutMs);
    } catch {
      done();
    }
  });
}

function promptForUpdate(wb: Workbox): void {
  // i18n is initialised at module load (src/i18n/index.ts), so `t` resolves
  // against the merchant's current language even though we are outside React.
  toast(i18n.t("pwa.updateTitle"), {
    description: i18n.t("pwa.updateBody"),
    // Persistent: the merchant may be mid-task. They dismiss or accept — we
    // never time this out and never reload on their behalf.
    duration: Infinity,
    dismissible: true,
    action: {
      label: i18n.t("pwa.updateAction"),
      onClick: () => {
        // Tell the waiting worker to take over. The "controlling" listener
        // above then reloads exactly once.
        wb.messageSkipWaiting();
      },
    },
  });
}
