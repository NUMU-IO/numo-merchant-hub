import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, ShoppingCart, Store, Banknote, Share2,
  Users, BarChart3, Megaphone, Settings, FolderOpen, User, Bell, Receipt,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { NavLink } from "@/components/NavLink";
import { NumuIcon } from "@/components/NumuLogo";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarSeparator,
} from "@/components/ui/sidebar";

const AppSidebar = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const location = useLocation();

  const mainNav = [
    { title: t("nav.dashboard"), url: "/", icon: LayoutDashboard },
    { title: t("nav.orders"), url: "/orders", icon: ShoppingCart },
    { title: t("nav.products"), url: "/products", icon: Package },
    { title: t("nav.categories"), url: "/categories", icon: FolderOpen },
    { title: t("nav.customers"), url: "/customers", icon: Users },
  ];

  const channelsNav = [
    { title: t("nav.marketing"), url: "/marketing", icon: Megaphone },
    { title: t("nav.storefront"), url: "/store", icon: Store },
    { title: t("nav.social"), url: "/social", icon: Share2 },
  ];

  const insightsNav = [
    { title: t("nav.analytics"), url: "/analytics", icon: BarChart3 },
    { title: t("nav.cod"), url: "/cod", icon: Banknote },
    { title: t("nav.invoices"), url: "/invoices", icon: Receipt },
  ];

  const isActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  const renderGroup = (label: string, items: typeof mainNav) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40 group-data-[collapsible=icon]:hidden px-3 mb-0.5">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                tooltip={item.title}
                className="h-8 rounded-lg transition-all duration-150"
              >
                <NavLink to={item.url} end={item.url === "/"}>
                  <item.icon className="h-[15px] w-[15px]" />
                  <span className="text-[13px] font-medium">{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" side={isRTL ? "right" : "left"}>
      <SidebarContent>
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 px-4 group-data-[collapsible=icon]:justify-center border-b border-sidebar-border/60">
          <NumuIcon size={22} />
          <div className="group-data-[collapsible=icon]:hidden">
            <span className="text-[13px] font-extrabold tracking-[0.1em]">NUMU</span>
            <span className="text-[9px] text-muted-foreground/35 block -mt-0.5 font-medium tracking-wide">
              {isRTL ? "لوحة التحكم" : "MERCHANT HUB"}
            </span>
          </div>
        </div>

        <div className="py-1.5">
          {renderGroup(isRTL ? "الرئيسية" : "Main", mainNav)}
          <SidebarSeparator className="my-1.5 opacity-50" />
          {renderGroup(isRTL ? "القنوات" : "Channels", channelsNav)}
          <SidebarSeparator className="my-1.5 opacity-50" />
          {renderGroup(isRTL ? "التقارير" : "Insights", insightsNav)}
        </div>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={isRTL ? "الإشعارات" : "Notifications"} className="h-8 rounded-lg" isActive={isActive("/notifications")}>
              <NavLink to="/notifications">
                <Bell className="h-[15px] w-[15px]" />
                <span className="text-[13px] font-medium">{isRTL ? "الإشعارات" : "Notifications"}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t("header.settings")} className="h-8 rounded-lg" isActive={isActive("/settings")}>
              <NavLink to="/settings">
                <Settings className="h-[15px] w-[15px]" />
                <span className="text-[13px] font-medium">{t("header.settings")}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-4 py-2 text-[10px] text-muted-foreground/25 font-medium group-data-[collapsible=icon]:hidden">
          NUMU © 2026
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;