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
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowUpRight, BadgeCheck, Blocks, CheckCircle2, ExternalLink, Loader2,
  MoreHorizontal, Power, Puzzle, Search, Settings2, ShieldCheck, Sparkles,
  Trash2,
} from "lucide-react";
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
  const { language, isRTL } = useLanguage();
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
  /** A priced app's listing label ("EGP 99 / month"), already localized. */
  const price = (app: AppCatalogEntry) => {
    const pricing = app.listing?.pricing;
    const label = pricing?.locales?.[language]?.label ?? pricing?.locales?.en?.label;
    return pricing?.plan && pricing.plan !== "free" && label ? (
      <Badge variant="secondary" className="font-medium">
        {label}
      </Badge>
    ) : null;
  };

  const [catalog, setCatalog] = useState<AppCatalogEntry[] | null>(null);
  const [installs, setInstalls] = useState<AppInstallation[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("installed");
  const [catalogSearch, setCatalogSearch] = useState("");

  const installedBySlug = useMemo(() => {
    const out: Record<string, AppInstallation> = {};
    for (const i of installs || []) out[i.slug] = i;
    return out;
  }, [installs]);

  const visibleCatalog = useMemo(() => {
    const needle = catalogSearch.trim().toLocaleLowerCase(language);
    if (!needle) return catalog ?? [];
    return (catalog ?? []).filter((app) => {
      const copy = text(app);
      return `${copy.name} ${copy.description ?? ""} ${app.slug}`
        .toLocaleLowerCase(language)
        .includes(needle);
    });
    // `text` follows the active language and intentionally stays local to the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, catalogSearch, language]);

  const enabledCount = installs?.filter((app) => app.is_live).length ?? 0;
  const availableCount = catalog?.length ?? 0;

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
    <div className="min-w-0 space-y-6 overflow-x-hidden p-4 sm:p-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-navy-800 to-[#173f68] px-5 py-7 text-white shadow-card sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -end-16 -top-20 h-64 w-64 rounded-full bg-saffron/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 start-1/3 h-56 w-56 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div className="max-w-2xl">
            <Badge className="mb-4 gap-1.5 border-white/15 bg-white/10 text-white hover:bg-white/10">
              <Sparkles className="h-3 w-3 text-saffron" />
              {isRTL ? "متجر تطبيقات نمو" : "NUMU App Store"}
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {isRTL ? "طوّر متجرك بتطبيقات تعمل معك" : "Grow your store with apps that work for you"}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
              {isRTL
                ? "أضف أدوات جديدة لمتجرك، وفعّلها أو أوقفها من مكان واحد. التطبيقات تتكامل مع واجهة متجرك تلقائيًا."
                : "Add new capabilities, manage what is live, and keep every integration in one place. Installed apps connect to your storefront automatically."}
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Button variant="accent" className="gap-2" onClick={() => setActiveTab("catalog")}>
                <Puzzle className="h-4 w-4" />
                {isRTL ? "استكشف التطبيقات" : "Explore apps"}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
              {enabledCount > 0 && (
                <Button className="gap-2 border border-white/20 bg-white/10 text-white shadow-none hover:bg-white/15" onClick={() => setActiveTab("installed")}>
                  <CheckCircle2 className="h-4 w-4" />
                  {isRTL ? "إدارة التطبيقات المفعّلة" : "Manage active apps"}
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-1">
            {[
              { label: isRTL ? "مثبّت" : "Installed", value: installs?.length ?? "—", Icon: Blocks },
              { label: isRTL ? "مفعّل" : "Live", value: enabledCount, Icon: CheckCircle2 },
              { label: isRTL ? "متاح" : "Available", value: availableCount, Icon: Puzzle },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.08] p-3 backdrop-blur-sm sm:p-4 lg:flex lg:items-center lg:gap-3">
                <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-saffron lg:mb-0">
                  <stat.Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xl font-extrabold tabular-nums sm:text-2xl">{stat.value}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/55">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            Icon: ShieldCheck,
            title: isRTL ? "تثبيت آمن" : "Safe installs",
            body: isRTL ? "راجع التفاصيل والصلاحيات قبل التثبيت." : "Review app details and permissions before installing.",
          },
          {
            Icon: Settings2,
            title: isRTL ? "تحكم من مكان واحد" : "One place to manage",
            body: isRTL ? "الإعدادات والتشغيل والإيقاف دائمًا في متناولك." : "Settings, enablement, and app status stay within reach.",
          },
          {
            Icon: Sparkles,
            title: isRTL ? "متوافق مع متجرك" : "Built for your storefront",
            body: isRTL ? "التطبيقات تظهر في الثيم بدون تعديل الكود." : "Apps appear through your theme without editing code.",
          },
        ].map((item) => (
          <div key={item.title} className="flex gap-3 rounded-2xl border bg-card p-4 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <item.Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} dir={language === "ar" ? "rtl" : "ltr"} className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">
              {activeTab === "installed"
                ? (isRTL ? "تطبيقات متجرك" : "Your apps")
                : (isRTL ? "اكتشف التطبيقات" : "Discover apps")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeTab === "installed"
                ? (isRTL ? "تحكم في التطبيقات المثبتة وحالتها وإعداداتها." : "Manage installed apps, storefront status, and settings.")
                : (isRTL ? "اختر أدوات جديدة تناسب طريقة عمل متجرك." : "Find tools that fit how your store works.")}
            </p>
          </div>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="installed" className="flex-1 sm:flex-none">
              {t("apps.installedTab")} (<bdi dir="ltr">{installs?.length ?? 0}</bdi>)
            </TabsTrigger>
            <TabsTrigger value="catalog" className="flex-1 sm:flex-none">
              {t("apps.catalogTab")} (<bdi dir="ltr">{availableCount}</bdi>)
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="installed" className="mt-0 space-y-4">
          {installs === null ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-56 w-full rounded-2xl" />
              <Skeleton className="h-56 w-full rounded-2xl" />
            </div>
          ) : installs.length === 0 ? (
            <Card className="overflow-hidden border-dashed">
              <CardContent className="flex flex-col items-center px-6 py-14 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                  <Puzzle className="h-8 w-8" />
                </span>
                <h3 className="mt-5 text-lg font-bold">{isRTL ? "ابدأ بأول تطبيق" : "Install your first app"}</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{t("apps.emptyInstalled")}</p>
                <Button className="mt-5 gap-2" onClick={() => setActiveTab("catalog")}>
                  {isRTL ? "تصفح الكتالوج" : "Browse app catalog"}
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {installs.map((app) => {
                const appCopy = text(app);
                const isBusy = busy === app.slug;
                return (
                  <Card key={app.slug} className="group min-w-0 overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex min-w-0 items-start gap-4">
                        {app.icon_url ? (
                          <img src={app.icon_url} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-border" />
                        ) : (
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary ring-1 ring-border">
                            <Puzzle className="h-6 w-6" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-extrabold">{appCopy.name}</h3>
                            <Badge className={app.is_live ? "bg-emerald-600 text-white hover:bg-emerald-600" : "bg-muted text-muted-foreground hover:bg-muted"}>
                              <span className={`me-1.5 h-1.5 w-1.5 rounded-full ${app.is_live ? "bg-white" : "bg-muted-foreground"}`} />
                              {app.app_status === "suspended"
                                ? t("apps.suspended")
                                : app.is_live
                                  ? (isRTL ? "مباشر" : "Live")
                                  : t("apps.disabled")}
                            </Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span>v{app.version}</span>
                            {firstParty(app)}
                            {price(app)}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={isRTL ? "المزيد" : "More app actions"}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => navigate(`/apps/${encodeURIComponent(app.slug)}`)}>
                              <ExternalLink className="me-2 h-4 w-4" />
                              {t("apps.viewDetails")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              disabled={isBusy}
                              onClick={() => {
                                const key = NUMU_APP_HOME[app.slug] ? "apps.uninstallConfirm" : "apps.uninstallConfirmSettings";
                                if (!window.confirm(t(key, { name: appCopy.name }))) return;
                                void withBusy(app.slug, () => uninstallApp(storeId, app.slug));
                              }}
                            >
                              <Trash2 className="me-2 h-4 w-4" />
                              {t("apps.uninstall")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {appCopy.description && (
                        <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-relaxed text-muted-foreground">{appCopy.description}</p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {app.blocks.slice(0, 3).map((block) => (
                          <Badge key={block.type} variant="outline" className="font-normal text-muted-foreground">
                            <Blocks className="me-1 h-3 w-3" />
                            {block.name}
                          </Badge>
                        ))}
                        {(app.settings_schema?.length ?? 0) > 0 && (
                          <Badge variant="outline" className="font-normal text-muted-foreground">
                            <Settings2 className="me-1 h-3 w-3" />
                            {app.settings_schema!.length} {isRTL ? "إعدادات" : "settings"}
                          </Badge>
                        )}
                        {(app.missing_scopes?.length ?? 0) > 0 && (
                          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                            {isRTL ? "يحتاج مراجعة صلاحيات" : "Permission review needed"}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border/60 pt-4">
                        {NUMU_APP_HOME[app.slug] && app.is_enabled ? (
                          <Button className="gap-2" onClick={() => navigate(NUMU_APP_HOME[app.slug])}>
                            {t("apps.open")}
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button variant="secondary" onClick={() => navigate(`/apps/${encodeURIComponent(app.slug)}`)}>
                            {t("apps.viewDetails")}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="gap-2"
                          disabled={isBusy || app.app_status === "suspended"}
                          onClick={() => withBusy(app.slug, () => app.is_enabled ? disableApp(storeId, app.slug) : enableApp(storeId, app.slug))}
                        >
                          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                          {app.is_enabled ? t("apps.disable") : t("apps.enable")}
                        </Button>
                      </div>
                    </CardContent>

                    {(app.settings_schema?.length ?? 0) > 0 && (
                      <CardContent className="border-t bg-muted/15 p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-2 px-2 text-xs"
                          onClick={() => setOpenSettings((cur) => cur === app.slug ? null : app.slug)}
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                          {openSettings === app.slug ? t("apps.hideSettings") : t("apps.settings")}
                        </Button>
                        {openSettings === app.slug && (
                          <div className="mt-4 rounded-xl border bg-card p-4">
                            <AppSettingsPanel
                              storeId={storeId}
                              app={app}
                              onSaved={(next) => setInstalls((cur) => (cur ?? []).map((item) => item.slug === next.slug ? next : item))}
                            />
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="catalog" className="mt-0 space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold">{isRTL ? "كل التطبيقات" : "All apps"}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isRTL ? `${availableCount} تطبيق متاح لمتجرك` : `${availableCount} apps available for your store`}
              </p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={catalogSearch}
                onChange={(event) => setCatalogSearch(event.target.value)}
                placeholder={isRTL ? "ابحث عن تطبيق..." : "Search apps..."}
                className="ps-9"
              />
            </div>
          </div>

          {catalog === null ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-72 rounded-2xl" />)}
            </div>
          ) : visibleCatalog.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center py-12 text-center">
                <Search className="h-8 w-8 text-muted-foreground/50" />
                <h3 className="mt-4 font-bold">{isRTL ? "لا توجد تطبيقات مطابقة" : "No matching apps"}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{isRTL ? "جرّب كلمة بحث مختلفة." : "Try a different search term."}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleCatalog.map((app) => {
                const appCopy = text(app);
                const installed = installedBySlug[app.slug];
                const tagline = app.listing?.locales?.[language]?.tagline ?? app.listing?.locales?.en?.tagline;
                const highlights = (app.listing?.highlights ?? [])
                  .map((highlight) => highlight.locales?.[language]?.text ?? highlight.locales?.en?.text)
                  .filter((value): value is string => Boolean(value))
                  .slice(0, 2);
                return (
                  <Card key={app.slug} className="group flex min-w-0 flex-col overflow-hidden transition-shadow hover:shadow-md">
                    <CardContent className="flex flex-1 flex-col p-5">
                      <div className="flex items-start gap-3">
                        {app.icon_url ? (
                          <img src={app.icon_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-border" />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary ring-1 ring-border">
                            <Puzzle className="h-5 w-5" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-base font-extrabold">{appCopy.name}</h3>
                            {installed && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label={t("apps.installed")} />}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {firstParty(app)}
                            {price(app)}
                          </div>
                        </div>
                      </div>

                      <p className="mt-4 line-clamp-3 min-h-[3.75rem] text-sm leading-relaxed text-muted-foreground">
                        {tagline || appCopy.description || (isRTL ? "تفاصيل التطبيق متاحة في صفحة العرض." : "Open the listing to learn more about this app.")}
                      </p>

                      {highlights.length > 0 && (
                        <ul className="mt-4 space-y-2">
                          {highlights.map((highlight) => (
                            <li key={highlight} className="flex items-start gap-2 text-xs text-foreground/80">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                              <span className="line-clamp-2">{highlight}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
                        {(app.listing?.languages ?? []).slice(0, 3).map((locale) => (
                          <Badge key={locale} variant="outline" className="text-[10px] font-normal uppercase text-muted-foreground">{locale}</Badge>
                        ))}
                        {app.blocks.length > 0 && (
                          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                            <Blocks className="me-1 h-3 w-3" />
                            {app.blocks.length} {isRTL ? "كتل" : app.blocks.length === 1 ? "block" : "blocks"}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border/60 pt-4">
                        <Button
                          disabled={busy === app.slug}
                          onClick={() => app.connect
                            ? navigate(consentPath(app.connect, storeId))
                            : withBusy(app.slug, () => installApp(storeId, app.slug))}
                        >
                          {busy === app.slug && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                          {installed ? t("apps.reinstall") : t("apps.install")}
                        </Button>
                        <Button variant="outline" onClick={() => navigate(`/apps/${encodeURIComponent(app.slug)}`)}>
                          {t("apps.viewDetails")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
