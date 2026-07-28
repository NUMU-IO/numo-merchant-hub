import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

const KNOWN_SECTIONS = new Set([
  "profile",
  "domain",
  "policies",
  "pages",
  "seo",
  "status",
  "payment",
  "shipping",
  "customization",
  "themes",
]);
import { useLanguage } from "@/contexts/LanguageContext";
import { SettingsBreadcrumb } from "@/components/layout/SettingsBreadcrumb";
import { useDashboardStore } from "@/contexts/StoreContext";
import { CustomDomainCard } from "@/components/settings/CustomDomainCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/forms/PhoneInput";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  Globe,
  Lock,
  Palette,
  ScrollText,
  Settings2,
  Truck,
  Upload,
  Sparkles,
  Check,
  Store,
  Type,
  ShoppingBag,
  MessageSquare,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Loader2,
  ExternalLink,
  Phone,
  Compass,
  Tag,
  LayoutGrid,
  ChevronUp,
  ChevronDown,
  CreditCard,
  Clock,
  Search,
  Image as ImageIcon,
} from "lucide-react";
import { ThemePreview } from "@/components/ThemePreview";
import { ImageCropDialog, fileFromCropBlob } from "@/components/ImageCropDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { generatePolicy } from "@/services/aiApi";
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
import { updateStore, uploadStoreAsset } from "@/services/storeApi";
import {
  PagesAndHoursPanel,
  type FooterSection,
  type ShippingPageConfig,
  type BusinessHours,
} from "@/components/store-settings/PagesAndHoursPanel";
import { SeoSettingsPanel } from "@/components/store-settings/SeoSettingsPanel";
import { apiClient } from "@/services/api";
import { getStoreUrl, getStoreDomainSuffix } from "@/lib/storefront";
import { FontGallery } from "@/components/theme-editor/FontGallery";
import {
  fetchShippingSettings,
  addShippingZone,
  deleteShippingZone,
  updateShippingSettings,
  fetchPaymobCredentials,
  savePaymobCredentials,
  deletePaymobCredentials,
  fetchKashierCredentials,
  saveKashierCredentials,
  deleteKashierCredentials,
  fetchFawryCredentials,
  saveFawryCredentials,
  deleteFawryCredentials,
  type ShippingSettings,
  type PaymobCredentialsResponse,
  type KashierCredentialsResponse,
  type FawryCredentialsResponse,
} from "@/services/storeApi";

import { useTrialPaywall } from "@/contexts/TrialPaywallContext";

// ─── Preload Google Fonts for font picker ────────────────────────────────────
const HARDCODED_FONT_SETTINGS = [
  {
    key: "heading_font",
    type: "font" as const,
    label: "Heading Font",
    labelAr: "خط العناوين",
    default: "Cairo",
    group: "Typography",
    groupAr: "الخطوط",
  },
  {
    key: "body_font",
    type: "font" as const,
    label: "Body Font",
    labelAr: "خط النصوص",
    default: "Cairo",
    group: "Typography",
    groupAr: "الخطوط",
  },
];

