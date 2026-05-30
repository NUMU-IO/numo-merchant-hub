/**
 * MarketplaceLibraryTab — Session D (2026-05-28).
 *
 * The "your library" view of installed marketplace themes per file 06
 * §3. Shows the currently-active theme as a prominent hero row at the
 * top, with any other installed-but-inactive themes below. Each row
 * surfaces:
 *   - thumbnail + name + version + installed_at
 *   - Active rows: [Customize] [View store]
 *   - Inactive rows: [Activate] [Uninstall] + Preview-soon
 *
 * Backed by GET /stores/{store_id}/marketplace/installed which Session
 * A's ThemeActivationService keeps in sync with store_themes (gap #2
 * close).
 *
 * Empty state nudges the merchant to the Marketplace tab.
 *
 * Update notifications (file 04 §7) are NOT wired yet — backend table
 * isn't shipped. UI placeholder stays out of the way: nothing renders
 * if there's no data.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Eye,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  activateTheme,
  listInstalled,
  uninstallTheme,
  type InstalledTheme,
} from "@/services/marketplaceApi";
import { useDashboardStore } from "@/contexts/StoreContext";
import { getStoreUrl } from "@/lib/storefront";
import { ActivateModal } from "./ActivateModal";
import { UninstallModal } from "./UninstallModal";

export interface MarketplaceLibraryTabProps {
  /** Called when the merchant wants to switch to the catalog (empty-state
   *  CTA + the "Get more themes" footer link). */
  onBrowseMarketplace: () => void;
}

