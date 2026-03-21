import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  Bell, Check, ChevronDown, Globe, LogOut, Moon, Plus, Search, Settings, Sun, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const AppHeader = () => {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { user, logout } = useAuth();
  const { currentStore, stores, switchStore } = useDashboardStore();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );

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

  return (
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
        >
          <Search className="h-3.5 w-3.5" />
          <span className="text-xs">{t("header.search")}</span>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            ⌘K
          </kbd>
        </Button>

        {/* Dark Mode */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={toggleDark}
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </Button>

        {/* Language */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLanguage(language === "en" ? "ar" : "en")}
          className="gap-1.5 text-xs h-8 rounded-lg px-2.5"
        >
          <Globe className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{language === "en" ? "AR" : "EN"}</span>
        </Button>

        {/* Store Selector */}
        {stores.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 max-w-[160px] h-8 rounded-lg px-2.5">
                {currentStore?.logo_url ? (
                  <img src={currentStore.logo_url} alt="" className="h-5 w-5 rounded-md object-cover shrink-0" />
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
            <DropdownMenuContent align="end" className="w-52 rounded-xl">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {language === "ar" ? "متاجرك" : "Your Stores"}
              </DropdownMenuLabel>
              {stores.map((store) => (
                <DropdownMenuItem key={store.id} onClick={() => switchStore(store.id)} className="gap-2 rounded-lg">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-[9px] font-bold text-primary shrink-0">
                    {store.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate flex-1 text-sm">{store.name}</span>
                  {store.id === currentStore?.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/create-store")} className="gap-2 rounded-lg">
                <Plus className="h-3.5 w-3.5" />
                <span className="text-sm">{language === "ar" ? "متجر جديد" : "New store"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-lg" onClick={() => navigate("/notifications")}>
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute top-1 end-1 h-1.5 w-1.5 rounded-full bg-destructive" />
        </Button>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 h-8 rounded-lg ps-1.5 pe-2">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {user?.first_name?.charAt(0)?.toUpperCase() || "N"}
                </div>
              )}
              <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-0.5">
                <p className="text-sm font-medium">{user?.first_name} {user?.last_name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 rounded-lg text-sm" onClick={() => navigate("/profile")}>
              <User className="h-3.5 w-3.5" />
              {t("header.profile")}
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-lg text-sm" onClick={() => navigate("/settings")}>
              <Settings className="h-3.5 w-3.5" />
              {t("header.settings")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 rounded-lg text-sm text-destructive" onClick={logout}>
              <LogOut className="h-3.5 w-3.5" />
              {t("header.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default AppHeader;
