import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useTrialPaywall } from "@/contexts/TrialPaywallContext";
import {
  fetchCustomization, updateCustomization, publishCustomization,
  fetchThemeSchemas,
  fetchStoreThemes,
  type CustomizationData,
  type SectionSchemaData,
  type SectionSettingDefinition,
  type SectionInstanceData,
  type TemplateConfigData,
  type ThemeSchemaBundle,
  type StoreThemeListItem,
} from "@/services/themeApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { getStoreUrl } from "@/lib/storefront";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Monitor, Smartphone, Undo2, Redo2, Globe,
  Loader2, Layout, Package, Navigation2, Image, AlignLeft,
  Palette, Store, RefreshCw, Plus, Trash2, Eye, EyeOff,
  ChevronUp, ChevronDown, GripVertical, CreditCard, MessageCircle, CheckCircle, User,
  Upload,
} from "lucide-react";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { uploadStoreAsset } from "@/services/storeApi";

// ─── Global settings (identity, header, footer) ────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  labelAr: string;
  type: "text" | "textarea" | "color" | "select" | "range" | "toggle" | "image_picker" | "url";
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

interface GlobalSection {
  id: string;
  name: string;
  nameAr: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: FieldDef[];
}

const GLOBAL_SECTIONS: GlobalSection[] = [
  {
    id: "identity", name: "Store identity", nameAr: "هوية المتجر", icon: Store,
    fields: [
      { key: "identity.store_name", label: "Store name", labelAr: "اسم المتجر", type: "text", placeholder: "My Store" },
      { key: "identity.logo_url", label: "Logo URL", labelAr: "رابط الشعار", type: "image_picker" },
      { key: "identity.favicon_url", label: "Favicon URL", labelAr: "رابط الفافيكون", type: "image_picker" },
    ],
  },
  {
    id: "header", name: "Header", nameAr: "الرأس", icon: Navigation2,
    fields: [
      { key: "header.nav_layout", label: "Navigation layout", labelAr: "تخطيط القائمة", type: "select", options: ["logo-right", "logo-center", "logo-left", "stacked"] },
      { key: "header.show_search_bar", label: "Show search bar", labelAr: "إظهار البحث", type: "toggle" },
      { key: "header.show_cart_icon", label: "Show cart icon", labelAr: "إظهار السلة", type: "toggle" },
      { key: "header.announcement_text", label: "Announcement text", labelAr: "نص الإشعار", type: "text" },
      { key: "header.announcement_color", label: "Announcement bg", labelAr: "خلفية الإشعار", type: "color" },
      { key: "header.announcement_text_color", label: "Announcement text color", labelAr: "لون نص الإشعار", type: "color" },
    ],
  },
  {
    id: "footer", name: "Footer", nameAr: "التذييل", icon: Layout,
    fields: [
      { key: "footer.footer_text", label: "Footer text", labelAr: "نص التذييل", type: "textarea" },
      { key: "footer.show_newsletter", label: "Newsletter signup", labelAr: "النشرة البريدية", type: "toggle" },
      { key: "footer.social_links.facebook", label: "Facebook", labelAr: "فيسبوك", type: "url" },
      { key: "footer.social_links.instagram", label: "Instagram", labelAr: "إنستجرام", type: "url" },
      { key: "footer.social_links.twitter", label: "Twitter/X", labelAr: "تويتر", type: "url" },
      { key: "footer.social_links.whatsapp", label: "WhatsApp", labelAr: "واتساب", type: "text", placeholder: "+20XXXXXXXXXX" },
    ],
  },
];

// Theme-level settings (colors, fonts, style)
interface ThemeFieldGroup { group: string; groupAr: string; fields: FieldDef[]; }

const THEME_FIELD_GROUPS: ThemeFieldGroup[] = [
  {
    group: "Colors", groupAr: "الألوان",
    fields: [
      { key: "theme.primary_color", label: "Primary", labelAr: "الرئيسي", type: "color" },
      { key: "theme.secondary_color", label: "Secondary", labelAr: "الثانوي", type: "color" },
      { key: "theme.accent_color", label: "Accent", labelAr: "التمييز", type: "color" },
      { key: "theme.background_color", label: "Background", labelAr: "الخلفية", type: "color" },
      { key: "theme.text_color", label: "Text", labelAr: "النص", type: "color" },
    ],
  },
  {
    group: "Typography", groupAr: "الخطوط",
    fields: [
      { key: "theme.heading_font", label: "Heading font", labelAr: "خط العناوين", type: "select", options: ["Inter", "Cairo", "Playfair Display", "DM Sans", "Raleway", "Poppins"] },
      { key: "theme.body_font", label: "Body font", labelAr: "خط النصوص", type: "select", options: ["Inter", "Cairo", "DM Sans", "Source Sans 3", "Nunito", "Roboto"] },
    ],
  },
  {
    group: "Style", groupAr: "الأسلوب",
    fields: [
      { key: "theme.border_radius", label: "Border radius", labelAr: "تدوير الحواف", type: "range", min: 0, max: 24, step: 2 },
      { key: "theme.button_style", label: "Button style", labelAr: "أسلوب الأزرار", type: "select", options: ["rounded", "square", "pill"] },
      { key: "theme.enable_animations", label: "Animations", labelAr: "الحركات", type: "toggle" },
    ],
  },
];

