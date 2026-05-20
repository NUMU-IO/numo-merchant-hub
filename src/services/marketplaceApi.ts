/**
 * Marketplace merchant-side API.
 *
 * Wraps the storefront-merchant catalog + install endpoints exposed by
 * NUMU-api:
 *
 *   PUBLIC (unauth) — anyone can browse:
 *     GET  /marketplace/catalog/themes              — paginated catalog
 *     GET  /marketplace/catalog/themes/{slug}       — full theme + versions
 *
 *   STORE-SCOPED (requires ownership of store_id):
 *     GET    /stores/{store_id}/marketplace/installed       — what's installed
 *     POST   /stores/{store_id}/marketplace/install         — install latest
 *     POST   /stores/{store_id}/marketplace/activate        — switch active
 *     DELETE /stores/{store_id}/marketplace/uninstall/{id}  — soft uninstall
 *     GET    /stores/{store_id}/marketplace/upgrades        — list updates
 *     POST   /stores/{store_id}/marketplace/upgrade/{id}    — apply update
 *
 * The catalog routes are anonymous; the rest go through the standard
 * cookie+CSRF auth flow in `apiClient`. This file is separate from
 * `marketplaceDeveloperApi.ts` because the audiences differ: the
 * developer file is for theme authors managing their submissions; this
 * one is for merchants browsing and installing.
 */

import { apiClient } from "./api";

// ─── Catalog types ──────────────────────────────────────────────────────────

export interface CatalogTheme {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  price_cents: number;
  category: string | null;
  preview_url: string | null;
  thumbnail_url: string | null;
  required_plan: string | null;
  published_at: string | null;
  /** Aggregate review score, if any. */
  rating?: number | null;
  install_count?: number | null;
}

export interface CatalogListResponse {
  themes: CatalogTheme[];
  page: number;
  per_page: number;
  total: number;
}

export interface ThemeVersion {
  id: string;
  version_string: string;
  release_notes: string | null;
  published_at: string | null;
  bundle_url: string | null;
  css_url: string | null;
}

export interface ThemeDetailResponse extends CatalogTheme {
  /** All published versions, newest first. */
  versions: ThemeVersion[];
  /** Author display name + handle. */
  developer?: {
    id: string;
    name: string;
    handle?: string | null;
  };
  /** Optional gallery for the marketing page. */
  screenshots?: string[];
}

// ─── Installed types ────────────────────────────────────────────────────────

export interface InstalledTheme {
  marketplace_theme_id: string;
  name: string;
  slug: string;
  installed_version_id: string;
  installed_version_string: string;
  /** True if this is the currently-active theme on the store. */
  active: boolean;
  /** Bundle URL active right now (matches the storefront's external_theme). */
  bundle_url: string | null;
  css_url: string | null;
  installed_at: string;
  /** Population only when the merchant's pinned version isn't the latest. */
  upgrade_available?: {
    latest_version_id: string;
    latest_version_string: string;
    latest_published_at: string;
    release_notes: string | null;
  } | null;
}

export interface InstalledListResponse {
  installed: InstalledTheme[];
}

export interface InstallationResponse {
  installed: boolean;
  marketplace_theme_id: string;
  installed_version_id: string;
  installed_version_string: string;
  bundle_url: string | null;
  css_url: string | null;
}

// ─── Catalog browsing ───────────────────────────────────────────────────────

/**
 * List published marketplace themes. Anonymous endpoint — no auth
 * required. Pagination defaults to 20 per page.
 */
export function browseMarketplace(
  opts: { page?: number; per_page?: number; category?: string } = {},
): Promise<CatalogListResponse> {
  const qs = new URLSearchParams();
  if (opts.page) qs.set("page", String(opts.page));
  if (opts.per_page) qs.set("per_page", String(opts.per_page));
  if (opts.category) qs.set("category", opts.category);
  const query = qs.toString();
  return apiClient<CatalogListResponse>(
    `/marketplace/catalog/themes${query ? `?${query}` : ""}`,
  );
}

/** Detail page for a single theme. */
export function getThemeDetail(slug: string): Promise<ThemeDetailResponse> {
  return apiClient<ThemeDetailResponse>(
    `/marketplace/catalog/themes/${encodeURIComponent(slug)}`,
  );
}

// ─── Store install / activate / uninstall / upgrade ─────────────────────────

const STORE_BASE = (storeId: string) =>
  `/stores/${storeId}/marketplace`;

/** What's installed on a given store. */
export function listInstalled(storeId: string): Promise<InstalledListResponse> {
  return apiClient<InstalledListResponse>(`${STORE_BASE(storeId)}/installed`);
}

/**
 * Install (but don't activate) a marketplace theme. The merchant
 * activates it via the customizer or a follow-up call to
 * `activateTheme()`.
 */
export function installTheme(
  storeId: string,
  marketplaceThemeId: string,
): Promise<InstallationResponse> {
  return apiClient<InstallationResponse>(
    `${STORE_BASE(storeId)}/install`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketplace_theme_id: marketplaceThemeId }),
    },
  );
}

/**
 * Activate an installed theme. Side effects on the backend:
 * deactivates any other active install, seeds the V3 draft from the
 * version's presets (only if the store doesn't already have a draft),
 * and triggers Next.js cache invalidation.
 */
export function activateTheme(
  storeId: string,
  marketplaceThemeId: string,
): Promise<InstallationResponse> {
  return apiClient<InstallationResponse>(
    `${STORE_BASE(storeId)}/activate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketplace_theme_id: marketplaceThemeId }),
    },
  );
}

/**
 * Soft-uninstall a theme. The underlying customization rows are kept
 * so a later reinstall restores the merchant's prior settings without
 * forcing them to redo the work.
 */
export function uninstallTheme(
  storeId: string,
  marketplaceThemeId: string,
): Promise<{ uninstalled: true; marketplace_theme_id: string }> {
  return apiClient<{ uninstalled: true; marketplace_theme_id: string }>(
    `${STORE_BASE(storeId)}/uninstall/${marketplaceThemeId}`,
    { method: "DELETE" },
  );
}

export interface UpgradeAvailability {
  marketplace_theme_id: string;
  name: string;
  installed_version_id: string;
  installed_version_string: string;
  latest_version_id: string;
  latest_version_string: string;
  latest_published_at: string;
  release_notes: string | null;
}

/** List themes that have a newer published version available. */
export function listUpgrades(
  storeId: string,
): Promise<{ upgrades: UpgradeAvailability[] }> {
  return apiClient<{ upgrades: UpgradeAvailability[] }>(
    `${STORE_BASE(storeId)}/upgrades`,
  );
}

/**
 * Pin an installed marketplace theme to its latest published version
 * and reactivate. Existing customization survives — the activate path
 * prefers the merchant's draft over fresh presets when both exist.
 *
 * "Rollback" is implemented as `installTheme(...)` + `activateTheme(...)`
 * against a specific older version_id (the backend's activate-by-
 * version_id endpoint is in the next iteration; for now, rollback
 * goes through the install flow with the older version).
 */
export function upgradeTheme(
  storeId: string,
  marketplaceThemeId: string,
): Promise<InstallationResponse> {
  return apiClient<InstallationResponse>(
    `${STORE_BASE(storeId)}/upgrade/${marketplaceThemeId}`,
    { method: "POST" },
  );
}
