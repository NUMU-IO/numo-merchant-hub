import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, ShoppingCart, Store, CreditCard, Share2, Banknote,
  Users, BarChart3, Megaphone, Settings, FolderOpen, Bell, Receipt, Truck, Wallet,
  Palette, FileText, Navigation2, SlidersHorizontal, ChevronLeft, Filter, Radio,
  Lightbulb, LineChart, MousePointerClick, DollarSign, HandCoins, UserPlus, MessageSquare,
  Shield, UserCog,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarMenuSub, SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

const AppSidebar = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const location = useLocation();

  const isActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  const analyticsActive = isActive("/analytics");
  const onlineStoreActive = isActive("/online-store") || isActive("/store");

  // Analytics sub-items
  const analyticsSubItems = [
    { title: isRTL ? "نظرة عامة" : "Overview", url: "/analytics/overview", icon: BarChart3 },
    { title: isRTL ? "المبيعات" : "Sales", url: "/analytics/sales", icon: CreditCard },
    { title: isRTL ? "الطلبات" : "Orders", url: "/analytics/orders", icon: ShoppingCart },
    { title: isRTL ? "العملاء" : "Customers", url: "/analytics/customers", icon: Users },
    { title: isRTL ? "المنتجات" : "Products", url: "/analytics/products", icon: Package },
    { title: isRTL ? "القمع" : "Funnel", url: "/analytics/funnel", icon: Filter },
    { title: isRTL ? "التسويق" : "Marketing", url: "/analytics/marketing", icon: Megaphone },
    { title: isRTL ? "مباشر" : "Live", url: "/analytics/live", icon: Radio },
    { title: isRTL ? "تحليلات ذكية" : "Insights", url: "/analytics/insights", icon: Lightbulb },
    { title: isRTL ? "التوقعات" : "Forecast", url: "/analytics/forecast", icon: LineChart },
    { title: isRTL ? "رحلة العميل" : "Journey", url: "/analytics/journey", icon: MousePointerClick },
  ];

  // Online Store sub-items
  const onlineStoreSubItems = [
    { title: isRTL ? "الثيمات" : "Themes", url: "/online-store/themes", icon: Palette },
    { title: isRTL ? "الصفحات" : "Pages", url: "/online-store/pages", icon: FileText },
    { title: isRTL ? "التنقل" : "Navigation", url: "/online-store/navigation", icon: Navigation2 },
    { title: isRTL ? "التفضيلات" : "Preferences", url: "/online-store/preferences", icon: SlidersHorizontal },
  ];

  // Collapsible section builder (for bottom sections)
  const renderCollapsible = (
    label: string,
    items: { title: string; url: string; icon: typeof Store }[],
    defaultOpen: boolean,
    groupName: string,
  ) => (
    <Collapsible defaultOpen={defaultOpen} className={`group/${groupName}`}>
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold text-muted-foreground/60 hover:text-muted-foreground transition-colors">
        <span>{label}</span>
        <ChevronLeft className={`h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/${groupName}:-rotate-90 ${isRTL ? "" : "rotate-180 group-data-[state=open]/" + groupName + ":rotate-90"}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                tooltip={item.title}
                className="h-9 rounded-lg px-3"
              >
                <NavLink to={item.url}>
                  <item.icon className="h-[18px] w-[18px] opacity-70" />
                  <span className="text-[13px]">{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </CollapsibleContent>
    </Collapsible>
  );

  // Expandable nav item: clickable link + chevron expands sub-items inline
  const renderExpandableItem = (
    title: string,
    url: string,
    icon: typeof BarChart3,
    subItems: { title: string; url: string; icon: typeof BarChart3 }[],
    active: boolean,
    groupName: string,
  ) => {
    const Icon = icon;
    return (
      <Collapsible defaultOpen={active} className={`group/${groupName}`}>
        <SidebarMenuItem>
          <div className="flex items-center">
            <SidebarMenuButton
              asChild
              isActive={active}
              tooltip={title}
              className="h-10 rounded-lg px-3 flex-1"
            >
              <NavLink to={url}>
                <Icon className="h-[18px] w-[18px] opacity-70" />
                <span className="text-[13px] font-medium">{title}</span>
              </NavLink>
            </SidebarMenuButton>
            <CollapsibleTrigger className="p-1.5 rounded-md hover:bg-muted/60 transition-colors group-data-[collapsible=icon]:hidden">
              <ChevronLeft className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 group-data-[state=open]/${groupName}:-rotate-90 ${isRTL ? "" : "rotate-180 group-data-[state=open]/" + groupName + ":rotate-90"}`} />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <SidebarMenuSub>
              {subItems.map((item) => (
                <SidebarMenuSubItem key={item.url}>
                  <SidebarMenuSubButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url}>
                      <item.icon className="h-3.5 w-3.5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  return (
    <Sidebar collapsible="icon" side={isRTL ? "right" : "left"}>
      <SidebarContent>
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 px-4 group-data-[collapsible=icon]:justify-center border-b border-sidebar-border/40">
          <img src="/numu-symbol-navy-transparent.webp" alt="NUMU" className="h-7 w-7 object-contain shrink-0" />
          <div className="group-data-[collapsible=icon]:hidden">
            <span className="text-[14px] font-extrabold tracking-[0.08em]">NUMU</span>
          </div>
        </div>

        {/* Main nav */}
        <div className="py-2">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Dashboard */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/")} tooltip={isRTL ? "لوحة التحكم" : "Dashboard"} className="h-10 rounded-lg px-3">
                    <NavLink to="/" end>
                      <LayoutDashboard className="h-[18px] w-[18px] opacity-70" />
                      <span className="text-[13px] font-medium">{isRTL ? "لوحة التحكم" : "Dashboard"}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Orders */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/orders")} tooltip={isRTL ? "الطلبات" : "Orders"} className="h-10 rounded-lg px-3">
                    <NavLink to="/orders">
                      <ShoppingCart className="h-[18px] w-[18px] opacity-70" />
                      <span className="text-[13px] font-medium">{isRTL ? "الطلبات" : "Orders"}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Products */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/products")} tooltip={isRTL ? "المنتجات" : "Products"} className="h-10 rounded-lg px-3">
                    <NavLink to="/products">
                      <Package className="h-[18px] w-[18px] opacity-70" />
                      <span className="text-[13px] font-medium">{isRTL ? "المنتجات" : "Products"}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Categories */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/categories")} tooltip={isRTL ? "الفئات" : "Categories"} className="h-10 rounded-lg px-3">
                    <NavLink to="/categories">
                      <FolderOpen className="h-[18px] w-[18px] opacity-70" />
                      <span className="text-[13px] font-medium">{isRTL ? "الفئات" : "Categories"}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Customers */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/customers")} tooltip={isRTL ? "العملاء" : "Customers"} className="h-10 rounded-lg px-3">
                    <NavLink to="/customers">
                      <Users className="h-[18px] w-[18px] opacity-70" />
                      <span className="text-[13px] font-medium">{isRTL ? "العملاء" : "Customers"}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Marketing */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/marketing")} tooltip={isRTL ? "التسويق" : "Marketing"} className="h-10 rounded-lg px-3">
                    <NavLink to="/marketing">
                      <Megaphone className="h-[18px] w-[18px] opacity-70" />
                      <span className="text-[13px] font-medium">{isRTL ? "التسويق" : "Marketing"}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* WhatsApp */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/whatsapp")} tooltip={isRTL ? "واتساب" : "WhatsApp"} className="h-10 rounded-lg px-3">
                    <NavLink to="/whatsapp">
                      <MessageSquare className="h-[18px] w-[18px] opacity-70" />
                      <span className="text-[13px] font-medium">{isRTL ? "واتساب" : "WhatsApp"}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Referrals */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/referrals")} tooltip={isRTL ? "الإحالات" : "Referrals"} className="h-10 rounded-lg px-3">
                    <NavLink to="/referrals">
                      <UserPlus className="h-[18px] w-[18px] opacity-70" />
                      <span className="text-[13px] font-medium">{isRTL ? "الإحالات" : "Referrals"}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Analytics — clickable + expandable sub-items */}
                {renderExpandableItem(
                  isRTL ? "التحليلات" : "Analytics",
                  "/analytics/overview",
                  BarChart3,
                  analyticsSubItems,
                  analyticsActive,
                  "analytics",
                )}

                {/* Online Store — clickable + expandable sub-items */}
                {renderExpandableItem(
                  isRTL ? "المتجر الإلكتروني" : "Online Store",
                  "/online-store/themes",
                  Store,
                  onlineStoreSubItems,
                  onlineStoreActive,
                  "store",
                )}

                {/* Finance */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/payments")} tooltip={isRTL ? "المالية" : "Finance"} className="h-10 rounded-lg px-3">
                    <NavLink to="/payments">
                      <DollarSign className="h-[18px] w-[18px] opacity-70" />
                      <span className="text-[13px] font-medium">{isRTL ? "المالية" : "Finance"}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Staff */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/staff")} tooltip={isRTL ? "فريق العمل" : "Staff"} className="h-10 rounded-lg px-3">
                    <NavLink to="/staff">
                      <UserCog className="h-[18px] w-[18px] opacity-70" />
                      <span className="text-[13px] font-medium">{isRTL ? "فريق العمل" : "Staff"}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Roles & Permissions */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/roles")} tooltip={isRTL ? "الأدوار والصلاحيات" : "Roles"} className="h-10 rounded-lg px-3">
                    <NavLink to="/roles">
                      <Shield className="h-[18px] w-[18px] opacity-70" />
                      <span className="text-[13px] font-medium">{isRTL ? "الأدوار" : "Roles"}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>

        {/* Operations — collapsible section */}
        <div className="group-data-[collapsible=icon]:hidden">
          {renderCollapsible(
            isRTL ? "العمليات" : "Operations",
            [
              { title: isRTL ? "إعداد الدفع" : "Payment Setup", url: "/payment-setup", icon: Wallet },
              { title: isRTL ? "الشحن والتوصيل" : "Logistics", url: "/logistics", icon: Truck },
              { title: isRTL ? "الدفع عند الاستلام" : "COD", url: "/cod", icon: Banknote },
              { title: isRTL ? "السوشيال ميديا" : "Social", url: "/social", icon: Share2 },
              { title: isRTL ? "الفواتير" : "Invoices", url: "/invoices", icon: Receipt },
              { title: isRTL ? "الاشتراك والفواتير" : "Billing", url: "/billing", icon: HandCoins },
            ],
            false,
            "operations",
          )}
        </div>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={isRTL ? "الإشعارات" : "Notifications"} className="h-9 rounded-lg px-3" isActive={isActive("/notifications")}>
              <NavLink to="/notifications">
                <Bell className="h-[18px] w-[18px] opacity-70" />
                <span className="text-[13px] font-medium">{isRTL ? "الإشعارات" : "Notifications"}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={isRTL ? "الإعدادات" : "Settings"} className="h-9 rounded-lg px-3" isActive={isActive("/settings")}>
              <NavLink to="/settings">
                <Settings className="h-[18px] w-[18px] opacity-70" />
                <span className="text-[13px] font-medium">{isRTL ? "الإعدادات" : "Settings"}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={isRTL ? "إعدادات المتجر" : "Store Profile"} className="h-9 rounded-lg px-3" isActive={isActive("/store")}>
              <NavLink to="/store">
                <Store className="h-[18px] w-[18px] opacity-70" />
                <span className="text-[13px] font-medium">{isRTL ? "إعدادات المتجر" : "Store Profile"}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
