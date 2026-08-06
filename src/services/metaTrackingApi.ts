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

// ─── Wave 2/3 advanced settings types ────────────────────────────────────

/**
 * Wave 2 Phase 12 — COD-aware Purchase/Lead trigger. ``null`` preserves
 * the legacy behavior (paymob/fawry webhooks remain the sole Purchase
 * source; no Lead from status transitions).
 *
 * Recommended for COD-heavy stores:
 *   * ``purchase_trigger = "delivered"`` — Meta sees real conversions
 *     only, not no-show COD placements (ROAS doesn't decay).
 *   * ``lead_trigger = "confirmed"`` — top-of-funnel signal for the
 *     ad algorithm.
 */
export type OrderStatusTrigger =
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered";

/** Wave 2 Phase 13 — one pixel in a store's multi-pixel configuration. */
export interface PixelEntry {
  pixel_id: string;
  pixel_enabled: boolean;
  capi_enabled: boolean;
  label?: string | null;
  role?: "primary" | "retargeting" | "agency" | null;
}

/** Wave 3 Phase 18 — granular Customer Privacy / consent policy. */
export type ConsentRegionMode = "auto" | "force_opt_in" | "force_opt_out";

export interface ConsentSettings {
  granular_enabled: boolean;
  region_default_mode: ConsentRegionMode;
  default_analytics: boolean;
  default_marketing: boolean;
  default_preferences: boolean;
  default_sale_of_data: boolean;
}

export interface MetaTrackingSettings {
  pixel_id: string | null;
  pixel_enabled: boolean;
  capi_enabled: boolean;
  /** Derived from `pixel_enabled` + `capi_enabled` + token presence. */
  mode: MetaTrackingMode;
  /** Masked view of the saved token, e.g. `EAAB••••••XK7`. Null if no token on file. */
  capi_access_token_masked: string | null;
  /**
   * The token Meta mints in Business Manager → Brand Safety → Domains. The
   * storefront emits it as `<meta name="facebook-domain-verification">`.
   * Merchant-supplied — a value NUMU invents can never verify anything,
   * because Meta looks for the token it issued.
   */
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

  // Wave 2/3 advanced settings — all optional/nullable so older stores
  // see no behavior change until they explicitly configure them.

  /** Wave 2 Phase 12 — fire Purchase on this order-status transition. */
  purchase_trigger?: OrderStatusTrigger | null;
  /** Wave 2 Phase 12 — fire Lead on this order-status transition. */
  lead_trigger?: OrderStatusTrigger | null;
  /** Wave 2 Phase 13 — multi-pixel list (null = legacy single-pixel). */
  pixels?: PixelEntry[] | null;
  /** Wave 2 Phase 15 — fire Lead on COD WhatsApp confirmation reply. */
  whatsapp_lead_enabled?: boolean;
  /** Wave 3 Phase 18 — granular consent policy (null = legacy 1-toggle). */
  consent_settings?: ConsentSettings | null;
  /**
   * Meta Business Ad Account ID — required by Custom Audience sync
   * (Marketing → Audiences) and Promote-on-Meta. Null when the merchant
   * hasn't connected the Business account yet — downstream features
   * render an empty state in that case instead of failing on submit.
   */
  ad_account_id?: string | null;
  /**
   * Meta Page ID — required by Promote-on-Meta (the ad creative needs
   * a Page actor). Independent of ad_account_id because some merchants
   * have multiple pages tied to one ad account.
   */
  page_id?: string | null;
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

  // Wave 2/3 advanced settings — see MetaTrackingSettings docs above.
  purchase_trigger?: OrderStatusTrigger | null;
  lead_trigger?: OrderStatusTrigger | null;
  pixels?: PixelEntry[] | null;
  whatsapp_lead_enabled?: boolean;
  consent_settings?: ConsentSettings | null;
  /** Meta Business Ad Account ID (audience sync + promote-on-Meta). */
  ad_account_id?: string | null;
  /** Meta Page ID (promote-on-Meta ad-creative actor). */
  page_id?: string | null;
  /**
   * Domain-verification token copied out of Business Manager. Omit to leave
   * the stored value untouched — same "no change" contract as the fields
   * above. The API also accepts the whole `<meta …>` tag and extracts the
   * token, since that is what Business Manager puts on the clipboard.
   */
  domain_verification_token?: string | null;
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
  enqueued: boolean;
  test_event_code: string;
  queued_event_id: string;
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

/**
 * Result of asking Meta/TikTok whether the saved pixel is real and reachable.
 * Shared shape across both platforms so one UI component renders either.
 */
export interface VerifyConnectionResult {
  verified: boolean;
  /** The dataset/pixel name as the provider knows it. */
  name: string | null;
  is_active: boolean | null;
  /** The provider's own message when it said no, or what we still need. */
  error: string | null;
  platform: "meta" | "tiktok";
}

/**
 * Ask Meta to confirm the saved Pixel ID.
 *
 * A "no" answer comes back as a resolved `{verified: false, error}` — not a
 * thrown ApiError — because the merchant needs to read Meta's message. Only
 * transport/auth failures reject.
 */
export async function verifyMetaConnection(
  storeId: string,
): Promise<VerifyConnectionResult> {
  return apiClient<VerifyConnectionResult>(
    `/stores/${storeId}/settings/tracking/meta/verify`,
    { method: "POST" },
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
