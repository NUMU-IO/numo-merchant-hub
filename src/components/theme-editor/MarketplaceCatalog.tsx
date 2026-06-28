/**
 * MarketplaceCatalog — V3-era marketplace browser.
 *
 * Reads the published catalog from the `/marketplace/catalog/themes`
 * endpoint via `marketplaceApi.browseMarketplace()` and renders an
 * install-aware grid. Each card surfaces:
 *
 *   - Theme thumbnail + name + short description
 *   - Author handle
 *   - "Install" button → installs the latest published version, then
 *     activates it (one-click flow). Switches to "Active" / "Update
 *     available" depending on the merchant's current install state.
 *   - "Preview" button → opens the marketplace detail page (or a
 *     theme demo store in a new tab when one is configured).
 *
 * This is the V3 replacement for the hardcoded `ThemeMarketplace`
 * grid. We keep both around through Wave 7 — the V2 grid stays
 * available for merchants still on V2 themes; V3 merchants see this
 * one. Wave 8 retires the V2 grid.
 *
 * State management uses TanStack React Query (already in the hub)
 * keyed by store id so switching stores invalidates installed status
 * without a full reload.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Search,
  Check,
  Download,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Gift,
  Library,
  User as UserIcon,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useDashboardStore } from "@/contexts/StoreContext";
import { cn } from "@/lib/utils";
import {
  browseMarketplace,
  installTheme,
  listInstalled,
  type CatalogTheme,
  type InstalledTheme,
} from "@/services/marketplaceApi";
import { InstallModal } from "@/pages/online-store/_marketplace/InstallModal";
import {
  applyFilters,
  EMPTY_FILTERS,
  type MarketplaceFilters,
} from "@/pages/online-store/_marketplace/MarketplaceFilterRail";
import {
  applySort,
  type MarketplaceSort,
} from "@/pages/online-store/_marketplace/MarketplaceSortDropdown";

// ─── Card sub-component ─────────────────────────────────────────────────────

interface CatalogCardProps {
  theme: CatalogTheme;
  installed: InstalledTheme | undefined;
  busy: boolean;
  onInstall: () => void;
  onGoToLibrary: () => void;
  onCustomize: () => void;
  /** Card body (thumbnail + title row) click — opens the marketplace
   *  detail page at `/online-store/themes/marketplace/{slug}`. */
  onOpenDetail: () => void;
  /** Preview button click — opens the full-screen preview iframe at
   *  `/online-store/themes/preview/{slug}`. Phase F un-greys this. */
  onPreview: () => void;
}

/**
 * Map a 0–5 average_rating into a Shopify-style satisfaction percentage.
 * 4.8/5 → 96%. Returns null when no reviews exist yet so the card can
 * surface "Newly added" instead of a misleading 0%. The threshold is
 * intentionally generous — even 1 review surfaces a number so brand-new
 * themes get traction; the volume is implied by the install count
 * elsewhere on the card.
 */
function satisfactionPercent(theme: CatalogTheme): number | null {
  if ((theme.review_count ?? 0) <= 0) return null;
  const rating = theme.average_rating ?? 0;
  if (rating <= 0) return null;
  // Convert 0–5 → 0–100. Clamp so a future bug that pushes rating > 5
  // doesn't show 110% satisfaction.
  return Math.max(0, Math.min(100, Math.round((rating / 5) * 100)));
}

