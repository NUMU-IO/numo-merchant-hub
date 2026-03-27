import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Package, Search, Menu } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  CreditCard, Truck, Banknote, Receipt, Megaphone, BarChart3,
  Share2, Store, Bell, Settings, Users, FolderOpen, Wallet,
} from "lucide-react";

const MobileBottomNav = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const tabs = [
    { label: isRTL ? "الرئيسية" : "Home", icon: LayoutDashboard, path: "/" },
    { label: isRTL ? "الطلبات" : "Orders", icon: ShoppingCart, path: "/orders" },
    { label: isRTL ? "المنتجات" : "Products", icon: Package, path: "/products" },
    { label: isRTL ? "بحث" : "Search", icon: Search, path: "__search__" },
    { label: isRTL ? "القائمة" : "Menu", icon: Menu, path: "__menu__" },
  ];

  const menuItems = [
    { label: isRTL ? "التصنيفات" : "Categories", icon: FolderOpen, path: "/categories" },
    { label: isRTL ? "العملاء" : "Customers", icon: Users, path: "/customers" },
    { label: isRTL ? "المالية" : "Finance", icon: CreditCard, path: "/payments" },
    { label: isRTL ? "إعداد الدفع" : "Payment Setup", icon: Wallet, path: "/payment-setup" },
    { label: isRTL ? "الشحن والتوصيل" : "Logistics", icon: Truck, path: "/logistics" },
    { label: t("nav.cod"), icon: Banknote, path: "/cod" },
    { label: t("nav.invoices"), icon: Receipt, path: "/invoices" },
    { label: t("nav.marketing"), icon: Megaphone, path: "/marketing" },
    { label: t("nav.analytics"), icon: BarChart3, path: "/analytics" },
    { label: isRTL ? "الاستيراد" : "Social Import", icon: Share2, path: "/social" },
    { label: isRTL ? "المتجر" : "Storefront", icon: Store, path: "/store" },
    { label: isRTL ? "الإشعارات" : "Notifications", icon: Bell, path: "/notifications" },
    { label: t("header.settings"), icon: Settings, path: "/settings" },
  ];

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const handleTap = (path: string) => {
    if (path === "__menu__") {
      setMenuOpen(true);
    } else if (path === "__search__") {
      // Trigger the command palette (Ctrl+K)
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
    } else {
      navigate(path);
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-background/95 backdrop-blur-lg border-t border-border/60 safe-bottom">
        <div className="flex items-center justify-around h-14 px-1">
          {tabs.map((tab) => {
            const active = tab.path !== "__search__" && tab.path !== "__menu__" && isActive(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => handleTap(tab.path)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors cursor-pointer ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
                <span className={`text-[10px] leading-tight ${active ? "font-semibold" : "font-medium"}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side={isRTL ? "right" : "left"} className="w-72 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="text-sm font-bold">{isRTL ? "القائمة" : "Menu"}</SheetTitle>
          </SheetHeader>
          <div className="py-2 overflow-y-auto max-h-[calc(100vh-80px)]">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMenuOpen(false); }}
                className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                  isActive(item.path)
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-muted/50"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default MobileBottomNav;
