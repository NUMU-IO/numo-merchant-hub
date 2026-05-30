import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useTrialPaywall } from "@/contexts/TrialPaywallContext";
import { canUnlockTheme, type Tier } from "@/lib/themePlan";
import { LockedThemeBadge } from "./LockedThemeBadge";
import { UpgradeCTAButton } from "./UpgradeCTAButton";
import { ThemePreviewModal } from "./ThemePreviewModal";
import {
  fetchThemes,
  fetchCustomization,
  updateCustomization,
  publishCustomization,
  fetchStoreThemes,
  submitExternalTheme,
  fetchBuildStatus,
  removeExternalTheme,
  connectDevServer,
  rebuildExternalTheme,
  validateExternalTheme,
  type AvailableTheme,
  type CustomizationData,
  type StoreThemeListItem,
  type ThemeBuildStatus,
  type ThemeValidationResponse,
} from "@/services/themeApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { getStoreUrl } from "@/lib/storefront";
import {
  Pencil, MoreHorizontal, ExternalLink, Eye, Copy, Sparkles,
  CheckCircle2, Clock, Loader2, ArrowUpRight, Layers, Github, Trash2, RefreshCw, ShieldCheck,
  Search, Palette, Lock, ChevronDown,
} from "lucide-react";
import { MarketplaceCatalog } from "@/components/theme-editor";

// ─── Theme visual palettes ───────────────────────────────────────────────────
const THEME_PALETTES: Record<string, { bg: string; accent: string; text: string; card: string }> = {
  modern:            { bg: "#f8fafc", accent: "#6366f1", text: "#0f172a", card: "#ffffff" },
  boutique:          { bg: "#fdf8f3", accent: "#c4956a", text: "#3d2b1a", card: "#fff9f4" },
  elegant:           { bg: "#0f1117", accent: "#c9a96e", text: "#f5f0e8", card: "#1a1d27" },
  skeuomorphic:      { bg: "#e8e0d8", accent: "#8b6f52", text: "#2c1f14", card: "#f2ece4" },
  "neo-brutalism":   { bg: "#f5f500", accent: "#000000", text: "#000000", card: "#ffffff" },
  "tech-wave":       { bg: "#0a0e1a", accent: "#00f0ff", text: "#e0e8f0", card: "#111827" },
  editorial:         { bg: "#f5f5f0", accent: "#1a3a2a", text: "#1a1a1a", card: "#ffffff" },
  "luxury-minimal":  { bg: "#fafaf8", accent: "#8a7e6b", text: "#2c2c2c", card: "#ffffff" },
  empire:            { bg: "#fafafa", accent: "#1a1a1a", text: "#0a0a0a", card: "#ffffff" },
  "kick-game":       { bg: "#f5f0e8", accent: "#c8a87c", text: "#1a1510", card: "#faf8f4" },
  street:            { bg: "#1a1a2e", accent: "#ffd600", text: "#f0f0f0", card: "#252540" },
  rabbitsocks:       { bg: "#f9f9f7", accent: "#001f3f", text: "#000613", card: "#f4f4f2" },
  "gilded-glamour-boutique": { bg: "#faf9f5", accent: "#b8960c", text: "#1a1a1a", card: "#ffffff" },
  bazar:             { bg: "#fffbe6", accent: "#f5a623", text: "#1a1a1a", card: "#fff8e1" },
  vionne:            { bg: "#ffffff", accent: "#050505", text: "#050505", card: "#f4f4f4" },
  "saw-saw":         { bg: "#faf8f4", accent: "#675f30", text: "#1a1510", card: "#f5f0e8" },
  default:           { bg: "#f1f5f9", accent: "#3b82f6", text: "#1e293b", card: "#ffffff" },
};

const LAYOUT_LABELS: Record<string, { en: string; ar: string }> = {
  default:           { en: "Default",        ar: "افتراضي"       },
  skeuomorphic:      { en: "Skeuomorphic",   ar: "واقعي"         },
  "neo-brutalism":   { en: "Neo-Brutalism",  ar: "نيو برتاليزم"  },
  editorial:         { en: "Editorial",      ar: "تحريري"        },
  "luxury-minimal":  { en: "Luxury Minimal", ar: "فاخر بسيط"     },
  empire:            { en: "Empire",         ar: "إمباير"        },
  "kick-game":       { en: "Kick Game",      ar: "كيك جيم"      },
  street:            { en: "Street Vibes",   ar: "ستريت"         },
  rabbitsocks:       { en: "RabbitSocks",    ar: "رابيت سوكس"    },
  "tech-wave":       { en: "Tech Wave",      ar: "موجة تقنية"    },
  bazar:             { en: "Bazar",          ar: "بازار"          },
  vionne:            { en: "Vionne",         ar: "فيون"           },
  "saw-saw":         { en: "Saw Saw",        ar: "ساو ساو"        },
};

