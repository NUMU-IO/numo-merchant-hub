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

import { useMemo, useState } from "react";
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { cn } from "@/lib/utils";
import {
  browseMarketplace,
  installTheme,
  activateTheme,
  listInstalled,
  type CatalogTheme,
  type InstalledTheme,
} from "@/services/marketplaceApi";

// ─── Card sub-component ─────────────────────────────────────────────────────

interface CatalogCardProps {
  theme: CatalogTheme;
  installed: InstalledTheme | undefined;
  busy: boolean;
  onInstall: () => void;
  onPreview: () => void;
  isAr: boolean;
}

function CatalogCard({
  theme,
  installed,
  busy,
  onInstall,
  onPreview,
  isAr,
}: CatalogCardProps) {
  const isActive = installed?.active === true;
  const hasUpdate = installed?.upgrade_available != null;
  const installedNotActive = installed != null && !isActive;

  return (
    <Card
      className={cn(
        "group overflow-hidden transition-all duration-300 hover:shadow-lg rounded-2xl",
        isActive && "ring-2 ring-primary shadow-lg",
        hasUpdate && "ring-2 ring-amber-400",
      )}
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-[4/3] bg-muted overflow-hidden"
        onClick={onPreview}
        role="button"
        tabIndex={0}
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

        {/* Status pill */}
        {isActive && (
          <Badge className="absolute top-3 end-3 bg-primary text-primary-foreground gap-1.5">
            <Check className="h-3.5 w-3.5" />
            {isAr ? "نشط" : "Active"}
          </Badge>
        )}
        {hasUpdate && !isActive && (
          <Badge
            className="absolute top-3 end-3 gap-1.5"
            style={{ backgroundColor: "#f59e0b", color: "white" }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {isAr ? "تحديث متاح" : "Update available"}
          </Badge>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">{theme.name}</h3>
            {theme.category && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {theme.category}
              </p>
            )}
          </div>
          {theme.price_cents > 0 && (
            <Badge variant="secondary" className="shrink-0">
              {(theme.price_cents / 100).toFixed(0)} EGP
            </Badge>
          )}
        </div>

        {theme.short_description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {theme.short_description}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          {isActive ? (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onPreview}
            >
              <ExternalLink className="h-3.5 w-3.5 me-1.5" />
              {isAr ? "تخصيص" : "Customize"}
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
              ) : hasUpdate ? (
                <RefreshCw className="h-3.5 w-3.5 me-1.5" />
              ) : (
                <Download className="h-3.5 w-3.5 me-1.5" />
              )}
              {busy
                ? isAr
                  ? "جاري..."
                  : "Working…"
                : installedNotActive
                  ? isAr
                    ? "تفعيل"
                    : "Activate"
                  : hasUpdate
                    ? isAr
                      ? "تحديث"
                      : "Update"
                    : isAr
                      ? "تثبيت"
                      : "Install"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onPreview}
            className="shrink-0"
          >
            {isAr ? "معاينة" : "Preview"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Empty / error states ───────────────────────────────────────────────────

function EmptyState({ isAr }: { isAr: boolean }) {
  return (
    <div className="text-center py-16 px-4">
      <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
      <p className="font-medium">
        {isAr
          ? "لا توجد ثيمات متاحة بعد"
          : "No marketplace themes yet"}
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        {isAr
          ? "ستظهر الثيمات هنا بمجرد نشرها."
          : "Themes will show up here once developers publish them."}
      </p>
    </div>
  );
}

function ErrorState({
  isAr,
  message,
  onRetry,
}: {
  isAr: boolean;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="text-center py-12 px-4">
      <AlertCircle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
      <p className="font-medium">
        {isAr ? "تعذّر تحميل الثيمات" : "Could not load the marketplace"}
      </p>
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
        {isAr ? "إعادة المحاولة" : "Retry"}
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
}

export function MarketplaceCatalog({ hideChrome, onActivated }: Props) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id ?? null;

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const catalogQuery = useQuery({
    queryKey: ["marketplace-catalog", page],
    queryFn: () => browseMarketplace({ page, per_page: 24 }),
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

  const installedById = useMemo(() => {
    const map = new Map<string, InstalledTheme>();
    for (const t of installedQuery.data?.installed ?? []) {
      map.set(t.marketplace_theme_id, t);
    }
    return map;
  }, [installedQuery.data]);

  // One-click install-and-activate. We use a single mutation per theme
  // id so concurrent clicks are deduped; a second click on the same
  // card while the first request is in-flight is a no-op.
  const installMutation = useMutation({
    mutationFn: async (themeId: string) => {
      if (!storeId) throw new Error("No active store");
      await installTheme(storeId, themeId);
      await activateTheme(storeId, themeId);
      return themeId;
    },
    onSuccess: (themeId) => {
      toast.success(
        isAr ? "تم تثبيت الثيم بنجاح" : "Theme installed",
      );
      void queryClient.invalidateQueries({
        queryKey: ["marketplace-installed", storeId],
      });
      onActivated?.(themeId);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(isAr ? `فشل التثبيت: ${msg}` : `Install failed: ${msg}`);
    },
  });

  // Client-side filter on the displayed page only — the search input
  // is a quick narrow rather than a server-side query, which would
  // require a different backend route. When the catalog grows we can
  // route the search through the API.
  const themes = catalogQuery.data?.themes ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return themes;
    const lower = search.toLowerCase();
    return themes.filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        (t.short_description ?? "").toLowerCase().includes(lower) ||
        (t.category ?? "").toLowerCase().includes(lower),
    );
  }, [themes, search]);

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
        isAr={isAr}
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
              {isAr ? "متجر الثيمات" : "Theme marketplace"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isAr
                ? `${themes.length} ثيم منشور — اختر واحدًا لتثبيته على متجرك.`
                : `${themes.length} themes — install one with a single click.`}
            </p>
          </div>
          <div className="relative w-64 max-w-full">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? "ابحث عن ثيم..." : "Search themes..."}
              className="ps-9 rounded-xl"
            />
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState isAr={isAr} />
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
              onInstall={() => installMutation.mutate(theme.id)}
              onPreview={() => {
                if (installedById.get(theme.id)?.active) {
                  navigate("/online-store/themes/editor-v3");
                } else {
                  // Open marketplace detail in a new tab — eventually
                  // this routes into the storefront's preview server
                  // when the dedicated theme detail page lands.
                  window.open(`/marketplace/themes/${theme.slug}`, "_blank");
                }
              }}
              isAr={isAr}
            />
          ))}
        </div>
      )}

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
            {isAr ? "السابق" : "Previous"}
          </Button>
          <span className="text-sm text-muted-foreground self-center">
            {isAr
              ? `الصفحة ${page} من ${Math.ceil(catalogQuery.data.total / catalogQuery.data.per_page)}`
              : `Page ${page} of ${Math.ceil(catalogQuery.data.total / catalogQuery.data.per_page)}`}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page * catalogQuery.data.per_page >= catalogQuery.data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            {isAr ? "التالي" : "Next"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default MarketplaceCatalog;
