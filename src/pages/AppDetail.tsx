/**
 * App detail page — one page, every app.
 *
 * Everything on it comes from the app's own manifest (`listing.*`), so a
 * third-party app gets the same page as a first-party one simply by filling the
 * same keys. Nothing here is special-cased per app, and anything an app does
 * not supply is omitted rather than rendered empty — a page with a blank
 * "Screenshots" heading reads as broken rather than as minimal.
 *
 * Reached from the Apps list at `/apps/:slug`. It is the merchant's answer to
 * "what is this, who made it, and what will it look like" BEFORE installing —
 * which the install-first Apps list could not answer.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Ban,
  ExternalLink,
  Image as ImageIcon,
  Languages,
  LayoutGrid,
  List,
  Loader2,
  Mail,
  Palette,
  Plug,
  Shapes,
  Sparkles,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";
import { AppSettingsPanel } from "@/components/apps/AppSettingsPanel";
import { AppSubscriptionCard } from "@/components/apps/AppSubscriptionCard";
import { scopeSentence } from "@/lib/appScopes";
import {
  type AppCatalogEntry,
  type AppInstallation,
  disableApp,
  enableApp,
  installApp,
  listAppCatalog,
  listAppInstallations,
  NUMU_APP_HOME,
  consentPath,
  getAppOpenUrl,
  uninstallApp,
} from "@/services/appsApi";

/** Pull the viewer's language out of a manifest `locales` block. */
function localized(
  node: { locales?: Record<string, Record<string, string | undefined>> } | undefined,
  key: string,
  language: string,
): string | undefined {
  const locales = node?.locales;
  if (!locales) return undefined;
  return locales[language]?.[key] ?? locales.en?.[key];
}

/**
 * Feature icons an app may name in its manifest.
 *
 * A closed map, not a dynamic lookup: an app cannot pull an arbitrary icon into
 * the hub, and a name nobody implemented falls back to a neutral mark rather
 * than rendering a hole in the list.
 */
const FEATURE_ICONS: Record<string, typeof Sparkles> = {
  palette: Palette,
  image: ImageIcon,
  shapes: Shapes,
  ban: Ban,
  grid: LayoutGrid,
  tag: Tag,
  list: List,
  languages: Languages,
  plug: Plug,
};

/** Language codes an app declares, in the reader's own language. */
const LANGUAGE_NAMES: Record<string, { ar: string; en: string }> = {
  ar: { ar: "العربية", en: "Arabic" },
  en: { ar: "الإنجليزية", en: "English" },
};

