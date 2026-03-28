import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  fetchCustomization, updateCustomization, publishCustomization,
  type CustomizationData,
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
  Loader2, Layout, Package, Navigation2, Image, Type, AlignLeft,
  Mail, Palette, Store, CheckCircle2, AlertCircle, RefreshCw,
} from "lucide-react";

// ─── Field definitions ────────────────────────────────────────────────────────

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

interface VirtualSection {
  id: string;
  name: string;
  nameAr: string;
  icon: React.ComponentType<{ className?: string }>;
  isGlobal?: boolean;
  fields: FieldDef[];
}

const VIRTUAL_SECTIONS: VirtualSection[] = [
  {
    id: "identity",
    name: "Store identity",
    nameAr: "هوية المتجر",
    icon: Store,
    isGlobal: true,
    fields: [
      { key: "identity.store_name", label: "Store name", labelAr: "اسم المتجر", type: "text", placeholder: "My Store" },
      { key: "identity.logo_url", label: "Logo URL", labelAr: "رابط الشعار", type: "image_picker" },
      { key: "identity.favicon_url", label: "Favicon URL", labelAr: "رابط الفافيكون", type: "image_picker" },
    ],
  },
  {
    id: "header",
    name: "Header",
    nameAr: "الرأس",
    icon: Navigation2,
    isGlobal: true,
    fields: [
      { key: "header.nav_layout", label: "Navigation layout", labelAr: "تخطيط القائمة", type: "select",
        options: ["logo-right", "logo-center", "logo-left", "stacked"] },
      { key: "header.show_search_bar", label: "Show search bar", labelAr: "إظهار البحث", type: "toggle" },
      { key: "header.show_cart_icon", label: "Show cart icon", labelAr: "إظهار السلة", type: "toggle" },
      { key: "header.announcement_text", label: "Announcement text", labelAr: "نص الإشعار", type: "text", placeholder: "Free shipping on orders over $50" },
      { key: "header.announcement_color", label: "Announcement background", labelAr: "خلفية الإشعار", type: "color" },
      { key: "header.announcement_text_color", label: "Announcement text color", labelAr: "لون نص الإشعار", type: "color" },
    ],
  },
  {
    id: "hero",
    name: "Hero banner",
    nameAr: "البانر الرئيسي",
    icon: Image,
    fields: [
      { key: "hero.hero_image_url", label: "Hero image", labelAr: "صورة البانر", type: "image_picker" },
      { key: "hero.headline", label: "Headline", labelAr: "العنوان الرئيسي", type: "text", placeholder: "Shop the latest collection" },
      { key: "hero.subtitle", label: "Subtitle", labelAr: "العنوان الفرعي", type: "textarea" },
      { key: "hero.cta_text", label: "Button text", labelAr: "نص الزر", type: "text", placeholder: "Shop now" },
      { key: "hero.cta_link", label: "Button link", labelAr: "رابط الزر", type: "url", placeholder: "/collections/all" },
    ],
  },
  {
    id: "featured_text",
    name: "Text block",
    nameAr: "مقطع نصي",
    icon: AlignLeft,
    fields: [
      { key: "labels.home_title", label: "Home page title", labelAr: "عنوان الصفحة الرئيسية", type: "text" },
      { key: "labels.products_title", label: "Products section heading", labelAr: "عنوان قسم المنتجات", type: "text" },
      { key: "labels.add_to_cart", label: "Add to cart button", labelAr: "نص زر الإضافة للسلة", type: "text" },
      { key: "labels.cart_empty", label: "Empty cart message", labelAr: "رسالة السلة الفارغة", type: "text" },
      { key: "labels.search_placeholder", label: "Search placeholder", labelAr: "نص البحث", type: "text" },
    ],
  },
  {
    id: "products",
    name: "Product grid",
    nameAr: "شبكة المنتجات",
    icon: Package,
    fields: [
      { key: "products.layout", label: "Layout", labelAr: "التخطيط", type: "select", options: ["grid", "list", "masonry"] },
      { key: "products.products_per_row", label: "Products per row", labelAr: "منتجات في الصف", type: "range", min: 2, max: 5, step: 1 },
      { key: "products.show_price", label: "Show price", labelAr: "إظهار السعر", type: "toggle" },
      { key: "products.show_rating", label: "Show rating", labelAr: "إظهار التقييم", type: "toggle" },
    ],
  },
  {
    id: "footer",
    name: "Footer",
    nameAr: "التذييل",
    icon: Layout,
    isGlobal: true,
    fields: [
      { key: "footer.footer_text", label: "Footer text", labelAr: "نص التذييل", type: "textarea" },
      { key: "footer.show_newsletter", label: "Newsletter signup", labelAr: "تسجيل النشرة البريدية", type: "toggle" },
      { key: "footer.social_links.facebook", label: "Facebook URL", labelAr: "رابط فيسبوك", type: "url" },
      { key: "footer.social_links.instagram", label: "Instagram URL", labelAr: "رابط إنستجرام", type: "url" },
      { key: "footer.social_links.twitter", label: "Twitter/X URL", labelAr: "رابط تويتر/إكس", type: "url" },
      { key: "footer.social_links.whatsapp", label: "WhatsApp number", labelAr: "رقم واتساب", type: "text", placeholder: "+20XXXXXXXXXX" },
    ],
  },
];

