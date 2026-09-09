/**
 * CSRF token manager — double-submit against the cookie.
 *
 * The guard is: header must equal cookie. The cookie is deliberately not
 * httpOnly so JS can read it, and the cookie is what the server compares
 * against — so the cookie is the source of truth, and the in-memory copy is
 * only a fallback for when it cannot be read.
 *
 * It used to be the other way round: the token lived ONLY in a JS variable,
 * per tab, while `/auth/csrf-token` mints a NEW token and overwrites the
 * shared cookie on every call. So a second tab — or the admin app, or the
 * landing page, all on `.numueg.app` — rotated the cookie out from under the
 * first one, and the older tab kept sending a header the cookie no longer
 * matched:
 *
 *   CSRF validation failed for POST /agent/chat
 *   Cookie token: w-HRbDyMEB1Dv…  Header token: 5cMU8h8T2EK5e…
 *
 * The merchant saw "Something went wrong. Please try again", and retrying in
 * that tab could never work, because every retry re-sent the same stale
 * header. Reading the cookie at send time makes two tabs agree by
 * construction.
 *
 * Failures are not swallowed: `initCSRF` retries briefly (3 attempts,
 * 0.5 s → 2 s) and resolves to a boolean, so the 403-retry path in apiClient
 * can tell the merchant "reload" instead of surfacing an unexplained 403.
 */

const API_BASE = import.meta.env.VITE_API_URL || "";

const ATTEMPTS = 3;
const BACKOFF_MS = [500, 1000, 2000];

let csrfToken: string | null = null;
let pending: Promise<boolean> | null = null;

/** Read the `csrf_token` cookie, or null when it is absent/unreadable. */
function tokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Ensure a CSRF token exists.
 *
 * A cookie that is already there is kept rather than replaced: minting a new
 * one would rotate it for every other open tab, which is the bug this module
 * exists to avoid. A forced refresh (after a real 403) passes `force`.
 */
export function initCSRF(force = false): Promise<boolean> {
  if (!force) {
    const existing = tokenFromCookie();
    if (existing) {
      csrfToken = existing;
      return Promise.resolve(true);
    }
  }
  if (pending) return pending;
  pending = doInitCSRF().finally(() => {
    pending = null;
  });
  return pending;
}

async function doInitCSRF(): Promise<boolean> {
  let lastError: unknown = null;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      const res = await fetch(`${API_BASE}/auth/csrf-token`, {
        credentials: "include",
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        const json = await res.json();
        const token = json.data?.csrf_token ?? null;
        if (token) {
          csrfToken = token;
          return true;
        }
        lastError = new Error("csrf-token response had no token");
      } else if (res.status === 401 || res.status === 403) {
        // No session → no token; retrying won't change that.
        return false;
      } else {
        lastError = new Error(`csrf-token ${res.status}`);
      }
    } catch (err) {
      lastError = err;
    }
    if (i < ATTEMPTS - 1) await new Promise((r) => setTimeout(r, BACKOFF_MS[i]));
  }
  console.warn("[csrf] could not obtain a CSRF token", lastError);
  return false;
}

/**
 * The token to send in `X-CSRF-Token`.
 *
 * Read from the cookie at send time, because the cookie is what the server
 * compares against and any tab may have rotated it since this one booted.
 * The in-memory copy is the fallback for a browser that will not hand the
 * cookie back to script.
 */
export function getCSRFToken(): string | null {
  return tokenFromCookie() ?? csrfToken;
}

/** Clear the in-memory token (e.g. on logout). */
export function clearCSRFToken(): void {
  csrfToken = null;
}
