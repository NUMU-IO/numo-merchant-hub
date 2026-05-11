/**
 * Shipping configuration API service.
 *
 * Covers the merchant-facing CRUD + preset + coverage endpoints exposed
 * by the backend at /api/v1/stores/{store_id}/shipping/*, plus the
 * public reference endpoint at /api/v1/public/reference/governorates.
 *
 * Pattern mirrors `shipmentApi.ts`: every function takes `storeId`
 * first, returns a typed payload, and delegates to `apiClient()`
 * which unwraps `{ data: T }` automatically.
 */

import { apiClient } from "@/services/api";

// ─── Shared types ───────────────────────────────────────────────────

export type RateType = "flat" | "free_over" | "weight_band" | "carrier_api";

export type LogisticsZone =
  | "greater_cairo"
  | "delta"
  | "canal_sinai"
  | "upper_egypt"
  | "remote";

export interface Governorate {
  /** ISO 3166-2 code, e.g. "EG-C". Always present. */
  code: string;
  /** Locale-appropriate name as served by the endpoint. */
  name: string;
  /** English name (for forms that need to hold both locales). */
  name_en: string;
  /** Arabic name. */
  name_ar: string;
  default_zone: LogisticsZone;
  capital: string;
}

// ─── Rate config discriminated union ────────────────────────────────
// Must match `src/api/v1/schemas/tenant/shipping.py` on the backend.

export interface RateConfigFlat {
  type: "flat";
  amount_cents: number;
}

export interface RateConfigFreeOver {
  type: "free_over";
  amount_cents: number;
  free_when_subtotal_gte_cents: number;
}

export interface WeightBand {
  /** null = open-ended (applies to all remaining weight). */
  max_weight_g: number | null;
  amount_cents: number;
  /** Only meaningful on the open-ended band. Ceil-kg surcharge above the previous band's max. */
  per_extra_kg_cents?: number | null;
}

export interface RateConfigWeightBand {
  type: "weight_band";
  bands: WeightBand[];
}

export interface RateConfigCarrierApi {
  type: "carrier_api";
  carrier: string;
  service_code: string;
}

export type RateConfig =
  | RateConfigFlat
  | RateConfigFreeOver
  | RateConfigWeightBand
  | RateConfigCarrierApi;

// ─── Entities ────────────────────────────────────────────────────────

export interface ShippingRate {
  id: string;
  zone_id: string;
  rate_type: RateType;
  label: string;
  label_ar: string | null;
  /** JSONB payload — shape depends on `rate_type`. Parse via `rateConfigOf`. */
  config: Record<string, unknown>;
  is_active: boolean;
  sort_order: number;
}

export interface ShippingZone {
  id: string;
  store_id: string;
  name: string;
  name_ar: string | null;
  governorate_codes: string[];
  estimated_days_min: number;
  estimated_days_max: number;
  cod_enabled: boolean;
  cod_fee_cents: number;
  is_active: boolean;
  sort_order: number;
  rates: ShippingRate[];
}

export interface CoverageConflict {
  governorate_code: string;
  zones: string[];
}

export interface Coverage {
  /** ISO 3166-2 codes covered by at least one active zone. */
  covered: string[];
  uncovered: string[];
  conflicts: CoverageConflict[];
}

export interface PresetResult {
  created_zone_ids: string[];
  assigned_governorate_codes: string[];
}

// ─── Shipping option (resolver output, used by RateCalculator) ──────

export interface ShippingOption {
  rate_id: string;
  label: string;
  label_ar: string | null;
  amount_cents: number;
  currency: string;
  estimated_days_min: number;
  estimated_days_max: number;
  cod_supported: boolean;
  rate_type: RateType;
}

export interface FreeShippingProgress {
  current_cents: number;
  threshold_cents: number;
  remaining_cents: number;
  qualified: boolean;
}

export interface ShippingOptionsResult {
  options: ShippingOption[];
  free_shipping_progress: FreeShippingProgress | null;
}

// ─── Request payloads ───────────────────────────────────────────────

export interface CreateZoneRequest {
  name: string;
  name_ar?: string | null;
  governorate_codes: string[];
  estimated_days_min?: number;
  estimated_days_max?: number;
  cod_enabled?: boolean;
  cod_fee_cents?: number;
  is_active?: boolean;
  sort_order?: number;
}

