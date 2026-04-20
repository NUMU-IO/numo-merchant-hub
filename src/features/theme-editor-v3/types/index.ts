/**
 * Theme Editor V3 — TypeScript types.
 *
 * These mirror the backend ThemeSettingsV3 Pydantic models and the
 * @numu/theme-sdk entity interfaces. They are kept local to the dashboard
 * feature to avoid coupling the merchant-hub to the SDK package at build time.
 */

// ─── Block Instance ─────────────────────────────────────────────────────────

export interface BlockInstance {
  id: string;
  type: string;
  disabled?: boolean;
  settings: Record<string, unknown>;
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
  type: string;
  sections: Record<string, SectionInstance>;
  order: string[];
}

// ─── Page Template ──────────────────────────────────────────────────────────

export interface PageTemplate {
  name: string;
  sections: Record<string, SectionInstance>;
  order: string[];
}

// ─── Theme Settings V3 ─────────────────────────────────────────────────────

export interface ThemeSettingsV3 {
  schema_version: 3;
  theme_id: string;
  theme_source: "built-in" | "marketplace" | "byot";
  global_settings: Record<string, unknown>;
  templates: Record<string, PageTemplate>;
  section_groups: Record<string, SectionGroup>;
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
  options?: Array<{ label: string; value: string; locales?: { ar?: { label?: string } } }>;
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

export interface ThemeSchemaBundle {
  theme_id: string;
  theme_source: "built-in" | "marketplace" | "byot";
  global_settings: SettingDefinition[];
  sections: SectionSchemaDefinition[];
  section_groups: Record<string, {
    sections: SectionSchemaDefinition[];
  }>;
}

// ─── Version History ────────────────────────────────────────────────────────

export interface CustomizationVersion {
  id: string;
  version_number: number;
  label: string | null;
  source: "autosave" | "publish" | "restore";
  created_at: string;
  payload: ThemeSettingsV3;
}

// ─── API Response Types ─────────────────────────────────────────────────────

export interface AutosaveResponse {
  status: "ok";
  version_number: number;
  saved_at: string;
}

export interface PublishResponse {
  status: "published";
  version_number: number;
  published_at: string;
}

export interface VersionListResponse {
  versions: CustomizationVersion[];
  total: number;
  page: number;
  page_size: number;
}

// ─── Editor State ───────────────────────────────────────────────────────────

export type EditorLocale = "en" | "ar";
export type DeviceMode = "desktop" | "tablet" | "mobile";
export type SidebarPanel = "sections" | "section-editor" | "block-editor" | "global-settings" | "version-history";

export interface EditorSelection {
  type: "section" | "block" | "global" | null;
  sectionId: string | null;
  blockId: string | null;
  groupId: string | null; // for section groups (header/footer)
}
