import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { BadgeCheck, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
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
  uninstallApp,
  updateAppSettings,
} from "@/services/appsApi";
import { AppSettingsPanel } from "@/components/apps/AppSettingsPanel";

/**
 * Apps page — Phase 6.
 *
 * Two tabs:
 *   - Installed — apps already activated on this store. Toggle on/off,
 *     uninstall. Settings UI is deferred to the per-app detail panel
 *     (out of scope for v1; an opinionated SettingsForm based on the
 *     manifest schema lands in v2).
 *   - Catalog — every published app. Install button puts it in
 *     Installed. Idempotent install: clicking on an already-installed
 *     app re-enables (which is what merchants expect).
 *
 * No detail page yet — the install row carries everything we need to
 * surface today. Settings editor + delivery log come when the platform
 * has real apps to test against.
 */

export default function Apps() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  /** Which app's settings form is expanded. One at a time. */
  const [openSettings, setOpenSettings] = useState<string | null>(null);
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const { toast } = useToast();
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  /** The app's own name in the merchant's language, not the English column. */
  const text = (app: AppCatalogEntry) => {
    const l10n = app.listing?.app_locales?.[language] ?? app.listing?.app_locales?.en;
    return {
      name: l10n?.name || app.name,
      description: l10n?.description || app.description,
    };
  };
  const firstParty = (app: AppCatalogEntry) =>
    app.listing?.developer?.is_first_party ? (
      <Badge variant="secondary" className="gap-1">
        <BadgeCheck className="h-3 w-3" />
        {t("apps.firstParty")}
      </Badge>
    ) : app.listing?.developer?.name ? (
      <Badge variant="outline">
        {app.listing.developer.name} · {t("apps.partnerBadge")}
      </Badge>
    ) : null;

  const [catalog, setCatalog] = useState<AppCatalogEntry[] | null>(null);
  const [installs, setInstalls] = useState<AppInstallation[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const installedBySlug = useMemo(() => {
    const out: Record<string, AppInstallation> = {};
    for (const i of installs || []) out[i.slug] = i;
    return out;
  }, [installs]);

  async function refresh() {
    if (!storeId) return;
    try {
      const [cat, list] = await Promise.all([
        listAppCatalog(storeId),
        listAppInstallations(storeId),
      ]);
      setCatalog(cat);
      setInstalls(list);
    } catch (err) {
      toast({
        title: t("apps.loadFailed"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  async function withBusy(slug: string, fn: () => Promise<unknown>) {
    setBusy(slug);
    try {
      await fn();
      await refresh();
      // The sidebar reads installs too; a NUMU App's tab follows the install.
      void queryClient.invalidateQueries({ queryKey: ["apps", "installations"] });
    } catch (err) {
      toast({
        title: t("apps.actionFailed"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  if (!storeId) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("apps.title")}</CardTitle>
            <CardDescription>{t("apps.selectStore")}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
          {t("apps.title")}
        </h1>
        {/* The old copy promised theme-customizer blocks and SDK data, neither
            of which was true. An app configures itself here and renders through
            the theme's own components. */}
        <p className="text-sm text-muted-foreground mt-1">{t("apps.subtitle")}</p>
      </div>

      <Tabs defaultValue="installed">
        <TabsList>
          <TabsTrigger value="installed">
            {t("apps.installedTab")} (<bdi dir="ltr">{installs?.length ?? 0}</bdi>)
          </TabsTrigger>
          <TabsTrigger value="catalog">{t("apps.catalogTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="space-y-3 mt-4">
          {installs === null ? (
            <Skeleton className="h-24 w-full" />
          ) : installs.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                {t("apps.emptyInstalled")}
              </CardContent>
            </Card>
          ) : (
            installs.map((app) => (
              <Card key={app.slug}>
                <CardContent className="py-4 flex items-center gap-4">
                  {app.icon_url ? (
                    <img
                      src={app.icon_url}
                      alt=""
                      className="w-12 h-12 rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-muted" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{text(app).name}</div>
                      {firstParty(app)}
                      <Badge variant={app.is_live === false ? "outline" : "default"}>
                        {app.app_status === "suspended"
                          ? t("apps.suspended")
                          : app.is_enabled
                            ? t("apps.enabled")
                            : t("apps.disabled")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        v{app.version}
                      </span>
                    </div>
                    {text(app).description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {text(app).description}
                      </p>
                    )}
                    {app.blocks.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {app.blocks.length} block
                        {app.blocks.length === 1 ? "" : "s"}:{" "}
                        {app.blocks.map((b) => b.name).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {NUMU_APP_HOME[app.slug] && app.is_enabled && (
                      <Button size="sm" onClick={() => navigate(NUMU_APP_HOME[app.slug])}>
                        {t("apps.open")}
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/apps/${encodeURIComponent(app.slug)}`)}
                    >
                      {t("apps.viewDetails")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === app.slug}
                      onClick={() =>
                        withBusy(app.slug, () =>
                          app.is_enabled
                            ? disableApp(storeId, app.slug)
                            : enableApp(storeId, app.slug),
                        )
                      }
                    >
                      {busy === app.slug && (
                        <Loader2 className="me-2 h-3 w-3 animate-spin" />
                      )}
                      {app.is_enabled ? t("apps.disable") : t("apps.enable")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy === app.slug}
                      onClick={() => {
                        const key = NUMU_APP_HOME[app.slug] ? "apps.uninstallConfirm" : "apps.uninstallConfirmSettings";
                        if (!window.confirm(t(key, { name: text(app).name }))) return;
                        void withBusy(app.slug, () => uninstallApp(storeId, app.slug));
                      }}
                    >
                      {t("apps.uninstall")}
                    </Button>
                  </div>
                </CardContent>

                {/* Settings live on this page, not in the theme customizer:
                    they are store-wide and have no per-section meaning. */}
                {(app.settings_schema?.length ?? 0) > 0 && (
                  <CardContent className="border-t pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        setOpenSettings((cur) => (cur === app.slug ? null : app.slug))
                      }
                    >
                      {openSettings === app.slug
                        ? t("apps.hideSettings")
                        : t("apps.settings")}
                    </Button>
                    {openSettings === app.slug && (
                      <div className="mt-4">
                        <AppSettingsPanel
                          storeId={storeId}
                          app={app}
                          onSaved={(next) =>
                            setInstalls((cur) =>
                              (cur ?? []).map((a) =>
                                a.slug === next.slug ? next : a,
                              ),
                            )
                          }
                        />
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="catalog" className="space-y-3 mt-4">
          {catalog === null ? (
            <Skeleton className="h-24 w-full" />
          ) : catalog.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                {t("apps.emptyCatalog")}
              </CardContent>
            </Card>
          ) : (
            catalog.map((app) => {
              const installed = installedBySlug[app.slug];
              return (
                <Card key={app.slug}>
                  <CardContent className="py-4 flex items-center gap-4">
                    {app.icon_url ? (
                      <img
                        src={app.icon_url}
                        alt=""
                        className="w-12 h-12 rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{text(app).name}</div>
                        {firstParty(app)}
                        <span className="text-xs text-muted-foreground">
                          v{app.version}
                        </span>
                      </div>
                      {text(app).description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {text(app).description}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      disabled={busy === app.slug}
                      onClick={() =>
                        app.connect
                          ? // A Partner App installs through consent (OAuth).
                            navigate(consentPath(app.connect, storeId))
                          : withBusy(app.slug, () => installApp(storeId, app.slug))
                      }
                    >
                      {busy === app.slug && (
                        <Loader2 className="me-2 h-3 w-3 animate-spin" />
                      )}
                      {installed ? t("apps.reinstall") : t("apps.install")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/apps/${encodeURIComponent(app.slug)}`)}
                    >
                      {t("apps.viewDetails")}
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
