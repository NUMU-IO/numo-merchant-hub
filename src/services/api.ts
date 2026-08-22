/**
 * Base API client for the NUMU merchant dashboard.
 *
 * Authentication is handled via httpOnly cookies set by the backend.
 *
 * - CSRF: token is stored in memory and attached as X-CSRF-Token on
 *   state-changing requests. On 403 "CSRF validation failed", we
 *   refetch the token and retry once.
 *
 * - 401: access token likely expired. We try to silently refresh via
 *   POST /auth/refresh (which reads the refresh-token cookie); if that
 *   succeeds, the new access-token cookie is set by the backend and we
 *   retry the original request once. If refresh fails, THEN we bounce
 *   to /login. Concurrent 401s across many feature services are
 *   deduplicated onto a single in-flight refresh promise.
 */

import { getCSRFToken, initCSRF } from "./csrf";
import { refreshSession, type RefreshOutcome } from "./authApi";
import { ApiError, apiErrorFromResponse, apiErrorFromNetwork } from "@/lib/api-error";

const API_BASE = import.meta.env.VITE_API_URL || "";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

// Admin "log in as merchant" handoff token (tab-scoped). Mirrors the keys in
// ImpersonationBanner; kept as literals here so this low-level service doesn't
// import a layout component.
const IMPERSONATION_TOKEN_KEY = "numu.impersonation_token";
const IMPERSONATION_BY_KEY = "numu.impersonating_by";