export interface UpdateZoneRequest {
  name?: string;
  name_ar?: string | null;
  governorate_codes?: string[];
  estimated_days_min?: number;
  estimated_days_max?: number;
  cod_enabled?: boolean;
  cod_fee_cents?: number;
  is_active?: boolean;
  sort_order?: number;
}

export interface CreateRateRequest {
  label: string;
  label_ar?: string | null;
  config: RateConfig;
  is_active?: boolean;
  sort_order?: number;
}

export interface UpdateRateRequest {
  label?: string;
  label_ar?: string | null;
  config?: RateConfig;
  is_active?: boolean;
  sort_order?: number;
}

export interface CalculatePreviewRequest {
  governorate_code: string;
  cart_subtotal_cents: number;
  cart_weight_g?: number;
  cod_requested?: boolean;
  coupon_code?: string | null;
}

// ─── Reference (public, no auth) ────────────────────────────────────

export async function listReferenceGovernorates(
  locale: "en" | "ar" = "en",
): Promise<Governorate[]> {
  return apiClient<Governorate[]>(
    `/public/reference/governorates?country=EG&locale=${locale}`,
  );
}

// ─── Zones ──────────────────────────────────────────────────────────

export async function listShippingZones(storeId: string): Promise<ShippingZone[]> {
  return apiClient<ShippingZone[]>(`/stores/${storeId}/shipping/zones`);
}

export async function getShippingZone(
  storeId: string,
  zoneId: string,
): Promise<ShippingZone> {
  return apiClient<ShippingZone>(`/stores/${storeId}/shipping/zones/${zoneId}`);
}

export async function createShippingZone(
  storeId: string,
  body: CreateZoneRequest,
): Promise<ShippingZone> {
  return apiClient<ShippingZone>(`/stores/${storeId}/shipping/zones`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateShippingZone(
  storeId: string,
  zoneId: string,
  body: UpdateZoneRequest,
): Promise<ShippingZone> {
  return apiClient<ShippingZone>(`/stores/${storeId}/shipping/zones/${zoneId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteShippingZone(
  storeId: string,
  zoneId: string,
): Promise<{ deleted: boolean }> {
  return apiClient<{ deleted: boolean }>(
    `/stores/${storeId}/shipping/zones/${zoneId}`,
    { method: "DELETE" },
  );
}

// ─── Rates ──────────────────────────────────────────────────────────

export async function createShippingRate(
  storeId: string,
  zoneId: string,
  body: CreateRateRequest,
): Promise<ShippingRate> {
  return apiClient<ShippingRate>(
    `/stores/${storeId}/shipping/zones/${zoneId}/rates`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function updateShippingRate(
  storeId: string,
  zoneId: string,
  rateId: string,
  body: UpdateRateRequest,
): Promise<ShippingRate> {
  return apiClient<ShippingRate>(
    `/stores/${storeId}/shipping/zones/${zoneId}/rates/${rateId}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export async function deleteShippingRate(
  storeId: string,
  zoneId: string,
  rateId: string,
): Promise<{ deleted: boolean }> {
  return apiClient<{ deleted: boolean }>(
    `/stores/${storeId}/shipping/zones/${zoneId}/rates/${rateId}`,
    { method: "DELETE" },
  );
}

// ─── Coverage / Preset / Calculator ────────────────────────────────

export async function getShippingCoverage(storeId: string): Promise<Coverage> {
  return apiClient<Coverage>(`/stores/${storeId}/shipping/coverage`);
}

export async function applyEgypt4ZonePreset(
  storeId: string,
): Promise<PresetResult> {
  return apiClient<PresetResult>(
    `/stores/${storeId}/shipping/preset/egypt-4-zone`,
    { method: "POST" },
  );
}

export async function calculateShippingPreview(
  storeId: string,
  body: CalculatePreviewRequest,
): Promise<ShippingOptionsResult> {
  return apiClient<ShippingOptionsResult>(
    `/stores/${storeId}/shipping/calculate`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Narrow a raw `rate.config` JSONB blob to a typed `RateConfig`, adding
 * the `type` discriminator from `rate.rate_type` if it wasn't sent.
 *
 * Backend omits `type` from the payload because it lives in a separate
 * column. Merchant UI needs it to drive the rate editor form.
 */
export function rateConfigOf(rate: ShippingRate): RateConfig {
  const raw = { ...(rate.config || {}) } as Record<string, unknown>;
  if (!raw.type) raw.type = rate.rate_type;
  return raw as unknown as RateConfig;
}
