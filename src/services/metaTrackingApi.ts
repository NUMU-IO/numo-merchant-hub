/**
 * Meta Pixel + Conversions API tracking settings.
 *
 * Built against the contract in plan §13.2. Backend endpoints live under
 *   /stores/{id}/settings/tracking[/meta...]
 *
 * Two booleans (`pixel_enabled`, `capi_enabled`) are persisted; the
 * server derives the `mode` field for display. The CAPI access token is
 * write-only — the server never returns the plaintext, only a masked
 * version like `EAAB••••••XK7`.
 */

import { apiClient } from "./api";

// ─── Types (mirror plan §13.2 PUT response shape) ──────────────────────────

/** Resolved activation mode — derived server-side from the two booleans. */
export type MetaTrackingMode = "off" | "pixel_only" | "capi_only" | "both";

/** Live status badge from `/status` endpoint. See plan §7.5. */
export type MetaTrackingStatus =
  | "connected"
  | "configured_no_events"
  | "failing"
  | "disabled";

export interface MetaTrackingSettings {
  pixel_id: string | null;
  pixel_enabled: boolean;
  capi_enabled: boolean;
  /** Derived from `pixel_enabled` + `capi_enabled` + token presence. */
  mode: MetaTrackingMode;
  /** Masked view of the saved token, e.g. `EAAB••••••XK7`. Null if no token on file. */
  capi_access_token_masked: string | null;
  /** Storefront emits this as a `<meta>` tag automatically — see plan §8.1. */
  domain_verification_token: string | null;
  /** Optional debug-only event code, e.g. `TEST12345`. */
  test_event_code: string | null;
  /** When true, gate the browser Pixel on consent banner acceptance. */
  consent_required: boolean;
  /**
   * Whether debug mode is *currently* active. The server returns true while
   * `debug_mode_expires_at` is in the future and flips to false once it
   * passes. Setting this to true on PUT extends the window by 60 minutes.
   */
  debug_mode: boolean;
  /** ISO-8601 — when the current debug-mode window expires. Null when off. */
  debug_mode_expires_at: string | null;
  /** Last successful CAPI event timestamp (ISO-8601). */
  last_validated_at: string | null;
  status: MetaTrackingStatus;
}

/**
 * Wrapper for the GET /tracking endpoint — currently only Meta is shipped,
 * but the response is namespaced so future Google Ads / TikTok tabs can land
 * here without an envelope rev-bump.
 */
export interface TrackingSettings {
  meta: MetaTrackingSettings;
}

export interface SaveMetaTrackingPayload {
  pixel_id: string;
  pixel_enabled: boolean;
  capi_enabled: boolean;
  /**
   * Optional. Only sent when (re)setting the token. The backend keeps the
   * existing token if this is omitted — letting the merchant flip booleans
   * without re-pasting the token every time.
   */
  capi_access_token?: string;
  test_event_code?: string | null;
  consent_required: boolean;
  /**
   * When true, the backend persists `debug_mode_expires_at = now + 60min`
   * and the Celery task auto-attaches `test_event_code` to every CAPI
   * event until expiry. When false, clears the expiry. Frontend just
   * toggles a bool — the 60-min math lives server-side.
   */
  debug_mode: boolean;
}

/** Channel a CAPI event was emitted on, for the recent-events table. */
export type MetaEventChannel = "browser" | "server" | "both";

export interface MetaEventLogEntry {
  id: string;
  event_id: string;
  event_name: string;
  channel: MetaEventChannel;
  /** HTTP status from Meta. Null while in-flight or when only Pixel fired. */
  response_status: number | null;
  fbtrace_id: string | null;
  attempt_count: number;
  last_error: string | null;
  /** ISO-8601 — when the event was queued (`created_at` in the log table). */
  created_at: string;
  /** ISO-8601 — when CAPI delivery completed; null until first attempt. */
  sent_at: string | null;
  /** Server-side redacted payload for click-to-expand drilldown. PII never leaves the backend in raw form. */
  redacted_payload: Record<string, unknown> | null;
}

export interface SendTestEventResponse {
  received: boolean;
  fbtrace_id?: string;
  error?: string;
}

export interface MetaTrackingStatusResponse {
  mode: MetaTrackingMode;
  status: MetaTrackingStatus;
  last_validated_at: string | null;
  /** Fraction of recent events that 4xx/5xx'd, in [0, 1]. */
  recent_failure_rate: number;
  /** Total events considered when computing the failure rate. */
  recent_event_count: number;
}

// ─── API functions ─────────────────────────────────────────────────────────

export async function fetchTrackingSettings(
  storeId: string,
): Promise<TrackingSettings> {
  return apiClient<TrackingSettings>(`/stores/${storeId}/settings/tracking`);
}

export async function saveMetaTracking(
  storeId: string,
  payload: SaveMetaTrackingPayload,
): Promise<MetaTrackingSettings> {
  return apiClient<MetaTrackingSettings>(
    `/stores/${storeId}/settings/tracking/meta`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

export async function disconnectMeta(storeId: string): Promise<void> {
  await apiClient<void>(`/stores/${storeId}/settings/tracking/meta`, {
    method: "DELETE",
  });
}

export async function sendMetaTestEvent(
  storeId: string,
  testEventCode: string,
): Promise<SendTestEventResponse> {
  return apiClient<SendTestEventResponse>(
    `/stores/${storeId}/settings/tracking/meta/test-event`,
    {
      method: "POST",
      body: JSON.stringify({ test_event_code: testEventCode }),
    },
  );
}

export async function fetchRecentMetaEvents(
  storeId: string,
  limit = 20,
): Promise<MetaEventLogEntry[]> {
  return apiClient<MetaEventLogEntry[]>(
    `/stores/${storeId}/settings/tracking/meta/events?limit=${limit}`,
  );
}

export async function fetchMetaTrackingStatus(
  storeId: string,
): Promise<MetaTrackingStatusResponse> {
  return apiClient<MetaTrackingStatusResponse>(
    `/stores/${storeId}/settings/tracking/meta/status`,
  );
}

// ─── Activation mode helpers ───────────────────────────────────────────────

/**
 * Derive the merchant-facing activation mode card from the two booleans.
 * Mirrors the backend resolver in plan §3.2 — but tolerates the
 * "no token yet" case by returning the user's *intent* rather than
 * downgrading to `pixel_only` like the server does. This lets the
 * mode-card UI stay sticky when a merchant selects "Both" before
 * pasting a token.
 */
export function deriveModeFromFlags(
  pixelEnabled: boolean,
  capiEnabled: boolean,
): MetaTrackingMode {
  if (pixelEnabled && capiEnabled) return "both";
  if (pixelEnabled) return "pixel_only";
  if (capiEnabled) return "capi_only";
  return "off";
}

/** Inverse of `deriveModeFromFlags` — given a card selection, return the booleans to persist. */
export function flagsForMode(mode: MetaTrackingMode): {
  pixel_enabled: boolean;
  capi_enabled: boolean;
} {
  switch (mode) {
    case "both":
      return { pixel_enabled: true, capi_enabled: true };
    case "pixel_only":
      return { pixel_enabled: true, capi_enabled: false };
    case "capi_only":
      return { pixel_enabled: false, capi_enabled: true };
    case "off":
    default:
      return { pixel_enabled: false, capi_enabled: false };
  }
}
