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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  Globe, Lock, Palette, ScrollText, Settings2, Truck, Upload, Sparkles,
  Check, Store, Type, ImageIcon, ShoppingBag, MessageSquare, Eye, EyeOff,
  Trash2, Plus, Loader2, ExternalLink, Phone, Compass, Tag, LayoutGrid,
  ChevronUp, ChevronDown, GripVertical,
} from "lucide-react";
import { ThemePreview } from "@/components/ThemePreview";
import {
  identitySettings,
  headerSettings,
  heroSettings,
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
  type SectionInstanceData,
} from "@/services/themeApi";
import {
  SchemaForm,
  SectionList,
  SectionEditor,
  AddSectionSheet,
  CustomizationWalkthrough,
  useWalkthroughStatus,
} from "@/components/theme-editor";
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
function ensureFontSettings(settings: any[]): any[] {
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
  value: any;
  onChange: (key: string, val: any) => void;
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

  switch (setting.type) {
    case "text":
      return (
        <div className="grid gap-2">
          <Label>{label}</Label>
          {setting.description && <p className="text-xs text-muted-foreground">{setting.description}</p>}
          <Input
            value={value || ""}
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
              value={value || "#000000"}
              onChange={(e) => onChange(setting.key, e.target.value)}
              className="h-10 w-14 rounded-md border border-input cursor-pointer"
            />
            <Input
              value={value || ""}
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
              <img src={value} alt={label} className="h-16 w-16 rounded-lg object-cover border" />
            ) : (
              <div className="h-16 w-16 rounded-lg border-2 border-dashed border-border bg-muted flex items-center justify-center text-muted-foreground text-xs">
                {language === "ar" ? "صورة" : "IMG"}
              </div>
            )}
            <Input
              value={value || ""}
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
          <Select value={value || String(setting.default)} onValueChange={(v) => onChange(setting.key, v)}>
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
    case "font":
      return (
        <div className="grid gap-2">
          <Label>{label}</Label>
          <Select value={value || String(setting.default)} onValueChange={(v) => onChange(setting.key, v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {AVAILABLE_FONTS.map((fontName) => (
                <SelectItem key={fontName} value={fontName}>
                  <span style={{ fontFamily: `'${fontName}', sans-serif` }}>{fontName}</span>
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
            value={value ?? setting.default}
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

// ─── Home Section Reorder ────────────────────────────────────────────────────

function HomeSectionReorder({
  sections,
  onChange,
  language,
}: {
  sections: Array<{ id: string; label: string; enabled: boolean }>;
  onChange: (sections: Array<{ id: string; label: string; enabled: boolean }>) => void;
  language: string;
}) {
  const toggle = (i: number) =>
    onChange(sections.map((s, idx) => (idx === i ? { ...s, enabled: !s.enabled } : s)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...sections];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3 pt-2">
      <Label className="text-sm font-semibold">
        {language === "ar" ? "ترتيب أقسام الصفحة الرئيسية" : "Home Page Section Order"}
      </Label>
      {sections.map((section, i) => (
        <div
          key={section.id}
          className={`flex items-center gap-2 rounded-lg border p-2.5 transition-colors ${
            section.enabled ? "bg-card" : "bg-muted/50 opacity-60"
          }`}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col gap-0.5">
            <button onClick={() => move(i, -1)} className="p-0.5 hover:bg-muted rounded" disabled={i === 0}>
              <ChevronUp className="h-3 w-3" />
            </button>
            <button onClick={() => move(i, 1)} className="p-0.5 hover:bg-muted rounded" disabled={i === sections.length - 1}>
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <span className="flex-1 text-sm font-medium">{section.label}</span>
          <Switch
            checked={section.enabled}
            onCheckedChange={() => toggle(i)}
          />
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

function extractNonEmpty(state: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
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
  const [walkthroughDone, resetWalkthrough] = useWalkthroughStatus();
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
  const [themeState, setThemeState] = useState<Record<string, any>>({});
  const [identityState, setIdentityState] = useState<Record<string, any>>({});
  const [headerState, setHeaderState] = useState<Record<string, any>>({});
  const [heroState, setHeroState] = useState<Record<string, any>>({});
  const [productsState, setProductsState] = useState<Record<string, any>>({});
  const [footerState, setFooterState] = useState<Record<string, any>>({});
  const [navigationState, setNavigationState] = useState<Record<string, any>>({});
  const [labelsState, setLabelsState] = useState<Record<string, any>>({});
  const [layoutState, setLayoutState] = useState<Record<string, any>>({});
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
  const sectionStates: Record<string, Record<string, any>> = {
    identity: identityState, header: headerState, hero: heroState,
    products: productsState, footer: footerState,
    navigation: navigationState, labels: labelsState, layout: layoutState,
  };
  const sectionSetters: Record<string, React.Dispatch<React.SetStateAction<Record<string, any>>>> = {
    identity: setIdentityState, header: setHeaderState, hero: setHeroState,
    products: setProductsState, footer: setFooterState,
    navigation: setNavigationState, labels: setLabelsState, layout: setLayoutState,
  };

  const handleSectionChange = useCallback(
    (section: string) => (key: string, value: any) => {
      sectionSetters[section]?.((prev) => ({ ...prev, [key]: value }));
      setIsDirty(true);
    },
    []
  );

  const handleThemeSettingChange = useCallback((key: string, value: any) => {
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
          const { social_links, ...rest } = data.footer as any;
          setFooterState({ ...rest, ...(social_links || {}) });
        }
        if (data.navigation) {
          const { links, ...navRest } = data.navigation as any;
          setNavigationState({ ...navRest });
          if (links && Array.isArray(links)) setNavLinks(links);
        }
        if (data.labels) setLabelsState({ ...data.labels });
        if (data.layout) {
          const { home_sections, ...layoutRest } = data.layout as any;
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
        if ((data as any).schema_version === 2 && (data as any).templates?.home) {
          setTemplateConfig((data as any).templates.home);
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
    const defaults: Record<string, any> = {};
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

  const handleSectionSettingChange = useCallback((sectionId: string, key: string, value: any) => {
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

    const navPayload: Record<string, any> = { ...extractNonEmpty(navigationState) };
    if (navLinks.length > 0) navPayload.links = navLinks;

    const layoutPayload: Record<string, any> = { ...extractNonEmpty(layoutState) };
    const enabledSections = homeSections.filter((s) => s.enabled).map((s) => s.id);
    if (enabledSections.length > 0) layoutPayload.home_sections = enabledSections;

    // Extract hero from v2 template for v1 backwards compat
    let heroPayload = extractNonEmpty(heroState);
    if (templateConfig) {
      const heroSection = Object.values(templateConfig.sections).find((s) => s.type === "hero");
      if (heroSection) heroPayload = { ...heroPayload, ...extractNonEmpty(heroSection.settings) };
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

    const payload: Record<string, any> = {
      theme: { base_theme: activeTheme, ...extractNonEmpty(themeState) },
      identity: extractNonEmpty(identityState) as any,
      header: extractNonEmpty(headerState) as any,
      hero: heroPayload as any,
      products: extractNonEmpty(productsState) as any,
      footer: {
        ...footerRest,
        ...(social_links ? { social_links } : {}),
      } as any,
      navigation: Object.keys(navPayload).length > 0 ? navPayload : undefined,
      labels: extractNonEmpty(labelsState) as any,
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
    } catch {
      toast.error(language === "ar" ? "فشل الحفظ" : "Failed to save");
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
    } catch {
      toast.error(language === "ar" ? "فشل الحفظ" : "Failed to save");
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
    } catch {
      toast.error(language === "ar" ? "فشل النشر" : "Failed to publish");
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
    } catch {
      toast.error(language === "ar" ? "فشلت الإضافة" : "Failed to add zone");
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
      } catch {
        toast.error(language === "ar" ? "فشل الحذف" : "Failed to delete");
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
    } catch {
      toast.error(language === "ar" ? "فشل الحفظ" : "Failed to save");
    }
  }, [currentStore?.id, freeThreshold, language, t]);

  // ─── Tab config ─────────────────────────────────────────────────────────

  const tabs = [
    { value: "profile", label: t("store.profile"), icon: Settings2 },
    { value: "customization", label: t("store.customization"), icon: Palette },
    { value: "domain", label: t("store.domain"), icon: Globe },
    { value: "policies", label: t("store.policies"), icon: ScrollText },
    { value: "status", label: t("store.status"), icon: Lock },
    { value: "shipping", label: t("store.shipping"), icon: Truck },
  ];

  // Current theme settings schema
  const currentThemeSettings = themeSchemas[activeTheme]?.settings || themeSchemas.modern.settings;
  const groupedThemeSettings = groupSettings(currentThemeSettings);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("store.title")}</h1>

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="gap-2 data-[state=active]:bg-muted"
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ═══ Profile ═══ */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>{t("store.profile")}</CardTitle>
              <CardDescription>
                {language === "ar" ? "معلومات متجرك الأساسية" : "Basic store information"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {currentStore?.logo_url ? (
                  <img
                    src={currentStore.logo_url}
                    alt="Logo"
                    className="h-20 w-20 rounded-xl object-cover border"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted text-2xl">
                    🏪
                  </div>
                )}
                <Button variant="outline" size="sm" className="gap-2">
                  <Upload className="h-4 w-4" />
                  {t("store.uploadLogo")}
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t("store.storeName")}</Label>
                  <Input
                    value={profileState.name}
                    onChange={(e) => setProfileState((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("store.contactEmail")}</Label>
                  <Input
                    value={profileState.contact_email}
                    onChange={(e) => setProfileState((p) => ({ ...p, contact_email: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("store.contactPhone")}</Label>
                  <Input
                    value={profileState.contact_phone}
                    onChange={(e) => setProfileState((p) => ({ ...p, contact_phone: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-green-600" />
                    {language === "ar" ? "رقم الواتساب" : "WhatsApp Number"}
                  </Label>
                  <Input
                    value={profileState.whatsapp_phone}
                    onChange={(e) => setProfileState((p) => ({ ...p, whatsapp_phone: e.target.value }))}
                    placeholder="+201012345678"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === "ar"
                      ? "هيظهر في المتجر كزرار واتساب للعملاء"
                      : "Shown as a WhatsApp button for customers on your store"}
                  </p>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>{t("store.storeDescription")}</Label>
                <Textarea
                  value={profileState.description}
                  onChange={(e) => setProfileState((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label>{t("store.facebook")}</Label>
                  <Input
                    value={profileState.facebook}
                    onChange={(e) => setProfileState((p) => ({ ...p, facebook: e.target.value }))}
                    placeholder="facebook.com/..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("store.instagram")}</Label>
                  <Input
                    value={profileState.instagram}
                    onChange={(e) => setProfileState((p) => ({ ...p, instagram: e.target.value }))}
                    placeholder="instagram.com/..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("store.twitter")}</Label>
                  <Input
                    value={profileState.twitter}
                    onChange={(e) => setProfileState((p) => ({ ...p, twitter: e.target.value }))}
                    placeholder="x.com/..."
                  />
                </div>
              </div>
              <Button onClick={saveProfile} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                {t("store.save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Customization ═══ */}
        <TabsContent value="customization">
          {/* Onboarding walkthrough */}
          <CustomizationWalkthrough
            language={language}
            forceShow={showWalkthrough}
            onDismiss={() => setShowWalkthrough(false)}
          />

          {/* ── Action bar ── */}
          <div data-tour="action-bar" className="flex items-center gap-2 mb-5 rounded-xl border bg-card p-3">
            <Button onClick={saveDraft} disabled={isSaving} variant="outline" size="sm" className="gap-2">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings2 className="h-3.5 w-3.5" />}
              {language === "ar" ? "حفظ مسودة" : "Save Draft"}
            </Button>
            <Button onClick={publish} disabled={isSaving} size="sm" className="gap-2 bg-green-600 hover:bg-green-700 text-white">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {language === "ar" ? "نشر" : "Publish"}
            </Button>
            {isDirty && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-[10px]">
                {language === "ar" ? "تغييرات غير محفوظة" : "Unsaved changes"}
              </Badge>
            )}
            <div className="flex items-center gap-1 ms-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { resetWalkthrough(); setShowWalkthrough(true); }}
                className="gap-1.5 text-muted-foreground"
                title={language === "ar" ? "دليل الاستخدام" : "Show guide"}
              >
                <Compass className="h-3.5 w-3.5" />
                {language === "ar" ? "دليل" : "Guide"}
              </Button>
              <Button
                data-tour="preview-toggle"
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview((v) => !v)}
                className="gap-2"
              >
                {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showPreview
                  ? (language === "ar" ? "إخفاء" : "Hide")
                  : (language === "ar" ? "معاينة" : "Preview")}
              </Button>
            </div>
          </div>

          {/* ── Theme picker strip ── */}
          <div data-tour="theme-picker" className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">{language === "ar" ? "اختر الثيم" : "Choose Theme"}</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {(availableThemes.length > 0 ? availableThemes : [
                { id: "modern", name: "Modern", nameAr: "مودرن", description: "", layout: "default" },
                { id: "boutique", name: "Boutique", nameAr: "بوتيك", description: "", layout: "default" },
                { id: "elegant", name: "Elegant", nameAr: "أنيق", description: "", layout: "default" },
                { id: "skeuomorphic", name: "Classic", nameAr: "كلاسيك", description: "", layout: "skeuomorphic" },
                { id: "neo-brutalism", name: "Neo Brutalism", nameAr: "نيو بروتاليزم", description: "", layout: "neo-brutalism" },
                { id: "editorial", name: "Editorial", nameAr: "إيديتوريال", description: "", layout: "editorial" },
                { id: "luxury-minimal", name: "Luxury Minimal", nameAr: "فخامة مينيمال", description: "", layout: "luxury-minimal" },
              ]).map((theme) => {
                const isActive = activeTheme === theme.id;
                const preview = THEME_PREVIEWS[theme.id] || THEME_PREVIEWS.modern;
                return (
                  <button
                    key={theme.id}
                    onClick={() => {
                      setActiveTheme(theme.id);
                      setIsDirty(true);
                    }}
                    className={`shrink-0 rounded-xl border-2 overflow-hidden transition-all duration-200 w-36 hover:shadow-md ${
                      isActive
                        ? "border-primary ring-2 ring-primary/20 shadow-md"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div
                      className="h-16 flex items-center justify-center relative"
                      style={{ backgroundColor: preview.bg }}
                    >
                      <span className="text-2xl">{preview.icon}</span>
                      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                        {[preview.fg, preview.accent].map((c, i) => (
                          <div
                            key={i}
                            className="h-2.5 w-2.5 rounded-full border border-white/40"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      {isActive && (
                        <div className="absolute top-1 end-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    <div className="px-2 py-1.5 bg-card text-center">
                      <p className="text-xs font-semibold truncate">
                        {language === "ar" ? theme.nameAr : theme.name}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Side-by-side layout: settings + resizable preview ── */}
          <div ref={splitRef} className="flex" style={{ gap: 0 }}>
            {/* Left: settings panel */}
            <div
              className="space-y-4 overflow-y-auto pe-3"
              style={{
                width: showPreview ? `${100 - previewPct}%` : "100%",
                maxHeight: showPreview ? "calc(100vh - 10rem)" : undefined,
              }}
            >
              {/* Quick color swatches preview */}
              <div className="flex items-center gap-2 rounded-xl border bg-card p-3">
                <span className="text-xs font-medium text-muted-foreground me-1">
                  {language === "ar" ? "الألوان:" : "Colors:"}
                </span>
                {["primary_color", "secondary_color", "accent_color", "background_color", "text_color"].map((key) => (
                  <div
                    key={key}
                    className="h-7 w-7 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: themeState[key] || "#ccc" }}
                    title={key.replace(/_/g, " ")}
                  />
                ))}
                <div className="ms-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Type className="h-3.5 w-3.5" />
                  <span style={{ fontFamily: `'${themeState.heading_font || "Cairo"}', sans-serif` }}>
                    {themeState.heading_font || "Cairo"}
                  </span>
                </div>
              </div>

              {/* Theme-specific settings (colors, fonts, layout) — schema-driven */}
              <Card data-tour="colors-typography">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Palette className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{language === "ar" ? "ألوان وخطوط" : "Colors & Typography"}</CardTitle>
                      <CardDescription className="text-xs">
                        {language === "ar"
                          ? `ثيم "${availableThemes.find((t) => t.id === activeTheme)?.nameAr || activeTheme}"`
                          : `"${availableThemes.find((t) => t.id === activeTheme)?.name || activeTheme}" theme`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>

              {/* V2: Home Page Sections — section list + editor */}
              {templateConfig && themeSchemaBundle && (
                <Card data-tour="home-sections">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <LayoutGrid className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">
                          {language === "ar" ? "أقسام الصفحة الرئيسية" : "Home Page Sections"}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {language === "ar"
                            ? "أضف وأزل ورتب أقسام الصفحة الرئيسية"
                            : "Add, remove, and reorder home page sections"}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Show either section list or section editor (not both) */}
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
                  </CardContent>
                </Card>
              )}

              {/* Store-wide settings (identity, header, navigation, etc.) */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ScrollText className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">{language === "ar" ? "إعدادات المتجر" : "Store Settings"}</h3>
                </div>
                <Accordion type="multiple" className="space-y-2">
                  {SECTION_CONFIG.map((section) => (
                    <AccordionItem key={section.key} value={section.key} className="border rounded-xl px-4 bg-card">
                      <AccordionTrigger className="hover:no-underline gap-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                            <section.icon className="h-3.5 w-3.5 text-primary" />
                          </div>
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
                        {/* Nav links editor inside Navigation section */}
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

            {/* Right: live preview (sticky) */}
            {showPreview && (
              <div className="sticky top-4 self-start" style={{ width: `${previewPct}%` }}>
                <Card className="overflow-hidden h-[calc(100vh-10rem)] border-2 border-primary/10">
                  <CardContent className="p-0 h-full">
                    <ThemePreview
                      storeSubdomain={currentStore?.subdomain}
                      settings={buildFullPayload()}
                    />
                  </CardContent>
                </Card>
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
        </TabsContent>

        {/* ═══ Domain ═══ */}
        <TabsContent value="domain">
          <Card>
            <CardHeader>
              <CardTitle>{t("store.domain")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>{t("store.subdomain")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={currentStore?.subdomain || ""}
                    disabled
                    className="max-w-[200px] bg-muted"
                  />
                  {getStoreDomainSuffix() && (
                    <span className="text-sm text-muted-foreground">{getStoreDomainSuffix()}</span>
                  )}
                </div>
                {currentStore?.subdomain && (
                  <a
                    href={getStoreUrl(currentStore.subdomain)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                  >
                    {getStoreUrl(currentStore.subdomain)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="grid gap-2">
                <Label>{t("store.customDomain")}</Label>
                <Input
                  value={currentStore?.custom_domain || ""}
                  placeholder={t("store.customDomainPlaceholder")}
                  disabled
                  className="max-w-sm bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  {language === "ar"
                    ? "الدومينات المخصصة قريبا..."
                    : "Custom domains coming soon..."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label>{t("store.sslStatus")}</Label>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  {t("store.sslActive")}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Policies ═══ */}
        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <CardTitle>{t("store.policies")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={policyTab} onValueChange={setPolicyTab}>
                <TabsList>
                  <TabsTrigger value="return">{t("store.returnPolicy")}</TabsTrigger>
                  <TabsTrigger value="shipping">{t("store.shippingPolicy")}</TabsTrigger>
                  <TabsTrigger value="privacy">{t("store.privacyPolicy")}</TabsTrigger>
                  <TabsTrigger value="terms">{t("store.termsOfService")}</TabsTrigger>
                </TabsList>
              </Tabs>
              <Textarea
                rows={8}
                placeholder={language === "ar" ? "اكتب السياسة هنا..." : "Write your policy here..."}
              />
              <Button onClick={() => toast.success(t("store.saved"))}>
                {t("store.save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Status ═══ */}
        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle>{t("store.status")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">{t("store.storeStatus")}</p>
                  <p className="text-sm text-muted-foreground">
                    {storeOnline ? t("store.online") : t("store.offline")}
                  </p>
                </div>
                <Switch checked={storeOnline} onCheckedChange={setStoreOnline} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">{t("store.createdAt")}</p>
                  <p className="font-medium mt-1">
                    {currentStore?.created_at
                      ? new Date(currentStore.created_at).toLocaleDateString(
                          language === "ar" ? "ar-EG" : "en-US",
                          { year: "numeric", month: "long", day: "numeric" }
                        )
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">{t("store.plan")}</p>
                  <Badge className="mt-1">
                    {currentStore?.default_currency === "EGP" ? "Starter" : "Free"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Shipping ═══ */}
        <TabsContent value="shipping">
          <Card>
            <CardHeader>
              <CardTitle>{t("store.shipping")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!shippingData ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Zones table */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("store.zone")}</TableHead>
                        <TableHead>{language === "ar" ? "المحافظات" : "Governorates"}</TableHead>
                        <TableHead>{t("store.rate")} ({t("common.currency")})</TableHead>
                        <TableHead>{t("store.estimatedDays")}</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shippingData.zones.map((z) => (
                        <TableRow key={z.id}>
                          <TableCell className="font-medium">{z.zone}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{z.governorates}</TableCell>
                          <TableCell>{z.rate}</TableCell>
                          <TableCell>{z.estimated_days}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteZone(z.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Add zone */}
                  {showAddZone ? (
                    <div className="rounded-lg border p-4 space-y-3">
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
                  ) : (
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowAddZone(true)}>
                      <Plus className="h-4 w-4" />
                      {t("store.addZone")}
                    </Button>
                  )}

                  {/* Free shipping threshold */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <Label>{t("store.freeThreshold")} ({t("common.currency")})</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        value={freeThreshold}
                        onChange={(e) => setFreeThreshold(Number(e.target.value))}
                        className="w-32"
                      />
                      <Button size="sm" onClick={saveFreeThreshold}>
                        {t("store.save")}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StoreSettings;
