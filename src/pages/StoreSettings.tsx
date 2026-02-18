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
  Trash2, Plus, Loader2, ExternalLink, Phone,
} from "lucide-react";
import { ThemePreview } from "@/components/ThemePreview";
import {
  identitySettings,
  headerSettings,
  heroSettings,
  productsSettings,
  footerSettings,
  themeSchemas,
  groupSettings,
  type SettingDefinition,
} from "@/data/theme-schemas";
import {
  fetchCustomization,
  updateCustomization,
  publishCustomization,
  fetchThemes,
  type AvailableTheme,
} from "@/services/themeApi";
import { updateStore } from "@/services/storeApi";
import {
  fetchShippingSettings,
  addShippingZone,
  deleteShippingZone,
  updateShippingSettings,
  type ShippingSettings,
} from "@/services/storeApi";

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

// ─── Constants ──────────────────────────────────────────────────────────────

const SECTION_CONFIG = [
  { key: "identity", label: "Identity", labelAr: "الهوية", icon: Store, settings: identitySettings },
  { key: "header", label: "Header", labelAr: "الهيدر", icon: Type, settings: headerSettings },
  { key: "hero", label: "Hero", labelAr: "القسم الرئيسي", icon: ImageIcon, settings: heroSettings },
  { key: "products", label: "Products", labelAr: "المنتجات", icon: ShoppingBag, settings: productsSettings },
  { key: "footer", label: "Footer", labelAr: "الفوتر", icon: MessageSquare, settings: footerSettings },
] as const;