function CatalogCard({
  theme,
  installed,
  busy,
  onInstall,
  onGoToLibrary,
  onCustomize,
  onOpenDetail,
  onPreview,
}: CatalogCardProps) {
  const { t } = useTranslation();
  const isActive = installed?.is_active === true;
  const installedNotActive = installed != null && !isActive;
  const satisfaction = satisfactionPercent(theme);

  return (
    <Card
      className={cn(
        "group overflow-hidden transition-all duration-300 hover:shadow-lg rounded-2xl",
        isActive && "ring-2 ring-primary shadow-lg",
      )}
    >
      {/* Thumbnail — clickable, routes to the detail page. Per file 06 §4.2.
          (Preview button below opens the iframe; the body click is a
          quieter intent — "tell me more" — that matches Shopify's pattern.) */}
      <button
        type="button"
        className="relative aspect-[4/3] bg-muted overflow-hidden w-full block text-start cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={onOpenDetail}
        aria-label={t("marketplace.card.viewDetails", { name: theme.name })}
      >
        {theme.thumbnail_url ? (
          <img
            src={theme.thumbnail_url}
            alt={theme.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/40">
            <Sparkles className="h-12 w-12" />
          </div>
        )}

        {/* Status pill (top-end) — Active beats free badge if both apply. */}
        {isActive && (
          <Badge className="absolute top-3 end-3 bg-primary text-primary-foreground gap-1.5 pointer-events-none">
            <Check className="h-3.5 w-3.5" />
            {t("marketplace.card.active")}
          </Badge>
        )}

        {/* Free badge (top-start) — surfaced only when not Active so we
            don't pile pills on top of each other. */}
        {!isActive && theme.price_cents === 0 && (
          <Badge
            variant="secondary"
            className="absolute top-3 start-3 gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900 pointer-events-none"
          >
            <Gift className="h-3.5 w-3.5" />
            {t("marketplace.card.free")}
          </Badge>
        )}
      </button>

      <CardContent className="p-4 space-y-3">
        {/* Title + category row. Title click also opens the detail page
            so keyboard users have a second hit target — the thumbnail
            button is great with a mouse, this matches it. */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={onOpenDetail}
              className="text-start font-semibold text-base truncate hover:underline focus-visible:outline-none focus-visible:underline w-full"
            >
              {theme.name}
            </button>
            {theme.category && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {theme.category}
              </p>
            )}
          </div>
          {theme.price_cents > 0 && (
            <Badge variant="secondary" className="shrink-0">
              {(theme.price_cents / 100).toFixed(0)} {theme.currency}
            </Badge>
          )}
        </div>

        {/* File 06 §4.2 social-proof row.
            Two states:
              - reviewed: "Free · 96% satisfied" (or "120 EGP · …")
              - new (no reviews): "Free · Newly added"
            We omit the row entirely when the theme is paid AND has no
            reviews, so paid-but-new listings don't draw extra attention
            to their freshness. Free + new still shows the row because
            "Free · Newly added" is a useful nudge. */}
        {(() => {
          const isFree = theme.price_cents === 0;
          const showFresh = isFree && satisfaction === null;
          if (satisfaction === null && !showFresh) return null;
          return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">
                {isFree
                  ? t("marketplace.card.free")
                  : `${(theme.price_cents / 100).toFixed(0)} ${theme.currency}`}
              </span>
              <span aria-hidden="true">·</span>
              {satisfaction !== null ? (
                <span className="inline-flex items-center gap-1">
                  <span className="text-amber-500" aria-hidden="true">★</span>
                  {t("marketplace.card.satisfied", { pct: satisfaction })}
                </span>
              ) : (
                <span className="text-muted-foreground/80 italic">
                  {t("marketplace.card.newlyAdded")}
                </span>
              )}
              {theme.install_count > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {t("marketplace.card.installs", {
                      count: formatInstallCount(theme.install_count),
                    })}
                  </span>
                </>
              )}
            </div>
          );
        })()}

        {theme.short_description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {theme.short_description}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          {/* Primary action — depends on install state.
              - active:    Customize (links to editor-v3)
              - installed: "In Library →" (jumps to Library tab)
              - else:      Install (opens modal) */}
          {isActive ? (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onCustomize}
            >
              <ExternalLink className="h-3.5 w-3.5 me-1.5" />
              {t("marketplace.card.customize")}
            </Button>
          ) : installedNotActive ? (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onGoToLibrary}
            >
              <Library className="h-3.5 w-3.5 me-1.5" />
              {t("marketplace.card.inLibrary")}
            </Button>
          ) : (
            <Button
              size="sm"
              className="flex-1"
              onClick={onInstall}
              disabled={busy}
            >
              {busy ? (
                <RefreshCw className="h-3.5 w-3.5 me-1.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 me-1.5" />
              )}
              {busy
                ? t("marketplace.card.working")
                : t("marketplace.card.install")}
            </Button>
          )}
          {/* Preview — hidden on the active card (storefront already
              shows it) and on the In-Library card (Activate first, then
              preview lives at the storefront). Visible on non-installed
              cards as a "try before installing" CTA, wired in Phase F
              to /online-store/themes/preview/{slug}. */}
          {!isActive && !installedNotActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onPreview}
              className="shrink-0"
            >
              {t("marketplace.card.preview")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Empty / error states ───────────────────────────────────────────────────

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="text-center py-16 px-4">
      <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
      <p className="font-medium">{t("marketplace.catalog.empty")}</p>
      <p className="text-sm text-muted-foreground mt-1">
        {t("marketplace.catalog.emptyHint")}
      </p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="text-center py-12 px-4">
      <AlertCircle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
      <p className="font-medium">{t("marketplace.catalog.error")}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        {message}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="mt-4"
      >
        <RefreshCw className="h-3.5 w-3.5 me-1.5" />
        {t("marketplace.catalog.retry")}
      </Button>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

interface Props {
  /** When set, suppresses the search + filter chrome. Useful when the
   *  parent already provides its own. */
  hideChrome?: boolean;
  /** Optional callback after a successful activate; the parent might
   *  navigate the merchant into the V3 customizer. */
  onActivated?: (themeId: string) => void;
  /** Session E — filter state lifted into the parent so the rail and
   *  the grid share one source of truth. When omitted, no filtering is
   *  applied beyond the local `search` input below. */
  filters?: MarketplaceFilters;
  /** Session E — same as filters; controlled by the parent sort dropdown. */
  sort?: MarketplaceSort;
  /** Session E — surface the post-filter count back to the parent so it
   *  can render a "Showing N of M" badge above the grid. Optional. */
  onResultCountChange?: (filtered: number, total: number) => void;
}

export function MarketplaceCatalog({
  hideChrome,
  onActivated,
  filters,
  sort,
  onResultCountChange,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id ?? null;

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Session E bumped per_page to 50 because the rail filters client-side
  // — we want the full visible catalog in memory so filters narrow without
  // missing themes on later pages. Server-side filtering moves in when
  // catalog grows past ~100.
  const catalogQuery = useQuery({
    queryKey: ["marketplace-catalog", page],
    queryFn: () => browseMarketplace({ page, per_page: 50 }),
    staleTime: 60 * 1000,
  });

  // The store may have nothing installed yet — empty installed[] is
  // fine. We only fetch when there's an active store.
  const installedQuery = useQuery({
    queryKey: ["marketplace-installed", storeId],
    queryFn: () => listInstalled(storeId!),
    enabled: storeId !== null,
    staleTime: 30 * 1000,
  });

  // Map by the marketplace theme id so the card can look up its install
  // state in O(1). After Session D the InstalledTheme shape is nested
  // (`t.theme.id`), so this map key reads through the join. Rows whose
  // theme was deleted from marketplace_themes after install come back
  // with `t.theme === null`; we filter them out here so the catalog
  // never tries to display a "ghost install".
  const installedById = useMemo(() => {
    const map = new Map<string, InstalledTheme>();
    for (const t of installedQuery.data?.installed ?? []) {
      if (t.theme?.id) map.set(t.theme.id, t);
    }
    return map;
  }, [installedQuery.data]);

  // Session D — install-only (no auto-activate). After install, the
  // theme lives in the merchant's library and the storefront stays on
  // the previously-active theme. Merchant moves to the Library tab and
  // clicks Activate to switch.
  //
  // The `onActivated` callback is preserved for compatibility but no
  // longer fires from this mutation — it stayed in the prop signature
  // because the call site (`Themes.tsx`) still passes it; making it a
  // no-op here keeps that wiring intact without a parent refactor.
  const [installTarget, setInstallTarget] = useState<CatalogTheme | null>(
    null,
  );
  const installMutation = useMutation({
    mutationFn: async (themeId: string) => {
      if (!storeId) throw new Error("No active store");
      await installTheme(storeId, themeId);
      return themeId;
    },
    onSuccess: () => {
      toast.success(t("marketplace.catalog.addedToLibrary"));
      void queryClient.invalidateQueries({
        queryKey: ["marketplace-installed", storeId],
      });
      setInstallTarget(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(t("marketplace.catalog.installFailed", { msg }));
    },
  });

  // Resolve the currently-active theme name once so the modal can show
  // the "your storefront stays on Y" reassurance without a per-row
  // lookup. Session E — B-19 fix: the API ships `is_active` on the
  // installed row, not `active`. Without this fix the modal's "your
  // storefront stays on Y" reassurance was always blank.
  const activeThemeName = useMemo(() => {
    return (
      installedQuery.data?.installed.find((t) => t.is_active)?.theme?.name ??
      null
    );
  }, [installedQuery.data]);

  // Client-side filter chain. Order matters: search narrows first, then
  // the rail filters, then the sort. Search runs over the raw catalog
  // page; rail filters + sort run over the search-narrowed list.
  const themes = catalogQuery.data?.themes ?? [];
  const filtered = useMemo(() => {
    let working = themes;

    // Local search input (still relevant when chrome is shown — the
    // filter rail is a separate surface in Session E and only kicks in
    // when the parent passes `filters`).
    if (search.trim()) {
      const lower = search.toLowerCase();
      working = working.filter(
        (t) =>
          t.name.toLowerCase().includes(lower) ||
          (t.short_description ?? "").toLowerCase().includes(lower) ||
          (t.category ?? "").toLowerCase().includes(lower),
      );
    }

    if (filters) working = applyFilters(working, filters);
    if (sort) working = applySort(working, sort);

    return working;
  }, [themes, search, filters, sort]);

  // Surface the post-filter count to the parent for the "Showing N of M"
  // badge. Effect not memo so we can fire it during render-stable changes
  // without computing identity on the parent side.
  useEffect(() => {
    onResultCountChange?.(filtered.length, themes.length);
  }, [filtered.length, themes.length, onResultCountChange]);

  if (catalogQuery.isLoading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="rounded-2xl overflow-hidden">
            <div className="aspect-[4/3] bg-muted animate-pulse" />
            <CardContent className="p-4 space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
              <div className="h-3 bg-muted rounded animate-pulse w-full" />
              <div className="h-9 bg-muted rounded animate-pulse w-full mt-3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (catalogQuery.isError) {
    return (
      <ErrorState
        message={
          catalogQuery.error instanceof Error
            ? catalogQuery.error.message
            : "Unknown error"
        }
        onRetry={() => void catalogQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      {!hideChrome && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {t("marketplace.catalog.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("marketplace.catalog.subtitle", { count: themes.length })}
            </p>
          </div>
          <div className="relative w-64 max-w-full">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("marketplace.catalog.searchPlaceholder")}
              className="ps-9 rounded-xl"
            />
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        // Distinguish a truly-empty catalog from "your filters/search
        // excluded everything" — the merchant needs different guidance.
        themes.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="text-center py-16 px-4">
            <Search className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-medium">{t("marketplace.catalog.noMatch")}</p>
          </div>
        )
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((theme) => (
            <CatalogCard
              key={theme.id}
              theme={theme}
              installed={installedById.get(theme.id)}
              busy={
                installMutation.isPending &&
                installMutation.variables === theme.id
              }
              // Click Install → open modal. Modal Confirm runs the
              // mutation. We DON'T mutate immediately because Session D
              // distinguishes Install from Activate; the modal copy
              // explains what each step does so the merchant isn't
              // surprised that their storefront didn't switch.
              onInstall={() => setInstallTarget(theme)}
              onGoToLibrary={() => {
                // Navigate to the Library tab on the same page.
                navigate("/online-store/themes?tab=library");
              }}
              onCustomize={() => navigate("/online-store/themes/editor-v3")}
              onOpenDetail={() =>
                navigate(`/online-store/themes/marketplace/${theme.slug}`)
              }
              onPreview={() =>
                navigate(`/online-store/themes/preview/${theme.slug}`)
              }
            />
          ))}
        </div>
      )}

      {/* Session D — Install confirmation modal. Distinguished from
          Activate so merchants understand the storefront stays on the
          current theme until they explicitly activate. */}
      <InstallModal
        open={installTarget !== null}
        onOpenChange={(v) => !v && setInstallTarget(null)}
        themeName={installTarget?.name ?? ""}
        currentlyActiveName={activeThemeName}
        priceCents={installTarget?.price_cents ?? 0}
        currency={installTarget?.currency ?? "EGP"}
        loading={installMutation.isPending}
        onConfirm={() =>
          installTarget && installMutation.mutate(installTarget.id)
        }
      />

      {/* Pagination — appears only when the catalog has more than
          one page. Page state is in the local component; the query
          is keyed by page so the cached "page 1" stays around when
          the merchant navigates back. */}
      {catalogQuery.data && catalogQuery.data.total > catalogQuery.data.per_page && (
        <div className="flex justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t("marketplace.catalog.previous")}
          </Button>
          <span className="text-sm text-muted-foreground self-center">
            {t("marketplace.catalog.pageOf", {
              page,
              total: Math.ceil(
                catalogQuery.data.total / catalogQuery.data.per_page,
              ),
            })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page * catalogQuery.data.per_page >= catalogQuery.data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("marketplace.catalog.next")}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Compact "1.2k installs" style formatter — same convention Shopify's
 * theme store uses. Sub-1k stays integer, then k for thousands, m for
 * millions. We don't expect either bucket at the moment, but the format
 * works the day we do.
 */
function formatInstallCount(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

export default MarketplaceCatalog;
