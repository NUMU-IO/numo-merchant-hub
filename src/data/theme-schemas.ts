/**
 * Bundled theme settings schemas — mirrors the storefront's settings_schema.json files.
 * The dashboard uses these to render a dynamic settings form per theme.
 */

export type SettingType = "color" | "checkbox" | "image" | "text" | "select" | "range";

export interface SettingDefinition {
  key: string;
  type: SettingType;
  label: string;
  labelAr: string;
  description?: string;
  default: string | number | boolean;
  group?: string;
  groupAr?: string;
  options?: { label: string; labelAr: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export interface ThemeSchema {
  themeId: string;
  settings: SettingDefinition[];
}

const colorSettings: SettingDefinition[] = [
  { key: "primary_color", type: "color", label: "Primary Color", labelAr: "اللون الأساسي", default: "", group: "Colors", groupAr: "الألوان" },
  { key: "secondary_color", type: "color", label: "Secondary Color", labelAr: "اللون الثانوي", default: "", group: "Colors", groupAr: "الألوان" },
  { key: "accent_color", type: "color", label: "Accent Color", labelAr: "لون التمييز", default: "", group: "Colors", groupAr: "الألوان" },
  { key: "background_color", type: "color", label: "Background Color", labelAr: "لون الخلفية", default: "", group: "Colors", groupAr: "الألوان" },
  { key: "text_color", type: "color", label: "Text Color", labelAr: "لون النص", default: "", group: "Colors", groupAr: "الألوان" },
];

const typographySettings: SettingDefinition[] = [
  {
    key: "heading_font",
    type: "select",
    label: "Heading Font",
    labelAr: "خط العناوين",
    default: "Cairo",
    group: "Typography",
    groupAr: "الخطوط",
    options: [
      { label: "Cairo", labelAr: "القاهرة", value: "Cairo" },
      { label: "Inter", labelAr: "إنتر", value: "Inter" },
      { label: "Space Grotesk", labelAr: "سبيس جروتيسك", value: "Space Grotesk" },
      { label: "Tajawal", labelAr: "تجوال", value: "Tajawal" },
      { label: "Poppins", labelAr: "بوبينز", value: "Poppins" },
    ],
  },
];

const layoutSettings: SettingDefinition[] = [
  {
    key: "border_radius",
    type: "range",
    label: "Border Radius",
    labelAr: "استدارة الحواف",
    default: 12,
    min: 0,
    max: 32,
    step: 2,
    unit: "px",
    group: "Layout",
    groupAr: "التخطيط",
  },
  {
    key: "button_style",
    type: "select",
    label: "Button Style",
    labelAr: "شكل الزر",
    default: "rounded",
    group: "Layout",
    groupAr: "التخطيط",
    options: [
      { label: "Rounded", labelAr: "مستدير", value: "rounded" },
      { label: "Square", labelAr: "مربع", value: "square" },
      { label: "Pill", labelAr: "كبسولة", value: "pill" },
    ],
  },
  {
    key: "nav_style",
    type: "select",
    label: "Navigation Style",
    labelAr: "شكل التنقل",
    default: "floating",
    group: "Layout",
    groupAr: "التخطيط",
    options: [
      { label: "Floating", labelAr: "عائم", value: "floating" },
      { label: "Fixed", labelAr: "ثابت", value: "fixed" },
      { label: "Sticky", labelAr: "لاصق", value: "sticky" },
    ],
  },
  {
    key: "enable_animations",
    type: "checkbox",
    label: "Enable Animations",
    labelAr: "تفعيل الحركات",
    default: true,
    group: "Layout",
    groupAr: "التخطيط",
  },
];

// ─── Storefront Section Schemas ──────────────────────────────────────────────
// Used by the Customization tab's Accordion sections (not per-theme).

export const identitySettings: SettingDefinition[] = [
  { key: "store_name", type: "text", label: "Store Display Name", labelAr: "اسم المتجر", default: "", group: "Identity", groupAr: "الهوية", description: "Shown in header and footer" },
  { key: "logo_url", type: "image", label: "Logo", labelAr: "الشعار", default: "", group: "Identity", groupAr: "الهوية" },
  { key: "favicon_url", type: "image", label: "Favicon", labelAr: "أيقونة المتصفح", default: "", group: "Identity", groupAr: "الهوية" },
];

export const headerSettings: SettingDefinition[] = [
  { key: "announcement_text", type: "text", label: "Announcement Text", labelAr: "نص الإعلان", default: "", group: "Header", groupAr: "الهيدر", description: "Top bar message" },
  { key: "announcement_color", type: "color", label: "Announcement Color", labelAr: "لون الإعلان", default: "#4318FF", group: "Header", groupAr: "الهيدر" },
  { key: "show_search_bar", type: "checkbox", label: "Show Search Bar", labelAr: "إظهار البحث", default: true, group: "Header", groupAr: "الهيدر" },
  { key: "show_cart_icon", type: "checkbox", label: "Show Cart Icon", labelAr: "إظهار السلة", default: true, group: "Header", groupAr: "الهيدر" },
];

export const heroSettings: SettingDefinition[] = [
  { key: "hero_image_url", type: "image", label: "Hero Image", labelAr: "صورة البطل", default: "", group: "Hero", groupAr: "القسم الرئيسي" },
  { key: "headline", type: "text", label: "Headline", labelAr: "العنوان الرئيسي", default: "", group: "Hero", groupAr: "القسم الرئيسي" },
  { key: "subtitle", type: "text", label: "Subtitle", labelAr: "العنوان الفرعي", default: "", group: "Hero", groupAr: "القسم الرئيسي" },
  { key: "cta_text", type: "text", label: "CTA Button Text", labelAr: "نص زر الدعوة", default: "", group: "Hero", groupAr: "القسم الرئيسي" },
  { key: "cta_link", type: "text", label: "CTA Link", labelAr: "رابط الدعوة", default: "/products", group: "Hero", groupAr: "القسم الرئيسي" },
];

export const productsSettings: SettingDefinition[] = [
  {
    key: "layout", type: "select", label: "Layout", labelAr: "التخطيط", default: "grid",
    group: "Products", groupAr: "المنتجات",
    options: [
      { label: "Grid", labelAr: "شبكة", value: "grid" },
      { label: "List", labelAr: "قائمة", value: "list" },
    ],
  },
  { key: "products_per_row", type: "range", label: "Products Per Row", labelAr: "عدد المنتجات بالصف", default: 3, min: 2, max: 4, step: 1, group: "Products", groupAr: "المنتجات" },
  { key: "show_price", type: "checkbox", label: "Show Price", labelAr: "إظهار السعر", default: true, group: "Products", groupAr: "المنتجات" },
  { key: "show_rating", type: "checkbox", label: "Show Rating", labelAr: "إظهار التقييم", default: true, group: "Products", groupAr: "المنتجات" },
];

export const footerSettings: SettingDefinition[] = [
  { key: "footer_text", type: "text", label: "Footer Text", labelAr: "نص الفوتر", default: "", group: "Footer", groupAr: "الفوتر" },
  { key: "facebook", type: "text", label: "Facebook URL", labelAr: "رابط فيسبوك", default: "", group: "Footer", groupAr: "الفوتر" },
  { key: "instagram", type: "text", label: "Instagram URL", labelAr: "رابط إنستجرام", default: "", group: "Footer", groupAr: "الفوتر" },
  { key: "twitter", type: "text", label: "Twitter / X", labelAr: "رابط تويتر", default: "", group: "Footer", groupAr: "الفوتر" },
  { key: "whatsapp", type: "text", label: "WhatsApp Number", labelAr: "رقم واتساب", default: "", group: "Footer", groupAr: "الفوتر" },
  { key: "show_newsletter", type: "checkbox", label: "Show Newsletter", labelAr: "إظهار النشرة البريدية", default: true, group: "Footer", groupAr: "الفوتر" },
];

// ─── Per-Theme Schemas ──────────────────────────────────────────────────────

export const themeSchemas: Record<string, ThemeSchema> = {
  modern: {
    themeId: "modern",
    settings: [...colorSettings, ...typographySettings, ...layoutSettings],
  },
  boutique: {
    themeId: "boutique",
    settings: [...colorSettings, ...typographySettings, ...layoutSettings],
  },
  elegant: {
    themeId: "elegant",
    settings: [...colorSettings, ...typographySettings, ...layoutSettings],
  },
  skeuomorphic: {
    themeId: "skeuomorphic",
    settings: [
      ...colorSettings,
      ...typographySettings,
      ...layoutSettings,
      {
        key: "enable_glassmorphism",
        type: "checkbox",
        label: "Enable Glassmorphism",
        labelAr: "تفعيل تأثير الزجاج",
        default: true,
        group: "Effects",
        groupAr: "التأثيرات",
      },
    ],
  },
};

/** Group the settings by their `group` field. */
export function groupSettings(settings: SettingDefinition[]) {
  const groups = new Map<string, SettingDefinition[]>();
  for (const s of settings) {
    const g = s.group || "General";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(s);
  }
  return groups;
}
