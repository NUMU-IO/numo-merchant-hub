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
}

export interface CustomizationIdentity {
  logo_url: string;
  store_name: string;
  favicon_url: string;
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

// ─── V2 Section Engine ────────────────────────────────────────────────────────

export interface SectionSettingDefinition {
  key: string;
  type: string;
  label: string;
  labelAr?: string;
  description?: string;
  default?: string | number | boolean;
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
