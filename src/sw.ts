/// <reference lib="webworker" />
/**
 * NUMU Merchant Hub — service worker.
 *
 * ─── THE ONE RULE ────────────────────────────────────────────────────────────
 * NOTHING under /api/ may EVER enter a cache. Two independent reasons, either
 * one sufficient:
 *
 *   1. CROSS-TENANT LEAK. The hub selects the active store with an
 *      `X-Tenant-Id` REQUEST HEADER (services/api.ts reads it from
 *      localStorage["numu-current-store"]). The Cache API keys entries by URL
 *      and IGNORES request headers. So a cached
 *      /api/v1/stores/{id}/orders response from store A could be replayed to
 *      store B after a store switch — a multi-tenant data breach in a platform
 *      whose whole backend is built on Postgres RLS to prevent exactly that.
 *
 *   2. AUTH LIFETIME. Cached authenticated responses outlive logout. Shared
 *      phones are common among Egyptian merchants and their staff.
 *
 * The NetworkOnly route below is registered FIRST so no later route can shadow
 * it. Do not add a cache rule that matches /api/, for any reason, ever —
 * including "just temporarily". Any PR touching this file must have its route
 * table reviewed.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Strategy: injectManifest. See vite.config.ts for the precache globs — Monaco
 * (~11.1 MB) and marketplace thumbnails are deliberately excluded and left to
 * the browser's own HTTP cache.
 */
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, setCatchHandler, NavigationRoute } from "workbox-routing";
import { NetworkOnly, CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

/**
 * Prefix for every RUNTIME cache this worker creates, so PURGE_CACHES can find
 * them on logout without touching caches owned by anything else.
 *
 * ⚠️ This deliberately does NOT cover the precache. Workbox names that
 * `workbox-precache-v2-<origin>` and the name is not ours to choose, so logout
 * leaves it in place. That is CORRECT, not an oversight:
 *
 *   • It holds shell assets only — JS, CSS, index.html, offline.html. No
 *     tenant data, no API responses, nothing authenticated. Verified in QA:
 *     0 entries containing "/api/".
 *   • Deleting it would break the offline page. `offline.html` LIVES in the
 *     precache, so purging it on logout means an offline merchant who signed
 *     out gets a blank browser error instead of our fallback.
 *
 * So: purge runtime caches on logout, keep the shell. Do not "fix" this by
 * renaming the precache or widening the purge.
 */
const CACHE_PREFIX = "numu-";
const OFFLINE_URL = "/offline.html";

// ─── 1. Precache the app shell ───────────────────────────────────────────────
precacheAndRoute(self.__WB_MANIFEST);

// ─── 2. /api/ — NetworkOnly. REGISTERED FIRST, ON PURPOSE. ───────────────────
// Workbox matches routes in registration order, so putting this first
// guarantees no later rule can accidentally cache an API response.
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/api/"),
  new NetworkOnly(),
);

// ─── 3. Navigations → the precached app shell ────────────────────────────────
// denylist keeps /api/ out of the SPA fallback: an API request that reached
// here would otherwise be answered with index.html instead of failing honestly.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//],
  }),
);

// ─── 4. Runtime caching ──────────────────────────────────────────────────────

// Hashed route chunks. Content-hashed filenames are immutable, so CacheFirst is
// safe and gives instant lazy-route loads on a repeat visit.
// NOTE: Monaco (`*.worker-*.js`, `ThemeCodeEditor-*.js`) is deliberately NOT
// matched here — no route means the SW does not intercept, and the browser HTTP
// cache handles it. That keeps 11.1 MB out of merchants' device storage.
registerRoute(
  ({ url, request, sameOrigin }) =>
    sameOrigin &&
    url.pathname.startsWith("/assets/") &&
    (request.destination === "script" || request.destination === "style") &&
    !/\.worker-|ThemeCodeEditor-/.test(url.pathname),
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}chunks`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 250, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
);

// Google Fonts stylesheet — may change, so revalidate in the background.
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({
    cacheName: `${CACHE_PREFIX}gfonts-css`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  }),
);

// Google Fonts files — immutable, cache hard for a year.
registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}gfonts`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  }),
);

