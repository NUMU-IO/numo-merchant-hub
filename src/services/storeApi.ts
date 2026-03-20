/**
 * Store API service — CRUD for merchant stores.
 */

import { apiClient } from "./api";

export interface StoreData {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  subdomain: string;
  custom_domain: string | null;
  store_url: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  status: string;
  default_currency: string;
  default_language: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  social_links: Record<string, string> | null;
  theme_settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedStores {
  items: StoreData[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CreateStoreData {
  name: string;
  subdomain: string;
  slug?: string;
  description?: string;
  default_currency?: string;
  default_language?: string;
  contact_email?: string;
  contact_phone?: string;
  invite_code?: string;
}

export interface CheckSubdomainResult {
  subdomain: string;
  available: boolean;
  message: string;
}

export async function listStores(): Promise<PaginatedStores> {
  return apiClient<PaginatedStores>("/stores/");
}

export async function createStore(data: CreateStoreData): Promise<StoreData> {
  return apiClient<StoreData>("/stores/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function checkSubdomain(
  subdomain: string
): Promise<CheckSubdomainResult> {
  return apiClient<CheckSubdomainResult>("/stores/check-subdomain", {
    method: "POST",
    body: JSON.stringify({ subdomain }),
  });
}

export async function getStore(storeId: string): Promise<StoreData> {
  return apiClient<StoreData>(`/stores/${storeId}`);
}

export interface UpdateStoreData {
  name?: string;
  description?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  social_links?: Record<string, string> | null;
  default_language?: string;
  settings?: Record<string, unknown>;
  theme_settings?: Record<string, unknown>;
}

export async function updateStore(
  storeId: string,
  data: UpdateStoreData
): Promise<StoreData> {
  return apiClient<StoreData>(`/stores/${storeId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ─── Asset Upload ────────────────────────────────────────────────────────────

export interface UploadAssetResult {
  url: string;
  asset_type: string;
  filename: string;
}

export async function uploadStoreAsset(
  storeId: string,
  file: File,
  assetType: "logo" | "favicon" | "hero_image" | "profile_picture",
): Promise<UploadAssetResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("asset_type", assetType);

  return apiClient<UploadAssetResult>(`/stores/${storeId}/customization/assets`, {
    method: "POST",
    body: formData,
  });
}

// ─── Shipping Settings ────────────────────────────────────────────────────────

export interface ShippingZone {
  id: string;
  zone: string;
  governorates: string;
  rate: number;
  estimated_days: string;
}

export interface ShippingCarrierStatus {
  enabled: boolean;
  is_configured: boolean;
  last_configured: string | null;
}

export interface ShippingSettings {
  aramex: ShippingCarrierStatus;
  bosta: ShippingCarrierStatus;
  mylerz: ShippingCarrierStatus;
  manual: ShippingCarrierStatus;
  zones: ShippingZone[];
  free_shipping_threshold: number;
}

export async function fetchShippingSettings(
  storeId: string
): Promise<ShippingSettings> {
  return apiClient<ShippingSettings>(`/stores/${storeId}/settings/shipping`);
}

export async function updateShippingSettings(
  storeId: string,
  data: { free_shipping_threshold?: number; manual_enabled?: boolean }
): Promise<ShippingSettings> {
  return apiClient<ShippingSettings>(`/stores/${storeId}/settings/shipping`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function addShippingZone(
  storeId: string,
  data: { zone: string; governorates: string; rate: number; estimated_days: string }
): Promise<ShippingZone> {
  return apiClient<ShippingZone>(`/stores/${storeId}/settings/shipping/zones`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteShippingZone(
  storeId: string,
  zoneId: string
): Promise<void> {
  await apiClient(`/stores/${storeId}/settings/shipping/zones/${zoneId}`, {
    method: "DELETE",
  });
}
