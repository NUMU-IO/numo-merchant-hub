import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  Globe, Lock, Palette, ScrollText, Settings2, Truck, Upload, Sparkles,
  Check, Store, Type, ShoppingBag, MessageSquare, Eye, EyeOff,
  Trash2, Plus, Loader2, ExternalLink, Phone, Compass, Tag, LayoutGrid,
  ChevronUp, ChevronDown,
} from "lucide-react";
import { ThemePreview } from "@/components/ThemePreview";
import {
  identitySettings,
  headerSettings,
  productsSettings,
  footerSettings,
  navigationSettings,
  labelsSettings,
  pageLayoutSettings,
  themeSchemas,
  groupSettings,
  type SettingDefinition,
} from "@/data/theme-schemas";
import {
  fetchCustomization,
  updateCustomization,
  publishCustomization,
  fetchThemes,
  fetchThemeSchemas,
  type AvailableTheme,
  type ThemeSchemaBundle,
  type TemplateConfigData,
  type SectionSettingDefinition,
  type CustomizationData,
} from "@/services/themeApi";
import {
  SchemaForm,
  SectionList,
  SectionEditor,
  AddSectionSheet,
  CustomizationWalkthrough,
  useWalkthroughStatus,
  ThemeMarketplace,
} from "@/components/theme-editor";
import type { SettingValue } from "@/components/theme-editor/SettingControl";
import { updateStore } from "@/services/storeApi";
import { getStoreUrl, getStoreDomainSuffix } from "@/lib/storefront";
import {
  fetchShippingSettings,
  addShippingZone,
  deleteShippingZone,
  updateShippingSettings,
  type ShippingSettings,
} from "@/services/storeApi";

// ─── Preload Google Fonts for font picker ────────────────────────────────────
const AVAILABLE_FONTS = [
  "Cairo", "Tajawal", "IBM Plex Sans Arabic", "Noto Sans Arabic",
  "El Messiri", "Almarai", "Changa", "Rubik", "Readex Pro",
  "Inter", "Poppins", "Space Grotesk",
];

const HARDCODED_FONT_SETTINGS = [
  { key: "heading_font", type: "font" as const, label: "Heading Font", labelAr: "خط العناوين", default: "Cairo", group: "Typography", groupAr: "الخطوط" },
  { key: "body_font", type: "font" as const, label: "Body Font", labelAr: "خط النصوص", default: "Cairo", group: "Typography", groupAr: "الخطوط" },
];

/** Ensure heading_font + body_font are always present in a settings list */
function ensureFontSettings(settings: SectionSettingDefinition[]): SectionSettingDefinition[] {
  const keys = new Set(settings.map((s) => s.key));
  const missing = HARDCODED_FONT_SETTINGS.filter((f) => !keys.has(f.key));
  return missing.length ? [...settings, ...missing] : settings;
}

const _fontsPreloaded = { done: false };
function preloadAllFonts() {
  if (_fontsPreloaded.done) return;
  _fontsPreloaded.done = true;
  const families = AVAILABLE_FONTS.map(f => `family=${encodeURIComponent(f)}:wght@400;600;700`).join("&");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);
}

// ─── Inline Setting Field Renderer ──────────────────────────────────────────