const THEME_PREVIEWS: Record<string, { bg: string; fg: string; accent: string; icon: string }> = {
  modern: { bg: "#f8fafc", fg: "#0f172a", accent: "#3b82f6", icon: "✨" },
  boutique: { bg: "#fdf2f8", fg: "#831843", accent: "#ec4899", icon: "🌸" },
  elegant: { bg: "#fffbeb", fg: "#78350f", accent: "#d97706", icon: "👑" },
  skeuomorphic: { bg: "#ecfdf5", fg: "#064e3b", accent: "#10b981", icon: "🎨" },
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
  };
  const sectionSetters: Record<string, React.Dispatch<React.SetStateAction<Record<string, any>>>> = {
    identity: setIdentityState, header: setHeaderState, hero: setHeroState,
    products: setProductsState, footer: setFooterState,
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

  // ─── Handlers ───────────────────────────────────────────────────────────

  const buildFullPayload = useCallback(() => {
    const footerClean = extractNonEmpty(footerState);
    const { facebook, instagram, twitter, whatsapp, ...footerRest } = footerClean;
    const social_links = extractNonEmpty({ facebook, instagram, twitter, whatsapp });

    return {
      theme: { base_theme: activeTheme, ...extractNonEmpty(themeState) },
      identity: extractNonEmpty(identityState),
      header: extractNonEmpty(headerState),
      hero: extractNonEmpty(heroState),
      products: extractNonEmpty(productsState),
      footer: {
        ...footerRest,
        ...(Object.keys(social_links).length > 0 ? { social_links } : {}),
      },
    };
  }, [activeTheme, themeState, identityState, headerState, heroState, productsState, footerState]);

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
    { value: "themes", label: t("store.themes"), icon: Sparkles },
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
          {/* Save / Publish / Preview toggle bar */}
          <div className="flex gap-3 mb-4">
            <Button onClick={saveDraft} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
              {language === "ar" ? "حفظ مسودة" : "Save Draft"}
            </Button>
            <Button onClick={publish} variant="default" disabled={isSaving} className="bg-green-600 hover:bg-green-700">
              {language === "ar" ? "نشر" : "Publish"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPreview((v) => !v)}
              className="gap-2 ms-auto"
            >
              {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPreview
                ? (language === "ar" ? "إخفاء المعاينة" : "Hide Preview")
                : (language === "ar" ? "معاينة حية" : "Live Preview")}
            </Button>
          </div>

          {/* Side-by-side layout: settings + resizable preview */}
          <div ref={splitRef} className="flex" style={{ gap: 0 }}>
            {/* Left: settings panel */}
            <div
              className="space-y-4 overflow-y-auto pe-3"
              style={{
                width: showPreview ? `${100 - previewPct}%` : "100%",
                maxHeight: showPreview ? "calc(100vh - 10rem)" : undefined,
              }}
            >
              {/* Theme-specific settings (colors, fonts, layout) */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{language === "ar" ? "إعدادات الثيم" : "Theme Settings"}</CardTitle>
                  <CardDescription className="text-xs">
                    {language === "ar"
                      ? `ثيم "${availableThemes.find((t) => t.id === activeTheme)?.nameAr || activeTheme}"`
                      : `"${availableThemes.find((t) => t.id === activeTheme)?.name || activeTheme}" theme`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Array.from(groupedThemeSettings).map(([group, settings]) => (
                    <div key={group} className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        {language === "ar" ? settings[0].groupAr : group}
                      </h3>
                      <div className={`grid gap-4 ${showPreview ? "grid-cols-1" : "sm:grid-cols-2"}`}>
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
                </CardContent>
              </Card>

              {/* Storefront Section Settings */}
              <Accordion type="multiple" className="space-y-2">
                {SECTION_CONFIG.map((section) => (
                  <AccordionItem key={section.key} value={section.key} className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline gap-3">
                      <div className="flex items-center gap-3">
                        <section.icon className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          {language === "ar" ? section.labelAr : section.label}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-4">
                      {section.settings.map((setting) => (
                        <SettingField
                          key={setting.key}
                          setting={setting}
                          value={sectionStates[section.key]?.[setting.key]}
                          onChange={handleSectionChange(section.key)}
                          language={language}
                        />
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* Drag handle */}
            {showPreview && (
              <div
                className="w-2 shrink-0 cursor-col-resize group flex items-center justify-center hover:bg-primary/10 transition-colors"
                onMouseDown={startResize}
              >
                <div className="w-0.5 h-12 rounded-full bg-border group-hover:bg-primary/40 transition-colors" />
              </div>
            )}

            {/* Right: live preview (sticky) */}
            {showPreview && (
              <div className="sticky top-4 self-start" style={{ width: `${previewPct}%` }}>
                <Card className="overflow-hidden h-[calc(100vh-10rem)]">
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
        </TabsContent>

        {/* ═══ Themes ═══ */}
        <TabsContent value="themes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t("store.themeMarket")}
              </CardTitle>
              <CardDescription>{t("store.themeMarketDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {availableThemes.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {availableThemes.map((theme) => {
                    const isActive = activeTheme === theme.id;
                    const preview = THEME_PREVIEWS[theme.id] || THEME_PREVIEWS.modern;
                    return (
                      <div
                        key={theme.id}
                        className={`group relative rounded-2xl border-2 overflow-hidden transition-all duration-300 cursor-pointer hover:-translate-y-1 ${
                          isActive
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-border hover:border-primary/40"
                        }`}
                        onClick={() => {
                          setActiveTheme(theme.id);
                          setIsDirty(true);
                          toast.success(
                            language === "ar"
                              ? `تم اختيار ثيم "${theme.nameAr}"!`
                              : `"${theme.name}" theme selected!`
                          );
                        }}
                      >
                        {/* Preview area */}
                        <div
                          className="h-32 flex items-center justify-center relative"
                          style={{ backgroundColor: preview.bg }}
                        >
                          <span className="text-4xl drop-shadow-sm">{preview.icon}</span>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {[preview.bg, preview.fg, preview.accent].map((c, i) => (
                              <div
                                key={i}
                                className="h-4 w-4 rounded-full border border-border/30"
                                style={{
                                  backgroundColor: c,
                                  boxShadow: "inset 0 -1px 2px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.1)",
                                }}
                              />
                            ))}
                          </div>
                          {isActive && (
                            <div className="absolute top-2 end-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                              <Check className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <Badge
                            variant="secondary"
                            className="absolute top-2 start-2 text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-600"
                          >
                            {t("store.free")}
                          </Badge>
                        </div>

                        {/* Info */}
                        <div className="p-3 bg-card">
                          <p className="text-sm font-semibold">
                            {language === "ar" ? theme.nameAr : theme.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {theme.description}
                          </p>
                          {theme.layout === "skeuomorphic" && (
                            <Badge variant="outline" className="mt-2 text-[10px]">
                              {language === "ar" ? "تصميم خاص" : "Special Layout"}
                            </Badge>
                          )}
                          <div className="mt-3">
                            <Button
                              size="sm"
                              variant={isActive ? "default" : "outline"}
                              className="w-full h-8 text-xs rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTheme(theme.id);
                                setIsDirty(true);
                              }}
                            >
                              {isActive ? t("store.applied") : t("store.applyTheme")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
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
                  <span className="text-sm text-muted-foreground">.numu.store</span>
                </div>
                {currentStore?.store_url && (
                  <a
                    href={currentStore.store_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                  >
                    {currentStore.store_url}
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
