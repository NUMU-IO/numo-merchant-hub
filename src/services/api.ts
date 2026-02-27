/**
 * Base API client for the NUMU merchant dashboard.
 * Authentication is handled via httpOnly cookies set by the backend.
 * On 401, redirects to login page.
 */

if (!import.meta.env.VITE_API_URL) {
  throw new Error(
    "VITE_API_URL is not set. Refusing to start without a configured API endpoint."
  );
}
const API_BASE = import.meta.env.VITE_API_URL;

export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const isFormData = options?.body instanceof FormData;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options?.headers as Record<string, string> || {}),
    },
  });

  if (res.status === 401) {
    window.location.href = "/login";
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
