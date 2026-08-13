/**
 * Web Push subscription plumbing.
 *
 * Goes through `apiClient` so CSRF, the 401 refresh-and-retry, and the
 * `X-Tenant-Id` header all apply exactly as they do everywhere else.
 */
import { apiClient } from "./api";

const IMPERSONATION_TOKEN_KEY = "numu.impersonation_token";

export interface PushKeyResponse {
  public_key: string | null;
  enabled: boolean;
}

/**
 * True when an admin is driving this tab as a merchant.
 *
 * ─── THIS IS THE REAL IMPERSONATION GUARD ────────────────────────────────────
 * The BACKEND cannot detect impersonation: the handoff token is an ordinary
 * access token for the store owner with a longer TTL and no distinguishing
 * claim, so by the time a request lands it is indistinguishable from the
 * merchant's own session. Enforcement therefore has to live here, in the only
 * place that knows.
 *
 * Without it, an admin who opens a merchant's dashboard to debug something
 * would silently subscribe their OWN laptop to that store's order
 * notifications — and keep receiving them long after the session ended.
 */
export function isImpersonating(): boolean {
  try {
    return !!sessionStorage.getItem(IMPERSONATION_TOKEN_KEY);
  } catch {
    return false;
  }
}

export function getPushKey(): Promise<PushKeyResponse> {
  return apiClient<PushKeyResponse>("/auth/me/push-key");
}

export function registerPushSubscription(sub: PushSubscription, locale: string) {
  const json = sub.toJSON();
  return apiClient<{ registered: boolean }>("/auth/me/push-token", {
    method: "POST",
    // Field names match what numu-merchant-app already sends, so one endpoint
    // serves both clients (`endpoint` is the web alias for its `token`).
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      provider: "webpush",
      platform: "web",
      locale,
    }),
    headers: isImpersonating() ? { "X-Numu-Impersonating": "1" } : undefined,
  });
}

export function revokePushSubscription(endpoint?: string) {
  const query = endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : "";
  return apiClient<{ revoked: number }>(`/auth/me/push-token${query}`, {
    method: "DELETE",
  });
}

/** VAPID keys travel as base64url; PushManager wants a Uint8Array. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}
