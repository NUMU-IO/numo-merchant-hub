/**
 * Marketplace developer-side API.
 *
 * Wraps the `/marketplace/developer/*` and store-scoped developer-install
 * endpoints. Used by the "My Theme Submissions" page in the merchant
 * hub so developers (who are also merchants) can:
 *
 *   - List their marketplace listings + statuses.
 *   - List versions per theme + each version's build/review status.
 *   - Install a theme on one of their own stores even when the listing
 *     hasn't been published — bypassing the public install gate.
 *
 * All endpoints require JWT auth; `apiClient` handles cookie/CSRF.
 */

import { apiClient } from "./api";

export type MarketplaceThemeStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "suspended";

export type MarketplaceVersionStatus =
  | "pending_build"
  | "building"
  | "build_failed"
  | "pending_review"
  | "approved"
  | "rejected"
  | "published";

export interface MarketplaceTheme {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price_cents: number;
  currency: string;
  status: MarketplaceThemeStatus;
  thumbnail_url: string | null;
  preview_url: string | null;
  category: string | null;
  install_count: number;
  average_rating: number;
  review_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface MarketplaceVersion {
  id: string;
  version_string: string;
  status: MarketplaceVersionStatus;
  release_notes: string | null;
  bundle_url: string | null;
  css_url: string | null;
  checksum: string | null;
  created_at: string | null;
}

export interface VersionStatus {
  version_id: string;
  status: MarketplaceVersionStatus;
  build_log?: string | null;
  review_notes?: string | null;
  bundle_url?: string | null;
}

export async function listMyThemes(): Promise<MarketplaceTheme[]> {
  return apiClient<MarketplaceTheme[]>("/marketplace/developer/themes");
}

export async function listMyVersions(
  themeId: string,
): Promise<MarketplaceVersion[]> {
  return apiClient<MarketplaceVersion[]>(
    `/marketplace/developer/themes/${encodeURIComponent(themeId)}/versions`,
  );
}

export async function getVersionStatus(
  versionId: string,
): Promise<VersionStatus> {
  return apiClient<VersionStatus>(
    `/marketplace/developer/versions/${encodeURIComponent(versionId)}/status`,
  );
}

export interface DeveloperInstallResult {
  installation_id: string;
  marketplace_theme_id: string;
  marketplace_version_id: string;
  version_string: string;
  version_status: MarketplaceVersionStatus;
  is_active: boolean;
  is_developer_install: boolean;
}

/**
 * Install the developer's own theme on a store they own. Skips the
 * "must be published" gate that the public install endpoint enforces.
 */
export async function developerInstallTheme(
  storeId: string,
  themeId: string,
): Promise<DeveloperInstallResult> {
  return apiClient<DeveloperInstallResult>(
    `/stores/${encodeURIComponent(storeId)}/marketplace/developer-install/${encodeURIComponent(themeId)}`,
    { method: "POST" },
  );
}

/**
 * Activate a previously-installed marketplace theme on the store. Used
 * after `developerInstallTheme` so the merchant flips the install live.
 */
export async function activateTheme(
  storeId: string,
  themeId: string,
): Promise<unknown> {
  return apiClient<unknown>(
    `/stores/${encodeURIComponent(storeId)}/marketplace/activate`,
    {
      method: "POST",
      body: JSON.stringify({ marketplace_theme_id: themeId }),
    },
  );
}