function getImpersonationToken(): string | null {
  try {
    return sessionStorage.getItem(IMPERSONATION_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * End an impersonation session that the server has rejected (401). The handoff
 * Bearer lives only in sessionStorage and is NOT refreshable — trying to
 * refresh the cookie renews a different session and the retry re-sends the same
 * dead Bearer, which storms /auth/refresh and surfaces as "invalid link" +
 * bogus create-store redirects. So we clear it and bounce to /login once.
 */
function endImpersonation(): never {
  try {
    sessionStorage.removeItem(IMPERSONATION_TOKEN_KEY);
    sessionStorage.removeItem(IMPERSONATION_BY_KEY);
  } catch {
    /* sessionStorage unavailable */
  }
  if (window.location.pathname !== "/login") {
    window.location.href = "/login?impersonation_expired=1";
  }
  throw new ApiError(401, "Impersonation session expired");
}

// Endpoints whose 401s must NOT trigger a refresh attempt. Refreshing on a
// login/register 401 would be pointless (there's no session yet) and could
// mask legitimate "wrong password" errors.
const NO_REFRESH_PREFIXES = [
  "/auth/refresh",  // infinite-loop guard
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/google-login",
  "/auth/complete-2fa-login",
  "/auth/logout",
];

function shouldAttemptRefresh(endpoint: string): boolean {
  return !NO_REFRESH_PREFIXES.some((p) => endpoint.startsWith(p));
}

// ────────────────────────────────────────────────────────────────────────────
// Refresh dedup: many feature services may fire requests in parallel and
// all get 401 at the same moment. We share a single in-flight refresh
// promise so they don't stampede /auth/refresh (which is rate-limited to
// 5 req/min on the backend).
// ────────────────────────────────────────────────────────────────────────────
let pendingRefresh: Promise<RefreshOutcome> | null = null;

function attemptRefresh(): Promise<RefreshOutcome> {
  if (pendingRefresh) return pendingRefresh;
  pendingRefresh = refreshSession().finally(() => {
    // Clear on settlement so a later 401 (next token expiry) can try again.
    pendingRefresh = null;
  });
  return pendingRefresh;
}

/** Thrown when a 401 could not be resolved but the session is NOT over. */
export class TransientAuthError extends ApiError {
  constructor() {
    super(503, "Couldn't refresh the session right now — try again in a moment.");
    this.name = "TransientAuthError";
  }
}

// 429 handling: honour Retry-After for idempotent requests (one retry, short
// waits only). Everything else surfaces the 429 to the caller — and the
// QueryClient is configured NOT to retry 4xx, so a rate limit never snowballs.
const MAX_429_WAIT_MS = 5_000;

function retryAfterMs(res: Response): number | null {
  const raw = res.headers.get("Retry-After");
  if (!raw) return null;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(raw);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function rawFetch(
  endpoint: string,
  options?: RequestInit,
): Promise<Response> {
  const isFormData = options?.body instanceof FormData;
  const method = (options?.method || "GET").toUpperCase();

  const csrfHeaders: Record<string, string> = {};
  if (!SAFE_METHODS.has(method)) {
    const token = getCSRFToken();
    if (token) {
      csrfHeaders["X-CSRF-Token"] = token;
    }
  }

  const tenantHeaders: Record<string, string> = {};
  const currentStoreId = localStorage.getItem("numu-current-store");
  if (currentStoreId) {
    tenantHeaders["X-Tenant-Id"] = currentStoreId;
  }

  // If an admin handed off an impersonation token into sessionStorage,
  // send it as Bearer. sessionStorage is scoped per tab, so parallel
  // impersonation tabs in the same browser each act as their own merchant
  // without cookie collisions on `.numueg.app`.
  const authHeaders: Record<string, string> = {};
  const handoff = getImpersonationToken();
  if (handoff) {
    authHeaders["Authorization"] = `Bearer ${handoff}`;
  }

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...csrfHeaders,
      ...tenantHeaders,
      ...authHeaders,
      ...(options?.headers as Record<string, string> || {}),
    },
  });
}

/**
 * Handle a 401 by silently refreshing (if applicable) and retrying once.
 * Returns the new Response after retry, or null if we should bounce to
 * /login. The caller decides what to do with null.
 */
async function handle401(
  endpoint: string,
  options: RequestInit | undefined,
  doFetch: () => Promise<Response>,
): Promise<Response | null> {
  if (!shouldAttemptRefresh(endpoint)) return null;

  const outcome = await attemptRefresh();
  if (outcome === "expired") return null;
  if (outcome === "transient") throw new TransientAuthError();

  try {
    return await doFetch();
  } catch (err) {
    // The retry itself failed at the network level — that is NOT a dead
    // session. Surface it instead of bouncing to /login.
    throw apiErrorFromNetwork(err);
  }
}

function redirectToLogin(): never {
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
  throw new ApiError(401, null);
}

/**
 * Per-call options layered ON TOP of the standard RequestInit. Use this
 * for behavior toggles that don't belong on the fetch options.
 *
 * `noAutoRedirect401`: caller will handle session expiry itself instead
 * of letting the client window.location-redirect to /login. The V3 theme
 * editor uses this so a mid-customization session loss surfaces as an
 * inline "re-login" banner — bouncing wipes the unsaved draft and
 * undo history that's only in memory until the next autosave tick.
 */
export interface ApiClientOptions {
  noAutoRedirect401?: boolean;
  /** Invoked with the raw successful Response before its body is parsed.
   *  Lets callers read response headers (e.g. `ETag` for optimistic
   *  concurrency) that the unwrapped `{data}` return value can't carry. */
  onResponse?: (res: Response) => void;
}

export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit,
  apiOpts?: ApiClientOptions,
): Promise<T> {
  let res: Response;
  try {
    res = await rawFetch(endpoint, options);
  } catch (err) {
    throw apiErrorFromNetwork(err);
  }

  // Handle CSRF token expiry: refresh token and retry once
  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    if (body?.detail === "CSRF validation failed") {
      const refreshed = await initCSRF();
      if (!refreshed) {
        throw new ApiError(
          403,
          "Couldn't refresh the security token — reload the page and try again.",
        );
      }
      try {
        res = await rawFetch(endpoint, options);
      } catch (err) {
        throw apiErrorFromNetwork(err);
      }
      if (res.status === 403) {
        // A second CSRF failure after a fresh token means the cookie and
        // the header disagree (stale domain cookie) — reload fixes it.
        throw new ApiError(
          403,
          "Security check failed twice — reload the page and try again.",
        );
      }
    } else {
      throw new ApiError(403, body?.detail || null);
    }
  }

  if (res.status === 401) {
    // Impersonation Bearer can't be refreshed — a 401 means it expired. End it
    // cleanly rather than storming /auth/refresh with a dead token.
    if (getImpersonationToken()) {
      endImpersonation();
    }
    const retried = await handle401(endpoint, options, () =>
      rawFetch(endpoint, options),
    );
    if (retried === null) {
      if (apiOpts?.noAutoRedirect401) {
        throw new ApiError(401, "Session expired");
      }
      redirectToLogin();
    }
    res = retried;
  }

  // 429 (rate limited) and 503 (edge nginx answers DEPLOYING with
  // Retry-After while the API container restarts) are both "ask again in a
  // moment" for idempotent requests.
  if (
    (res.status === 429 || res.status === 503) &&
    SAFE_METHODS.has((options?.method || "GET").toUpperCase())
  ) {
    const wait = retryAfterMs(res);
    if (wait !== null && wait <= MAX_429_WAIT_MS) {
      await sleep(wait || 500);
      try {
        res = await rawFetch(endpoint, options);
      } catch (err) {
        throw apiErrorFromNetwork(err);
      }
    }
  }

  if (!res.ok) {
    throw await apiErrorFromResponse(res);
  }

  // Expose the successful response (headers/status) to callers that opted
  // in, before we consume the body. Used by the theme editor to capture the
  // draft `ETag` for optimistic-concurrency autosave.
  apiOpts?.onResponse?.(res);

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json();
  // Responses are usually wrapped as {success, data, message}, but newer
  // endpoints may return the payload directly — fall back to the raw body.
  return json && Object.prototype.hasOwnProperty.call(json, "data")
    ? json.data
    : json;
}

export async function apiClientFormData<T>(
  endpoint: string,
  formData: FormData,
): Promise<T> {
  const doFetch = () => rawFetch(endpoint, { method: "POST", body: formData });

  let res: Response;
  try {
    res = await doFetch();
  } catch (err) {
    throw apiErrorFromNetwork(err);
  }

  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    if (body?.detail === "CSRF validation failed") {
      await initCSRF();
      try {
        res = await doFetch();
      } catch (err) {
        throw apiErrorFromNetwork(err);
      }
    } else {
      throw new ApiError(403, body?.detail || null);
    }
  }

  if (res.status === 401) {
    if (getImpersonationToken()) {
      endImpersonation();
    }
    const retried = await handle401(endpoint, undefined, doFetch);
    if (retried === null) {
      redirectToLogin();
    }
    res = retried;
  }

  if (!res.ok) {
    throw await apiErrorFromResponse(res);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json();
  return json.data;
}
