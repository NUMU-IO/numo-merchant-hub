import { FounderBadge, FounderRing } from "@/components/brand/FounderBadge";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  ChevronDown,
  ExternalLink,
  Languages,
  Loader2,
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { getPublicStoreUrl } from "@/lib/storefront";
import { SearchPalette } from "@/components/layout/SearchPalette";
import WalletHeaderChip from "@/components/wallet/WalletHeaderChip";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { AddMenu } from "@/components/layout/AddMenu";
import { PagesMenu } from "@/components/layout/PagesMenu";
import { getRealtimeSnapshot } from "@/services/analyticsApi";
import { cn } from "@/lib/utils";

/** Shared look for the on-navy icon buttons. */
const topbarBtn =
  "h-10 w-10 rounded-lg text-white/90 hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40";

/**
 * Full-width navy top bar (Zid-style): sidebar trigger + brand on the
 * start side; search, live chip, wallet, then a grouped icon cluster
 * (theme · language · notifications · open store) and the account menu
 * on the end side. The sidebar hangs beneath it.
 */
const AppHeader = () => {
  const { t } = useTranslation();
  const { language, setLanguage, isSwitching } = useLanguage();
  const { user, logout, tenant } = useAuth();
  const { currentStore } = useDashboardStore();
  const navigate = useNavigate();
  const storeId = currentStore?.id;
  const isAr = language === "ar";
  // next-themes owns the `.dark` class + `localStorage.theme`; the
  // blocking script in index.html applies it before first paint.
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [searchOpen, setSearchOpen] = useState(false);

  // Live-visitor count — refetches every 30s.
  const realtimeQuery = useQuery({
    // Same key as the Live analytics tab so the two 30 s polls dedupe into one.
    queryKey: ["analytics", "realtime-snapshot", storeId],
    queryFn: () => getRealtimeSnapshot(storeId!),
    enabled: !!storeId,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
  const liveVisitors = realtimeQuery.data?.active_now ?? 0;

  const toggleDark = () => setTheme(isDark ? "light" : "dark");

  // ⌘K / Ctrl+K + the `numu:open-search` CustomEvent from MobileBottomNav.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    const openHandler = () => setSearchOpen(true);
    document.addEventListener("keydown", down);
    window.addEventListener("numu:open-search", openHandler);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("numu:open-search", openHandler);
    };
  }, []);

  const storeUrl = currentStore
    ? getPublicStoreUrl(currentStore) || currentStore.store_url || null
    : null;
  const openStore = useCallback(() => {
    if (storeUrl) window.open(storeUrl, "_blank", "noopener");
  }, [storeUrl]);

  return (
    <>
      <header className="dash-header">
        {/* Start: sidebar trigger + brand */}
        <SidebarTrigger className={cn(topbarBtn, "shrink-0")} aria-label={t("header.toggleSidebar")} />
        <Link to="/" className="flex items-center gap-2 ps-1 pe-2 shrink-0" aria-label="NUMU">
          <img src="/brand/numu-cream.png" alt="" className="h-8 w-auto" />
          <span className="souq-wordmark hidden text-[20px] !text-white sm:inline">
            {isAr ? "نُمُو" : <span className="lowercase">numu</span>}
          </span>
        </Link>

        {/* "+ Add" — Zid-style quick-create menu next to the brand */}
        <AddMenu className="ms-1" />

        {/* Center: search pill (Zid puts search in the middle of the bar) */}
        <div className="hidden min-w-0 flex-1 justify-center px-3 md:flex">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-10 w-full max-w-[460px] items-center gap-2.5 rounded-xl border border-white/15 bg-white/10 px-3.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <Search className="h-[17px] w-[17px]" />
            <span className="truncate text-[13px]">{t("header.search")}</span>
            <kbd className="ms-auto pointer-events-none hidden h-[20px] select-none items-center rounded-md border border-white/20 bg-white/10 px-1.5 font-mono text-[10.5px] font-medium text-white/70 sm:flex">
              Ctrl+K
            </kbd>
          </button>
        </div>
        <div className="flex-1 md:hidden" />

        {/* End: controls */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={cn(topbarBtn, "md:hidden")}
            onClick={() => setSearchOpen(true)}
            aria-label={t("header.search")}
          >
            <Search className="h-[18px] w-[18px]" />
          </Button>

          {/* Live-now chip */}
          <div
            className="hidden lg:inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 text-white"
            title={t("header.liveNowTitle")}
          >
            <span className="relative flex h-[9px] w-[9px]">
              {liveVisitors > 0 && (
                <span className="absolute inset-0 inline-flex rounded-full bg-sage opacity-60 animate-ping" />
              )}
              <span className={cn("relative inline-flex h-[9px] w-[9px] rounded-full", liveVisitors > 0 ? "bg-sage" : "bg-white/40")} />
            </span>
            <span className="tabular-nums text-sm font-extrabold">
              {isAr ? liveVisitors.toLocaleString("ar-EG") : liveVisitors.toLocaleString()}
            </span>
            <span className="text-[12.5px] font-semibold text-white/70">{t("header.liveNow")}</span>
          </div>

          {/* Founder chip — on the top bar itself, not inside the profile
              dropdown. The first cut put it in the dropdown panel, where a
              merchant would only meet it by opening a menu they have no
              reason to open. The badge is recognition; it has to be visible
              without being hunted for.

              Tuned for the navy bar rather than reusing the light-surface
              chip: saffron-600 text on a dark ground fails contrast. */}
          {tenant?.founder_cohort && (
            <span
              title={isAr ? `تاجر مؤسس · فوج ${tenant.founder_cohort}` : `Founder merchant · class of ${tenant.founder_cohort}`}
              className="hidden items-center gap-1.5 rounded-lg border border-saffron/35 bg-saffron/15 px-2.5 py-1 text-[12px] font-semibold text-saffron sm:inline-flex"
            >
              <svg viewBox="0 0 100 100" aria-hidden="true" className="h-3.5 w-3.5">
                <path
                  d="M50.00 2.00 64.06 16.06 83.94 16.06 83.94 35.94 98.00 50.00 83.94 64.06 83.94 83.94 64.06 83.94 50.00 98.00 35.94 83.94 16.06 83.94 16.06 64.06 2.00 50.00 16.06 35.94 16.06 16.06 35.94 16.06Z"
                  fill="currentColor"
                />
              </svg>
              {isAr ? "تاجر مؤسس" : "Founder"}
            </span>
          )}

          {/* Wallet chip — payg tenants only */}
          <WalletHeaderChip />

          {/* Grouped icon cluster */}
          <div className="flex items-center rounded-xl border border-white/15 bg-white/10 p-0.5">
            <Button
              variant="ghost"
              size="icon"
              className={cn(topbarBtn, "hidden sm:inline-flex")}
              onClick={toggleDark}
              aria-label={isDark ? t("header.lightMode") : t("header.darkMode")}
            >
              {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </Button>
            <span className="mx-0.5 hidden h-5 w-px bg-white/15 sm:block" aria-hidden />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void setLanguage(isAr ? "en" : "ar")}
              disabled={isSwitching}
              aria-busy={isSwitching}
              className={cn(topbarBtn, "w-auto gap-1.5 px-2.5 text-sm font-bold")}
              aria-label={isAr ? t("header.switchToEnglish") : t("header.switchToArabic")}
            >
              {isSwitching ? (
                <Loader2 className="h-[17px] w-[17px] animate-spin" />
              ) : (
                <Languages className="h-[17px] w-[17px]" />
              )}
              <span>{isAr ? "EN" : "ع"}</span>
            </Button>
            <span className="mx-0.5 hidden h-5 w-px bg-white/15 sm:block" aria-hidden />
            <PagesMenu className={cn(topbarBtn, "hidden sm:inline-flex")} />
            <span className="mx-0.5 h-5 w-px bg-white/15" aria-hidden />
            <NotificationBell className={topbarBtn} />
            {storeUrl && (
              <>
                <span className="mx-0.5 hidden h-5 w-px bg-white/15 sm:block" aria-hidden />
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(topbarBtn, "hidden sm:inline-flex")}
                  onClick={openStore}
                  aria-label={t("header.openStore")}
                  title={t("header.openStore")}
                >
                  <ExternalLink className="h-[17px] w-[17px]" />
                </Button>
              </>
            )}
          </div>

          {/* Account menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(topbarBtn, "w-auto gap-2 ps-1.5 pe-2")}
                aria-label={t("header.profile")}
              >
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" width={28} height={28} loading="lazy" className="h-7 w-7 rounded-full object-cover ring-2 ring-white/30" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-saffron text-[11px] font-bold text-navy-900">
                    {user?.first_name?.charAt(0)?.toUpperCase() || "N"}
                  </div>
                )}
                <ChevronDown className="hidden h-3.5 w-3.5 text-white/70 sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 overflow-hidden rounded-xl p-0">
              <div className="border-b bg-muted/30 p-4">
                <div className="mb-3 flex items-center gap-3">
                  <FounderRing cohort={tenant?.founder_cohort} className="rounded-xl">
                    {currentStore?.logo_url ? (
                      <img src={currentStore.logo_url} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 rounded-xl border object-cover shadow-sm" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                        {currentStore?.name?.charAt(0)?.toUpperCase() || "N"}
                      </div>
                    )}
                  </FounderRing>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                      {currentStore?.name || "Store"}
                      <FounderBadge cohort={tenant?.founder_cohort} size="mark" />
                    </p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">{currentStore?.id?.slice(0, 8) || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    {t("header.currentPlan")}
                  </span>
                  <Button variant="default" size="sm" className="h-7 rounded-lg px-3 text-[11px]" onClick={() => navigate("/store")}>
                    {t("header.manage")}
                  </Button>
                </div>
              </div>
              <div className="border-b p-3">
                <div className="flex items-center gap-2.5">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="" width={32} height={32} loading="lazy" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {user?.first_name?.charAt(0)?.toUpperCase() || "N"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">{user?.first_name} {user?.last_name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
              </div>
              <div className="p-1.5">
                <DropdownMenuItem className="cursor-pointer gap-2.5 rounded-lg py-2 text-xs" onClick={() => navigate("/profile")}>
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("header.profile")}
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer gap-2.5 rounded-lg py-2 text-xs" onClick={() => navigate("/settings")}>
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("header.settings")}
                </DropdownMenuItem>
                {storeUrl && (
                  <DropdownMenuItem className="cursor-pointer gap-2.5 rounded-lg py-2 text-xs sm:hidden" onClick={openStore}>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("header.openStore")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="cursor-pointer gap-2.5 rounded-lg py-2 text-xs sm:hidden" onClick={toggleDark}>
                  {isDark ? <Sun className="h-3.5 w-3.5 text-muted-foreground" /> : <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
                  {isDark ? t("header.lightMode") : t("header.darkMode")}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem className="cursor-pointer gap-2.5 rounded-lg py-2 text-xs text-destructive" onClick={logout}>
                  <LogOut className="h-3.5 w-3.5" />
                  {t("header.logout")}
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
};

export default AppHeader;
