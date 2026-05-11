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
  { key: "hero_image_mobile", type: "image", label: "Hero Image (Mobile)", labelAr: "صورة البانر للهاتف", default: "", group: "Hero", groupAr: "القسم الرئيسي" },
  {
    key: "hero_image_aspect",
    type: "select",
    label: "Hero Image Aspect Ratio",
    labelAr: "نسبة أبعاد صورة البطل",
    default: "auto",
    description: "Pick how the hero image is framed on the storefront",
    group: "Hero",
    groupAr: "القسم الرئيسي",
    options: [
      { label: "Auto (fill area)", labelAr: "تلقائي (يملأ المساحة)", value: "auto" },
      { label: "Portrait 9:16", labelAr: "عمودي 9:16", value: "9/16" },
      { label: "Portrait 4:5", labelAr: "عمودي 4:5", value: "4/5" },
      { label: "Portrait 3:4", labelAr: "عمودي 3:4", value: "3/4" },
      { label: "Square 1:1", labelAr: "مربع 1:1", value: "1/1" },
      { label: "Landscape 4:3", labelAr: "أفقي 4:3", value: "4/3" },
      { label: "Landscape 3:2", labelAr: "أفقي 3:2", value: "3/2" },
      { label: "Landscape 16:9", labelAr: "أفقي 16:9", value: "16/9" },
    ],
  },
  {
    key: "hero_image_fit",
    type: "select",
    label: "Hero Image Fit",
    labelAr: "طريقة عرض صورة البطل",
    default: "cover",
    description: "Cover crops to fill, Contain shows the full image",
    group: "Hero",
    groupAr: "القسم الرئيسي",
    options: [
      { label: "Cover (crop to fill)", labelAr: "ملء (قص ليناسب)", value: "cover" },
      { label: "Contain (show full image)", labelAr: "احتواء (إظهار الصورة كاملة)", value: "contain" },
    ],
  },
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
  "bazar": {
    themeId: "bazar",
    settings: [
      { key: "primary_color", type: "color", label: "Amber Accent", labelAr: "لون العنبر", default: "#FFB300", group: "Colors", groupAr: "الألوان" },
      { key: "secondary_color", type: "color", label: "Cream Background", labelAr: "خلفية كريمي", default: "#FFF5E1", group: "Colors", groupAr: "الألوان" },
      { key: "accent_color", type: "color", label: "Amber Dark", labelAr: "عنبر داكن", default: "#E6A200", group: "Colors", groupAr: "الألوان" },
      { key: "background_color", type: "color", label: "Page Background", labelAr: "خلفية الصفحة", default: "#FFF5E1", group: "Colors", groupAr: "الألوان" },
      { key: "text_color", type: "color", label: "Text Color", labelAr: "لون النص", default: "#0a0a14", group: "Colors", groupAr: "الألوان" },
      { key: "color_dark", type: "color", label: "Dark Background", labelAr: "خلفية داكنة", default: "#0a0a14", group: "Colors", groupAr: "الألوان" },
      { key: "color_navy", type: "color", label: "Navy", labelAr: "كحلي", default: "#001f3f", group: "Colors", groupAr: "الألوان" },
      { key: "border_radius", type: "range", label: "Border Radius", labelAr: "استدارة الحواف", default: 16, min: 0, max: 32, step: 4, unit: "px", group: "Layout", groupAr: "التخطيط" },
      { key: "enable_animations", type: "checkbox", label: "Enable Animations", labelAr: "تفعيل الحركات", default: true, group: "Effects", groupAr: "التأثيرات" },
      { key: "enableMarquee", type: "checkbox", label: "Enable Scrolling Text", labelAr: "تفعيل النص المتحرك", default: true, group: "Effects", groupAr: "التأثيرات" },
      { key: "enableWaves", type: "checkbox", label: "Enable Wave Dividers", labelAr: "تفعيل فواصل الموجة", default: true, group: "Effects", groupAr: "التأثيرات" },
    ],
  },
  "gilded-glamour-boutique": {
    themeId: "gilded-glamour-boutique",
    settings: [
      { key: "primary_color", type: "color", label: "Gold Accent", labelAr: "ذهبي", default: "#B1A670", group: "Colors", groupAr: "الألوان" },
      { key: "secondary_color", type: "color", label: "Background", labelAr: "الخلفية", default: "#F7F3EC", group: "Colors", groupAr: "الألوان" },
      { key: "accent_color", type: "color", label: "Gold Dark", labelAr: "ذهبي داكن", default: "#8A7F53", group: "Colors", groupAr: "الألوان" },
      { key: "background_color", type: "color", label: "Background", labelAr: "الخلفية", default: "#F7F3EC", group: "Colors", groupAr: "الألوان" },
      { key: "text_color", type: "color", label: "Text", labelAr: "النص", default: "#000000", group: "Colors", groupAr: "الألوان" },
      { key: "color_gold_light", type: "color", label: "Gold Light", labelAr: "ذهبي فاتح", default: "#C8BF93", group: "Colors", groupAr: "الألوان" },
      { key: "color_olive", type: "color", label: "Olive Accent", labelAr: "زيتوني", default: "#636A47", group: "Colors", groupAr: "الألوان" },
      { key: "color_soft_pink", type: "color", label: "Soft Pink", labelAr: "وردي ناعم", default: "#E2B4B4", group: "Colors", groupAr: "الألوان" },
      { key: "color_sale", type: "color", label: "Sale Badge", labelAr: "شارة التخفيض", default: "#A20000", group: "Colors", groupAr: "الألوان" },
      {
        key: "heading_font", type: "font", label: "Heading Font", labelAr: "خط العناوين", default: "Montserrat",
        group: "Typography", groupAr: "الخطوط",
        options: [
          { label: "Montserrat", labelAr: "Montserrat", value: "Montserrat" },
          { label: "Inter", labelAr: "Inter", value: "Inter" },
          { label: "Playfair Display", labelAr: "Playfair Display", value: "Playfair Display" },
          { label: "Cairo", labelAr: "Cairo", value: "Cairo" },
          { label: "Tajawal", labelAr: "Tajawal", value: "Tajawal" },
        ],
      },
      {
        key: "body_font", type: "font", label: "Body Font", labelAr: "خط النص", default: "Montserrat",
        group: "Typography", groupAr: "الخطوط",
        options: [
          { label: "Montserrat", labelAr: "Montserrat", value: "Montserrat" },
          { label: "Inter", labelAr: "Inter", value: "Inter" },
          { label: "Cairo", labelAr: "Cairo", value: "Cairo" },
        ],
      },
      { key: "border_radius", type: "range", label: "Border Radius", labelAr: "نصف قطر الحدود", default: 0, min: 0, max: 16, step: 1, unit: "px", group: "Layout", groupAr: "التخطيط" },
      {
        key: "product_grid_columns", type: "select", label: "Product Grid Columns", labelAr: "أعمدة شبكة المنتجات", default: "5",
        group: "Layout", groupAr: "التخطيط",
        options: [
          { label: "3 Columns", labelAr: "٣ أعمدة", value: "3" },
          { label: "4 Columns", labelAr: "٤ أعمدة", value: "4" },
          { label: "5 Columns", labelAr: "٥ أعمدة", value: "5" },
        ],
      },
      { key: "show_product_rating", type: "checkbox", label: "Show Product Rating", labelAr: "إظهار تقييم المنتج", default: true, group: "Layout", groupAr: "التخطيط" },

      // Hero
      { key: "hero_headline", type: "text", label: "Hero Headline", labelAr: "عنوان البانر", default: "THE NEW EMPIRE", group: "Hero", groupAr: "البانر" },
      { key: "hero_subtitle", type: "text", label: "Hero Subtitle", labelAr: "عنوان فرعي للبانر", default: "Curated Excellence & Timeless Precision", group: "Hero", groupAr: "البانر" },
      { key: "hero_cta_text", type: "text", label: "Hero Button Text", labelAr: "نص زر البانر", default: "Discover Collection", group: "Hero", groupAr: "البانر" },
      { key: "hero_image_url", type: "image", label: "Hero Background Image", labelAr: "صورة خلفية البانر", default: "", group: "Hero", groupAr: "البانر" },
      { key: "hero_image_mobile", type: "image", label: "Hero Image (Mobile)", labelAr: "صورة البانر للهاتف", default: "", group: "Hero", groupAr: "البانر" },

      // Content
      { key: "new_badge_text", type: "text", label: "New Product Badge", labelAr: "نص شارة المنتج الجديد", default: "New Arrival", group: "Content", groupAr: "المحتوى" },
      { key: "featured_badge_text", type: "text", label: "Featured Product Badge", labelAr: "شارة المنتج المميز", default: "Limited Edition", group: "Content", groupAr: "المحتوى" },
      { key: "grid_title", type: "text", label: "Product Grid Title", labelAr: "عنوان شبكة المنتجات", default: "Crafted for the Eternal Wardrobe", group: "Content", groupAr: "المحتوى" },
      { key: "grid_subtitle", type: "text", label: "Product Grid Subtitle", labelAr: "عنوان فرعي لشبكة المنتجات", default: "The Artisan Way", group: "Content", groupAr: "المحتوى" },
      { key: "brand_statement", type: "text", label: "Brand Statement", labelAr: "بيان العلامة التجارية", default: "WHERE HERITAGE MEETS THE FUTURE", group: "Content", groupAr: "المحتوى" },
      { key: "brand_statement_body", type: "textarea", label: "Brand Statement Body", labelAr: "وصف بيان العلامة التجارية", default: "Every thread tells a story, every silhouette commands a room, and every piece is destined to become an heirloom.", group: "Content", groupAr: "المحتوى" },

      // Footer
      { key: "footer_tagline", type: "text", label: "Footer Tagline", labelAr: "شعار التذييل", default: "The Gilded Curator — curated excellence and timeless precision since 2024.", group: "Footer", groupAr: "التذييل" },
      { key: "newsletter_title", type: "text", label: "Newsletter Title", labelAr: "عنوان النشرة", default: "Newsletter", group: "Footer", groupAr: "التذييل" },
      { key: "newsletter_subtitle", type: "text", label: "Newsletter Subtitle", labelAr: "عنوان فرعي للنشرة", default: "Join the empire. Be first to know.", group: "Footer", groupAr: "التذييل" },
      { key: "newsletter_button_text", type: "text", label: "Newsletter Button", labelAr: "زر النشرة", default: "Join", group: "Footer", groupAr: "التذييل" },

      // Effects
      { key: "enable_parallax", type: "checkbox", label: "Enable Hero Parallax", labelAr: "تفعيل تأثير المنظور للبانر", default: true, group: "Effects", groupAr: "التأثيرات" },
      { key: "enable_scroll_fill", type: "checkbox", label: "Enable Scroll-Fill Text", labelAr: "تفعيل تأثير ملء النص بالتمرير", default: true, group: "Effects", groupAr: "التأثيرات" },
      { key: "enable_hover_scale", type: "checkbox", label: "Enable Product Hover Scale", labelAr: "تفعيل تكبير المنتج عند المرور", default: true, group: "Effects", groupAr: "التأثيرات" },
      { key: "enable_animations", type: "checkbox", label: "Enable Animations", labelAr: "تفعيل الحركات", default: true, group: "Effects", groupAr: "التأثيرات" },
    ],
  },
  "vionne": {
    themeId: "vionne",
    settings: [
      { key: "primary_color", type: "color", label: "Primary (Black)", labelAr: "الأساسي", default: "#050505", group: "Colors", groupAr: "الألوان" },
      { key: "secondary_color", type: "color", label: "Section Band (Light Gray)", labelAr: "خلفية القسم", default: "#F4F4F4", group: "Colors", groupAr: "الألوان" },
      { key: "accent_color", type: "color", label: "Header / Footer Surface", labelAr: "هيدر/فوتر", default: "#3A3A3A", group: "Colors", groupAr: "الألوان" },
      { key: "background_color", type: "color", label: "Page Background", labelAr: "خلفية الصفحة", default: "#FFFFFF", group: "Colors", groupAr: "الألوان" },
      { key: "text_color", type: "color", label: "Text Color", labelAr: "لون النص", default: "#050505", group: "Colors", groupAr: "الألوان" },
      { key: "color_border", type: "color", label: "Border", labelAr: "الحدود", default: "#DADADA", group: "Colors", groupAr: "الألوان" },
      { key: "color_muted", type: "color", label: "Muted Text", labelAr: "نص ثانوي", default: "#8B8B8B", group: "Colors", groupAr: "الألوان" },
      { key: "color_sale", type: "color", label: "Sale Badge", labelAr: "شارة التخفيض", default: "#A20000", group: "Colors", groupAr: "الألوان" },

      {
        key: "heading_font", type: "font", label: "Heading Font", labelAr: "خط العناوين", default: "Neue Haas Grotesk Display Pro",
        group: "Typography", groupAr: "الخطوط",
        options: [
          { label: "Neue Haas Grotesk Display Pro", labelAr: "Neue Haas Grotesk Display Pro", value: "Neue Haas Grotesk Display Pro" },
          { label: "Helvetica Neue", labelAr: "Helvetica Neue", value: "Helvetica Neue" },
          { label: "Inter", labelAr: "Inter", value: "Inter" },
          { label: "Cairo", labelAr: "Cairo", value: "Cairo" },
        ],
      },
      {
        key: "body_font", type: "font", label: "Body Font", labelAr: "خط النص", default: "Neue Haas Grotesk Text Pro",
        group: "Typography", groupAr: "الخطوط",
        options: [
          { label: "Neue Haas Grotesk Text Pro", labelAr: "Neue Haas Grotesk Text Pro", value: "Neue Haas Grotesk Text Pro" },
          { label: "Helvetica Neue", labelAr: "Helvetica Neue", value: "Helvetica Neue" },
          { label: "Inter", labelAr: "Inter", value: "Inter" },
          { label: "Cairo", labelAr: "Cairo", value: "Cairo" },
        ],
      },

      { key: "announcement_text", type: "text", label: "Announcement Marquee", labelAr: "نص الشريط العلوي", default: "FREE SHIPPING ABOVE 1500 EGP   •   NEW COLLECTION   •   WORLDWIDE DELIVERY   •", group: "Header", groupAr: "الهيدر" },
      { key: "announcement_speed", type: "range", label: "Marquee duration (s)", labelAr: "مدة التمرير (ث)", default: 25, min: 10, max: 60, step: 5, group: "Header", groupAr: "الهيدر" },
      { key: "show_mobile_dock", type: "checkbox", label: "Show Mobile Bottom Dock", labelAr: "شريط الموبايل السفلي", default: true, group: "Header", groupAr: "الهيدر" },
      { key: "show_about_link", type: "checkbox", label: "Show About Link", labelAr: "رابط من نحن", default: true, group: "Header", groupAr: "الهيدر" },
      { key: "show_contact_link", type: "checkbox", label: "Show Contact Link", labelAr: "رابط اتصل بنا", default: true, group: "Header", groupAr: "الهيدر" },

      { key: "footer_about_text", type: "textarea", label: "Footer Tagline", labelAr: "نص الفوتر", default: "Modest, refined, made to be lived in.", group: "Footer", groupAr: "الفوتر" },
      { key: "newsletter_title", type: "text", label: "Newsletter Title", labelAr: "عنوان النشرة", default: "Stay in the loop", group: "Footer", groupAr: "الفوتر" },
      { key: "newsletter_subtitle", type: "text", label: "Newsletter Subtitle", labelAr: "وصف النشرة", default: "Be first to know about new arrivals and exclusive drops.", group: "Footer", groupAr: "الفوتر" },

      { key: "popup_enabled", type: "checkbox", label: "Enable Newsletter Popup", labelAr: "تفعيل نافذة النشرة", default: false, group: "Popups", groupAr: "النوافذ" },
      { key: "popup_delay_seconds", type: "range", label: "Popup Delay (s)", labelAr: "تأخير النافذة (ث)", default: 8, min: 1, max: 30, step: 1, group: "Popups", groupAr: "النوافذ" },
      { key: "popup_title", type: "text", label: "Popup Title", labelAr: "عنوان النافذة", default: "Welcome to Vionne", group: "Popups", groupAr: "النوافذ" },
      { key: "popup_subtitle", type: "text", label: "Popup Subtitle", labelAr: "وصف النافذة", default: "Subscribe to receive 10% off your first order.", group: "Popups", groupAr: "النوافذ" },
      { key: "popup_button_text", type: "text", label: "Popup Button Text", labelAr: "نص زر النافذة", default: "Subscribe", group: "Popups", groupAr: "النوافذ" },
      { key: "popup_image", type: "image", label: "Popup Image", labelAr: "صورة النافذة", default: "", group: "Popups", groupAr: "النوافذ" },

      { key: "cookie_enabled", type: "checkbox", label: "Enable Cookie Banner", labelAr: "شريط الكوكيز", default: true, group: "Popups", groupAr: "النوافذ" },
      { key: "cookie_message", type: "textarea", label: "Cookie Message", labelAr: "نص الكوكيز", default: "We use cookies to improve your experience and analyze site usage.", group: "Popups", groupAr: "النوافذ" },
      { key: "cookie_accept_text", type: "text", label: "Accept text", labelAr: "نص القبول", default: "Accept", group: "Popups", groupAr: "النوافذ" },
      { key: "cookie_decline_text", type: "text", label: "Decline text", labelAr: "نص الرفض", default: "Decline", group: "Popups", groupAr: "النوافذ" },

      { key: "border_radius", type: "range", label: "Border Radius", labelAr: "زوايا منحنية", default: 4, min: 0, max: 20, step: 2, unit: "px", group: "Layout", groupAr: "التخطيط" },
      { key: "enable_animations", type: "checkbox", label: "Enable Animations", labelAr: "تفعيل الحركات", default: true, group: "Effects", groupAr: "التأثيرات" },
      { key: "enableHideOnScroll", type: "checkbox", label: "Hide header on scroll down", labelAr: "إخفاء الهيدر عند التمرير", default: true, group: "Effects", groupAr: "التأثيرات" },
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
