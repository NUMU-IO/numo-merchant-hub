import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Check, Plus } from "lucide-react";
import { CaretUpDown } from "@phosphor-icons/react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// Phosphor icons match the Souq spec: duotone at rest, fill when active.
// Each named here is the React component; the `weight` prop controls
// the stylistic variant. Aliasing lets the rest of the file keep its
// Souq-spec names (`House`, `Storefront`, `Money`, `Gear`) instead of
// the lucide-style names that were here before.
import {
  House, ShoppingCart, Package, Users, Storefront, Megaphone,
  ChartLineUp, Wallet, Money, Truck, Gear, Bell, Cube as Boxes,
  Tag, NotePencil as FileEdit, ShoppingBag, FolderOpen, Receipt, SealPercent as BadgePercent,
  Gift, Tray as Inbox, FileText, PaperPlaneTilt as Send,
  TrendUp as TrendingUp, UserPlus, MapPin, Sparkle as Sparkles,
  PlugsConnected as PlugZap, Envelope as Mail, Funnel as Filter, Broadcast as Radio,
  Lightbulb, ChartLine as LineChart, Cursor as MousePointerClick,
  ClipboardText as ClipboardList, ArrowsLeftRight as Navigation2,
  SlidersHorizontal, Palette, User, UserGear as UserCog, UserCheck,
  WarningCircle as AlertTriangle, ChartBar as BarChart3,
  CreditCard,
} from "@phosphor-icons/react";
import { WhatsAppGlyph } from "@/components/whatsapp/WhatsAppGlyph";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { listThreads } from "@/services/inboxApi";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, SidebarMenuSub, SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { NavItemGate } from "./NavItemGate";

type IconType = typeof House;
type NavSubItem = { title: string; url: string; icon: IconType };

// The WhatsApp brand mark rendered as a nav icon. It accepts the same
// `size`/`weight`/`className` props phosphor icons get (weight is a
// no-op), so it's a drop-in for the WhatsApp entries; the cast bridges
// our plain function component to phosphor's forwardRef icon type.
const WhatsAppNavIcon = WhatsAppGlyph as unknown as IconType;

