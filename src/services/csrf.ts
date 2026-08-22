/**
 * CSRF token manager — fetches and stores the token in memory.
 *
 * The token is fetched from the backend's /auth/csrf-token endpoint,
 * stored only in a JS variable (never localStorage or cookies), and
 * attached to every state-changing request via the X-CSRF-Token header.
 *
 * Failures are no longer swallowed silently: `initCSRF` retries briefly
 * (3 attempts, 0.5 s → 2 s) and resolves to a boolean, so the 403-retry
 * path in apiClient can tell the merchant "reload" instead of surfacing an
 * unexplained 403 on every save.
 */

const API_BASE = import.meta.env.VITE_API_URL || "";

const ATTEMPTS = 3;
const BACKOFF_MS = [500, 1000, 2000];

let csrfToken: string | null = null;
let pending: Promise<boolean> | null = null;

/** Fetch a fresh CSRF token from the backend and store it in memory. */
export function initCSRF(): Promise<boolean> {
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

/** Return the current in-memory CSRF token. */
export function getCSRFToken(): string | null {
  return csrfToken;
}

/** Clear the in-memory token (e.g. on logout). */
export function clearCSRFToken(): void {
  csrfToken = null;
}
