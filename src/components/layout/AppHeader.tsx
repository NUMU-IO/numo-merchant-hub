import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  Bell,
  Check,
  ChevronDown,
  Globe,
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
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/services/analyticsApi";
import { getStoreUrl } from "@/lib/storefront";
import { SearchPalette } from "@/components/layout/SearchPalette";

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

  // Pending orders count for notification badge
  const statsQuery = useQuery({
    queryKey: ["header-stats", storeId],
    queryFn: () => getDashboardStats(storeId!, 7),
    enabled: !!storeId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const pendingCount =
    (statsQuery.data?.pending_orders ?? 0) +
    (statsQuery.data?.processing_orders ?? 0);

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

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const openStore = useCallback(() => {
    if (!currentStore) return;
    const url =
      currentStore.store_url ||
      (currentStore.subdomain ? getStoreUrl(currentStore.subdomain) : null);
    if (url) window.open(url, "_blank");
  }, [currentStore]);

  return (
    <>
      <header className="dash-header">
        <SidebarTrigger className="h-8 w-8" />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Quick Actions Row */}
        <div className="flex items-center gap-1">
          {/* Search trigger */}
          <Button
            variant="ghost"
            size="sm"
            className="hidden md:flex gap-2 h-8 rounded-lg text-muted-foreground hover:text-foreground px-3"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-3.5 w-3.5" />
            <span className="text-xs">{t("header.search")}</span>
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
              ⌘K
            </kbd>
          </Button>

          {/* Mobile search */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8 rounded-lg"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-3.5 w-3.5" />
          </Button>

          {/* Dark Mode */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={toggleDark}
          >
            {isDark ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
          </Button>

          {/* Language */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === "en" ? "ar" : "en")}
            className="gap-1.5 text-xs h-8 rounded-lg px-2.5"
          >
            <Globe className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {language === "en" ? "AR" : "EN"}
            </span>
          </Button>

          {/* Store Selector */}
          {stores.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 max-w-[160px] h-8 rounded-lg px-2.5"
                >
                  {currentStore?.logo_url ? (
                    <img
                      src={currentStore.logo_url}
                      alt=""
                      width={20}
                      height={20}
                      loading="lazy"
                      className="h-5 w-5 rounded-md object-cover shrink-0"
                    />
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary text-[9px] font-bold text-primary-foreground shrink-0">
                      {currentStore?.name?.charAt(0)?.toUpperCase() || "S"}
                    </div>
                  )}
                  <span className="hidden text-xs font-medium sm:inline truncate">
                    {currentStore?.name || "Store"}
                  </span>
                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
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

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8 rounded-lg"
            onClick={() => navigate("/notifications")}
          >
            <Bell className="h-3.5 w-3.5" />
            {pendingCount > 0 && (
              <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground px-1">
                {pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </Button>

          {/* Profile — rich panel */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 h-8 rounded-lg ps-1.5 pe-2"
              >
                <span className="hidden text-xs font-medium text-muted-foreground sm:block max-w-[160px] truncate">
                  {user?.email}
                </span>
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
                    width={24}
                    height={24}
                    loading="lazy"
                    className="h-6 w-6 rounded-full object-cover ring-2 ring-border"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {user?.first_name?.charAt(0)?.toUpperCase() || "N"}
                  </div>
                )}
                <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
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
