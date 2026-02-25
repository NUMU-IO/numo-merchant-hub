/**
 * Base API client for the NUMU merchant dashboard.
 * Automatically refreshes expired tokens on 401.
 */

if (!import.meta.env.VITE_API_URL) {
  throw new Error(
    "VITE_API_URL is not set. Refusing to start without a configured API endpoint."
  );
}
const API_BASE = import.meta.env.VITE_API_URL;
const TOKEN_KEY = "numu-token";
const REFRESH_KEY = "numu-refresh-token";

// Shared refresh promise to prevent concurrent refresh attempts
let refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) throw new Error("No refresh token");

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    throw new Error("Token refresh failed");
  }

  const json = await res.json();
  const tokens = json.data;
  localStorage.setItem(TOKEN_KEY, tokens.access_token);
  if (tokens.refresh_token) {
    localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  }
  return tokens.access_token;
}

function buildHeaders(token: string | null, extra?: HeadersInit, isFormData?: boolean): HeadersInit {
  return {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra || {}),
  };
}

export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const isFormData = options?.body instanceof FormData;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: buildHeaders(token, options?.headers as Record<string, string>, isFormData),
  });

  // If 401 → try refresh once, then retry
  if (res.status === 401) {
    try {
      if (!refreshPromise) {
        refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
      }
      const newToken = await refreshPromise;

      const retry = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: buildHeaders(newToken, options?.headers as Record<string, string>, isFormData),
      });

      if (!retry.ok) {
        const body = await retry.json().catch(() => null);
        throw new Error(body?.detail || `API error: ${retry.status}`);
      }

      const json = await retry.json();
      return json.data;
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      window.location.href = "/login";
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `API error: ${res.status}`);
  }

  // 204 No Content (e.g. DELETE) — no body to parse
  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json();
  return json.data;
}
