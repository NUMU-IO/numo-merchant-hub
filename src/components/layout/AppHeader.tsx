import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  Bell,
  Check,
  ChevronDown,
  Globe,
  Moon,
  Plus,
  Store,
  Sun,
  User,
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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4">
      <SidebarTrigger />

      <div className="flex-1" />

      {/* Dark Mode Toggle */}
      <Button
        variant="ghost"
        size="icon"
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
        className="gap-1.5 text-sm font-medium"
      >
        <Globe className="h-4 w-4" />
        {language === "en" ? "العربية" : "English"}
      </Button>

      {/* Store Selector */}
      {stores.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 max-w-[180px]">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary shrink-0">
                {currentStore?.name?.charAt(0)?.toUpperCase() || "S"}
              </div>
              <span className="hidden text-sm font-medium sm:inline truncate">
                {currentStore?.name ||
                  (language === "ar" ? "اختر متجر" : "Select store")}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              {language === "ar" ? "متاجرك" : "Your Stores"}
            </DropdownMenuLabel>
            {stores.map((store) => (
              <DropdownMenuItem
                key={store.id}
                onClick={() => switchStore(store.id)}
                className="gap-2"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary shrink-0">
                  {store.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate flex-1">{store.name}</span>
                {store.id === currentStore?.id && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate("/create-store")}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {language === "ar" ? "إنشاء متجر جديد" : "Create new store"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Notifications */}
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-4 w-4" />
        <span className="absolute -top-0.5 end-1 h-2 w-2 rounded-full bg-destructive" />
      </Button>

      {/* Profile Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {user?.first_name?.charAt(0)?.toUpperCase() || "N"}
            </div>
            <span className="hidden text-sm font-medium sm:inline">
              {user?.first_name || t("dashboard.merchantName")}
            </span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <User className="me-2 h-4 w-4" />
            {t("header.profile")}
          </DropdownMenuItem>
          <DropdownMenuItem>{t("header.settings")}</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={logout}>
            {t("header.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
};

export default AppHeader;
