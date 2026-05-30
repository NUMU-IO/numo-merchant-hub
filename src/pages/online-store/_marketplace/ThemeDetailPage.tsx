/**
 * ThemeDetailPage — Session E (2026-05-28).
 *
 * Public marketplace detail page mounted at
 *   /online-store/themes/marketplace/:slug
 *
 * Renders the Shopify-style detail surface per file 06 §4.3:
 *
 *   - Hero (back link, name, "By <author> · <category>", price chip,
 *     [Preview] + [Install] CTAs)
 *   - Description (full)
 *   - Screenshots carousel (Embla via shadcn)
 *   - Key highlights tiles (up to 3)
 *   - Features list (feature_tags as a check grid)
 *   - Supported languages chips
 *   - Reviews placeholder (Session F will ship the form + list)
 *
 * Data comes from `getThemeDetail(slug)` which hits the public
 * `/marketplace/catalog/themes/{slug}` endpoint — so the page works
 * even when the merchant doesn't have an active store yet (the install
 * CTA still gates on a store; the rest is browsing-only).
 *
 * TODO_I18N — Session F localises this. Strings are en-only with TODOs.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Check,
  Download,
  Eye,
  Gift,
  Library,
  Loader2,
  Pencil,
  Sparkles,
  Star,
  Tag,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  getThemeDetail,
  installTheme,
  listInstalled,
  type ThemeDetailResponse,
  type CatalogTheme,
} from "@/services/marketplaceApi";
import { useDashboardStore } from "@/contexts/StoreContext";
import { InstallModal } from "./InstallModal";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function satisfactionPercent(theme: ThemeDetailResponse): number | null {
  if ((theme.review_count ?? 0) <= 0) return null;
  const rating = theme.average_rating ?? 0;
  if (rating <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((rating / 5) * 100)));
}

// Language chip labels reuse the filter-rail's localized language names;
// unknown codes fall back to uppercase.
function languageLabel(code: string, t: (k: string) => string): string {
  if (code === "ar") return t("marketplace.filters.langAr");
  if (code === "en") return t("marketplace.filters.langEn");
  return code.toUpperCase();
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ThemeDetailPage() {
  const { t } = useTranslation();
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id ?? null;

  const detailQuery = useQuery({
    queryKey: ["marketplace-detail", slug],
    queryFn: () => getThemeDetail(slug),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  // We also need to know whether THIS merchant has installed THIS theme
  // already so the CTA can swap to "In Library →". Same store-scoped
  // query other surfaces use; the cache stays warm across navigations.
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
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(t("marketplace.catalog.installFailed", { msg }));
    },
  });

  if (detailQuery.isLoading) {
    return <ThemeDetailSkeleton onBack={() => navigate(-1)} />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/online-store/themes?tab=marketplace")}
          className="mb-6 -ms-2"
        >
          <ArrowLeft className="h-4 w-4 me-1.5" />
          {t("marketplace.detail.back")}
        </Button>
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">{t("marketplace.detail.notFound")}</p>
            <p>{t("marketplace.detail.notFoundHint")}</p>
            <p className="text-xs">{detailQuery.error?.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const theme = detailQuery.data;
  const installed = installedQuery.data?.installed.find(
    (t) => t.theme?.id === theme.id,
  );
  const isActive = installed?.is_active === true;
  const installedNotActive = installed != null && !isActive;
  const satisfaction = satisfactionPercent(theme);
  const activeThemeName =
    installedQuery.data?.installed.find((t) => t.is_active)?.theme?.name ??
    null;

  const screenshots = (theme.screenshots ?? []).filter((s) => s?.url);
  const highlights = theme.highlights ?? [];
  const features = theme.feature_tags ?? [];
  const languages = theme.supported_languages ?? [];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-10 pb-16">
      {/* ─── Back link ─────────────────────────────────────────────────── */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/online-store/themes?tab=marketplace")}
        className="-ms-2"
      >
        <ArrowLeft className="h-4 w-4 me-1.5" />
        {t("marketplace.detail.back")}
      </Button>

      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-start">
          <div className="space-y-3 min-w-0">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {theme.name}
            </h1>
            <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
              {theme.author_name && (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {t("marketplace.detail.by", { author: theme.author_name })}
                </span>
              )}
              {theme.author_name && theme.category && <span aria-hidden="true">·</span>}
              {theme.category && (
                <span className="inline-flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" />
                  {theme.category}
                </span>
              )}
            </div>

            {/* Price + social proof chips */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {theme.price_cents === 0 ? (
                <Badge
                  variant="secondary"
                  className="gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900"
                >
                  <Gift className="h-3.5 w-3.5" />
                  {t("marketplace.detail.free")}
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  {(theme.price_cents / 100).toFixed(0)} {theme.currency}
                </Badge>
              )}
              {satisfaction !== null && (
                <Badge variant="outline" className="gap-1">
                  <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                  {t("marketplace.detail.satisfiedReviews", {
                    pct: satisfaction,
                    count: theme.review_count,
                  })}
                </Badge>
              )}
              {satisfaction === null && (
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  {t("marketplace.detail.newlyAdded")}
                </Badge>
              )}
              {theme.install_count > 0 && (
                <Badge variant="outline" className="gap-1">
                  {t("marketplace.detail.installs", { count: theme.install_count })}
                </Badge>
              )}
            </div>
          </div>

          {/* ─── CTAs ─────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Button
              variant="outline"
              size="lg"
              onClick={() =>
                navigate(`/online-store/themes/preview/${theme.slug}`)
              }
            >
              <Eye className="h-4 w-4 me-2" />
              {t("marketplace.detail.previewTheme")}
            </Button>
            {isActive ? (
              <Button
                size="lg"
                onClick={() => navigate("/online-store/themes/editor-v3")}
              >
                <Pencil className="h-4 w-4 me-2" />
                {t("marketplace.detail.customize")}
              </Button>
            ) : installedNotActive ? (
              <Button
                variant="outline"
                size="lg"
                onClick={() =>
                  navigate("/online-store/themes?tab=library")
                }
              >
                <Library className="h-4 w-4 me-2" />
                {t("marketplace.detail.inLibrary")}
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() =>
                  setInstallTarget({
                    ...theme,
                    // CatalogTheme cast — ThemeDetailResponse extends it.
                  } as CatalogTheme)
                }
                disabled={installMutation.isPending || !storeId}
              >
                {installMutation.isPending ? (
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 me-2" />
                )}
                {t("marketplace.detail.install")}
              </Button>
            )}
          </div>
        </div>

        {/* ─── Description ─────────────────────────────────────────────── */}
        {theme.description && (
          <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-line">
            {theme.description}
          </p>
        )}
      </section>

      {/* ─── Screenshots carousel ──────────────────────────────────────── */}
      {screenshots.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">
            {t("marketplace.detail.screenshots")}
          </h2>
          <Carousel className="w-full" opts={{ align: "start", loop: false }}>
            <CarouselContent className="-ms-3">
              {screenshots.map((s, idx) => (
                <CarouselItem
                  key={`${s.url}-${idx}`}
                  className="ps-3 basis-full sm:basis-1/2 lg:basis-1/3"
                >
                  <div className="aspect-[4/5] rounded-2xl border bg-muted overflow-hidden">
                    <img
                      src={s.url}
                      alt={s.alt ?? `${theme.name} screenshot ${idx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {screenshots.length > 3 && (
              <>
                <CarouselPrevious className="-start-4" />
                <CarouselNext className="-end-4" />
              </>
            )}
          </Carousel>
        </section>
      )}

      {/* ─── Highlights ────────────────────────────────────────────────── */}
      {highlights.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">
            {t("marketplace.detail.highlights")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.slice(0, 3).map((h, i) => (
              <Card key={i} className="rounded-2xl">
                <CardContent className="p-5 space-y-2">
                  <p className="font-semibold text-base tracking-tight">
                    {h.title}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {h.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ─── Features ──────────────────────────────────────────────────── */}
      {features.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">
            {t("marketplace.detail.features")}
          </h2>
          <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-2 text-sm text-foreground/90"
              >
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ─── Languages ─────────────────────────────────────────────────── */}
      {languages.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">
            {t("marketplace.detail.languages")}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            {languages.map((code) => (
              <Badge key={code} variant="outline" className="capitalize">
                {languageLabel(code, t)}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <Separator />

      {/* ─── Reviews placeholder (review submission deferred post-v1) ──── */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("marketplace.detail.reviews")}
        </h2>
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <Star className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-foreground">
              {t("marketplace.detail.reviewsComingSoon")}
            </p>
            <p className="mt-1 text-xs max-w-md mx-auto">
              {t("marketplace.detail.reviewsHint")}
            </p>
          </CardContent>
        </Card>
      </section>

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

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ThemeDetailSkeleton({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-10">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ms-2">
        <ArrowLeft className="h-4 w-4 me-1.5" />
        {t("marketplace.detail.back")}
      </Button>
      <div className="space-y-3">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