// Own-origin images (brand art, illustrations, onboarding).
registerRoute(
  ({ url, request, sameOrigin }) =>
    sameOrigin &&
    request.destination === "image" &&
    !url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/marketplace-thumbs/"),
  new CacheFirst({
    cacheName: `${CACHE_PREFIX}img`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
);

// Product/theme imagery on the R2 CDN. Merchant-visible content that can change,
// so revalidate in the background rather than pinning it.
registerRoute(
  ({ url }) =>
    url.origin === "https://cdn.numueg.app" || /\.r2\.dev$/.test(url.hostname),
  new StaleWhileRevalidate({
    cacheName: `${CACHE_PREFIX}cdn-img`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  }),
);

// ─── 5. Offline fallback ─────────────────────────────────────────────────────
// Only navigations get the fallback page. A failed API call or image must fail
// honestly so the app's own error handling runs — answering an API request with
// an HTML page produces far more confusing bugs than a network error does.
setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate") {
    const cached = await caches.match(OFFLINE_URL, { ignoreSearch: true });
    if (cached) return cached;
  }
  return Response.error();
});

// ─── 6. Messages from the page ───────────────────────────────────────────────
self.addEventListener("message", (event) => {
  const type = (event.data as { type?: string } | undefined)?.type;

  // Sent by the update toast when the MERCHANT taps "Update now".
  // skipWaiting is called ONLY here — never at the top level and never in
  // `install`. Activating silently would purge the old precache out from under
  // a merchant mid-task and break their next lazy-loaded route.
  if (type === "SKIP_WAITING") {
    void self.skipWaiting();
    return;
  }

  // Sent by ErrorBoundary when a lazy chunk 404s. The precache still holds
  // an index.html pointing at asset hashes the server no longer serves, so
  // the tab reloads straight back into the same failure. Dropping the
  // precache lets Workbox's precache route fall through to the network on
  // the next load, which fetches the current shell.
  //
  // Scoped to the precache ON PURPOSE: unregistering the worker would fix it
  // too, but takes the push subscription down with it, and the runtime caches
  // PURGE_CACHES owns are not what went stale.
  if (type === "PURGE_PRECACHE") {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(
          names.filter((n) => n.includes("workbox-precache")).map((n) => caches.delete(n)),
        );
        event.ports?.[0]?.postMessage({ type: "PURGE_PRECACHE_DONE" });
      })(),
    );
    return;
  }

  // Sent by AuthContext on logout. SECURITY: a logged-out device must retain no
  // cached application state. Shared phones are common among merchant staff.
  if (type === "PURGE_CACHES") {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(
          names.filter((n) => n.startsWith(CACHE_PREFIX)).map((n) => caches.delete(n)),
        );
        // Acknowledge so the page can await the purge before redirecting.
        event.ports?.[0]?.postMessage({ type: "PURGE_CACHES_DONE" });
      })(),
    );
  }
});

// ─── 7. Push (Phase 2) ───────────────────────────────────────────────────────
// These handlers introduce NO cache rule. The /api/ NetworkOnly guarantee above
// is absolute and nothing here touches it.

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  locale?: string;
  dir?: "rtl" | "ltr" | "auto";
}

self.addEventListener("push", (event) => {
  // A malformed or empty payload must never throw: an uncaught error here kills
  // the whole worker, taking offline support and every future push with it.
  let data: PushPayload = {};
  try {
    data = (event.data?.json() as PushPayload) ?? {};
  } catch {
    data = {};
  }

  const title = data.title || "NUMU";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body ?? "",
      icon: "/pwa/icon-192.png",
      // Monochrome silhouette; Android renders it in the status bar.
      badge: "/pwa/badge-72.png",
      // Collapses duplicates at the OS level. This is what makes a Celery
      // retry safe — it replaces the notification instead of stacking a
      // second one on the merchant's lock screen.
      tag: data.tag,
      // Arabic bodies render left-to-right without this.
      dir: data.dir ?? "auto",
      lang: data.locale ?? "ar",
      data: { url: data.url || "/" },
      // `renotify` is in the Notifications spec and implemented by browsers,
      // but is missing from TypeScript's NotificationOptions. Without it a
      // replaced notification updates silently — the merchant's phone would
      // not buzz for the second order of the same tag.
      ...({ renotify: Boolean(data.tag) } as Record<string, unknown>),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data as { url?: string } | undefined)?.url || "/";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Focus an EXISTING hub window and navigate it, rather than opening a new
      // one every time. A merchant who taps five order notifications should end
      // up with one window on the fifth order, not five windows.
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope)) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              /* cross-origin or navigation blocked — the focus still helped */
            }
          }
          return;
        }
      }

      await self.clients.openWindow(target);
    })(),
  );
});
