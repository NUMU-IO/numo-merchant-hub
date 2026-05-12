/**
 * Shipment API service for the merchant dashboard.
 * Manages Bosta shipping: shipments, pickups, cities, COD.
 */

import { apiClient } from "./api";

// ── Types ──

export interface Shipment {
  id: string;
  store_id: string;
  order_id: string;
  carrier: string;
  carrier_shipment_id: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  awb_url: string | null;
  status: string;
  shipment_type: string;
  parent_shipment_id: string | null;
  shipping_method: string | null;
  shipping_cost: number;
  cod_amount: number;
  cod_collected: boolean;
  cod_collected_at: string | null;
  delivery_attempts: number;
  status_history: StatusHistoryEntry[];
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatusHistoryEntry {
  from: string;
  to: string;
  description: string;
  timestamp: string;
}

export interface ShipmentListItem {
  id: string;
  order_id: string;
  tracking_number: string | null;
  tracking_url: string | null;
  awb_url: string | null;
  carrier: string;
  status: string;
  shipment_type: string;
  shipping_method: string | null;
  cod_amount: number;
  cod_collected: boolean;
  delivery_attempts: number;
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
}

export interface ShipmentStats {
  total: number;
  by_status: Record<string, number>;
  cod_total: number;
  cod_collected: number;
  cod_pending: number;
}

export interface CodSummary {
  total_shipments: number;
  total_expected: number;
  total_collected: number;
  total_pending: number;
  collected_count: number;
  delivered_not_collected: number;
}

export interface BulkShipmentResultItem {
  order_id: string;
  success: boolean;
  tracking_number: string | null;
  shipment_id: string | null;
  error: string | null;
}

export interface BulkShipmentResult {
  total: number;
  succeeded: number;
  failed: number;
  results: BulkShipmentResultItem[];
}

export interface TrackingEvent {
  status: string;
  description: string;
  location: string | null;
  timestamp: string;
}

export interface TrackingInfo {
  tracking_number: string;
  status: string;
  estimated_delivery: string | null;
  events: TrackingEvent[];
}

export interface BostaCredentials {
  is_configured: boolean;
  api_key_masked: string | null;
  business_id: string | null;
  auto_create_shipment: boolean;
  last_configured: string | null;
}

// ── Shipment CRUD ──

export async function createShipment(
  storeId: string,
  data: { order_id: string; shipping_method?: string; notes?: string }
): Promise<Shipment> {
  return apiClient<Shipment>(`/stores/${storeId}/shipments/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function bulkCreateShipments(
  storeId: string,
  orderIds: string[]
): Promise<BulkShipmentResult> {
  return apiClient<BulkShipmentResult>(`/stores/${storeId}/shipments/bulk`, {
    method: "POST",
    body: JSON.stringify({ order_ids: orderIds }),
  });
}

export async function listShipments(
  storeId: string,
  params: {
    status?: string;
    carrier?: string;
    has_cod?: boolean;
    order_id?: string;
    has_label?: boolean;
    skip?: number;
    limit?: number;
  } = {}
): Promise<ShipmentListItem[]> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set("status", params.status);
  if (params.carrier) searchParams.set("carrier", params.carrier);
  if (params.has_cod !== undefined) searchParams.set("has_cod", String(params.has_cod));
  if (params.order_id) searchParams.set("order_id", params.order_id);
  if (params.has_label !== undefined) searchParams.set("has_label", String(params.has_label));
  if (params.skip !== undefined) searchParams.set("skip", String(params.skip));
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return apiClient<ShipmentListItem[]>(`/stores/${storeId}/shipments/${qs ? `?${qs}` : ""}`);
}

export async function getShipment(storeId: string, shipmentId: string): Promise<Shipment> {
  return apiClient<Shipment>(`/stores/${storeId}/shipments/${shipmentId}`);
}

export async function getShipmentStats(storeId: string): Promise<ShipmentStats> {
  return apiClient<ShipmentStats>(`/stores/${storeId}/shipments/stats`);
}

export async function getCodSummary(storeId: string): Promise<CodSummary> {
  return apiClient<CodSummary>(`/stores/${storeId}/shipments/cod/summary`);
}

export async function cancelShipment(storeId: string, shipmentId: string): Promise<Shipment> {
  return apiClient<Shipment>(`/stores/${storeId}/shipments/${shipmentId}/cancel`, {
    method: "POST",
  });
}

export async function requestReturn(
  storeId: string,
  shipmentId: string,
  reason: string = "Customer return"
): Promise<Shipment> {
  return apiClient<Shipment>(
    `/stores/${storeId}/shipments/${shipmentId}/return?reason=${encodeURIComponent(reason)}`,
    { method: "POST" }
  );
}

export async function trackShipment(storeId: string, shipmentId: string): Promise<TrackingInfo> {
  return apiClient<TrackingInfo>(`/stores/${storeId}/shipments/${shipmentId}/track`);
}

export async function updateShipment(
  storeId: string,
  shipmentId: string,
  data: {
    notes?: string;
    cod_amount?: number;
    receiver_phone?: string;
    receiver_first_name?: string;
    receiver_last_name?: string;
  }
): Promise<Shipment> {
  const params = new URLSearchParams();
  Object.entries(data).forEach(([k, v]) => {
    if (v !== undefined && v !== null) params.set(k, String(v));
  });
  return apiClient<Shipment>(
    `/stores/${storeId}/shipments/${shipmentId}?${params.toString()}`,
    { method: "PATCH" }
  );
}

export function getAwbUrl(storeId: string, shipmentId: string): string {
  return `/api/v1/stores/${storeId}/shipments/${shipmentId}/awb`;
}

// ── Pickups ──

export async function getPickupLocations(storeId: string): Promise<unknown[]> {
  return apiClient<unknown[]>(`/stores/${storeId}/shipments/pickups/locations`);
}

export async function createPickup(
  storeId: string,
  data: {
    business_location_id: string;
    scheduled_date: string;
    scheduled_time_slot: string;
    contact_name?: string;
    contact_phone?: string;
    notes?: string;
  }
): Promise<unknown> {
  const params = new URLSearchParams();
  Object.entries(data).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  return apiClient<unknown>(`/stores/${storeId}/shipments/pickups?${params.toString()}`, {
    method: "POST",
  });
}

export async function listPickups(storeId: string): Promise<unknown> {
  return apiClient<unknown>(`/stores/${storeId}/shipments/pickups`);
}

export async function deletePickup(storeId: string, pickupId: string): Promise<void> {
  await apiClient<void>(`/stores/${storeId}/shipments/pickups/${pickupId}`, {
    method: "DELETE",
  });
}

// ── Cities & Zones ──

export async function getBostaCities(storeId: string): Promise<unknown[]> {
  return apiClient<unknown[]>(`/stores/${storeId}/shipments/bosta/cities`);
}

export async function getBostaCityZones(storeId: string, cityId: string): Promise<unknown[]> {
  return apiClient<unknown[]>(`/stores/${storeId}/shipments/bosta/cities/${cityId}/zones`);
}

// ── Bosta Credentials ──

export async function fetchBostaCredentials(storeId: string): Promise<BostaCredentials> {
  return apiClient<BostaCredentials>(`/stores/${storeId}/settings/shipping/bosta/credentials`);
}

export async function saveBostaCredentials(
  storeId: string,
  data: {
    api_key: string;
    business_id: string;
    webhook_secret?: string;
    auto_create_shipment?: boolean;
  }
): Promise<BostaCredentials> {
  return apiClient<BostaCredentials>(`/stores/${storeId}/settings/shipping/bosta/credentials`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteBostaCredentials(storeId: string): Promise<void> {
  await apiClient<void>(`/stores/${storeId}/settings/shipping/bosta/credentials`, {
    method: "DELETE",
  });
}
