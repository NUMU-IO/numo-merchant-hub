import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, ShoppingCart, Store, Banknote, Share2,
  Users, BarChart3, Megaphone, Settings, FolderOpen,
} from "lucide-react";
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
  SidebarSeparator,
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
  ];

  const isActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  const renderGroup = (
    label: string,
    items: typeof mainNav
  ) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 group-data-[collapsible=icon]:hidden">
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
              >
                <NavLink to={item.url} end={item.url === "/"}>
                  <item.icon className="h-[18px] w-[18px]" />
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
        <div className="flex h-16 items-center gap-2.5 px-4 group-data-[collapsible=icon]:justify-center border-b border-sidebar-border">
          <img src={numuIcon} alt="NUMU" className="h-8 w-8 object-contain" />
          <div className="group-data-[collapsible=icon]:hidden">
            <span className="text-lg font-bold tracking-tight">NUMU</span>
            <span className="text-[10px] text-muted-foreground block -mt-1 font-medium">
              {isRTL ? "لوحة التحكم" : "Merchant"}
            </span>
          </div>
        </div>

        {renderGroup(isRTL ? "الرئيسية" : "Main", mainNav)}
        <SidebarSeparator />
        {renderGroup(isRTL ? "القنوات" : "Channels", channelsNav)}
        <SidebarSeparator />
        {renderGroup(isRTL ? "التقارير" : "Insights", insightsNav)}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t("header.settings")}>
              <NavLink to="/store">
                <Settings className="h-[18px] w-[18px]" />
                <span className="text-[13px] font-medium">{t("header.settings")}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-4 py-2 text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
          NUMU © 2026
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