/** Ensure heading_font + body_font are always present in a settings list */
function ensureFontSettings(
  settings: SectionSettingDefinition[],
): SectionSettingDefinition[] {
  const keys = new Set(settings.map((s) => s.key));
  const missing = HARDCODED_FONT_SETTINGS.filter((f) => !keys.has(f.key));
  return missing.length ? [...settings, ...missing] : settings;
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
    const currentFont =
      (value as string) || (setting.default as string) || "Cairo";
    return (
      <FontGallery
        label={label}
        value={currentFont}
        onChange={(family) => onChange(setting.key, family)}
        language={language as "en" | "ar"}
      />
    );
  }

  switch (setting.type as string) {
    case "text":
      return (
        <div className="grid gap-2">
          <Label>{label}</Label>
          {setting.description && (
            <p className="text-xs text-muted-foreground">
              {setting.description}
            </p>
          )}
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
              <img
                src={String(value)}
                alt={label}
                className="h-16 w-16 rounded-lg object-cover border"
              />
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
          <Select
            value={String(value || setting.default)}
            onValueChange={(v) => onChange(setting.key, v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
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
            <span className="text-sm text-muted-foreground">
              {value ?? setting.default}
              {setting.unit || ""}
            </span>
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
  {
    value: "/products?category=clothing",
    labelEn: "Clothing",
    labelAr: "ملابس",
  },
  {
    value: "/products?category=accessories",
    labelEn: "Accessories",
    labelAr: "إكسسوارات",
  },
  { value: "/products?category=shoes", labelEn: "Shoes", labelAr: "أحذية" },
  { value: "/products?category=bags", labelEn: "Bags", labelAr: "شنط" },
  {
    value: "/products?category=electronics",
    labelEn: "Electronics",
    labelAr: "إلكترونيات",
  },
  {
    value: "/products?tag=new",
    labelEn: "New Arrivals",
    labelAr: "وصل حديثاً",
  },
  {
    value: "/products?tag=bestseller",
    labelEn: "Best Sellers",
    labelAr: "الأكثر مبيعاً",
  },
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
  const removeLink = (i: number) =>
    onChange(links.filter((_, idx) => idx !== i));
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
        <Button
          variant="outline"
          size="sm"
          className="gap-1 h-7 text-xs"
          onClick={addLink}
        >
          <Plus className="h-3 w-3" />
          {language === "ar" ? "إضافة" : "Add"}
        </Button>
      </div>
      {links.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {language === "ar"
            ? "سيتم استخدام الروابط الافتراضية"
            : "Default links will be used"}
        </p>
      )}
      {links.map((link, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border p-2">
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => moveLink(i, -1)}
              className="p-0.5 hover:bg-muted rounded"
              disabled={i === 0}
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              onClick={() => moveLink(i, 1)}
              className="p-0.5 hover:bg-muted rounded"
              disabled={i === links.length - 1}
            >
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
                {language === "ar" ? route.labelAr : route.labelEn} (
                {route.value})
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive"
            onClick={() => removeLink(i)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SECTION_CONFIG = [
  {
    key: "identity",
    label: "Identity",
    labelAr: "الهوية",
    icon: Store,
    settings: identitySettings,
  },
  {
    key: "header",
    label: "Header",
    labelAr: "الهيدر",
    icon: Type,
    settings: headerSettings,
  },
  {
    key: "navigation",
    label: "Navigation",
    labelAr: "التنقل",
    icon: Compass,
    settings: navigationSettings,
  },
  {
    key: "products",
    label: "Products",
    labelAr: "المنتجات",
    icon: ShoppingBag,
    settings: productsSettings,
  },
  {
    key: "labels",
    label: "Labels",
    labelAr: "التسميات",
    icon: Tag,
    settings: labelsSettings,
  },
  {
    key: "layout",
    label: "Page Layout",
    labelAr: "تخطيط الصفحة",
    icon: LayoutGrid,
    settings: pageLayoutSettings,
  },
  {
    key: "footer",
    label: "Footer",
    labelAr: "الفوتر",
    icon: MessageSquare,
    settings: footerSettings,
  },
] as const;

const THEME_PREVIEWS: Record<
  string,
  { bg: string; fg: string; accent: string; icon: string }
> = {
  modern: { bg: "#f8fafc", fg: "#0f172a", accent: "#3b82f6", icon: "✨" },
  boutique: { bg: "#fdf2f8", fg: "#831843", accent: "#ec4899", icon: "🌸" },
  elegant: { bg: "#fffbeb", fg: "#78350f", accent: "#d97706", icon: "👑" },
  skeuomorphic: { bg: "#ecfdf5", fg: "#064e3b", accent: "#10b981", icon: "🎨" },
  "tech-wave": { bg: "#0a0e1a", fg: "#e0e6ed", accent: "#00d4ff", icon: "⚡" },
  "neo-brutalism": {
    bg: "#fefce8",
    fg: "#1a1a1a",
    accent: "#a3e635",
    icon: "💥",
  },
  editorial: { bg: "#f0f2ec", fg: "#1b1b1b", accent: "#2d6a4f", icon: "📰" },
  "luxury-minimal": {
    bg: "#ffffff",
    fg: "#1a1a1a",
    accent: "#b8860b",
    icon: "💎",
  },
};

function extractNonEmpty(
  state: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
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
  const { requireTrial } = useTrialPaywall();
  const { currentStore, refetchStores } = useDashboardStore();

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [savingMarket, setSavingMarket] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [logoCropSrc, setLogoCropSrc] = useState<string | null>(null);
  const [showLogoCrop, setShowLogoCrop] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [faviconCropSrc, setFaviconCropSrc] = useState<string | null>(null);
  const [showFaviconCrop, setShowFaviconCrop] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const faviconUrl =
    ((currentStore?.settings as { favicon_url?: string } | null)
      ?.favicon_url ?? "") || "";
  const [policyTab, setPolicyTab] = useState("return");
  const [policyTexts, setPolicyTexts] = useState<Record<string, string>>({
    return: "",
    shipping: "",
    privacy: "",
    terms: "",
  });
  const [showAiPolicyDialog, setShowAiPolicyDialog] = useState(false);
  const [aiPolicyAnswers, setAiPolicyAnswers] = useState<
    Record<string, string>
  >({});
  const [isGeneratingPolicy, setIsGeneratingPolicy] = useState(false);
  const [, resetWalkthrough] = useWalkthroughStatus();
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  // ─── Profile state ──────────────────────────────────────────────────────
  const [profileState, setProfileState] = useState({
    name: "",
    description: "",
    contact_email: "",
    contact_phone: "",
    whatsapp_phone: "",
    facebook: "",
    instagram: "",
    twitter: "",
  });

  // ─── Theme / Customization state ────────────────────────────────────────
  const [availableThemes, setAvailableThemes] = useState<AvailableTheme[]>([]);
  const [activeTheme, setActiveTheme] = useState("modern");
  const [themeState, setThemeState] = useState<Record<string, SettingValue>>(
    {},
  );
  const [identityState, setIdentityState] = useState<
    Record<string, SettingValue>
  >({});
  const [headerState, setHeaderState] = useState<Record<string, SettingValue>>(
    {},
  );
  const [heroState, setHeroState] = useState<Record<string, SettingValue>>({});
  const [productsState, setProductsState] = useState<
    Record<string, SettingValue>
  >({});
  const [footerState, setFooterState] = useState<Record<string, SettingValue>>(
    {},
  );
  const [navigationState, setNavigationState] = useState<
    Record<string, SettingValue>
  >({});
  const [labelsState, setLabelsState] = useState<Record<string, SettingValue>>(
    {},
  );
  const [layoutState, setLayoutState] = useState<Record<string, SettingValue>>(
    {},
  );
  const [navLinks, setNavLinks] = useState<
    Array<{ label: string; to: string }>
  >([]);

  // ─── Pages & Hours panel state ───────────────────────────────────────────
  const [footerSections, setFooterSections] = useState<FooterSection[]>([]);
  const [shippingConfig, setShippingConfig] = useState<ShippingPageConfig>({});
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    timezone: "Africa/Cairo",
    days: {},
  });
  const [isSavingPages, setIsSavingPages] = useState(false);
  const [homeSections, setHomeSections] = useState<
    Array<{ id: string; label: string; enabled: boolean }>
  >([
    { id: "hero", label: "القسم الرئيسي", enabled: true },
    { id: "categories", label: "الفئات", enabled: true },
    { id: "new_arrivals", label: "وصل حديثاً", enabled: true },
    { id: "promo", label: "عرض ترويجي", enabled: true },
    { id: "best_sellers", label: "الأكثر مبيعاً", enabled: true },
    { id: "testimonials", label: "آراء العملاء", enabled: true },
    { id: "newsletter", label: "النشرة البريدية", enabled: true },
  ]);

  // ─── V2 Section Engine state ─────────────────────────────────────────────
  const [themeSchemaBundle, setThemeSchemaBundle] =
    useState<ThemeSchemaBundle | null>(null);
  const [templateConfig, setTemplateConfig] =
    useState<TemplateConfigData | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );
  const [showAddSheet, setShowAddSheet] = useState(false);

  // ─── Shipping state ─────────────────────────────────────────────────────
  const [shippingData, setShippingData] = useState<ShippingSettings | null>(
    null,
  );
  const [freeThreshold, setFreeThreshold] = useState(500);
  const [newZone, setNewZone] = useState({
    zone: "",
    governorates: "",
    rate: 0,
    estimated_days: "",
  });
  const [showAddZone, setShowAddZone] = useState(false);

  // ─── Bosta credentials state ──────────────────────────────────────────
  const [bostaCreds, setBostaCreds] = useState<{
    is_configured: boolean;
    api_key_masked: string | null;
    business_id: string | null;
    auto_create_shipment: boolean;
    last_configured: string | null;
  } | null>(null);
  const [bostaForm, setBostaForm] = useState({
    api_key: "",
    business_id: "",
    webhook_secret: "",
    auto_create_shipment: false,
  });
  const [bostaEditing, setBostaEditing] = useState(false);
  const [bostaSaving, setBostaSaving] = useState(false);
  const [bostaShowKey, setBostaShowKey] = useState(false);

  // ─── Payment gateway state ──────────────────────────────────────────────
  const [activeGateway, setActiveGateway] = useState<
    "paymob" | "kashier" | null
  >(null);
  const [enabledGateway, setEnabledGateway] = useState<
    "paymob" | "kashier" | null
  >(null);
  const [enablingSaving, setEnablingSaving] = useState(false);
  const [paymobCreds, setPaymobCreds] =
    useState<PaymobCredentialsResponse | null>(null);
  const [paymobForm, setPaymobForm] = useState({
    secret_key: "",
    public_key: "",
    hmac_secret: "",
    card_integration_id: "",
    wallet_integration_id: "",
  });
  const [paymobSaving, setPaymobSaving] = useState(false);
  const [paymobShowKeys, setPaymobShowKeys] = useState(false);
  const [paymobEditing, setPaymobEditing] = useState(false);

  const [kashierCreds, setKashierCreds] =
    useState<KashierCredentialsResponse | null>(null);
  const [kashierForm, setKashierForm] = useState({
    merchant_id: "",
    api_key: "",
    secret_key: "",
  });
  const [kashierSaving, setKashierSaving] = useState(false);
  const [kashierShowKeys, setKashierShowKeys] = useState(false);
  const [kashierEditing, setKashierEditing] = useState(false);

  // ─── Fawry gateway state ─────────────────────────────────────────────────
  const [fawryCreds, setFawryCreds] = useState<FawryCredentialsResponse | null>(
    null,
  );
  const [fawryForm, setFawryForm] = useState({
    merchant_code: "",
    security_key: "",
  });
  const [fawrySaving, setFawrySaving] = useState(false);
  const [fawryShowKeys, setFawryShowKeys] = useState(false);

  // ─── Status state ───────────────────────────────────────────────────────
  const [storeOnline, setStoreOnline] = useState(true);
  const [closureMessage, setClosureMessage] = useState("");
  const [closureMessageAr, setClosureMessageAr] = useState("");
  const [reopenDate, setReopenDate] = useState("");
  const [showCountdown, setShowCountdown] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

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
    identity: identityState,
    header: headerState,
    hero: heroState,
    products: productsState,
    footer: footerState,
    navigation: navigationState,
    labels: labelsState,
    layout: layoutState,
  };
  const sectionSetters: Record<
    string,
    React.Dispatch<React.SetStateAction<Record<string, SettingValue>>>
  > = {
    identity: setIdentityState,
    header: setHeaderState,
    hero: setHeroState,
    products: setProductsState,
    footer: setFooterState,
    navigation: setNavigationState,
    labels: setLabelsState,
    layout: setLayoutState,
  };

  const handleSectionChange = useCallback(
    (section: string) => (key: string, value: SettingValue) => {
      sectionSetters[section]?.((prev) => ({ ...prev, [key]: value }));
      setIsDirty(true);
    },
    [],
  );

  const handleThemeSettingChange = useCallback(
    (key: string, value: SettingValue) => {
      setThemeState((prev) => ({ ...prev, [key]: value }));
      setIsDirty(true);
    },
    [],
  );

  // ─── Effects ────────────────────────────────────────────────────────────

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
    const s = (currentStore.settings || {}) as Record<string, unknown>;
    setClosureMessage((s.closure_message as string) || "");
    setClosureMessageAr((s.closure_message_ar as string) || "");
    setReopenDate((s.reopen_at as string) || "");
    setShowCountdown(s.show_countdown === "true" || s.show_countdown === true);
    setPolicyTexts({
      return: (s.return_policy as string) || "",
      shipping: (s.shipping_policy as string) || "",
      privacy: (s.privacy_policy as string) || "",
      terms: (s.terms_of_service as string) || "",
    });
    // Business hours live at the store level, not in theme_settings
    const bh = (currentStore.business_hours || {}) as BusinessHours;
    setBusinessHours({
      timezone: bh.timezone || "Africa/Cairo",
      days: bh.days || {},
    });
  }, [currentStore?.id]);

  // Fetch available themes
  useEffect(() => {
    fetchThemes()
      .then(setAvailableThemes)
      .catch(() => {});
  }, []);

  // Fetch theme schemas when theme changes
  useEffect(() => {
    setSelectedSectionId(null);
    fetchThemeSchemas(activeTheme)
      .then((bundle) => {
        setThemeSchemaBundle(bundle);
        // Initialize template from defaults if not yet set from customization v2 data
        setTemplateConfig(
          (prev) => prev ?? bundle.default_templates?.home ?? null,
        );
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
          const { social_links, sections, ...rest } = data.footer as Record<
            string,
            unknown
          > & {
            social_links?: Record<string, string>;
            sections?: FooterSection[];
          };
          setFooterState({ ...(rest as Record<string, SettingValue>), ...(social_links || {}) });
          if (Array.isArray(sections)) setFooterSections(sections);
        }
        // Shipping page config (theme_settings.shipping)
        const shippingData = (data as { shipping?: ShippingPageConfig }).shipping;
        if (shippingData && typeof shippingData === "object") {
          setShippingConfig(shippingData);
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
                }),
            );
          }
        }
        // V2: Load template if available
        const extData = data as CustomizationData & {
          schema_version?: number;
          templates?: { home: TemplateConfigData };
        };
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
    // Fetch Bosta credentials
    import("@/services/shipmentApi").then(({ fetchBostaCredentials }) => {
      fetchBostaCredentials(currentStore.id)
        .then((data) => setBostaCreds(data))
        .catch(() => {});
    });
  }, [currentStore?.id]);

  // Fetch payment gateway credentials
  useEffect(() => {
    if (!currentStore?.id) return;
    Promise.all([
      fetchPaymobCredentials(currentStore.id).catch(() => null),
      fetchKashierCredentials(currentStore.id).catch(() => null),
    ]).then(([paymob, kashier]) => {
      setPaymobCreds(paymob);
      setKashierCreds(kashier);
      if (paymob?.is_configured && kashier?.is_configured) {
        const pDate = paymob.last_configured
          ? new Date(paymob.last_configured).getTime()
          : 0;
        const kDate = kashier.last_configured
          ? new Date(kashier.last_configured).getTime()
          : 0;
        setEnabledGateway(pDate >= kDate ? "paymob" : "kashier");
      } else if (paymob?.is_configured) {
        setEnabledGateway("paymob");
      } else if (kashier?.is_configured) {
        setEnabledGateway("kashier");
      }
    });
  }, [currentStore?.id]);

  // Fetch Fawry credentials status
  useEffect(() => {
    if (!currentStore?.id) return;
    fetchFawryCredentials(currentStore.id)
      .then(setFawryCreds)
      .catch(() => {});
  }, [currentStore?.id]);

  // ─── V2 Template Handlers ───────────────────────────────────────────────

  const handleSectionReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      setTemplateConfig((prev) => {
        if (!prev) return prev;
        const newOrder = [...prev.order];
        const [moved] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, moved);
        return { ...prev, order: newOrder };
      });
      setIsDirty(true);
    },
    [],
  );

  const handleToggleSection = useCallback(
    (sectionId: string, disabled: boolean) => {
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
    },
    [],
  );

  const handleAddSection = useCallback(
    (sectionType: string, presetIndex?: number) => {
      if (!sectionType) {
        setShowAddSheet(true);
        return;
      }
      if (!themeSchemaBundle) return;

      const schema = themeSchemaBundle.sections.find(
        (s) => s.type === sectionType,
      );
      if (!schema) return;

      // Check section limit
      if (schema.limit && templateConfig) {
        const count = Object.values(templateConfig.sections).filter(
          (s) => s.type === sectionType,
        ).length;
        if (count >= schema.limit) {
          toast.error(
            language === "ar"
              ? "تم الوصول للحد الأقصى لهذا القسم"
              : `Maximum ${schema.limit} of this section type`,
          );
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
      const preset =
        presetIndex !== undefined ? schema.presets?.[presetIndex] : undefined;
      const settings = preset?.settings
        ? { ...defaults, ...preset.settings }
        : defaults;

      setTemplateConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: {
            ...prev.sections,
            [id]: { id, type: sectionType, settings },
          },
          order: [...prev.order, id],
        };
      });
      setSelectedSectionId(id);
      setIsDirty(true);
      setShowAddSheet(false);
    },
    [themeSchemaBundle, templateConfig, language],
  );

  const handleRemoveSection = useCallback(
    (sectionId: string) => {
      setTemplateConfig((prev) => {
        if (!prev) return prev;
        const { [sectionId]: _, ...restSections } = prev.sections;
        return {
          ...prev,
          sections: restSections,
          order: prev.order.filter((id) => id !== sectionId),
        };
      });
      if (selectedSectionId === sectionId) setSelectedSectionId(null);
      setIsDirty(true);
    },
    [selectedSectionId],
  );

  const handleSectionSettingChange = useCallback(
    (sectionId: string, key: string, value: SettingValue) => {
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
    },
    [],
  );

  // ─── Handlers ───────────────────────────────────────────────────────────

  const buildFullPayload = useCallback(() => {
    const footerClean = extractNonEmpty(footerState);
    const { facebook, instagram, twitter, whatsapp, ...footerRest } =
      footerClean;
    const socialRaw = extractNonEmpty({
      facebook,
      instagram,
      twitter,
      whatsapp,
    });
    const social_links =
      Object.keys(socialRaw).length > 0
        ? {
            facebook: socialRaw.facebook || "",
            instagram: socialRaw.instagram || "",
            twitter: socialRaw.twitter || "",
            whatsapp: socialRaw.whatsapp || "",
          }
        : undefined;

    const navPayload: Record<string, unknown> = {
      ...extractNonEmpty(navigationState),
    };
    if (navLinks.length > 0) navPayload.links = navLinks;

    const layoutPayload: Record<string, unknown> = {
      ...extractNonEmpty(layoutState),
    };
    const enabledSections = homeSections
      .filter((s) => s.enabled)
      .map((s) => s.id);
    if (enabledSections.length > 0)
      layoutPayload.home_sections = enabledSections;

    // Extract hero from v2 template for v1 backwards compat
    let heroPayload: Record<string, string | number | boolean> =
      extractNonEmpty(heroState);
    if (templateConfig) {
      const heroSection = Object.values(templateConfig.sections).find(
        (s) => s.type === "hero",
      );
      if (heroSection)
        heroPayload = {
          ...heroPayload,
          ...extractNonEmpty(
            heroSection.settings as Record<string, string | number | boolean>,
          ),
        };
    }

    // Derive home_sections from v2 template order
    if (templateConfig) {
      const v2ToV1: Record<string, string> = {
        hero: "hero",
        categories: "categories",
        "featured-collection": "new_arrivals",
        "promo-banner": "promo",
        testimonials: "testimonials",
        newsletter: "newsletter",
      };
      const derived = templateConfig.order
        .filter((id) => !templateConfig.sections[id]?.disabled)
        .map(
          (id) =>
            v2ToV1[templateConfig.sections[id]?.type] ||
            templateConfig.sections[id]?.type,
        )
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
        ...(footerSections.length > 0 ? { sections: footerSections } : {}),
      },
      navigation: Object.keys(navPayload).length > 0 ? navPayload : undefined,
      shipping:
        shippingConfig &&
        ((shippingConfig.delivery_areas?.length ?? 0) > 0 ||
          (shippingConfig.schedule_notes?.length ?? 0) > 0 ||
          shippingConfig.title ||
          shippingConfig.intro ||
          shippingConfig.free_shipping_threshold !== undefined ||
          shippingConfig.show_contact_section !== undefined)
          ? shippingConfig
          : undefined,
      labels: extractNonEmpty(labelsState),
      layout: Object.keys(layoutPayload).length > 0 ? layoutPayload : undefined,
    };

    // V2 section engine fields
    if (templateConfig) {
      payload.schema_version = 2;
      payload.templates = { home: templateConfig };
    }

    return payload;
  }, [
    activeTheme,
    themeState,
    identityState,
    headerState,
    heroState,
    productsState,
    footerState,
    navigationState,
    labelsState,
    layoutState,
    navLinks,
    homeSections,
    templateConfig,
    footerSections,
    shippingConfig,
  ]);

  // Save handler for the Pages & Hours panel — flushes:
  //   • theme_settings.footer.sections + theme_settings.shipping  via updateCustomization
  //   • business_hours                                            via updateStore
  const savePagesAndHours = useCallback(async () => {
    if (!currentStore?.id) return;
    setIsSavingPages(true);
    try {
      await Promise.all([
        updateCustomization(currentStore.id, buildFullPayload()),
        updateStore(currentStore.id, { business_hours: businessHours }),
      ]);
      await refetchStores();
      setIsDirty(false);
      toast.success(t("store.saved"));
    } catch (err) {
      showError(err, language);
    } finally {
      setIsSavingPages(false);
    }
  }, [
    currentStore?.id,
    buildFullPayload,
    businessHours,
    refetchStores,
    language,
    t,
  ]);

  // Mark dirty whenever any pages-panel field changes
  const handleFooterSectionsChange = useCallback((s: FooterSection[]) => {
    setFooterSections(s);
    setIsDirty(true);
  }, []);
  const handleShippingConfigChange = useCallback((c: ShippingPageConfig) => {
    setShippingConfig(c);
    setIsDirty(true);
  }, []);
  const handleBusinessHoursChange = useCallback((h: BusinessHours) => {
    setBusinessHours(h);
    setIsDirty(true);
  }, []);

  const saveProfile = useCallback(async () => {
    if (!currentStore?.id) return;
    setIsSaving(true);
    try {
      const social_links: Record<string, string> = {};
      if (profileState.whatsapp_phone)
        social_links.whatsapp = profileState.whatsapp_phone;
      if (profileState.facebook) social_links.facebook = profileState.facebook;
      if (profileState.instagram)
        social_links.instagram = profileState.instagram;
      if (profileState.twitter) social_links.twitter = profileState.twitter;

      await updateStore(currentStore.id, {
        name: profileState.name,
        description: profileState.description || null,
        contact_email: profileState.contact_email || null,
        contact_phone: profileState.contact_phone || null,
        social_links:
          Object.keys(social_links).length > 0 ? social_links : null,
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
      toast.success(
        language === "ar" ? "تم النشر بنجاح!" : "Published successfully!",
      );
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
        prev ? { ...prev, zones: [...prev.zones, zone] } : prev,
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
          prev
            ? { ...prev, zones: prev.zones.filter((z) => z.id !== zoneId) }
            : prev,
        );
        toast.success(language === "ar" ? "تم الحذف" : "Zone deleted");
      } catch (err) {
        showError(err, language);
      }
    },
    [currentStore?.id, language],
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

  const [searchParams] = useSearchParams();
  const requestedSection = searchParams.get("section") ?? "";
  const [activeSection, setActiveSection] = useState(
    KNOWN_SECTIONS.has(requestedSection) ? requestedSection : "profile",
  );

  const navGroups = [
    {
      label: language === "ar" ? "إعداد المتجر" : "Store Setup",
      items: [
        { value: "profile", label: t("store.profile"), icon: Settings2 },
        { value: "domain", label: t("store.domain"), icon: Globe },
        { value: "policies", label: t("store.policies"), icon: ScrollText },
        {
          value: "pages",
          label: language === "ar" ? "الصفحات والساعات" : "Pages & Hours",
          icon: Clock,
        },
        {
          value: "seo",
          label: language === "ar" ? "SEO" : "SEO",
          icon: Search,
        },
        { value: "status", label: t("store.status"), icon: Lock },
      ],
    },
  ];

  // Current theme settings schema
  const currentThemeSettings =
    themeSchemas[activeTheme]?.settings || themeSchemas.modern.settings;
  const groupedThemeSettings = groupSettings(currentThemeSettings);

  return (
    <>
      {/* Breadcrumb back to Settings hub */}
      <div className="px-2 sm:px-0 pt-4">
        <SettingsBreadcrumb current={language === "ar" ? "إعدادات المتجر" : "Store settings"} />
      </div>
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
      <div
        className="settings-content"
        data-narrow={activeSection !== "customization"}
      >
        {/* ─── Profile ─── */}
        {activeSection === "profile" && (
          <div key="profile" className="settings-section-enter">
            <div className="settings-section-header">
              <h2>{t("store.profile")}</h2>
              <p>
                {language === "ar"
                  ? "معلومات متجرك الأساسية والتواصل"
                  : "Basic store information and contact details"}
              </p>
            </div>

            {/* Logo */}
            <div className="settings-field-group">
              <div className="settings-field-group-label">
                {t("store.logo")}
              </div>
              <div className="flex items-center gap-5 rounded-xl border border-dashed border-border/50 bg-muted/5 p-4 transition-colors hover:border-border/80 hover:bg-muted/10">
                {currentStore?.logo_url ? (
                  <img
                    src={currentStore.logo_url}
                    alt="Logo"
                    // `object-contain` shows the whole logo (no crop); the
                    // checkerboard backdrop makes a transparent logo read as
                    // transparent and keeps both light and dark marks visible.
                    className="h-16 w-16 rounded-xl object-contain ring-2 ring-border/20"
                    style={{
                      backgroundColor: "hsl(var(--background))",
                      backgroundImage:
                        "linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%, transparent 75%, hsl(var(--muted)) 75%), linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%, transparent 75%, hsl(var(--muted)) 75%)",
                      backgroundSize: "10px 10px",
                      backgroundPosition: "0 0, 5px 5px",
                    }}
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted/30 text-muted-foreground">
                    <Store className="h-6 w-6" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            setLogoCropSrc(reader.result as string);
                            setShowLogoCrop(true);
                          };
                          reader.readAsDataURL(file);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 cursor-pointer"
                        asChild
                      >
                        <span>
                          <Upload className="h-3.5 w-3.5" />
                          {currentStore?.logo_url
                            ? language === "ar"
                              ? "تغيير"
                              : "Change"
                            : t("store.uploadLogo")}
                        </span>
                      </Button>
                    </label>
                    {currentStore?.logo_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={uploadingLogo}
                        onClick={async () => {
                          if (!currentStore?.id) return;
                          setUploadingLogo(true);
                          try {
                            await updateStore(currentStore.id, {
                              logo_url: null,
                            });
                            await refetchStores();
                            toast.success(
                              language === "ar"
                                ? "تم إزالة الشعار"
                                : "Logo removed",
                            );
                          } catch {
                            toast.error(
                              language === "ar"
                                ? "فشل إزالة الشعار"
                                : "Failed to remove logo",
                            );
                          } finally {
                            setUploadingLogo(false);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {language === "ar" ? "إزالة" : "Remove"}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {language === "ar"
                      ? "PNG أو JPG أو WebP، ٥ ميجا كحد أقصى"
                      : "PNG, JPG, or WebP, max 5MB"}
                  </p>
                </div>
              </div>
            </div>

            {/* Store Favicon — the small icon shown in the browser tab.
                Stored in `settings.favicon_url`; the storefront layout reads it
                (after the theme customizer's favicon) when rendering <head>. */}
            <div className="settings-field-group">
              <div className="settings-field-group-label">
                {language === "ar" ? "أيقونة المتصفح" : "Favicon"}
              </div>
              <div className="flex items-center gap-5 rounded-xl border border-dashed border-border/50 bg-muted/5 p-4 transition-colors hover:border-border/80 hover:bg-muted/10">
                {faviconUrl ? (
                  <img
                    src={faviconUrl}
                    alt="Favicon"
                    className="h-16 w-16 rounded-xl object-contain bg-muted/20 ring-2 ring-border/20"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted/30 text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/x-icon,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            setFaviconCropSrc(reader.result as string);
                            setShowFaviconCrop(true);
                          };
                          reader.readAsDataURL(file);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 cursor-pointer"
                        asChild
                      >
                        <span>
                          <Upload className="h-3.5 w-3.5" />
                          {faviconUrl
                            ? language === "ar"
                              ? "تغيير"
                              : "Change"
                            : language === "ar"
                              ? "رفع أيقونة"
                              : "Upload favicon"}
                        </span>
                      </Button>
                    </label>
                    {faviconUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={uploadingFavicon}
                        onClick={async () => {
                          if (!currentStore?.id) return;
                          setUploadingFavicon(true);
                          try {
                            await updateStore(currentStore.id, {
                              settings: { favicon_url: "" },
                            });
                            await refetchStores();
                            toast.success(
                              language === "ar"
                                ? "تم إزالة الأيقونة"
                                : "Favicon removed",
                            );
                          } catch {
                            toast.error(
                              language === "ar"
                                ? "فشل إزالة الأيقونة"
                                : "Failed to remove favicon",
                            );
                          } finally {
                            setUploadingFavicon(false);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {language === "ar" ? "إزالة" : "Remove"}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {language === "ar"
                      ? "أيقونة مربعة تظهر في تبويب المتصفح — يُفضّل ٥١٢×٥١٢ بكسل"
                      : "Square icon shown in the browser tab — 512×512px works best"}
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
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t("store.storeName")}
                  </Label>
                  <Input
                    value={profileState.name}
                    onChange={(e) =>
                      setProfileState((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t("store.contactEmail")}
                  </Label>
                  <Input
                    value={profileState.contact_email}
                    onChange={(e) =>
                      setProfileState((p) => ({
                        ...p,
                        contact_email: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-1.5 mt-4">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("store.storeDescription")}
                </Label>
                <Textarea
                  value={profileState.description}
                  onChange={(e) =>
                    setProfileState((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
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
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t("store.contactPhone")}
                  </Label>
                  <PhoneInput
                    value={profileState.contact_phone}
                    onChange={(v) =>
                      setProfileState((p) => ({ ...p, contact_phone: v }))
                    }
                    defaultCountry="EG"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-green-600" />
                    {language === "ar" ? "رقم الواتساب" : "WhatsApp"}
                  </Label>
                  <PhoneInput
                    value={profileState.whatsapp_phone}
                    onChange={(v) =>
                      setProfileState((p) => ({ ...p, whatsapp_phone: v }))
                    }
                    defaultCountry="EG"
                  />
                </div>
              </div>
            </div>

            {/* Social */}
            <div className="settings-field-group">
              <div className="settings-field-group-label">
                {t("store.socialLinks")}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t("store.facebook")}
                  </Label>
                  <Input
                    value={profileState.facebook}
                    onChange={(e) =>
                      setProfileState((p) => ({
                        ...p,
                        facebook: e.target.value,
                      }))
                    }
                    placeholder="facebook.com/..."
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t("store.instagram")}
                  </Label>
                  <Input
                    value={profileState.instagram}
                    onChange={(e) =>
                      setProfileState((p) => ({
                        ...p,
                        instagram: e.target.value,
                      }))
                    }
                    placeholder="instagram.com/..."
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t("store.twitter")}
                  </Label>
                  <Input
                    value={profileState.twitter}
                    onChange={(e) =>
                      setProfileState((p) => ({
                        ...p,
                        twitter: e.target.value,
                      }))
                    }
                    placeholder="x.com/..."
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={saveProfile}
                disabled={isSaving}
                className="gap-2"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
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
              <p>
                {language === "ar"
                  ? "رابط متجرك والدومين المخصص"
                  : "Your store URL and custom domain"}
              </p>
            </div>

            <div className="settings-field-group">
              <div className="settings-field-group-label">
                {t("store.subdomain")}
              </div>
              <div className="flex items-center gap-3 rounded-xl border bg-muted/10 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Globe className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-sm font-semibold">
                      {currentStore?.subdomain || "—"}
                    </span>
                    {getStoreDomainSuffix() && (
                      <span className="text-xs text-muted-foreground">
                        {getStoreDomainSuffix()}
                      </span>
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
              <div className="settings-field-group-label">
                {t("store.customDomain")}
              </div>
              {currentStore?.id ? (
                <CustomDomainCard
                  storeId={currentStore.id}
                  language={language === "ar" ? "ar" : "en"}
                  onChanged={() => refetchStores()}
                />
              ) : null}
            </div>

            <div className="settings-field-group">
              <div className="settings-field-group-label">
                {t("store.sslStatus")}
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-green-500/15 bg-green-500/5 px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-green-500/15">
                  <Lock className="h-3.5 w-3.5 text-green-500" />
                </div>
                <span className="text-sm font-medium">
                  {t("store.sslActive")}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ─── Payment Gateway ─── */}
        {activeSection === "payment" && (
          <div key="payment" className="settings-section-enter">
            <div className="settings-section-header">
              <h2>{language === "ar" ? "بوابات الدفع" : "Payment Gateways"}</h2>
              <p>
                {language === "ar"
                  ? "اربط حسابات الدفع الخاصة بك لاستقبال المدفوعات"
                  : "Connect your payment accounts to accept payments"}
              </p>
            </div>

            {/* Single card with both gateways as expandable rows */}
            <div className="settings-field-group !p-0 overflow-hidden divide-y divide-border/20">
              {/* ── Paymob Row ── */}
              <div>
                <div
                  className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() =>
                    setActiveGateway(
                      activeGateway === "paymob" ? null : "paymob",
                    )
                  }
                >
                  <div className="flex items-center gap-3">
                    <img
                      src="/paymob-logo.webp"
                      alt="Paymob"
                      className="h-6 w-auto max-w-[72px] object-contain"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">Paymob</span>
                        {paymobCreds?.is_configured &&
                          enabledGateway === "paymob" && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              {language === "ar" ? "نشط" : "LIVE"}
                            </span>
                          )}
                        {paymobCreds?.is_configured &&
                          enabledGateway !== "paymob" && (
                            <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {language === "ar" ? "مُعد" : "Ready"}
                            </span>
                          )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {language === "ar"
                          ? "بطاقات ومحافظ إلكترونية"
                          : "Cards & wallets"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {paymobCreds?.is_configured && (
                      <Switch
                        checked={enabledGateway === "paymob"}
                        disabled={enablingSaving}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={async (checked) => {
                          if (!currentStore?.id) return;
                          setEnablingSaving(true);
                          try {
                            await apiClient(
                              `/stores/${currentStore.id}/settings/payment`,
                              {
                                method: "PATCH",
                                body: JSON.stringify({
                                  paymob_enabled: checked,
                                  ...(checked
                                    ? { kashier_enabled: false }
                                    : {}),
                                }),
                              },
                            );
                            setEnabledGateway(checked ? "paymob" : null);
                            toast.success(
                              checked
                                ? language === "ar"
                                  ? "تم تفعيل Paymob"
                                  : "Paymob enabled"
                                : language === "ar"
                                  ? "تم إيقاف Paymob"
                                  : "Paymob disabled",
                            );
                          } catch (err) {
                            showError(err);
                          } finally {
                            setEnablingSaving(false);
                          }
                        }}
                      />
                    )}
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${activeGateway === "paymob" ? "rotate-180" : ""}`}
                    />
                  </div>
                </div>
                {activeGateway === "paymob" && (
                  <div className="px-4 pb-4 pt-1 bg-muted/5 border-t border-border/10">
                    {paymobCreds?.is_configured && !paymobEditing ? (
                      <div className="space-y-0 divide-y divide-border/30">
                        {[
                          {
                            label: "Secret Key",
                            value: paymobCreds.secret_key_masked,
                          },
                          {
                            label: "Public Key",
                            value: paymobCreds.public_key_masked,
                          },
                          {
                            label: "HMAC Secret",
                            value: paymobCreds.hmac_secret_masked,
                          },
                          {
                            label: "Card Integration ID",
                            value: paymobCreds.card_integration_id,
                          },
                          ...(paymobCreds.wallet_integration_id
                            ? [
                                {
                                  label: "Wallet Integration ID",
                                  value: paymobCreds.wallet_integration_id,
                                },
                              ]
                            : []),
                        ].map((field) => (
                          <div
                            key={field.label}
                            className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                          >
                            <span className="text-xs text-muted-foreground">
                              {field.label}
                            </span>
                            <span className="text-xs font-mono text-foreground/70">
                              {field.value || "—"}
                            </span>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setPaymobEditing(true)}
                          >
                            {language === "ar" ? "تعديل" : "Edit"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={async () => {
                              if (!currentStore?.id) return;
                              try {
                                await deletePaymobCredentials(currentStore.id);
                                setPaymobCreds({
                                  is_configured: false,
                                  public_key_masked: null,
                                  secret_key_masked: null,
                                  hmac_secret_masked: null,
                                  card_integration_id: null,
                                  wallet_integration_id: null,
                                  last_configured: null,
                                });
                                if (enabledGateway === "paymob")
                                  setEnabledGateway(
                                    kashierCreds?.is_configured
                                      ? "kashier"
                                      : null,
                                  );
                                toast.success(
                                  language === "ar"
                                    ? "تم حذف بيانات Paymob"
                                    : "Paymob credentials removed",
                                );
                              } catch (err) {
                                showError(err);
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            {language === "ar" ? "حذف" : "Remove"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-3">
                          {language === "ar"
                            ? "تجد هذه البيانات في لوحة تحكم Paymob ← Developers ← Settings"
                            : "Find these in Paymob Dashboard → Developers → Settings"}
                        </p>
                        <div className="space-y-2.5">
                          {[
                            {
                              key: "secret_key" as const,
                              label: "Secret Key",
                              placeholder: "egy_sk_live_...",
                              secret: true,
                            },
                            {
                              key: "public_key" as const,
                              label: "Public Key",
                              placeholder: "egy_pk_live_...",
                              secret: true,
                            },
                            {
                              key: "hmac_secret" as const,
                              label: "HMAC Secret",
                              placeholder: "HMAC secret",
                              secret: true,
                            },
                            {
                              key: "card_integration_id" as const,
                              label: "Card Integration ID",
                              placeholder: "e.g. 123456",
                              secret: false,
                            },
                            {
                              key: "wallet_integration_id" as const,
                              label: `Wallet Integration ID (${language === "ar" ? "اختياري" : "optional"})`,
                              placeholder: "e.g. 789012",
                              secret: false,
                            },
                          ].map((field) => (
                            <div key={field.key} className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">
                                {field.label}
                              </Label>
                              <Input
                                type={
                                  field.secret && !paymobShowKeys
                                    ? "password"
                                    : "text"
                                }
                                placeholder={field.placeholder}
                                className="h-9 text-xs"
                                value={paymobForm[field.key]}
                                onChange={(e) =>
                                  setPaymobForm((f) => ({
                                    ...f,
                                    [field.key]: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-3">
                          <button
                            type="button"
                            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                            onClick={() => setPaymobShowKeys(!paymobShowKeys)}
                          >
                            {paymobShowKeys ? (
                              <>
                                <EyeOff className="h-3 w-3" />{" "}
                                {language === "ar" ? "إخفاء" : "Hide"}
                              </>
                            ) : (
                              <>
                                <Eye className="h-3 w-3" />{" "}
                                {language === "ar" ? "إظهار" : "Show"}
                              </>
                            )}
                          </button>
                          <div className="flex gap-2">
                            {paymobEditing && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => {
                                  setPaymobEditing(false);
                                  setPaymobForm({
                                    secret_key: "",
                                    public_key: "",
                                    hmac_secret: "",
                                    card_integration_id: "",
                                    wallet_integration_id: "",
                                  });
                                }}
                              >
                                {language === "ar" ? "إلغاء" : "Cancel"}
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 text-xs"
                              disabled={
                                paymobSaving ||
                                !paymobForm.secret_key ||
                                !paymobForm.public_key ||
                                !paymobForm.hmac_secret ||
                                !paymobForm.card_integration_id
                              }
                              onClick={async () => {
                                if (!currentStore?.id) return;
                                setPaymobSaving(true);
                                try {
                                  const result = await savePaymobCredentials(
                                    currentStore.id,
                                    {
                                      secret_key: paymobForm.secret_key,
                                      public_key: paymobForm.public_key,
                                      hmac_secret: paymobForm.hmac_secret,
                                      card_integration_id:
                                        paymobForm.card_integration_id,
                                      wallet_integration_id:
                                        paymobForm.wallet_integration_id ||
                                        undefined,
                                    },
                                  );
                                  setPaymobCreds(result);
                                  setPaymobForm({
                                    secret_key: "",
                                    public_key: "",
                                    hmac_secret: "",
                                    card_integration_id: "",
                                    wallet_integration_id: "",
                                  });
                                  setPaymobEditing(false);
                                  setEnabledGateway("paymob");
                                  toast.success(
                                    language === "ar"
                                      ? "تم حفظ بيانات Paymob"
                                      : "Paymob credentials saved",
                                  );
                                } catch (err) {
                                  showError(err);
                                } finally {
                                  setPaymobSaving(false);
                                }
                              }}
                            >
                              {paymobSaving && (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              )}
                              {language === "ar" ? "حفظ" : "Save"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Kashier Row ── */}
              <div>
                <div
                  className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() =>
                    setActiveGateway(
                      activeGateway === "kashier" ? null : "kashier",
                    )
                  }
                >
                  <div className="flex items-center gap-3">
                    <img
                      src="/kashier-logo.webp"
                      alt="Kashier"
                      className="h-6 w-auto max-w-[72px] object-contain"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">Kashier</span>
                        {kashierCreds?.is_configured &&
                          enabledGateway === "kashier" && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                              {language === "ar" ? "نشط" : "LIVE"}
                            </span>
                          )}
                        {kashierCreds?.is_configured &&
                          enabledGateway !== "kashier" && (
                            <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {language === "ar" ? "مُعد" : "Ready"}
                            </span>
                          )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {language === "ar"
                          ? "بطاقات بنكية"
                          : "Credit & debit cards"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {kashierCreds?.is_configured && (
                      <Switch
                        checked={enabledGateway === "kashier"}
                        disabled={enablingSaving}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={async (checked) => {
                          if (!currentStore?.id) return;
                          setEnablingSaving(true);
                          try {
                            await apiClient(
                              `/stores/${currentStore.id}/settings/payment`,
                              {
                                method: "PATCH",
                                body: JSON.stringify({
                                  kashier_enabled: checked,
                                  ...(checked ? { paymob_enabled: false } : {}),
                                }),
                              },
                            );
                            setEnabledGateway(checked ? "kashier" : null);
                            toast.success(
                              checked
                                ? language === "ar"
                                  ? "تم تفعيل Kashier"
                                  : "Kashier enabled"
                                : language === "ar"
                                  ? "تم إيقاف Kashier"
                                  : "Kashier disabled",
                            );
                          } catch (err) {
                            showError(err);
                          } finally {
                            setEnablingSaving(false);
                          }
                        }}
                      />
                    )}
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${activeGateway === "kashier" ? "rotate-180" : ""}`}
                    />
                  </div>
                </div>
                {activeGateway === "kashier" && (
                  <div className="px-4 pb-4 pt-1 bg-muted/5 border-t border-border/10">
                    {kashierCreds?.is_configured && !kashierEditing ? (
                      <div className="space-y-0 divide-y divide-border/30">
                        {[
                          {
                            label: "Merchant ID",
                            value: kashierCreds.merchant_id,
                          },
                          {
                            label: "API Key",
                            value: kashierCreds.api_key_masked,
                          },
                        ].map((field) => (
                          <div
                            key={field.label}
                            className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                          >
                            <span className="text-xs text-muted-foreground">
                              {field.label}
                            </span>
                            <span className="text-xs font-mono text-foreground/70">
                              {field.value || "—"}
                            </span>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setKashierEditing(true)}
                          >
                            {language === "ar" ? "تعديل" : "Edit"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={async () => {
                              if (!currentStore?.id) return;
                              try {
                                await deleteKashierCredentials(currentStore.id);
                                setKashierCreds({
                                  is_configured: false,
                                  merchant_id: null,
                                  api_key_masked: null,
                                  last_configured: null,
                                });
                                if (enabledGateway === "kashier")
                                  setEnabledGateway(
                                    paymobCreds?.is_configured
                                      ? "paymob"
                                      : null,
                                  );
                                toast.success(
                                  language === "ar"
                                    ? "تم حذف بيانات Kashier"
                                    : "Kashier credentials removed",
                                );
                              } catch (err) {
                                showError(err);
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            {language === "ar" ? "حذف" : "Remove"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-3">
                          {language === "ar"
                            ? "تجد هذه البيانات في لوحة تحكم Kashier ← Settings"
                            : "Find these in Kashier Dashboard → Settings"}
                        </p>
                        <div className="space-y-2.5">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">
                              Merchant ID
                            </Label>
                            <Input
                              type="text"
                              placeholder="MID-xxx-xxx"
                              className="h-9 text-xs"
                              value={kashierForm.merchant_id}
                              onChange={(e) =>
                                setKashierForm((f) => ({
                                  ...f,
                                  merchant_id: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">
                              Payment API Key
                            </Label>
                            <Input
                              type={kashierShowKeys ? "text" : "password"}
                              placeholder="Payment API key"
                              className="h-9 text-xs"
                              value={kashierForm.api_key}
                              onChange={(e) =>
                                setKashierForm((f) => ({
                                  ...f,
                                  api_key: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">
                              Secret Key
                            </Label>
                            <Input
                              type={kashierShowKeys ? "text" : "password"}
                              placeholder="Secret key"
                              className="h-9 text-xs"
                              value={kashierForm.secret_key}
                              onChange={(e) =>
                                setKashierForm((f) => ({
                                  ...f,
                                  secret_key: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-3">
                          <button
                            type="button"
                            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                            onClick={() => setKashierShowKeys(!kashierShowKeys)}
                          >
                            {kashierShowKeys ? (
                              <>
                                <EyeOff className="h-3 w-3" />{" "}
                                {language === "ar" ? "إخفاء" : "Hide"}
                              </>
                            ) : (
                              <>
                                <Eye className="h-3 w-3" />{" "}
                                {language === "ar" ? "إظهار" : "Show"}
                              </>
                            )}
                          </button>
                          <div className="flex gap-2">
                            {kashierEditing && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => {
                                  setKashierEditing(false);
                                  setKashierForm({
                                    merchant_id: "",
                                    api_key: "",
                                    secret_key: "",
                                  });
                                }}
                              >
                                {language === "ar" ? "إلغاء" : "Cancel"}
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 text-xs"
                              disabled={
                                kashierSaving ||
                                !kashierForm.merchant_id ||
                                !kashierForm.api_key
                              }
                              onClick={async () => {
                                if (!currentStore?.id) return;
                                setKashierSaving(true);
                                try {
                                  const result = await saveKashierCredentials(
                                    currentStore.id,
                                    {
                                      merchant_id: kashierForm.merchant_id,
                                      api_key: kashierForm.api_key,
                                      secret_key:
                                        kashierForm.secret_key || undefined,
                                    },
                                  );
                                  setKashierCreds(result);
                                  setKashierForm({
                                    merchant_id: "",
                                    api_key: "",
                                    secret_key: "",
                                  });
                                  setKashierEditing(false);
                                  setEnabledGateway("kashier");
                                  toast.success(
                                    language === "ar"
                                      ? "تم حفظ بيانات Kashier"
                                      : "Kashier credentials saved",
                                  );
                                } catch (err) {
                                  showError(err);
                                } finally {
                                  setKashierSaving(false);
                                }
                              }}
                            >
                              {kashierSaving && (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              )}
                              {language === "ar" ? "حفظ" : "Save"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ─── Fawry Section ─── */}
            <div className="border-t pt-6 mt-6">
              <div className="settings-field-group">
                <div className="flex items-center justify-between">
                  <div className="settings-field-group-label">Fawry</div>
                  <Badge
                    variant={
                      fawryCreds?.is_configured ? "default" : "secondary"
                    }
                  >
                    {fawryCreds?.is_configured
                      ? language === "ar"
                        ? "مفعّل"
                        : "Configured"
                      : language === "ar"
                        ? "غير مفعّل"
                        : "Not Configured"}
                  </Badge>
                </div>

                {fawryCreds?.is_configured && (
                  <div className="space-y-2 text-sm text-muted-foreground mt-3">
                    <div className="flex justify-between">
                      <span>Merchant Code</span>
                      <span className="font-mono">
                        {fawryCreds.merchant_code}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Security Key</span>
                      <span className="font-mono">
                        {fawryCreds.security_key_masked}
                      </span>
                    </div>
                    {fawryCreds.last_configured && (
                      <p className="text-xs pt-1">
                        {language === "ar" ? "آخر تحديث: " : "Last updated: "}
                        {new Date(
                          fawryCreds.last_configured,
                        ).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Fawry Credential Form */}
              <div className="settings-field-group">
                <div className="settings-field-group-label">
                  {fawryCreds?.is_configured
                    ? language === "ar"
                      ? "تحديث بيانات Fawry"
                      : "Update Fawry Credentials"
                    : language === "ar"
                      ? "إعداد Fawry"
                      : "Setup Fawry"}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {language === "ar"
                    ? "تجد هذه البيانات في لوحة تحكم FawryPay → إعدادات التاجر"
                    : "Find these in your FawryPay Dashboard → Merchant Settings"}
                </p>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Merchant Code</Label>
                    <Input
                      type="text"
                      placeholder={
                        language === "ar" ? "كود التاجر" : "e.g. +/IAKAN..."
                      }
                      value={fawryForm.merchant_code}
                      onChange={(e) =>
                        setFawryForm((f) => ({
                          ...f,
                          merchant_code: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Security Key</Label>
                    <Input
                      type={fawryShowKeys ? "text" : "password"}
                      placeholder={
                        language === "ar"
                          ? "مفتاح الأمان"
                          : "Security key from Fawry dashboard"
                      }
                      value={fawryForm.security_key}
                      onChange={(e) =>
                        setFawryForm((f) => ({
                          ...f,
                          security_key: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setFawryShowKeys(!fawryShowKeys)}
                    >
                      {fawryShowKeys ? (
                        <span className="flex items-center gap-1">
                          <EyeOff className="h-3 w-3" />{" "}
                          {language === "ar" ? "إخفاء" : "Hide"}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />{" "}
                          {language === "ar" ? "إظهار" : "Show"}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    disabled={
                      fawrySaving ||
                      !fawryForm.merchant_code ||
                      !fawryForm.security_key
                    }
                    onClick={async () => {
                      if (!currentStore?.id) return;
                      setFawrySaving(true);
                      try {
                        const result = await saveFawryCredentials(
                          currentStore.id,
                          {
                            merchant_code: fawryForm.merchant_code,
                            security_key: fawryForm.security_key,
                          },
                        );
                        setFawryCreds(result);
                        setFawryForm({ merchant_code: "", security_key: "" });
                        toast.success(
                          language === "ar"
                            ? "تم حفظ بيانات Fawry بنجاح"
                            : "Fawry credentials saved",
                        );
                      } catch (err) {
                        showError(err);
                      } finally {
                        setFawrySaving(false);
                      }
                    }}
                  >
                    {fawrySaving && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    )}
                    {language === "ar" ? "حفظ" : "Save Credentials"}
                  </Button>

                  {fawryCreds?.is_configured && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={async () => {
                        if (!currentStore?.id) return;
                        try {
                          await deleteFawryCredentials(currentStore.id);
                          setFawryCreds({
                            is_configured: false,
                            merchant_code: null,
                            security_key_masked: null,
                            last_configured: null,
                          });
                          toast.success(
                            language === "ar"
                              ? "تم حذف بيانات Fawry"
                              : "Fawry credentials removed",
                          );
                        } catch (err) {
                          showError(err);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      {language === "ar" ? "حذف" : "Remove"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Shipping ─── */}
        {activeSection === "shipping" && (
          <div key="shipping" className="settings-section-enter">
            <div className="settings-section-header">
              <h2>{t("store.shipping")}</h2>
              <p>
                {language === "ar"
                  ? "مناطق الشحن وأسعار التوصيل"
                  : "Shipping zones and delivery rates"}
              </p>
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
                    <div className="settings-field-group-label mb-0">
                      {t("store.shippingZones")}
                    </div>
                    {!showAddZone && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-7 text-xs"
                        onClick={() => setShowAddZone(true)}
                      >
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
                            <TableHead className="text-xs">
                              {t("store.zone")}
                            </TableHead>
                            <TableHead className="text-xs">
                              {language === "ar" ? "المحافظات" : "Governorates"}
                            </TableHead>
                            <TableHead className="text-xs">
                              {t("store.rate")} ({t("common.currency")})
                            </TableHead>
                            <TableHead className="text-xs">
                              {t("store.estimatedDays")}
                            </TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {shippingData.zones.map((z) => (
                            <TableRow key={z.id}>
                              <TableCell className="font-medium text-sm">
                                {z.zone}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {z.governorates}
                              </TableCell>
                              <TableCell className="text-sm">
                                {z.rate}
                              </TableCell>
                              <TableCell className="text-sm">
                                {z.estimated_days}
                              </TableCell>
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
                      {language === "ar"
                        ? "لا توجد مناطق شحن بعد"
                        : "No shipping zones yet"}
                    </div>
                  )}

                  {showAddZone && (
                    <div className="rounded-lg border bg-muted/20 p-4 space-y-3 mt-3">
                      <h4 className="text-sm font-medium">
                        {language === "ar"
                          ? "إضافة منطقة جديدة"
                          : "Add New Zone"}
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1">
                          <Label className="text-xs">{t("store.zone")}</Label>
                          <Input
                            value={newZone.zone}
                            onChange={(e) =>
                              setNewZone((p) => ({
                                ...p,
                                zone: e.target.value,
                              }))
                            }
                            placeholder={
                              language === "ar" ? "مثل: القاهرة" : "e.g. Cairo"
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">
                            {language === "ar" ? "المحافظات" : "Governorates"}
                          </Label>
                          <Input
                            value={newZone.governorates}
                            onChange={(e) =>
                              setNewZone((p) => ({
                                ...p,
                                governorates: e.target.value,
                              }))
                            }
                            placeholder={
                              language === "ar"
                                ? "القاهرة, الجيزة"
                                : "Cairo, Giza"
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">{t("store.rate")}</Label>
                          <Input
                            type="number"
                            value={newZone.rate || ""}
                            onChange={(e) =>
                              setNewZone((p) => ({
                                ...p,
                                rate: Number(e.target.value),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">
                            {t("store.estimatedDays")}
                          </Label>
                          <Input
                            value={newZone.estimated_days}
                            onChange={(e) =>
                              setNewZone((p) => ({
                                ...p,
                                estimated_days: e.target.value,
                              }))
                            }
                            placeholder="2-3 days"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddZone}>
                          {language === "ar" ? "إضافة" : "Add"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAddZone(false)}
                        >
                          {t("products.cancel")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bosta Shipping Integration */}
                <div className="settings-field-group">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="settings-field-group-label mb-0">
                        {language === "ar"
                          ? "بوسطة - شركة الشحن"
                          : "Bosta Shipping"}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {language === "ar"
                          ? "ربط حساب بوسطة لإنشاء الشحنات تلقائيًا"
                          : "Connect your Bosta account for automated shipment creation"}
                      </p>
                    </div>
                    {bostaCreds?.is_configured && !bostaEditing && (
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-200 bg-green-50"
                      >
                        {language === "ar" ? "مفعّل" : "CONNECTED"}
                      </Badge>
                    )}
                  </div>

                  {bostaCreds?.is_configured && !bostaEditing ? (
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2 text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs">
                            API Key
                          </span>
                          <div className="font-mono text-sm">
                            {bostaCreds.api_key_masked || "••••"}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">
                            Business ID
                          </span>
                          <div className="text-sm">
                            {bostaCreds.business_id || "—"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={bostaCreds.auto_create_shipment}
                          disabled
                        />
                        <span className="text-muted-foreground">
                          {language === "ar"
                            ? "إنشاء شحنة تلقائيًا عند تأكيد الطلب"
                            : "Auto-create shipment on order confirmation"}
                        </span>
                      </div>
                      {bostaCreds.last_configured && (
                        <p className="text-xs text-muted-foreground">
                          {language === "ar"
                            ? "آخر تحديث: "
                            : "Last configured: "}
                          {new Date(
                            bostaCreds.last_configured,
                          ).toLocaleDateString()}
                        </p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setBostaEditing(true);
                            setBostaForm({
                              api_key: "",
                              business_id: bostaCreds.business_id || "",
                              webhook_secret: "",
                              auto_create_shipment:
                                bostaCreds.auto_create_shipment,
                            });
                          }}
                        >
                          {language === "ar" ? "تعديل" : "Edit"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={async () => {
                            if (!currentStore?.id) return;
                            try {
                              const { deleteBostaCredentials } =
                                await import("@/services/shipmentApi");
                              await deleteBostaCredentials(currentStore.id);
                              setBostaCreds({
                                is_configured: false,
                                api_key_masked: null,
                                business_id: null,
                                auto_create_shipment: false,
                                last_configured: null,
                              });
                              toast.success(
                                language === "ar"
                                  ? "تم حذف بيانات بوسطة"
                                  : "Bosta credentials removed",
                              );
                            } catch (err) {
                              showError(err, language);
                            }
                          }}
                        >
                          {language === "ar" ? "حذف" : "Remove"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1">
                          <Label className="text-xs">API Key</Label>
                          <div className="relative">
                            <Input
                              type={bostaShowKey ? "text" : "password"}
                              value={bostaForm.api_key}
                              onChange={(e) =>
                                setBostaForm((p) => ({
                                  ...p,
                                  api_key: e.target.value,
                                }))
                              }
                              placeholder="Bosta API Key"
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              onClick={() => setBostaShowKey(!bostaShowKey)}
                            >
                              {bostaShowKey ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">Business ID</Label>
                          <Input
                            value={bostaForm.business_id}
                            onChange={(e) =>
                              setBostaForm((p) => ({
                                ...p,
                                business_id: e.target.value,
                              }))
                            }
                            placeholder="Bosta Business ID"
                          />
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">
                          {language === "ar"
                            ? "مفتاح Webhook (اختياري)"
                            : "Webhook Secret (optional)"}
                        </Label>
                        <Input
                          type="password"
                          value={bostaForm.webhook_secret}
                          onChange={(e) =>
                            setBostaForm((p) => ({
                              ...p,
                              webhook_secret: e.target.value,
                            }))
                          }
                          placeholder={
                            language === "ar"
                              ? "لتوثيق إشعارات بوسطة"
                              : "For webhook signature verification"
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={bostaForm.auto_create_shipment}
                          onCheckedChange={(v) =>
                            setBostaForm((p) => ({
                              ...p,
                              auto_create_shipment: !!v,
                            }))
                          }
                        />
                        <span className="text-sm">
                          {language === "ar"
                            ? "إنشاء شحنة تلقائيًا عند تأكيد الطلب"
                            : "Auto-create shipment on order confirmation"}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={
                            bostaSaving ||
                            !bostaForm.api_key ||
                            !bostaForm.business_id
                          }
                          onClick={async () => {
                            if (!currentStore?.id) return;
                            setBostaSaving(true);
                            try {
                              const { saveBostaCredentials } =
                                await import("@/services/shipmentApi");
                              const result = await saveBostaCredentials(
                                currentStore.id,
                                {
                                  api_key: bostaForm.api_key,
                                  business_id: bostaForm.business_id,
                                  webhook_secret:
                                    bostaForm.webhook_secret || undefined,
                                  auto_create_shipment:
                                    bostaForm.auto_create_shipment,
                                },
                              );
                              setBostaCreds(result);
                              setBostaEditing(false);
                              setBostaForm({
                                api_key: "",
                                business_id: "",
                                webhook_secret: "",
                                auto_create_shipment: false,
                              });
                              toast.success(
                                language === "ar"
                                  ? "تم حفظ بيانات بوسطة"
                                  : "Bosta credentials saved",
                              );
                            } catch (err) {
                              showError(err, language);
                            } finally {
                              setBostaSaving(false);
                            }
                          }}
                        >
                          {bostaSaving && (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          )}
                          {language === "ar" ? "حفظ" : "Save"}
                        </Button>
                        {bostaEditing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setBostaEditing(false)}
                          >
                            {language === "ar" ? "إلغاء" : "Cancel"}
                          </Button>
                        )}
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
                    <span className="text-sm text-muted-foreground">
                      {t("common.currency")}
                    </span>
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
        {activeSection === "policies" &&
          (() => {
            const policyQuestions: Record<
              string,
              {
                key: string;
                label: string;
                labelAr: string;
                placeholder: string;
                placeholderAr: string;
              }[]
            > = {
              return: [
                {
                  key: "return_window",
                  label: "Return window",
                  labelAr: "مدة الإرجاع",
                  placeholder: "e.g. 14 days",
                  placeholderAr: "مثال: 14 يوم",
                },
                {
                  key: "refund_method",
                  label: "Refund method",
                  labelAr: "طريقة الاسترداد",
                  placeholder: "e.g. Original payment method, store credit",
                  placeholderAr: "مثال: نفس طريقة الدفع، رصيد بالمتجر",
                },
                {
                  key: "conditions",
                  label: "Return conditions",
                  labelAr: "شروط الإرجاع",
                  placeholder:
                    "e.g. Items must be unused and in original packaging",
                  placeholderAr:
                    "مثال: المنتجات لازم تكون جديدة وفي التغليف الأصلي",
                },
              ],
              shipping: [
                {
                  key: "shipping_regions",
                  label: "Shipping regions",
                  labelAr: "مناطق الشحن",
                  placeholder: "e.g. All of Egypt, Cairo & Giza only",
                  placeholderAr: "مثال: كل مصر، القاهرة والجيزة بس",
                },
                {
                  key: "delivery_time",
                  label: "Estimated delivery time",
                  labelAr: "وقت التوصيل المتوقع",
                  placeholder: "e.g. 2-5 business days",
                  placeholderAr: "مثال: 2-5 أيام عمل",
                },
                {
                  key: "shipping_cost",
                  label: "Shipping cost info",
                  labelAr: "تكلفة الشحن",
                  placeholder:
                    "e.g. Free shipping over 500 EGP, flat rate 50 EGP",
                  placeholderAr:
                    "مثال: شحن مجاني فوق 500 جنيه، سعر ثابت 50 جنيه",
                },
              ],
              privacy: [
                {
                  key: "data_collected",
                  label: "Data you collect",
                  labelAr: "البيانات اللي بتجمعها",
                  placeholder: "e.g. Name, email, phone, address",
                  placeholderAr: "مثال: الاسم، الإيميل، الموبايل، العنوان",
                },
                {
                  key: "data_usage",
                  label: "How you use the data",
                  labelAr: "إزاي بتستخدم البيانات",
                  placeholder: "e.g. Order processing, marketing emails",
                  placeholderAr: "مثال: تنفيذ الطلبات، إيميلات تسويقية",
                },
                {
                  key: "third_party",
                  label: "Third-party sharing",
                  labelAr: "مشاركة مع أطراف تالتة",
                  placeholder: "e.g. Shipping companies, payment processors",
                  placeholderAr: "مثال: شركات الشحن، بوابات الدفع",
                },
              ],
              terms: [
                {
                  key: "jurisdiction",
                  label: "Jurisdiction / Country",
                  labelAr: "الولاية القضائية / البلد",
                  placeholder: "e.g. Egypt",
                  placeholderAr: "مثال: مصر",
                },
                {
                  key: "age_requirement",
                  label: "Minimum age requirement",
                  labelAr: "الحد الأدنى للسن",
                  placeholder: "e.g. 18 years old",
                  placeholderAr: "مثال: 18 سنة",
                },
                {
                  key: "payment_terms",
                  label: "Payment terms",
                  labelAr: "شروط الدفع",
                  placeholder: "e.g. Full payment at checkout, COD available",
                  placeholderAr:
                    "مثال: الدفع الكامل عند الشراء، الدفع عند الاستلام متاح",
                },
              ],
            };

            const currentQuestions = policyQuestions[policyTab] || [];

            const handleGeneratePolicy = async () => {
              if (!currentStore?.id) return;
              setIsGeneratingPolicy(true);
              try {
                const result = await generatePolicy(String(currentStore.id), {
                  policy_type: policyTab as
                    | "return"
                    | "shipping"
                    | "privacy"
                    | "terms",
                  store_name: currentStore.name || "My Store",
                  answers: aiPolicyAnswers,
                  language: language === "ar" ? "ar" : "en",
                });
                setPolicyTexts((prev) => ({
                  ...prev,
                  [policyTab]: result.policy_text,
                }));
                setShowAiPolicyDialog(false);
                setAiPolicyAnswers({});
                toast.success(
                  language === "ar"
                    ? "تم إنشاء السياسة بنجاح"
                    : "Policy generated successfully",
                );
              } catch {
                toast.error(
                  language === "ar"
                    ? "فشل إنشاء السياسة. حاول مرة تانية."
                    : "Failed to generate policy. Please try again.",
                );
              } finally {
                setIsGeneratingPolicy(false);
              }
            };

            return (
              <div key="policies" className="settings-section-enter">
                <div className="settings-section-header">
                  <h2>{t("store.policies")}</h2>
                  <p>
                    {language === "ar"
                      ? "سياسات المتجر والشروط القانونية"
                      : "Store policies and legal terms"}
                  </p>
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

                <div className="flex justify-end mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAiPolicyAnswers({});
                      setShowAiPolicyDialog(true);
                    }}
                    className="gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    {language === "ar"
                      ? "إنشاء بالذكاء الاصطناعي"
                      : "Generate with AI"}
                  </Button>
                </div>

                <Textarea
                  rows={10}
                  value={policyTexts[policyTab] || ""}
                  onChange={(e) =>
                    setPolicyTexts((prev) => ({
                      ...prev,
                      [policyTab]: e.target.value,
                    }))
                  }
                  placeholder={
                    language === "ar"
                      ? "اكتب السياسة هنا..."
                      : "Write your policy here..."
                  }
                  className="font-mono text-sm"
                />
                <div className="pt-4">
                  <Button
                    disabled={isSaving}
                    onClick={async () => {
                      if (!currentStore?.id) return;
                      setIsSaving(true);
                      try {
                        await updateStore(currentStore.id, {
                          settings: {
                            return_policy: policyTexts.return,
                            shipping_policy: policyTexts.shipping,
                            privacy_policy: policyTexts.privacy,
                            terms_of_service: policyTexts.terms,
                          },
                        });
                        await refetchStores();
                        toast.success(t("store.saved"));
                      } catch (err) {
                        showError(err, language);
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                  >
                    {t("store.save")}
                  </Button>
                </div>

                {/* AI Policy Generation Dialog */}
                <Dialog
                  open={showAiPolicyDialog}
                  onOpenChange={setShowAiPolicyDialog}
                >
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        {language === "ar"
                          ? "إنشاء السياسة بالذكاء الاصطناعي"
                          : "Generate Policy with AI"}
                      </DialogTitle>
                      <DialogDescription>
                        {language === "ar"
                          ? "أجب على الأسئلة دي وهنكتبلك السياسة تلقائيًا"
                          : "Answer a few questions and we'll generate the policy for you"}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                      {currentQuestions.map((q) => (
                        <div key={q.key} className="space-y-1.5">
                          <Label className="text-sm font-medium">
                            {language === "ar" ? q.labelAr : q.label}
                          </Label>
                          <Input
                            value={aiPolicyAnswers[q.key] || ""}
                            onChange={(e) =>
                              setAiPolicyAnswers((prev) => ({
                                ...prev,
                                [q.key]: e.target.value,
                              }))
                            }
                            placeholder={
                              language === "ar"
                                ? q.placeholderAr
                                : q.placeholder
                            }
                          />
                        </div>
                      ))}
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">
                          {language === "ar"
                            ? "ملاحظات إضافية (اختياري)"
                            : "Additional notes (optional)"}
                        </Label>
                        <Textarea
                          rows={2}
                          value={aiPolicyAnswers.additional_notes || ""}
                          onChange={(e) =>
                            setAiPolicyAnswers((prev) => ({
                              ...prev,
                              additional_notes: e.target.value,
                            }))
                          }
                          placeholder={
                            language === "ar"
                              ? "أي تفاصيل تانية عايز تضيفها..."
                              : "Any other details you'd like to include..."
                          }
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowAiPolicyDialog(false)}
                        disabled={isGeneratingPolicy}
                      >
                        {language === "ar" ? "إلغاء" : "Cancel"}
                      </Button>
                      <Button
                        onClick={handleGeneratePolicy}
                        disabled={isGeneratingPolicy}
                        className="gap-2"
                      >
                        {isGeneratingPolicy ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {language === "ar"
                              ? "جاري الإنشاء..."
                              : "Generating..."}
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            {language === "ar" ? "إنشاء" : "Generate"}
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            );
          })()}

        {/* ─── Pages & Hours ─── */}
        {activeSection === "pages" && (
          <div key="pages" className="settings-section-enter">
            <PagesAndHoursPanel
              language={language as "ar" | "en"}
              footerSections={footerSections}
              onFooterSectionsChange={handleFooterSectionsChange}
              shippingConfig={shippingConfig}
              onShippingConfigChange={handleShippingConfigChange}
              businessHours={businessHours}
              onBusinessHoursChange={handleBusinessHoursChange}
              isSaving={isSavingPages}
              onSave={savePagesAndHours}
            />
          </div>
        )}

        {/* ─── SEO ─── */}
        {activeSection === "seo" && (
          <SeoSettingsPanel
            storeId={currentStore?.id}
            storeSettings={
              currentStore?.settings as Record<string, unknown> | null | undefined
            }
            onSaved={() => refetchStores()}
          />
        )}

        {/* ─── Status ─── */}
        {activeSection === "status" && (
          <div key="status" className="settings-section-enter">
            <div className="settings-section-header">
              <h2>{t("store.status")}</h2>
              <p>
                {language === "ar"
                  ? "حالة المتجر والخطة الحالية"
                  : "Store availability and current plan"}
              </p>
            </div>

            <div className="settings-field-group">
              <div className="settings-field-group-label">
                {t("store.storeStatus")}
              </div>
              <div
                className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${storeOnline ? "border-green-500/20 bg-green-500/5" : "border-amber-500/20 bg-amber-500/5"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${storeOnline ? "bg-green-500" : "bg-amber-500"}`}
                    />
                    {storeOnline && (
                      <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-green-500 animate-ping opacity-40" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {storeOnline
                        ? t("store.online")
                        : language === "ar"
                          ? "مغلق"
                          : "Closed"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {storeOnline
                        ? language === "ar"
                          ? "متجرك مباشر ويستقبل الطلبات"
                          : "Your store is live and accepting orders"
                        : language === "ar"
                          ? "المتجر مغلق مؤقتاً — العملاء يشوفون رسالة الإغلاق"
                          : "Store is temporarily closed — customers see your closure message"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={storeOnline}
                  onCheckedChange={setStoreOnline}
                />
              </div>

              {/* Closure settings — visible when store is closed */}
              {!storeOnline && (
                <div className="mt-4 space-y-4 rounded-xl border border-amber-200/40 dark:border-amber-800/30 bg-amber-500/[0.02] p-4">
                  <p className="text-sm font-semibold">
                    {language === "ar" ? "إعدادات الإغلاق" : "Closure Settings"}
                  </p>

                  {/* Closure message */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        {language === "ar"
                          ? "رسالة الإغلاق (EN)"
                          : "Closure Message (EN)"}
                      </Label>
                      <Textarea
                        value={closureMessage}
                        onChange={(e) => setClosureMessage(e.target.value)}
                        placeholder="We're currently closed. We'll be back soon!"
                        rows={3}
                        className="rounded-lg text-sm resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        {language === "ar"
                          ? "رسالة الإغلاق (AR)"
                          : "Closure Message (AR)"}
                      </Label>
                      <Textarea
                        value={closureMessageAr}
                        onChange={(e) => setClosureMessageAr(e.target.value)}
                        placeholder="المتجر مغلق حالياً. هنرجع قريب!"
                        dir="rtl"
                        rows={3}
                        className="rounded-lg text-sm resize-none"
                      />
                    </div>
                  </div>

                  {/* Reopen date & time */}
                  <div className="space-y-3">
                    <Label className="text-xs">
                      {language === "ar"
                        ? "تاريخ ووقت إعادة الفتح"
                        : "Reopen Date & Time"}
                    </Label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        type="date"
                        value={reopenDate.split("T")[0] || ""}
                        onChange={(e) => {
                          const time = reopenDate.split("T")[1] || "09:00";
                          setReopenDate(
                            e.target.value ? `${e.target.value}T${time}` : "",
                          );
                        }}
                        className="rounded-lg text-sm"
                        dir="ltr"
                      />
                      <Input
                        type="time"
                        value={reopenDate.split("T")[1] || ""}
                        onChange={(e) => {
                          const date =
                            reopenDate.split("T")[0] ||
                            new Date().toISOString().split("T")[0];
                          setReopenDate(
                            e.target.value
                              ? `${date}T${e.target.value}`
                              : reopenDate.split("T")[0] || "",
                          );
                        }}
                        className="rounded-lg text-sm"
                        dir="ltr"
                        disabled={!reopenDate}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {language === "ar"
                        ? "اختياري — اتركه فارغ إذا مش عارف"
                        : "Optional — leave empty if unsure"}
                    </p>

                    {/* Countdown toggle */}
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={showCountdown}
                        onCheckedChange={setShowCountdown}
                        disabled={!reopenDate}
                      />
                      <div>
                        <p className="text-xs font-medium">
                          {language === "ar"
                            ? "عرض عداد تنازلي"
                            : "Show Countdown Timer"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {language === "ar"
                            ? "العملاء يشوفون الوقت المتبقي لإعادة الفتح"
                            : "Customers see time remaining until reopening"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Save closure settings */}
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-lg"
                    disabled={savingStatus}
                    onClick={async () => {
                      if (!currentStore?.id) return;
                      setSavingStatus(true);
                      try {
                        await updateStore(currentStore.id, {
                          status: "inactive",
                          settings: {
                            closure_message: closureMessage,
                            closure_message_ar: closureMessageAr,
                            reopen_at: reopenDate || null,
                            show_countdown: showCountdown ? "true" : "false",
                          },
                        });
                        toast.success(
                          language === "ar"
                            ? "تم حفظ إعدادات الإغلاق"
                            : "Closure settings saved",
                        );
                        refetchStores();
                      } catch (err) {
                        showError(err, language);
                      } finally {
                        setSavingStatus(false);
                      }
                    }}
                  >
                    {savingStatus ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" />
                    ) : null}
                    {language === "ar"
                      ? "حفظ وإغلاق المتجر"
                      : "Save & Close Store"}
                  </Button>
                </div>
              )}

              {/* Reopen button when closed */}
              {!storeOnline && (
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  className="mt-3 rounded-lg gap-1.5"
                  disabled={savingStatus}
                  onClick={async () => {
                    if (!currentStore?.id) return;
                    setSavingStatus(true);
                    try {
                      await updateStore(currentStore.id, { status: "active" });
                      setStoreOnline(true);
                      toast.success(
                        language === "ar"
                          ? "المتجر أصبح مباشر!"
                          : "Store is now live!",
                      );
                      refetchStores();
                    } catch (err) {
                      showError(err, language);
                    } finally {
                      setSavingStatus(false);
                    }
                  }}
                >
                  {language === "ar"
                    ? "إعادة فتح المتجر الآن"
                    : "Reopen Store Now"}
                </Button>
              )}
            </div>

            <div className="settings-field-group">
              <div className="settings-field-group-label">
                {language === "ar" ? "تفاصيل" : "Details"}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-muted/5 p-4">
                  <p className="text-[0.6875rem] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                    {t("store.createdAt")}
                  </p>
                  <p className="text-sm font-semibold">
                    {currentStore?.created_at
                      ? new Date(currentStore.created_at).toLocaleDateString(
                          language === "ar" ? "ar-EG" : "en-US",
                          { year: "numeric", month: "long", day: "numeric" },
                        )
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/5 p-4">
                  <p className="text-[0.6875rem] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                    {t("store.plan")}
                  </p>
                  <Badge className="mt-0.5">
                    {currentStore?.default_currency === "EGP"
                      ? "Starter"
                      : "Free"}
                  </Badge>
                </div>
              </div>

              {/* Market & currency — per-store; changing it updates ONLY this
                  store's market/currency (not other stores). */}
              <div className="settings-field-group-label mt-6">
                {language === "ar" ? "السوق والعملة" : "Market & Currency"}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium">
                    {language === "ar" ? "السوق" : "Market"}
                  </Label>
                  <select
                    aria-label={language === "ar" ? "السوق" : "Market"}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-50"
                    value={currentStore?.country || "EG"}
                    disabled={savingMarket || !currentStore?.id}
                    onChange={async (e) => {
                      const country = e.target.value;
                      if (!currentStore?.id) return;
                      try {
                        setSavingMarket(true);
                        await updateStore(currentStore.id, { country });
                        await refetchStores(currentStore.id);
                        toast.success(
                          language === "ar"
                            ? "تم تحديث السوق والعملة لهذا المتجر"
                            : "Market & currency updated for this store",
                        );
                      } catch (err) {
                        showError(err, language);
                      } finally {
                        setSavingMarket(false);
                      }
                    }}
                  >
                    <option value="EG">
                      {language === "ar" ? "🇪🇬 مصر (EGP)" : "🇪🇬 Egypt (EGP)"}
                    </option>
                    <option value="SA">
                      {language === "ar"
                        ? "🇸🇦 السعودية (SAR)"
                        : "🇸🇦 Saudi Arabia (SAR)"}
                    </option>
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    {language === "ar"
                      ? "يحدد عملة هذا المتجر فقط — لا يؤثر على متاجرك الأخرى."
                      : "Sets the currency for this store only — other stores are unaffected."}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/5 p-4">
                  <p className="text-[0.6875rem] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                    {t("common.currency")}
                  </p>
                  <p className="text-sm font-semibold ltr-nums">
                    {currentStore?.default_currency || "EGP"}
                  </p>
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
              <p>
                {language === "ar"
                  ? "اختر ثيم يناسب متجرك"
                  : "Browse and apply themes to your storefront"}
              </p>
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

        {/* ─── Theme Customization (redirects to Theme Editor) ─── */}
        {activeSection === "customization" && (
          <div key="customization" className="settings-section-enter">
            <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary" />
                  {language === "ar" ? "تخصيص الثيم" : "Theme Customization"}
                </CardTitle>
                <CardDescription>
                  {language === "ar"
                    ? "استخدم محرر الثيم المتقدم لتخصيص ثيم متجرك"
                    : "Use the advanced Theme Editor to customize your store theme"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  asChild
                  className="gap-2"
                >
                  <a href="/online-store/theme-editor">
                    <Sparkles className="h-4 w-4" />
                    {language === "ar" ? "فتح محرر الثيم" : "Open Theme Editor"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

      </div>

      {/* Logo Crop Dialog */}
      {logoCropSrc && (
        <ImageCropDialog
          open={showLogoCrop}
          onClose={() => {
            setShowLogoCrop(false);
            setLogoCropSrc(null);
          }}
          imageSrc={logoCropSrc}
          cropShape="rect"
          aspect={1}
          title={language === "ar" ? "تعديل شعار المتجر" : "Edit Store Logo"}
          loading={uploadingLogo}
          onCropComplete={async (blob) => {
            if (!currentStore?.id) return;
            setUploadingLogo(true);
            try {
              const file = fileFromCropBlob(blob, "logo");
              const result = await uploadStoreAsset(
                currentStore.id,
                file,
                "logo",
              );
              await updateStore(currentStore.id, { logo_url: result.url });
              await refetchStores();
              toast.success(
                language === "ar" ? "تم رفع الشعار" : "Logo uploaded",
              );
              setShowLogoCrop(false);
              setLogoCropSrc(null);
            } catch {
              toast.error(
                language === "ar" ? "فشل رفع الشعار" : "Failed to upload logo",
              );
            } finally {
              setUploadingLogo(false);
            }
          }}
        />
      )}

      {/* Favicon Crop Dialog — square, written to settings.favicon_url */}
      {faviconCropSrc && (
        <ImageCropDialog
          open={showFaviconCrop}
          onClose={() => {
            setShowFaviconCrop(false);
            setFaviconCropSrc(null);
          }}
          imageSrc={faviconCropSrc}
          cropShape="rect"
          aspect={1}
          title={language === "ar" ? "تعديل الأيقونة" : "Edit Favicon"}
          loading={uploadingFavicon}
          onCropComplete={async (blob) => {
            if (!currentStore?.id) return;
            setUploadingFavicon(true);
            try {
              const file = fileFromCropBlob(blob, "favicon");
              const result = await uploadStoreAsset(
                currentStore.id,
                file,
                "favicon",
              );
              await updateStore(currentStore.id, {
                settings: { favicon_url: result.url },
              });
              await refetchStores();
              toast.success(
                language === "ar" ? "تم رفع الأيقونة" : "Favicon uploaded",
              );
              setShowFaviconCrop(false);
              setFaviconCropSrc(null);
            } catch {
              toast.error(
                language === "ar"
                  ? "فشل رفع الأيقونة"
                  : "Failed to upload favicon",
              );
            } finally {
              setUploadingFavicon(false);
            }
          }}
        />
      )}
    </div>
    </>
  );
};

export default StoreSettings;
