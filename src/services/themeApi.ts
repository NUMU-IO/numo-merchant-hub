/**
 * Theme-specific API calls for the NUMU merchant dashboard.
 */

import { apiClient } from "./api";

export interface AvailableTheme {
  id: string;
  name: string;
  nameAr: string;
  layout: "default" | "skeuomorphic" | "neo-brutalism" | "editorial" | "luxury-minimal";
  description: string;
  /** Minimum tenant plan required to activate. Default "free". */
  required_plan?: "free" | "starter" | "pro" | "enterprise";
  /** Sort key for the merchant theme grid (ascending). */
  display_order?: number;
  /** Absolute URL to the theme's preview screenshot (PNG). */
  preview_image_url?: string;
  /** Absolute URL to a hosted demo storefront for live iframe preview. */
  demo_url?: string | null;
}

export interface CustomizationTheme {
  base_theme: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  button_style: string;
  enable_animations: boolean;
  border_radius: number;
  heading_font: string;
  body_font: string;
  nav_style: string;
  /** Per-theme settings (hero_headline, show_product_rating, etc.) */
  [key: string]: unknown;
}

export interface CustomizationIdentity {
  logo_url: string;
  store_name: string;
  favicon_url: string;
  /** Explicit footer override; when empty the renderer falls back to dark/primary. */
  logo_footer_url: string;
  /** Variant for dark surfaces. Fallback for the footer when no explicit footer logo. */
  logo_dark_url: string;
  logo_alt_text: string;
  logo_link_target: string;
  /** Pixel widths — `0` means "use the theme default". */
  logo_width_desktop: number;
  logo_width_mobile: number;
  logo_footer_width_desktop: number;
  logo_footer_width_mobile: number;
  logo_padding: number;
  logo_background_color: string;
  /** Footer-only CSS filter hint: "none" (default) | "white" | "invert". */
  footer_logo_filter_mode: "none" | "white" | "invert";
}

export interface CustomizationHeader {
  nav_layout: string;
  show_search_bar: boolean;
  show_cart_icon: boolean;
  announcement_text: string;
  announcement_color: string;
  announcement_text_color: string;
}

export interface CustomizationHero {
  hero_image_url: string;
  headline: string;
  subtitle: string;
  cta_text: string;
  cta_link: string;
}

export interface CustomizationProducts {
  layout: string;
  products_per_row: number;
  show_price: boolean;
  show_rating: boolean;
  /** Product-image aspect ratio on cards + PDP. "portrait" (3/4), "square" (1/1), "landscape" (4/3). */
  image_aspect: "portrait" | "square" | "landscape";
}

export interface CustomizationFooter {
  footer_text: string;
  social_links: {
    facebook: string;
    instagram: string;
    twitter: string;
    whatsapp: string;
  };
  show_newsletter: boolean;
}

export interface CustomizationNavigation {
  links: Array<{ label: string; to: string }>;
  show_categories_in_nav: boolean;
}

export interface CustomizationLabels {
  home_title: string;
  products_title: string;
  checkout_title: string;
  order_confirmed_title: string;
  cart_empty: string;
  search_placeholder: string;
  add_to_cart: string;
  added_to_cart: string;
  continue_shopping: string;
  footer_shop_heading: string;
  footer_help_heading: string;
  footer_contact_heading: string;
}

export interface CustomizationLayout {
  header_layout: string;
  footer_layout: string;
  footer_columns: number;
  home_sections: string[];
  hero_position: string;
  product_card_style: string;
}

export interface CustomizationData {
  customization_mode: string;
  identity: CustomizationIdentity;
  theme: CustomizationTheme;
  header: CustomizationHeader;
  hero: CustomizationHero;
  products: CustomizationProducts;
  footer: CustomizationFooter;
  navigation?: CustomizationNavigation;
  labels?: CustomizationLabels;
  layout?: CustomizationLayout;
  is_published: boolean;
  last_published_at: string | null;
}