interface ThemeFieldGroup {
  group: string;
  groupAr: string;
  fields: FieldDef[];
}

const THEME_FIELD_GROUPS: ThemeFieldGroup[] = [
  {
    group: "Colors",
    groupAr: "الألوان",
    fields: [
      { key: "theme.primary_color", label: "Primary color", labelAr: "اللون الرئيسي", type: "color" },
      { key: "theme.secondary_color", label: "Secondary color", labelAr: "اللون الثانوي", type: "color" },
      { key: "theme.accent_color", label: "Accent color", labelAr: "لون التمييز", type: "color" },
      { key: "theme.background_color", label: "Background color", labelAr: "لون الخلفية", type: "color" },
      { key: "theme.text_color", label: "Text color", labelAr: "لون النص", type: "color" },
    ],
  },
  {
    group: "Typography",
    groupAr: "الخطوط",
    fields: [
      { key: "theme.heading_font", label: "Heading font", labelAr: "خط العناوين", type: "select",
        options: ["Inter", "Cairo", "Playfair Display", "DM Sans", "Raleway", "Poppins"] },
      { key: "theme.body_font", label: "Body font", labelAr: "خط النصوص", type: "select",
        options: ["Inter", "Cairo", "DM Sans", "Source Sans 3", "Nunito", "Roboto"] },
    ],
  },
  {
    group: "Style",
    groupAr: "الأسلوب",
    fields: [
      { key: "theme.border_radius", label: "Border radius", labelAr: "تدوير الحواف", type: "range", min: 0, max: 24, step: 2 },
      { key: "theme.button_style", label: "Button style", labelAr: "أسلوب الأزرار", type: "select",
        options: ["rounded", "square", "pill"] },
      { key: "theme.nav_style", label: "Navigation style", labelAr: "أسلوب التنقل", type: "select",
        options: ["light", "dark", "transparent"] },
      { key: "theme.enable_animations", label: "Enable animations", labelAr: "تفعيل الحركات", type: "toggle" },
    ],
  },
];

