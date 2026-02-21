/**
 * Bundled theme settings schemas — mirrors the storefront's settings_schema.json files.
 * The dashboard uses these to render a dynamic settings form per theme.
 */

export type SettingType = "color" | "checkbox" | "image" | "text" | "select" | "font" | "range";

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

const _fontOptions = [
  { label: "Cairo", labelAr: "Cairo", value: "Cairo" },
  { label: "Tajawal", labelAr: "Tajawal", value: "Tajawal" },
  { label: "IBM Plex Sans Arabic", labelAr: "IBM Plex Sans Arabic", value: "IBM Plex Sans Arabic" },
  { label: "Noto Sans Arabic", labelAr: "Noto Sans Arabic", value: "Noto Sans Arabic" },
  { label: "El Messiri", labelAr: "El Messiri", value: "El Messiri" },
  { label: "Almarai", labelAr: "Almarai", value: "Almarai" },
  { label: "Changa", labelAr: "Changa", value: "Changa" },
  { label: "Rubik", labelAr: "Rubik", value: "Rubik" },
  { label: "Readex Pro", labelAr: "Readex Pro", value: "Readex Pro" },
  { label: "Inter", labelAr: "Inter", value: "Inter" },
  { label: "Poppins", labelAr: "Poppins", value: "Poppins" },
  { label: "Space Grotesk", labelAr: "Space Grotesk", value: "Space Grotesk" },
];

