import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart, Store, Banknote } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { NavLink } from "@/components/NavLink";
import numuIcon from "@/assets/numu-icon.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const AppSidebar = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const location = useLocation();

  const navItems = [
    { title: t("nav.dashboard"), url: "/", icon: LayoutDashboard },
    { title: t("nav.products"), url: "/products", icon: Package },
    { title: t("nav.orders"), url: "/orders", icon: ShoppingCart },
    { title: t("nav.store"), url: "/store", icon: Store },
    { title: t("nav.cod"), url: "/cod", icon: Banknote },
  ];

  return (
    <Sidebar collapsible="icon" side={isRTL ? "right" : "left"}>
      <SidebarContent>
        {/* Brand */}
        <div className="flex h-14 items-center gap-2 px-4 font-bold text-lg tracking-tight group-data-[collapsible=icon]:justify-center">
          <img src={numuIcon} alt="NUMU" className="h-8 w-8 object-contain" />
          <span className="group-data-[collapsible=icon]:hidden">NUMU</span>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            {t("nav.dashboard")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.url === "/"
                        ? location.pathname === "/"
                        : location.pathname.startsWith(item.url)
                    }
                    tooltip={item.title}
                  >
                    <NavLink to={item.url} end={item.url === "/"}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-4 py-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          NUMU © 2026
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
