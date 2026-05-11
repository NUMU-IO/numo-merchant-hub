/**
 * Product variants API service — Phase 8.1.
 *
 * Variants live under /stores/{store_id}/products/{product_id}/variants
 * on the merchant API. Backend operations:
 *   GET    /                     — list variants
 *   POST   /                     — create
 *   PATCH  /{variant_id}         — partial update
 *   DELETE /{variant_id}         — soft delete (or unique-axis cleanup)
 *   POST   /{variant_id}/stock   — explicit stock adjustment (audited)
 *
 * The product's `options` JSONB (axis names + position) lives on the
 * Product entity itself, not Variant. We expose helpers here for the
 * matrix editor to read/write both.
 */

import { apiClient } from "./api";

export interface ProductOption {
  name: string;
  position: number;
  values?: string[];
}

export interface Variant {
  id: string;
  product_id: string;
  position: number;
  option_values: Record<string, string>;
  price: string; // decimal string in store currency
  price_currency: string;
  compare_at_price: string | null;
  cost_price: string | null;
  sku: string | null;
  barcode: string | null;
  inventory_quantity: number;
  is_in_stock: boolean;
  image_url: string | null;
  weight_g: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateVariantData {
  option_values: Record<string, string>;
  price: number;
  compare_at_price?: number | null;
  cost_price?: number | null;
  sku?: string | null;
  barcode?: string | null;
  inventory_quantity?: number;
  image_url?: string | null;
  weight_g?: number | null;
  position?: number;
}

export interface UpdateVariantData {
  option_values?: Record<string, string>;
  price?: number;
  compare_at_price?: number | null;
  cost_price?: number | null;
  sku?: string | null;
  barcode?: string | null;
  inventory_quantity?: number;
  image_url?: string | null;
  weight_g?: number | null;
  position?: number;
}

export async function listVariants(
  storeId: string,
  productId: string,
): Promise<Variant[]> {
  const res = await apiClient<{ items?: Variant[] } | Variant[]>(
    `/stores/${storeId}/products/${productId}/variants`,
  );
  if (Array.isArray(res)) return res;
  return res?.items ?? [];
}

export async function createVariant(
  storeId: string,
  productId: string,
  data: CreateVariantData,
): Promise<Variant> {
  return apiClient<Variant>(
    `/stores/${storeId}/products/${productId}/variants`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function updateVariant(
  storeId: string,
  productId: string,
  variantId: string,
  data: UpdateVariantData,
): Promise<Variant> {
  return apiClient<Variant>(
    `/stores/${storeId}/products/${productId}/variants/${variantId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );
}

export async function deleteVariant(
  storeId: string,
  productId: string,
  variantId: string,
): Promise<void> {
  return apiClient<void>(
    `/stores/${storeId}/products/${productId}/variants/${variantId}`,
    { method: "DELETE" },
  );
}

/**
 * Update product.options (the axis definitions). Stored as JSONB on
 * the product row; the variants endpoint validates each variant's
 * option_values against this list.
 */
export async function updateProductOptions(
  storeId: string,
  productId: string,
  options: ProductOption[],
): Promise<{ options: ProductOption[] }> {
  return apiClient<{ options: ProductOption[] }>(
    `/stores/${storeId}/products/${productId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ options }),
    },
  );
}
