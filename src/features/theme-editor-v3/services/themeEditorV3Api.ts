/**
 * Theme Editor V3 — API Service.
 *
 * Communicates with the backend V3 theme editor endpoints.
 * All endpoints live under `/stores/{storeId}/themes/v3/editor/*`.
 *
 * Routes match the backend exactly (NUMU-api PR #204):
 *   GET  /draft               — current draft (or normalized legacy)
 *   PUT  /autosave            — autosave a V3 payload (debounced from client)
 *   POST /publish             — publish draft, dual-write, revalidate
 *   POST /discard             — drop the draft, revert to published
 *   GET  /versions            — paginated version history
 *   POST /versions/{id}/restore — bring an older version back into the draft
 *   GET  /resolve             — published settings (no draft) for SDKs
 *   GET  /schemas             — section/block schemas for the active theme
 *
 * This service is additive — it does NOT modify or replace the existing
 * themeApi.ts service. The old V2 endpoints remain fully functional.
 */

import { apiClient } from "@/services/api";
import type {
  ThemeSettingsV3,
  ThemeSchemaBundle,
  AutosaveDraftResponse,
  PublishDraftResponse,
  DiscardDraftResponse,
  VersionListResponse,
  RestoreVersionResponse,
} from "../types";

const BASE = (storeId: string) => `/stores/${storeId}/themes/v3/editor`;

// Every editor request opts out of the default 401 → window.location
// redirect. The customizer holds a draft + undo stack in memory; a
// hard navigation throws all of that away mid-session. By opting out,
// 401s surface as ApiError(401, ...) and the store renders an inline
// "re-login" banner instead — the in-flight customization survives.
const EDITOR_OPTS = { noAutoRedirect401: true } as const;

// ─── Draft ───────────────────────────────────────────────────────────────────

/**
 * Fetch the current V3 draft. If no V3 data exists yet, the backend
 * normalizes V1/V2 → V3 on the fly via resolve_theme_settings(). When
 * there is no active theme at all, the backend returns `{}`.
 */
export function fetchDraftV3(
  storeId: string,
  onEtag?: (etag: string | null) => void,
): Promise<ThemeSettingsV3 | Record<string, never>> {
  return apiClient<ThemeSettingsV3 | Record<string, never>>(
    `${BASE(storeId)}/draft`,
    undefined,
    {
      ...EDITOR_OPTS,
      onResponse: onEtag ? (res) => onEtag(res.headers.get("ETag")) : undefined,
    },
  );
}

/**
 * Autosave V3 draft with Dual-Write to legacy columns.
 * Body shape matches AutosaveDraftRequest on the backend.
 */
export interface SaveDraftOptions {
  changeSummary?: string;
  /** Current draft ETag for optimistic concurrency. Sent as `If-Match` and
   *  `expected_etag`; on mismatch the backend returns 409 (`stale_etag`)
   *  with the server's current etag + draft so we never silently clobber. */
  expectedEtag?: string | null;
  /** Receives the new ETag echoed by a successful save. */
  onEtag?: (etag: string | null) => void;
}

export function saveDraftV3(
  storeId: string,
  payload: ThemeSettingsV3,
  opts?: SaveDraftOptions,
): Promise<AutosaveDraftResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts?.expectedEtag) headers["If-Match"] = opts.expectedEtag;
  return apiClient<AutosaveDraftResponse>(
    `${BASE(storeId)}/autosave`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        payload,
        change_summary: opts?.changeSummary,
        expected_etag: opts?.expectedEtag ?? undefined,
      }),
    },
    {
      ...EDITOR_OPTS,
      onResponse: opts?.onEtag
        ? (res) => opts.onEtag!(res.headers.get("ETag"))
        : undefined,
    },
  );
}

// ─── Publish ─────────────────────────────────────────────────────────────────

/**
 * Publish the current V3 draft. Triggers Next.js cache invalidation.
 *
 * `versionLabel` is an optional merchant-supplied tag ("Spring sale 2026")
 * stamped onto the resulting `theme_customization_versions` row so it
 * shows up in Version History as a named entry. Backend is expected to
 * accept the body — if it doesn't yet (rolling deploy window), the
 * label is dropped server-side and the publish still succeeds.
 */
export function publishV3(
  storeId: string,
  versionLabel?: string,
  /** Receives the NEW ETag echoed by a successful publish, so the store can
   *  refresh its draft etag and the next edit/save isn't rejected as stale. */
  onEtag?: (etag: string | null) => void,
): Promise<PublishDraftResponse> {
  return apiClient<PublishDraftResponse>(
    `${BASE(storeId)}/publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: versionLabel
        ? JSON.stringify({ version_label: versionLabel })
        : undefined,
    },
    {
      ...EDITOR_OPTS,
      onResponse: onEtag ? (res) => onEtag(res.headers.get("ETag")) : undefined,
    },
  );
}

/** Discard the V3 draft and revert to the published state. */
export function discardDraftV3(
  storeId: string,
): Promise<DiscardDraftResponse> {
  return apiClient<DiscardDraftResponse>(
    `${BASE(storeId)}/discard`,
    { method: "POST" },
    EDITOR_OPTS,
  );
}

// ─── Version History ─────────────────────────────────────────────────────────

/**
 * Fetch paginated version history. Backend uses `per_page` (not `page_size`).
 */
export function fetchVersionsV3(
  storeId: string,
  page: number = 1,
  perPage: number = 20,
): Promise<VersionListResponse> {
  const qs = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  return apiClient<VersionListResponse>(
    `${BASE(storeId)}/versions?${qs.toString()}`,
    undefined,
    EDITOR_OPTS,
  );
}

/**
 * Restore a previous version as the current draft. Backend returns the
 * restored V3 payload under `draft`.
 */
export function restoreVersionV3(
  storeId: string,
  versionId: string,
): Promise<RestoreVersionResponse> {
  return apiClient<RestoreVersionResponse>(
    `${BASE(storeId)}/versions/${versionId}/restore`,
    { method: "POST" },
    EDITOR_OPTS,
  );
}

/**
 * Fetch a specific version's payload for read-only inspection (used by
 * the diff view).
 *
 * Backend contract: GET /versions/{id} → { payload: ThemeSettingsV3 }.
 * If the endpoint isn't deployed yet, callers must handle the 404 — we
 * surface "diff requires latest backend" rather than crash.
 */
export interface VersionPayloadResponse {
  payload: ThemeSettingsV3;
}

export function fetchVersionPayloadV3(
  storeId: string,
  versionId: string,
): Promise<VersionPayloadResponse> {
  return apiClient<VersionPayloadResponse>(
    `${BASE(storeId)}/versions/${versionId}`,
    undefined,
    EDITOR_OPTS,
  );
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

/**
 * Fetch the active theme's settings/section/block schemas.
 * For built-in themes: from `theme.settings_schema` / `theme.section_schemas`.
 * For BYOT themes: from the marketplace_theme_versions row.
 */
export function fetchSchemasV3(storeId: string): Promise<ThemeSchemaBundle> {
  return apiClient<ThemeSchemaBundle>(
    `${BASE(storeId)}/schemas`,
    undefined,
    EDITOR_OPTS,
  );
}
