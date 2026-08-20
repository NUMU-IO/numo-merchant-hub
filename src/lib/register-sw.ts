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

/**
 * The live Workbox handle, so recovery can reach the waiting worker from
 * outside `registerServiceWorker()`. Null in dev and when the PWA is off,
 * where there is no worker to blame for a stale chunk anyway.
 */
let workbox: Workbox | null = null;

export function registerServiceWorker(): void {
  // Dev uses `npm run dev` with devOptions disabled — the worker is validated
  // against `npm run preview`. Registering in dev would serve stale modules
  // and make HMR behave bizarrely.
  if (!import.meta.env.PROD) return;
  if (import.meta.env.VITE_PWA_ENABLED === "false") return;
  if (!("serviceWorker" in navigator)) return;

  const wb = new Workbox("/sw.js", { scope: "/" });
  workbox = wb;

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

/**
 * Drop the Workbox precache, so the next load fetches the shell fresh.
 *
 * Separate from `purgeServiceWorkerCaches` because that one deliberately
 * spares the precache (it is a logout/security routine, and the precache
 * holds no tenant data). Here the precache is precisely what is wrong.
 *
 * Resolves either way and self-limits — recovery must never hang.
 */
function purgePrecache(timeoutMs = 1500): Promise<void> {
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
      controller.postMessage({ type: "PURGE_PRECACHE" }, [channel.port2]);
      setTimeout(done, timeoutMs);
    } catch {
      done();
    }
  });
}

/**
 * Recover a tab whose precached shell points at chunks that no longer exist.
 *
 * Called by the ErrorBoundary on a stale-chunk error — NOT on a schedule and
 * NOT as a prompt. By the time we get here the app has already failed to
 * render a route, so the usual reason for waiting politely (don't blow away
 * a merchant's half-finished form) no longer applies: there is nothing left
 * on screen to lose.
 *
 * Two paths:
 *   • A worker is WAITING — the new shell is already downloaded. Tell it to
 *     take over; the "controlling" listener above then reloads exactly once.
 *   • No worker waiting — the shell is stale with no replacement staged, so
 *     drop the caches and reload to fetch fresh from the network.
 *
 * Always resolves, and always ends in a reload: a recovery path that can
 * hang is worse than one that occasionally reloads for nothing.
 */
export async function recoverFromStaleAssets(): Promise<void> {
  const reload = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };

  const takeOver = (registration: ServiceWorkerRegistration) => {
    // Let the "controlling" listener do the reload so we don't race it.
    if (workbox) workbox.messageSkipWaiting();
    else registration.waiting?.postMessage({ type: "SKIP_WAITING" });
    // Belt and braces: if the handover never lands, reload anyway.
    setTimeout(reload, 3_000);
  };

  try {
    let registration = await navigator.serviceWorker?.getRegistration();
    if (!registration) return reload();

    if (registration.waiting) return takeOver(registration);

    // Nothing staged yet — the tab may not have checked since the deploy.
    // Ask once; a new worker usually installs in well under a second.
    try {
      await registration.update();
    } catch {
      /* offline or blocked — fall through to the precache purge */
    }
    registration = (await navigator.serviceWorker.getRegistration()) ?? registration;
    if (registration.waiting) return takeOver(registration);

    // Still nothing to hand over to, so the precache itself is the problem.
    await purgePrecache();
  } catch {
    /* no worker, or a wedged one — the reload below is still the best move */
  }
  reload();
}
