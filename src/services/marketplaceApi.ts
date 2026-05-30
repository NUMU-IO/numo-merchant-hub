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

/**
 * One screenshot row from the admin metadata editor. Viewport drives
 * whether the detail page renders it desktop-shaped or mobile-shaped.
 */
export interface ScreenshotOut {
  url: string;
  alt: string | null;
  viewport: string;
}

/**
 * One highlight tile on the detail page. Body is plain text; video_url
 * is optional and triggers a poster-card layout when present.
 */
export interface HighlightOut {
  title: string;
  body: string;
  video_url: string | null;
}

/**
 * Catalog card shape — what the merchant sees in the grid. Mirrors
 * `MarketplaceThemeOut` in `NUMU-api/src/api/v1/schemas/tenant/marketplace.py`.
 *
 * The card fields (screenshots, feature_tags, supported_languages,
 * author_name, etc.) live at this level so the filter rail can apply
 * client-side filtering over a single catalog GET — no second round-trip
 * to the detail endpoint for each card.
 */
export interface CatalogTheme {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  price_cents: number;
  currency: string;
  status: string;
  category: string | null;
  preview_url: string | null;
  thumbnail_url: string | null;
  demo_store_url: string | null;
  tags: string[];
  supported_languages: string[];
  supported_features: Record<string, unknown>;
  install_count: number;
  average_rating: number;
  review_count: number;
  /** Admin-curated metadata (Session A 2026-05-27, file 04 §6 + §8). */
  author_name: string | null;
  screenshots: ScreenshotOut[];
  feature_tags: string[];
  /** Pre-Session-A aspirational fields kept for backwards compat. */
  required_plan?: string | null;
  published_at?: string | null;
  /** Convenience aliases used by some old callers — backend ships
   *  `average_rating` / `install_count`, these mirror them. */
  rating?: number | null;
}

export interface CatalogListResponse {
  themes: CatalogTheme[];
  page: number;
  per_page: number;
  total: number;
}

/**
 * One published version snapshot. Shape matches the dict the backend
 * embeds under `latest_version` in `get_theme_detail`. Includes the
 * artifacts needed by the storefront preview path.
 */
export interface LatestVersionMeta {
  id: string;
  version_string: string;
  release_notes: string | null;
  bundle_url: string | null;
  css_url: string | null;
  settings_schema: unknown;
  section_schemas: unknown;
  size_bytes: number | null;
}

/**
 * Detail page payload. Inherits all the catalog fields and adds the
 * detail-only extras (highlights, latest_version, author_url).
 * Mirrors `ThemeDetailResponse` in the backend.
 */
export interface ThemeDetailResponse extends CatalogTheme {
  latest_version: LatestVersionMeta | null;
  author_url: string | null;
  highlights: HighlightOut[];
}

// ─── Installed types ────────────────────────────────────────────────────────

/**
 * Shape of GET /stores/{id}/marketplace/installed — the actual JSON the
 * backend ships, with nested `theme` + `version` objects.
 *
 * The previous flat shape this interface used was aspirational, not
 * what the API actually sent — fixed in Session D after a runtime
 * crash on the Library tab. See SESSION-D-COMPLETE.md B-17 for the
 * trail.
 */
export interface InstalledTheme {
  installation_id: string;
  is_active: boolean;
  installed_at: string;
  theme: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    short_description: string | null;
    price_cents: number;
    currency: string;
    status: string;
    thumbnail_url: string | null;
    preview_url: string | null;
    demo_store_url: string | null;
    tags: string[];
    category: string | null;
    supported_languages: string[];
    supported_features: Record<string, unknown>;
    install_count: number;
    average_rating: number;
    review_count: number;
    author_name?: string | null;
    screenshots?: Array<{ url: string; alt: string | null; viewport: string }>;
    feature_tags?: string[];
  } | null;
  version: {
    id: string;
    version_string: string;
    bundle_url: string | null;
    css_url: string | null;
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

// ─── Snapshots (Session F, file 06 §9) ───────────────────────────────────────

/**
 * One theme snapshot row — the merchant-scoped mirror of the admin
 * snapshot browser. Append-only audit trail; `restored_at` is the only
 * mutable field (stamped by the future restore endpoint, which isn't
 * built yet — Restore is disabled-with-tooltip in the UI).
 *
 * Shape matches `MerchantSnapshotItem` in
 * `NUMU-api/src/api/v1/routes/marketplace/store_install.py`.
 */
export interface ThemeSnapshot {
  id: string;
  store_id: string;
  theme_id: string | null;
  theme_version_id: string | null;
  reason: string;
  created_at: string;
  restored_at: string | null;
  section_count: number;
  section_group_count: number;
  theme_name: string | null;
}

export interface SnapshotListResponse {
  snapshots: ThemeSnapshot[];
}

/**
 * List the calling merchant's own theme snapshots (read-only). Backed by
 * `GET /stores/{id}/marketplace/snapshots`, gated by store ownership +
 * RLS so a merchant can only ever read their own store's rows.
 */
export function listSnapshots(
  storeId: string,
  limit = 20,
): Promise<SnapshotListResponse> {
  return apiClient<SnapshotListResponse>(
    `${STORE_BASE(storeId)}/snapshots?limit=${limit}`,
  );
}
