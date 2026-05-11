/**
 * Product Bundle (Frequently Bought Together) API service.
 *
 * Manages CRUD operations for product bundles from the merchant dashboard.
 * Follows the same patterns as upsellApi.ts.
 */
import { apiClient } from "./api";

// ── Types ────────────────────────────────────────────────────────────────

export interface ProductBundle {
  id: string;
  store_id: string;
  primary_product_id: string;
  bundled_product_id: string;
  discount_type: "percentage" | "fixed" | "none";
  discount_value: number;
  position: number;
  is_active: boolean;
  section_title_en: string | null;
  section_title_ar: string | null;
  // Bundled product summary (populated by backend)
  bundled_product_name: string | null;
  bundled_product_price: number | null;
  bundled_product_image: string | null;
  bundled_product_in_stock: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBundleRequest {
  primary_product_id: string;
  bundled_product_id: string;
  discount_type?: "percentage" | "fixed" | "none";
  discount_value?: number;
  position?: number;
  is_active?: boolean;
  section_title_en?: string | null;
  section_title_ar?: string | null;
}

export interface BulkSetBundleItem {
  bundled_product_id: string;
  discount_type?: "percentage" | "fixed" | "none";
  discount_value?: number;
  position?: number;
  is_active?: boolean;
  section_title_en?: string | null;
  section_title_ar?: string | null;
}

export interface BulkSetBundlesRequest {
  primary_product_id: string;
  bundles: BulkSetBundleItem[];
}

export interface UpdateBundleRequest {
  discount_type?: "percentage" | "fixed" | "none";
  discount_value?: number;
  position?: number;
  is_active?: boolean;
  section_title_en?: string | null;
  section_title_ar?: string | null;
}

export interface ReorderBundlesRequest {
  primary_product_id: string;
  ordered_bundle_ids: string[];
}

// ── API Functions ────────────────────────────────────────────────────────

/**
 * List all bundles for a store, optionally filtered by primary product.
 */
export async function listBundles(
  storeId: string,
  primaryProductId?: string,
  activeOnly?: boolean,
): Promise<ProductBundle[]> {
  const params = new URLSearchParams();
  if (primaryProductId) params.set("primary_product_id", primaryProductId);
  if (activeOnly) params.set("active_only", "true");
  const qs = params.toString();
  return apiClient<ProductBundle[]>(
    `/stores/${storeId}/bundles${qs ? `?${qs}` : ""}`,
  );
}

/**
 * Get bundles for a specific primary product.
 */
export async function getBundlesForProduct(
  storeId: string,
  productId: string,
): Promise<ProductBundle[]> {
  return listBundles(storeId, productId);
}

/**
 * Create a single bundle association.
 */
export async function createBundle(
  storeId: string,
  data: CreateBundleRequest,
): Promise<ProductBundle> {
  return apiClient<ProductBundle>(`/stores/${storeId}/bundles`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Replace all bundles for a primary product (atomic set operation).
 * This is the preferred method — sends the complete desired state.
 */
export async function setBundlesForProduct(
  storeId: string,
  data: BulkSetBundlesRequest,
): Promise<ProductBundle[]> {
  return apiClient<ProductBundle[]>(`/stores/${storeId}/bundles/set`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Update a single bundle (partial update).
 */
export async function updateBundle(
  storeId: string,
  bundleId: string,
  data: UpdateBundleRequest,
): Promise<ProductBundle> {
  return apiClient<ProductBundle>(`/stores/${storeId}/bundles/${bundleId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Delete a single bundle.
 */
export async function deleteBundle(
  storeId: string,
  bundleId: string,
): Promise<void> {
  return apiClient<void>(`/stores/${storeId}/bundles/${bundleId}`, {
    method: "DELETE",
  });
}

/**
 * Reorder bundles for a primary product (drag & drop).
 */
export async function reorderBundles(
  storeId: string,
  data: ReorderBundlesRequest,
): Promise<void> {
  return apiClient<void>(`/stores/${storeId}/bundles/reorder`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