// ─── Theme preview image ──────────────────────────────────────────────────────
// Falls back to the palette gradient when the screenshot isn't deployed yet
// for this slug — keeps the layout intact so cards never look broken.
function ThemePreviewImage({
  theme,
  palette,
  className,
}: {
  theme: AvailableTheme;
  palette: typeof THEME_PALETTES[string];
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = theme.preview_image_url || `/themes/${theme.id}/preview.png`;
  if (failed || !src) {
    return (
      <div
        className={`w-full h-full ${className ?? ""}`}
        style={{
          background: `linear-gradient(135deg, ${palette.bg}, ${palette.accent}33)`,
        }}
      />
    );
  }
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className={`absolute inset-0 w-full h-full object-cover ${className ?? ""}`}
      onError={() => setFailed(true)}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function OnlineStoreThemes() {
  const { isRTL } = useLanguage();
  const { tenant } = useAuth();
  const { currentStore } = useDashboardStore();
  const { requireTrial } = useTrialPaywall();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [switchTarget, setSwitchTarget] = useState<AvailableTheme | null>(null);
  // Live-preview modal target. ``null`` while closed; setting a theme opens
  // the fullscreen iframe (or the screenshot fallback if no demo is deployed).
  const [previewTheme, setPreviewTheme] = useState<AvailableTheme | null>(null);
  // Library toolbar — search by name, filter by required-plan tier.
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | Tier>("all");

  const merchantPlan = tenant?.plan;

  // ─── External theme (BYOT) state ─────────────────────────────────────
  const [submitOpen, setSubmitOpen] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);
  const [buildStatus, setBuildStatus] = useState<ThemeBuildStatus | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);

  // ─── Dev server connection state ─────────────────────────────────────
  const [devOpen, setDevOpen] = useState(false);
  // Default points at @numueg/theme-cli's dev port (5173). The old
  // value (4321) was the Astro starter default and no longer matches
  // the canonical CLI workflow — merchants pasting in their actual
  // `numu-theme dev` URL would have to overwrite the placeholder.
  const [devUrl, setDevUrl] = useState("http://localhost:5173");
  const [devError, setDevError] = useState<string | null>(null);

  const storeId = currentStore?.id ?? "";
  const storeUrl = currentStore?.subdomain ? getStoreUrl(currentStore.subdomain) : null;

  // Built-in themes (legacy endpoint)
  const { data: builtinThemes = [], isLoading: themesLoading } = useQuery({
    queryKey: ["themes"],
    queryFn: fetchThemes,
  });

  // Store-scoped themes including external (new endpoint)
  const { data: storeThemes } = useQuery({
    queryKey: ["store-themes", storeId],
    queryFn: () => fetchStoreThemes(storeId),
    enabled: !!storeId,
  });

  const { data: customization, isLoading: custLoading } = useQuery({
    queryKey: ["customization", storeId],
    queryFn: () => fetchCustomization(storeId),
    enabled: !!storeId,
  });

  const switchMutation = useMutation({
    mutationFn: async (themeId: string) => {
      // If an external theme is currently installed, detach it first.
      // Otherwise theme_settings.external_theme sticks around and the
      // storefront's theme resolver can keep honoring it over base_theme.
      const hasExternal = storeThemes?.themes?.some((t) => t.is_external);
      if (hasExternal) {
        try {
          await removeExternalTheme(storeId, themeId);
        } catch {
          // 404 (no external) or transient — safe to ignore, proceed to switch
        }
      }
      await updateCustomization(storeId, { theme: { base_theme: themeId } });
      await publishCustomization(storeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customization", storeId] });
      queryClient.invalidateQueries({ queryKey: ["store-themes", storeId] });
      toast.success(isRTL ? "تم تغيير ونشر الثيم" : "Theme switched & published");
      setSwitchTarget(null);
    },
    onError: (err) => showError(err),
  });

  // ─── External theme submission ───────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!githubUrl.trim()) throw new Error("GitHub URL is required");
      return submitExternalTheme(storeId, githubUrl.trim());
    },
    onSuccess: (data) => {
      setActiveBuildId(data.build_id);
      setBuildStatus(data.status);
      setBuildError(null);
      toast.success(isRTL ? "بدأ بناء الثيم" : "Theme build started");
    },
    onError: (err) => {
      showError(err);
      setBuildError(err instanceof Error ? err.message : "Build failed");
    },
  });

  // Poll build status while building
  useEffect(() => {
    if (!activeBuildId || !storeId) return;
    if (buildStatus === "complete" || buildStatus === "failed") return;

    const interval = setInterval(async () => {
      try {
        const status = await fetchBuildStatus(storeId, activeBuildId);
        setBuildStatus(status.status);
        if (status.status === "complete") {
          clearInterval(interval);
          toast.success(isRTL ? "تم بناء الثيم بنجاح! 🎉" : "Theme built successfully! 🎉");
          queryClient.invalidateQueries({ queryKey: ["store-themes", storeId] });
          queryClient.invalidateQueries({ queryKey: ["customization", storeId] });
          // Close modal after a short delay
          setTimeout(() => {
            setSubmitOpen(false);
            setGithubUrl("");
            setActiveBuildId(null);
            setBuildStatus(null);
          }, 2000);
        } else if (status.status === "failed") {
          clearInterval(interval);
          setBuildError(status.error || "Build failed");
          toast.error(isRTL ? "فشل بناء الثيم" : "Theme build failed");
        }
      } catch (e) {
        // Continue polling on transient errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeBuildId, storeId, buildStatus, isRTL, queryClient]);

  // Remove external theme
  
  const [rebuildBranch, setRebuildBranch] = useState("main");
  const validateThemeMutation = useMutation({
    mutationFn: () => validateExternalTheme(storeId),
    onSuccess: (res) => {
      if(res.data) {
        let msg = res.data.valid ? "Theme is valid!\n" : "Theme has errors.\n";
        res.data.errors.forEach((e) => msg += `- Error: ${e.message}\n`);
        res.data.warnings.forEach((w) => msg += `- Warning: ${w.message}\n`);
        toast[res.data.valid ? "success" : "error"](res.data.valid ? "Validation Passed" : "Validation Failed", { description: msg });
      }
    },
    onError: (err: Error) => toast.error("Validation Error", { description: err.message || "Failed validate." })
  });

  const rebuildThemeMutation = useMutation({
    mutationFn: () => rebuildExternalTheme(storeId, rebuildBranch),
    onSuccess: (res) => {
      toast.success("Rebuild Started", { description: res.data.message || "Task queued." });
      setPollBuildId(res.data.task_id || null);
    },
    onError: (err: Error) => toast.error("Rebuild Error", { description: err.message || "Failed queue." })
  });

  const removeExternalMutation = useMutation({
    mutationFn: () => removeExternalTheme(storeId, "modern"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-themes", storeId] });
      queryClient.invalidateQueries({ queryKey: ["customization", storeId] });
      toast.success(isRTL ? "تم إزالة الثيم الخارجي" : "External theme removed");
    },
    onError: (err) => showError(err),
  });

  // Connect local dev server (numu-theme dev)
  const connectDevMutation = useMutation({
    mutationFn: async () => {
      if (!devUrl.trim()) throw new Error("Dev URL is required");
      return connectDevServer(storeId, devUrl.trim());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["store-themes", storeId] });
      queryClient.invalidateQueries({ queryKey: ["customization", storeId] });
      toast.success(
        isRTL
          ? `تم الاتصال بـ ${data.theme_id} 🎉`
          : `Connected to ${data.theme_id} 🎉`,
      );
      setDevOpen(false);
      setDevError(null);
    },
    onError: (err) => {
      showError(err);
      setDevError(err instanceof Error ? err.message : "Failed to connect");
    },
  });

  // Merge built-in themes with the store's external theme (if any)
  const externalThemeFromStore = storeThemes?.themes?.find((t) => t.is_external);
  const themes: AvailableTheme[] = [
    ...builtinThemes,
    ...(externalThemeFromStore
      ? [
          {
            id: externalThemeFromStore.id,
            name: externalThemeFromStore.name,
            nameAr: externalThemeFromStore.nameAr,
            layout: externalThemeFromStore.layout as AvailableTheme["layout"],
            description: externalThemeFromStore.description,
          },
        ]
      : []),
  ];

  const activeThemeId = customization?.theme?.base_theme ?? themes[0]?.id;
  // Resolve in three steps so a configured base_theme that isn't in the
  // built-in catalog (e.g. legacy "souq", a deprecated slug, or any value
  // the editor accepts but the storefront/themes endpoint doesn't list)
  // still surfaces as the active theme — synthesize a minimal entry from
  // the id rather than dropping to the "No active theme" empty state.
  const catalogMatch = themes.find((t) => t.id === activeThemeId);
  const activeTheme: AvailableTheme | undefined =
    catalogMatch
    ?? (activeThemeId
      ? ({
          id: activeThemeId,
          name: LAYOUT_LABELS[activeThemeId]?.en
            ?? activeThemeId.charAt(0).toUpperCase() + activeThemeId.slice(1),
          nameAr: LAYOUT_LABELS[activeThemeId]?.ar ?? activeThemeId,
          description: "",
        } as AvailableTheme)
      : themes[0]);
  const libraryThemes = themes
    .filter((t) => t.id !== activeThemeId)
    .sort((a, b) => (a.display_order ?? 100) - (b.display_order ?? 100));
  const isLoading = themesLoading || custLoading;
  const isExternalActive = externalThemeFromStore?.id === activeThemeId;

  // Apply toolbar filters. Search runs against both EN and AR names so the
  // input works regardless of the merchant's locale.
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredLibrary = libraryThemes.filter((t) => {
    const matchesQuery =
      !normalizedQuery ||
      t.name.toLowerCase().includes(normalizedQuery) ||
      t.nameAr.toLowerCase().includes(normalizedQuery);
    const tier = (t.required_plan ?? "free") as Tier;
    const matchesTier = tierFilter === "all" || tier === tierFilter;
    return matchesQuery && matchesTier;
  });

  const tierFilters: { value: "all" | Tier; labelEn: string; labelAr: string }[] = [
    { value: "all",        labelEn: "All",        labelAr: "الكل" },
    { value: "free",       labelEn: "Free",       labelAr: "مجاني" },
    { value: "starter",    labelEn: "Starter",    labelAr: "ستارتر" },
    { value: "pro",        labelEn: "Pro",        labelAr: "برو" },
    { value: "enterprise", labelEn: "Enterprise", labelAr: "إنتربرايز" },
  ];

  return (
    <div className="space-y-10 max-w-6xl mx-auto pb-12">
      {/* ─── Page header ─────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70 mb-2 flex items-center gap-2">
            <Palette className="h-3 w-3" />
            {isRTL ? "متجرك الإلكتروني" : "Online store"}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {isRTL ? "الثيمات" : "Themes"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
            {isRTL
              ? "اختر مظهر متجرك. عاين أي ثيم بشكل مباشر قبل تفعيله، وخصّص الألوان والخطوط والقسمات لتطابق هويتك."
              : "Pick how your storefront looks. Preview any theme live before activating, then customize colors, fonts, and sections to match your brand."}
          </p>
        </div>
        {storeUrl && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.open(storeUrl, "_blank")}
          >
            <Eye className="h-3.5 w-3.5" />
            {isRTL ? "عرض المتجر" : "View live store"}
            <ArrowUpRight className="h-3 w-3 opacity-50" />
          </Button>
        )}
      </div>

      {/* ─── Active theme hero ───────────────────────────────────────── */}
      <section>
        {isLoading ? (
          <Skeleton className="h-72 sm:h-80 w-full rounded-3xl" />
        ) : activeTheme ? (
          <ActiveThemeHero
            theme={activeTheme}
            customization={customization}
            isRTL={isRTL}
            onCustomize={(version) =>
              navigate(
                version === "v3"
                  ? "/online-store/themes/editor-v3"
                  : "/online-store/themes/editor",
              )
            }
            onPreview={() => setPreviewTheme(activeTheme)}
          />
        ) : (
          <div className="rounded-3xl border-2 border-dashed p-16 text-center">
            <Layers className="mx-auto h-10 w-10 text-muted-foreground/25 mb-3" />
            <p className="text-sm text-muted-foreground">
              {isRTL ? "لا يوجد ثيم نشط" : "No active theme"}
            </p>
          </div>
        )}
      </section>

      {/* ─── Library: heading + toolbar + grid ───────────────────────── */}
      {(isLoading || libraryThemes.length > 0) && (
        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                {isRTL ? "تصفّح الثيمات" : "Browse themes"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL
                  ? `${libraryThemes.length} ثيم متاح`
                  : `${libraryThemes.length} themes available`}
              </p>
            </div>
            {filteredLibrary.length !== libraryThemes.length ? (
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? `يعرض ${filteredLibrary.length} من ${libraryThemes.length}`
                  : `Showing ${filteredLibrary.length} of ${libraryThemes.length}`}
              </p>
            ) : null}
          </div>

          {/* Toolbar — search + tier chips */}
          <div className="rounded-2xl border bg-muted/30 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none ${isRTL ? "right-3" : "left-3"}`} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isRTL ? "ابحث عن ثيم…" : "Search themes…"}
                className={`bg-background h-9 ${isRTL ? "pr-9" : "pl-9"}`}
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {tierFilters.map((f) => {
                const isActive = tierFilter === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setTierFilter(f.value)}
                    className={`h-8 px-3 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-foreground text-background"
                        : "bg-background border border-border/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isRTL ? f.labelAr : f.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
              ))}
            </div>
          ) : filteredLibrary.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed p-12 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground/25 mb-3" />
              <p className="text-sm font-medium">
                {isRTL ? "لا توجد ثيمات مطابقة" : "No themes match your filters"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL
                  ? "جرّب تعديل البحث أو إزالة المرشحات"
                  : "Try a different search term or clear the filters"}
              </p>
              {(searchQuery || tierFilter !== "all") ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setSearchQuery("");
                    setTierFilter("all");
                  }}
                >
                  {isRTL ? "مسح المرشحات" : "Clear filters"}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredLibrary.map((theme) => {
                const requiredPlan = theme.required_plan as Tier | undefined;
                const locked = !canUnlockTheme(merchantPlan, requiredPlan);
                return (
                  <LibraryThemeCard
                    key={theme.id}
                    theme={theme}
                    isRTL={isRTL}
                    isSwitching={switchMutation.isPending && switchTarget?.id === theme.id}
                    locked={locked}
                    requiredPlan={requiredPlan}
                    onActivate={() => setSwitchTarget(theme)}
                    onCustomize={() => navigate(`/online-store/themes/editor?theme=${theme.id}`)}
                    onPreview={() => setPreviewTheme(theme)}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Wave 6 — V3 Marketplace catalog. Lives between the V2 grid
          and the BYOT footer so merchants discover the V3 themes
          without having to choose a tab. The catalog auto-hides when
          empty (until devs publish), so it doesn't add clutter on a
          first-day install. The Marketplace handles install + activate
          itself; on activation it routes to the V3 customizer. */}
      <section className="pt-4 border-t border-border/60">
        <MarketplaceCatalog
          onActivated={() => navigate("/online-store/themes/editor-v3")}
        />
      </section>

      {/* External theme (BYOT) section — quieter footer treatment, separated
          by a divider from the main library so it reads as "advanced" and
          doesn't compete with the curated themes above. Auto-expanded when
          an external theme is installed (so the merchant can manage it),
          collapsed by default otherwise (most merchants never need this). */}
      <details
        className="group/byot pt-2 border-t border-border/60"
        open={!!externalThemeFromStore}
      >
        <summary className="cursor-pointer list-none py-4 flex items-center justify-between gap-4 group-open/byot:mb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-transform group-open/byot:rotate-180">
              <ArrowUpRight className="h-4 w-4 -rotate-45" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {isRTL ? "الثيمات المخصصة (BYOT)" : "Custom themes (BYOT)"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? "اربط مستودع GitHub أو خادم تطوير محلي لتشغيل ثيم خاص بك"
                  : "Connect a GitHub repo or local dev server to run a custom theme"}
              </p>
            </div>
          </div>
          {externalThemeFromStore && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={(e) => {
                e.preventDefault();
                removeExternalMutation.mutate();
              }}
              disabled={removeExternalMutation.isPending}
            >
              {removeExternalMutation.isPending ? (
                <Loader2 className="h-3 w-3 me-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3 me-1.5" />
              )}
              {isRTL ? "إزالة" : "Remove"}
            </Button>
          )}
        </summary>
        <div className="space-y-3 pb-2">

        {externalThemeFromStore ? (
          <div className="relative overflow-hidden rounded-2xl border bg-card p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold">
                    {isRTL ? externalThemeFromStore.nameAr : externalThemeFromStore.name}
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {isRTL ? "خارجي" : "External"}
                  </Badge>
                  {externalThemeFromStore.mode === "dev" && (
                    <Badge className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/20">
                      {isRTL ? "وضع التطوير" : "Dev mode"}
                    </Badge>
                  )}
                  {isExternalActive && (
                    <Badge className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                      {isRTL ? "نشط" : "Active"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {externalThemeFromStore.description}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  {externalThemeFromStore.version && (
                    <span className="text-[10px] text-muted-foreground">
                      v{externalThemeFromStore.version}
                    </span>
                  )}
                  {externalThemeFromStore.source_repo && (
                    <a
                      href={externalThemeFromStore.source_repo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Github className="h-3 w-3" />
                      {isRTL ? "المصدر" : "Source"}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {!isExternalActive && (
                  <Button
                    size="sm"
                    onClick={() => { if (requireTrial("publish_store")) switchMutation.mutate(externalThemeFromStore.id); }}
                    disabled={switchMutation.isPending}
                  >
                    {switchMutation.isPending && (
                      <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
                    )}
                    {isRTL ? "تفعيل" : "Activate"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/online-store/themes/editor-v3")}
                >
                  <Pencil className="h-3.5 w-3.5 me-1.5" />
                  {isRTL ? "تخصيص" : "Customize"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {/* Production: GitHub repo → build pipeline → CDN */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed bg-gradient-to-br from-primary/5 via-background to-primary/3 p-5">
              <div className="flex flex-col gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                  <Github className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {isRTL ? "إنتاج (من GitHub)" : "Production (from GitHub)"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isRTL
                      ? "اربط مستودع GitHub — سنبنيه ونرفعه على CDN تلقائيًا"
                      : "Connect a GitHub repo — we'll build & deploy it to the CDN"}
                  </p>
                </div>
                <Button size="sm" className="w-full" onClick={() => setSubmitOpen(true)}>
                  <Github className="h-3.5 w-3.5 me-1.5" />
                  {isRTL ? "إضافة من GitHub" : "Add from GitHub"}
                </Button>
              </div>
            </div>

            {/* Dev: Local dev server (numu-theme dev) */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed bg-gradient-to-br from-amber-500/5 via-background to-amber-500/3 p-5">
              <div className="flex flex-col gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
                  <Sparkles className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {isRTL ? "تطوير (محلي)" : "Dev (local server)"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isRTL
                      ? "شغّل numu-theme dev في مجلد ثيمك واربط الـURL هنا"
                      : "Run `numu-theme dev` in your theme repo and paste the URL here"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-amber-500/30 hover:bg-amber-500/10"
                  onClick={() => setDevOpen(true)}
                >
                  <Sparkles className="h-3.5 w-3.5 me-1.5" />
                  {isRTL ? "اربط خادم التطوير" : "Connect dev server"}
                </Button>
              </div>
            </div>
          </div>
        )}
        </div>
      </details>

      {/* Switch confirmation */}
      <Dialog open={!!switchTarget} onOpenChange={() => setSwitchTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{isRTL ? "تفعيل الثيم" : "Activate theme"}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? `سيصبح ثيم "${switchTarget?.nameAr ?? switchTarget?.name}" هو الثيم النشط في متجرك.`
                : `"${switchTarget?.name}" will become the active theme for your store.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwitchTarget(null)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
            <Button
              onClick={() => { if (switchTarget && requireTrial("publish_store")) switchMutation.mutate(switchTarget.id); }}
              disabled={switchMutation.isPending}
            >
              {switchMutation.isPending && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
              {isRTL ? "تفعيل" : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* External theme submission modal */}
      <Dialog
        open={submitOpen}
        onOpenChange={(open) => {
          if (!submitMutation.isPending && !activeBuildId) {
            setSubmitOpen(open);
            if (!open) {
              setGithubUrl("");
              setBuildError(null);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Github className="h-4 w-4" />
              {isRTL ? "إضافة ثيم خارجي" : "Add external theme"}
            </DialogTitle>
            <DialogDescription>
              {isRTL
                ? "أدخل رابط مستودع GitHub العام يحتوي على ثيم Prism."
                : "Enter the public GitHub URL of a Prism-compatible theme."}
            </DialogDescription>
          </DialogHeader>

          {/* Form */}
          {!activeBuildId && (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="github-url" className="text-xs">
                  {isRTL ? "رابط GitHub" : "GitHub URL"}
                </Label>
                <Input
                  id="github-url"
                  placeholder="https://github.com/user/my-numu-theme"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  disabled={submitMutation.isPending}
                  dir="ltr"
                />
              </div>
              {buildError && (
                <p className="text-xs text-destructive">{buildError}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                {isRTL
                  ? "يجب أن يحتوي المستودع على theme.json و settings_schema.json و styles.css و index.ts."
                  : "The repo must contain theme.json, settings_schema.json, styles.css, and index.ts."}
              </p>
            </div>
          )}

          {/* Build progress */}
          {activeBuildId && (
            <div className="py-4 space-y-3">
              <div className="flex items-center gap-3">
                {buildStatus === "complete" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : buildStatus === "failed" ? (
                  <Trash2 className="h-5 w-5 text-destructive" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {buildStatus === "queued" && (isRTL ? "في الانتظار..." : "Queued...")}
                    {buildStatus === "cloning" && (isRTL ? "جاري الاستنساخ..." : "Cloning repository...")}
                    {buildStatus === "validating" && (isRTL ? "جاري التحقق..." : "Validating contract...")}
                    {buildStatus === "building" && (isRTL ? "جاري البناء..." : "Building theme...")}
                    {buildStatus === "uploading" && (isRTL ? "جاري الرفع..." : "Uploading to CDN...")}
                    {buildStatus === "complete" && (isRTL ? "تم بنجاح! 🎉" : "Complete! 🎉")}
                    {buildStatus === "failed" && (isRTL ? "فشل البناء" : "Build failed")}
                  </p>
                  <p className="text-xs text-muted-foreground">Build ID: {activeBuildId.slice(0, 8)}</p>
                </div>
              </div>
              {buildError && (
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                  <p className="text-xs text-destructive break-words">{buildError}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {!activeBuildId ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setSubmitOpen(false)}
                  disabled={submitMutation.isPending}
                >
                  {isRTL ? "إلغاء" : "Cancel"}
                </Button>
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending || !githubUrl.trim()}
                >
                  {submitMutation.isPending && (
                    <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
                  )}
                  {isRTL ? "بناء الثيم" : "Build theme"}
                </Button>
              </>
            ) : buildStatus === "failed" ? (
              <Button
                variant="outline"
                onClick={() => {
                  setActiveBuildId(null);
                  setBuildStatus(null);
                  setBuildError(null);
                }}
              >
                {isRTL ? "حاول مرة أخرى" : "Try again"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect Dev Server modal */}
      <Dialog
        open={devOpen}
        onOpenChange={(open) => {
          if (!connectDevMutation.isPending) {
            setDevOpen(open);
            if (!open) setDevError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              {isRTL ? "اربط خادم التطوير" : "Connect Dev Server"}
            </DialogTitle>
            <DialogDescription>
              {isRTL
                ? "شغّل numu-theme dev في مجلد ثيمك ثم الصق الـURL الذي يظهر هنا."
                : "Run `numu-theme dev` in your theme folder and paste the URL it prints here."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dev-url" className="text-xs">
                {isRTL ? "رابط خادم التطوير" : "Dev server URL"}
              </Label>
              <Input
                id="dev-url"
                placeholder="http://localhost:5173"
                value={devUrl}
                onChange={(e) => setDevUrl(e.target.value)}
                disabled={connectDevMutation.isPending}
                dir="ltr"
              />
            </div>

            {devError && (
              <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                <p className="text-xs text-destructive break-words">{devError}</p>
              </div>
            )}

            {/* Quick instructions */}
            <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {isRTL ? "كيف تشغل الخادم؟" : "How to start the server"}
              </p>
              <pre className="text-[11px] font-mono text-muted-foreground bg-background/50 px-2 py-1.5 rounded overflow-x-auto" dir="ltr">
{`cd my-theme
npx numu-theme dev`}
              </pre>
              <p className="text-[10px] text-muted-foreground/80">
                {isRTL
                  ? "في وضع التطوير لا يتم تخزين الثيم مؤقتًا — التغييرات تظهر فور التحديث."
                  : "Dev mode disables caching — changes appear on refresh."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDevOpen(false)}
              disabled={connectDevMutation.isPending}
            >
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={() => connectDevMutation.mutate()}
              disabled={connectDevMutation.isPending || !devUrl.trim()}
            >
              {connectDevMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
              )}
              {isRTL ? "اتصل" : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Live theme preview — full-screen iframe with desktop/mobile toggle.
          Falls back to a "coming soon" panel when the theme has no demo
          deployed (theme.demo_url is null). Shared by ActiveThemeHero's
          dropdown Preview action and LibraryThemeCard's eye button. */}
      <ThemePreviewModal
        theme={previewTheme}
        isOpen={!!previewTheme}
        onClose={() => setPreviewTheme(null)}
        isRTL={isRTL}
      />
    </div>
  );
}

// ─── Active theme hero ────────────────────────────────────────────────────────
interface ActiveThemeHeroProps {
  theme: AvailableTheme;
  customization: CustomizationData | undefined;
  isRTL: boolean;
  /** Receives the editor flavor — V2 keeps the legacy single-page editor;
   *  V3 opens the new section/block customizer. The hero is the only
   *  call site that exposes V3 because V3 always edits the active theme;
   *  library cards still use the V2 `?theme=ID` workflow. */
  onCustomize: (version: "v2" | "v3") => void;
  onPreview: () => void;
}

/**
 * Hero treatment for the merchant's currently-active theme. Big screenshot
 * panel paired with theme metadata + primary CTAs. Replaces the prior
 * compact card layout — this is the page's anchor element so it earns the
 * vertical real estate.
 */
function ActiveThemeHero({ theme, customization, isRTL, onCustomize, onPreview }: ActiveThemeHeroProps) {
  const palette = THEME_PALETTES[theme.id] ?? THEME_PALETTES.default;
  const layoutLabel = LAYOUT_LABELS[theme.layout ?? ""]?.[isRTL ? "ar" : "en"] ?? theme.layout ?? "";
  const isPublished = customization?.is_published ?? false;
  const lastPublished = customization?.last_published_at;
  const swatches = customization?.theme
    ? [
        customization.theme.primary_color,
        customization.theme.secondary_color,
        customization.theme.accent_color,
        customization.theme.background_color,
      ].filter(Boolean)
    : [];

  return (
    <div className="relative rounded-3xl border bg-card overflow-hidden shadow-sm">
      <div className="grid lg:grid-cols-[3fr_2fr]">
        {/* Preview imagery */}
        <div
          className="relative aspect-[16/10] lg:aspect-auto lg:min-h-[420px] overflow-hidden"
          style={{ background: palette.bg }}
        >
          <ThemePreviewImage theme={theme} palette={palette} />
          {/* Active badge floating top-start */}
          <div className={`absolute top-4 ${isRTL ? "right-4" : "left-4"}`}>
            <Badge className="gap-1.5 bg-emerald-500/15 text-emerald-700 border-emerald-500/30 backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase">
                {isRTL ? "نشط" : "Active"}
              </span>
            </Badge>
          </div>
          {/* Subtle bottom gradient for legibility on light screenshots */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />
        </div>

        {/* Info + CTAs */}
        <div className="flex flex-col p-6 sm:p-8 gap-6">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70 mb-1.5">
                  {isRTL ? "الثيم النشط" : "Currently active"}
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
                  {isRTL ? theme.nameAr : theme.name}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {layoutLabel}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 px-0 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={onPreview}>
                    <Eye className="h-3.5 w-3.5 me-2" />
                    {isRTL ? "معاينة" : "Live preview"}
                    <ExternalLink className="h-3 w-3 ms-auto opacity-40" />
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onCustomize("v2")}>
                    <Copy className="h-3.5 w-3.5 me-2" />
                    {isRTL ? "نسخ" : "Duplicate"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {theme.description ? (
              <p className="text-sm text-muted-foreground line-clamp-3">
                {theme.description}
              </p>
            ) : null}

            {/* Status chip */}
            <div className="pt-1">
              {isPublished ? (
                <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="text-[11px]">
                    {isRTL ? "منشور" : "Published"}
                    {lastPublished
                      ? ` · ${new Date(lastPublished).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { month: "short", day: "numeric" })}`
                      : ""}
                  </span>
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1.5 border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400">
                  <Clock className="h-3 w-3" />
                  <span className="text-[11px]">
                    {isRTL ? "مسودة غير منشورة" : "Unpublished draft"}
                  </span>
                </Badge>
              )}
            </div>

            {/* Color swatches */}
            {swatches.length > 0 ? (
              <div className="pt-3 border-t border-border/50">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 mb-2">
                  {isRTL ? "لوحة الألوان" : "Palette"}
                </p>
                <div className="flex items-center gap-2">
                  {swatches.map((color, i) => (
                    <div
                      key={i}
                      className="h-7 w-7 rounded-full border border-black/10 shadow-sm"
                      style={{ background: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-auto flex flex-col sm:flex-row gap-2">
            {/* Customize is a split: classic V2 stays the primary entry point,
                V3 (sections/blocks) is a single click away in the menu. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="flex-1 gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />
                  {isRTL ? "تخصيص الثيم" : "Customize"}
                  <ChevronDown className="h-3.5 w-3.5 ms-auto opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuItem onClick={() => onCustomize("v2")}>
                  <Pencil className="h-3.5 w-3.5 me-2" />
                  <div className="flex flex-col">
                    <span>{isRTL ? "المحرر الكلاسيكي" : "Classic editor"}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {isRTL ? "تخصيص شامل لصفحة واحدة" : "Single-page customization"}
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCustomize("v3")}>
                  <Sparkles className="h-3.5 w-3.5 me-2" />
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1.5">
                      {isRTL ? "المحرر الجديد" : "New editor"}
                      <Badge variant="secondary" className="h-4 text-[9px] px-1">
                        Beta
                      </Badge>
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {isRTL ? "أقسام وكتل بمعاينة مباشرة" : "Sections & blocks with live preview"}
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" className="gap-1.5" onClick={onPreview}>
              <Eye className="h-3.5 w-3.5" />
              {isRTL ? "معاينة مباشرة" : "Live preview"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Library theme card ───────────────────────────────────────────────────────
interface LibraryThemeCardProps {
  theme: AvailableTheme;
  isRTL: boolean;
  isSwitching: boolean;
  /** Merchant's plan tier doesn't meet the theme's required_plan. */
  locked: boolean;
  /** Required plan tier — surfaces in the lock badge / upgrade CTA copy. */
  requiredPlan: Tier | undefined;
  onActivate: () => void;
  onCustomize: () => void;
  /** Open the live-preview modal. Available regardless of lock state — locked
   *  themes are still previewable so the merchant sees what they'd unlock. */
  onPreview: () => void;
}

function LibraryThemeCard({
  theme,
  isRTL,
  isSwitching,
  locked,
  requiredPlan,
  onActivate,
  onCustomize,
  onPreview,
}: LibraryThemeCardProps) {
  const palette = THEME_PALETTES[theme.id] ?? THEME_PALETTES.default;
  const layoutLabel = LAYOUT_LABELS[theme.layout ?? ""]?.[isRTL ? "ar" : "en"] ?? theme.layout ?? "";
  const tier = (theme.required_plan ?? "free") as Tier;
  const showTierChip = tier !== "free";
  // Tier-tinted accent on the chip — keeps the visual hierarchy at a glance.
  const tierChipClass =
    tier === "enterprise"
      ? "bg-purple-500/10 text-purple-700 border-purple-500/20"
      : tier === "pro"
      ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
      : "bg-blue-500/10 text-blue-700 border-blue-500/20";

  return (
    <div className="group relative rounded-2xl border bg-card overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 ease-out">
      {/* Preview — 4:3 ratio gives screenshots the room they need */}
      <div
        className="relative aspect-[4/3] overflow-hidden"
        style={{ background: palette.bg }}
      >
        <ThemePreviewImage theme={theme} palette={palette} />

        {/* Top-bar overlays (lock badge + tier chip) */}
        <div className={`absolute top-3 inset-x-3 flex items-center justify-between gap-2 z-10`}>
          {locked ? (
            <LockedThemeBadge requiredPlan={requiredPlan} isRTL={isRTL} />
          ) : (
            <span />
          )}
          {showTierChip && !locked ? (
            <Badge variant="outline" className={`${tierChipClass} text-[10px] font-semibold uppercase tracking-wider`}>
              {tier}
            </Badge>
          ) : null}
        </div>

        {/* Hover overlay with primary action + preview button */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/10 flex items-end justify-between p-4 gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {locked ? (
            <UpgradeCTAButton
              requiredPlan={requiredPlan}
              isRTL={isRTL}
              size="sm"
              className="h-9 text-xs font-medium shadow-lg flex-1 sm:flex-none"
            />
          ) : (
            <Button
              size="sm"
              className="h-9 text-xs font-medium shadow-lg flex-1 sm:flex-none gap-1.5"
              onClick={onActivate}
              disabled={isSwitching}
            >
              {isSwitching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {isRTL ? "تفعيل" : "Activate"}
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="h-9 px-3 text-xs gap-1.5 shadow-lg bg-white/90 hover:bg-white text-foreground border-0"
            onClick={onPreview}
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {isRTL ? "معاينة" : "Preview"}
            </span>
          </Button>
        </div>
      </div>

      {/* Info footer */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {isRTL ? theme.nameAr : theme.name}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {layoutLabel}
            </p>
          </div>
          {/* Color dots — three accent / bg / text dots */}
          <div className="flex gap-1 shrink-0 pt-0.5">
            {[palette.accent, palette.bg, palette.text].map((c, i) => (
              <div
                key={i}
                className="h-3 w-3 rounded-full border border-black/10"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        {theme.description ? (
          <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
            {theme.description}
          </p>
        ) : null}

        {/* Mobile fallback row — hover overlay is invisible on touch */}
        <div className="flex gap-2 sm:hidden">
          {locked ? (
            <UpgradeCTAButton
              requiredPlan={requiredPlan}
              isRTL={isRTL}
              size="sm"
              className="flex-1 h-8 text-xs"
            />
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs gap-1.5"
              onClick={onActivate}
              disabled={isSwitching}
            >
              {isSwitching && <Loader2 className="h-3 w-3 animate-spin" />}
              {isRTL ? "تفعيل" : "Activate"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 px-0"
            onClick={onPreview}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
