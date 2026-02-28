/**
 * Base API client for the NUMU merchant dashboard.
 * Authentication is handled via httpOnly cookies set by the backend.
 * CSRF protection uses the double-submit cookie pattern:
 *   - Backend sets a non-httpOnly `csrf_token` cookie
 *   - Client reads it and sends the value in `X-CSRF-Token` header
 * On 401, redirects to login page.
 */

if (!import.meta.env.VITE_API_URL) {
  throw new Error(
    "VITE_API_URL is not set. Refusing to start without a configured API endpoint."
  );
}
const API_BASE = import.meta.env.VITE_API_URL;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

/** Read a cookie value by name. */
function getCookie(name: string): string | undefined {
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const method = (options?.method || "GET").toUpperCase();

  // Attach CSRF token header on state-changing requests
  const csrfHeaders: Record<string, string> = {};
  if (!SAFE_METHODS.has(method)) {
    const csrfToken = getCookie("csrf_token");
    if (csrfToken) {
      csrfHeaders["X-CSRF-Token"] = csrfToken;
    }
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...csrfHeaders,
      ...(options?.headers as Record<string, string> || {}),
    },
  });

  if (res.status === 401) {
    // Only redirect if not already on the login page to prevent infinite loops
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please log in again.");
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
