/**
 * ActiveThemeCard — Session F (2026-05-29). File 06 §10.
 *
 * A compact "Your storefront" card on the dashboard home that surfaces
 * the merchant's currently-active theme: thumbnail, name, version, a Live
 * badge, and [View store] + [Customize] CTAs.
 *
 * Source of truth: the storefront customization's `theme.base_theme`
 * (same as the Online Store pages) decides whether *any* theme is live —
 * built-in / default / BYOT themes never appear in the marketplace
 * install list, so keying off `listInstalled().is_active` alone would
 * wrongly show "No active theme yet" for those stores. The marketplace
 * install, when present, only enriches the card (thumbnail / version).
 *
 * Render policy (so the dashboard never shows a broken card):
 *   - no store / queries loading → render nothing
 *   - a theme is live (base_theme or active install) → the full card
 *   - nothing live → a quiet "no active theme · Browse themes" nudge
 *
 * Note: there's no pre-existing in-tree "Theme: Modern" card to remove
 * on this dashboard (confirmed in Phase A) — this is a pure add.
 */

import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ExternalLink, Palette, Pencil } from "lucide-react";
import { listInstalled } from "@/services/marketplaceApi";
import { fetchCustomization, fetchThemes } from "@/services/themeApi";
import { useDashboardStore } from "@/contexts/StoreContext";
import { getPublicStoreUrl } from "@/lib/storefront";

export function ActiveThemeCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id ?? null;
  const storeUrl = getPublicStoreUrl(currentStore);

  const installedQuery = useQuery({
    queryKey: ["marketplace-installed", storeId],
    queryFn: () => listInstalled(storeId as string),
    enabled: storeId !== null,
    staleTime: 30_000,
  });
  // The marketplace install list only knows about themes installed through
  // the marketplace. Built-in / default / BYOT themes never appear there,
  // so we resolve the *actual* live theme the same way the Online Store
  // pages do — from `customization.theme.base_theme` — and use the
  // marketplace install only to enrich the card (thumbnail, version).
  const customizationQuery = useQuery({
    queryKey: ["customization", storeId],
    queryFn: () => fetchCustomization(storeId as string),
    enabled: storeId !== null,
    staleTime: 60_000,
  });
  const themesQuery = useQuery({
    queryKey: ["themes-available"],
    queryFn: fetchThemes,
    staleTime: 5 * 60 * 1000,
  });

  // Render nothing until we have data — no skeleton, so the dashboard's
  // existing rhythm isn't disturbed for stores with no theme resolved yet.
  if (
    !storeId ||
    installedQuery.isLoading ||
    installedQuery.isError ||
    customizationQuery.isLoading ||
    customizationQuery.isError
  )
    return null;

  const installed = (installedQuery.data?.installed ?? []).filter(
    (i) => i.theme !== null,
  );
  const activeInstall = installed.find((i) => i.is_active) ?? null;

  // Primary source of truth: the customization's base_theme. An active
  // marketplace install implies a base_theme too, but the converse isn't
  // true — so base_theme is what tells us whether *any* theme is live.
  const baseThemeId = customizationQuery.data?.theme?.base_theme ?? null;
  const catalogTheme = baseThemeId
    ? (themesQuery.data ?? []).find((th) => th.id === baseThemeId)
    : undefined;

  // A theme is live if we have a marketplace install OR a base_theme.
  const hasActiveTheme = activeInstall !== null || baseThemeId !== null;

  // No theme live anywhere — quiet nudge into the marketplace.
  if (!hasActiveTheme) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-2.5 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
              <Palette className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t("marketplace.dashboardCard.title")}</p>
              <p className="text-xs text-muted-foreground">
                {t("marketplace.dashboardCard.noActiveTheme")}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => navigate("/online-store/themes?tab=marketplace")}>
            {t("marketplace.dashboardCard.browse")}
          </Button>
      </div>
    );
  }

  // Prefer the marketplace install's metadata when present; otherwise fall
  // back to the storefront catalog entry for the base_theme, and finally to
  // a title-cased base_theme id so the card still reads with a real name.
  const name =
    activeInstall?.theme?.name ??
    activeInstall?.theme?.slug ??
    catalogTheme?.name ??
    (baseThemeId
      ? baseThemeId.charAt(0).toUpperCase() + baseThemeId.slice(1)
      : "");
  // Only marketplace installs carry a version string; built-ins don't.
  const version = activeInstall?.version?.version_string ?? null;
  const thumbnail =
    activeInstall?.theme?.thumbnail_url ??
    catalogTheme?.preview_image_url ??
    null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5">
      {/* Thumbnail — falls back to a palette glyph when unset. */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <Palette className="h-4 w-4" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-baseline gap-x-2 gap-y-0.5 flex-wrap">
        <span className="text-[12px] text-muted-foreground">{t("marketplace.dashboardCard.title")}</span>
        <span className="truncate text-[14px] font-bold">{name}</span>
        {version && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {t("marketplace.dashboardCard.version", { version })}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          {t("marketplace.dashboardCard.live")}
        </span>
      </div>

      <div className="ms-auto flex shrink-0 items-center gap-1">
        {storeUrl && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 rounded-lg px-2.5 text-[12.5px] text-muted-foreground hover:text-foreground"
            onClick={() => window.open(storeUrl, "_blank", "noopener")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("marketplace.dashboardCard.viewStore")}</span>
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold"
          onClick={() => navigate("/online-store/themes/editor-v3")}
        >
          <Pencil className="h-3.5 w-3.5" />
          {t("marketplace.dashboardCard.customize")}
        </Button>
      </div>
    </div>
  );
}

export default ActiveThemeCard;