const AppSidebar = () => {
  const { isRTL } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentStore, stores, switchStore } = useDashboardStore();

  const { data: inboxData } = useQuery({
    queryKey: ["inbox", "threads", currentStore?.id],
    queryFn: () => listThreads(currentStore!.id),
    enabled: !!currentStore?.id,
  });
  const totalUnread = inboxData?.total_unread ?? 0;

  const isActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  // ─── Group active states (parent highlights when any child is active) ──
  const ordersActive = isActive("/orders");
  const productsActive = isActive("/products") || isActive("/categories");
  const onlineStoreActive = isActive("/online-store") || isActive("/store");
  const marketingActive =
    isActive("/marketing") ||
    isActive("/campaigns") ||
    isActive("/gift-cards") ||
    isActive("/whatsapp") ||
    isActive("/email-templates") ||
    isActive("/channels/whatsapp");
  const analyticsActive = isActive("/analytics") || isActive("/health-score");
  const financeActive =
    isActive("/payments") ||
    isActive("/wallet") ||
    isActive("/store-balance") ||
    isActive("/invoices") ||
    isActive("/payment-setup") ||
    isActive("/billing");
  const logisticsActive =
    isActive("/logistics") || isActive("/shipping");
  const channelsActive = isActive("/channels") || isActive("/inbox");

  // ─── Sub-item lists (kept close to the parent for readability) ─────────
  const ordersSub: NavSubItem[] = [
    { title: isRTL ? "كل الطلبات" : "All orders", url: "/orders", icon: ShoppingCart },
    { title: isRTL ? "المسودات" : "Drafts", url: "/orders/drafts", icon: FileEdit },
    { title: isRTL ? "السلال المهجورة" : "Abandoned", url: "/orders/abandoned", icon: ShoppingBag },
    { title: isRTL ? "بوالص الشحن" : "Shipping labels", url: "/orders/shipping-labels", icon: Tag },
  ];
  const productsSub: NavSubItem[] = [
    { title: isRTL ? "كل المنتجات" : "All products", url: "/products", icon: Package },
    { title: isRTL ? "الفئات" : "Categories", url: "/categories", icon: FolderOpen },
  ];
  // Marketing — discounts + campaigns + whatsapp + gift cards + email
  // templates, all rolled into one parent the spec calls "Marketing".
  const marketingSub: NavSubItem[] = [
    { title: isRTL ? "نظرة عامة" : "Overview", url: "/marketing", icon: Megaphone },
    { title: isRTL ? "الكوبونات" : "Coupons", url: "/marketing/coupons", icon: Tag },
    { title: isRTL ? "العروض" : "Promotions", url: "/marketing/promotions", icon: BadgePercent },
    { title: isRTL ? "بطاقات الهدايا" : "Gift cards", url: "/gift-cards", icon: Gift },
    { title: isRTL ? "الحملات" : "Campaigns", url: "/campaigns", icon: Send },
    { title: isRTL ? "واتساب" : "WhatsApp", url: "/whatsapp", icon: WhatsAppNavIcon },
    { title: isRTL ? "قوالب البريد" : "Email templates", url: "/email-templates", icon: Mail },
    { title: isRTL ? "الإسناد" : "Attribution", url: "/marketing/attribution", icon: TrendingUp },
    { title: isRTL ? "الجماهير" : "Audiences", url: "/marketing/audiences", icon: Users },
    { title: isRTL ? "الإحالات" : "Referrals", url: "/referrals", icon: UserPlus },
  ];
  const analyticsSub: NavSubItem[] = [
    { title: isRTL ? "نظرة عامة" : "Overview", url: "/analytics/overview", icon: BarChart3 },
    { title: isRTL ? "المبيعات" : "Sales", url: "/analytics/sales", icon: CreditCard },
    { title: isRTL ? "الطلبات" : "Orders", url: "/analytics/orders", icon: ShoppingCart },
    { title: isRTL ? "العملاء" : "Customers", url: "/analytics/customers", icon: Users },
    { title: isRTL ? "المنتجات" : "Products", url: "/analytics/products", icon: Package },
    { title: isRTL ? "القمع" : "Funnel", url: "/analytics/funnel", icon: Filter },
    { title: isRTL ? "التقارير" : "Reports", url: "/analytics/reports", icon: FileText },
    { title: isRTL ? "مباشر" : "Live", url: "/analytics/live", icon: Radio },
    { title: isRTL ? "تحليلات ذكية" : "Insights", url: "/analytics/insights", icon: Lightbulb },
    { title: isRTL ? "التوقعات" : "Forecast", url: "/analytics/forecast", icon: LineChart },
    { title: isRTL ? "رحلة العميل" : "Journey", url: "/analytics/journey", icon: MousePointerClick },
    { title: isRTL ? "صحة المتجر" : "Store health", url: "/health-score", icon: Sparkles },
  ];
  const financeSub: NavSubItem[] = [
    { title: isRTL ? "نظرة عامة" : "Overview", url: "/payments", icon: Wallet },
    { title: isRTL ? "التحويلات" : "Payouts", url: "/wallet", icon: TrendingUp },
    { title: isRTL ? "رصيد المتجر" : "Store balance", url: "/store-balance", icon: Money },
    { title: isRTL ? "الفواتير" : "Invoices", url: "/invoices", icon: Receipt },
    { title: isRTL ? "إعداد الدفع" : "Payment setup", url: "/payment-setup", icon: CreditCard },
    { title: isRTL ? "الاشتراك" : "Billing", url: "/billing", icon: Sparkles },
  ];
  const onlineStoreSub: NavSubItem[] = [
    { title: isRTL ? "نظرة عامة" : "Overview", url: "/online-store", icon: Storefront },
    { title: isRTL ? "الثيمات" : "Themes", url: "/online-store/themes", icon: Palette },
    { title: isRTL ? "الصفحات" : "Pages", url: "/online-store/pages", icon: FileText },
    { title: isRTL ? "التنقل" : "Navigation", url: "/online-store/navigation", icon: Navigation2 },
    { title: isRTL ? "التفضيلات" : "Preferences", url: "/online-store/preferences", icon: SlidersHorizontal },
    { title: isRTL ? "حقول الدفع" : "Checkout fields", url: "/online-store/checkout-fields", icon: ClipboardList },
    { title: isRTL ? "إصداراتي" : "My themes", url: "/online-store/my-themes", icon: Package },
  ];
  const logisticsSub: NavSubItem[] = [
    { title: isRTL ? "الشحنات" : "Shipments", url: "/logistics", icon: Truck },
    { title: isRTL ? "المناطق" : "Zones", url: "/shipping/zones", icon: MapPin },
    { title: isRTL ? "المواقع" : "Locations", url: "/locations", icon: MapPin },
  ];
  const whatsappOpsSub: NavSubItem[] = [
    { title: isRTL ? "صندوق الوارد" : "Inbox", url: "/whatsapp/inbox", icon: Inbox },
    { title: isRTL ? "الحملات" : "Campaigns", url: "/whatsapp/campaigns", icon: Send },
    { title: isRTL ? "القوالب" : "Templates", url: "/channels/whatsapp/templates", icon: FileText },
    { title: isRTL ? "اشتراكات العملاء" : "Opt-ins", url: "/whatsapp/opt-ins", icon: UserCheck },
    { title: isRTL ? "ربط الحساب" : "Connect (BYO)", url: "/whatsapp/byo", icon: PlugZap },
    { title: isRTL ? "الرسائل الفاشلة" : "Dead letters", url: "/whatsapp/dead-letters", icon: AlertTriangle },
  ];
  const staffSub: NavSubItem[] = [
    { title: isRTL ? "الأعضاء" : "Members", url: "/staff", icon: User },
    { title: isRTL ? "الأدوار" : "Roles", url: "/roles", icon: UserCog },
  ];

  // ─── Pure-flat (no sub) row ───────────────────────────────────────────
  // Souq spec: Phosphor `duotone` at rest, `fill` when active. The icon
  // turns saffron on active rows via the `data-[active=true]` CSS rule
  // in index.css.
  const navRow = (
    title: string,
    url: string,
    Icon: IconType,
    extra?: React.ReactNode,
  ) => {
    const active = isActive(url);
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={title}
          className="h-10 rounded-lg px-3"
        >
          <NavLink to={url}>
            <Icon size={20} weight={active ? "fill" : "duotone"} className="text-navy dark:text-saffron" />
            <span className="text-[13px] font-medium">{title}</span>
            {extra}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  // ─── Parent row with sub-items (Souq spec) ────────────────────────────
  // Parent is a real link; the chevron toggles the sub-list. Caret flips
  // 180° on open. Children render as an indented list with a connecting
  // hairline; the dot per child fills saffron when that child is active.
  const navParent = (
    title: string,
    url: string,
    Icon: IconType,
    subItems: NavSubItem[],
    active: boolean,
    groupName: string,
    badge?: React.ReactNode,
  ) => (
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
              <Icon size={20} weight={active ? "fill" : "duotone"} className="text-navy dark:text-saffron" />
              <span className="text-[13px] font-medium">{title}</span>
              {badge}
            </NavLink>
          </SidebarMenuButton>
          <CollapsibleTrigger className="p-1.5 rounded-md hover:bg-muted/60 transition-colors group-data-[collapsible=icon]:hidden">
            <ChevronLeft className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 group-data-[state=open]/${groupName}:-rotate-90 ${isRTL ? "" : "rotate-180 group-data-[state=open]/" + groupName + ":rotate-90"}`} />
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <SidebarMenuSub>
            {subItems.map((item) => {
              const subActive = isActive(item.url);
              return (
                <SidebarMenuSubItem key={item.url}>
                  <SidebarMenuSubButton asChild isActive={subActive}>
                    <NavLink to={item.url}>
                      <item.icon size={14} weight={subActive ? "fill" : "duotone"} />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );

  // Group label — built-in SidebarGroupLabel handles icon-mode collapse
  // via its baked-in `-mt-8 opacity-0` transition (so the label slides
  // up and fades out cleanly instead of remaining as truncated text).
  // Souq spec: 11px / 700 / uppercase / +0.08em tracking / ink-faint.
  const groupLabel = (label: string) => (
    <SidebarGroupLabel className="px-3 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
      {label}
    </SidebarGroupLabel>
  );

  return (
    <Sidebar collapsible="icon" side={isRTL ? "right" : "left"}>
      {/* Brand — sticky 68px row outside SidebarContent so it doesn't
          scroll away with the nav (matches AppHeader chrome height). */}
      <SidebarHeader className="p-0 border-b border-sidebar-border/60 bg-sidebar">
        <div className="flex h-[68px] items-center gap-3 px-5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <img
            src="/brand/numu-navy.png"
            alt="NUMU"
            className="h-10 w-auto shrink-0 object-contain"
          />
          <div className="group-data-[collapsible=icon]:hidden">
            {isRTL ? (
              <span className="souq-wordmark text-[22px]">نُمُو</span>
            ) : (
              <span className="souq-wordmark text-[22px] lowercase">numu</span>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* ─── PINNED (no label) — the daily drivers ─────────────────── */}
        <SidebarGroup className="pt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItemGate navKey="dashboard">
                {navRow(isRTL ? "الرئيسية" : "Home", "/", House)}
              </NavItemGate>

              <NavItemGate navKey="orders">
                {navParent(
                  isRTL ? "الطلبات" : "Orders",
                  "/orders",
                  ShoppingCart,
                  ordersSub,
                  ordersActive,
                  "orders",
                )}
              </NavItemGate>

              <NavItemGate navKey="products">
                {navParent(
                  isRTL ? "المنتجات" : "Products",
                  "/products",
                  Package,
                  productsSub,
                  productsActive,
                  "products",
                )}
              </NavItemGate>

              <NavItemGate navKey="customers">
                {navRow(isRTL ? "العملاء" : "Customers", "/customers", Users)}
              </NavItemGate>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ─── SELL & GROW ───────────────────────────────────────────── */}
        {groupLabel(isRTL ? "البيع والنمو" : "Sell & grow")}
        <SidebarGroup className="pt-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItemGate navKey="online-store">
                {navParent(
                  isRTL ? "المتجر الإلكتروني" : "Online Store",
                  "/online-store",
                  Storefront,
                  onlineStoreSub,
                  onlineStoreActive,
                  "online-store",
                )}
              </NavItemGate>

              <NavItemGate navKey="marketing">
                {navParent(
                  isRTL ? "التسويق" : "Marketing",
                  "/marketing",
                  Megaphone,
                  marketingSub,
                  marketingActive,
                  "marketing",
                )}
              </NavItemGate>

              <NavItemGate navKey="analytics">
                {navParent(
                  isRTL ? "التحليلات" : "Analytics",
                  "/analytics/overview",
                  ChartLineUp,
                  analyticsSub,
                  analyticsActive,
                  "analytics",
                )}
              </NavItemGate>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ─── MONEY ─────────────────────────────────────────────────── */}
        {groupLabel(isRTL ? "الفلوس" : "Money")}
        <SidebarGroup className="pt-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItemGate navKey="payments">
                {navParent(
                  isRTL ? "المالية" : "Finance",
                  "/payments",
                  Wallet,
                  financeSub,
                  financeActive,
                  "finance",
                )}
              </NavItemGate>

              <NavItemGate navKey="cod">
                {navRow(isRTL ? "تسوية الاستلام" : "COD reconcile", "/cod", Money)}
              </NavItemGate>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ─── OPERATIONS ────────────────────────────────────────────── */}
        {groupLabel(isRTL ? "العمليات" : "Operations")}
        <SidebarGroup className="pt-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItemGate navKey="logistics">
                {navParent(
                  isRTL ? "الشحن والتوصيل" : "Logistics",
                  "/logistics",
                  Truck,
                  logisticsSub,
                  logisticsActive,
                  "logistics",
                )}
              </NavItemGate>

              <NavItemGate navKey="channels">
                <Collapsible defaultOpen={channelsActive} className="group/channels">
                  <SidebarMenuItem>
                    <div className="flex items-center">
                      <SidebarMenuButton
                        asChild
                        isActive={channelsActive}
                        tooltip={isRTL ? "القنوات" : "Channels"}
                        className="h-10 rounded-lg px-3 flex-1"
                      >
                        <NavLink to="/channels">
                          <PlugZap size={20} weight={channelsActive ? "fill" : "duotone"} className="text-navy dark:text-saffron" />
                          <span className="text-[13px] font-medium">{isRTL ? "القنوات" : "Channels"}</span>
                          {totalUnread > 0 && (
                            <Badge variant="accent" className="ms-auto h-5 min-w-5 px-1.5 text-[10px] group-data-[state=open]/channels:hidden">
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
                                <Inbox size={14} weight={isActive("/inbox") ? "fill" : "duotone"} />
                                <span>{isRTL ? "الرسائل" : "Inbox"}</span>
                                {totalUnread > 0 && (
                                  <Badge variant="accent" className="ms-auto h-4 min-w-4 px-1 text-[9px]">
                                    {totalUnread > 99 ? "99+" : totalUnread}
                                  </Badge>
                                )}
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </NavItemGate>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={isActive("/social")}>
                            <NavLink to="/social">
                              <Sparkles size={14} weight={isActive("/social") ? "fill" : "duotone"} />
                              <span>{isRTL ? "سوشيال" : "Social"}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </NavItemGate>

              <NavItemGate navKey="whatsapp">
                {navParent(
                  isRTL ? "واتساب" : "WhatsApp",
                  "/whatsapp",
                  WhatsAppNavIcon,
                  whatsappOpsSub,
                  isActive("/whatsapp"),
                  "whatsapp-ops",
                )}
              </NavItemGate>

              <NavItemGate navKey="staff">
                {navParent(
                  isRTL ? "فريق العمل" : "Staff",
                  "/staff",
                  Users,
                  staffSub,
                  isActive("/staff") || isActive("/roles"),
                  "staff",
                )}
              </NavItemGate>

              <NavItemGate navKey="apps">
                {navRow(isRTL ? "التطبيقات" : "Apps", "/apps", Boxes)}
              </NavItemGate>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ─── FOOTER — Notifications + Settings + Store switcher ─────
          Matches the Souq spec: Settings sits in the footer with a
          store-switcher card just below (CT avatar + name + plan +
          caret-up-down menu). The store profile row is gone now that
          the switcher includes a "Store settings" entry. */}
      <SidebarFooter>
        <SidebarMenu>
          <NavItemGate navKey="notifications">
            {navRow(isRTL ? "الإشعارات" : "Notifications", "/notifications", Bell)}
          </NavItemGate>
          <NavItemGate navKey="settings">
            {navRow(isRTL ? "الإعدادات" : "Settings", "/settings", Gear)}
          </NavItemGate>
        </SidebarMenu>

        {/* Store switcher card — saffron-tile avatar + name + plan.
            Collapses to a bare avatar in icon mode. */}
        {currentStore && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="mt-2 mx-2 mb-1 flex items-center gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-accent/40 hover:bg-sidebar-accent/70 p-2 transition-colors group-data-[collapsible=icon]:mx-1 group-data-[collapsible=icon]:p-1.5 group-data-[collapsible=icon]:border-0"
                aria-label={currentStore.name}
              >
                {currentStore.logo_url ? (
                  <img
                    src={currentStore.logo_url}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-border"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-saffron-100 text-saffron-600 text-xs font-extrabold ring-1 ring-saffron-100">
                    {currentStore.name?.slice(0, 2).toUpperCase() || "ST"}
                  </div>
                )}
                <div className="flex-1 min-w-0 text-start group-data-[collapsible=icon]:hidden">
                  <div className="text-[13px] font-extrabold truncate leading-tight">
                    {currentStore.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {isRTL ? "باقة Premium" : "Premium plan"}
                  </div>
                </div>
                <CaretUpDown
                  size={15}
                  weight="bold"
                  className="text-muted-foreground/60 shrink-0 group-data-[collapsible=icon]:hidden"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              className="w-60 rounded-xl"
            >
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                {isRTL ? "متاجرك" : "Your stores"}
              </DropdownMenuLabel>
              {stores.map((store) => (
                <DropdownMenuItem
                  key={store.id}
                  onClick={() => switchStore(store.id)}
                  className="gap-2.5 rounded-lg py-2"
                >
                  {store.logo_url ? (
                    <img src={store.logo_url} alt="" className="h-6 w-6 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-saffron-100 text-saffron-600 text-[10px] font-extrabold shrink-0">
                      {store.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 truncate text-[13px] font-semibold">
                    {store.name}
                  </span>
                  {store.id === currentStore.id && (
                    <Check className="h-3.5 w-3.5 text-navy shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <NavItemGate navKey="store">
                <DropdownMenuItem
                  onClick={() => navigate("/store")}
                  className="gap-2.5 rounded-lg py-2"
                >
                  <Storefront size={16} weight="duotone" />
                  <span className="text-[13px]">
                    {isRTL ? "إعدادات المتجر" : "Store settings"}
                  </span>
                </DropdownMenuItem>
              </NavItemGate>
              <DropdownMenuItem
                onClick={() => navigate("/create-store")}
                className="gap-2.5 rounded-lg py-2"
              >
                <Plus className="h-4 w-4" strokeWidth={2.4} />
                <span className="text-[13px]">
                  {isRTL ? "متجر جديد" : "New store"}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
