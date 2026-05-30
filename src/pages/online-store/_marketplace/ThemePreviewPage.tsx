/**
 * ThemePreviewPage — Session E (2026-05-28).
 *
 * Full-screen "Try theme" preview per file 06 §5. Mounted at
 *   /online-store/themes/preview/:slug
 * outside `<DashboardLayout>` so it eats the entire viewport.
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ ← Back   Bon Younes (V3)   Previewing — storefront not    │
 *   │            affected                          [Install]    │
 *   ├──────────────────────────────────────────────────────────┤
 *   │                                                            │
 *   │                                                            │
 *   │                 storefront iframe                          │
 *   │     loaded with ?preview_theme_slug=<slug>                 │
 *   │                                                            │
 *   │                                                            │
 *   └──────────────────────────────────────────────────────────┘
 *
 * The iframe points at the storefront with `preview_theme_slug` and
 * `editor=v3` query params. The storefront proxy reads
 * `preview_theme_slug` and forwards it as an `x-numu-preview-slug`
 * header, then the api-client substitutes the marketplace theme's
 * `latest_version` artifacts into the resolved theme settings (still
 * READ-ONLY — no `store_themes` write, no snapshot row, no install).
 *
 * Graceful fallback when the theme has no published version: the iframe
 * URL still loads but the storefront falls through to the active theme
 * (logged as a warning server-side). We surface a banner on top with
 * "no published version" copy so the merchant knows nothing went wrong.
 *
 * TODO_I18N — Session F.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStore } from "@/contexts/StoreContext";
import { getStoreUrl } from "@/lib/storefront";
import {
  getThemeDetail,
  installTheme,
  listInstalled,
} from "@/services/marketplaceApi";
import {
  ArrowLeft,
  Download,
  Eye,
  Library,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { InstallModal } from "./InstallModal";
import type { CatalogTheme } from "@/services/marketplaceApi";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the iframe src against the merchant's storefront. We rely on
 * `getStoreUrl(subdomain)` to produce the same host the merchant uses
 * for "View live store" — that way cookies + the proxy middleware
 * resolve consistently.
 *
 * Query params:
 *   - preview_theme_slug — read by the storefront's proxy + api-client.
 *   - editor=v3 — informational (logged for telemetry; doesn't change
 *     the read-only path).
 *   - _t — cache-buster so opening the page twice in a row doesn't
 *     serve a stale preview when the merchant has clicked through and
 *     comes back; React Query already invalidates on mount, this just
 *     makes the iframe key change for free.
 */
function buildPreviewSrc(
  subdomain: string | null | undefined,
  slug: string,
): string | null {
  if (!subdomain) return null;
  const base = getStoreUrl(subdomain);
  if (!base) return null;
  const url = new URL(base);
  url.searchParams.set("preview_theme_slug", slug);
  url.searchParams.set("editor", "v3");
  // Cache-buster matches the route key — when the slug changes the
  // iframe reload naturally; when the merchant clicks Preview twice in
  // a row, this still rotates.
  url.searchParams.set("_t", Math.floor(Date.now() / 1000).toString());
  return url.toString();
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ThemePreviewPage() {
  const { t } = useTranslation();
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id ?? null;
  const subdomain = currentStore?.subdomain ?? null;

  const detailQuery = useQuery({
    queryKey: ["marketplace-detail", slug],
    queryFn: () => getThemeDetail(slug),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  const installedQuery = useQuery({
    queryKey: ["marketplace-installed", storeId],
    queryFn: () => listInstalled(storeId as string),
    enabled: storeId !== null,
    staleTime: 30_000,
  });

  const [installTarget, setInstallTarget] = useState<CatalogTheme | null>(null);
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
      // After install, leave the merchant on the preview so they can
      // keep clicking around. The Library tab is a click away if they
      // want to activate; the toast points there.
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(t("marketplace.catalog.installFailed", { msg }));
    },
  });

  const previewSrc = useMemo(() => buildPreviewSrc(subdomain, slug), [
    subdomain,
    slug,
  ]);

  const theme = detailQuery.data;
  const installed = installedQuery.data?.installed.find(
    (t) => t.theme?.id === theme?.id,
  );
  const isActive = installed?.is_active === true;
  const installedNotActive = installed != null && !isActive;
  const activeThemeName =
    installedQuery.data?.installed.find((t) => t.is_active)?.theme?.name ??
    null;

  const hasPublishedBundle =
    !!theme?.latest_version?.bundle_url && theme.latest_version.bundle_url !== "";

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* ─── Top bar ───────────────────────────────────────────────────── */}
      <header className="h-14 border-b bg-card flex items-center px-4 gap-3 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/online-store/themes?tab=marketplace")}
        >
          <ArrowLeft className="h-4 w-4 me-1.5" />
          {t("marketplace.preview.back")}
        </Button>

        <div className="flex items-center gap-2 min-w-0">
          <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-semibold truncate">
            {theme?.name ?? slug}
          </span>
          <Badge
            variant="outline"
            className="hidden sm:inline-flex gap-1 text-[10px] font-medium uppercase tracking-wider bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900"
          >
            {t("marketplace.preview.banner")}
          </Badge>
        </div>

        <div className="ms-auto flex items-center gap-2 shrink-0">
          {isActive ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/online-store/themes/editor-v3")}
            >
              {t("marketplace.preview.customize")}
            </Button>
          ) : installedNotActive ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/online-store/themes?tab=library")}
            >
              <Library className="h-4 w-4 me-1.5" />
              {t("marketplace.preview.inLibrary")}
            </Button>
          ) : theme ? (
            <Button
              size="sm"
              onClick={() =>
                setInstallTarget({
                  ...theme,
                } as CatalogTheme)
              }
              disabled={installMutation.isPending || !storeId}
            >
              {installMutation.isPending ? (
                <Loader2 className="h-4 w-4 me-1.5 animate-spin" />
              ) : (
                <Download className="h-4 w-4 me-1.5" />
              )}
              {t("marketplace.preview.install")}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/online-store/themes?tab=marketplace")}
            aria-label={t("marketplace.preview.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ─── Banner — no published version ─────────────────────────────── */}
      {detailQuery.isSuccess && !hasPublishedBundle && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 px-4 py-2 text-sm flex items-center justify-between gap-2">
          <span>{t("marketplace.preview.noVersion")}</span>
        </div>
      )}

      {/* ─── Iframe ───────────────────────────────────────────────────── */}
      <main className="flex-1 min-h-0">
        {detailQuery.isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : detailQuery.isError ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="font-medium">{t("marketplace.preview.notFound")}</p>
            <p className="text-sm text-muted-foreground max-w-md">
              {t("marketplace.preview.notFoundHint", { slug })}
            </p>
          </div>
        ) : !previewSrc ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="font-medium">
              {t("marketplace.preview.noSubdomain")}
            </p>
            <p className="text-sm text-muted-foreground max-w-md">
              {t("marketplace.preview.noSubdomainHint")}
            </p>
          </div>
        ) : (
          <iframe
            key={previewSrc}
            src={previewSrc}
            title={theme?.name ?? slug}
            className="w-full h-full border-0"
            // The storefront is same-origin in dev (different port, but
            // localhost-to-localhost is OK for sandbox); in prod the
            // subdomain is on a different host and the iframe is treated
            // as cross-origin. Don't restrict via sandbox — the storefront
            // is trusted host code, the merchant is previewing their own
            // store, and clicking through (cart, checkout, etc) needs
            // full browser capabilities.
          />
        )}
      </main>

      {/* ─── Install modal ─────────────────────────────────────────────── */}
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
    </div>
  );
}
