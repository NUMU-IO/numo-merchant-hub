import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Package, ShoppingCart, Store, CreditCard, Share2, Banknote,
  Users, BarChart3, Megaphone, Settings, FolderOpen, Bell, Receipt, Truck, Wallet,
  Palette, FileText, Navigation2, SlidersHorizontal, ClipboardList, ChevronLeft, Filter, Radio,
  Lightbulb, LineChart, MousePointerClick, DollarSign, HandCoins, UserPlus,
  UserCog, User, Inbox, PlugZap, Mail, Sparkles,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { listThreads } from "@/services/inboxApi";
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
import { Badge } from "@/components/ui/badge";
import { NavItemGate } from "./NavItemGate";

const AppSidebar = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const location = useLocation();
  const { currentStore } = useDashboardStore();
  // Offers-v2 promotions surface — hidden until the platform flips the
  // tenant flag during phased rollout. Off by default → invisible nav row.
  const promotionsV2Enabled = useFeatureFlag("ff_promotions_v2");

  const { data: inboxData } = useQuery({
    queryKey: ["inbox", "threads", currentStore?.id],
    queryFn: () => listThreads(currentStore!.id),
    enabled: !!currentStore?.id,
  });

  const totalUnread = inboxData?.total_unread ?? 0;

  const isActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  const analyticsActive = isActive("/analytics");
  const onlineStoreActive = isActive("/online-store") || isActive("/store");
  const staffActive = isActive("/staff") || isActive("/roles");
  const channelsActive = isActive("/channels") || isActive("/inbox");
  const marketingActive = isActive("/marketing");

  // Marketing sub-items. Promotions only shows when the tenant has
  // ff_promotions_v2 enabled — same gate the standalone row used to
  // honour. Empty arrays are fine for `renderExpandableItem`; if the
  // flag is off we still render Marketing as an expandable parent
  // with no children, but the Marketing landing page is the click
  // target so the row stays useful.
  const marketingSubItems = [
    ...(promotionsV2Enabled
      ? [{ title: isRTL ? "العروض" : "Promotions", url: "/marketing/promotions", icon: Sparkles }]
      : []),
  ];

  // Analytics sub-items
  const analyticsSubItems = [
    { title: isRTL ? "نظرة عامة" : "Overview", url: "/analytics/overview", icon: BarChart3 },
    { title: isRTL ? "التقارير" : "Reports", url: "/analytics/reports", icon: FileText },
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
    { title: isRTL ? "حقول الدفع" : "Checkout fields", url: "/online-store/checkout-fields", icon: ClipboardList },
    { title: isRTL ? "إصداراتي" : "My theme submissions", url: "/online-store/my-themes", icon: Package },
  ];

  // Staff sub-items
  const staffSubItems = [
    { title: isRTL ? "الأعضاء" : "Members", url: "/staff", icon: User },
    { title: isRTL ? "الأدوار" : "Roles", url: "/roles", icon: UserCog },
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
          <img src="/numu-mark.webp" alt="" className="h-7 w-7 object-contain shrink-0" />
          <div className="group-data-[collapsible=icon]:hidden">
            {isRTL ? (
              <span className="auth-wordmark text-lg font-bold tracking-tight">نُمُو</span>
            ) : (
              <span className="auth-wordmark text-lg font-semibold tracking-tight lowercase">numu</span>
            )}
          </div>
        </div>

        {/* Main nav */}
        <div className="py-2">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Dashboard */}
                <NavItemGate navKey="dashboard">
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/")} tooltip={isRTL ? "لوحة التحكم" : "Dashboard"} className="h-10 rounded-lg px-3">
                      <NavLink to="/" end>
                        <LayoutDashboard className="h-[18px] w-[18px] opacity-70" />
                        <span className="text-[13px] font-medium">{isRTL ? "لوحة التحكم" : "Dashboard"}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </NavItemGate>

                {/* Orders */}
                <NavItemGate navKey="orders">
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/orders")} tooltip={isRTL ? "الطلبات" : "Orders"} className="h-10 rounded-lg px-3">
                      <NavLink to="/orders">
                        <ShoppingCart className="h-[18px] w-[18px] opacity-70" />
                        <span className="text-[13px] font-medium">{isRTL ? "الطلبات" : "Orders"}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </NavItemGate>

                {/* Products */}
                <NavItemGate navKey="products">
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/products")} tooltip={isRTL ? "المنتجات" : "Products"} className="h-10 rounded-lg px-3">
                      <NavLink to="/products">
                        <Package className="h-[18px] w-[18px] opacity-70" />
                        <span className="text-[13px] font-medium">{isRTL ? "المنتجات" : "Products"}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </NavItemGate>

                {/* Categories */}
                <NavItemGate navKey="categories">
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/categories")} tooltip={isRTL ? "الفئات" : "Categories"} className="h-10 rounded-lg px-3">
                      <NavLink to="/categories">
                        <FolderOpen className="h-[18px] w-[18px] opacity-70" />
                        <span className="text-[13px] font-medium">{isRTL ? "الفئات" : "Categories"}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </NavItemGate>

                {/* Customers */}
                <NavItemGate navKey="customers">
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/customers")} tooltip={isRTL ? "العملاء" : "Customers"} className="h-10 rounded-lg px-3">
                      <NavLink to="/customers">
                        <Users className="h-[18px] w-[18px] opacity-70" />
                        <span className="text-[13px] font-medium">{isRTL ? "العملاء" : "Customers"}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </NavItemGate>

                {/* Marketing — flat row when nothing is gated in,
                    expandable parent with Promotions when ff_promotions_v2
                    is on for this tenant. */}
                <NavItemGate navKey="marketing">
                  {marketingSubItems.length > 0 ? (
                    renderExpandableItem(
                      isRTL ? "التسويق" : "Marketing",
                      "/marketing",
                      Megaphone,
                      marketingSubItems,
                      marketingActive,
                      "marketing",
                    )
                  ) : (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive("/marketing")} tooltip={isRTL ? "التسويق" : "Marketing"} className="h-10 rounded-lg px-3">
                        <NavLink to="/marketing">
                          <Megaphone className="h-[18px] w-[18px] opacity-70" />
                          <span className="text-[13px] font-medium">{isRTL ? "التسويق" : "Marketing"}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </NavItemGate>

                {/* Email Templates */}
                <NavItemGate navKey="email-templates">
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/email-templates")} tooltip={isRTL ? "قوالب البريد" : "Email Templates"} className="h-10 rounded-lg px-3">
                      <NavLink to="/email-templates">
                        <Mail className="h-[18px] w-[18px] opacity-70" />
                        <span className="text-[13px] font-medium">{isRTL ? "قوالب البريد" : "Email Templates"}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </NavItemGate>

                {/* WhatsApp */}
                <NavItemGate navKey="whatsapp">
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/whatsapp")} tooltip={isRTL ? "واتساب" : "WhatsApp"} className="h-10 rounded-lg px-3">
                      <NavLink to="/whatsapp">
                        <img src="/icons/whatsapp.webp" alt="" className="h-[18px] w-[18px] opacity-70" />
                        <span className="text-[13px] font-medium">{isRTL ? "واتساب" : "WhatsApp"}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </NavItemGate>

                {/* Referrals */}
                <NavItemGate navKey="referrals">
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/referrals")} tooltip={isRTL ? "الإحالات" : "Referrals"} className="h-10 rounded-lg px-3">
                      <NavLink to="/referrals">
                        <UserPlus className="h-[18px] w-[18px] opacity-70" />
                        <span className="text-[13px] font-medium">{isRTL ? "الإحالات" : "Referrals"}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </NavItemGate>

                {/* Analytics — clickable + expandable sub-items */}
                <NavItemGate navKey="analytics">
                  {renderExpandableItem(
                    isRTL ? "التحليلات" : "Analytics",
                    "/analytics/overview",
                    BarChart3,
                    analyticsSubItems,
                    analyticsActive,
                    "analytics",
                  )}
                </NavItemGate>

                {/* Online Store — clickable + expandable sub-items */}
                <NavItemGate navKey="online-store">
                  {renderExpandableItem(
                    isRTL ? "المتجر الإلكتروني" : "Online Store",
                    "/online-store/themes",
                    Store,
                    onlineStoreSubItems,
                    onlineStoreActive,
                    "store",
                  )}
                </NavItemGate>

                {/* Finance */}
                <NavItemGate navKey="payments">
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/payments")} tooltip={isRTL ? "المالية" : "Finance"} className="h-10 rounded-lg px-3">
                      <NavLink to="/payments">
                        <DollarSign className="h-[18px] w-[18px] opacity-70" />
                        <span className="text-[13px] font-medium">{isRTL ? "المالية" : "Finance"}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </NavItemGate>

                {/* Staff — parent with Members + Roles sub-items */}
                <NavItemGate navKey="staff">
                  {renderExpandableItem(
                    isRTL ? "فريق العمل" : "Staff",
                    "/staff",
                    Users,
                    staffSubItems,
                    staffActive,
                    "staff",
                  )}
                </NavItemGate>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>

        {/* Operations — collapsible section (auto-opens when Channels/Inbox is active) */}
        <div className="group-data-[collapsible=icon]:hidden">
          <Collapsible defaultOpen={channelsActive} className="group/operations">
            <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold text-muted-foreground/60 hover:text-muted-foreground transition-colors">
              <span>{isRTL ? "العمليات" : "Operations"}</span>
              <ChevronLeft className={`h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/operations:-rotate-90 ${isRTL ? "" : "rotate-180 group-data-[state=open]/operations:rotate-90"}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu>
                {/* Channels (parent) → Inbox (child) */}
                <NavItemGate navKey="channels">
                  <Collapsible defaultOpen={channelsActive} className="group/channels">
                    <SidebarMenuItem>
                      <div className="flex items-center">
                        <SidebarMenuButton
                          asChild
                          isActive={isActive("/channels")}
                          tooltip={isRTL ? "القنوات" : "Channels"}
                          className="h-9 rounded-lg px-3 flex-1"
                        >
                          <NavLink to="/channels">
                            <PlugZap className="h-[18px] w-[18px] opacity-70" />
                            <span className="text-[13px]">{isRTL ? "القنوات" : "Channels"}</span>
                            {totalUnread > 0 && (
                              <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px]">
                                {totalUnread > 99 ? "99+" : totalUnread}
                              </Badge>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                        <CollapsibleTrigger className="p-1.5 rounded-md hover:bg-muted/60 transition-colors group-data-[collapsible=icon]:hidden">
                          <ChevronLeft className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 group-data-[state=open]/channels:-rotate-90 ${isRTL ? "" : "rotate-180 group-data-[state=open]/channels:rotate-90"}`} />
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          <NavItemGate navKey="inbox">
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton asChild isActive={isActive("/inbox")}>
                                <NavLink to="/inbox">
                                  <Inbox className="h-3.5 w-3.5" />
                                  <span>{isRTL ? "الرسائل" : "Inbox"}</span>
                                  {totalUnread > 0 && (
                                    <Badge variant="destructive" className="ml-auto h-4 min-w-4 px-1 text-[9px]">
                                      {totalUnread > 99 ? "99+" : totalUnread}
                                    </Badge>
                                  )}
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          </NavItemGate>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </NavItemGate>

                {/* Flat operations items */}
                {[
                  { key: "payment-setup", title: isRTL ? "إعداد الدفع" : "Payment Setup", url: "/payment-setup", icon: Wallet },
                  { key: "logistics", title: isRTL ? "الشحن والتوصيل" : "Logistics", url: "/logistics", icon: Truck },
                  { key: "shipping-zones", title: isRTL ? "مناطق الشحن" : "Shipping Zones", url: "/shipping/zones", icon: Truck },
                  { key: "cod", title: isRTL ? "الدفع عند الاستلام" : "COD", url: "/cod", icon: Banknote },
                  { key: "social", title: isRTL ? "السوشيال ميديا" : "Social", url: "/social", icon: Share2 },
                  { key: "invoices", title: isRTL ? "الفواتير" : "Invoices", url: "/invoices", icon: Receipt },
                  { key: "billing", title: isRTL ? "الاشتراك والفواتير" : "Billing", url: "/billing", icon: HandCoins },
                ].map((item) => (
                  <NavItemGate key={item.url} navKey={item.key}>
                    <SidebarMenuItem>
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
                  </NavItemGate>
                ))}
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <NavItemGate navKey="notifications">
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={isRTL ? "الإشعارات" : "Notifications"} className="h-9 rounded-lg px-3" isActive={isActive("/notifications")}>
                <NavLink to="/notifications">
                  <Bell className="h-[18px] w-[18px] opacity-70" />
                  <span className="text-[13px] font-medium">{isRTL ? "الإشعارات" : "Notifications"}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </NavItemGate>

          <NavItemGate navKey="settings">
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={isRTL ? "الإعدادات" : "Settings"} className="h-9 rounded-lg px-3" isActive={isActive("/settings")}>
                <NavLink to="/settings">
                  <Settings className="h-[18px] w-[18px] opacity-70" />
                  <span className="text-[13px] font-medium">{isRTL ? "الإعدادات" : "Settings"}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </NavItemGate>
          <NavItemGate navKey="store">
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={isRTL ? "إعدادات المتجر" : "Store Profile"} className="h-9 rounded-lg px-3" isActive={isActive("/store")}>
                <NavLink to="/store">
                  <Store className="h-[18px] w-[18px] opacity-70" />
                  <span className="text-[13px] font-medium">{isRTL ? "إعدادات المتجر" : "Store Profile"}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </NavItemGate>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
// omnichannel-v1
