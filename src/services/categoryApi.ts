/**
 * Category API service for the merchant dashboard.
 */

import { apiClient } from "./api";
import { compressImage } from "@/lib/image-compression";

export interface Category {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  position: number;
  is_active: boolean;
  product_count: number;
  extra_data: Record<string, unknown> | null;
  /** Shopify-style alternate-template key. `"wholesale"` selects the theme's
   *  `collection.wholesale` template variant; `null` = default `collection`. */
  template_suffix?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryData {
  name: string;
  slug?: string;
  description?: string | null;
  image_url?: string | null;
  parent_id?: string | null;
  position?: number;
  is_active?: boolean;
  extra_data?: Record<string, unknown>;
  /** Alternate-template key (e.g. `"wholesale"` → `collection.wholesale`).
   *  `null`/omitted = the default `collection` template. */
  template_suffix?: string | null;
}

export interface UpdateCategoryData {
  name?: string;
  slug?: string;
  description?: string | null;
  image_url?: string | null;
  parent_id?: string | null;
  position?: number;
  is_active?: boolean;
  extra_data?: Record<string, unknown>;
  /** Alternate-template key. `null` clears it (back to `collection`); a string
   *  selects `collection.<suffix>`. */
  template_suffix?: string | null;
}

export async function listCategories(
  storeId: string,
  includeInactive = true
): Promise<Category[]> {
  return apiClient<Category[]>(
    `/stores/${storeId}/categories/?include_inactive=${includeInactive}`
  );
}

export async function createCategory(
  storeId: string,
  data: CreateCategoryData
): Promise<Category> {
  return apiClient<Category>(`/stores/${storeId}/categories/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCategory(
  storeId: string,
  categoryId: string,
  data: UpdateCategoryData
): Promise<Category> {
  return apiClient<Category>(
    `/stores/${storeId}/categories/${categoryId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

export async function deleteCategory(
  storeId: string,
  categoryId: string
): Promise<void> {
  return apiClient<void>(
    `/stores/${storeId}/categories/${categoryId}`,
    { method: "DELETE" }
  );
}

export async function uploadCategoryImage(
  storeId: string,
  categoryId: string,
  file: File
): Promise<Category> {
  const prepared = await compressImage(file);
  const formData = new FormData();
  formData.append("file", prepared);
  return apiClient<Category>(
    `/stores/${storeId}/categories/${categoryId}/image`,
    { method: "POST", body: formData }
  );
}