// Fetch the list of available storefront themes
export function fetchThemes(): Promise<AvailableTheme[]> {
  return apiClient<AvailableTheme[]>("/storefront/themes");
}

// Fetch current customization draft for the store
export function fetchCustomization(storeId: string): Promise<CustomizationData> {
  return apiClient<CustomizationData>(`/stores/${storeId}/settings/customization`);
}

// Save customization draft (partial update)
export function updateCustomization(
  storeId: string,
  data: Partial<{
    customization_mode: string;
    identity: Partial<CustomizationIdentity>;
    theme: Partial<CustomizationTheme>;
    header: Partial<CustomizationHeader>;
    hero: Partial<CustomizationHero>;
    products: Partial<CustomizationProducts>;
    footer: Partial<CustomizationFooter>;
    navigation: Partial<CustomizationNavigation>;
    labels: Partial<CustomizationLabels>;
    layout: Partial<CustomizationLayout>;
    // V2 section engine fields
    schema_version: number;
    templates: Record<string, TemplateConfigData>;
  }>
): Promise<CustomizationData> {
  return apiClient<CustomizationData>(`/stores/${storeId}/settings/customization`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// Publish customization to live storefront
export function publishCustomization(storeId: string): Promise<CustomizationData> {
  return apiClient<CustomizationData>(`/stores/${storeId}/settings/customization/publish`, {
    method: "POST",
  });
}

// Reset storefront customization back to the theme defaults. Doesn't auto-
// publish — the merchant still has to click Publish to push the reset live.
export function resetCustomization(storeId: string): Promise<CustomizationData> {
  return apiClient<CustomizationData>(`/stores/${storeId}/settings/customization/reset`, {
    method: "POST",
  });
}

// â”€â”€â”€ V2 Section Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SectionSettingDefinition {
  key: string;
  type: string;
  label: string;
  labelAr?: string;
  description?: string;
  help?: string;
  helpAr?: string;
  default?: string | number | boolean | unknown[];
  placeholder?: string;
  options?: Array<{ label: string; labelAr?: string; value: string }>;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  group?: string;
  groupAr?: string;
}

export interface SectionSchemaData {
  type: string;
  name: string;
  nameAr?: string;
  limit?: number;
  settings: SectionSettingDefinition[];
  presets?: Array<{
    name: string;
    nameAr?: string;
    category?: string;
    categoryAr?: string;
    settings?: Record<string, unknown>;
  }>;
}

export interface SectionInstanceData {
  id: string;
  type: string;
  disabled?: boolean;
  settings: Record<string, unknown>;
}

export interface TemplateConfigData {
  name: string;
  sections: Record<string, SectionInstanceData>;
  order: string[];
}

export interface ThemeSchemaBundle {
  theme_id: string;
  global_settings: SectionSettingDefinition[];
  sections: SectionSchemaData[];
  default_templates: Record<string, TemplateConfigData>;
}

// Fetch theme schemas (global + section schemas)
export function fetchThemeSchemas(themeId: string): Promise<ThemeSchemaBundle> {
  return apiClient<ThemeSchemaBundle>(`/storefront/themes/${themeId}/schemas`);
}

// â”€â”€â”€ External Themes (BYOT) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ExternalThemeSettingDefinition {
  key: string;
  type: "color" | "text" | "checkbox" | "select" | "range" | "image";
  label: string;
  description?: string;
  default?: string | number | boolean;
  group?: string;
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export interface ExternalThemeSettingsSchema {
  settings: ExternalThemeSettingDefinition[];
}

export interface StoreThemeListItem {
  id: string;
  name: string;
  nameAr: string;
  layout: string;
  description: string;
  is_external: boolean;
  bundle_url?: string;
  css_url?: string;
  version?: string;
  source_repo?: string;
  settings_schema?: ExternalThemeSettingsSchema;
  /** "dev" for local dev server, undefined for production CDN themes */
  mode?: "dev" | null;
}

export interface StoreThemesListResponse {
  themes: StoreThemeListItem[];
  active_theme_id: string | null;
}

/** Fetch all themes available to a store (built-in + external) */
export function fetchStoreThemes(storeId: string): Promise<StoreThemesListResponse> {
  return apiClient<StoreThemesListResponse>(`/stores/${storeId}/themes`);
}

export type ThemeBuildStatus =
  | "queued"
  | "cloning"
  | "validating"
  | "building"
  | "uploading"
  | "complete"
  | "failed";

export interface ThemeBuildResponse {
  build_id: string;
  status: ThemeBuildStatus;
  message: string;
}

export interface ThemeBuildStatusResponse {
  build_id: string;
  status: ThemeBuildStatus;
  theme_id: string | null;
  bundle_url: string | null;
  css_url: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface ExternalThemeInfoResponse {
  has_external_theme: boolean;
  theme_id: string | null;
  bundle_url: string | null;
  css_url: string | null;
  version: string | null;
  source_repo: string | null;
  built_at: string | null;
}

/** Submit a GitHub URL to build an external theme */
export function submitExternalTheme(
  storeId: string,
  githubUrl: string,
  branch: string = "main",
): Promise<ThemeBuildResponse> {
  return apiClient<ThemeBuildResponse>(`/stores/${storeId}/themes/external`, {
    method: "POST",
    body: JSON.stringify({ github_url: githubUrl, branch }),
  });
}

/**
 * Connect a local theme dev server (running `numu-theme dev`) to this store.
 * The backend probes the URL to verify it's reachable and reads the theme manifest.
 */
export function connectDevServer(
  storeId: string,
  devUrl: string,
): Promise<ExternalThemeInfoResponse> {
  return apiClient<ExternalThemeInfoResponse>(
    `/stores/${storeId}/themes/external/dev-mode`,
    {
      method: "POST",
      body: JSON.stringify({ dev_url: devUrl }),
    },
  );
}

/** Get the current external theme info for a store */
export function fetchExternalThemeInfo(storeId: string): Promise<ExternalThemeInfoResponse> {
  return apiClient<ExternalThemeInfoResponse>(`/stores/${storeId}/themes/external`);
}

/** Poll the build status by build_id */
export function fetchBuildStatus(
  storeId: string,
  buildId: string,
): Promise<ThemeBuildStatusResponse> {
  return apiClient<ThemeBuildStatusResponse>(
    `/stores/${storeId}/themes/external/builds/${buildId}`,
  );
}

/** Remove the external theme and revert to a built-in fallback */
export function removeExternalTheme(
  storeId: string,
  fallbackTheme: string = "modern",
): Promise<{ removed: boolean; fallback_theme: string }> {
  return apiClient<{ removed: boolean; fallback_theme: string }>(
    `/stores/${storeId}/themes/external`,
    {
      method: "DELETE",
      body: JSON.stringify({ fallback_theme: fallbackTheme }),
    },
  );
}

export async function rebuildExternalTheme(
  storeId: string,
  branch?: string
): Promise<{ status: string; task_id: string; message: string }> {
  return apiClient<{ status: string; task_id: string; message: string }>(
    "/stores/$storeId/themes/external/rebuild",
    {
      method: "POST",
      body: JSON.stringify({ branch }),
    }
  );
}

export interface ThemeValidationResponse {
  valid: boolean;
  errors: Array<{ file?: string; line?: number; path?: string; message: string; severity: string }>;
  warnings: Array<{ file?: string; line?: number; path?: string; message: string; severity: string }>;
  contract_version: string | null;
  bundle_size_bytes?: number;
}

export async function validateExternalTheme(
  storeId: string
): Promise<ThemeValidationResponse> {
  return apiClient<ThemeValidationResponse>(
    `/stores/${storeId}/themes/external/validate`,
    {
      method: "POST",
    }
  );
}