const typographySettings: SettingDefinition[] = [
  {
    key: "heading_font",
    type: "font",
    label: "Heading Font",
    labelAr: "خط العناوين",
    default: "Cairo",
    group: "Typography",
    groupAr: "الخطوط",
    options: _fontOptions,
  },
  {
    key: "body_font",
    type: "font",
    label: "Body Font",
    labelAr: "خط النصوص",
    default: "Cairo",
    group: "Typography",
    groupAr: "الخطوط",
    options: _fontOptions,
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

// ─── Navigation, Labels & Page Layout Schemas ───────────────────────────────

export const navigationSettings: SettingDefinition[] = [
  { key: "show_categories_in_nav", type: "checkbox", label: "Show Categories in Nav", labelAr: "عرض الفئات في التنقل", default: true, group: "Navigation", groupAr: "التنقل" },
];

export const labelsSettings: SettingDefinition[] = [
  { key: "home_title", type: "text", label: "Home Page Title", labelAr: "عنوان الصفحة الرئيسية", default: "", group: "Labels", groupAr: "التسميات" },
  { key: "products_title", type: "text", label: "Products Page Title", labelAr: "عنوان صفحة المنتجات", default: "", group: "Labels", groupAr: "التسميات" },
  { key: "checkout_title", type: "text", label: "Checkout Title", labelAr: "عنوان صفحة الشراء", default: "", group: "Labels", groupAr: "التسميات" },
  { key: "search_placeholder", type: "text", label: "Search Placeholder", labelAr: "نص البحث", default: "", group: "Labels", groupAr: "التسميات" },
  { key: "add_to_cart", type: "text", label: "Add to Cart Button", labelAr: "زر أضف للسلة", default: "", group: "Labels", groupAr: "التسميات" },
  { key: "continue_shopping", type: "text", label: "Continue Shopping", labelAr: "مواصلة التسوق", default: "", group: "Labels", groupAr: "التسميات" },
  { key: "footer_shop_heading", type: "text", label: "Footer Shop Heading", labelAr: "عنوان قسم التسوق", default: "", group: "Labels", groupAr: "التسميات" },
  { key: "footer_help_heading", type: "text", label: "Footer Help Heading", labelAr: "عنوان قسم المساعدة", default: "", group: "Labels", groupAr: "التسميات" },
  { key: "footer_contact_heading", type: "text", label: "Footer Contact Heading", labelAr: "عنوان قسم التواصل", default: "", group: "Labels", groupAr: "التسميات" },
];

export const pageLayoutSettings: SettingDefinition[] = [
  {
    key: "header_layout", type: "select", label: "Header Layout", labelAr: "تخطيط الهيدر",
    default: "logo-right", group: "Page Layout", groupAr: "تخطيط الصفحة",
    options: [
      { label: "Logo Right + Nav Center", labelAr: "شعار يمين + تنقل وسط", value: "logo-right" },
      { label: "Logo Centered", labelAr: "شعار في المنتصف", value: "logo-center" },
      { label: "Logo Left + Nav Center", labelAr: "شعار يسار + تنقل وسط", value: "logo-left" },
      { label: "Stacked (Logo Top)", labelAr: "مكدس (شعار فوق)", value: "stacked" },
    ],
  },
  {
    key: "footer_layout", type: "select", label: "Footer Layout", labelAr: "تخطيط الفوتر",
    default: "4-col", group: "Page Layout", groupAr: "تخطيط الصفحة",
    options: [
      { label: "4 Columns", labelAr: "٤ أعمدة", value: "4-col" },
      { label: "3 Columns", labelAr: "٣ أعمدة", value: "3-col" },
      { label: "2 Columns", labelAr: "عمودين", value: "2-col" },
      { label: "Minimal", labelAr: "بسيط", value: "minimal" },
    ],
  },
  {
    key: "product_card_style", type: "select", label: "Product Card Style", labelAr: "شكل كارت المنتج",
    default: "default", group: "Page Layout", groupAr: "تخطيط الصفحة",
    options: [
      { label: "Default", labelAr: "افتراضي", value: "default" },
      { label: "Compact", labelAr: "مدمج", value: "compact" },
      { label: "Detailed", labelAr: "مفصل", value: "detailed" },
    ],
  },
  {
    key: "hero_position", type: "select", label: "Hero Position", labelAr: "موقع القسم الرئيسي",
    default: "top", group: "Page Layout", groupAr: "تخطيط الصفحة",
    options: [
      { label: "Top (Default)", labelAr: "أعلى (افتراضي)", value: "top" },
      { label: "After Categories", labelAr: "بعد الفئات", value: "after-categories" },
    ],
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
  { key: "announcement_color", type: "color", label: "Announcement BG Color", labelAr: "لون خلفية الإعلان", default: "#4318FF", group: "Header", groupAr: "الهيدر" },
  { key: "announcement_text_color", type: "color", label: "Announcement Text Color", labelAr: "لون نص الإعلان", default: "#FFFFFF", group: "Header", groupAr: "الهيدر" },
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
  "tech-wave": {
    themeId: "tech-wave",
    settings: [
      ...colorSettings,
      ...typographySettings,
      ...layoutSettings,
      {
        key: "enable_neon_glow",
        type: "checkbox",
        label: "Enable Neon Glow",
        labelAr: "تفعيل التوهج النيون",
        default: true,
        group: "Effects",
        groupAr: "التأثيرات",
      },
      {
        key: "enable_wave_animation",
        type: "checkbox",
        label: "Enable Wave Animation",
        labelAr: "تفعيل حركة الموجة",
        default: true,
        group: "Effects",
        groupAr: "التأثيرات",
      },
      {
        key: "enable_glassmorphism",
        type: "checkbox",
        label: "Enable Glassmorphism",
        labelAr: "تفعيل تأثير الزجاج",
        default: true,
        group: "Effects",
        groupAr: "التأثيرات",
      },
      {
        key: "neon_color",
        type: "color",
        label: "Neon Color",
        labelAr: "لون النيون",
        default: "#00D4FF",
        group: "Effects",
        groupAr: "التأثيرات",
      },
    ],
  },
  "neo-brutalism": {
    themeId: "neo-brutalism",
    settings: [
      ...colorSettings,
      ...typographySettings,
      ...layoutSettings,
      {
        key: "borderWidth",
        type: "select",
        label: "Border Width",
        labelAr: "سُمك الحدود",
        default: "3px",
        group: "Effects",
        groupAr: "التأثيرات",
        options: [
          { label: "Thin (2px)", labelAr: "رفيع (2px)", value: "2px" },
          { label: "Medium (3px)", labelAr: "متوسط (3px)", value: "3px" },
          { label: "Thick (4px)", labelAr: "سميك (4px)", value: "4px" },
        ],
      },
      {
        key: "shadowOffset",
        type: "select",
        label: "Shadow Offset",
        labelAr: "إزاحة الظل",
        default: "4px",
        group: "Effects",
        groupAr: "التأثيرات",
        options: [
          { label: "Small (3px)", labelAr: "صغير (3px)", value: "3px" },
          { label: "Medium (4px)", labelAr: "متوسط (4px)", value: "4px" },
          { label: "Large (6px)", labelAr: "كبير (6px)", value: "6px" },
        ],
      },
      {
        key: "enable_animations",
        type: "checkbox",
        label: "Enable Animations",
        labelAr: "تفعيل الحركات",
        default: true,
        group: "Effects",
        groupAr: "التأثيرات",
      },
    ],
  },
  editorial: {
    themeId: "editorial",
    settings: [
      ...colorSettings,
      ...typographySettings,
      ...layoutSettings,
      {
        key: "enable_animations",
        type: "checkbox",
        label: "Enable Animations",
        labelAr: "تفعيل الحركات",
        default: true,
        group: "Effects",
        groupAr: "التأثيرات",
      },
    ],
  },
  "luxury-minimal": {
    themeId: "luxury-minimal",
    settings: [
      ...colorSettings,
      ...typographySettings,
      ...layoutSettings,
      {
        key: "enable_animations",
        type: "checkbox",
        label: "Enable Animations",
        labelAr: "تفعيل الحركات",
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
