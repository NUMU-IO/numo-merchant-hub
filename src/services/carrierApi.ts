/**
 * Carrier catalog + connection management.
 *
 * The hub used to hardcode its own carrier array, its own `comingSoon`
 * flags and a Bosta-only credentials panel, so adding a carrier meant a
 * frontend commit. These endpoints serve the backend's carrier registry
 * instead: names in both languages, tier, brand colour, declared
 * capabilities, the credential fields to render, and this store's
 * connection state.
 *
 * Verification is server-side. Saving credentials used to mark a carrier
 * configured without ever calling it, so a typo'd key showed a green
 * "Live" badge; the hub compensated with a localStorage probe that was
 * per-browser and invisible to support. `status.verified` is now the
 * shared truth — `null` means the carrier declares no safe read-only
 * call, which the UI must render as "not verified", never as connected.
 */

import { apiClient } from "./api";

// ── Types ──

export interface CarrierCapabilities {
  supports_cod: boolean;
  supports_labels: boolean;
  supports_pickup: boolean;
  supports_return: boolean;
  supports_cancel: boolean;
  supports_live_rates: boolean;
  supports_webhooks: boolean;
  supports_tracking: boolean;
  supports_city_lookup: boolean;
  supports_delivery_update: boolean;
}

export interface CarrierCredentialField {
  key: string;
  label_en: string;
  label_ar: string;
  required: boolean;
  /** Render masked; never echoed back by the server. */
  secret: boolean;
  help_en: string;
  help_ar: string;
}

export interface CarrierConnectionStatus {
  is_configured: boolean;
  enabled: boolean;
  /** true = carrier answered, false = rejected, null = cannot be checked. */
  verified: boolean | null;
  verified_at: string | null;
  verification_error: string | null;
  last_configured: string | null;
  auto_create_shipment: boolean;
}

export interface Carrier {
  slug: string;
  name_en: string;
  name_ar: string;
  tier: "native" | "aggregator" | "manual";
  brand_color: string | null;
  is_default: boolean;
  is_selectable: boolean;
  tracking_url_template: string | null;
  capabilities: CarrierCapabilities;
  /** False when the carrier has no read-only call we can probe. */
  can_verify: boolean;
  credential_fields: CarrierCredentialField[];
  supported_operations: string[];
  status: CarrierConnectionStatus;
}

// ── Calls ──

export async function listCarriers(storeId: string): Promise<Carrier[]> {
  return apiClient<Carrier[]>(`/stores/${storeId}/shipments/carriers`);
}

export async function saveCarrierCredentials(
  storeId: string,
  slug: string,
  credentials: Record<string, string>,
  autoCreateShipment?: boolean,
): Promise<CarrierConnectionStatus & { carrier: string }> {
  return apiClient(`/stores/${storeId}/shipments/carriers/${slug}/credentials`, {
    method: "PUT",
    body: JSON.stringify({
      credentials,
      ...(autoCreateShipment === undefined
        ? {}
        : { auto_create_shipment: autoCreateShipment }),
    }),
  });
}

export async function deleteCarrierCredentials(
  storeId: string,
  slug: string,
): Promise<CarrierConnectionStatus & { carrier: string }> {
  return apiClient(`/stores/${storeId}/shipments/carriers/${slug}/credentials`, {
    method: "DELETE",
  });
}

export async function verifyCarrier(
  storeId: string,
  slug: string,
): Promise<CarrierConnectionStatus & { carrier: string }> {
  return apiClient(`/stores/${storeId}/shipments/carriers/${slug}/verify`, {
    method: "POST",
  });
}

// ── Derived helpers ──

export type CarrierState =
  | "connected"
  | "unverified"
  | "not_configured"
  | "unavailable";

/**
 * How a carrier card should read.
 *
 * `unverified` covers two different things on purpose: credentials the
 * carrier rejected, and credentials we have no way to check. Both mean
 * "don't show a green badge" — the distinction is explained in the
 * detail view, where there's room for it.
 */
export function carrierState(carrier: Carrier): CarrierState {
  if (!carrier.is_selectable) return "unavailable";
  if (!carrier.status.is_configured) return "not_configured";
  if (carrier.status.verified === true) return "connected";
  return "unverified";
}

export function carrierName(carrier: Carrier, isAr: boolean): string {
  return isAr ? carrier.name_ar : carrier.name_en;
}

export function credentialLabel(
  field: CarrierCredentialField,
  isAr: boolean,
): string {
  return isAr ? field.label_ar : field.label_en;
}

export function credentialHelp(
  field: CarrierCredentialField,
  isAr: boolean,
): string {
  return isAr ? field.help_ar : field.help_en;
}

/** Whether a carrier declares it can do something, for disabling actions. */
export function can(
  carrier: Carrier | undefined,
  capability: keyof CarrierCapabilities,
): boolean {
  return !!carrier?.capabilities?.[capability];
}
