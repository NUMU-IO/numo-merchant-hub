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
  /** Nested child blocks (blocks-in-blocks). Same container shape as a
   *  section — `block_order` orders the entries in `blocks`. Absent on
   *  leaf blocks so pre-nesting drafts load unchanged. */
  blocks?: Record<string, BlockInstance>;
  block_order?: string[];
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

/**
 * Setting input types the V3 customizer renders. Lock-step with the
 * SDK's SettingType union — when a new type lands it must be added in
 * both places. Anything theme-side that's not in this list falls
 * through to a plain text input (with a console warning during dev).
 */
export type SettingInputType =
  // Foundational editors
  | "text"
  | "textarea"
  | "richtext"
  | "inline_richtext" // single-line WYSIWYG (B/I only)
  | "number"
  | "range"
  | "range_with_unit" // range slider + unit-options dropdown (e.g. px/rem/%)
  | "color"
  | "checkbox"
  | "select"
  | "radio"
  | "font"
  | "image_picker"
  | "url"
  // Static decorative
  | "header"
  | "paragraph"
  | "html"
  | "date"
  | "time"
  | "video_picker"
  // Resource pickers — single
  | "product"
  | "collection"
  | "page_picker"
  | "blog_picker"
  | "link_list_picker"
  | "variant_picker"
  // Resource pickers — multi (value is string[])
  | "product_list"
  | "collection_list"
  // Color schemes
  | "color_scheme" // single picker — references the global color_scheme_group
  | "color_scheme_group" // parent definition stored on global_settings
  // Files
  | "file_upload";

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
  /**
   * For `range_with_unit`: list of unit options the merchant can flip
   * between (e.g. px/rem/%). The setting's stored value is
   *   { value: number, unit: string }
   * so the resolver can render either as `${value}${unit}` or use the
   * unit to compute responsive equivalents.
   */
  unit_options?: Array<{ value: string; label?: string }>;
  /**
   * For `product_list` / `collection_list`: cap the multi-select size.
   * Defaults to 50 (Shopify ships 50 too). Themes that need more should
   * either paginate at render time or fan out into multiple settings.
   */
  max_items?: number;
  /**
   * For `color_scheme_group`: per-scheme role keys the theme expects
   * (e.g. ["background", "text", "primary", "accent"]). The picker
   * surfaces an editor that lets merchants paint each role per scheme.
   */
  color_roles?: string[];
  /** Grouping */
  group?: string;
  group_locales?: { ar?: string; en?: string };
}

/**
 * Stored shape for a single color scheme inside a `color_scheme_group`
 * setting. Themes reference schemes by `id` from `color_scheme` settings;
 * the V3 renderer materializes them as CSS custom properties at
 * mount time.
 */
export interface ColorSchemeValue {
  id: string;
  name: string;
  /** Per-role color hex; keys come from the parent setting's color_roles. */
  colors: Record<string, string>;
}

export interface BlockSchemaDefinition {
  type: string;
  name: string;
  locales?: { ar?: { name?: string } };
  limit?: number;
  settings: SettingDefinition[];
  /** Child block types this block accepts (recursive — blocks-in-blocks).
   *  When present, the customizer renders a nested block list with its
   *  own Add/remove/reorder, capped at `max_blocks` and the global
   *  MAX_BLOCK_DEPTH. */
  blocks?: BlockSchemaDefinition[];
  max_blocks?: number;
}

/** A starter block inside a section preset (recursive — a preset can
 *  ship pre-populated nested blocks, e.g. a footer column with links). */
export interface PresetBlockDefinition {
  type: string;
  settings?: Record<string, unknown>;
  blocks?: PresetBlockDefinition[];
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
    blocks?: PresetBlockDefinition[];
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
  /**
   * Wave 7 — variants from the theme's manifest. Older backends won't
   * include this; the customizer handles `undefined` as "no variants".
   */
  variants?: Array<{
    id: string;
    name: string;
    name_ar?: string;
    description?: string;
    settings_override?: {
      global_settings?: Record<string, unknown>;
      templates?: Record<string, unknown>;
      section_groups?: Record<string, unknown>;
    };
  }>;
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
  /**
   * Wave 7 — theme-level variants declared in `theme.json` →
   * `variants[]`. Empty when the manifest doesn't ship any (most
   * themes today). The customizer's VariantPicker reads this off the
   * store's schemas; switching variants writes overrides into the
   * draft via `updateGlobalSetting`.
   */
  theme_variants?: Array<{
    id: string;
    name: string;
    name_ar?: string;
    description?: string;
    settings_override?: {
      global_settings?: Record<string, unknown>;
      templates?: Record<string, unknown>;
      section_groups?: Record<string, unknown>;
    };
  }>;
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
/**
 * Top-level editor mode. Equivalent to Shopify's "Sections / Theme settings /
 * App embeds" mode switch at the top of the sidebar.
 *   - `sections`       — section list + section/block/group editors (default).
 *   - `theme-settings` — global theme settings panel (Brand, Typography, Layout, etc.).
 *   - `app-embeds`     — app-provided global embeds. Empty state until the
 *                        app/theme-extension runtime lands.
 */
export type EditorMode =
  | "sections"
  | "theme-settings"
  | "wording"
  | "app-embeds";
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
  /**
   * Full path to a nested block, from the section's direct child down to
   * the selected block (e.g. `["col1", "link2"]`). For a top-level block
   * this is `[blockId]`. `blockId` always mirrors the LEAF for
   * back-compat with code that reads it directly; resolvers prefer
   * `blockPath`. Absent/null when no block is selected.
   */
  blockPath?: string[] | null;
}
