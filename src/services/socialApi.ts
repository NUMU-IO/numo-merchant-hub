/**
 * Social Import API service.
 * Handles social account connections, post fetching, and URL-based imports.
 */

import { apiClient } from "./api";

// ---------------------------------------------------------------------------
// Types — match backend API responses
// ---------------------------------------------------------------------------

export interface SocialConnectionResponse {
  id: string;
  platform: "instagram" | "facebook";
  handle: string;
  followers: number;
  posts_count: number;
  status: string;
  last_synced_at: string | null;
}

export interface SocialPostResponse {
  platform_post_id: string;
  image_url: string | null;
  caption: string | null;
  likes: number;
  comments: number;
  posted_at: string | null;
  imported: boolean;
  suggested_name: string | null;
  suggested_name_ar: string | null;
  suggested_price: number | null;
}

export interface SocialPostsListResponse {
  posts: SocialPostResponse[];
  next_cursor: string | null;
}

export interface ImportPostsResponse {
  imported: number;
  product_ids: string[];
  errors: string[];
}

export interface UrlImportResult {
  url: string;
  product_id: string | null;
  product_name: string | null;
  images_count: number;
  error: string | null;
}

export interface ImportFromUrlResponse {
  imported: number;
  results: UrlImportResult[];
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/** List all social connections for a store. */
export async function listConnections(
  storeId: string,
): Promise<SocialConnectionResponse[]> {
  return apiClient<SocialConnectionResponse[]>(
    `/stores/${storeId}/social/connections`,
  );
}

/** Initiate OAuth — returns an auth_url to redirect the merchant to. */
export async function getAuthUrl(
  storeId: string,
  platform: "instagram" | "facebook",
  redirectUri?: string,
): Promise<{ auth_url: string }> {
  return apiClient<{ auth_url: string }>(
    `/stores/${storeId}/social/connections`,
    {
      method: "POST",
      body: JSON.stringify({
        platform,
        redirect_uri: redirectUri || `${window.location.origin}/social/callback`,
      }),
    },
  );
}

/** Complete OAuth connection with the code returned by Meta. */
export async function completeConnection(
  storeId: string,
  platform: "instagram" | "facebook",
  oauthCode: string,
  redirectUri?: string,
): Promise<SocialConnectionResponse> {
  return apiClient<SocialConnectionResponse>(
    `/stores/${storeId}/social/connections`,
    {
      method: "POST",
      body: JSON.stringify({
        platform,
        oauth_code: oauthCode,
        redirect_uri: redirectUri || `${window.location.origin}/social/callback`,
      }),
    },
  );
}

/** Disconnect a social account. */
export async function disconnectAccount(
  storeId: string,
  connectionId: string,
): Promise<void> {
  await apiClient<{ message: string }>(
    `/stores/${storeId}/social/connections/${connectionId}`,
    { method: "DELETE" },
  );
}

/** Fetch posts from a connected social account. */
export async function fetchPosts(
  storeId: string,
  connectionId: string,
  limit = 50,
  cursor?: string,
): Promise<SocialPostsListResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return apiClient<SocialPostsListResponse>(
    `/stores/${storeId}/social/connections/${connectionId}/posts?${params}`,
  );
}

/** Import connected-account posts as draft products. */
export async function importPosts(
  storeId: string,
  connectionId: string,
  postIds: string[],
): Promise<ImportPostsResponse> {
  return apiClient<ImportPostsResponse>(
    `/stores/${storeId}/social/connections/${connectionId}/import`,
    {
      method: "POST",
      body: JSON.stringify({ post_ids: postIds }),
    },
  );
}

/** Import products from Instagram/Facebook URLs (no OAuth required). */
export async function importFromUrl(
  storeId: string,
  urls: string[],
): Promise<ImportFromUrlResponse> {
  return apiClient<ImportFromUrlResponse>(
    `/stores/${storeId}/social/import-url`,
    {
      method: "POST",
      body: JSON.stringify({ urls }),
    },
  );
}
