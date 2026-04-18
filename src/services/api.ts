/**
 * Base API client for the NUMU merchant dashboard.
 * Authentication is handled via httpOnly cookies set by the backend.
 * CSRF protection: token is stored in memory and sent as X-CSRF-Token
 * on every state-changing request (POST, PUT, PATCH, DELETE).
 * On 401, redirects to login page.
 * On 403 with CSRF failure, refreshes the token and retries once.
 */

import { getCSRFToken, initCSRF } from "./csrf";
import { ApiError, apiErrorFromResponse, apiErrorFromNetwork } from "@/lib/api-error";

const API_BASE = import.meta.env.VITE_API_URL || "";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

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

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...csrfHeaders,
      ...tenantHeaders,
      ...(options?.headers as Record<string, string> || {}),
    },
  });
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
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new ApiError(401, null);
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
  let res: Response;
  try {
    res = await rawFetch(endpoint, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    throw apiErrorFromNetwork(err);
  }

  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    if (body?.detail === "CSRF validation failed") {
      await initCSRF();
      try {
        res = await rawFetch(endpoint, {
          method: "POST",
          body: formData,
        });
      } catch (err) {
        throw apiErrorFromNetwork(err);
      }
    } else {
      throw new ApiError(403, body?.detail || null);
    }
  }

  if (res.status === 401) {
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new ApiError(401, null);
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
