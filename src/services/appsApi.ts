/**
 * Apps platform API service — Phase 6.
 *
 * Mirrors /stores/{store_id}/apps/* endpoints. Listing the catalog
 * does NOT require a store scope at the backend, but we keep it
 * store-scoped here for consistency (the hub always operates inside
 * a chosen store).
 */

import { apiClient } from "./api";
import type { SettingDefinition } from "@/features/theme-editor-v3/types";

export interface AppBlockSchema {
  type: string;
  name: string;
  schema?: Record<string, unknown>;
}

export interface AppCatalogEntry {
  slug: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  version: string;
  blocks: AppBlockSchema[];
  listing?: AppListing;
}

/** Listing metadata every app supplies; the detail page renders what exists. */
export interface AppListing {
  tagline?: string | null;
  developer?: {
    name?: string;
    url?: string;
    support_email?: string;
    is_first_party?: boolean;
  } | null;
  lockup_url?: string | null;
  screenshots?: { url?: string; locales?: Record<string, { caption?: string }> }[];
  highlights?: { locales?: Record<string, { text?: string }> }[];
  /** `locales[lang].tagline` */
  locales?: Record<string, { tagline?: string }>;
  /** `app_locales[lang].{name,description}` */
  app_locales?: Record<string, { name?: string; description?: string }>;
  /** The full tour. `highlights` is the pitch; this is the feature list. */
  features?: {
    icon?: string;
    locales?: Record<string, { title?: string; body?: string }>;
  }[];
  pricing?: { plan?: string; locales?: Record<string, { label?: string }> } | null;
  /** Language codes the app's own shopper-facing output supports. */
  languages?: string[];
  compatibility?: { locales?: Record<string, { text?: string }> } | null;
}

export interface AppInstallation extends AppCatalogEntry {
  is_enabled: boolean;
  settings: Record<string, unknown>;
  /** The app's own settings form, straight off its manifest. */
  settings_schema?: SettingDefinition[];
  /** Platform status — `suspended` means shoppers can't see it whatever
   *  `is_enabled` says. Surfaced so the hub can stop disagreeing with the
   *  storefront silently. */
  app_status?: string;
  /** enabled AND published. The single thing to show the merchant. */
  is_live?: boolean;
}

/**
 * NUMU Apps: NUMU's own optional features, installed from the catalog like
 * any app but living on their own hub pages. Behind `ff_numu_apps` their
 * sidebar entries follow the install (see useNavConfig). The API lists them
 * only when that flag is on.
 */
export const NUMU_APP_HOME: Record<string, string> = {
  whatsapp: "/whatsapp",
  inbox: "/inbox",
};

export async function listAppCatalog(
  storeId: string,
): Promise<AppCatalogEntry[]> {
  return apiClient<AppCatalogEntry[]>(`/stores/${storeId}/apps/catalog`);
}

export async function listAppInstallations(
  storeId: string,
): Promise<AppInstallation[]> {
  return apiClient<AppInstallation[]>(`/stores/${storeId}/apps`);
}

export async function installApp(
  storeId: string,
  slug: string,
): Promise<AppInstallation> {
  return apiClient<AppInstallation>(
    `/stores/${storeId}/apps/${encodeURIComponent(slug)}/install`,
    { method: "POST" },
  );
}

export async function updateAppSettings(
  storeId: string,
  slug: string,
  settings: Record<string, unknown>,
): Promise<AppInstallation> {
  return apiClient<AppInstallation>(
    `/stores/${storeId}/apps/${encodeURIComponent(slug)}/settings`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // The API merges by default; a replace is only correct when the caller
      // is submitting the whole form, which is what this function does.
      body: JSON.stringify({ settings, replace: true }),
    },
  );
}

export async function enableApp(
  storeId: string,
  slug: string,
): Promise<AppInstallation> {
  return apiClient<AppInstallation>(
    `/stores/${storeId}/apps/${encodeURIComponent(slug)}/enable`,
    { method: "POST" },
  );
}

export async function disableApp(
  storeId: string,
  slug: string,
): Promise<AppInstallation> {
  return apiClient<AppInstallation>(
    `/stores/${storeId}/apps/${encodeURIComponent(slug)}/disable`,
    { method: "POST" },
  );
}

export async function uninstallApp(
  storeId: string,
  slug: string,
): Promise<void> {
  await apiClient<{ slug: string }>(
    `/stores/${storeId}/apps/${encodeURIComponent(slug)}`,
    { method: "DELETE" },
  );
}