// ─── Section type icons ──────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "hero": Image,
  "featured-collection": Package,
  "categories": Layout,
  "newsletter": AlignLeft,
  "testimonials": AlignLeft,
  "promo-banner": Image,
  "marquee": AlignLeft,
  "announcement-bar": AlignLeft,
  "rich-text": AlignLeft,
  "image-with-text": Image,
  // Page section types (new)
  "products-page": Package,
  "product-detail": Package,
  "checkout": CreditCard,
  "contact": MessageCircle,
  "order-confirmation": CheckCircle,
  "profile": User,
};

// ─── Page definitions ───────────────────────────────────────────────────────

interface PageDef {
  id: string;       // matches PageTemplateName from bazaar
  name: string;     // English display name
  nameAr: string;   // Arabic display name
  icon: React.ComponentType<{ className?: string }>;
  /** The URL path to navigate the iframe to when this page is selected */
  previewPath: string;
}

const EDITABLE_PAGES: PageDef[] = [
  { id: "home", name: "Home", nameAr: "الرئيسية", icon: Layout, previewPath: "/" },
  { id: "products", name: "Products", nameAr: "المنتجات", icon: Package, previewPath: "/products" },
  { id: "product-detail", name: "Product Detail", nameAr: "تفاصيل المنتج", icon: Package, previewPath: "/product/demo" },
  { id: "checkout", name: "Checkout", nameAr: "الدفع", icon: CreditCard, previewPath: "/checkout" },
  { id: "contact", name: "Contact", nameAr: "التواصل", icon: MessageCircle, previewPath: "/contact" },
  { id: "order-confirmation", name: "Order Confirmation", nameAr: "تأكيد الطلب", icon: CheckCircle, previewPath: "/order-confirmation" },
  { id: "profile", name: "Profile", nameAr: "الحساب", icon: User, previewPath: "/profile" },
];

