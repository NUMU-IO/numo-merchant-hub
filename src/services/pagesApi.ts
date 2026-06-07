/**
 * Store content pages API (Phase 4.4b).
 *
 * Merchant-authored content pages (About, Contact, Shipping, …) managed at
 * Online Store → Pages and rendered on the storefront at `/pages/<handle>`.
 * Backend: NUMU-api `/stores/{id}/pages`. Bilingual title/body, SEO
 * overrides, publish toggle. Replaces the old `store.settings.pages` hack
 * with a real, RLS-scoped model that the `page_picker` setting can target.
 */

import { apiClient } from "./api";

export interface StorePage {
  id: string;
  store_id: string;
  handle: string;
  /** Bilingual title {en, ar}. */
  title: Record<string, string>;
  /** Bilingual rich-text body {en, ar}. */
  body: Record<string, string>;
  /** SEO overrides: {title:{en,ar}, description:{en,ar}}. */
  seo: Record<string, unknown>;
  is_published: boolean;
  template: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePageInput {
  handle: string;
  title?: Record<string, string>;
  body?: Record<string, string>;
  seo?: Record<string, unknown>;
  is_published?: boolean;
  template?: string;
}

export interface UpdatePageInput {
  title?: Record<string, string>;
  body?: Record<string, string>;
  seo?: Record<string, unknown>;
  is_published?: boolean;
  template?: string;
}

/** List all content pages for a store (published + drafts). */
export async function listPages(storeId: string): Promise<StorePage[]> {
  return apiClient<StorePage[]>(`/stores/${storeId}/pages/`);
}

/** Get a single page by handle. */
export async function getPage(storeId: string, handle: string): Promise<StorePage> {
  return apiClient<StorePage>(`/stores/${storeId}/pages/${handle}`);
}

/** Create a new page. */
export async function createPage(
  storeId: string,
  data: CreatePageInput,
): Promise<StorePage> {
  return apiClient<StorePage>(`/stores/${storeId}/pages/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Update (or create, if absent) a page by handle. */
export async function upsertPage(
  storeId: string,
  handle: string,
  data: UpdatePageInput,
): Promise<StorePage> {
  return apiClient<StorePage>(`/stores/${storeId}/pages/${handle}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** Delete a page by handle. */
export async function deletePage(storeId: string, handle: string): Promise<void> {
  await apiClient<void>(`/stores/${storeId}/pages/${handle}`, {
    method: "DELETE",
  });
}