// ─── Utility ──────────────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function ThemeEditor() {
  const { isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const storeId = currentStore?.id ?? "";
  const storeUrl = currentStore?.subdomain ? getStoreUrl(currentStore.subdomain) : null;

  const [localData, setLocalData] = useState<CustomizationData | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [past, setPast] = useState<CustomizationData[]>([]);
  const [future, setFuture] = useState<CustomizationData[]>([]);

  const [activeTab, setActiveTab] = useState<"sections" | "theme" | "apps">("sections");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("hero");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewKey, setPreviewKey] = useState(0);

  const initializedRef = useRef(false);

  const { data: customization, isLoading } = useQuery({
    queryKey: ["customization", storeId],
    queryFn: () => fetchCustomization(storeId),
    enabled: !!storeId,
  });

  useEffect(() => {
    if (!customization || initializedRef.current) return;
    initializedRef.current = true;
    setLocalData(customization);
  }, [customization]);

  function updateField(path: string, value: unknown) {
    if (!localData) return;
    const newData = setNestedValue(localData, path, value) as CustomizationData;
    setPast((p) => [...p.slice(-19), localData]);
    setFuture([]);
    setLocalData(newData);
    setIsDirty(true);
  }

  function undo() {
    if (past.length === 0 || !localData) return;
    const prev = past[past.length - 1];
    setFuture((f) => [localData, ...f]);
    setLocalData(prev);
    setPast((p) => p.slice(0, -1));
    setIsDirty(true);
  }

  function redo() {
    if (future.length === 0 || !localData) return;
    const next = future[0];
    setPast((p) => [...p, localData]);
    setLocalData(next);
    setFuture((f) => f.slice(1));
    setIsDirty(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!localData) throw new Error("No data");
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
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customization", storeId] });
      toast.success(isRTL ? "تم حفظ التغييرات" : "Changes saved");
      setIsDirty(false);
      setPreviewKey((k) => k + 1);
    },
    onError: (err) => showError(err),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!localData) throw new Error("No data");
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

  const selectedSection = VIRTUAL_SECTIONS.find((s) => s.id === selectedSectionId) ?? VIRTUAL_SECTIONS[0];
  const isBusy = saveMutation.isPending || publishMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="flex h-12 items-center gap-0 border-b bg-card px-3 shrink-0">
        {/* Exit */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-[13px] font-medium me-2"
          onClick={() => navigate("/online-store/themes")}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {isRTL ? "خروج" : "Exit"}
        </Button>

        <div className="h-5 w-px bg-border mx-1 shrink-0" />

        {/* Tabs */}
        <div className="flex items-center gap-0.5">
          {(["sections", "theme", "apps"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 h-8 text-[12px] font-medium rounded-md transition-colors",
                activeTab === tab
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {tab === "sections"
                ? isRTL ? "الأقسام" : "Sections"
                : tab === "theme"
                ? isRTL ? "الثيم" : "Theme"
                : isRTL ? "التطبيقات" : "Apps"}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Device toggle */}
        <div className="flex items-center gap-1 me-2">
          <Button
            variant={device === "desktop" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 w-7 px-0"
            onClick={() => setDevice("desktop")}
            title="Desktop"
          >
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={device === "mobile" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 w-7 px-0"
            onClick={() => setDevice("mobile")}
            title="Mobile"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="h-5 w-px bg-border mx-1 shrink-0" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5 me-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 px-0"
            onClick={undo}
            disabled={past.length === 0}
            title="Undo"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 px-0"
            onClick={redo}
            disabled={future.length === 0}
            title="Redo"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {isDirty && (
          <Badge
            variant="outline"
            className="text-[10px] text-amber-600 border-amber-300 dark:border-amber-700 dark:text-amber-400 me-2"
          >
            {isRTL ? "تغييرات غير محفوظة" : "Unsaved"}
          </Badge>
        )}

        {/* Save */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-[13px]"
          onClick={() => saveMutation.mutate()}
          disabled={isBusy || !isDirty}
        >
          {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
          {isRTL ? "حفظ" : "Save"}
        </Button>

        {/* Publish */}
        <Button
          size="sm"
          className="h-8 text-[13px] ms-1.5"
          onClick={() => publishMutation.mutate()}
          disabled={isBusy}
        >
          {publishMutation.isPending
            ? <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
            : <Globe className="h-3.5 w-3.5 me-1.5" />}
          {isRTL ? "نشر" : "Publish"}
        </Button>
      </header>

      {/* ── Main area ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar */}
        <aside className="flex w-[272px] shrink-0 flex-col border-e bg-card overflow-hidden">
          {isLoading && !localData ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-lg" />
              ))}
            </div>
          ) : activeTab === "sections" ? (
            <SectionsList
              sections={VIRTUAL_SECTIONS}
              selectedId={selectedSectionId}
              isRTL={isRTL}
              onSelect={setSelectedSectionId}
            />
          ) : activeTab === "theme" ? (
            <ThemeSettingsSidebar
              groups={THEME_FIELD_GROUPS}
              data={localData}
              isRTL={isRTL}
              onChange={updateField}
            />
          ) : (
            <AppsPlaceholder isRTL={isRTL} />
          )}
        </aside>

        {/* Center — Live preview */}
        <main className="relative flex flex-1 flex-col items-center justify-center bg-muted/40 overflow-hidden">
          {storeUrl ? (
            <>
              <div
                className={cn(
                  "relative bg-white shadow-2xl transition-all duration-300 ease-in-out overflow-hidden",
                  device === "mobile"
                    ? "w-[390px] rounded-[36px] border-[6px] border-zinc-800 shadow-[0_30px_80px_rgba(0,0,0,0.25)]"
                    : "w-full h-full rounded-none border-none shadow-none"
                )}
                style={device === "mobile" ? { height: "calc(100% - 48px)" } : { height: "100%" }}
              >
                <iframe
                  key={previewKey}
                  src={storeUrl}
                  className="w-full h-full border-0"
                  title="Store preview"
                />
              </div>
              {/* Reload hint */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <button
                  className="flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur-sm border px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors shadow-sm"
                  onClick={() => setPreviewKey((k) => k + 1)}
                >
                  <RefreshCw className="h-3 w-3" />
                  {isRTL ? "تحديث المعاينة" : "Refresh preview"}
                </button>
              </div>
            </>
          ) : (
            <PreviewPlaceholder isRTL={isRTL} />
          )}
        </main>

        {/* Right panel — section settings */}
        {activeTab === "sections" && (
          <aside className="flex w-[300px] shrink-0 flex-col border-s bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20 shrink-0">
              <selectedSection.icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-semibold truncate">
                {isRTL ? selectedSection.nameAr : selectedSection.name}
              </span>
              {selectedSection.isGlobal && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ms-auto shrink-0">
                  {isRTL ? "عام" : "Global"}
                </Badge>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading && !localData ? (
                <div className="p-4 space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-24 rounded" />
                      <Skeleton className="h-9 w-full rounded-md" />
                    </div>
                  ))}
                </div>
              ) : (
                <SectionSettingsForm
                  section={selectedSection}
                  data={localData}
                  isRTL={isRTL}
                  onChange={updateField}
                />
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// ─── Sections list ────────────────────────────────────────────────────────────

function SectionsList({
  sections, selectedId, isRTL, onSelect,
}: {
  sections: VirtualSection[];
  selectedId: string;
  isRTL: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
          {isRTL ? "الصفحة الرئيسية" : "Home page"}
        </p>
      </div>
      <ul className="flex-1 overflow-y-auto py-1.5 px-1.5">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = section.id === selectedId;
          return (
            <li key={section.id}>
              <button
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-start transition-colors",
                  isActive
                    ? "bg-primary/8 text-primary"
                    : "hover:bg-muted/50 text-foreground"
                )}
                onClick={() => onSelect(section.id)}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className="text-[13px] font-medium flex-1 truncate">
                  {isRTL ? section.nameAr : section.name}
                </span>
                {section.isGlobal && (
                  <span className="text-[9px] text-muted-foreground/40 font-medium shrink-0">
                    {isRTL ? "عام" : "Global"}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="p-3 border-t shrink-0">
        <p className="text-[11px] text-center text-muted-foreground/50">
          {isRTL ? "إضافة أقسام مخصصة قريبًا" : "Custom sections coming soon"}
        </p>
      </div>
    </div>
  );
}

// ─── Theme settings sidebar ───────────────────────────────────────────────────

function ThemeSettingsSidebar({
  groups, data, isRTL, onChange,
}: {
  groups: ThemeFieldGroup[];
  data: CustomizationData | null;
  isRTL: boolean;
  onChange: (path: string, value: unknown) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
      {groups.map((group) => (
        <div key={group.group}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50 mb-2 px-1">
            {isRTL ? group.groupAr : group.group}
          </p>
          <div className="space-y-3">
            {group.fields.map((field) => (
              <FieldControl
                key={field.key}
                field={field}
                value={data ? getNestedValue(data, field.key) : undefined}
                isRTL={isRTL}
                onChange={(v) => onChange(field.key, v)}
                compact
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Section settings form ────────────────────────────────────────────────────

function SectionSettingsForm({
  section, data, isRTL, onChange,
}: {
  section: VirtualSection;
  data: CustomizationData | null;
  isRTL: boolean;
  onChange: (path: string, value: unknown) => void;
}) {
  return (
    <div className="py-4 px-4 space-y-4">
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
  );
}

// ─── Field control ────────────────────────────────────────────────────────────

function FieldControl({
  field, value, isRTL, onChange, compact = false,
}: {
  field: FieldDef;
  value: unknown;
  isRTL: boolean;
  onChange: (value: unknown) => void;
  compact?: boolean;
}) {
  const label = isRTL ? field.labelAr : field.label;

  if (field.type === "toggle") {
    return (
      <div className="flex items-center justify-between gap-3">
        <Label className={cn("text-[12px] font-medium leading-tight", compact ? "text-xs" : "text-sm")}>
          {label}
        </Label>
        <Switch
          checked={Boolean(value)}
          onCheckedChange={onChange}
          className="shrink-0"
        />
      </div>
    );
  }

  if (field.type === "color") {
    const colorVal = String(value ?? "#000000");
    return (
      <div className="space-y-1.5">
        <Label className="text-[12px] font-medium">{label}</Label>
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <input
              type="color"
              value={colorVal}
              onChange={(e) => onChange(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded-md border border-input p-0.5 block"
            />
          </div>
          <Input
            value={colorVal}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 font-mono text-[12px] flex-1"
            placeholder="#000000"
            maxLength={7}
          />
        </div>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-1.5">
        <Label className="text-[12px] font-medium">{label}</Label>
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt} className="text-[12px]">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === "range") {
    const numVal = Number(value ?? field.min ?? 0);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[12px] font-medium">{label}</Label>
          <span className="text-[11px] text-muted-foreground font-mono">{numVal}{field.step === 1 ? "px" : ""}</span>
        </div>
        <Slider
          value={[numVal]}
          min={field.min ?? 0}
          max={field.max ?? 100}
          step={field.step ?? 1}
          onValueChange={([v]) => onChange(v)}
          className="py-0"
        />
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label className="text-[12px] font-medium">{label}</Label>
        <Textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className="text-[12px] resize-none"
        />
      </div>
    );
  }

  // text / url / image_picker
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-medium">{label}</Label>
      <Input
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="h-8 text-[12px]"
        type={field.type === "url" ? "url" : "text"}
        dir={field.type === "url" ? "ltr" : undefined}
      />
    </div>
  );
}

// ─── Apps placeholder ─────────────────────────────────────────────────────────

function AppsPlaceholder({ isRTL }: { isRTL: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-12 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mb-3">
        <Puzzle className="h-5 w-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-semibold mb-1">{isRTL ? "تطبيقات المتجر" : "App embeds"}</p>
      <p className="text-xs text-muted-foreground">
        {isRTL ? "دعم التطبيقات الخارجية قريبًا" : "Third-party app integrations coming soon"}
      </p>
    </div>
  );
}

// Need Puzzle icon import
function Puzzle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 2c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z" />
    </svg>
  );
}

// ─── Preview placeholder ──────────────────────────────────────────────────────

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
        {isRTL
          ? "أضف نطاقًا فرعيًا لمتجرك لتفعيل المعاينة المباشرة"
          : "Add a subdomain to your store to enable live preview"}
      </p>
    </div>
  );
}
