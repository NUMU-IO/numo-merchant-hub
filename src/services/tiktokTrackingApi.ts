/**
 * TikTok Pixel + Events API tracking settings.
 *
 * Sibling of `metaTrackingApi.ts`. Backend endpoints live under
 *   /stores/{id}/settings/tracking[/tiktok...]
 *
 * Two booleans (`pixel_enabled`, `api_enabled`) are persisted; the server
 * derives the `mode` field for display. The Events API access token is
 * write-only — the server never returns the plaintext, only a masked
 * version like `abc1••••••XYZ`.
 *
 * TikTok deltas vs Meta: the server toggle is `api_enabled` (TikTok calls
 * the server rail "Events API"), pixel IDs are alphanumeric (not 15-16
 * digits), and the response carries a `request_id` (not `fbtrace_id`).
 */

import { apiClient } from "./api";
// One shared shape for both platforms' verify results — declared with the
// Meta client since that landed first; re-exported below so TikTok callers
// don't have to import across platform modules.
import type { VerifyConnectionResult } from "./metaTrackingApi";

export type { VerifyConnectionResult };

// ─── Types ─────────────────────────────────────────────────────────────────

/** Resolved activation mode — derived server-side from the two booleans. */
export type TikTokTrackingMode = "off" | "pixel_only" | "capi_only" | "both";

/** Live status badge from `/status` endpoint. */
export type TikTokTrackingStatus =
  | "connected"
  | "configured_no_events"
  | "failing"
  | "disabled";

/** COD-aware CompletePayment trigger. `null` = fire on payment webhook. */
export type OrderStatusTrigger =
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered";

/** One pixel in a store's multi-pixel TikTok configuration. */
export interface TikTokPixelEntry {
  pixel_id: string;
  pixel_enabled: boolean;
  api_enabled: boolean;
  label?: string | null;
  role?: "primary" | "retargeting" | "agency" | null;
}

export interface TikTokTrackingSettings {
  pixel_id: string | null;
  pixel_enabled: boolean;
  api_enabled: boolean;
  /** Derived from `pixel_enabled` + `api_enabled` + token presence. */
  mode: TikTokTrackingMode;
  /** Masked view of the saved token, e.g. `abc1••••••XYZ`. Null if none on file. */
  api_access_token_masked: string | null;
  /**
   * Whether an active token row exists. Prefer this over the mask: the mask
   * is null whenever the server cannot decrypt the token for display, which
   * this panel used to read as "no token on file" while events were flowing.
   * Optional until the backend that returns it is promoted.
   */
  has_token?: boolean;
  /** Optional debug-only event code from Events Manager → Test Events. */
  test_event_code: string | null;
  /** When true, gate the browser Pixel on consent banner acceptance. */
  consent_required: boolean;
  /** Whether debug mode is currently active (server flips it off at expiry). */
  debug_mode: boolean;
  debug_mode_expires_at: string | null;
  last_validated_at: string | null;
  status: TikTokTrackingStatus;
  /** COD-aware CompletePayment timing (null = fire on payment webhook). */
  purchase_trigger?: OrderStatusTrigger | null;
  /** Multi-pixel list (null = legacy single-pixel). */
  pixels?: TikTokPixelEntry[] | null;
  /** TikTok advertiser id — reserved for the Marketing API phase. */
  advertiser_id?: string | null;
}

/**
 * Wrapper for the GET /tracking endpoint — `meta` and `tiktok` today.
 * `tiktok` may be null on older backends.
 */
export interface TrackingSettings {
  meta: unknown;
  tiktok: TikTokTrackingSettings | null;
}

export interface SaveTikTokTrackingPayload {
  pixel_id: string;
  pixel_enabled: boolean;
  api_enabled: boolean;
  /** Optional. Only sent when (re)setting the token; backend keeps existing if omitted. */
  api_access_token?: string;
  test_event_code?: string | null;
  consent_required: boolean;
  debug_mode: boolean;
  purchase_trigger?: OrderStatusTrigger | null;
  pixels?: TikTokPixelEntry[] | null;
  advertiser_id?: string | null;
}

export type TikTokEventChannel = "browser" | "server" | "both";

export interface TikTokEventLogEntry {
  id: string;
  event_id: string;
  event_name: string;
  channel: TikTokEventChannel;
  /** HTTP status from TikTok. Null while in-flight. */
  response_status: number | null;
  /** TikTok business-level code (0 == OK). */
  response_code: number | null;
  request_id: string | null;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  request_payload_redacted: Record<string, unknown> | null;
}

export interface SendTestEventResponse {
  enqueued: boolean;
  test_event_code: string;
  queued_event_id: string;
}