// ─── Utilities ───────────────────────────────────────────────────────────────

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce((curr: unknown, key: string) => {
    if (curr !== null && typeof curr === "object") return (curr as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function setNestedValue(obj: unknown, path: string, value: unknown): unknown {
  const keys = path.split(".");
  const result = { ...(obj as Record<string, unknown>) };
  let curr: Record<string, unknown> = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const existing = curr[keys[i]];
    curr[keys[i]] = { ...(typeof existing === "object" && existing !== null ? existing : {}) } as Record<string, unknown>;
    curr = curr[keys[i]] as Record<string, unknown>;
  }
  curr[keys[keys.length - 1]] = value;
  return result;
}

function generateId(prefix = "s"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function toTestIdSuffix(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function ThemeEditor() {
  const { isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const { requireTrial } = useTrialPaywall();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const storeId = currentStore?.id ?? "";
  const storeUrl = currentStore?.subdomain ? getStoreUrl(currentStore.subdomain) : null;

  const [localData, setLocalData] = useState<CustomizationData | null>(null);
  const [activePage, setActivePage] = useState<string>("home");
  const [allTemplates, setAllTemplates] = useState<Record<string, TemplateConfigData>>({});

  // Active template for the currently selected page
  const template = allTemplates[activePage] ?? null;

  // Setter that updates the specific page in allTemplates
  const setTemplate = useCallback((updater: (prev: TemplateConfigData | null) => TemplateConfigData | null) => {
    setAllTemplates((prev) => {
      const current = prev[activePage] ?? null;
      const next = updater(current);
      if (!next) return prev;
      return { ...prev, [activePage]: next };
    });
  }, [activePage]);

  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<"sections" | "theme">("sections");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"section" | "global">("section");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [showAddPicker, setShowAddPicker] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initializedRef = useRef(false);

  // ── Queries ──────────────────────────────────────────────────────
  const { data: customization, isLoading: custLoading } = useQuery({
    queryKey: ["customization", storeId],
    queryFn: () => fetchCustomization(storeId),
    enabled: !!storeId,
  });

  const activeThemeId = localData?.theme?.base_theme ?? customization?.theme?.base_theme ?? "modern";

  // Fetch store themes to detect if active theme is external
  const { data: storeThemesData } = useQuery({
    queryKey: ["store-themes", storeId],
    queryFn: () => fetchStoreThemes(storeId),
    enabled: !!storeId,
  });

  const externalTheme = useMemo(
    () => storeThemesData?.themes?.find((t) => t.is_external && t.id === activeThemeId),
    [storeThemesData, activeThemeId],
  );
  const isExternalTheme = !!externalTheme;

  // For built-in themes, fetch the full schema bundle from the storefront API.
  // For external themes, we use the schema embedded in the external theme entry.
  const { data: builtinSchemaBundle, isLoading: schemaLoading } = useQuery({
    queryKey: ["themeSchemas", activeThemeId],
    queryFn: () => fetchThemeSchemas(activeThemeId),
    enabled: !!activeThemeId && !isExternalTheme,
  });

  // Build a unified schema bundle from either built-in or external source
  const schemaBundle: ThemeSchemaBundle | undefined = useMemo(() => {
    if (isExternalTheme && externalTheme?.settings_schema) {
      // Convert external theme schema into the same shape as built-in
      return {
        theme_id: externalTheme.id,
        global_settings: externalTheme.settings_schema.settings.map((s) => ({
          key: s.key,
          type: s.type,
          label: s.label,
          labelAr: s.label,
          description: s.description,
          default: s.default,
          group: s.group,
          options: s.options,
          min: s.min,
          max: s.max,
          step: s.step,
          unit: s.unit,
        })),
        sections: [],
        default_templates: {},
      };
    }
    return builtinSchemaBundle;
  }, [isExternalTheme, externalTheme, builtinSchemaBundle]);

  const isLoading = custLoading || (!isExternalTheme && schemaLoading);

  // Schema lookup helper
  const sectionSchemaMap = useMemo(() => {
    const map = new Map<string, SectionSchemaData>();
    schemaBundle?.sections?.forEach((s) => map.set(s.type, s));
    return map;
  }, [schemaBundle]);

  // ── Initialize ────────────────────────────────────────────────────
  useEffect(() => {
    if (!customization || !schemaBundle || initializedRef.current) return;
    initializedRef.current = true;

    const previewTheme = searchParams.get("theme");
    let data = customization;
    if (previewTheme && previewTheme !== customization.theme?.base_theme) {
      data = { ...customization, theme: { ...customization.theme, base_theme: previewTheme } };
      setIsDirty(true);
    }
    setLocalData(data);

    // Initialize ALL page templates from existing customization or theme defaults
    const existingTemplates = (data as CustomizationData & { templates?: Record<string, TemplateConfigData> })?.templates ?? {};
    const defaults = schemaBundle.default_templates ?? {};
    const merged: Record<string, TemplateConfigData> = {};

    for (const page of EDITABLE_PAGES) {
      merged[page.id] = existingTemplates[page.id]
        ?? defaults[page.id]
        ?? { name: page.id, sections: {}, order: [] };
    }
    setAllTemplates(merged);

    // Auto-select first section of home page
    const homeTpl = merged["home"];
    if (homeTpl && homeTpl.order.length > 0) {
      setSelectedId(homeTpl.order[0]);
      setSelectedType("section");
    }
  }, [customization, schemaBundle, searchParams]);

  // ── PostMessage to iframe ─────────────────────────────────────────
  const sendPreviewUpdate = useRef<ReturnType<typeof setTimeout>>();

  const sendThemeToIframe = useCallback(() => {
    if (!localData || !template) return;
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    try {
      target.postMessage({
        type: "NUMU_THEME_UPDATE",
        settings: {
          theme: localData.theme,
          identity: localData.identity,
          header: localData.header,
          hero: localData.hero,
          products: localData.products,
          footer: localData.footer,
          navigation: localData.navigation,
          labels: localData.labels,
          layout: localData.layout,
          schema_version: 2,
          templates: allTemplates,
        },
      }, "*");
    } catch { /* iframe not ready */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localData, allTemplates]);

  useEffect(() => {
    clearTimeout(sendPreviewUpdate.current);
    sendPreviewUpdate.current = setTimeout(sendThemeToIframe, 100);
    return () => clearTimeout(sendPreviewUpdate.current);
  }, [sendThemeToIframe]);

  const handleIframeLoad = useCallback(() => {
    setTimeout(sendThemeToIframe, 500);
  }, [sendThemeToIframe]);

  // ── Page change ──────────────────────────────────────────────────
  const handlePageChange = useCallback((pageId: string) => {
    setActivePage(pageId);

    // Auto-select the first (and usually only) section of the new page
    const pageTpl = allTemplates[pageId];
    if (pageTpl && pageTpl.order.length > 0) {
      setSelectedId(pageTpl.order[0]);
      setSelectedType("section");
    } else {
      setSelectedId(null);
    }

    // Navigate iframe to the page's preview path
    const pageDef = EDITABLE_PAGES.find((p) => p.id === pageId);
    if (pageDef && iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({
          type: "NUMU_NAVIGATE",
          path: pageDef.previewPath,
        }, "*");
      } catch {
        // Fallback
      }
    }
  }, [allTemplates]);

  // ── Section operations ────────────────────────────────────────────
  function updateSectionSetting(sectionId: string, key: string, value: unknown) {
    setTemplate((prev) => {
      if (!prev) return prev;
      const instance = prev.sections[sectionId];
      if (!instance) return prev;
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [sectionId]: { ...instance, settings: { ...instance.settings, [key]: value } },
        },
      };
    });
    setIsDirty(true);
  }

  function toggleSection(sectionId: string) {
    setTemplate((prev) => {
      if (!prev) return prev;
      const instance = prev.sections[sectionId];
      if (!instance) return prev;
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [sectionId]: { ...instance, disabled: !instance.disabled },
        },
      };
    });
    setIsDirty(true);
  }

  function removeSection(sectionId: string) {
    setTemplate((prev) => {
      if (!prev) return prev;
      const { [sectionId]: _, ...rest } = prev.sections;
      return { ...prev, sections: rest, order: prev.order.filter((id) => id !== sectionId) };
    });
    if (selectedId === sectionId) setSelectedId(null);
    setIsDirty(true);
  }

  function moveSection(sectionId: string, direction: "up" | "down") {
    setTemplate((prev) => {
      if (!prev) return prev;
      const order = [...prev.order];
      const idx = order.indexOf(sectionId);
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= order.length) return prev;
      [order[idx], order[target]] = [order[target], order[idx]];
      return { ...prev, order };
    });
    setIsDirty(true);
  }

  function addSection(sectionType: string) {
    if (!schemaBundle) return;
    const schema = sectionSchemaMap.get(sectionType);
    if (!schema) return;

    const newId = generateId(sectionType.split("-")[0]);
    const defaults: Record<string, unknown> = {};
    schema.settings?.forEach((s) => { if (s.default !== undefined) defaults[s.key] = s.default; });
    const preset = schema.presets?.[0]?.settings ?? {};

    setTemplate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [newId]: { id: newId, type: sectionType, settings: { ...defaults, ...preset } },
        },
        order: [...prev.order, newId],
      };
    });
    setSelectedId(newId);
    setSelectedType("section");
    setShowAddPicker(false);
    setIsDirty(true);
  }

  // ── Global field update ──────────────────────────────────────────
  function updateGlobalField(path: string, value: unknown) {
    if (!localData) return;
    setLocalData(setNestedValue(localData, path, value) as CustomizationData);
    setIsDirty(true);
  }

  // ── Save / Publish ───────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!localData || Object.keys(allTemplates).length === 0) throw new Error("No data");
      return updateCustomization(storeId, {
        identity: localData.identity,
        theme: localData.theme,
        header: localData.header,
        hero: localData.hero,
        products: localData.products,
        footer: localData.footer,
        navigation: localData.navigation,
        labels: localData.labels,
        layout: localData.layout,
        schema_version: 2,
        templates: allTemplates,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customization", storeId] });
      toast.success(isRTL ? "تم حفظ التغييرات" : "Changes saved");
      setIsDirty(false);
      sendThemeToIframe();
    },
    onError: (err) => showError(err),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!localData || Object.keys(allTemplates).length === 0) throw new Error("No data");
      await updateCustomization(storeId, {
        identity: localData.identity,
        theme: localData.theme,
        header: localData.header,
        hero: localData.hero,
        products: localData.products,
        footer: localData.footer,
        navigation: localData.navigation,
        labels: localData.labels,
        layout: localData.layout,
        schema_version: 2,
        templates: allTemplates,
      });
      return publishCustomization(storeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customization", storeId] });
      toast.success(isRTL ? "تم نشر المتجر" : "Store published");
      setIsDirty(false);
      setPreviewKey((k) => k + 1);
    },
    onError: (err) => showError(err),
  });

  const isBusy = saveMutation.isPending || publishMutation.isPending;

  const isHomePage = activePage === "home";

  // Available sections for the "add" picker (respect limits)
  const availableSections = useMemo(() => {
    if (!schemaBundle?.sections || !template) return [];
    return schemaBundle.sections.filter((schema) => {
      // Page sections (limit:1, page_section:true) are not manually addable
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isPageSection = (schema as any).page_section === true;
      if (isPageSection) return false;

      if (!schema.limit || schema.limit === 0) return true;
      const existing = Object.values(template.sections).filter((s) => s.type === schema.type).length;
      return existing < schema.limit;
    });
  }, [schemaBundle, template]);

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" data-testid="theme-editor">
      {/* ── Top bar ───────────────────────────────────────────────── */}
      <header className="flex h-12 items-center gap-0 border-b bg-card px-3 shrink-0" data-testid="theme-editor-topbar">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-[13px] font-medium me-2"
          onClick={() => navigate("/online-store/themes")}>
          <ArrowLeft className="h-3.5 w-3.5" />
          {isRTL ? "خروج" : "Exit"}
        </Button>
        <div className="h-5 w-px bg-border mx-1 shrink-0" />

        {/* Tabs */}
        <div className="flex items-center gap-0.5">
          {(["sections", "theme"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              data-testid={`theme-editor-tab-${tab}`}
              className={cn("px-3 h-8 text-[12px] font-medium rounded-md transition-colors",
                activeTab === tab ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
              {tab === "sections" ? (isRTL ? "الأقسام" : "Sections") : (isRTL ? "الثيم" : "Theme")}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Device */}
        <div className="flex items-center gap-1 me-2">
          <Button variant={device === "desktop" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 px-0"
            data-testid="theme-editor-device-desktop"
            onClick={() => setDevice("desktop")}><Monitor className="h-3.5 w-3.5" /></Button>
          <Button variant={device === "mobile" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 px-0"
            data-testid="theme-editor-device-mobile"
            onClick={() => setDevice("mobile")}><Smartphone className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="h-5 w-px bg-border mx-1 shrink-0" />

        {isDirty && (
          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 me-2" data-testid="theme-editor-unsaved-badge">
            {isRTL ? "تغييرات" : "Unsaved"}
          </Badge>
        )}

        <Button variant="outline" size="sm" className="h-8 text-[13px]" data-testid="theme-editor-save"
          onClick={() => saveMutation.mutate()} disabled={isBusy || !isDirty}>
          {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
          {isRTL ? "حفظ" : "Save"}
        </Button>
        <Button size="sm" className="h-8 text-[13px] ms-1.5" data-testid="theme-editor-publish"
          onClick={() => { if (requireTrial("publish_store")) publishMutation.mutate(); }} disabled={isBusy}>
          {publishMutation.isPending ? <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" /> : <Globe className="h-3.5 w-3.5 me-1.5" />}
          {isRTL ? "نشر" : "Publish"}
        </Button>
      </header>

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar */}
        <aside className="flex w-[272px] shrink-0 flex-col border-e bg-card overflow-y-auto" data-testid="theme-editor-left-panel">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
            </div>
          ) : activeTab === "sections" ? (
            <SectionsPanel
              activePage={activePage}
              onPageChange={handlePageChange}
              isHomePage={activePage === "home"}
              template={template}
              schemaMap={sectionSchemaMap}
              selectedId={selectedId}
              selectedType={selectedType}
              isRTL={isRTL}
              showAddPicker={showAddPicker}
              availableSections={availableSections}
              onSelectSection={(id) => { setSelectedId(id); setSelectedType("section"); }}
              onSelectGlobal={(id) => { setSelectedId(id); setSelectedType("global"); }}
              onMove={moveSection}
              onToggle={toggleSection}
              onRemove={removeSection}
              onAdd={addSection}
              onShowAdd={setShowAddPicker}
            />
          ) : (
            <ThemeSettingsSidebar groups={THEME_FIELD_GROUPS} data={localData} isRTL={isRTL} onChange={updateGlobalField} schemaSettings={schemaBundle?.global_settings} />
          )}
        </aside>

        {/* Center — Preview */}
        <main className="relative flex flex-1 flex-col items-center justify-center bg-muted/40 overflow-hidden" data-testid="theme-editor-preview-panel">
          {storeUrl ? (
            <>
              <div className={cn(
                "relative bg-white shadow-2xl transition-all duration-300 ease-in-out overflow-hidden",
                device === "mobile"
                  ? "w-[390px] rounded-[36px] border-[6px] border-zinc-800 shadow-[0_30px_80px_rgba(0,0,0,0.25)]"
                  : "w-full h-full rounded-none border-none shadow-none"
              )} style={device === "mobile" ? { height: "calc(100% - 48px)" } : { height: "100%" }} data-testid="theme-editor-preview-shell">
                <iframe ref={iframeRef} key={previewKey} src={storeUrl}
                  className="w-full h-full border-0" title="Store preview" onLoad={handleIframeLoad} data-testid="theme-editor-preview-iframe" />
              </div>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <button className="flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur-sm border px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors shadow-sm" data-testid="theme-editor-preview-refresh"
                  onClick={() => setPreviewKey((k) => k + 1)}>
                  <RefreshCw className="h-3 w-3" />
                  {isRTL ? "تحديث" : "Refresh"}
                </button>
              </div>
            </>
          ) : (
            <PreviewPlaceholder isRTL={isRTL} />
          )}
        </main>

        {/* Right panel — Settings for selected item */}
        {selectedId && (
          <aside className="w-[300px] shrink-0 border-s bg-card overflow-y-auto" data-testid="theme-editor-settings-panel">
            {selectedType === "section" && template ? (
              <SectionSettingsPanel
                sectionId={selectedId}
                instance={template.sections[selectedId]}
                schema={sectionSchemaMap.get(template.sections[selectedId]?.type)}
                isRTL={isRTL}
                onChange={updateSectionSetting}
              />
            ) : selectedType === "global" ? (
              <GlobalSettingsPanel
                sectionId={selectedId}
                data={localData}
                isRTL={isRTL}
                onChange={updateGlobalField}
              />
            ) : null}
          </aside>
        )}
      </div>
    </div>
  );
}

// ─── Sections panel (left sidebar, "Sections" tab) ──────────────────────────

function SectionsPanel({
  activePage, onPageChange, isHomePage,
  template, schemaMap, selectedId, selectedType, isRTL,
  showAddPicker, availableSections,
  onSelectSection, onSelectGlobal, onMove, onToggle, onRemove, onAdd, onShowAdd,
}: {
  activePage: string;
  onPageChange: (pageId: string) => void;
  isHomePage: boolean;
  template: TemplateConfigData | null;
  schemaMap: Map<string, SectionSchemaData>;
  selectedId: string | null;
  selectedType: "section" | "global";
  isRTL: boolean;
  showAddPicker: boolean;
  availableSections: SectionSchemaData[];
  onSelectSection: (id: string) => void;
  onSelectGlobal: (id: string) => void;
  onMove: (id: string, dir: "up" | "down") => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: (type: string) => void;
  onShowAdd: (show: boolean) => void;
}) {
  return (
    <div className="flex flex-col h-full" data-testid="theme-editor-sections-panel">
      {/* Global sections (header, footer, identity) */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1.5">
          {isRTL ? "عام" : "Global"}
        </p>
        {GLOBAL_SECTIONS.map((gs) => {
          const Icon = gs.icon;
          const active = selectedType === "global" && selectedId === gs.id;
          return (
            <button key={gs.id} onClick={() => onSelectGlobal(gs.id)}
              data-testid={`theme-editor-global-${gs.id}`}
              className={cn("w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-colors mb-0.5",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {isRTL ? gs.nameAr : gs.name}
            </button>
          );
        })}
      </div>

      <div className="mx-3 h-px bg-border" />

      {/* Page selector */}
      <div className="px-3 pt-2 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1.5">
          {isRTL ? "الصفحة" : "Page"}
        </p>
        <Select value={activePage} onValueChange={onPageChange}>
          <SelectTrigger className="h-8 text-[12px] mb-2" data-testid="theme-editor-page-selector">
            <SelectValue />
          </SelectTrigger>
          <SelectContent data-testid="theme-editor-page-options">
            {EDITABLE_PAGES.map((page) => (
              <SelectItem key={page.id} value={page.id} className="text-[12px]" data-testid={`theme-editor-page-option-${page.id}`}>
                {isRTL ? page.nameAr : page.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="px-3 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1.5">
          {isRTL
            ? `أقسام ${EDITABLE_PAGES.find((p) => p.id === activePage)?.nameAr ?? ""}`
            : `${EDITABLE_PAGES.find((p) => p.id === activePage)?.name ?? ""} sections`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {template?.order.map((sectionId, idx) => {
          const instance = template.sections[sectionId];
          if (!instance) return null;
          const schema = schemaMap.get(instance.type);
          const Icon = SECTION_ICONS[instance.type] ?? Layout;
          const name = schema ? (isRTL ? schema.nameAr ?? schema.name : schema.name) : instance.type;
          const active = selectedType === "section" && selectedId === sectionId;
          const disabled = instance.disabled;

          return (
            <div key={sectionId}
              data-testid="theme-editor-section-item"
              data-section-id={sectionId}
              data-section-type={instance.type}
              className={cn("group flex items-center gap-1 rounded-lg mb-0.5 transition-colors",
                active ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted",
                disabled && "opacity-50")}>
              {/* Grip */}
              <GripVertical className="h-3 w-3 text-muted-foreground/30 shrink-0 ms-1" />

              {/* Name — clickable */}
              <button onClick={() => onSelectSection(sectionId)}
                data-testid={`theme-editor-section-select-${sectionId}`}
                className="flex-1 flex items-center gap-2 py-2 px-1 text-[12px] font-medium text-start truncate">
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{name}</span>
              </button>

              {/* Actions */}
              <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 me-1">
                <button onClick={() => onMove(sectionId, "up")} disabled={idx === 0}
                  data-testid="theme-editor-section-move-up"
                  data-section-id={sectionId}
                  className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronUp className="h-3 w-3" /></button>
                <button onClick={() => onMove(sectionId, "down")} disabled={idx === template.order.length - 1}
                  data-testid="theme-editor-section-move-down"
                  data-section-id={sectionId}
                  className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronDown className="h-3 w-3" /></button>
                <button onClick={() => onToggle(sectionId)} className="p-1 text-muted-foreground hover:text-foreground"
                  data-testid="theme-editor-section-toggle"
                  data-section-id={sectionId}>
                  {disabled ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
                <button onClick={() => onRemove(sectionId)}
                  data-testid="theme-editor-section-delete"
                  data-section-id={sectionId}
                  className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          );
        })}

        {/* Add section */}
        {!showAddPicker ? (
          <button onClick={() => onShowAdd(true)} data-testid="theme-editor-add-section"
            className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-1 rounded-lg border border-dashed border-muted-foreground/20 text-[12px] text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
            <Plus className="h-3.5 w-3.5" />
            {isRTL ? "إضافة قسم" : "Add section"}
          </button>
        ) : (
          <div className="mt-1 rounded-lg border bg-background p-2 space-y-0.5" data-testid="theme-editor-add-section-picker">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-semibold">{isRTL ? "اختر قسم" : "Choose section"}</p>
              <button onClick={() => onShowAdd(false)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
            </div>
            {availableSections.map((schema) => {
              const Icon = SECTION_ICONS[schema.type] ?? Layout;
              return (
                <button key={schema.type} onClick={() => onAdd(schema.type)}
                  data-testid={`theme-editor-add-section-option-${schema.type}`}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {isRTL ? schema.nameAr ?? schema.name : schema.name}
                </button>
              );
            })}
            {availableSections.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-2">{isRTL ? "كل الأقسام مضافة" : "All sections added"}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section settings panel (right sidebar) ─────────────────────────────────

function SectionSettingsPanel({
  sectionId, instance, schema, isRTL, onChange,
}: {
  sectionId: string;
  instance: SectionInstanceData | undefined;
  schema: SectionSchemaData | undefined;
  isRTL: boolean;
  onChange: (sectionId: string, key: string, value: unknown) => void;
}) {
  if (!instance || !schema) {
    return <div className="p-4 text-sm text-muted-foreground">{isRTL ? "قسم غير معروف" : "Unknown section"}</div>;
  }

  // Group settings
  const groups = new Map<string, SectionSettingDefinition[]>();
  for (const setting of schema.settings ?? []) {
    const group = isRTL ? (setting.groupAr ?? setting.group ?? "عام") : (setting.group ?? "General");
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(setting);
  }

  return (
    <div className="py-3" data-testid="theme-editor-section-settings">
      <div className="px-4 pb-3 border-b">
        <h3 className="text-sm font-semibold">{isRTL ? schema.nameAr ?? schema.name : schema.name}</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">{instance.type}</p>
      </div>
      {Array.from(groups.entries()).map(([group, settings]) => (
        <div key={group} className="px-4 py-3 border-b last:border-b-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-3">{group}</p>
          <div className="space-y-4">
            {settings.map((setting) => (
              <SchemaFieldControl
                key={setting.key}
                setting={setting}
                value={instance.settings[setting.key] ?? setting.default}
                isRTL={isRTL}
                onChange={(v) => onChange(sectionId, setting.key, v)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Global settings panel (right sidebar) ──────────────────────────────────

function GlobalSettingsPanel({
  sectionId, data, isRTL, onChange,
}: {
  sectionId: string;
  data: CustomizationData | null;
  isRTL: boolean;
  onChange: (path: string, value: unknown) => void;
}) {
  const section = GLOBAL_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return null;
  const Icon = section.icon;

  return (
    <div className="py-3" data-testid="theme-editor-global-settings">
      <div className="px-4 pb-3 border-b flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{isRTL ? section.nameAr : section.name}</h3>
      </div>
      <div className="px-4 py-3 space-y-4">
        {section.fields.map((field) => (
          <FieldControl
            key={field.key}
            field={field}
            value={data ? getNestedValue(data, field.key) : undefined}
            isRTL={isRTL}
            onChange={(v) => onChange(field.key, v)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Schema-driven field control (for section settings) ─────────────────────

function SchemaFieldControl({
  setting, value, isRTL, onChange,
}: {
  setting: SectionSettingDefinition;
  value: unknown;
  isRTL: boolean;
  onChange: (value: unknown) => void;
}) {
  const label = isRTL ? (setting.labelAr ?? setting.label) : setting.label;
  const testId = `theme-editor-setting-${toTestIdSuffix(setting.key)}`;

  if (setting.type === "checkbox") {
    return (
      <div className="flex items-center justify-between gap-3" data-testid={testId}>
        <Label className="text-[12px] font-medium leading-tight">{label}</Label>
        <Switch checked={Boolean(value)} onCheckedChange={onChange} className="shrink-0" data-testid={`${testId}-switch`} />
      </div>
    );
  }

  if (setting.type === "color") {
    const colorVal = String(value ?? "#000000");
    return (
      <div className="space-y-1.5" data-testid={testId}>
        <Label className="text-[12px] font-medium">{label}</Label>
        <div className="flex items-center gap-2">
          <input type="color" value={colorVal} onChange={(e) => onChange(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded-md border border-input p-0.5 block shrink-0" data-testid={`${testId}-color`} />
          <Input value={colorVal} onChange={(e) => onChange(e.target.value)}
            className="h-8 font-mono text-[12px] flex-1" maxLength={7} data-testid={`${testId}-input`} />
        </div>
      </div>
    );
  }

  if (setting.type === "select" && setting.options) {
    return (
      <div className="space-y-1.5" data-testid={testId}>
        <Label className="text-[12px] font-medium">{label}</Label>
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-[12px]" data-testid={`${testId}-select`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {setting.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-[12px]">
                {isRTL ? (opt.labelAr ?? opt.label) : opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (setting.type === "range" || setting.type === "number") {
    const numVal = Number(value ?? setting.min ?? 0);
    return (
      <div className="space-y-2" data-testid={testId}>
        <div className="flex items-center justify-between">
          <Label className="text-[12px] font-medium">{label}</Label>
          <span className="text-[11px] text-muted-foreground font-mono">{numVal}{setting.unit ?? ""}</span>
        </div>
        <Slider value={[numVal]} min={setting.min ?? 0} max={setting.max ?? 100} step={setting.step ?? 1}
          onValueChange={([v]) => onChange(v)} className="py-0" data-testid={`${testId}-slider`} />
      </div>
    );
  }

  if (setting.type === "textarea" || setting.type === "richtext") {
    return (
      <div className="space-y-1.5" data-testid={testId}>
        <Label className="text-[12px] font-medium">{label}</Label>
        <Textarea value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}
          placeholder={setting.placeholder} rows={3} className="text-[12px] resize-none" data-testid={`${testId}-textarea`} />
      </div>
    );
  }

  if (setting.type === "image") {
    return (
      <ImageUploadField
        value={typeof value === "string" ? value : undefined}
        onChange={(url) => onChange(url)}
        label={label}
        fieldKey={setting.key}
        isRTL={isRTL}
        testId={testId}
      />
    );
  }

  if (setting.type === "url") {
    return (
      <div className="space-y-1.5" data-testid={testId}>
        <Label className="text-[12px] font-medium">{label}</Label>
        <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}
          placeholder={setting.placeholder} className="h-8 text-[12px]" type="url" dir="ltr" data-testid={`${testId}-input`} />
      </div>
    );
  }

  // text (default)
  return (
    <div className="space-y-1.5" data-testid={testId}>
      <Label className="text-[12px] font-medium">{label}</Label>
      <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}
        placeholder={setting.placeholder} className="h-8 text-[12px]" data-testid={`${testId}-input`} />
    </div>
  );
}

// ─── Theme settings sidebar (reused from before) ────────────────────────────

function ThemeSettingsSidebar({ groups, data, isRTL, onChange, schemaSettings }: {
  groups: ThemeFieldGroup[]; data: CustomizationData | null; isRTL: boolean;
  onChange: (path: string, value: unknown) => void;
  schemaSettings?: SectionSettingDefinition[];
}) {
  // Group per-theme schema settings by their group field
  const schemaGroups = useMemo(() => {
    if (!schemaSettings?.length) return [];
    const map = new Map<string, { groupAr?: string; settings: SectionSettingDefinition[] }>();
    for (const s of schemaSettings) {
      const g = s.group ?? "Other";
      // Skip groups already handled by the hardcoded THEME_FIELD_GROUPS (Colors, Typography, Style)
      if (g === "Colors" || g === "Typography" || g === "Style") continue;
      if (!map.has(g)) map.set(g, { groupAr: s.groupAr, settings: [] });
      map.get(g)!.settings.push(s);
    }
    return Array.from(map.entries());
  }, [schemaSettings]);

  return (
    <div className="py-3" data-testid="theme-editor-theme-settings">
      {groups.map((group) => (
        <div key={group.group} className="px-4 py-3 border-b last:border-b-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-3">
            {isRTL ? group.groupAr : group.group}
          </p>
          <div className="space-y-4">
            {group.fields.map((field) => (
              <FieldControl key={field.key} field={field}
                value={data ? getNestedValue(data, field.key) : undefined}
                isRTL={isRTL} onChange={(v) => onChange(field.key, v)} compact />
            ))}
          </div>
        </div>
      ))}
      {schemaGroups.map(([groupName, { groupAr, settings }]) => (
        <div key={groupName} className="px-4 py-3 border-b last:border-b-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-3">
            {isRTL ? (groupAr ?? groupName) : groupName}
          </p>
          <div className="space-y-4">
            {settings.map((setting) => (
              <SchemaFieldControl key={setting.key} setting={setting}
                value={data ? getNestedValue(data, `theme.${setting.key}`) : (setting.default ?? undefined)}
                isRTL={isRTL} onChange={(v) => onChange(`theme.${setting.key}`, v)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Image upload field (logo, favicon, hero images, …) ────────────────────

function inferAssetType(fieldKey: string): "logo" | "favicon" | "hero_image" | "section_image" {
  const k = fieldKey.toLowerCase();
  if (k.includes("favicon")) return "favicon";
  if (k.includes("logo")) return "logo";
  if (k.includes("hero")) return "hero_image";
  return "section_image";
}

function ImageUploadField({
  value, onChange, label, fieldKey, isRTL, testId,
}: {
  value: string | undefined;
  onChange: (url: string) => void;
  label: string;
  fieldKey: string;
  isRTL: boolean;
  testId: string;
}) {
  const { currentStore } = useDashboardStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const assetType = useMemo(() => inferAssetType(fieldKey), [fieldKey]);
  const aspect = assetType === "hero_image" ? 16 / 9 : 1;

  const onPickFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onCropDone = async (blob: Blob) => {
    if (!currentStore?.id) return;
    setUploading(true);
    try {
      const file = new File([blob], `${assetType}.jpg`, { type: "image/jpeg" });
      const result = await uploadStoreAsset(currentStore.id, file, assetType);
      onChange(result.url);
      setCropSrc(null);
      toast.success(isRTL ? "تم رفع الصورة" : "Image uploaded");
    } catch {
      toast.error(isRTL ? "فشل رفع الصورة" : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5" data-testid={testId}>
      <Label className="text-[12px] font-medium">{label}</Label>
      <div className="flex items-center gap-2">
        {value ? (
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
            <img src={value} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-dashed bg-muted/40">
            <Image className="h-4 w-4 text-muted-foreground/50" />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            data-testid={`${testId}-file-input`}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickFile(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-[11px]"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !currentStore?.id}
            data-testid={`${testId}-upload-btn`}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {value ? (isRTL ? "تغيير" : "Replace") : (isRTL ? "رفع" : "Upload")}
          </Button>
          {value && (
            <button
              type="button"
              className="self-start text-[10px] text-muted-foreground hover:text-destructive"
              onClick={() => onChange("")}
              data-testid={`${testId}-remove-btn`}
            >
              {isRTL ? "إزالة" : "Remove"}
            </button>
          )}
        </div>
      </div>
      {cropSrc && (
        <ImageCropDialog
          open={!!cropSrc}
          onClose={() => setCropSrc(null)}
          imageSrc={cropSrc}
          cropShape="rect"
          aspect={aspect}
          title={isRTL ? "تعديل الصورة" : "Edit image"}
          loading={uploading}
          onCropComplete={onCropDone}
        />
      )}
    </div>
  );
}

// ─── Field control (for global/theme settings) ──────────────────────────────

function FieldControl({ field, value, isRTL, onChange, compact = false }: {
  field: FieldDef; value: unknown; isRTL: boolean;
  onChange: (value: unknown) => void; compact?: boolean;
}) {
  const label = isRTL ? field.labelAr : field.label;
  const testId = `theme-editor-field-${toTestIdSuffix(field.key)}`;

  if (field.type === "toggle") {
    return (
      <div className="flex items-center justify-between gap-3" data-testid={testId}>
        <Label className={cn("text-[12px] font-medium leading-tight", compact ? "text-xs" : "text-sm")}>{label}</Label>
        <Switch checked={Boolean(value)} onCheckedChange={onChange} className="shrink-0" data-testid={`${testId}-switch`} />
      </div>
    );
  }
  if (field.type === "color") {
    const colorVal = String(value ?? "#000000");
    return (
      <div className="space-y-1.5" data-testid={testId}>
        <Label className="text-[12px] font-medium">{label}</Label>
        <div className="flex items-center gap-2">
          <input type="color" value={colorVal} onChange={(e) => onChange(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded-md border border-input p-0.5 block shrink-0" data-testid={`${testId}-color`} />
          <Input value={colorVal} onChange={(e) => onChange(e.target.value)}
            className="h-8 font-mono text-[12px] flex-1" maxLength={7} data-testid={`${testId}-input`} />
        </div>
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <div className="space-y-1.5" data-testid={testId}>
        <Label className="text-[12px] font-medium">{label}</Label>
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-[12px]" data-testid={`${testId}-select`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt} className="text-[12px]">{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.type === "range") {
    const numVal = Number(value ?? field.min ?? 0);
    return (
      <div className="space-y-2" data-testid={testId}>
        <div className="flex items-center justify-between">
          <Label className="text-[12px] font-medium">{label}</Label>
          <span className="text-[11px] text-muted-foreground font-mono">{numVal}px</span>
        </div>
        <Slider value={[numVal]} min={field.min ?? 0} max={field.max ?? 100} step={field.step ?? 1}
          onValueChange={([v]) => onChange(v)} className="py-0" data-testid={`${testId}-slider`} />
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5" data-testid={testId}>
        <Label className="text-[12px] font-medium">{label}</Label>
        <Textarea value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder} rows={3} className="text-[12px] resize-none" data-testid={`${testId}-textarea`} />
      </div>
    );
  }
  if (field.type === "image_picker") {
    return (
      <ImageUploadField
        value={typeof value === "string" ? value : undefined}
        onChange={(url) => onChange(url)}
        label={label}
        fieldKey={field.key}
        isRTL={isRTL}
        testId={testId}
      />
    );
  }
  return (
    <div className="space-y-1.5" data-testid={testId}>
      <Label className="text-[12px] font-medium">{label}</Label>
      <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder} className="h-8 text-[12px]"
        type={field.type === "url" ? "url" : "text"} dir={field.type === "url" ? "ltr" : undefined} data-testid={`${testId}-input`} />
    </div>
  );
}

// ─── Preview placeholder ────────────────────────────────────────────────────

function PreviewPlaceholder({ isRTL }: { isRTL: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
        <Monitor className="h-8 w-8 text-muted-foreground/30" />
      </div>
      <p className="text-base font-semibold text-muted-foreground/60 mb-1">
        {isRTL ? "معاينة المتجر" : "Store preview"}
      </p>
      <p className="text-sm text-muted-foreground/40">
        {isRTL ? "أضف نطاقًا فرعيًا لتفعيل المعاينة" : "Add a subdomain to enable preview"}
      </p>
    </div>
  );
}
