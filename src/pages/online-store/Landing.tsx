import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  fetchThemes, fetchCustomization, type AvailableTheme,
} from "@/services/themeApi";
import { listPages, type StorePage } from "@/services/pagesApi";
import { browseMarketplace, type CatalogTheme } from "@/services/marketplaceApi";
import {
  getStorefrontPassword, updateStorefrontPassword,
} from "@/services/storeAccessApi";
import { showError } from "@/lib/show-error";
import { getStoreUrl } from "@/lib/storefront";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  ExternalLink, PaintRoller, Plus, FileText, ChevronRight,
  Loader2, Globe, Pencil, Monitor, Smartphone, Copy, Check,
  MoreHorizontal, Eye, Sparkles, Code2, ChevronDown,
  CheckCircle2, Clock, Layers, FileEdit, Rocket,
  Store, Star, Download, Tag, Lock, Unlock,
} from "lucide-react";

/* Souq Online Store landing — single command-center overview that
   aggregates everything the merchant needs to manage their storefront,
   modeled on Shopify's "Online Store" home but pushed further:

   1. Store-status banner (live/draft + domain + copy/visit)
   2. Live-theme hero with a real device preview (desktop + mobile iframe
      of the actual storefront), theme metadata, palette, and a full
      actions menu (preview / customize V2+V3 / duplicate / edit code)
   3. Quick-setup action strip (next best steps)
   4. Pages list (Home / About / Shipping / Contact)
   5. AI "generate a custom storefront" prompt
   6. Themes gallery with hover actions + per-theme menu

   Replaces the bare `/online-store → /themes` redirect with a real
   landing. */

/* Per-theme palette — mirrors the THEME_PALETTES map on the Themes
   page so each theme's fallback tile gets a unique colored gradient
   instead of every card looking identical. Unknown theme IDs fall
   through to a neutral slate gradient. */
const THEME_PALETTES: Record<string, { bg: string; accent: string }> = {
  modern:                    { bg: "#f8fafc", accent: "#6366f1" },
  boutique:                  { bg: "#fdf8f3", accent: "#c4956a" },
  elegant:                   { bg: "#0f1117", accent: "#c9a96e" },
  skeuomorphic:              { bg: "#e8e0d8", accent: "#8b6f52" },
  "neo-brutalism":           { bg: "#f5f500", accent: "#000000" },
  "tech-wave":               { bg: "#0a0e1a", accent: "#00f0ff" },
  editorial:                 { bg: "#f5f5f0", accent: "#1a3a2a" },
  "luxury-minimal":          { bg: "#fafaf8", accent: "#8a7e6b" },
  empire:                    { bg: "#fafafa", accent: "#1a1a1a" },
  "kick-game":               { bg: "#f5f0e8", accent: "#c8a87c" },
  street:                    { bg: "#1a1a2e", accent: "#ffd600" },
  rabbitsocks:               { bg: "#f9f9f7", accent: "#001f3f" },
  "gilded-glamour-boutique": { bg: "#faf9f5", accent: "#b8960c" },
  bazar:                     { bg: "#fffbe6", accent: "#f5a623" },
  vionne:                    { bg: "#ffffff", accent: "#050505" },
  "saw-saw":                 { bg: "#faf8f4", accent: "#675f30" },
  default:                   { bg: "#f1f5f9", accent: "#3b82f6" },
};
const paletteFor = (themeId?: string) =>
  (themeId && THEME_PALETTES[themeId]) || THEME_PALETTES.default;

/* Real theme preview thumbnail — uses `preview_image_url` from the
   theme catalog when present. If that 404s / fails, swap to a
   per-theme gradient (matching the dedicated /online-store/themes
   page's fallback) so each tile reads distinct instead of all
   showing the same generic mock. */