export interface TikTokTrackingStatusResponse {
  mode: TikTokTrackingMode;
  status: TikTokTrackingStatus;
  last_validated_at: string | null;
  recent_failure_rate: number;
  recent_event_count: number;
}

/** Aggregated TikTok Marketing report (P6 reporting card). */
export interface TikTokReport {
  connected: boolean;
  advertiser_id: string | null;
  start_date: string | null;
  end_date: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cost_per_conversion: number;
  ctr: number;
  error: string | null;
}

// ─── API functions ─────────────────────────────────────────────────────────

export async function fetchTikTokTracking(
  storeId: string,
): Promise<TikTokTrackingSettings | null> {
  const res = await apiClient<TrackingSettings>(
    `/stores/${storeId}/settings/tracking`,
  );
  return res.tiktok ?? null;
}

export async function saveTikTokTracking(
  storeId: string,
  payload: SaveTikTokTrackingPayload,
): Promise<TikTokTrackingSettings> {
  return apiClient<TikTokTrackingSettings>(
    `/stores/${storeId}/settings/tracking/tiktok`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

export async function disconnectTikTok(storeId: string): Promise<void> {
  await apiClient<void>(`/stores/${storeId}/settings/tracking/tiktok`, {
    method: "DELETE",
  });
}

export async function sendTikTokTestEvent(
  storeId: string,
  testEventCode: string,
): Promise<SendTestEventResponse> {
  return apiClient<SendTestEventResponse>(
    `/stores/${storeId}/settings/tracking/tiktok/test-event`,
    {
      method: "POST",
      body: JSON.stringify({ test_event_code: testEventCode }),
    },
  );
}

export async function fetchRecentTikTokEvents(
  storeId: string,
  limit = 20,
): Promise<TikTokEventLogEntry[]> {
  return apiClient<TikTokEventLogEntry[]>(
    `/stores/${storeId}/settings/tracking/tiktok/events?limit=${limit}`,
  );
}

export async function fetchTikTokTrackingStatus(
  storeId: string,
): Promise<TikTokTrackingStatusResponse> {
  return apiClient<TikTokTrackingStatusResponse>(
    `/stores/${storeId}/settings/tracking/tiktok/status`,
  );
}

/**
 * Ask TikTok to confirm the saved Pixel Code exists on the configured
 * advertiser. Same contract as `verifyMetaConnection`: a "no" resolves with
 * `verified: false` and TikTok's own message rather than throwing.
 */
export async function verifyTikTokConnection(
  storeId: string,
): Promise<VerifyConnectionResult> {
  return apiClient<VerifyConnectionResult>(
    `/stores/${storeId}/settings/tracking/tiktok/verify`,
    { method: "POST" },
  );
}

export async function fetchTikTokReport(
  storeId: string,
  days = 30,
): Promise<TikTokReport> {
  return apiClient<TikTokReport>(
    `/stores/${storeId}/settings/tracking/tiktok/report?days=${days}`,
  );
}

// ─── OAuth (one-click connect) ─────────────────────────────────────────────

/**
 * Begin the TikTok OAuth flow. Returns the absolute URL the browser should be
 * sent to (the backend `/oauth/tiktok/start` sets a CSRF cookie then 307s to
 * TikTok's consent screen). We navigate the top window there rather than
 * fetch() so the cookie + redirect chain work. Uses the same API origin the
 * app already talks to.
 */
export function tiktokOAuthStartUrl(storeId: string): string {
  // apiClient talks to `${VITE_API_URL}` (…/api/v1). Reuse that base so the
  // OAuth start hits the same origin (cookie scope matches).
  const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api/v1";
  return `${base.replace(/\/$/, "")}/oauth/tiktok/start?store_id=${encodeURIComponent(storeId)}`;
}

// ─── Activation mode helpers ───────────────────────────────────────────────

/** Derive the merchant-facing activation mode from the two booleans. */
export function deriveModeFromFlags(
  pixelEnabled: boolean,
  apiEnabled: boolean,
): TikTokTrackingMode {
  if (pixelEnabled && apiEnabled) return "both";
  if (pixelEnabled) return "pixel_only";
  if (apiEnabled) return "capi_only";
  return "off";
}

/** Inverse — given a card selection, return the booleans to persist. */
export function flagsForMode(mode: TikTokTrackingMode): {
  pixel_enabled: boolean;
  api_enabled: boolean;
} {
  switch (mode) {
    case "both":
      return { pixel_enabled: true, api_enabled: true };
    case "pixel_only":
      return { pixel_enabled: true, api_enabled: false };
    case "capi_only":
      return { pixel_enabled: false, api_enabled: true };
    case "off":
    default:
      return { pixel_enabled: false, api_enabled: false };
  }
}
