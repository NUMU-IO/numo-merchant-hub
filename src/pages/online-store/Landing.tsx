import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  fetchThemes, fetchCustomization, type AvailableTheme,
} from "@/services/themeApi";
import { getStoreUrl } from "@/lib/storefront";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ExternalLink, PaintRoller, Plus, FileText, ChevronRight,
  Loader2, Globe, Pencil,
} from "lucide-react";

/* Souq Online Store landing — single overview that aggregates:
   1. Live theme card (current theme preview + domain + Customize CTA)
   2. Pages list (Home / About / Shipping / Contact)
   3. Themes gallery (other available themes with previews)
   Matches the NHUB spec's `OnlineStore` screen 1:1; replaces the
   bare `/online-store → /themes` redirect with a real landing. */

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

const OnlineStoreLanding = () => {
  const { isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const navigate = useNavigate();
  const storeId = currentStore?.id;
  const storeUrl = currentStore?.subdomain ? getStoreUrl(currentStore.subdomain) : null;

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

  // Pages: the merchant doesn't have a backend pages API yet, so show
  // the canonical storefront pages with sensible published-by-default
  // state. Clicking opens the Online Store → Pages editor.
  const pages = [
    { title: isRTL ? "الرئيسية" : "Home",                  published: true,  href: "/online-store/pages" },
    { title: isRTL ? "من نحن" : "About us",                published: true,  href: "/online-store/pages" },
    { title: isRTL ? "الشحن والاسترجاع" : "Shipping & returns", published: true, href: "/online-store/pages" },
    { title: isRTL ? "تواصل معنا" : "Contact",             published: false, href: "/online-store/pages" },
  ];

  // Resolve the *actual* active theme from `customization.theme.base_theme`
  // (same source the Themes page uses) — picking themes[0] would just
  // show whichever theme happens to come first in the catalog, which
  // is wrong when the merchant has switched away from the default.
  const activeThemeId = customizationQuery.data?.theme?.base_theme;
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
  const otherThemes = themes.filter((t) => t.id !== liveTheme.id);

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
            onClick={() => navigate("/online-store/themes")}
          >
            <PaintRoller className="h-4 w-4" strokeWidth={2.2} />
            {isRTL ? "خصّص" : "Customize"}
          </Button>
        </div>
      </div>

      {/* ─── Live theme card + pages list ───────────────────────── */}
      <div className="grid gap-4 lg:[grid-template-columns:1.5fr_1fr]">
        {/* Live theme — preview + domain + Customize */}
        <Card>
          <CardContent className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="souq-eyebrow text-ink-faint" style={{ color: "hsl(var(--ink-faint))" }}>
                {isRTL ? "الثيم الحالي" : "Live theme"}
              </span>
              <span className="souq-pill bg-emerald-500/14 text-emerald-700 dark:text-emerald-400">
                <span className="dot" />
                {isRTL ? "منشور" : "Published"}
              </span>
            </div>
            <div className="rounded-xl overflow-hidden border border-border aspect-[16/7] bg-surface-2">
              <ThemeThumb
                themeId={liveTheme.id}
                imageUrl={liveTheme.preview_image_url}
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-extrabold">{liveTheme.name}</div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Globe className="h-3.5 w-3.5" strokeWidth={2.2} />
                  <span className="font-mono ltr-nums truncate">
                    {currentStore?.subdomain
                      ? `${currentStore.subdomain}.numueg.app`
                      : "—"}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => navigate("/online-store/themes")}
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
                {isRTL ? "تعديل" : "Customize"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pages list */}
        <Card>
          <div className="souq-section-head px-5 pt-5 pb-2">
            <h2 className="text-[17px] font-bold tracking-tight">
              {isRTL ? "الصفحات" : "Pages"}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate("/online-store/pages")}
              aria-label={isRTL ? "صفحة جديدة" : "New page"}
            >
              <Plus className="h-4 w-4" strokeWidth={2.4} />
            </Button>
          </div>
          <CardContent className="pt-0">
            {pages.map((p) => (
              <button
                key={p.title}
                type="button"
                onClick={() => navigate(p.href)}
                className="w-full flex items-center gap-3 py-3 border-t border-border/60 first:border-t-0 souq-hoverrow text-start"
              >
                <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={2.2} />
                <span className="flex-1 text-[13.5px] font-semibold truncate">
                  {p.title}
                </span>
                <span
                  className={`souq-pill ${
                    p.published
                      ? "bg-emerald-500/14 text-emerald-700 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {p.published
                    ? (isRTL ? "منشور" : "Published")
                    : (isRTL ? "مسودة" : "Draft")}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ─── Themes gallery ────────────────────────────────────── */}
      <Card>
        <div className="souq-section-head px-5 pt-5 pb-2">
          <h2 className="text-[17px] font-bold tracking-tight">
            {isRTL ? "الثيمات" : "Themes"}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 rounded-lg gap-1"
            onClick={() => navigate("/online-store/themes")}
          >
            {isRTL ? "شوف الكل" : "View all"}
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" strokeWidth={2.2} />
          </Button>
        </div>
        <CardContent>
          {themesQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : themes.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              {isRTL ? "مفيش ثيمات متاحة لسه" : "No themes available yet"}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Always include the live theme first for visual anchor */}
              {[liveTheme, ...otherThemes].slice(0, 6).map((theme, i) => {
                const isLive = i === 0;
                return (
                  <div key={theme.id || theme.name} className="flex flex-col gap-2.5">
                    <div className="rounded-xl overflow-hidden border border-border aspect-[16/10] bg-surface-2">
                      <ThemeThumb
                        themeId={theme.id}
                        imageUrl={theme.preview_image_url}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-extrabold flex-1 truncate">
                        {theme.name}
                      </span>
                      {isLive ? (
                        <span className="souq-pill bg-navy text-white">
                          {isRTL ? "الحالي" : "Live"}
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs"
                          onClick={() => navigate("/online-store/themes")}
                        >
                          {isRTL ? "معاينة" : "Preview"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OnlineStoreLanding;
