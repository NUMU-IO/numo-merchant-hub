/**
 * CSRF token manager — fetches and stores the token in memory.
 *
 * The token is fetched from the backend's /auth/csrf-token endpoint,
 * stored only in a JS variable (never localStorage or cookies), and
 * attached to every state-changing request via the X-CSRF-Token header.
 */

if (!import.meta.env.VITE_API_URL) {
  throw new Error(
    "VITE_API_URL is not set. CSRF module cannot initialise without an API endpoint."
  );
}
const API_BASE = import.meta.env.VITE_API_URL;

let csrfToken: string | null = null;
let pending: Promise<void> | null = null;

/** Fetch a fresh CSRF token from the backend and store it in memory. */
export async function initCSRF(): Promise<void> {
  if (pending) return pending;
  pending = doInitCSRF().finally(() => { pending = null; });
  return pending;
}

async function doInitCSRF(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/auth/csrf-token`, {
      credentials: "include",
    });
    if (res.ok) {
      const json = await res.json();
      csrfToken = json.data?.csrf_token ?? null;
    }
  } catch {
    // Non-critical — token may already be in memory from a prior call
  }
}

/** Return the current in-memory CSRF token. */
export function getCSRFToken(): string | null {
  return csrfToken;
}

/** Clear the in-memory token (e.g. on logout). */
export function clearCSRFToken(): void {
  csrfToken = null;
}
