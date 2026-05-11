import { useEffect, useMemo, useState } from "react";
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
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  type AppCatalogEntry,
  type AppInstallation,
  disableApp,
  enableApp,
  installApp,
  listAppCatalog,
  listAppInstallations,
  uninstallApp,
} from "@/services/appsApi";

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
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const { toast } = useToast();

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
        title: "Failed to load apps",
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
    } catch (err) {
      toast({
        title: "Operation failed",
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
            <CardTitle>Apps</CardTitle>
            <CardDescription>Select a store to manage apps.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Apps</h1>
        <p className="text-sm text-muted-foreground">
          Extend your store with apps. Installed apps can render blocks
          in the theme customizer and surface data via the theme SDK.
        </p>
      </div>

      <Tabs defaultValue="installed">
        <TabsList>
          <TabsTrigger value="installed">
            Installed ({installs?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="space-y-3 mt-4">
          {installs === null ? (
            <Skeleton className="h-24 w-full" />
          ) : installs.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nothing installed yet. Browse the Catalog tab to add an app.
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
                      <div className="font-medium">{app.name}</div>
                      <Badge variant={app.is_enabled ? "default" : "outline"}>
                        {app.is_enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        v{app.version}
                      </span>
                    </div>
                    {app.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {app.description}
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
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      )}
                      {app.is_enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy === app.slug}
                      onClick={() =>
                        withBusy(app.slug, () =>
                          uninstallApp(storeId, app.slug),
                        )
                      }
                    >
                      Uninstall
                    </Button>
                  </div>
                </CardContent>
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
                No apps in the catalog yet. Check back soon.
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
                        <div className="font-medium">{app.name}</div>
                        <span className="text-xs text-muted-foreground">
                          v{app.version}
                        </span>
                      </div>
                      {app.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {app.description}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      disabled={busy === app.slug}
                      onClick={() =>
                        withBusy(app.slug, () => installApp(storeId, app.slug))
                      }
                    >
                      {busy === app.slug && (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      )}
                      {installed ? "Re-enable" : "Install"}
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
