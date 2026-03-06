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
import { Input } from "@/components/ui/input";
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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur-sm px-4">
      <SidebarTrigger />

      {/* Search */}
      <div className="relative hidden md:flex max-w-xs flex-1">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("header.search")}
          className="ps-9 h-9 rounded-lg bg-muted/50 border-transparent focus:border-border text-sm"
        />
      </div>

      <div className="flex-1" />

      {/* Dark Mode Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-lg"
        onClick={toggleDark}
        title={isDark ? t("header.lightMode") : t("header.darkMode")}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      {/* Language Switcher */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLanguage(language === "en" ? "ar" : "en")}
        className="gap-1.5 text-sm font-medium h-9 rounded-lg"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{language === "en" ? "العربية" : "English"}</span>
      </Button>

      {/* Store Selector */}
      {stores.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 max-w-[180px] h-9 rounded-lg">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground shrink-0">
                {currentStore?.name?.charAt(0)?.toUpperCase() || "S"}
              </div>
              <span className="hidden text-sm font-medium sm:inline truncate">
                {currentStore?.name || (language === "ar" ? "اختر متجر" : "Select store")}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{language === "ar" ? "متاجرك" : "Your Stores"}</DropdownMenuLabel>
            {stores.map((store) => (
              <DropdownMenuItem key={store.id} onClick={() => switchStore(store.id)} className="gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary shrink-0">
                  {store.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate flex-1">{store.name}</span>
                {store.id === currentStore?.id && <Check className="h-4 w-4 text-primary shrink-0" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/create-store")} className="gap-2">
              <Plus className="h-4 w-4" />
              {language === "ar" ? "إنشاء متجر جديد" : "Create new store"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Notifications */}
      <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg">
        <Bell className="h-4 w-4" />
        <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-destructive" />
      </Button>

      {/* Profile Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 h-9 rounded-lg">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {user?.first_name?.charAt(0)?.toUpperCase() || "N"}
            </div>
            <span className="hidden text-sm font-medium sm:inline">
              {user?.first_name || t("dashboard.merchantName")}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-0.5">
              <p className="text-sm font-medium">{user?.first_name} {user?.last_name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2">
            <User className="h-4 w-4" />
            {t("header.profile")}
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onClick={() => navigate("/store")}>
            <Settings className="h-4 w-4" />
            {t("header.settings")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 text-destructive" onClick={logout}>
            <LogOut className="h-4 w-4" />
            {t("header.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
};

export default AppHeader;