export function MarketplaceLibraryTab({
  onBrowseMarketplace,
}: MarketplaceLibraryTabProps) {
  const { t } = useTranslation();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id ?? null;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const installedQuery = useQuery({
    queryKey: ["marketplace-installed", storeId],
    queryFn: () => listInstalled(storeId as string),
    enabled: storeId !== null,
    staleTime: 30_000,
  });

  // Modal targets — null when closed, set to the row's theme id when
  // open. Two separate states because Activate + Uninstall are
  // mutually exclusive per row.
  const [activateTarget, setActivateTarget] = useState<InstalledTheme | null>(
    null,
  );
  const [uninstallTarget, setUninstallTarget] = useState<InstalledTheme | null>(
    null,
  );

  const activateMutation = useMutation({
    mutationFn: async (theme: InstalledTheme) => {
      if (!storeId) throw new Error("No active store");
      await activateTheme(storeId, theme.theme!.id);
      return theme;
    },
    onSuccess: (theme) => {
      toast.success(
        t("marketplace.library.nowLive", { theme: theme.theme?.name ?? "Theme" }),
      );
      void queryClient.invalidateQueries({
        queryKey: ["marketplace-installed", storeId],
      });
      setActivateTarget(null);
    },
    onError: (err: unknown, theme) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(
        t("marketplace.library.activateFailed", {
          theme: theme.theme?.name ?? "Theme",
          msg,
        }),
      );
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: async (theme: InstalledTheme) => {
      if (!storeId) throw new Error("No active store");
      await uninstallTheme(storeId, theme.theme!.id);
      return theme;
    },
    onSuccess: (theme) => {
      toast.success(
        t("marketplace.library.removed", { theme: theme.theme?.name ?? "Theme" }),
      );
      void queryClient.invalidateQueries({
        queryKey: ["marketplace-installed", storeId],
      });
      setUninstallTarget(null);
    },
    onError: (err: unknown, theme) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(
        t("marketplace.library.uninstallFailed", {
          theme: theme.theme?.name ?? "Theme",
          msg,
        }),
      );
    },
  });

  // Filter out installs whose `theme` join came back null (deleted from
  // marketplace_themes after install — rare but possible). is_active is
  // the canonical "active" flag — `active` is the older naming the
  // initial TS type used, but the API actually ships `is_active`.
  const installed = (installedQuery.data?.installed ?? []).filter(
    (t): t is InstalledTheme & { theme: NonNullable<InstalledTheme["theme"]> } =>
      t.theme !== null,
  );
  const activeTheme = useMemo(
    () => installed.find((t) => t.is_active) ?? null,
    [installed],
  );
  const libraryThemes = useMemo(
    () => installed.filter((t) => !t.is_active),
    [installed],
  );

  const storeUrl = currentStore?.subdomain
    ? getStoreUrl(currentStore.subdomain)
    : null;

  if (installedQuery.isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (installedQuery.isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t("marketplace.library.loadError")}{" "}
          <Button
            variant="link"
            className="px-1"
            onClick={() => installedQuery.refetch()}
          >
            {t("marketplace.library.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Empty state — merchant has no marketplace installs yet.
  if (installed.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-medium">{t("marketplace.library.emptyTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {t("marketplace.library.emptyBody")}
          </p>
          <Button onClick={onBrowseMarketplace} className="mt-4">
            {t("marketplace.library.browse")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active theme — prominent row at the top. */}
      {activeTheme && (
        <InstalledThemeRow
          key={activeTheme.installation_id}
          theme={activeTheme}
          isActive
          storeUrl={storeUrl}
          onCustomize={() => navigate("/online-store/themes/editor-v3")}
          // Active row has no Activate / Uninstall / Preview actions —
          // those would orphan the storefront / are redundant since the
          // storefront is already rendering this theme.
          onActivate={() => undefined}
          onUninstall={() => undefined}
          onPreview={() => undefined}
        />
      )}

      {/* "Library" — installed but not active. */}
      {libraryThemes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold mt-6">{t("marketplace.library.inYourLibrary")}</h2>
          {libraryThemes.map((theme) => (
            <InstalledThemeRow
              key={theme.installation_id}
              theme={theme}
              isActive={false}
              storeUrl={storeUrl}
              onCustomize={() => undefined}
              onActivate={() => setActivateTarget(theme)}
              onUninstall={() => setUninstallTarget(theme)}
              onPreview={() =>
                navigate(
                  `/online-store/themes/preview/${theme.theme?.slug ?? ""}`,
                )
              }
            />
          ))}
        </div>
      )}

      <div className="pt-4 border-t flex justify-end">
        <Button variant="ghost" onClick={onBrowseMarketplace}>
          {t("marketplace.library.getMore")}
        </Button>
      </div>

      <ActivateModal
        open={activateTarget !== null}
        onOpenChange={(v) => !v && setActivateTarget(null)}
        themeName={activateTarget?.theme?.name ?? ""}
        currentlyActiveName={activeTheme?.theme?.name ?? null}
        loading={activateMutation.isPending}
        onConfirm={() =>
          activateTarget && activateMutation.mutate(activateTarget)
        }
      />

      <UninstallModal
        open={uninstallTarget !== null}
        onOpenChange={(v) => !v && setUninstallTarget(null)}
        themeName={uninstallTarget?.theme?.name ?? ""}
        loading={uninstallMutation.isPending}
        onConfirm={() =>
          uninstallTarget && uninstallMutation.mutate(uninstallTarget)
        }
      />
    </div>
  );
}

interface InstalledThemeRowProps {
  theme: InstalledTheme;
  isActive: boolean;
  storeUrl: string | null;
  onCustomize: () => void;
  onActivate: () => void;
  onUninstall: () => void;
  /** Session E — Open the full-screen "Try theme" preview iframe.
   *  Only meaningful for inactive rows; active rows show "View store"
   *  instead because the storefront is already rendering the theme. */
  onPreview: () => void;
}

function InstalledThemeRow({
  theme,
  isActive,
  storeUrl,
  onCustomize,
  onActivate,
  onUninstall,
  onPreview,
}: InstalledThemeRowProps) {
  const { t } = useTranslation();
  const themeMeta = theme.theme;
  const versionMeta = theme.version;
  const installedDate = useMemo(() => {
    if (!theme.installed_at) return null;
    const d = new Date(theme.installed_at);
    return isNaN(d.getTime()) ? null : d.toLocaleDateString();
  }, [theme.installed_at]);

  // Defensive — if the join came back null we filtered upstream, but
  // protect against undefined fields here too in case the type evolves.
  const slug = themeMeta?.slug ?? "??";
  const name = themeMeta?.name ?? slug;
  const versionString = versionMeta?.version_string ?? "?";
  const thumbnail = themeMeta?.thumbnail_url ?? null;

  return (
    <Card
      className={
        "transition-all" +
        (isActive ? " ring-2 ring-primary/30 shadow-sm" : "")
      }
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Thumbnail — falls back to slug initials when no thumbnail
              URL is set. */}
          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground font-semibold uppercase overflow-hidden">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <span>{slug.slice(0, 2)}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base truncate">{name}</h3>
              {isActive ? (
                <Badge className="bg-primary/15 text-primary border-primary/30 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {t("marketplace.library.live")}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <Circle className="h-3 w-3" />
                  {t("marketplace.library.notActive")}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {slug} · v{versionString}
              {installedDate ? (
                <> · {t("marketplace.library.installedOn", { date: installedDate })}</>
              ) : null}
            </p>
          </div>

          <div className="flex items-center gap-2 ms-auto shrink-0 flex-wrap">
            {isActive ? (
              <>
                <Button size="sm" onClick={onCustomize}>
                  <Pencil className="h-3.5 w-3.5 me-1.5" />
                  {t("marketplace.library.customize")}
                </Button>
                {storeUrl ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(storeUrl, "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5 me-1.5" />
                    {t("marketplace.library.viewStore")}
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <Button size="sm" onClick={onActivate}>
                  {t("marketplace.library.activate")}
                </Button>
                {/* Session E — Preview wires to the full-screen iframe
                    at /online-store/themes/preview/<slug>. The iframe
                    runs the marketplace bundle against the merchant's
                    own storefront read-only (no store_themes write). */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onPreview}
                  title={t("marketplace.library.previewTooltip")}
                >
                  <Eye className="h-3.5 w-3.5 me-1.5" />
                  {t("marketplace.library.preview")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onUninstall}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 me-1.5" />
                  {t("marketplace.library.uninstall")}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
