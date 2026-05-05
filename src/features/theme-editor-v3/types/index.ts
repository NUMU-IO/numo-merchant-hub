/**
 * Theme Editor V3 — TypeScript types.
 *
 * These mirror the backend ThemeSettingsV3 Pydantic models. The shape of
 * what the backend actually persists is the source of truth — fields that
 * exist client-side only (e.g., editor IDs we synthesize for sortable
 * lists) must be marked optional and stripped before sending to the API.
 */

// ─── Block Instance ─────────────────────────────────────────────────────────

export interface BlockInstance {
  type: string;
  disabled?: boolean;
  settings: Record<string, unknown>;
  blocks?: Record<string, BlockInstance>;
}

// ─── Section Instance ───────────────────────────────────────────────────────

export interface SectionInstance {
  type: string;
  disabled?: boolean;
  settings: Record<string, unknown>;
  blocks?: Record<string, BlockInstance>;
  block_order?: string[];
}

// ─── Section Group ──────────────────────────────────────────────────────────

export interface SectionGroup {
  /** Display name (e.g., "Header Group", "Footer Group"). */
  name: string;
  sections: Record<string, SectionInstance>;
  order: string[];
}

// ─── Page Template ──────────────────────────────────────────────────────────

export interface PageTemplate {
  name: string;
  sections: Record<string, SectionInstance>;
  order: string[];
}

// ─── External Theme Metadata (BYOT) ─────────────────────────────────────────

export interface ExternalThemeMetadata {
  bundle_url: string;
  css_url?: string | null;
  settings_schema?: Record<string, unknown> | null;
  section_schemas?: Record<string, unknown> | null;
  manifest?: Record<string, unknown> | null;
  mode?: "production" | "development";
  dev_url?: string | null;
}

// ─── Theme Settings V3 (canonical, matches backend) ─────────────────────────

export interface ThemeSettingsV3 {
  schema_version: 3;
  theme_id: string;
  global_settings: Record<string, unknown>;
  templates: Record<string, PageTemplate>;
  section_groups: Record<string, SectionGroup>;
  external_theme?: ExternalThemeMetadata | null;
}

// ─── Schema Types (for form generation) ─────────────────────────────────────

export type SettingInputType =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "range"
  | "color"
  | "checkbox"
  | "select"
  | "radio"
  | "font"
  | "image_picker"
  | "url"
  | "product"
  | "collection";

export interface SettingDefinition {
  id: string;
  type: SettingInputType;
  label: string;
  default?: unknown;
  info?: string;
  placeholder?: string;
  /** Bilingual labels */
  locales?: {
    ar?: { label?: string; info?: string; placeholder?: string };
    en?: { label?: string; info?: string; placeholder?: string };
  };
  /** For select/radio */
  options?: Array<{
    label: string;
    value: string;
    locales?: { ar?: { label?: string } };
  }>;
  /** For range/number */
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Grouping */
  group?: string;
  group_locales?: { ar?: string; en?: string };
}

export interface BlockSchemaDefinition {
  type: string;
  name: string;
  locales?: { ar?: { name?: string } };
  limit?: number;
  settings: SettingDefinition[];
}

export interface SectionSchemaDefinition {
  type: string;
  name: string;
  locales?: { ar?: { name?: string } };
  tag?: string | null;
  class?: string | null;
  limit?: number;
  max_blocks?: number;
  settings: SettingDefinition[];
  blocks?: BlockSchemaDefinition[];
  presets?: Array<{
    name: string;
    locales?: { ar?: { name?: string } };
    category?: string;
    category_locales?: { ar?: string };
    settings?: Record<string, unknown>;
    blocks?: Array<{ type: string; settings?: Record<string, unknown> }>;
  }>;
}

// Backwards-compatible aliases (older panels import these names).
export type SectionSchema = SectionSchemaDefinition;
export type BlockSchema = BlockSchemaDefinition;

export interface ThemeSchemaBundle {
  /** Backend returns these top-level keys; theme_id and theme_slug come from
   *  the active StoreTheme row. */
  theme_id: string;
  theme_slug?: string | null;
  theme_type?: "internal" | "external";
  settings_schema: SettingDefinition[];
  /** Map of section.type → SectionSchemaDefinition. */
  section_schemas: Record<string, SectionSchemaDefinition>;
  /** Map of block.type → BlockSchemaDefinition (theme-wide, optional). */
  block_schemas?: Record<string, BlockSchemaDefinition>;
}

/**
 * Adapter shape for editor convenience: the store consumes this. Built
 * by `bundleSchemas()` once we receive the raw backend response.
 */
export interface NormalizedSchemas {
  global_settings: SettingDefinition[];
  /** Flat list of section schemas keyed by their `.type`. */
  sections: SectionSchemaDefinition[];
  /** Map of group_id → list of section schemas allowed in that group. */
  section_groups: Record<string, { sections: SectionSchemaDefinition[] }>;
}

// ─── Version History ────────────────────────────────────────────────────────

export interface CustomizationVersion {
  id: string;
  theme_id: string;
  change_summary: string | null;
  is_published: boolean;
  is_autosave: boolean;
  version_label: string | null;
  created_at: string | null;
  created_by: string | null;
}

// ─── API Response Types (match backend SuccessResponse[T] inner shapes) ─────

export interface AutosaveDraftResponse {
  draft: ThemeSettingsV3;
}

export interface PublishDraftResponse {
  published: ThemeSettingsV3;
}

export interface DiscardDraftResponse {
  published: ThemeSettingsV3 | Record<string, never>;
}

export interface VersionListResponse {
  versions: CustomizationVersion[];
  page: number;
  per_page: number;
}

export interface RestoreVersionResponse {
  draft: ThemeSettingsV3;
}

// ─── Editor State ───────────────────────────────────────────────────────────

export type EditorLocale = "en" | "ar";
export type DeviceMode = "desktop" | "tablet" | "mobile";
export type SidebarPanel =
  | "sections"
  | "section-editor"
  | "block-editor"
  | "group-editor"
  | "global-settings"
  | "version-history";

export interface EditorSelection {
  type: "section" | "block" | "global" | "group" | null;
  sectionId: string | null;
  blockId: string | null;
  groupId: string | null;
}
