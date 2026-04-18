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
import { useEditHistory } from "@/hooks/useEditHistory";
import { MediaPickerDialog } from "@/components/theme-editor/MediaPickerDialog";
import { LinkEditorPopover } from "@/components/theme-editor/LinkEditorPopover";
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
import { FontGallery } from "@/components/theme-editor/FontGallery";
import {
  ArrowLeft, Monitor, Smartphone, Tablet, Undo2, Redo2, Globe,
  Loader2, Layout, Package, Navigation2, Image, AlignLeft,
  Palette, Store, RefreshCw, Plus, Trash2, Eye, EyeOff,
  ChevronUp, ChevronDown, GripVertical, CreditCard, MessageCircle, CheckCircle, User,
  Upload,
} from "lucide-react";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { uploadStoreAsset } from "@/services/storeApi";
import { listProducts } from "@/services/productApi";

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
      { key: "theme.heading_font", label: "Heading font", labelAr: "خط العناوين", type: "font" },
      { key: "theme.body_font", label: "Body font", labelAr: "خط النصوص", type: "font" },
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
  { id: "lookbook", name: "Lookbook", nameAr: "لوك بوك", icon: Image, previewPath: "/lookbook" },
  { id: "faq", name: "FAQ", nameAr: "الأسئلة الشائعة", icon: MessageCircle, previewPath: "/faq" },
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

  // History for undo/redo
  const {
    state: historyState,
    setState: setHistoryState,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditHistory<{ templates: Record<string, TemplateConfigData> }>({ templates: {} });

  // Sync history state with templates
  useEffect(() => {
    if (Object.keys(allTemplates).length > 0 && initializedRef.current) {
      setHistoryState({ templates: allTemplates });
    }
  }, [allTemplates, setHistoryState]);

  // Sync history state back to templates (for undo/redo)
  useEffect(() => {
    if (historyState.templates && Object.keys(historyState.templates).length > 0 && initializedRef.current) {
      setAllTemplates(historyState.templates);
    }
  }, [historyState]);

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
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [insertAfterSectionId, setInsertAfterSectionId] = useState<string | null>(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<{ sectionId?: string; path?: string; settingKey?: string; type: "section" | "global" } | null>(null);
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [linkEditorTarget, setLinkEditorTarget] = useState<{ sectionId: string; textKey: string; urlKey: string; type: "section" } | null>(null);

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

      if (template && schemaBundle) {
        const sectionsMeta = template.order.map((id) => {
          const inst = template.sections[id];
          const schema = sectionSchemaMap.get(inst?.type ?? "");
          return {
            id,
            type: inst?.type ?? "",
            name: schema?.name ?? inst?.type ?? "",
            nameAr: schema?.nameAr,
            disabled: inst?.disabled ?? false,
          };
        });
        // Expose global chrome (header/footer/identity) to the overlay so
        // hover labels show their friendly names instead of the raw
        // "__global:*__" sentinel.
        for (const g of GLOBAL_SECTIONS) {
          sectionsMeta.push({
            id: `__global:${g.id}__`,
            type: "global",
            name: g.name,
            nameAr: g.nameAr,
            disabled: false,
          });
        }
        target.postMessage({ type: "NUMU_SECTIONS_META", sections: sectionsMeta }, "*");
      }
    } catch { /* iframe not ready */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localData, allTemplates]);

  useEffect(() => {
    clearTimeout(sendPreviewUpdate.current);
    sendPreviewUpdate.current = setTimeout(sendThemeToIframe, 100);
    return () => clearTimeout(sendPreviewUpdate.current);
  }, [sendThemeToIframe]);

  const handleIframeLoad = useCallback(() => {
    setTimeout(() => {
      sendThemeToIframe();
      iframeRef.current?.contentWindow?.postMessage(
        { type: "NUMU_EDIT_MODE", enabled: true },
        "*"
      );
    }, 500);
  }, [sendThemeToIframe]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const { data } = event;
      if (!data?.type) return;

      if (data.type === "NUMU_INLINE_EDIT") {
        const { target, value } = data as { target: string; value: string };
        if (!target || typeof value !== "string") return;
        applyInlineEdit(target, value);
      }

      if (data.type === "NUMU_INLINE_FOCUS") {
        const { target } = data as { target: string };
        if (!target) return;
        focusSettingInPanel(target);
      }

      if (data.type === "NUMU_SECTION_CLICK") {
        const { sectionId } = data;
        if (sectionId) {
          // Global regions are exposed to the storefront overlay with a
          // "__global:<id>__" sentinel so a single click handler covers both
          // section-engine sections and chrome like header/footer/identity.
          const globalMatch = /^__global:(.+)__$/.exec(sectionId);
          if (globalMatch) {
            setSelectedId(globalMatch[1]);
            setSelectedType("global");
          } else {
            // Find which page this section belongs to
            for (const [pageId, tmpl] of Object.entries(allTemplates)) {
              if (tmpl.sections[sectionId]) {
                if (pageId !== activePage) setActivePage(pageId);
                break;
              }
            }
            setSelectedId(sectionId);
            setSelectedType("section");
          }
        }
      }

      if (data.type === "NUMU_SECTION_ACTION") {
        const { sectionId, action } = data;
        if (!sectionId) return;
        if (action === "toggle") toggleSection(sectionId);
        if (action === "delete") removeSection(sectionId);
      }

      if (data.type === "NUMU_INSERT_SECTION") {
        const { afterSectionId } = data;
        setInsertAfterSectionId(afterSectionId ?? null);
        setShowAddPicker(true);
      }

      if (data.type === "NUMU_TOOLBAR_ACTION") {
        const { target, action, linkKey } = data;
        if (!target) return;

        if (action === "replace_image") {
          const [kind, ...rest] = target.split(":");
          if (kind === "section" && rest.length === 2) {
            setMediaPickerTarget({ sectionId: rest[0], settingKey: rest[1], type: "section" });
            setShowMediaPicker(true);
          } else if (kind === "global") {
            setMediaPickerTarget({ path: rest.join(":"), type: "global" });
            setShowMediaPicker(true);
          }
        }

        if (action === "edit_link") {
          const [kind, ...rest] = target.split(":");
          if (kind === "section" && rest.length === 2) {
            setLinkEditorTarget({ sectionId: rest[0], textKey: rest[1], urlKey: linkKey, type: "section" });
            setShowLinkEditor(true);
          }
        }
      }

      if (data.type === "NUMU_DRAG_START") {
        const { sectionId } = data;
        if (sectionId) {
          setSelectedId(sectionId);
          setSelectedType("section");
        }
      }

      if (data.type === "NUMU_DRAG_END") {
        const { sectionId, targetSectionId, position } = data;
        if (!sectionId || !targetSectionId || !position) return;
        
        setTemplate((prev) => {
          if (!prev) return prev;
          const order = prev.order.filter((id) => id !== sectionId);
          const targetIdx = order.indexOf(targetSectionId);
          const insertIdx = position === "before" ? targetIdx : targetIdx + 1;
          order.splice(insertIdx, 0, sectionId);
          return { ...prev, order };
        });
        setIsDirty(true);
      }

      if (data.type === "NUMU_DRAG_OVER") {
        const { targetSectionId, position } = data;
        if (targetSectionId && position) {
          setSelectedId(targetSectionId);
          setSelectedType("section");
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Send NUMU_SECTION_SELECT when selection changes
  useEffect(() => {
    if (selectedId && selectedType === "section") {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "NUMU_SECTION_SELECT", sectionId: selectedId }, "*"
      );
    }
  }, [selectedId, selectedType]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  function applyInlineEdit(target: string, value: string) {
    const [kind, ...rest] = target.split(":");
    if (kind === "section" && rest.length === 2) {
      updateSectionSetting(rest[0], rest[1], value);
    } else if (kind === "global" && rest.length === 1) {
      updateGlobalField(rest[0], value);
    }
  }

  function focusSettingInPanel(target: string) {
    const [kind, ...rest] = target.split(":");

    if (kind === "section" && rest.length >= 1) {
      const sectionId = rest[0];
      const settingKey = rest[1];
      setSelectedId(sectionId);
      setSelectedType("section");
      if (settingKey) {
        const testIdSuffix = settingKey.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        setTimeout(() => {
          const fieldEl = document.querySelector(`[data-testid="theme-editor-setting-${testIdSuffix}"]`);
          fieldEl?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
      }
    } else if (kind === "global" && rest.length === 1) {
      const dotPath = rest[0];
      const sectionId = dotPath.split(".")[0];
      setSelectedId(sectionId);
      setSelectedType("global");
      const testIdSuffix = dotPath.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      setTimeout(() => {
        const fieldEl = document.querySelector(`[data-testid="theme-editor-field-${testIdSuffix}"]`);
        fieldEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  }

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
      const newOrder = [...prev.order];
      
      if (insertAfterSectionId !== null) {
        const idx = newOrder.indexOf(insertAfterSectionId);
        if (idx !== -1) {
          newOrder.splice(idx + 1, 0, newId);
        } else {
          newOrder.push(newId);
        }
      } else if (insertAfterSectionId === null && showAddPicker) {
        newOrder.unshift(newId);
      } else {
        newOrder.push(newId);
      }

      return {
        ...prev,
        sections: {
          ...prev.sections,
          [newId]: { id: newId, type: sectionType, settings: { ...defaults, ...preset } },
        },
        order: newOrder,
      };
    });
    setSelectedId(newId);
    setSelectedType("section");
    setShowAddPicker(false);
    setInsertAfterSectionId(null);
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
    
    const result = schemaBundle.sections.filter((schema) => {
      // Page sections (checkout, product-detail, etc.) are not manually addable
      const isPageSection = 
        schema.type === "checkout" ||
        schema.type === "product-detail" ||
        schema.type === "products-page" ||
        schema.type === "order-confirmation" ||
        schema.type === "contact" ||
        schema.type === "profile";
      if (isPageSection) return false;

      if (!schema.limit || schema.limit === 0) return true;
      const existing = Object.values(template.sections).filter((s) => s.type === schema.type).length;
      return existing < schema.limit;
    });
    
    return result;
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

        {/* Undo/Redo */}
        <div className="flex items-center gap-1 me-2">
          <Button variant="ghost" size="sm" className="h-7 w-7 px-0" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 px-0" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="h-5 w-px bg-border mx-1 shrink-0" />

        {/* Device */}
        <div className="flex items-center gap-1 me-2">
          <Button variant={device === "desktop" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 px-0"
            data-testid="theme-editor-device-desktop"
            onClick={() => setDevice("desktop")}><Monitor className="h-3.5 w-3.5" /></Button>
          <Button variant={device === "tablet" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 px-0"
            data-testid="theme-editor-device-tablet"
            onClick={() => setDevice("tablet")}><Tablet className="h-3.5 w-3.5" /></Button>
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
              setInsertAfterSectionId={setInsertAfterSectionId}
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
                  : device === "tablet"
                  ? "w-[768px] h-full border-[6px] border-zinc-800 rounded-[24px] shadow-lg"
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
            {selectedType === "section" ? (
              (() => {
                // Search all templates for the section
                let foundInstance: SectionInstanceData | undefined = undefined;
                let foundPageId = activePage;
                
                // First check active page template
                if (template?.sections[selectedId]) {
                  foundInstance = template.sections[selectedId];
                } else {
                  // Search all page templates
                  for (const [pageId, tmpl] of Object.entries(allTemplates)) {
                    if (tmpl.sections[selectedId]) {
                      foundInstance = tmpl.sections[selectedId];
                      foundPageId = pageId;
                      break;
                    }
                  }
                }
                
                if (!foundInstance) {
                  return <div className="p-4 text-sm text-muted-foreground">Section not found</div>;
                }
                
                const schema = sectionSchemaMap.get(foundInstance.type);
                return (
                  <SectionSettingsPanel
                    sectionId={selectedId}
                    instance={foundInstance}
                    schema={schema}
                    isRTL={isRTL}
                    onChange={(id, key, value) => {
                      // Switch to the correct page if needed
                      if (foundPageId !== activePage) setActivePage(foundPageId);
                      updateSectionSetting(id, key, value);
                    }}
                    onBack={() => setSelectedId(null)}
                  />
                );
              })()
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

        <MediaPickerDialog
          open={showMediaPicker}
          onOpenChange={setShowMediaPicker}
          storeId={storeId}
          onSelect={(url) => {
            if (mediaPickerTarget?.type === "section" && mediaPickerTarget.sectionId && mediaPickerTarget.settingKey) {
              updateSectionSetting(mediaPickerTarget.sectionId, mediaPickerTarget.settingKey, url);
            } else if (mediaPickerTarget?.type === "global" && mediaPickerTarget.path) {
              updateGlobalField(mediaPickerTarget.path, url);
            }
            setShowMediaPicker(false);
          }}
        />

        {showLinkEditor && linkEditorTarget && (
          <LinkEditorPopover
            open={showLinkEditor}
            onOpenChange={setShowLinkEditor}
            sectionId={linkEditorTarget.sectionId}
            textKey={linkEditorTarget.textKey}
            urlKey={linkEditorTarget.urlKey}
            currentText={String(template?.sections[linkEditorTarget.sectionId]?.settings?.[linkEditorTarget.textKey] ?? "")}
            currentUrl={String(template?.sections[linkEditorTarget.sectionId]?.settings?.[linkEditorTarget.urlKey] ?? "")}
            onSave={(text, url) => {
              updateSectionSetting(linkEditorTarget.sectionId, linkEditorTarget.textKey, text);
              updateSectionSetting(linkEditorTarget.sectionId, linkEditorTarget.urlKey, url);
              setShowLinkEditor(false);
            }}
          />
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
  onSelectSection, onSelectGlobal, onMove, onToggle, onRemove, onAdd, onShowAdd, setInsertAfterSectionId,
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
  setInsertAfterSectionId: (id: string | null) => void;
}) {
  const [headerGroupOpen, setHeaderGroupOpen] = useState(true);
  const [footerGroupOpen, setFooterGroupOpen] = useState(true);

  return (
    <div className="flex flex-col h-full" data-testid="theme-editor-sections-panel">
      {/* Global sections (header, footer, identity) */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1.5">
          {isRTL ? "عام" : "Global"}
        </p>
        
        <div className="border-b">
          <button onClick={() => setHeaderGroupOpen(!headerGroupOpen)}
            className="flex w-full items-center justify-between px-2.5 py-2 rounded-lg text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mb-0.5">
            <div className="flex items-center gap-2.5">
              <Navigation2 className="h-3.5 w-3.5 shrink-0" />
              {isRTL ? "الرأس" : "Header"}
            </div>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", headerGroupOpen && "rotate-180")} />
          </button>
          {headerGroupOpen && (
            <div className="pb-1">
              <button key="identity" onClick={() => onSelectGlobal("identity")}
                data-testid={`theme-editor-global-identity`}
                className={cn("w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-colors mb-0.5",
                  selectedType === "global" && selectedId === "identity" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <Store className="h-3.5 w-3.5 shrink-0" />
                {isRTL ? "هوية المتجر" : "Identity"}
              </button>
            </div>
          )}
        </div>

        <div className="border-b">
          <button onClick={() => setFooterGroupOpen(!footerGroupOpen)}
            className="flex w-full items-center justify-between px-2.5 py-2 rounded-lg text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mb-0.5">
            <div className="flex items-center gap-2.5">
              <Layout className="h-3.5 w-3.5 shrink-0" />
              {isRTL ? "التذييل" : "Footer"}
            </div>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", footerGroupOpen && "rotate-180")} />
          </button>
          {footerGroupOpen && (
            <div className="pb-1">
              <button key="footer-global" onClick={() => onSelectGlobal("footer")}
                data-testid={`theme-editor-global-footer`}
                className={cn("w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-colors mb-0.5",
                  selectedType === "global" && selectedId === "footer" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <Layout className="h-3.5 w-3.5 shrink-0" />
                {isRTL ? "إعدادات التذييل" : "Footer settings"}
              </button>
            </div>
          )}
        </div>
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
        {/* Insertion point before first section */}
        <div
          className="group relative h-3 flex items-center justify-center cursor-pointer -my-1"
          onClick={() => { setInsertAfterSectionId(null); onShowAdd(true); }}
        >
          <div className="absolute inset-x-3 h-[2px] bg-transparent group-hover:bg-primary/40 transition-colors rounded" />
          <div className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10">
            +
          </div>
        </div>

        {template?.order.map((sectionId, idx) => {
          const instance = template.sections[sectionId];
          if (!instance) return null;
          const schema = schemaMap.get(instance.type);
          const Icon = SECTION_ICONS[instance.type] ?? Layout;
          const name = schema ? (isRTL ? schema.nameAr ?? schema.name : schema.name) : instance.type;
          const active = selectedType === "section" && selectedId === sectionId;
          const disabled = instance.disabled;
          const prevSectionId = idx > 0 ? template.order[idx - 1] : null;

          return (
            <div key={sectionId}>
              {/* Insertion point before this section */}
              <div
                className="group relative h-3 flex items-center justify-center cursor-pointer -my-1"
                onClick={() => { setInsertAfterSectionId(prevSectionId); onShowAdd(true); }}
              >
                <div className="absolute inset-x-3 h-[2px] bg-transparent group-hover:bg-primary/40 transition-colors rounded" />
                <div className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10">
                  +
                </div>
              </div>

              <div
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
                    aria-label={isRTL ? "تحريك لأعلى" : "Move up"}
                    title={isRTL ? "تحريك لأعلى" : "Move up"}
                    data-testid="theme-editor-section-move-up"
                    data-section-id={sectionId}
                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronUp className="h-3 w-3" /></button>
                  <button onClick={() => onMove(sectionId, "down")} disabled={idx === template.order.length - 1}
                    aria-label={isRTL ? "تحريك لأسفل" : "Move down"}
                    title={isRTL ? "تحريك لأسفل" : "Move down"}
                    data-testid="theme-editor-section-move-down"
                    data-section-id={sectionId}
                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronDown className="h-3 w-3" /></button>
                  <button onClick={() => onToggle(sectionId)} className="p-1 text-muted-foreground hover:text-foreground"
                    aria-label={disabled ? (isRTL ? "إظهار القسم" : "Show section") : (isRTL ? "إخفاء القسم" : "Hide section")}
                    title={disabled ? (isRTL ? "إظهار القسم" : "Show section") : (isRTL ? "إخفاء القسم" : "Hide section")}
                    data-testid="theme-editor-section-toggle"
                    data-section-id={sectionId}>
                    {disabled ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                  <button onClick={() => onRemove(sectionId)}
                    aria-label={isRTL ? "حذف القسم" : "Delete section"}
                    title={isRTL ? "حذف القسم" : "Delete section"}
                    data-testid="theme-editor-section-delete"
                    data-section-id={sectionId}
                    className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                </div>
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
  sectionId, instance, schema, isRTL, onChange, onBack,
}: {
  sectionId: string;
  instance: SectionInstanceData | undefined;
  schema: SectionSchemaData | undefined;
  isRTL: boolean;
  onChange: (sectionId: string, key: string, value: unknown) => void;
  onBack: () => void;
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
      {/* Back button header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <button onClick={onBack}
          aria-label={isRTL ? "رجوع" : "Back"}
          title={isRTL ? "رجوع" : "Back"}
          className="p-1 rounded hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{isRTL ? schema.nameAr ?? schema.name : schema.name}</span>
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
            aria-label={label}
            title={label}
            className="h-8 w-8 cursor-pointer rounded-md border border-input p-0.5 block shrink-0" data-testid={`${testId}-color`} />
          <Input value={colorVal} onChange={(e) => onChange(e.target.value)}
            className="h-8 font-mono text-[12px] flex-1" maxLength={7} data-testid={`${testId}-input`} />
        </div>
      </div>
    );
  }

  // Font picker for _font fields
  if (setting.key.endsWith("_font") || setting.type === "font") {
    const current = (value as string) || "Inter";
    return (
      <div className="space-y-1.5" data-testid={testId}>
        <FontGallery
          label={label}
          value={current}
          onChange={onChange}
        />
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

  if (setting.type === "products") {
    const selected = Array.isArray(value)
      ? (value as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    return (
      <ProductPickerField
        label={label}
        helpText={isRTL ? (setting.helpAr ?? setting.help) : setting.help}
        value={selected}
        onChange={onChange}
        isRTL={isRTL}
        testId={testId}
      />
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

// ─── Product picker field (featured collection sections) ──────────────────

function ProductPickerField({
  value, onChange, label, helpText, isRTL, testId,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  label: string;
  helpText?: string;
  isRTL: boolean;
  testId: string;
}) {
  const { currentStore } = useDashboardStore();
  const [query, setQuery] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["theme-editor-products", currentStore?.id],
    queryFn: () => listProducts(currentStore!.id, { limit: 200 }),
    enabled: !!currentStore?.id,
    staleTime: 60_000,
  });

  const allProducts = data?.items ?? [];
  const selectedSet = new Set(value);
  const filtered = query.trim()
    ? allProducts.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    : allProducts;

  const selected = value
    .map((id) => allProducts.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(value.filter((x) => x !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = value.indexOf(id);
    if (idx === -1) return;
    const next = idx + dir;
    if (next < 0 || next >= value.length) return;
    const copy = [...value];
    [copy[idx], copy[next]] = [copy[next], copy[idx]];
    onChange(copy);
  };

  return (
    <div className="space-y-2" data-testid={testId}>
      <Label className="text-[12px] font-medium">{label}</Label>
      {helpText && <p className="text-[10.5px] text-muted-foreground leading-snug">{helpText}</p>}

      {selected.length > 0 && (
        <ul className="space-y-1">
          {selected.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-[11.5px]">
              {p.images?.[0] && <img src={p.images[0]} alt="" className="h-7 w-7 rounded object-cover shrink-0" />}
              <span className="flex-1 truncate">{p.name}</span>
              <button type="button" onClick={() => move(p.id, -1)} disabled={i === 0}
                className="px-1 disabled:opacity-30 hover:text-primary"
                aria-label={isRTL ? "نقل لأعلى" : "Move up"} title={isRTL ? "نقل لأعلى" : "Move up"}
              ><ChevronUp className="h-3 w-3" /></button>
              <button type="button" onClick={() => move(p.id, 1)} disabled={i === selected.length - 1}
                className="px-1 disabled:opacity-30 hover:text-primary"
                aria-label={isRTL ? "نقل لأسفل" : "Move down"} title={isRTL ? "نقل لأسفل" : "Move down"}
              ><ChevronDown className="h-3 w-3" /></button>
              <button type="button" onClick={() => toggle(p.id)}
                className="px-1 text-muted-foreground hover:text-destructive"
                aria-label={isRTL ? "إزالة" : "Remove"} title={isRTL ? "إزالة" : "Remove"}
              ><Trash2 className="h-3 w-3" /></button>
            </li>
          ))}
        </ul>
      )}

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={isRTL ? "ابحث عن منتج…" : "Search products…"}
        aria-label={isRTL ? "ابحث عن منتج" : "Search products"}
        title={isRTL ? "ابحث عن منتج" : "Search products"}
        className="h-8 text-[12px]"
      />

      <div className="max-h-48 overflow-y-auto rounded-md border border-border">
        {isLoading ? (
          <div className="p-3 text-[11.5px] text-muted-foreground">{isRTL ? "جارٍ التحميل…" : "Loading…"}</div>
        ) : filtered.length === 0 ? (
          <div className="p-3 text-[11.5px] text-muted-foreground">{isRTL ? "لا توجد منتجات" : "No products"}</div>
        ) : (
          <ul>
            {filtered.map((p) => {
              const checked = selectedSet.has(p.id);
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => toggle(p.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 text-[11.5px] text-start hover:bg-accent transition-colors",
                      checked && "bg-accent/50",
                    )}>
                    <span className={cn(
                      "h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center",
                      checked ? "bg-primary border-primary" : "border-input",
                    )}>
                      {checked && <CheckCircle className="h-2.5 w-2.5 text-primary-foreground" />}
                    </span>
                    {p.images?.[0] && <img src={p.images[0]} alt="" className="h-7 w-7 rounded object-cover shrink-0" />}
                    <span className="flex-1 truncate">{p.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
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
            aria-label={label}
            title={label}
            className="h-8 w-8 cursor-pointer rounded-md border border-input p-0.5 block shrink-0" data-testid={`${testId}-color`} />
          <Input value={colorVal} onChange={(e) => onChange(e.target.value)}
            className="h-8 font-mono text-[12px] flex-1" maxLength={7} data-testid={`${testId}-input`} />
        </div>
      </div>
    );
  }

  // Font picker for _font fields (new-schema branch)
  if (field.key?.endsWith("_font") || field.type === "font") {
    const current = (value as string) || (field.default as string) || "Inter";
    return (
      <div className="space-y-1.5" data-testid={testId}>
        <FontGallery
          label={label}
          value={current}
          onChange={onChange}
        />
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
