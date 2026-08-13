import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  Bell,
  Check,
  ChevronDown,
  Languages,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  User,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getStoreUrl } from "@/lib/storefront";
import { SearchPalette } from "@/components/layout/SearchPalette";
import WalletHeaderChip from "@/components/wallet/WalletHeaderChip";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotifications";
import { getRealtimeSnapshot } from "@/services/analyticsApi";

const AppHeader = () => {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { user, logout } = useAuth();
  const { currentStore, stores, switchStore } = useDashboardStore();
  const navigate = useNavigate();
  const storeId = currentStore?.id;
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  const [searchOpen, setSearchOpen] = useState(false);

  // Bell-badge count = unread notifications, computed from the SAME data
  // the Notifications page renders (recent orders + the localStorage
  // read-id set). Previously this was `pending_orders + processing_orders`
  // from the dashboard-stats query — a totally different metric, which is
  // why marking a notification as read on the page did nothing for the
  // badge. The shared hook listens for mark-as-read events so the badge
  // updates the moment the user taps a notification.
  const unreadCount = useUnreadNotificationCount(storeId);

  // Live-visitor count in the header chip — refetches every 30s so the
  // number ticks in near-real-time without hammering the analytics endpoint.
  const realtimeQuery = useQuery({
    queryKey: ["header", "realtime", storeId],
    queryFn: () => getRealtimeSnapshot(storeId!),
    enabled: !!storeId,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
  const liveVisitors = realtimeQuery.data?.active_now ?? 0;

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  // ⌘K / Ctrl+K shortcut + programmatic open via window CustomEvent.
  // The MobileBottomNav uses `window.dispatchEvent(new CustomEvent("numu:open-search"))`
  // instead of dispatching a synthetic keyboard event (which is
  // unreliable for assistive tech).
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

  const openStore = useCallback(() => {
    if (!currentStore) return;
    // Prefer the env-aware storefront URL (v3 when configured) over the
    // backend's canonical store_url so "Visit store" matches the preview.
    const url =
      (currentStore.subdomain ? getStoreUrl(currentStore.subdomain) : null) ||
      currentStore.store_url ||
      null;
    if (url) window.open(url, "_blank");
  }, [currentStore]);

  return (
    <>
      <header className="dash-header">
        <SidebarTrigger
          className="h-[42px] w-[42px] rounded-xl bg-card border border-border hover:bg-muted"
          aria-label={language === "ar" ? "تبديل الشريط الجانبي" : "Toggle sidebar"}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Quick Actions Row — Souq chrome: chunky 42px icon buttons,
            warm hairline borders, ≥44px touch targets.
            min-w-0 so the store switcher inside can shrink at 360px instead of
            pushing the row past the viewport (see .dash-header). */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          {/* Search trigger — pill-shaped chip with card surface + border,
              matches NHUB's `.h-search`. */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex items-center gap-2.5 h-[42px] px-4 rounded-xl bg-card border border-border text-muted-foreground hover:border-[hsl(var(--border-strong))] transition-colors min-w-[220px]"
          >
            <Search className="h-[18px] w-[18px]" />
            <span className="text-sm">{t("header.search")}</span>
            <kbd className="ms-auto pointer-events-none hidden h-[22px] select-none items-center rounded-md border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground sm:flex">
              ⌘K
            </kbd>
          </button>

          {/* Mobile search */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-[42px] w-[42px] rounded-xl bg-card border border-border hover:bg-muted"
            onClick={() => setSearchOpen(true)}
            aria-label={t("header.search")}
          >
            <Search className="h-[18px] w-[18px]" />
          </Button>

          {/* Live-now chip — sage pulse dot + tabular visitor count.
              Matches the NHUB header spec; refetches every 30s via the
              realtime analytics endpoint. Hidden on tiny screens to
              keep the chrome from wrapping. */}
          <div
            className="hidden lg:inline-flex items-center gap-2 h-[42px] px-3.5 rounded-xl bg-card border border-border"
            title={language === "ar" ? "زوار يتصفحون متجرك دلوقتي" : "Visitors browsing your store right now"}
          >
            <span className="relative flex h-[9px] w-[9px]">
              {liveVisitors > 0 && (
                <span className="absolute inset-0 inline-flex rounded-full bg-sage opacity-50 animate-ping" />
              )}
              <span
                className={`relative inline-flex rounded-full h-[9px] w-[9px] ${liveVisitors > 0 ? "bg-sage" : "bg-ink-faint"}`}
              />
            </span>
            <span className="tabular-nums font-extrabold text-sm">
              {language === "ar" ? liveVisitors.toLocaleString("ar-EG") : liveVisitors.toLocaleString()}
            </span>
            <span className="text-ink-soft text-[13px] font-semibold">
              {language === "ar" ? "زائر دلوقتي" : "live now"}
            </span>
          </div>

          {/* Wallet chip — payg tenants only. Balance at rest, morphs
              into a primary "Manage wallet" action on hover (Salla-style);
              amber dot = on-hold credit, red = blocked/negative. */}
          <WalletHeaderChip />

          {/* Dark Mode */}
          <Button
            variant="ghost"
            size="icon"
            className="h-[42px] w-[42px] rounded-xl bg-card border border-border hover:bg-muted"
            onClick={toggleDark}
            aria-label={isDark ? (language === "ar" ? "وضع نهاري" : "Light mode") : (language === "ar" ? "وضع ليلي" : "Dark mode")}
          >
            {isDark ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
          </Button>

          {/* Language — label now always visible (was hidden < sm,
              leaving a globe icon with no affordance that it toggles
              language). "ع" / "EN" is a 1-char label that always fits. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === "en" ? "ar" : "en")}
            className="gap-1.5 text-sm font-bold h-[42px] rounded-xl px-3 bg-card border border-border hover:bg-muted"
            aria-label={language === "en" ? "Switch to Arabic" : "تبديل إلى الإنجليزية"}
          >
            <Languages className="h-[18px] w-[18px]" />
            <span>{language === "en" ? "ع" : "EN"}</span>
          </Button>

          {/* Store Selector */}
          {stores.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 max-w-[104px] sm:max-w-[180px] h-[42px] rounded-xl px-2.5 sm:px-3 bg-card border border-border hover:bg-muted"
                >
                  {currentStore?.logo_url ? (
                    <img
                      src={currentStore.logo_url}
                      alt=""
                      width={24}
                      height={24}
                      loading="lazy"
                      className="h-6 w-6 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-navy text-[10px] font-bold text-white shrink-0">
                      {currentStore?.name?.charAt(0)?.toUpperCase() || "S"}
                    </div>
                  )}
                  <span className="hidden text-sm font-semibold sm:inline truncate">
                    {currentStore?.name || "Store"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {language === "ar" ? "متاجرك" : "Your Stores"}
                </DropdownMenuLabel>
                {stores.map((store) => (
                  <DropdownMenuItem
                    key={store.id}
                    onClick={() => switchStore(store.id)}
                    className="gap-2 rounded-lg"
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-[9px] font-bold text-primary shrink-0">
                      {store.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate flex-1 text-sm">
                      {store.name}
                    </span>
                    {store.id === currentStore?.id && (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                {/* Open store link */}
                <DropdownMenuItem
                  onClick={openStore}
                  className="gap-2 rounded-lg"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="text-sm">
                    {language === "ar" ? "فتح المتجر" : "Open store"}
                  </span>
                </DropdownMenuItem>
                {/* Create new store */}
                <DropdownMenuItem
                  onClick={() => navigate("/create-store")}
                  className="gap-2 rounded-lg"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="text-sm">
                    {language === "ar" ? "متجر جديد" : "New store"}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Notifications — Souq icon button with saffron dot when unread */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-[42px] w-[42px] rounded-xl bg-card border border-border hover:bg-muted"
            onClick={() => navigate("/notifications")}
            aria-label={language === "ar"
              ? (unreadCount > 0 ? `الإشعارات (${unreadCount} غير مقروءة)` : "الإشعارات")
              : (unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications")}
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 end-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-saffron text-[10px] font-bold text-navy-900 px-1 ring-2 ring-card">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>

          {/* Profile — rich panel */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2.5 h-[42px] rounded-xl ps-2 pe-3 bg-card border border-border hover:bg-muted"
              >
                <span className="hidden text-sm font-semibold text-muted-foreground sm:block max-w-[160px] truncate">
                  {user?.email}
                </span>
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
                    width={28}
                    height={28}
                    loading="lazy"
                    className="h-7 w-7 rounded-full object-cover ring-2 ring-border"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">
                    {user?.first_name?.charAt(0)?.toUpperCase() || "N"}
                  </div>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-64 rounded-xl p-0 overflow-hidden"
            >
              {/* Store section */}
              <div className="p-4 bg-muted/30 border-b">
                <div className="flex items-center gap-3 mb-3">
                  {currentStore?.logo_url ? (
                    <img
                      src={currentStore.logo_url}
                      alt=""
                      width={40}
                      height={40}
                      loading="lazy"
                      className="h-10 w-10 rounded-xl object-cover border shadow-sm"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                      {currentStore?.name?.charAt(0)?.toUpperCase() || "N"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">
                      {currentStore?.name || "Store"}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">
                      {currentStore?.id?.slice(0, 8) || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {language === "ar" ? "الخطة الحالية" : "Current Plan"}
                  </span>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 text-[11px] rounded-lg px-3"
                    onClick={() => navigate("/store")}
                  >
                    {language === "ar" ? "إدارة" : "Manage"}
                  </Button>
                </div>
              </div>
              {/* User section */}
              <div className="p-3 border-b">
                <div className="flex items-center gap-2.5">
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt=""
                      width={32}
                      height={32}
                      loading="lazy"
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {user?.first_name?.charAt(0)?.toUpperCase() || "N"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </div>
              {/* Menu items */}
              <div className="p-1.5">
                <DropdownMenuItem
                  className="gap-2.5 rounded-lg text-xs py-2 cursor-pointer"
                  onClick={() => navigate("/profile")}
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {language === "ar" ? "الملف الشخصي" : "Profile"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2.5 rounded-lg text-xs py-2 cursor-pointer"
                  onClick={() => navigate("/settings")}
                >
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                  {language === "ar" ? "الإعدادات" : "Settings"}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  className="gap-2.5 rounded-lg text-xs py-2 text-destructive cursor-pointer"
                  onClick={logout}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {language === "ar" ? "تسجيل الخروج" : "Logout"}
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Search Palette */}
      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
};

export default AppHeader;
