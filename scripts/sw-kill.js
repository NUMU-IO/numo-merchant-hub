/**
 * ── SERVICE-WORKER KILL SWITCH — NOT DEPLOYED ────────────────────────────────
 *
 * This file is committed but never shipped. It exists so that a bad service
 * worker can be removed from every merchant's device without waiting for a fix.
 *
 * WHY IT IS NEEDED
 * A service worker is persistent. Once installed it keeps controlling the app
 * across reloads, so "just deploy a fix" is not always enough — if the broken
 * worker fails to fetch the new one, or serves a wedged precache, merchants can
 * be stuck on a broken build with no way out. `VITE_PWA_ENABLED=false` only
 * stops NEW registrations; it does nothing for already-installed workers.
 *
 * ── INCIDENT PROCEDURE ──────────────────────────────────────────────────────
 * 1. Copy this file over the built worker so it is served at the SAME path the
 *    real one uses (the scope and filename must match, or browsers will not
 *    treat it as an update):
 *
 *        cp scripts/sw-kill.js dist/sw.js
 *
 *    In a real incident that means either deploying a build with this content
 *    at /sw.js, or replacing the file on the host.
 *
 * 2. Deploy. Browsers re-check /sw.js on navigation (it is served
 *    `max-age=0, must-revalidate`, see vercel.json), find different bytes,
 *    and install this worker.
 *
 * 3. On activation it deletes every cache, unregisters itself, and reloads all
 *    open tabs. Merchants land on the plain, worker-free app.
 *
 * 4. Leave it deployed until the root cause is fixed. Then ship the real worker
 *    again — clients will pick it up on their next navigation.
 *
 * NOTE: this deliberately DOES call skipWaiting() at install. The usual reason
 * not to (dropping the old precache mid-session) is exactly what we want here.
 * ─────────────────────────────────────────────────────────────────────────────
 */
self.addEventListener("install", () => {
  // Take over immediately — this is an incident, not a normal update.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 1. Drop every cache on this origin, not just ours. In an incident we
      //    care about getting merchants to a clean state, not about tidiness.
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));

      // 2. Stop controlling any client.
      await self.registration.unregister();

      // 3. Reload open tabs so they run without a worker. Without this the
      //    merchant sits on the broken page until they manually refresh.
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        try {
          client.navigate(client.url);
        } catch {
          /* client may be closing — ignore */
        }
      }
    })(),
  );
});

// Never serve anything from cache while the kill switch is active.
self.addEventListener("fetch", () => {
  /* no-op: fall through to the network */
});