const ThemeThumb = ({
  themeId,
  imageUrl,
}: { themeId?: string; imageUrl?: string }) => {
  const [failed, setFailed] = useState(false);
  const showImage = !!imageUrl && !failed;
  const palette = paletteFor(themeId);
  if (showImage) {
    return (
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover object-top"
      />
    );
  }
  return (
    <div
      className="w-full h-full"
      style={{
        background: `linear-gradient(135deg, ${palette.bg}, ${palette.accent}33)`,
      }}
    />
  );
};

/* Live device preview — renders the *actual* storefront inside a browser
   (desktop) or phone (mobile) chrome via an iframe. The theme screenshot /
   gradient sits behind the iframe so a blocked/empty frame still reads as
   an intentional preview rather than a white void. Clicking the overlay
   opens the real store in a new tab. */
const DevicePreview = ({
  mode,
  storeUrl,
  host,
  themeId,
  imageUrl,
  isRTL,
}: {
  mode: "desktop" | "mobile";
  storeUrl: string | null;
  host: string | null;
  themeId?: string;
  imageUrl?: string;
  isRTL: boolean;
}) => {
  // Spinner shows until the frame's first load event. The screenshot/
  // gradient underlay stays put underneath the whole time, so a frame
  // that's blocked by X-Frame-Options never collapses to a white void —
  // it just keeps the screenshot.
  const [loaded, setLoaded] = useState(false);

  const Frame = (
    <div
      className={
        mode === "mobile"
          ? "relative w-[230px] mx-auto rounded-[2rem] border-[6px] shadow-2xl overflow-hidden"
          : "relative w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden"
      }
      style={mode === "mobile" ? { borderColor: "hsl(var(--navy))", background: "hsl(var(--navy))" } : undefined}
    >
      {/* Chrome bar */}
      {mode === "desktop" ? (
        <div className="flex items-center gap-2 px-3 h-8 border-b border-border bg-surface-2">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          </span>
          <span dir="ltr" className="flex-1 mx-2 h-6 rounded-md bg-card border border-border flex items-center px-2.5 gap-1.5 text-[11px] leading-none text-muted-foreground font-mono ltr-nums overflow-hidden">
            <Globe className="h-3 w-3 shrink-0" strokeWidth={2.2} />
            <span className="truncate">{host ?? "—"}</span>
          </span>
        </div>
      ) : (
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-20 h-1 w-12 rounded-full bg-white/40" />
      )}

      {/* Preview surface — screenshot/gradient underlay + live iframe on top */}
      <div
        className={
          mode === "mobile"
            ? "relative aspect-[9/16] bg-surface-2 overflow-hidden"
            : "relative aspect-[16/9] bg-surface-2 overflow-hidden"
        }
      >
        <div className="absolute inset-0">
          <ThemeThumb themeId={themeId} imageUrl={imageUrl} />
        </div>
        {storeUrl && (
          <iframe
            src={storeUrl}
            title="Storefront preview"
            loading="lazy"
            scrolling="no"
            onLoad={() => setLoaded(true)}
            className={`absolute inset-0 border-0 pointer-events-none bg-white transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
            style={
              mode === "mobile"
                ? { width: "375px", height: "667px", transform: "scale(0.586)", transformOrigin: "top left" }
                : { width: "200%", height: "200%", transform: "scale(0.5)", transformOrigin: "top left" }
            }
          />
        )}
        {/* Loading shimmer while the frame fetches */}
        {storeUrl && !loaded && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center bg-surface-2/50 backdrop-blur-[1px]">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {storeUrl && (
          <button
            type="button"
            onClick={() => window.open(storeUrl, "_blank")}
            className="absolute inset-0 z-10 flex items-end justify-center pb-4 opacity-0 hover:opacity-100 bg-gradient-to-t from-black/45 to-transparent transition-opacity"
            aria-label={isRTL ? "افتح المتجر" : "Open store"}
          >
            <span className="souq-pill bg-white text-navy shadow-lg">
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.4} />
              {isRTL ? "افتح المتجر" : "Open store"}
            </span>
          </button>
        )}
      </div>
    </div>
  );

  return Frame;
};

const OnlineStoreLanding = () => {
  const { isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const navigate = useNavigate();
  const storeId = currentStore?.id;
  const storeUrl = currentStore?.subdomain ? getStoreUrl(currentStore.subdomain) : null;
  // Env-aware display host — strip protocol + trailing slash off the
  // configured storefront URL (VITE_STOREFRONT_URL) so dev/test/staging
  // each show their real domain instead of a hardcoded `.numueg.app`.
  const storeHost = storeUrl
    ? storeUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")
    : null;

  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  // Storefront password gate (pre-launch lock). Reads/writes
  // settings.password_protected via the backend; the Next.js storefront
  // enforces it. Local dialog state mirrors the saved status.
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwEnabled, setPwEnabled] = useState(false);
  const [pwValue, setPwValue] = useState("");
  const passwordQuery = useQuery({
    queryKey: ["storefront-password", storeId],
    queryFn: () => getStorefrontPassword(storeId!),
    enabled: !!storeId,
    staleTime: 60 * 1000,
  });
  const passwordStatus = passwordQuery.data;
  const openPasswordDialog = () => {
    setPwEnabled(passwordStatus?.enabled ?? false);
    setPwValue("");
    setPwDialogOpen(true);
  };
  const passwordMutation = useMutation({
    mutationFn: (body: { enabled: boolean; password?: string }) =>
      updateStorefrontPassword(storeId!, body),
    onSuccess: (data) => {
      queryClient.setQueryData(["storefront-password", storeId], data);
      toast.success(
        data.enabled
          ? (isRTL ? "تم تفعيل حماية المتجر بكلمة مرور" : "Store is password-protected")
          : (isRTL ? "تم إيقاف حماية كلمة المرور" : "Password protection turned off"),
      );
      setPwDialogOpen(false);
    },
    onError: (e) => showError(e),
  });
  const savePassword = () => {
    const pw = pwValue.trim();
    passwordMutation.mutate({ enabled: pwEnabled, ...(pw ? { password: pw } : {}) });
  };

  const themesQuery = useQuery({
    queryKey: ["themes-available"],
    queryFn: fetchThemes,
    staleTime: 5 * 60 * 1000,
  });
  const customizationQuery = useQuery({
    queryKey: ["customization", storeId],
    queryFn: () => fetchCustomization(storeId!),
    enabled: !!storeId,
    staleTime: 60 * 1000,
  });
  const themes: AvailableTheme[] = themesQuery.data ?? [];
  const customization = customizationQuery.data;
  const isPublished = customization?.is_published ?? false;
  const lastPublished = customization?.last_published_at;

  // Real content pages from the backend (same source as the Pages editor
  // at /online-store/pages). Shown read-only here as an overview — every
  // row deep-links into the editor for actual management.
  const pagesQuery = useQuery({
    queryKey: ["pages", storeId],
    queryFn: () => listPages(storeId!),
    enabled: !!storeId,
    staleTime: 60 * 1000,
  });
  const pages: StorePage[] = pagesQuery.data ?? [];
  const pageTitle = (p: StorePage) =>
    (isRTL && p.title?.ar ? p.title.ar : p.title?.en) || p.handle;

  // Marketplace catalog — real installable themes for the "Discover themes"
  // section. This is the public catalog (browse without a store), so the
  // section showcases what the merchant can add, not their own live theme.
  const marketplaceQuery = useQuery({
    queryKey: ["marketplace-catalog-landing"],
    queryFn: () => browseMarketplace({ page: 1, per_page: 6 }),
    staleTime: 5 * 60 * 1000,
  });
  const marketplaceThemes: CatalogTheme[] = marketplaceQuery.data?.themes ?? [];

  // Resolve the *actual* active theme from `customization.theme.base_theme`
  // (same source the Themes page uses) — picking themes[0] would just
  // show whichever theme happens to come first in the catalog, which
  // is wrong when the merchant has switched away from the default.
  const activeThemeId = customization?.theme?.base_theme;
  // Three-tier resolution: catalog match → catalog default → synthesized
  // entry from the merchant's own base_theme id. The last fallback matters
  // when the editor has been configured with a slug that the public
  // /storefront/themes catalog doesn't surface (legacy / deprecated /
  // BYOT), so the card still reads with the real theme name instead of
  // a hardcoded "Souq" placeholder.
  const catalogMatch = activeThemeId
    ? themes.find((t) => t.id === activeThemeId)
    : undefined;
  const liveTheme: AvailableTheme =
    catalogMatch
    || themes[0]
    || (activeThemeId
      ? ({
          id: activeThemeId,
          name: activeThemeId.charAt(0).toUpperCase() + activeThemeId.slice(1),
          description: "",
        } as AvailableTheme)
      : ({ id: "souq", name: "Souq", description: "" } as AvailableTheme));

  // Palette swatches from the live customization, for the hero meta row.
  const swatches = customization?.theme
    ? [
        customization.theme.primary_color,
        customization.theme.secondary_color,
        customization.theme.accent_color,
        customization.theme.background_color,
      ].filter(Boolean)
    : [];

  const copyLink = () => {
    if (!storeUrl) return;
    navigator.clipboard?.writeText(storeUrl).then(() => {
      setCopied(true);
      toast.success(isRTL ? "تم نسخ الرابط" : "Store link copied");
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const goEditorV3 = () => navigate("/online-store/themes/editor-v3");
  const goEditorV2 = () => navigate("/online-store/themes/editor");
  const goCodeEditor = () => navigate("/online-store/themes/code-editor");
  const goThemes = () => navigate("/online-store/themes");
  const goMarketplace = () => navigate("/online-store/themes?tab=marketplace");
  const goThemeDetail = (slug: string) =>
    navigate(`/online-store/themes/marketplace/${slug}`);

  // Quick-setup steps — the merchant's next-best actions. Each is a
  // shortcut into a deeper screen; ordered by typical onboarding flow.
  const quickActions = [
    {
      icon: PaintRoller,
      title: isRTL ? "خصّص الثيم" : "Customize theme",
      desc: isRTL ? "الألوان، الخطوط، الأقسام" : "Colors, fonts, sections",
      onClick: goEditorV3,
    },
    {
      icon: FileEdit,
      title: isRTL ? "حرّر الصفحات" : "Edit pages",
      desc: isRTL ? "الرئيسية، من نحن، الشحن" : "Home, about, shipping",
      onClick: () => navigate("/online-store/pages"),
    },
    {
      icon: Globe,
      title: isRTL ? "الدومين" : "Domain",
      desc: storeHost ?? (isRTL ? "اربط دومين" : "Connect a domain"),
      onClick: () => navigate("/online-store/preferences"),
    },
    {
      icon: Layers,
      title: isRTL ? "التنقّل" : "Navigation",
      desc: isRTL ? "القوائم والروابط" : "Menus & links",
      onClick: () => navigate("/online-store/navigation"),
    },
  ];

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* ─── Page head ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
            {isRTL ? "المتجر الإلكتروني" : "Online Store"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL ? "واجهة متجرك، الثيمات، والصفحات" : "Your storefront, themes, and pages"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {storeUrl && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => window.open(storeUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4" strokeWidth={2.2} />
              {isRTL ? "افتح المتجر" : "Visit store"}
            </Button>
          )}
          <Button
            variant="accent"
            size="sm"
            className="gap-1.5"
            onClick={goThemes}
          >
            <PaintRoller className="h-4 w-4" strokeWidth={2.2} />
            {isRTL ? "خصّص" : "Customize"}
          </Button>
        </div>
      </div>

      {/* ─── Store-status banner ───────────────────────────────── */}
      <div
        className={`rounded-2xl border px-4 py-3 flex items-center gap-3 flex-wrap ${
          isPublished
            ? "border-emerald-500/25 bg-emerald-500/[0.07]"
            : "border-amber-500/25 bg-amber-500/[0.07]"
        }`}
      >
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${
            isPublished ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"
          }`}
        >
          {isPublished ? <Rocket className="h-4 w-4" strokeWidth={2.2} /> : <Clock className="h-4 w-4" strokeWidth={2.2} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold">
            {isPublished
              ? (isRTL ? "متجرك مباشر على الإنترنت" : "Your store is live")
              : (isRTL ? "مسودة غير منشورة" : "Unpublished draft")}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <Globe className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
            <span className="font-mono ltr-nums truncate">{storeHost ?? "—"}</span>
            {lastPublished && (
              <span className="hidden sm:inline">
                · {isRTL ? "آخر نشر" : "published"}{" "}
                {new Date(lastPublished).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {storeUrl && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={copyLink}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.6} /> : <Copy className="h-3.5 w-3.5" strokeWidth={2.2} />}
              {copied ? (isRTL ? "تم النسخ" : "Copied") : (isRTL ? "انسخ الرابط" : "Copy link")}
            </Button>
          )}
        </div>
      </div>

      {/* ─── Live theme hero (device preview + meta) ───────────── */}
      <div className="grid gap-4 lg:[grid-template-columns:1.6fr_1fr]">
        {/* Device preview */}
        <Card>
          <CardContent className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="souq-eyebrow" style={{ color: "hsl(var(--terracotta))" }}>
                {isRTL ? "الثيم الحالي" : "Live theme"}
              </span>
              {/* Desktop / mobile toggle */}
              <div className="inline-flex items-center rounded-lg border border-border bg-surface-2 p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewMode("desktop")}
                  className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-semibold transition-colors ${
                    previewMode === "desktop" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                  }`}
                  aria-pressed={previewMode === "desktop"}
                >
                  <Monitor className="h-3.5 w-3.5" strokeWidth={2.2} />
                  <span className="hidden sm:inline">{isRTL ? "كمبيوتر" : "Desktop"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("mobile")}
                  className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-semibold transition-colors ${
                    previewMode === "mobile" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                  }`}
                  aria-pressed={previewMode === "mobile"}
                >
                  <Smartphone className="h-3.5 w-3.5" strokeWidth={2.2} />
                  <span className="hidden sm:inline">{isRTL ? "موبايل" : "Mobile"}</span>
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-surface-2/60 border border-border/60 p-4 sm:p-6 flex items-center justify-center min-h-[260px]">
              {customizationQuery.isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <DevicePreview
                  mode={previewMode}
                  storeUrl={storeUrl}
                  host={storeHost}
                  themeId={liveTheme.id}
                  imageUrl={liveTheme.preview_image_url}
                  isRTL={isRTL}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Theme meta + actions */}
        <Card>
          <CardContent className="p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[17px] font-extrabold truncate">{liveTheme.name}</span>
                  <span className="souq-pill bg-navy text-white shrink-0">{isRTL ? "الحالي" : "Live"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                  <Globe className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                  <span className="font-mono ltr-nums truncate">{storeHost ?? "—"}</span>
                </div>
              </div>
              {/* Theme actions menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4" strokeWidth={2.2} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-xs">{liveTheme.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {storeUrl && (
                    <DropdownMenuItem onClick={() => window.open(storeUrl, "_blank")}>
                      <Eye className="h-3.5 w-3.5 me-2" />
                      {isRTL ? "معاينة مباشرة" : "Live preview"}
                      <ExternalLink className="h-3 w-3 ms-auto opacity-40" />
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={goEditorV3}>
                    <Sparkles className="h-3.5 w-3.5 me-2" />
                    {isRTL ? "المحرر الجديد" : "New editor"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={goEditorV2}>
                    <Pencil className="h-3.5 w-3.5 me-2" />
                    {isRTL ? "المحرر الكلاسيكي" : "Classic editor"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={goCodeEditor}>
                    <Code2 className="h-3.5 w-3.5 me-2" />
                    {isRTL ? "تعديل الكود" : "Edit code"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Status chip */}
            <div>
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
                  <span className="text-[11px]">{isRTL ? "مسودة" : "Draft"}</span>
                </Badge>
              )}
            </div>

            {/* Theme description */}
            {liveTheme.description ? (
              <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3">
                {liveTheme.description}
              </p>
            ) : null}

            {/* Details — always present so the panel never reads empty */}
            <div className="rounded-xl border border-border/60 divide-y divide-border/60">
              <div className="flex items-center justify-between px-3 py-2 text-[12.5px]">
                <span className="text-muted-foreground">{isRTL ? "النطاق" : "Domain"}</span>
                <span className="font-mono ltr-nums truncate max-w-[60%] text-end">{storeHost ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 text-[12.5px]">
                <span className="text-muted-foreground">{isRTL ? "الحالة" : "Status"}</span>
                <span className={`font-semibold ${isPublished ? "text-emerald-600" : "text-amber-600"}`}>
                  {isPublished ? (isRTL ? "مباشر" : "Live") : (isRTL ? "مسودة" : "Draft")}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 text-[12.5px]">
                <span className="text-muted-foreground">{isRTL ? "الصفحات" : "Pages"}</span>
                <span className="font-semibold">{pages.length}</span>
              </div>
              {/* Storefront password gate */}
              <button
                type="button"
                onClick={openPasswordDialog}
                className="w-full flex items-center justify-between px-3 py-2 text-[12.5px] souq-hoverrow text-start"
              >
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  {passwordStatus?.enabled ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  {isRTL ? "حماية بكلمة مرور" : "Password"}
                </span>
                <span className={`font-semibold inline-flex items-center gap-1 ${passwordStatus?.enabled ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {passwordStatus?.enabled ? (isRTL ? "مُفعّلة" : "On") : (isRTL ? "متوقفة" : "Off")}
                  <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180 opacity-50" />
                </span>
              </button>
            </div>

            {/* Palette */}
            {swatches.length > 0 && (
              <div className="pt-0.5">
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
            )}

            {/* CTAs */}
            <div className="flex flex-col gap-2 pt-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="w-full gap-1.5">
                    <Pencil className="h-4 w-4" strokeWidth={2.2} />
                    {isRTL ? "تخصيص الثيم" : "Customize"}
                    <ChevronDown className="h-3.5 w-3.5 ms-auto opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56">
                  <DropdownMenuItem onClick={goEditorV3}>
                    <Sparkles className="h-3.5 w-3.5 me-2" />
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1.5">
                        {isRTL ? "المحرر الجديد" : "New editor"}
                        <Badge variant="secondary" className="h-4 text-[9px] px-1">Beta</Badge>
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {isRTL ? "أقسام وكتل بمعاينة مباشرة" : "Sections & blocks, live preview"}
                      </span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={goEditorV2}>
                    <Pencil className="h-3.5 w-3.5 me-2" />
                    <div className="flex flex-col">
                      <span>{isRTL ? "المحرر الكلاسيكي" : "Classic editor"}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {isRTL ? "تخصيص شامل لصفحة واحدة" : "Single-page customization"}
                      </span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" className="w-full gap-1.5" onClick={goThemes}>
                <Layers className="h-4 w-4" strokeWidth={2.2} />
                {isRTL ? "كل الثيمات" : "Browse themes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Quick-setup action strip ──────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((a) => (
          <button
            key={a.title}
            type="button"
            onClick={a.onClick}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-start hover:border-foreground/20 hover:bg-muted/40 transition-colors"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-muted text-foreground/80 group-hover:bg-navy group-hover:text-white transition-colors">
              <a.icon className="h-5 w-5" strokeWidth={1.9} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-bold truncate">{a.title}</span>
              <span className="block text-[11.5px] text-muted-foreground truncate">{a.desc}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 rtl:rotate-180 group-hover:translate-x-0.5 transition-transform" strokeWidth={2.2} />
          </button>
        ))}
      </div>

      {/* ─── Pages list ────────────────────────────────────────── */}
      <Card>
        <div className="souq-section-head px-5 pt-5 pb-2">
          <h2 className="text-[17px] font-bold tracking-tight">
            {isRTL ? "الصفحات" : "Pages"}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 rounded-lg gap-1"
            onClick={() => navigate("/online-store/pages")}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
            {isRTL ? "صفحة جديدة" : "Add page"}
          </Button>
        </div>
        <CardContent className="pt-0">
          {pagesQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : pages.length === 0 ? (
            <button
              type="button"
              onClick={() => navigate("/online-store/pages")}
              className="w-full flex flex-col items-center gap-2 py-8 text-center souq-hoverrow rounded-xl"
            >
              <FileText className="h-7 w-7 text-muted-foreground/40" strokeWidth={1.8} />
              <span className="text-sm font-semibold">
                {isRTL ? "لا توجد صفحات بعد" : "No pages yet"}
              </span>
              <span className="text-xs text-muted-foreground">
                {isRTL ? "أنشئ صفحات مثل «عن المتجر» و«تواصل معنا»" : "Create pages like About Us and Contact"}
              </span>
            </button>
          ) : (
            <div className="grid sm:grid-cols-2 gap-x-6">
              {pages.slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate("/online-store/pages")}
                  className="w-full flex items-center gap-3 py-3 border-t border-border/60 souq-hoverrow text-start rounded-lg px-2 -mx-2"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={2.2} />
                  <span className="flex-1 text-[13.5px] font-semibold truncate">
                    {pageTitle(p)}
                  </span>
                  <span
                    className={`souq-pill ${
                      p.is_published
                        ? "bg-emerald-500/14 text-emerald-700 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.is_published
                      ? (isRTL ? "منشور" : "Published")
                      : (isRTL ? "مسودة" : "Draft")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Discover themes (marketplace) ─────────────────────── */}
      <Card>
        <div className="souq-section-head px-5 pt-5 pb-2">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-terracotta" strokeWidth={2.2} />
            <h2 className="text-[17px] font-bold tracking-tight">
              {isRTL ? "اكتشف الثيمات" : "Discover themes"}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 rounded-lg gap-1"
            onClick={goMarketplace}
          >
            {isRTL ? "تصفّح السوق" : "Browse marketplace"}
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" strokeWidth={2.2} />
          </Button>
        </div>
        <CardContent>
          {(() => {
            const builtins = themes.filter((t) => t.id !== liveTheme.id).slice(0, 6);
            const loading = marketplaceQuery.isLoading || themesQuery.isLoading;
            if (loading) {
              return (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              );
            }
            // No marketplace themes AND no built-ins → invite to the marketplace.
            if (marketplaceThemes.length === 0 && builtins.length === 0) {
              return (
                <button
                  type="button"
                  onClick={goMarketplace}
                  className="w-full flex flex-col items-center gap-2 py-10 text-center souq-hoverrow rounded-xl"
                >
                  <Store className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.8} />
                  <span className="text-sm font-semibold">
                    {isRTL ? "تصفّح سوق الثيمات" : "Browse the theme marketplace"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {isRTL ? "ثيمات احترافية جاهزة للتركيب على متجرك" : "Professional themes ready to install on your store"}
                  </span>
                </button>
              );
            }
            // Built-in catalog fallback when the developer marketplace is empty.
            if (marketplaceThemes.length === 0) {
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {builtins.map((theme) => (
                    <button
                      type="button"
                      key={theme.id}
                      onClick={goThemes}
                      className="group flex flex-col gap-2.5 text-start"
                    >
                      <div className="relative rounded-xl overflow-hidden border border-border aspect-[16/10] bg-surface-2">
                        <ThemeThumb themeId={theme.id} imageUrl={theme.preview_image_url} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent flex items-end p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="souq-pill bg-white text-navy shadow-lg w-full justify-center">
                            <Eye className="h-3.5 w-3.5" strokeWidth={2.4} />
                            {isRTL ? "عرض الثيم" : "View theme"}
                          </span>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[14px] font-extrabold truncate">{theme.name}</div>
                        {theme.description ? (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{theme.description}</p>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              );
            }
            return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {marketplaceThemes.slice(0, 6).map((theme) => {
                const free = (theme.price_cents ?? 0) <= 0;
                const rating = theme.average_rating ?? theme.rating ?? 0;
                return (
                  <button
                    type="button"
                    key={theme.id}
                    onClick={() => goThemeDetail(theme.slug)}
                    className="group flex flex-col gap-2.5 text-start"
                  >
                    <div className="relative rounded-xl overflow-hidden border border-border aspect-[16/10] bg-surface-2">
                      <ThemeThumb themeId={theme.slug} imageUrl={theme.thumbnail_url ?? undefined} />
                      {/* price chip */}
                      <span className={`absolute top-2 ${isRTL ? "left-2" : "right-2"} souq-pill ${free ? "bg-emerald-500/90 text-white" : "bg-navy/90 text-white"} text-[11px] shadow`}>
                        {free ? <Tag className="h-3 w-3" /> : <Tag className="h-3 w-3" />}
                        {free ? (isRTL ? "مجاني" : "Free") : `${theme.currency} ${(theme.price_cents / 100).toLocaleString()}`}
                      </span>
                      {/* hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent flex items-end p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="souq-pill bg-white text-navy shadow-lg w-full justify-center">
                          <Eye className="h-3.5 w-3.5" strokeWidth={2.4} />
                          {isRTL ? "عرض الثيم" : "View theme"}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-extrabold truncate">{theme.name}</div>
                      {theme.short_description ? (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {theme.short_description}
                        </p>
                      ) : null}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                        {rating > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {rating.toFixed(1)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Download className="h-3 w-3" />
                          {(theme.install_count ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* ─── Storefront password dialog ────────────────────────── */}
      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              {isRTL ? "حماية المتجر بكلمة مرور" : "Password protect your store"}
            </DialogTitle>
            <DialogDescription>
              {isRTL
                ? "اطلب كلمة مرور من الزوار لعرض متجرك — مفيد قبل الإطلاق. لا يؤثر على لوحة التحكم."
                : "Require visitors to enter a password to view your storefront — useful before launch. Doesn't affect your dashboard."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold">
                  {isRTL ? "تفعيل الحماية" : "Restrict access"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isRTL ? "إظهار صفحة كلمة المرور للزوار" : "Show a password page to visitors"}
                </p>
              </div>
              <Switch checked={pwEnabled} onCheckedChange={setPwEnabled} />
            </div>

            {pwEnabled && (
              <div className="space-y-1.5">
                <Label htmlFor="store-password" className="text-xs">
                  {isRTL ? "كلمة المرور" : "Password"}
                </Label>
                <Input
                  id="store-password"
                  type="text"
                  value={pwValue}
                  onChange={(e) => setPwValue(e.target.value)}
                  placeholder={
                    passwordStatus?.has_password
                      ? (isRTL ? "•••••••• (بدون تغيير)" : "•••••••• (unchanged)")
                      : (isRTL ? "اكتب كلمة مرور" : "Enter a password")
                  }
                  dir="ltr"
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">
                  {passwordStatus?.has_password
                    ? (isRTL ? "اتركها فارغة للإبقاء على كلمة المرور الحالية." : "Leave blank to keep the current password.")
                    : (isRTL ? "سيحتاجها الزوار للدخول إلى متجرك." : "Shoppers will need this to enter your store.")}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialogOpen(false)}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={savePassword}
              disabled={
                passwordMutation.isPending ||
                (pwEnabled && !passwordStatus?.has_password && !pwValue.trim())
              }
              className="gap-1.5"
            >
              {passwordMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isRTL ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OnlineStoreLanding;
