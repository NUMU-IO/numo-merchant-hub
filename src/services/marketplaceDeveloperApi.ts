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

import { ApiError } from "@/lib/api-error";
import { apiClient, apiClientFormData } from "./api";

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
  | "changes_requested"
  | "rejected"
  | "published";

export interface ThemeScreenshot {
  url: string;
  alt?: string | null;
  viewport?: "desktop" | "mobile";
}

export interface MarketplaceTheme {
  id: string;
  name: string;
  name_ar: string | null;
  slug: string;
  description: string | null;
  description_ar: string | null;
  short_description: string | null;
  price_cents: number;
  currency: string;
  status: MarketplaceThemeStatus;
  thumbnail_url: string | null;
  preview_url: string | null;
  demo_store_url: string | null;
  tags: string[];
  supported_languages: string[];
  supported_features: Record<string, unknown>;
  author_name: string | null;
  screenshots: ThemeScreenshot[];
  feature_tags: string[];
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
  review_notes?: string | null;
  build_log?: string | null;
  lint_status?: string | null;
  lint_issues?: { issues?: { rule?: string; severity?: string; message?: string }[] } | null;
  certification_tier?: string | null;
}

export interface ListingInput {
  name?: string;
  name_ar?: string | null;
  slug?: string;
  description?: string | null;
  description_ar?: string | null;
  short_description?: string | null;
  thumbnail_url?: string | null;
  demo_store_url?: string | null;
  category?: string | null;
  tags?: string[];
  screenshots?: ThemeScreenshot[];
}

export interface VersionStatus {
  version_id: string;
  status: MarketplaceVersionStatus;
  build_log?: string | null;
  review_notes?: string | null;
  bundle_url?: string | null;
}

export async function listMyThemes(): Promise<MarketplaceTheme[]> {
  try {
    return await apiClient<MarketplaceTheme[]>("/marketplace/developer/themes");
  } catch (err) {
    // Only approved partners reach these routes; everyone else gets a 404,
    // which for this list means "you have no submissions".
    if (err instanceof ApiError && err.status === 404) return [];
    throw err;
  }
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

export async function createListing(body: ListingInput): Promise<MarketplaceTheme> {
  return apiClient<MarketplaceTheme>("/marketplace/developer/themes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateListing(
  themeId: string,
  body: ListingInput,
): Promise<MarketplaceTheme> {
  return apiClient<MarketplaceTheme>(
    `/marketplace/developer/themes/${encodeURIComponent(themeId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

/**
 * Upload a theme ZIP and submit it for review: the same two calls
 * `numu-theme submit` makes.
 */
export async function submitThemeBundle(
  themeId: string,
  file: File,
  versionString: string,
  releaseNotes: string,
): Promise<VersionStatus> {
  const form = new FormData();
  form.append("file", file);
  const upload = await apiClientFormData<{ source_zip_path: string }>(
    "/themes/upload?queue_build=false",
    form,
  );
  return apiClient<VersionStatus>(
    `/marketplace/developer/themes/${encodeURIComponent(themeId)}/versions`,
    {
      method: "POST",
      body: JSON.stringify({
        version_string: versionString,
        source_zip_path: upload.source_zip_path,
        release_notes: releaseNotes || null,
      }),
    },
  );
}

export async function publishVersion(versionId: string): Promise<VersionStatus> {
  return apiClient<VersionStatus>(
    `/marketplace/developer/versions/${encodeURIComponent(versionId)}/publish`,
    { method: "POST" },
  );
}
