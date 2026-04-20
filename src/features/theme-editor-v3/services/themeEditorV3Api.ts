/**
 * Theme Editor V3 — API Service.
 *
 * Communicates with the backend V3 theme editor endpoints.
 * All endpoints live under `/stores/{storeId}/themes/v3/editor/*`.
 *
 * This service is additive — it does NOT modify or replace the existing
 * themeApi.ts service. The old V2 endpoints remain fully functional.
 */

import { apiClient } from "@/services/api";
import type {
  ThemeSettingsV3,
  ThemeSchemaBundle,
  AutosaveResponse,
  PublishResponse,
  VersionListResponse,
  CustomizationVersion,
} from "../types";

const BASE = (storeId: string) => `/stores/${storeId}/themes/v3/editor`;

// ─── Draft (auto-save) ─────────────────────────────────────────────────────

/**
 * Fetch the current V3 draft. If no V3 data exists yet, the backend
 * runs resolve_theme_settings() to normalize V1/V2 → V3 on the fly.
 */
export function fetchDraftV3(storeId: string): Promise<ThemeSettingsV3> {
  return apiClient<ThemeSettingsV3>(`${BASE(storeId)}/draft`);
}

/**
 * Auto-save the V3 draft. Uses Dual-Write: writes to both
 * draft_customization_v3 AND draft_customization (legacy).
 * Debounced on the client side (2s), but the backend accepts any cadence.
 */
export function saveDraftV3(
  storeId: string,
  payload: ThemeSettingsV3,
): Promise<AutosaveResponse> {
  return apiClient<AutosaveResponse>(`${BASE(storeId)}/draft`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// ─── Publish ────────────────────────────────────────────────────────────────

/**
 * Publish the current V3 draft to the live storefront.
 * Uses Dual-Write: writes to both customization_v3 AND theme_settings (legacy).
 * Creates a version history entry with source="publish".
 */
export function publishV3(storeId: string): Promise<PublishResponse> {
  return apiClient<PublishResponse>(`${BASE(storeId)}/publish`, {
    method: "POST",
  });
}

// ─── Version History ────────────────────────────────────────────────────────

/**
 * Fetch paginated version history for the store's theme customization.
 */
export function fetchVersionsV3(
  storeId: string,
  page: number = 1,
  pageSize: number = 20,
): Promise<VersionListResponse> {
  return apiClient<VersionListResponse>(
    `${BASE(storeId)}/versions?page=${page}&page_size=${pageSize}`,
  );
}

/**
 * Restore a specific version as the current draft.
 * Creates a new version entry with source="restore".
 */
export function restoreVersionV3(
  storeId: string,
  versionId: string,
): Promise<{ status: string; restored_version: number }> {
  return apiClient<{ status: string; restored_version: number }>(
    `${BASE(storeId)}/versions/${versionId}/restore`,
    { method: "POST" },
  );
}

// ─── Schemas ────────────────────────────────────────────────────────────────

/**
 * Fetch the V3 theme schema bundle for the store's active theme.
 * For built-in themes: reads from filesystem.
 * For BYOT/marketplace themes: reads from the themes table JSONB columns.
 */
export function fetchSchemasV3(storeId: string): Promise<ThemeSchemaBundle> {
  return apiClient<ThemeSchemaBundle>(`${BASE(storeId)}/schemas`);
}

// ─── Initialize ─────────────────────────────────────────────────────────────

/**
 * Initialize V3 customization for a store that has never used V3.
 * The backend runs generate_initial_v3_customization() and returns the result.
 * This is idempotent — if V3 data already exists, it returns the existing draft.
 */
export function initializeV3(storeId: string): Promise<ThemeSettingsV3> {
  return apiClient<ThemeSettingsV3>(`${BASE(storeId)}/initialize`, {
    method: "POST",
  });
}

// ─── Discard Draft ──────────────────────────────────────────────────────────

/**
 * Discard the current V3 draft and revert to the last published version.
 */
export function discardDraftV3(storeId: string): Promise<ThemeSettingsV3> {
  return apiClient<ThemeSettingsV3>(`${BASE(storeId)}/draft/discard`, {
    method: "POST",
  });
}
