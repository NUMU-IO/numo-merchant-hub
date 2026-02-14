import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { Bell, ChevronDown, Globe, Moon, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useEffect, useState } from "react";

const AppHeader = () => {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

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
              A
            </div>
            <span className="hidden text-sm font-medium sm:inline">
              {t("dashboard.merchantName")}
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
          <DropdownMenuItem className="text-destructive">{t("header.logout")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
};

export default AppHeader;
