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
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";
import { AppSettingsPanel } from "@/components/apps/AppSettingsPanel";
import { UninstallAppDialog } from "@/components/apps/UninstallAppDialog";
import { AppSubscriptionCard } from "@/components/apps/AppSubscriptionCard";
import { AppListingView, appDisplay } from "@/components/apps/AppListingView";
import { AppReviews, AppSupport, RatingBadge } from "@/components/apps/AppFeedback";
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

export default function AppDetail() {
  const { slug = "" } = useParams();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const { listing, displayName, pricingLabel } = app
    ? appDisplay(app, language)
    : { listing: undefined, displayName: undefined, pricingLabel: undefined };
  const installed = Boolean(install);
  // A Partner App: installs through consent, has scopes and an "Open app".
  // NUMU builds some Partner Apps itself ("Built by NUMU"), so consent
  // (`connect`) decides, not the listing's developer.
  const isPartner = !!entry?.connect || (listing?.developer ? !listing.developer.is_first_party : false);
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

      <AppListingView
        app={app}
        language={language}
        badges={
          <>
            {install?.app_status === "suspended" && (
              <Badge variant="outline">{t("apps.suspended")}</Badge>
            )}
            <RatingBadge rating={entry?.rating} count={entry?.reviews_count} />
          </>
        }
        actions={
          <>
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
              <UninstallAppDialog
                app={confirmUninstall ? { slug: app.slug, name: displayName ?? app.name, partner: !!app.connect } : null}
                onClose={() => setConfirmUninstall(false)}
                onConfirm={(feedback) => void act(() => uninstallApp(storeId!, app.slug, feedback), t("apps.uninstall"))}
              />
            </>
          )}
          </>
        }
      >
      {install?.app_status === "suspended" && (
        <p className="rounded-md border border-dashed border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          {t("apps.suspendedHelp")}
        </p>
      )}

      {/* A NUMU-billed app: charged to the store's wallet (Phase 7). Free and
          externally billed apps have nothing to manage here. */}
      {install && (listing?.pricing?.plan === "recurring" || listing?.pricing?.plan === "usage") && (
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

      </AppListingView>
      <AppReviews storeId={storeId!} slug={app.slug} />

      {isPartner && (
        <AppSupport storeId={storeId!} slug={app.slug} initialTicketId={searchParams.get("support")} />
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
