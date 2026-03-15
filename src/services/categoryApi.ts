/**
 * Category API service for the merchant dashboard.
 */

import { apiClient } from "./api";

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
}

export interface UpdateCategoryData {
  name?: string;
  slug?: string;
  description?: string | null;
  image_url?: string | null;
  parent_id?: string | null;
  position?: number;
  is_active?: boolean;
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
