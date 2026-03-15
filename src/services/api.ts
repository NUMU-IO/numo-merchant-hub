/**
 * Base API client for the NUMU merchant dashboard.
 * Authentication is handled via httpOnly cookies set by the backend.
 * CSRF protection: token is stored in memory and sent as X-CSRF-Token
 * on every state-changing request (POST, PUT, PATCH, DELETE).
 * On 401, redirects to login page.
 * On 403 with CSRF failure, refreshes the token and retries once.
 */

import { getCSRFToken, initCSRF } from "./csrf";

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

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...csrfHeaders,
      ...(options?.headers as Record<string, string> || {}),
    },
  });
}

export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  let res = await rawFetch(endpoint, options);

  // Handle CSRF token expiry: refresh token and retry once
  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    if (body?.detail === "CSRF validation failed") {
      await initCSRF();
      res = await rawFetch(endpoint, options);
    } else {
      throw new Error(body?.detail || `API error: ${res.status}`);
    }
  }

  if (res.status === 401) {
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `API error: ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json();
  return json.data;
}