function SettingField({
  setting,
  value,
  onChange,
  language,
}: {
  setting: SettingDefinition;
  value: SettingValue;
  onChange: (key: string, val: SettingValue) => void;
  language: string;
}) {
  const label = language === "ar" ? setting.labelAr : setting.label;

  // Font picker for any setting with _font key suffix or type:"font"
  if (setting.key.endsWith("_font") || setting.type === "font") {
    const currentFont = (value as string) || (setting.default as string) || "Cairo";
    return (
      <div className="grid gap-2">
        <Label>{label}</Label>
        <div
          className="rounded-lg border bg-muted/30 p-3 text-center"
          style={{ fontFamily: `'${currentFont}', sans-serif` }}
        >
          <p className="text-lg font-bold">أهلاً وسهلاً</p>
          <p className="text-sm text-muted-foreground">Hello World — {currentFont}</p>
        </div>
        <div className="grid grid-cols-2 gap-1.5 max-h-[240px] overflow-y-auto rounded-lg border p-1.5">
          {AVAILABLE_FONTS.map((fontName) => {
            const isSelected = fontName === currentFont;
            return (
              <button
                key={fontName}
                type="button"
                onClick={() => onChange(setting.key, fontName)}
                className={`rounded-md px-2.5 py-2 text-start transition-all hover:bg-accent/50 ${
                  isSelected
                    ? "bg-primary/10 border border-primary ring-1 ring-primary/20"
                    : "border border-transparent"
                }`}
                style={{ fontFamily: `'${fontName}', sans-serif` }}
              >
                <span className="block text-sm font-semibold truncate">{fontName}</span>
                <span className="block text-xs text-muted-foreground mt-0.5" style={{ fontFamily: `'${fontName}', sans-serif` }}>
                  مرحباً بالعالم
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  switch (setting.type as string) {
    case "text":
      return (
        <div className="grid gap-2">
          <Label>{label}</Label>
          {setting.description && <p className="text-xs text-muted-foreground">{setting.description}</p>}
          <Input
            value={String(value || "")}
            onChange={(e) => onChange(setting.key, e.target.value)}
            placeholder={label}
          />
        </div>
      );
    case "color":
      return (
        <div className="grid gap-2">
          <Label>{label}</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={String(value || "#000000")}
              onChange={(e) => onChange(setting.key, e.target.value)}
              className="h-10 w-14 rounded-md border border-input cursor-pointer"
            />
            <Input
              value={String(value || "")}
              onChange={(e) => onChange(setting.key, e.target.value)}
              className="font-mono"
              placeholder="#000000"
            />
          </div>
        </div>
      );
    case "checkbox":
      return (
        <div className="flex items-center justify-between rounded-lg border p-3">
          <Label className="cursor-pointer">{label}</Label>
          <Switch
            checked={value === true || value === "true"}
            onCheckedChange={(checked) => onChange(setting.key, checked)}
          />
        </div>
      );
    case "image":
      return (
        <div className="grid gap-2">
          <Label>{label}</Label>
          <div className="flex items-center gap-3">
            {value ? (
              <img src={String(value)} alt={label} className="h-16 w-16 rounded-lg object-cover border" />
            ) : (
              <div className="h-16 w-16 rounded-lg border-2 border-dashed border-border bg-muted flex items-center justify-center text-muted-foreground text-xs">
                {language === "ar" ? "صورة" : "IMG"}
              </div>
            )}
            <Input
              value={String(value || "")}
              onChange={(e) => onChange(setting.key, e.target.value)}
              placeholder={language === "ar" ? "رابط الصورة" : "Image URL"}
              className="flex-1"
            />
          </div>
        </div>
      );
    case "select":
      return (
        <div className="grid gap-2">
          <Label>{label}</Label>
          <Select value={String(value || setting.default)} onValueChange={(v) => onChange(setting.key, v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {setting.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {language === "ar" ? opt.labelAr : opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "range":
      return (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>{label}</Label>
            <span className="text-sm text-muted-foreground">{value ?? setting.default}{setting.unit || ""}</span>
          </div>
          <input
            type="range"
            min={setting.min}
            max={setting.max}
            step={setting.step}
            value={Number(value ?? setting.default)}
            onChange={(e) => onChange(setting.key, Number(e.target.value))}
            className="w-full"
          />
        </div>
      );
    default:
      return null;
  }
}

// ─── Nav Links Editor ────────────────────────────────────────────────────────

const AVAILABLE_ROUTES = [
  { value: "/", labelEn: "Home", labelAr: "الرئيسية" },
  { value: "/products", labelEn: "All Products", labelAr: "كل المنتجات" },
  { value: "/products?category=clothing", labelEn: "Clothing", labelAr: "ملابس" },
  { value: "/products?category=accessories", labelEn: "Accessories", labelAr: "إكسسوارات" },
  { value: "/products?category=shoes", labelEn: "Shoes", labelAr: "أحذية" },
  { value: "/products?category=bags", labelEn: "Bags", labelAr: "شنط" },
  { value: "/products?category=electronics", labelEn: "Electronics", labelAr: "إلكترونيات" },
  { value: "/products?tag=new", labelEn: "New Arrivals", labelAr: "وصل حديثاً" },
  { value: "/products?tag=bestseller", labelEn: "Best Sellers", labelAr: "الأكثر مبيعاً" },
  { value: "/shipping", labelEn: "Shipping", labelAr: "الشحن والتوصيل" },
  { value: "/returns", labelEn: "Returns", labelAr: "الاسترجاع" },
  { value: "/contact", labelEn: "Contact", labelAr: "تواصل معانا" },
];

function NavLinksEditor({
  links,
  onChange,
  language,
}: {
  links: Array<{ label: string; to: string }>;
  onChange: (links: Array<{ label: string; to: string }>) => void;
  language: string;
}) {
  const addLink = () => onChange([...links, { label: "", to: "/" }]);
  const removeLink = (i: number) => onChange(links.filter((_, idx) => idx !== i));
  const updateLink = (i: number, field: "label" | "to", value: string) =>
    onChange(links.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  const moveLink = (i: number, dir: -1 | 1) => {
    const next = [...links];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">
          {language === "ar" ? "روابط التنقل" : "Navigation Links"}
        </Label>
        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={addLink}>
          <Plus className="h-3 w-3" />
          {language === "ar" ? "إضافة" : "Add"}
        </Button>
      </div>
      {links.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {language === "ar" ? "سيتم استخدام الروابط الافتراضية" : "Default links will be used"}
        </p>
      )}
      {links.map((link, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border p-2">
          <div className="flex flex-col gap-0.5">
            <button onClick={() => moveLink(i, -1)} className="p-0.5 hover:bg-muted rounded" disabled={i === 0}>
              <ChevronUp className="h-3 w-3" />
            </button>
            <button onClick={() => moveLink(i, 1)} className="p-0.5 hover:bg-muted rounded" disabled={i === links.length - 1}>
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <Input
            value={link.label}
            onChange={(e) => updateLink(i, "label", e.target.value)}
            placeholder={language === "ar" ? "النص" : "Label"}
            className="flex-1 h-8 text-xs"
          />
          <select
            value={link.to}
            onChange={(e) => updateLink(i, "to", e.target.value)}
            className="flex-1 h-8 text-xs rounded-md border border-input bg-background px-2"
            dir="ltr"
          >
            {AVAILABLE_ROUTES.map((route) => (
              <option key={route.value} value={route.value}>
                {language === "ar" ? route.labelAr : route.labelEn} ({route.value})
              </option>
            ))}
          </select>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeLink(i)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SECTION_CONFIG = [
  { key: "identity", label: "Identity", labelAr: "الهوية", icon: Store, settings: identitySettings },
  { key: "header", label: "Header", labelAr: "الهيدر", icon: Type, settings: headerSettings },
  { key: "navigation", label: "Navigation", labelAr: "التنقل", icon: Compass, settings: navigationSettings },
  { key: "products", label: "Products", labelAr: "المنتجات", icon: ShoppingBag, settings: productsSettings },
  { key: "labels", label: "Labels", labelAr: "التسميات", icon: Tag, settings: labelsSettings },
  { key: "layout", label: "Page Layout", labelAr: "تخطيط الصفحة", icon: LayoutGrid, settings: pageLayoutSettings },
  { key: "footer", label: "Footer", labelAr: "الفوتر", icon: MessageSquare, settings: footerSettings },
] as const;

const THEME_PREVIEWS: Record<string, { bg: string; fg: string; accent: string; icon: string }> = {
  modern: { bg: "#f8fafc", fg: "#0f172a", accent: "#3b82f6", icon: "✨" },
  boutique: { bg: "#fdf2f8", fg: "#831843", accent: "#ec4899", icon: "🌸" },
  elegant: { bg: "#fffbeb", fg: "#78350f", accent: "#d97706", icon: "👑" },
  skeuomorphic: { bg: "#ecfdf5", fg: "#064e3b", accent: "#10b981", icon: "🎨" },
  "tech-wave": { bg: "#0a0e1a", fg: "#e0e6ed", accent: "#00d4ff", icon: "⚡" },
  "neo-brutalism": { bg: "#fefce8", fg: "#1a1a1a", accent: "#a3e635", icon: "💥" },
  editorial: { bg: "#f0f2ec", fg: "#1b1b1b", accent: "#2d6a4f", icon: "📰" },
  "luxury-minimal": { bg: "#ffffff", fg: "#1a1a1a", accent: "#b8860b", icon: "💎" },
};

function extractNonEmpty(state: Record<string, string | number | boolean>): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(state)) {
    if (v !== "" && v !== undefined && v !== null) result[k] = v;
  }
  return result;
}

// ─── Component ──────────────────────────────────────────────────────────────

const StoreSettings = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore, refetchStores } = useDashboardStore();

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [policyTab, setPolicyTab] = useState("return");
  const [, resetWalkthrough] = useWalkthroughStatus();
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  // ─── Profile state ──────────────────────────────────────────────────────
  const [profileState, setProfileState] = useState({
    name: "", description: "", contact_email: "", contact_phone: "",
    whatsapp_phone: "",
    facebook: "", instagram: "", twitter: "",
  });

  // ─── Theme / Customization state ────────────────────────────────────────
  const [availableThemes, setAvailableThemes] = useState<AvailableTheme[]>([]);
  const [activeTheme, setActiveTheme] = useState("modern");
  const [themeState, setThemeState] = useState<Record<string, SettingValue>>({});
  const [identityState, setIdentityState] = useState<Record<string, SettingValue>>({});
  const [headerState, setHeaderState] = useState<Record<string, SettingValue>>({});
  const [heroState, setHeroState] = useState<Record<string, SettingValue>>({});
  const [productsState, setProductsState] = useState<Record<string, SettingValue>>({});
  const [footerState, setFooterState] = useState<Record<string, SettingValue>>({});
  const [navigationState, setNavigationState] = useState<Record<string, SettingValue>>({});
  const [labelsState, setLabelsState] = useState<Record<string, SettingValue>>({});
  const [layoutState, setLayoutState] = useState<Record<string, SettingValue>>({});
  const [navLinks, setNavLinks] = useState<Array<{ label: string; to: string }>>([]);
  const [homeSections, setHomeSections] = useState<Array<{ id: string; label: string; enabled: boolean }>>([
    { id: "hero", label: "القسم الرئيسي", enabled: true },
    { id: "categories", label: "الفئات", enabled: true },
    { id: "new_arrivals", label: "وصل حديثاً", enabled: true },
    { id: "promo", label: "عرض ترويجي", enabled: true },
    { id: "best_sellers", label: "الأكثر مبيعاً", enabled: true },
    { id: "testimonials", label: "آراء العملاء", enabled: true },
    { id: "newsletter", label: "النشرة البريدية", enabled: true },
  ]);

  // ─── V2 Section Engine state ─────────────────────────────────────────────
  const [themeSchemaBundle, setThemeSchemaBundle] = useState<ThemeSchemaBundle | null>(null);
  const [templateConfig, setTemplateConfig] = useState<TemplateConfigData | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);

  // ─── Shipping state ─────────────────────────────────────────────────────
  const [shippingData, setShippingData] = useState<ShippingSettings | null>(null);
  const [freeThreshold, setFreeThreshold] = useState(500);
  const [newZone, setNewZone] = useState({ zone: "", governorates: "", rate: 0, estimated_days: "" });
  const [showAddZone, setShowAddZone] = useState(false);

  // ─── Status state ───────────────────────────────────────────────────────
  const [storeOnline, setStoreOnline] = useState(true);

  // ─── Resizable preview ─────────────────────────────────────────────────
  const [previewPct, setPreviewPct] = useState(50);
  const splitRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (mv: MouseEvent) => {
      if (!draggingRef.current || !splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const isRtl = document.documentElement.dir === "rtl";
      const x = isRtl ? rect.right - mv.clientX : mv.clientX - rect.left;
      const settingsPct = (x / rect.width) * 100;
      setPreviewPct(Math.max(25, Math.min(75, 100 - settingsPct)));
    };

    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  // Section maps for customization
  const sectionStates: Record<string, Record<string, SettingValue>> = {
    identity: identityState, header: headerState, hero: heroState,
    products: productsState, footer: footerState,
    navigation: navigationState, labels: labelsState, layout: layoutState,
  };
  const sectionSetters: Record<string, React.Dispatch<React.SetStateAction<Record<string, SettingValue>>>> = {
    identity: setIdentityState, header: setHeaderState, hero: setHeroState,
    products: setProductsState, footer: setFooterState,
    navigation: setNavigationState, labels: setLabelsState, layout: setLayoutState,
  };

  const handleSectionChange = useCallback(
    (section: string) => (key: string, value: SettingValue) => {
      sectionSetters[section]?.((prev) => ({ ...prev, [key]: value }));
      setIsDirty(true);
    },
    []
  );

  const handleThemeSettingChange = useCallback((key: string, value: SettingValue) => {
    setThemeState((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  // ─── Effects ────────────────────────────────────────────────────────────

  // Preload all Google Fonts on mount so font picker shows actual styles
  useEffect(() => { preloadAllFonts(); }, []);

  // Pre-populate profile from currentStore
  useEffect(() => {
    if (!currentStore) return;
    setProfileState({
      name: currentStore.name || "",
      description: currentStore.description || "",
      contact_email: currentStore.contact_email || "",
      contact_phone: currentStore.contact_phone || "",
      whatsapp_phone: currentStore.social_links?.whatsapp || "",
      facebook: currentStore.social_links?.facebook || "",
      instagram: currentStore.social_links?.instagram || "",
      twitter: currentStore.social_links?.twitter || "",
    });
    setStoreOnline(currentStore.status === "active");
  }, [currentStore?.id]);

  // Fetch available themes
  useEffect(() => {
    fetchThemes().then(setAvailableThemes).catch(() => {});
  }, []);

  // Fetch theme schemas when theme changes
  useEffect(() => {
    setSelectedSectionId(null);
    fetchThemeSchemas(activeTheme)
      .then((bundle) => {
        setThemeSchemaBundle(bundle);
        // Initialize template from defaults if not yet set from customization v2 data
        setTemplateConfig((prev) => prev ?? (bundle.default_templates?.home ?? null));
      })
      .catch(() => {
        setThemeSchemaBundle(null);
        toast.error(
          language === "ar"
            ? "فشل تحميل إعدادات الثيم. الإعدادات الأساسية ستظهر بدلاً منها."
            : "Failed to load theme schemas. Falling back to basic settings.",
        );
      });
  }, [activeTheme]);

  // Pre-populate customization from API
  useEffect(() => {
    if (!currentStore?.id) return;
    fetchCustomization(currentStore.id)
      .then((data) => {
        if (data.theme) {
          const { base_theme, ...rest } = data.theme;
          if (base_theme) setActiveTheme(base_theme);
          setThemeState(rest);
        }
        if (data.identity) setIdentityState({ ...data.identity });
        if (data.header) setHeaderState({ ...data.header });
        if (data.hero) setHeroState({ ...data.hero });
        if (data.products) setProductsState({ ...data.products });
        if (data.footer) {
          const { social_links, ...rest } = data.footer;
          setFooterState({ ...rest, ...(social_links || {}) });
        }
        if (data.navigation) {
          const { links, ...navRest } = data.navigation;
          setNavigationState({ ...navRest });
          if (links && Array.isArray(links)) setNavLinks(links);
        }
        if (data.labels) setLabelsState({ ...data.labels });
        if (data.layout) {
          const { home_sections, ...layoutRest } = data.layout;
          setLayoutState({ ...layoutRest });
          if (home_sections && Array.isArray(home_sections)) {
            setHomeSections((prev) =>
              prev
                .map((s) => ({ ...s, enabled: home_sections.includes(s.id) }))
                .sort((a, b) => {
                  const ai = home_sections.indexOf(a.id);
                  const bi = home_sections.indexOf(b.id);
                  if (ai === -1 && bi === -1) return 0;
                  if (ai === -1) return 1;
                  if (bi === -1) return -1;
                  return ai - bi;
                })
            );
          }
        }
        // V2: Load template if available
        const extData = data as CustomizationData & { schema_version?: number; templates?: { home: TemplateConfigData } };
        if (extData.schema_version === 2 && extData.templates?.home) {
          setTemplateConfig(extData.templates.home);
        }
      })
      .catch(() => {});
  }, [currentStore?.id]);

  // Fetch shipping settings
  useEffect(() => {
    if (!currentStore?.id) return;
    fetchShippingSettings(currentStore.id)
      .then((data) => {
        setShippingData(data);
        setFreeThreshold(data.free_shipping_threshold || 500);
      })
      .catch(() => {});
  }, [currentStore?.id]);

  // ─── V2 Template Handlers ───────────────────────────────────────────────

  const handleSectionReorder = useCallback((fromIndex: number, toIndex: number) => {
    setTemplateConfig((prev) => {
      if (!prev) return prev;
      const newOrder = [...prev.order];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);
      return { ...prev, order: newOrder };
    });
    setIsDirty(true);
  }, []);

  const handleToggleSection = useCallback((sectionId: string, disabled: boolean) => {
    setTemplateConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [sectionId]: { ...prev.sections[sectionId], disabled },
        },
      };
    });
    setIsDirty(true);
  }, []);

  const handleAddSection = useCallback((sectionType: string, presetIndex?: number) => {
    if (!sectionType) {
      setShowAddSheet(true);
      return;
    }
    if (!themeSchemaBundle) return;

    const schema = themeSchemaBundle.sections.find((s) => s.type === sectionType);
    if (!schema) return;

    // Check section limit
    if (schema.limit && templateConfig) {
      const count = Object.values(templateConfig.sections).filter((s) => s.type === sectionType).length;
      if (count >= schema.limit) {
        toast.error(language === "ar" ? "تم الوصول للحد الأقصى لهذا القسم" : `Maximum ${schema.limit} of this section type`);
        return;
      }
    }

    const id = `${sectionType}_${Math.random().toString(36).slice(2, 6)}`;

    // Collect defaults from schema
    const defaults: Record<string, SettingValue> = {};
    for (const s of schema.settings) {
      if (s.default !== undefined) defaults[s.key] = s.default;
    }

    // Override with preset settings
    const preset = presetIndex !== undefined ? schema.presets?.[presetIndex] : undefined;
    const settings = preset?.settings ? { ...defaults, ...preset.settings } : defaults;

    setTemplateConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: { ...prev.sections, [id]: { id, type: sectionType, settings } },
        order: [...prev.order, id],
      };
    });
    setSelectedSectionId(id);
    setIsDirty(true);
    setShowAddSheet(false);
  }, [themeSchemaBundle, templateConfig, language]);

  const handleRemoveSection = useCallback((sectionId: string) => {
    setTemplateConfig((prev) => {
      if (!prev) return prev;
      const { [sectionId]: _, ...restSections } = prev.sections;
      return { ...prev, sections: restSections, order: prev.order.filter((id) => id !== sectionId) };
    });
    if (selectedSectionId === sectionId) setSelectedSectionId(null);
    setIsDirty(true);
  }, [selectedSectionId]);

  const handleSectionSettingChange = useCallback((sectionId: string, key: string, value: SettingValue) => {
    setTemplateConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [sectionId]: {
            ...prev.sections[sectionId],
            settings: { ...prev.sections[sectionId].settings, [key]: value },
          },
        },
      };
    });
    setIsDirty(true);
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const buildFullPayload = useCallback(() => {
    const footerClean = extractNonEmpty(footerState);
    const { facebook, instagram, twitter, whatsapp, ...footerRest } = footerClean;
    const socialRaw = extractNonEmpty({ facebook, instagram, twitter, whatsapp });
    const social_links = Object.keys(socialRaw).length > 0
      ? { facebook: socialRaw.facebook || "", instagram: socialRaw.instagram || "", twitter: socialRaw.twitter || "", whatsapp: socialRaw.whatsapp || "" }
      : undefined;

    const navPayload: Record<string, unknown> = { ...extractNonEmpty(navigationState) };
    if (navLinks.length > 0) navPayload.links = navLinks;

    const layoutPayload: Record<string, unknown> = { ...extractNonEmpty(layoutState) };
    const enabledSections = homeSections.filter((s) => s.enabled).map((s) => s.id);
    if (enabledSections.length > 0) layoutPayload.home_sections = enabledSections;

    // Extract hero from v2 template for v1 backwards compat
    let heroPayload: Record<string, string | number | boolean> = extractNonEmpty(heroState);
    if (templateConfig) {
      const heroSection = Object.values(templateConfig.sections).find((s) => s.type === "hero");
      if (heroSection) heroPayload = { ...heroPayload, ...extractNonEmpty(heroSection.settings as Record<string, string | number | boolean>) };
    }

    // Derive home_sections from v2 template order
    if (templateConfig) {
      const v2ToV1: Record<string, string> = {
        hero: "hero", categories: "categories", "featured-collection": "new_arrivals",
        "promo-banner": "promo", testimonials: "testimonials", newsletter: "newsletter",
      };
      const derived = templateConfig.order
        .filter((id) => !templateConfig.sections[id]?.disabled)
        .map((id) => v2ToV1[templateConfig.sections[id]?.type] || templateConfig.sections[id]?.type)
        .filter(Boolean);
      if (derived.length > 0) layoutPayload.home_sections = derived;
    }

    const payload: Record<string, unknown> = {
      theme: { base_theme: activeTheme, ...extractNonEmpty(themeState) },
      identity: extractNonEmpty(identityState),
      header: extractNonEmpty(headerState),
      hero: heroPayload,
      products: extractNonEmpty(productsState),
      footer: {
        ...footerRest,
        ...(social_links ? { social_links } : {}),
      },
      navigation: Object.keys(navPayload).length > 0 ? navPayload : undefined,
      labels: extractNonEmpty(labelsState),
      layout: Object.keys(layoutPayload).length > 0 ? layoutPayload : undefined,
    };

    // V2 section engine fields
    if (templateConfig) {
      payload.schema_version = 2;
      payload.templates = { home: templateConfig };
    }

    return payload;
  }, [activeTheme, themeState, identityState, headerState, heroState, productsState, footerState, navigationState, labelsState, layoutState, navLinks, homeSections, templateConfig]);

  const saveProfile = useCallback(async () => {
    if (!currentStore?.id) return;
    setIsSaving(true);
    try {
      const social_links: Record<string, string> = {};
      if (profileState.whatsapp_phone) social_links.whatsapp = profileState.whatsapp_phone;
      if (profileState.facebook) social_links.facebook = profileState.facebook;
      if (profileState.instagram) social_links.instagram = profileState.instagram;
      if (profileState.twitter) social_links.twitter = profileState.twitter;

      await updateStore(currentStore.id, {
        name: profileState.name,
        description: profileState.description || null,
        contact_email: profileState.contact_email || null,
        contact_phone: profileState.contact_phone || null,
        social_links: Object.keys(social_links).length > 0 ? social_links : null,
      });
      await refetchStores();
      toast.success(t("store.saved"));
    } catch (err) {
      showError(err, language);
    } finally {
      setIsSaving(false);
    }
  }, [currentStore?.id, profileState, refetchStores, language, t]);

  const saveDraft = useCallback(async () => {
    if (!currentStore?.id) return;
    setIsSaving(true);
    try {
      await updateCustomization(currentStore.id, buildFullPayload());
      setIsDirty(false);
      toast.success(language === "ar" ? "تم حفظ المسودة" : "Draft saved");
    } catch (err) {
      showError(err, language);
    } finally {
      setIsSaving(false);
    }
  }, [currentStore?.id, buildFullPayload, language]);

  const publish = useCallback(async () => {
    if (!currentStore?.id) return;
    setIsSaving(true);
    try {
      await updateCustomization(currentStore.id, buildFullPayload());
      await publishCustomization(currentStore.id);
      setIsDirty(false);
      toast.success(language === "ar" ? "تم النشر بنجاح!" : "Published successfully!");
    } catch (err) {
      showError(err, language);
    } finally {
      setIsSaving(false);
    }
  }, [currentStore?.id, buildFullPayload, language]);

  const handleAddZone = useCallback(async () => {
    if (!currentStore?.id || !newZone.zone) return;
    try {
      const zone = await addShippingZone(currentStore.id, newZone);
      setShippingData((prev) =>
        prev ? { ...prev, zones: [...prev.zones, zone] } : prev
      );
      setNewZone({ zone: "", governorates: "", rate: 0, estimated_days: "" });
      setShowAddZone(false);
      toast.success(language === "ar" ? "تمت الإضافة" : "Zone added");
    } catch (err) {
      showError(err, language);
    }
  }, [currentStore?.id, newZone, language]);

  const handleDeleteZone = useCallback(
    async (zoneId: string) => {
      if (!currentStore?.id) return;
      try {
        await deleteShippingZone(currentStore.id, zoneId);
        setShippingData((prev) =>
          prev ? { ...prev, zones: prev.zones.filter((z) => z.id !== zoneId) } : prev
        );
        toast.success(language === "ar" ? "تم الحذف" : "Zone deleted");
      } catch (err) {
        showError(err, language);
      }
    },
    [currentStore?.id, language]
  );

  const saveFreeThreshold = useCallback(async () => {
    if (!currentStore?.id) return;
    try {
      const result = await updateShippingSettings(currentStore.id, {
        free_shipping_threshold: freeThreshold,
      });
      setShippingData(result);
      toast.success(t("store.saved"));
    } catch (err) {
      showError(err, language);
    }
  }, [currentStore?.id, freeThreshold, language, t]);

  // ─── Tab config ─────────────────────────────────────────────────────────

  const [activeSection, setActiveSection] = useState("profile");

  const navGroups = [
    {
      label: language === "ar" ? "إعداد المتجر" : "Store Setup",
      items: [
        { value: "profile", label: t("store.profile"), icon: Settings2 },
        { value: "domain", label: t("store.domain"), icon: Globe },
        { value: "shipping", label: t("store.shipping"), icon: Truck },
        { value: "policies", label: t("store.policies"), icon: ScrollText },
        { value: "status", label: t("store.status"), icon: Lock },
      ],
    },
    {
      label: language === "ar" ? "المظهر" : "Appearance",
      items: [
        { value: "themes", label: language === "ar" ? "سوق الثيمات" : "Themes", icon: Sparkles },
        { value: "customization", label: t("store.customization"), icon: Palette },
      ],
    },
  ];

  // Current theme settings schema
  const currentThemeSettings = themeSchemas[activeTheme]?.settings || themeSchemas.modern.settings;
  const groupedThemeSettings = groupSettings(currentThemeSettings);

  return (
    <div className="settings-layout">
      {/* ═══ Sidebar Navigation ═══ */}
      <nav className="settings-nav scrollbar-none">
        {navGroups.map((group) => (
          <div key={group.label} className="settings-nav-group">
            <div className="settings-nav-group-label">{group.label}</div>
            {group.items.map((item) => (
              <div
                key={item.value}
                className="settings-nav-item"
                data-active={activeSection === item.value}
                onClick={() => setActiveSection(item.value)}
              >
                <item.icon />
                {item.label}
              </div>
            ))}
          </div>
        ))}
      </nav>

      {/* ═══ Content Area ═══ */}
      <div className="settings-content" data-narrow={activeSection !== "customization"}>

        {/* ─── Profile ─── */}
        {activeSection === "profile" && (
          <div key="profile" className="settings-section-enter">
            <div className="settings-section-header">
              <h2>{t("store.profile")}</h2>
              <p>{language === "ar" ? "معلومات متجرك الأساسية والتواصل" : "Basic store information and contact details"}</p>
            </div>

            {/* Logo */}
            <div className="settings-field-group">
              <div className="settings-field-group-label">{t("store.logo")}</div>
              <div className="flex items-center gap-5 rounded-xl border border-dashed border-border/50 bg-muted/5 p-4 transition-colors hover:border-border/80 hover:bg-muted/10">
                {currentStore?.logo_url ? (
                  <img src={currentStore.logo_url} alt="Logo" className="h-16 w-16 rounded-xl object-cover ring-2 ring-border/20" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted/30 text-muted-foreground">
                    <Store className="h-6 w-6" />
                  </div>
                )}
                <div className="flex-1">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Upload className="h-3.5 w-3.5" />
                    {t("store.uploadLogo")}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {language === "ar" ? "PNG أو JPG، ٥١٢×٥١٢ بكسل كحد أقصى" : "PNG or JPG, max 512×512px"}
                  </p>
                </div>
              </div>
            </div>

            {/* General info */}
            <div className="settings-field-group">
              <div className="settings-field-group-label">
                {language === "ar" ? "معلومات عامة" : "General"}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">{t("store.storeName")}</Label>
                  <Input
                    value={profileState.name}
                    onChange={(e) => setProfileState((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">{t("store.contactEmail")}</Label>
                  <Input
                    value={profileState.contact_email}
                    onChange={(e) => setProfileState((p) => ({ ...p, contact_email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-1.5 mt-4">
                <Label className="text-xs font-medium text-muted-foreground">{t("store.storeDescription")}</Label>
                <Textarea
                  value={profileState.description}
                  onChange={(e) => setProfileState((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>

            {/* Contact */}
            <div className="settings-field-group">
              <div className="settings-field-group-label">
                {language === "ar" ? "معلومات التواصل" : "Contact"}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">{t("store.contactPhone")}</Label>
                  <Input
                    value={profileState.contact_phone}
                    onChange={(e) => setProfileState((p) => ({ ...p, contact_phone: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-green-600" />
                    {language === "ar" ? "رقم الواتساب" : "WhatsApp"}
                  </Label>
                  <Input
                    value={profileState.whatsapp_phone}
                    onChange={(e) => setProfileState((p) => ({ ...p, whatsapp_phone: e.target.value }))}
                    placeholder="+201012345678"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* Social */}
            <div className="settings-field-group">
              <div className="settings-field-group-label">{t("store.socialLinks")}</div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">{t("store.facebook")}</Label>
                  <Input
                    value={profileState.facebook}
                    onChange={(e) => setProfileState((p) => ({ ...p, facebook: e.target.value }))}
                    placeholder="facebook.com/..."
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">{t("store.instagram")}</Label>
                  <Input
                    value={profileState.instagram}
                    onChange={(e) => setProfileState((p) => ({ ...p, instagram: e.target.value }))}
                    placeholder="instagram.com/..."
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">{t("store.twitter")}</Label>
                  <Input
                    value={profileState.twitter}
                    onChange={(e) => setProfileState((p) => ({ ...p, twitter: e.target.value }))}
                    placeholder="x.com/..."
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button onClick={saveProfile} disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t("store.save")}
              </Button>
            </div>
          </div>
        )}

        {/* ─── Domain ─── */}
        {activeSection === "domain" && (
          <div key="domain" className="settings-section-enter">
            <div className="settings-section-header">
              <h2>{t("store.domain")}</h2>
              <p>{language === "ar" ? "رابط متجرك والدومين المخصص" : "Your store URL and custom domain"}</p>
            </div>

            <div className="settings-field-group">
              <div className="settings-field-group-label">{t("store.subdomain")}</div>
              <div className="flex items-center gap-3 rounded-xl border bg-muted/10 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Globe className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-sm font-semibold">{currentStore?.subdomain || "—"}</span>
                    {getStoreDomainSuffix() && (
                      <span className="text-xs text-muted-foreground">{getStoreDomainSuffix()}</span>
                    )}
                  </div>
                  {currentStore?.subdomain && (
                    <a
                      href={getStoreUrl(currentStore.subdomain)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary/70 flex items-center gap-1 hover:text-primary transition-colors mt-0.5"
                    >
                      {getStoreUrl(currentStore.subdomain)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="settings-field-group">
              <div className="settings-field-group-label">{t("store.customDomain")}</div>
              <Input
                value={currentStore?.custom_domain || ""}
                placeholder={t("store.customDomainPlaceholder")}
                disabled
                className="max-w-sm bg-muted/30"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {language === "ar" ? "الدومينات المخصصة قريبا..." : "Custom domains coming soon..."}
              </p>
            </div>

            <div className="settings-field-group">
              <div className="settings-field-group-label">{t("store.sslStatus")}</div>
              <div className="flex items-center gap-3 rounded-xl border border-green-500/15 bg-green-500/5 px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-green-500/15">
                  <Lock className="h-3.5 w-3.5 text-green-500" />
                </div>
                <span className="text-sm font-medium">{t("store.sslActive")}</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── Shipping ─── */}
        {activeSection === "shipping" && (
          <div key="shipping" className="settings-section-enter">
            <div className="settings-section-header">
              <h2>{t("store.shipping")}</h2>
              <p>{language === "ar" ? "مناطق الشحن وأسعار التوصيل" : "Shipping zones and delivery rates"}</p>
            </div>

            {!shippingData ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Zones */}
                <div className="settings-field-group">
                  <div className="flex items-center justify-between mb-3">
                    <div className="settings-field-group-label mb-0">{t("store.shippingZones")}</div>
                    {!showAddZone && (
                      <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setShowAddZone(true)}>
                        <Plus className="h-3 w-3" />
                        {t("store.addZone")}
                      </Button>
                    )}
                  </div>

                  {shippingData.zones.length > 0 ? (
                    <div className="rounded-xl border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-xs">{t("store.zone")}</TableHead>
                            <TableHead className="text-xs">{language === "ar" ? "المحافظات" : "Governorates"}</TableHead>
                            <TableHead className="text-xs">{t("store.rate")} ({t("common.currency")})</TableHead>
                            <TableHead className="text-xs">{t("store.estimatedDays")}</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {shippingData.zones.map((z) => (
                            <TableRow key={z.id}>
                              <TableCell className="font-medium text-sm">{z.zone}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{z.governorates}</TableCell>
                              <TableCell className="text-sm">{z.rate}</TableCell>
                              <TableCell className="text-sm">{z.estimated_days}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteZone(z.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      {language === "ar" ? "لا توجد مناطق شحن بعد" : "No shipping zones yet"}
                    </div>
                  )}

                  {showAddZone && (
                    <div className="rounded-lg border bg-muted/20 p-4 space-y-3 mt-3">
                      <h4 className="text-sm font-medium">
                        {language === "ar" ? "إضافة منطقة جديدة" : "Add New Zone"}
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1">
                          <Label className="text-xs">{t("store.zone")}</Label>
                          <Input
                            value={newZone.zone}
                            onChange={(e) => setNewZone((p) => ({ ...p, zone: e.target.value }))}
                            placeholder={language === "ar" ? "مثل: القاهرة" : "e.g. Cairo"}
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">{language === "ar" ? "المحافظات" : "Governorates"}</Label>
                          <Input
                            value={newZone.governorates}
                            onChange={(e) => setNewZone((p) => ({ ...p, governorates: e.target.value }))}
                            placeholder={language === "ar" ? "القاهرة, الجيزة" : "Cairo, Giza"}
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">{t("store.rate")}</Label>
                          <Input
                            type="number"
                            value={newZone.rate || ""}
                            onChange={(e) => setNewZone((p) => ({ ...p, rate: Number(e.target.value) }))}
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">{t("store.estimatedDays")}</Label>
                          <Input
                            value={newZone.estimated_days}
                            onChange={(e) => setNewZone((p) => ({ ...p, estimated_days: e.target.value }))}
                            placeholder="2-3 days"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddZone}>
                          {language === "ar" ? "إضافة" : "Add"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setShowAddZone(false)}>
                          {t("products.cancel")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Free threshold */}
                <div className="settings-field-group">
                  <div className="settings-field-group-label">
                    {t("store.freeThreshold")}
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      value={freeThreshold}
                      onChange={(e) => setFreeThreshold(Number(e.target.value))}
                      className="w-36"
                    />
                    <span className="text-sm text-muted-foreground">{t("common.currency")}</span>
                    <Button size="sm" onClick={saveFreeThreshold}>
                      {t("store.save")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── Policies ─── */}
        {activeSection === "policies" && (
          <div key="policies" className="settings-section-enter">
            <div className="settings-section-header">
              <h2>{t("store.policies")}</h2>
              <p>{language === "ar" ? "سياسات المتجر والشروط القانونية" : "Store policies and legal terms"}</p>
            </div>

            <div className="flex gap-1.5 mb-5 flex-wrap p-1 rounded-xl bg-muted/20 border border-border/20 w-fit">
              {[
                { key: "return", label: t("store.returnPolicy") },
                { key: "shipping", label: t("store.shippingPolicy") },
                { key: "privacy", label: t("store.privacyPolicy") },
                { key: "terms", label: t("store.termsOfService") },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPolicyTab(p.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    policyTab === p.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <Textarea
              rows={10}
              placeholder={language === "ar" ? "اكتب السياسة هنا..." : "Write your policy here..."}
              className="font-mono text-sm"
            />
            <div className="pt-4">
              <Button onClick={() => toast.success(t("store.saved"))}>
                {t("store.save")}
              </Button>
            </div>
          </div>
        )}

        {/* ─── Status ─── */}
        {activeSection === "status" && (
          <div key="status" className="settings-section-enter">
            <div className="settings-section-header">
              <h2>{t("store.status")}</h2>
              <p>{language === "ar" ? "حالة المتجر والخطة الحالية" : "Store availability and current plan"}</p>
            </div>

            <div className="settings-field-group">
              <div className="settings-field-group-label">{t("store.storeStatus")}</div>
              <div className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${storeOnline ? "border-green-500/20 bg-green-500/5" : "border-border/30 bg-muted/5"}`}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`h-2.5 w-2.5 rounded-full ${storeOnline ? "bg-green-500" : "bg-muted-foreground"}`} />
                    {storeOnline && <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-green-500 animate-ping opacity-40" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{storeOnline ? t("store.online") : t("store.offline")}</p>
                    <p className="text-xs text-muted-foreground">
                      {storeOnline
                        ? (language === "ar" ? "متجرك مباشر ويستقبل الطلبات" : "Your store is live and accepting orders")
                        : (language === "ar" ? "متجرك في وضع الصيانة" : "Your store is in maintenance mode")}
                    </p>
                  </div>
                </div>
                <Switch checked={storeOnline} onCheckedChange={setStoreOnline} />
              </div>
            </div>

            <div className="settings-field-group">
              <div className="settings-field-group-label">
                {language === "ar" ? "تفاصيل" : "Details"}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-muted/5 p-4">
                  <p className="text-[0.6875rem] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5">{t("store.createdAt")}</p>
                  <p className="text-sm font-semibold">
                    {currentStore?.created_at
                      ? new Date(currentStore.created_at).toLocaleDateString(
                          language === "ar" ? "ar-EG" : "en-US",
                          { year: "numeric", month: "long", day: "numeric" }
                        )
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/5 p-4">
                  <p className="text-[0.6875rem] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5">{t("store.plan")}</p>
                  <Badge className="mt-0.5">
                    {currentStore?.default_currency === "EGP" ? "Starter" : "Free"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Themes Marketplace ─── */}
        {activeSection === "themes" && (
          <div key="themes" className="settings-section-enter">
            <div className="settings-section-header">
              <h2>{language === "ar" ? "سوق الثيمات" : "Themes"}</h2>
              <p>{language === "ar" ? "اختر ثيم يناسب متجرك" : "Browse and apply themes to your storefront"}</p>
            </div>
            <ThemeMarketplace
              activeTheme={activeTheme}
              availableThemes={availableThemes}
              onSelectTheme={(id) => {
                setActiveTheme(id);
                setTemplateConfig(null);
                setSelectedSectionId(null);
                setIsDirty(true);
                setActiveSection("customization");
              }}
            />
          </div>
        )}

        {/* ─── Customization ─── */}
        {activeSection === "customization" && (
          <div key="customization" className="settings-section-enter">
            {/* Onboarding walkthrough */}
            <CustomizationWalkthrough
              language={language}
              forceShow={showWalkthrough}
              onDismiss={() => setShowWalkthrough(false)}
            />

            <div className="settings-section-header">
              <div className="flex items-center justify-between">
                <div>
                  <h2>{t("store.customization")}</h2>
                  <p>
                    {language === "ar"
                      ? `ثيم: ${availableThemes.find((t) => t.id === activeTheme)?.nameAr || activeTheme}`
                      : `Theme: ${availableThemes.find((t) => t.id === activeTheme)?.name || activeTheme}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { resetWalkthrough(); setShowWalkthrough(true); }}
                    className="gap-1.5 text-muted-foreground h-8"
                    title={language === "ar" ? "دليل الاستخدام" : "Show guide"}
                  >
                    <Compass className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    data-tour="preview-toggle"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreview((v) => !v)}
                    className="gap-2 h-8"
                  >
                    {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">
                      {showPreview
                        ? (language === "ar" ? "إخفاء" : "Hide")
                        : (language === "ar" ? "معاينة" : "Preview")}
                    </span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Side-by-side: settings + resizable preview */}
            <div ref={splitRef} className="flex" style={{ gap: 0 }}>
              {/* Settings panel */}
              <div
                className="space-y-5 overflow-y-auto"
                style={{
                  width: showPreview ? `${100 - previewPct}%` : "100%",
                  maxHeight: showPreview ? "calc(100vh - 10rem)" : undefined,
                  paddingInlineEnd: showPreview ? "0.75rem" : 0,
                }}
              >
                {/* Active theme indicator */}
                <div className="flex items-center gap-4 rounded-xl border bg-gradient-to-r from-muted/15 to-transparent p-4">
                  <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center shadow-sm ring-1 ring-border/20"
                    style={{ backgroundColor: (THEME_PREVIEWS[activeTheme] || THEME_PREVIEWS.modern).bg }}
                  >
                    <span className="text-lg">{(THEME_PREVIEWS[activeTheme] || THEME_PREVIEWS.modern).icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold tracking-tight truncate">
                      {language === "ar"
                        ? availableThemes.find((t) => t.id === activeTheme)?.nameAr || activeTheme
                        : availableThemes.find((t) => t.id === activeTheme)?.name || activeTheme}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      {language === "ar" ? "الثيم المفعّل حالياً" : "Currently active theme"}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {["primary_color", "secondary_color", "accent_color"].map((key) => (
                      <div
                        key={key}
                        className="h-5 w-5 rounded-full ring-2 ring-background shadow-sm transition-transform hover:scale-110"
                        style={{ backgroundColor: String(themeState[key] || "#ccc") }}
                        title={key.replace(/_/g, " ")}
                      />
                    ))}
                  </div>
                </div>

                {/* Colors & Typography */}
                <div data-tour="colors-typography" className="rounded-xl border bg-muted/5 p-5">
                  <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-border/20">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                      <Palette className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h3 className="text-sm font-bold tracking-tight">
                      {language === "ar" ? "الألوان والخطوط" : "Colors & Typography"}
                    </h3>
                  </div>
                  {themeSchemaBundle?.global_settings ? (
                    <SchemaForm
                      settings={ensureFontSettings(themeSchemaBundle.global_settings)}
                      values={themeState}
                      onChange={handleThemeSettingChange}
                    />
                  ) : (
                    <div className="space-y-5">
                      {Array.from(groupedThemeSettings).map(([group, settings]) => (
                        <div key={group} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2">
                              {language === "ar" ? settings[0].groupAr : group}
                            </span>
                            <div className="h-px flex-1 bg-border" />
                          </div>
                          <div className={`grid gap-3 ${showPreview ? "grid-cols-1" : "sm:grid-cols-2"}`}>
                            {settings.map((setting) => (
                              <SettingField
                                key={setting.key}
                                setting={setting}
                                value={themeState[setting.key]}
                                onChange={handleThemeSettingChange}
                                language={language}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* V2: Home Page Sections */}
                {templateConfig && themeSchemaBundle && (
                  <div data-tour="home-sections" className="rounded-xl border bg-muted/5 p-5">
                    <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-border/20">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                        <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <h3 className="text-sm font-bold tracking-tight">
                        {language === "ar" ? "أقسام الصفحة الرئيسية" : "Home Page Sections"}
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {selectedSectionId && templateConfig.sections[selectedSectionId] ? (() => {
                        const section = templateConfig.sections[selectedSectionId];
                        const schema = themeSchemaBundle.sections.find((s) => s.type === section.type);
                        if (!schema) return null;
                        return (
                          <SectionEditor
                            section={section}
                            schema={schema}
                            onChange={handleSectionSettingChange}
                            onBack={() => setSelectedSectionId(null)}
                          />
                        );
                      })() : (
                        <SectionList
                          template={templateConfig}
                          sectionSchemas={themeSchemaBundle.sections}
                          selectedSectionId={selectedSectionId}
                          onSelectSection={setSelectedSectionId}
                          onReorder={handleSectionReorder}
                          onToggleSection={handleToggleSection}
                          onAddSection={handleAddSection}
                          onRemoveSection={handleRemoveSection}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Store-wide settings accordion */}
                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/30">
                      <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-bold tracking-tight">
                      {language === "ar" ? "إعدادات المتجر" : "Store Settings"}
                    </h3>
                  </div>
                  <Accordion type="multiple" className="space-y-2">
                    {SECTION_CONFIG.map((section) => (
                      <AccordionItem key={section.key} value={section.key} className="border rounded-xl px-4">
                        <AccordionTrigger className="hover:no-underline gap-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <section.icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {language === "ar" ? section.labelAr : section.label}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pb-4 pt-1">
                          {section.settings.map((setting) => (
                            <SettingField
                              key={setting.key}
                              setting={setting}
                              value={sectionStates[section.key]?.[setting.key]}
                              onChange={handleSectionChange(section.key)}
                              language={language}
                            />
                          ))}
                          {section.key === "navigation" && (
                            <NavLinksEditor
                              links={navLinks}
                              onChange={(links) => { setNavLinks(links); setIsDirty(true); }}
                              language={language}
                            />
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </div>

              {/* Drag handle */}
              {showPreview && (
                <div
                  className="w-2 shrink-0 cursor-col-resize group flex items-center justify-center hover:bg-primary/10 rounded transition-colors"
                  onMouseDown={startResize}
                >
                  <div className="w-0.5 h-12 rounded-full bg-border group-hover:bg-primary/40 transition-colors" />
                </div>
              )}

              {/* Live preview */}
              {showPreview && (
                <div className="sticky top-4 self-start" style={{ width: `${previewPct}%` }}>
                  <div className="overflow-hidden h-[calc(100vh-10rem)] border-2 border-primary/10 rounded-xl">
                    <ThemePreview
                      key={activeTheme}
                      storeSubdomain={currentStore?.subdomain}
                      settings={buildFullPayload()}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Add Section Sheet */}
            {themeSchemaBundle && (
              <AddSectionSheet
                open={showAddSheet}
                onOpenChange={setShowAddSheet}
                sectionSchemas={themeSchemaBundle.sections}
                onAddSection={handleAddSection}
              />
            )}
          </div>
        )}
      </div>

      {/* ═══ Sticky Save Bar (for customization) ═══ */}
      {activeSection === "customization" && (
        <div className="settings-save-bar" data-visible={isDirty}>
          {isDirty && (
            <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 text-[10px]">
              {language === "ar" ? "تغييرات غير محفوظة" : "Unsaved changes"}
            </Badge>
          )}
          <Button onClick={saveDraft} disabled={isSaving} variant="outline" size="sm" className="gap-2 h-8">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings2 className="h-3.5 w-3.5" />}
            {language === "ar" ? "حفظ مسودة" : "Save Draft"}
          </Button>
          <Button onClick={publish} disabled={isSaving} size="sm" className="gap-2 h-8">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {language === "ar" ? "نشر" : "Publish"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default StoreSettings;
