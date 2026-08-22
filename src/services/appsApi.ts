/**
 * Apps platform API service — Phase 6.
 *
 * Mirrors /stores/{store_id}/apps/* endpoints. Listing the catalog
 * does NOT require a store scope at the backend, but we keep it
 * store-scoped here for consistency (the hub always operates inside
 * a chosen store).
 */

import { apiClient } from "./api";

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
}

export interface AppInstallation extends AppCatalogEntry {
  is_enabled: boolean;
  settings: Record<string, unknown>;
}

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
      body: JSON.stringify({ settings }),
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