export default function AppDetail() {
  const { slug = "" } = useParams();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const queryClient = useQueryClient();

  const [install, setInstall] = useState<AppInstallation | null>(null);
  const [entry, setEntry] = useState<AppCatalogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmUninstall, setConfirmUninstall] = useState(false);

  const load = useMemo(
    () => async () => {
      if (!storeId) return;
      setLoading(true);
      try {
        const [installs, catalog] = await Promise.all([
          listAppInstallations(storeId),
          listAppCatalog(storeId),
        ]);
        setInstall(installs.find((a) => a.slug === slug) ?? null);
        setEntry(catalog.find((a) => a.slug === slug) ?? null);
      } catch (err) {
        showError(err, language);
      } finally {
        setLoading(false);
      }
    },
    [storeId, slug, language],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // The install row carries the richer payload (settings + schema); fall back
  // to the catalog entry for an app the merchant has not installed yet.
  const app = install ?? entry;
  const listing = app?.listing;
  // An Arabic-first platform must read the APP in Arabic too, not just its
  // chrome. Falls back to the English columns for a locale nobody translated.
  const l10n = listing?.app_locales?.[language] ?? listing?.app_locales?.en;
  const displayName = l10n?.name || app?.name;
  const displayDescription = l10n?.description || app?.description;
  const displayTagline =
    listing?.locales?.[language]?.tagline ??
    listing?.locales?.en?.tagline ??
    listing?.tagline;
  const installed = Boolean(install);
  // A Partner App: installs through consent, has scopes and an "Open app".
  const isPartner = listing?.developer ? !listing.developer.is_first_party : false;
  const pricingLabel =
    listing?.pricing?.locales?.[language]?.label ?? listing?.pricing?.locales?.en?.label;
  const compatibility =
    listing?.compatibility?.locales?.[language]?.text ??
    listing?.compatibility?.locales?.en?.text;
  const Back = language === "ar" ? ArrowRight : ArrowLeft;

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      await load();
      // The sidebar reads installs too; a NUMU App's tab follows the install.
      void queryClient.invalidateQueries({ queryKey: ["apps", "installations"] });
    } catch (err) {
      showError(err, language);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/apps")}>
          <Back className="me-2 h-4 w-4" />
          {t("apps.title")}
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("apps.notFound")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Button variant="ghost" size="sm" className="-ms-2" onClick={() => navigate("/apps")}>
        <Back className="me-2 h-4 w-4" />
        {t("apps.title")}
      </Button>

      {/* ── Header: identity, who made it, and the install control ── */}
      <div className="flex flex-wrap items-start gap-4">
        {app.icon_url ? (
          <img
            src={app.icon_url}
            alt=""
            className="h-16 w-16 rounded-xl border border-border/50 object-contain bg-background"
          />
        ) : (
          <div className="h-16 w-16 rounded-xl bg-muted" />
        )}

        <div className="flex-1 min-w-[220px]">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
              {displayName}
            </h1>
            {/* Version is digits: it stays LTR in an Arabic page. */}
            <span className="text-xs text-muted-foreground">
              <bdi dir="ltr">v{app.version}</bdi>
            </span>
            {pricingLabel && (
              <Badge variant="secondary" className="font-medium">
                {pricingLabel}
              </Badge>
            )}
            {install?.app_status === "suspended" && (
              <Badge variant="outline">{t("apps.suspended")}</Badge>
            )}
          </div>

          {displayTagline && (
            <p className="text-sm text-muted-foreground mt-1">{displayTagline}</p>
          )}

          {listing?.developer?.name && (
            // A <div>, not a <p>: Badge renders a <div>, and a <div> inside a
            // <p> is invalid HTML — React logged validateDOMNesting on every
            // render and the browser silently closed the paragraph early.
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {t("apps.by")} <span className="font-medium">{listing.developer.name}</span>
              </span>
              {listing.developer.is_first_party ? (
                <Badge variant="secondary" className="gap-1">
                  <BadgeCheck className="h-3 w-3" />
                  {t("apps.firstParty")}
                </Badge>
              ) : (
                <Badge variant="outline">{t("apps.partnerBadge")}</Badge>
              )}
              {listing.developer.url && (
                <a
                  className="inline-flex items-center gap-1 underline underline-offset-2"
                  href={listing.developer.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {t("apps.website")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {listing.developer.support_email && (
                <a
                  className="inline-flex items-center gap-1 underline underline-offset-2"
                  href={`mailto:${listing.developer.support_email}`}
                >
                  <Mail className="h-3 w-3" />
                  {t("apps.support")}
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {!installed ? (
            <Button
              disabled={busy}
              onClick={() =>
                entry?.connect
                  ? // A Partner App installs through consent (OAuth).
                    navigate(consentPath(entry.connect, storeId!))
                  : act(() => installApp(storeId!, app.slug), t("apps.installed"))
              }
            >
              {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("apps.install")}
            </Button>
          ) : (
            <>
              {NUMU_APP_HOME[app.slug] && install!.is_enabled && (
                <Button onClick={() => navigate(NUMU_APP_HOME[app.slug])}>{t("apps.open")}</Button>
              )}
              {isPartner && install!.is_enabled && install!.install_status === "active" && (
                <Button
                  disabled={busy}
                  onClick={async () => {
                    if (listing?.embedded) return navigate(`/apps/${app.slug}/app`);
                    try {
                      // A fresh signed link each time: the app rejects old timestamps.
                      window.open(await getAppOpenUrl(storeId!, app.slug, language), "_blank", "noopener");
                    } catch (err) {
                      showError(err, language);
                    }
                  }}
                >
                  {t("apps.openApp")}
                </Button>
              )}
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  act(
                    () =>
                      install!.is_enabled
                        ? disableApp(storeId!, app.slug)
                        : enableApp(storeId!, app.slug),
                    install!.is_enabled ? t("apps.disabled") : t("apps.enabled"),
                  )
                }
              >
                {install!.is_enabled ? t("apps.disable") : t("apps.enable")}
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => setConfirmUninstall(true)}
              >
                {t("apps.uninstall")}
              </Button>
              <AlertDialog open={confirmUninstall} onOpenChange={setConfirmUninstall}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("apps.uninstall")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t(NUMU_APP_HOME[app.slug] ? "apps.uninstallConfirm" : "apps.uninstallConfirmSettings", { name: displayName })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive hover:bg-destructive/90"
                      onClick={() => void act(() => uninstallApp(storeId!, app.slug), t("apps.uninstall"))}
                    >
                      {t("apps.uninstall")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {install?.app_status === "suspended" && (
        <p className="rounded-md border border-dashed border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          {t("apps.suspendedHelp")}
        </p>
      )}

      {/* A NUMU-billed app: charged to the store's wallet (Phase 7). Free and
          externally billed apps have nothing to manage here. */}
      {install && listing?.pricing?.plan === "recurring" && (
        <AppSubscriptionCard
          storeId={storeId!}
          install={install}
          name={displayName ?? app.name}
          priceLabel={pricingLabel}
        />
      )}

      {isPartner && install && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            {install.install_status === "pending_auth" && (
              <p className="text-sm text-muted-foreground">{t("apps.pendingAuth")}</p>
            )}
            {(install.missing_scopes?.length ?? 0) > 0 && entry?.connect && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/50 p-3">
                <p className="text-sm">{t("apps.reconsent")}</p>
                <Button
                  size="sm"
                  onClick={() =>
                    navigate(
                      consentPath(entry.connect!, storeId!, [
                        ...(install.granted_scopes ?? []),
                        ...(install.missing_scopes ?? []),
                      ]),
                    )
                  }
                >
                  {t("apps.reconsentBtn")}
                </Button>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold">{t("apps.permissions")}</p>
              <ul className="mt-1.5 space-y-1 text-sm">
                {(install.granted_scopes ?? []).map((s) => (
                  <li key={s}>• {scopeSentence(t, s)}</li>
                ))}
              </ul>
            </div>
            <a
              className="text-xs text-muted-foreground underline underline-offset-2"
              href={`mailto:support@numueg.app?subject=${encodeURIComponent(`Report app: ${app.slug}`)}`}
            >
              {t("apps.report")}
            </a>
          </CardContent>
        </Card>
      )}

      {/* ── Gallery, before the prose: a merchant comparing apps decides with
             their eyes first. Its own horizontal scroller, so the page body
             never scrolls sideways — the RTL-safe way to overflow a row. ── */}
      {(listing?.screenshots?.length ?? 0) > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-6 px-6 snap-x">
          {listing!.screenshots!.map((shot, i) =>
            shot.url ? (
              <figure key={i} className="shrink-0 snap-start">
                <img
                  src={shot.url}
                  alt={localized(shot, "caption", language) ?? ""}
                  loading="lazy"
                  className="h-56 w-auto max-w-full rounded-xl border border-border/60 object-contain bg-background"
                />
                {localized(shot, "caption", language) && (
                  <figcaption className="mt-2 text-xs text-muted-foreground max-w-[320px]">
                    {localized(shot, "caption", language)}
                  </figcaption>
                )}
              </figure>
            ) : null,
          )}
        </div>
      )}

      {/* ── What it does ── */}
      {(displayDescription || (listing?.highlights?.length ?? 0) > 0) && (
        <Card>
          <CardContent className="py-5 space-y-3">
            <h2 className="text-sm font-semibold">{t("apps.about")}</h2>
            {displayDescription && (
              <p className="text-sm text-muted-foreground">{displayDescription}</p>
            )}
            {(listing?.highlights?.length ?? 0) > 0 && (
              <ul className="space-y-1.5">
                {listing!.highlights!.map((h, i) => {
                  const text = localized(h, "text", language);
                  if (!text) return null;
                  return (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{text}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── The feature tour. A plain two-column list, not a grid of cards:
             nine identical bordered boxes is the shape a merchant scrolls
             past, and every row here is the same conceptual weight. ── */}
      {(listing?.features?.length ?? 0) > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">{t("apps.features")}</h2>
          <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
            {listing!.features!.map((f, i) => {
              const loc = f.locales?.[language] ?? f.locales?.en;
              if (!loc?.title) return null;
              const Icon = FEATURE_ICONS[f.icon ?? ""] ?? Sparkles;
              return (
                <div key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold leading-snug">{loc.title}</h3>
                    {loc.body && (
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                        {loc.body}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Details: the facts a merchant checks last, before installing. ── */}
      {(pricingLabel || (listing?.languages?.length ?? 0) > 0 || compatibility) && (
        <Card>
          <CardContent className="py-5">
            <h2 className="mb-3 text-sm font-semibold">{t("apps.details")}</h2>
            <dl className="divide-y divide-border/60 text-sm">
              {pricingLabel && (
                <div className="flex flex-wrap gap-x-6 gap-y-1 py-2.5">
                  <dt className="w-32 shrink-0 text-muted-foreground">
                    {t("apps.pricing")}
                  </dt>
                  <dd className="min-w-0 flex-1">{pricingLabel}</dd>
                </div>
              )}
              {(listing?.languages?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-x-6 gap-y-1 py-2.5">
                  <dt className="w-32 shrink-0 text-muted-foreground">
                    {t("apps.languages")}
                  </dt>
                  <dd className="min-w-0 flex-1">
                    {listing!
                      .languages!.map(
                        (code) =>
                          LANGUAGE_NAMES[code]?.[language === "ar" ? "ar" : "en"] ?? code,
                      )
                      .join(language === "ar" ? "، " : ", ")}
                  </dd>
                </div>
              )}
              {compatibility && (
                <div className="flex flex-wrap gap-x-6 gap-y-1 py-2.5">
                  <dt className="w-32 shrink-0 text-muted-foreground">
                    {t("apps.worksWith")}
                  </dt>
                  <dd className="min-w-0 flex-1 leading-relaxed">{compatibility}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* ── Settings, only once it is installed ── */}
      {install && (install.settings_schema?.length ?? 0) > 0 && (
        <Card>
          <CardContent className="py-5 space-y-4">
            <h2 className="text-sm font-semibold">{t("apps.settings")}</h2>
            <AppSettingsPanel
              storeId={storeId!}
              app={install}
              onSaved={(next) => setInstall(next)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
