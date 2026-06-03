/**
 * Store navigation menus API (Phase 2).
 *
 * Store-level link lists managed at Online Store → Navigation, picked into
 * theme header/footer via a `link_list` setting. Backend: NUMU-api
 * `/stores/{id}/menus`. Items are nested (depth <= 3) with pre-resolved URLs.
 */

import { apiClient } from "./api";

export interface MenuItem {
  /** Stable client id (kept across edits). */
  id?: string;
  /** Bilingual label. */
  label: { en?: string; ar?: string };
  /** Resolved destination URL/path (from the link picker). */
  url: string;
  /** Semantic type: home|collection|product|page|http|catalog|search|link. */
  type?: string;
  resource_id?: string | null;
  /** Nested sub-items (depth <= 3). */
  children: MenuItem[];
}

export interface Menu {
  id: string;
  store_id: string;
  handle: string;
  title: Record<string, string>;
  items: MenuItem[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateMenuInput {
  handle: string;
  title?: Record<string, string>;
  items?: MenuItem[];
  is_active?: boolean;
}

export interface UpdateMenuInput {
  title?: Record<string, string>;
  items?: MenuItem[];
  is_active?: boolean;
}

/** List all menus for a store (header `main-menu`, `footer`, + custom). */
export async function listMenus(storeId: string): Promise<Menu[]> {
  return apiClient<Menu[]>(`/stores/${storeId}/menus/`);
}

/** Get a single menu by handle. */
export async function getMenu(storeId: string, handle: string): Promise<Menu> {
  return apiClient<Menu>(`/stores/${storeId}/menus/${handle}`);
}

/** Create a new menu. */
export async function createMenu(
  storeId: string,
  data: CreateMenuInput,
): Promise<Menu> {
  return apiClient<Menu>(`/stores/${storeId}/menus/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Update (or create, if absent) a menu by handle. */
export async function upsertMenu(
  storeId: string,
  handle: string,
  data: UpdateMenuInput,
): Promise<Menu> {
  return apiClient<Menu>(`/stores/${storeId}/menus/${handle}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** Delete a menu by handle. */
export async function deleteMenu(storeId: string, handle: string): Promise<void> {
  await apiClient<void>(`/stores/${storeId}/menus/${handle}`, {
    method: "DELETE",
  });
}
