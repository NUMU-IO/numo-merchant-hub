/**
 * Product-label definitions API — the store's reusable custom labels
 * (settings.product_labels). Built-in presets (New/Sale/Bestseller/
 * Limited) are hub-side constants, not stored server-side.
 *
 * The label ATTACHED to a product travels denormalized inside the
 * product's own `attributes.label` via productApi — these endpoints only
 * manage the reusable definitions shown in the ProductEditor dropdown.
 */

import { apiClient } from "./api";

export interface ProductLabel {
  /** Preset key ("new" | "sale" | …) or "custom:<slug>". */
  key: string;
  text_en: string;
  text_ar: string;
}

interface ProductLabelsResponse {
  labels: ProductLabel[];
}

export async function getProductLabels(
  storeId: string,
): Promise<ProductLabel[]> {
  const res = await apiClient<ProductLabelsResponse>(
    `/stores/${storeId}/settings/product-labels`,
  );
  return res.labels ?? [];
}

/** Full-replace: always send the complete custom-label list. */
export async function updateProductLabels(
  storeId: string,
  labels: ProductLabel[],
): Promise<ProductLabel[]> {
  const res = await apiClient<ProductLabelsResponse>(
    `/stores/${storeId}/settings/product-labels`,
    { method: "PUT", body: JSON.stringify({ labels }) },
  );
  return res.labels ?? [];
}
