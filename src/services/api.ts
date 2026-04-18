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
import { refreshSession } from "./authApi";
import { ApiError, apiErrorFromResponse, apiErrorFromNetwork } from "@/lib/api-error";

const API_BASE = import.meta.env.VITE_API_URL || "";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

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
let pendingRefresh: Promise<boolean> | null = null;

function attemptRefresh(): Promise<boolean> {
  if (pendingRefresh) return pendingRefresh;
  pendingRefresh = refreshSession().finally(() => {
    // Clear on settlement so a later 401 (next token expiry) can try again.
    pendingRefresh = null;
  });
  return pendingRefresh;
}

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
  try {
    const handoff = sessionStorage.getItem("numu.impersonation_token");
    if (handoff) {
      authHeaders["Authorization"] = `Bearer ${handoff}`;
    }
  } catch {
    /* sessionStorage unavailable — fall back to cookie auth */
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

  const refreshed = await attemptRefresh();
  if (!refreshed) return null;

  try {
    return await doFetch();
  } catch {
    return null;
  }
}

function redirectToLogin(): never {
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
  throw new ApiError(401, null);
}

export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit,
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
      await initCSRF();
      try {
        res = await rawFetch(endpoint, options);
      } catch (err) {
        throw apiErrorFromNetwork(err);
      }
    } else {
      throw new ApiError(403, body?.detail || null);
    }
  }

  if (res.status === 401) {
    const retried = await handle401(endpoint, options, () =>
      rawFetch(endpoint, options),
    );
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
