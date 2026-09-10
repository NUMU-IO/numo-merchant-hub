/**
 * Sector presets + capabilities API service.
 *
 * A preset seeds the store with the typed fields, starter categories,
 * capabilities and home layout its sector normally needs. Applying one is
 * additive and idempotent — anything that already exists is left alone.
 *
 * Capabilities are what the rest of the product should branch on. Never
 * branch on the sector itself: two stores in the same sector routinely want
 * different behaviour.
 */

import { apiClient } from "./api";

export interface SectorPresetSummary {
  key: string;
  name: string;
  name_ar: string;
  description: string;
  namespace: string;
  field_count: number;
  category_count: number;
  capabilities: string[];
  is_applied: boolean;
}

export interface ApplyPresetOptions {
  apply_categories?: boolean;
  apply_theme?: boolean;
}

export interface ApplyPresetReport {
  preset: string;
  fields_created: number;
  fields_skipped: number;
  categories_created: number;
  categories_skipped: number;
  capabilities_enabled: string[];
  capabilities_unavailable: string[];
  theme:
    | "not_requested"
    | "draft_updated"
    | "skipped_no_active_theme"
    | "skipped_no_section_schema"
    | "skipped_no_matching_sections";
}

export interface StoreCapability {
  key: string;
  name: string;
  name_ar: string;
  enabled: boolean;
  implemented: boolean;
  min_plan: string;
}

export async function listSectorPresets(
  storeId: string,
): Promise<SectorPresetSummary[]> {
  return apiClient<SectorPresetSummary[]>(`/stores/${storeId}/sector-presets`);
}

export async function applySectorPreset(
  storeId: string,
  presetKey: string,
  options: ApplyPresetOptions = {},
): Promise<ApplyPresetReport> {
  return apiClient<ApplyPresetReport>(
    `/stores/${storeId}/sector-presets/${presetKey}/apply`,
    {
      method: "POST",
      body: JSON.stringify({
        apply_categories: options.apply_categories ?? true,
        apply_theme: options.apply_theme ?? false,
      }),
    },
  );
}

export async function listCapabilities(
  storeId: string,
): Promise<StoreCapability[]> {
  return apiClient<StoreCapability[]>(`/stores/${storeId}/capabilities`);
}

export async function setCapability(
  storeId: string,
  capabilityKey: string,
  enabled: boolean,
): Promise<StoreCapability> {
  return apiClient<StoreCapability>(
    `/stores/${storeId}/capabilities/${capabilityKey}`,
    { method: "PUT", body: JSON.stringify({ enabled }) },
  );
}
