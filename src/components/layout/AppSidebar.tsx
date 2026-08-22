import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Plus } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// Phosphor icons match the Souq spec: duotone at rest, fill when active.
import {
  House, ShoppingCart, Package, Users, Storefront, Megaphone,
  ChartLineUp, Wallet, Money, Truck, Gear, Cube as Boxes, SquaresFour,
  Tag, NotePencil as FileEdit, ShoppingBag, FolderOpen, Receipt, SealPercent as BadgePercent,
  Gift, Tray as Inbox, FileText, PaperPlaneTilt as Send,
  TrendUp as TrendingUp, UserPlus, MapPin, Sparkle as Sparkles,
  PlugsConnected as PlugZap, Envelope as Mail, Funnel as Filter, Broadcast as Radio,
  Lightbulb, ChartLine as LineChart, Cursor as MousePointerClick,
  ClipboardText as ClipboardList, ArrowsLeftRight as Navigation2,
  SlidersHorizontal, Palette, User, UserGear as UserCog, UserCheck,
  WarningCircle as AlertTriangle, ChartBar as BarChart3,
  CreditCard, ShieldCheck, Compass, Lightning, Article,
  CaretUpDown, CaretRight, CaretLeft, ChatsCircle,
} from "@phosphor-icons/react";
import { WhatsAppGlyph } from "@/components/whatsapp/WhatsAppGlyph";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useNavConfig } from "@/hooks/useNavConfig";
import { listThreads } from "@/services/inboxApi";
import { listThemeUpdates } from "@/services/themeUpdatesApi";
import { listAppInstallations } from "@/services/appsApi";
import { visibleSettingsSections } from "@/lib/settings-sections";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, SidebarMenuSub, SidebarMenuSubItem,
  SidebarMenuSubButton, useSidebar,
} from "@/components/ui/sidebar";
import { CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { NavItemGate } from "./NavItemGate";
import { NavCollapsible } from "./NavCollapsible";

type IconType = typeof House;
const WhatsAppNavIcon = WhatsAppGlyph as unknown as IconType;

/** One navigable row. `navKey` gates it against the platform-admin nav config. */
type Leaf = {
  key: string;
  label: string;
  url: string;
  icon: IconType;
  navKey: string;
  exact?: boolean;
  badge?: number;
  dot?: boolean;
};
type Group = Leaf & {
  children?: Leaf[];
  more?: { label: string; items: Leaf[] };
  /** Group is "open" (children shown) when this is true. */
  active: boolean;
};

type Tab = "dashboard" | "apps" | "settings";

/**
 * Zid-style shell: a segmented Dashboard / Apps / Settings switcher on
 * top, then a FLAT list. The active group shows its children inline
 * (no chevrons to manage); deeper areas (Channels, Settings sections)
 * drill in and replace the list with a back header.
 *
 * Tab + drill state follow the route, but a click INSIDE the sidebar
 * keeps the tab the merchant was on (Settings → "Products" stays on the
 * Settings tab, like Zid), while navigation from elsewhere (header,
 * search, deep link) re-seeds both from the URL.
 */
const AppSidebar = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentStore, stores, switchStore } = useDashboardStore();
  const { tenant, user } = useAuth();
  const { isVisible } = useNavConfig();
  const { isMobile, setOpenMobile } = useSidebar();

  const PLAN_LABELS: Record<string, { en: string; ar: string }> = {
    trial: { en: "Trial", ar: "تجربة مجانية" },
    demo: { en: "Trial", ar: "تجربة مجانية" },
    free: { en: "Free plan", ar: "الباقة المجانية" },
    beta: { en: "Beta", ar: "بيتا" },
    payg: { en: "Pay as you Grow", ar: "ادفع وأنت تنمو" },
    starter: { en: "Starter plan", ar: "باقة Starter" },
    pro: { en: "Pro plan", ar: "باقة Pro" },
    enterprise: { en: "Enterprise", ar: "إنتربرايز" },
  };
  const planLabel = (() => {
    const key = tenant?.plan;
    if (!key) return "…";
    const entry = PLAN_LABELS[key];
    if (!entry) return key;
    return isRTL ? entry.ar : entry.en;
  })();

  // ── Live badges ──────────────────────────────────────────────────────
  const { data: inboxData } = useQuery({
    queryKey: ["inbox", "threads", currentStore?.id],
    queryFn: () => listThreads(currentStore!.id),
    enabled: !!currentStore?.id,
  });
  const totalUnread = inboxData?.total_unread ?? 0;

  const { data: themeUpdates } = useQuery({
    queryKey: ["theme-updates", "pending", currentStore?.id],
    queryFn: () => listThemeUpdates(currentStore!.id),
    enabled: !!currentStore?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const hasThemeUpdate = (themeUpdates ?? []).some((n) => n.status === "pending");

  // ── Route → active states ────────────────────────────────────────────
  const path = location.pathname;
  const here = path + location.search;
  const isActive = (url: string, exact = false) =>
    exact || url === "/" ? path === url : path.startsWith(url);

  const ordersActive = isActive("/orders");
  const productsActive = isActive("/products") || isActive("/categories");
  const onlineStoreActive = isActive("/online-store");
  const marketingActive =
    isActive("/marketing") || isActive("/campaigns") || isActive("/gift-cards") ||
    isActive("/email-templates") || isActive("/agent-notes") || isActive("/referrals");
  const whatsappActive = isActive("/whatsapp") || isActive("/channels/whatsapp");
  const analyticsActive = isActive("/analytics") || isActive("/health-score");
  const financeActive =
    isActive("/payments") || isActive("/wallet") || isActive("/store-balance") ||
    isActive("/invoices") || isActive("/payment-setup") || isActive("/billing") ||
    isActive("/trust-network");
  const logisticsActive =
    isActive("/logistics") || isActive("/shipping") || isActive("/cod-autopilot") || isActive("/locations");
  const staffActive = isActive("/staff") || isActive("/roles");
  const channelsActive = isActive("/channels") || isActive("/inbox") || isActive("/social");

  // ── Dashboard tab data ───────────────────────────────────────────────
  const leaf = (key: string, label: string, url: string, icon: IconType, navKey: string, extra: Partial<Leaf> = {}): Leaf =>
    ({ key, label, url, icon, navKey, ...extra });

  const ordersSub = [
    leaf("orders.all", t("nav.allOrders"), "/orders", ShoppingCart, "orders.all", { exact: true }),
    leaf("orders.drafts", t("nav.drafts"), "/orders/drafts", FileEdit, "orders.drafts"),
    leaf("orders.abandoned", t("nav.abandoned"), "/orders/abandoned", ShoppingBag, "orders.abandoned"),
    leaf("orders.labels", t("nav.shippingLabels"), "/orders/shipping-labels", Tag, "orders.shipping-labels"),
  ];
  const productsSub = [
    leaf("products.all", t("nav.allProducts"), "/products", Package, "products.all", { exact: true }),
    leaf("products.categories", t("nav.categories"), "/categories", FolderOpen, "products.categories"),
  ];
  const marketingSub = [
    leaf("marketing.overview", t("nav.overview"), "/marketing", Megaphone, "marketing.overview", { exact: true }),
    leaf("marketing.promotions", t("nav.discounts"), "/marketing/promotions", BadgePercent, "marketing.promotions"),
    leaf("marketing.gift", t("nav.giftCards"), "/gift-cards", Gift, "marketing.gift-cards"),
    leaf("marketing.campaigns", t("nav.campaigns"), "/campaigns", Send, "marketing.campaigns"),
    leaf("marketing.email", t("nav.emailTemplates"), "/email-templates", Mail, "marketing.email-templates"),
    leaf("marketing.notes", t("nav.notesFaq"), "/agent-notes", FileText, "marketing.agent-notes"),
    leaf("marketing.attribution", t("nav.attribution"), "/marketing/attribution", TrendingUp, "marketing.attribution"),
    leaf("marketing.audiences", t("nav.audiences"), "/marketing/audiences", Users, "marketing.audiences"),
    leaf("marketing.referrals", t("nav.referrals"), "/referrals", UserPlus, "marketing.referrals"),
  ];
  const whatsappSub = [
    leaf("wa.inbox", t("nav.inbox"), "/whatsapp/inbox", Inbox, "whatsapp.inbox"),
    leaf("wa.campaigns", t("nav.campaigns"), "/whatsapp/campaigns", Send, "whatsapp.campaigns"),
    leaf("wa.templates", t("nav.templates"), "/channels/whatsapp/templates", FileText, "whatsapp.templates"),
    leaf("wa.optins", t("nav.optIns"), "/whatsapp/opt-ins", UserCheck, "whatsapp.opt-ins"),
    leaf("wa.byo", t("nav.byo"), "/whatsapp/byo", PlugZap, "whatsapp.byo"),
    leaf("wa.dead", t("nav.deadLetters"), "/whatsapp/dead-letters", AlertTriangle, "whatsapp.dead-letters"),
  ];
  const onlineStoreSub = [
    leaf("os.overview", t("nav.overview"), "/online-store", Storefront, "online-store.overview", { exact: true }),
    leaf("os.themes", t("nav.themes"), "/online-store/themes", Palette, "online-store.themes", { dot: hasThemeUpdate }),
    leaf("os.pages", t("nav.pages"), "/online-store/pages", FileText, "online-store.pages"),
    leaf("os.blog", t("nav.blog"), "/online-store/blog", Article, "online-store.blog"),
    leaf("os.files", t("nav.files"), "/online-store/files", FolderOpen, "online-store.files"),
    leaf("os.nav", t("nav.navigation"), "/online-store/navigation", Navigation2, "online-store.navigation"),
    leaf("os.prefs", t("nav.preferences"), "/online-store/preferences", SlidersHorizontal, "online-store.preferences"),
    leaf("os.checkout", t("nav.checkoutFields"), "/online-store/checkout-fields", ClipboardList, "online-store.checkout-fields"),
    leaf("os.mine", t("nav.myThemes"), "/online-store/my-themes", Package, "online-store.my-themes"),
  ];
  const analyticsSub = [
    leaf("an.overview", t("nav.overview"), "/analytics/overview", BarChart3, "analytics.overview"),
    leaf("an.sales", t("nav.sales"), "/analytics/sales", CreditCard, "analytics.sales"),
    leaf("an.orders", t("nav.orders"), "/analytics/orders", ShoppingCart, "analytics.orders"),
    leaf("an.customers", t("nav.customers"), "/analytics/customers", Users, "analytics.customers"),
    leaf("an.products", t("nav.products"), "/analytics/products", Package, "analytics.products"),
    leaf("an.funnel", t("nav.funnel"), "/analytics/funnel", Filter, "analytics.funnel"),
    leaf("an.reports", t("nav.reports"), "/analytics/reports", FileText, "analytics.reports"),
    leaf("an.health", t("nav.storeHealth"), "/health-score", Sparkles, "analytics.health"),
  ];
  const analyticsMore = [
    leaf("an.exec", t("nav.executive"), "/analytics/executive", Compass, "analytics.executive"),
    leaf("an.live", t("nav.live"), "/analytics/live", Radio, "analytics.live"),
    leaf("an.insights", t("nav.insights"), "/analytics/insights", Lightbulb, "analytics.insights"),
    leaf("an.forecast", t("nav.forecast"), "/analytics/forecast", LineChart, "analytics.forecast"),
    leaf("an.journey", t("nav.journey"), "/analytics/journey", MousePointerClick, "analytics.journey"),
    leaf("an.marketing", t("nav.marketing"), "/analytics/marketing", Megaphone, "analytics.marketing"),
  ];
  const logisticsSub = [
    leaf("lg.shipments", t("nav.shipments"), "/logistics", Truck, "logistics.shipments", { exact: true }),
    leaf("lg.autopilot", t("nav.codAutopilot"), "/cod-autopilot", Lightning, "logistics.cod-autopilot"),
    leaf("lg.zones", t("nav.zones"), "/shipping/zones", MapPin, "logistics.zones"),
    leaf("lg.locations", t("nav.locations"), "/locations", MapPin, "logistics.locations"),
  ];
  const financeSub = [
    leaf("fi.overview", t("nav.overview"), "/payments", Wallet, "payments.overview", { exact: true }),
    leaf("fi.payouts", t("nav.payouts"), "/wallet", TrendingUp, "payments.payouts"),
    leaf("fi.balance", t("nav.storeBalance"), "/store-balance", Money, "payments.store-balance"),
    leaf("fi.invoices", t("nav.invoices"), "/invoices", Receipt, "payments.invoices"),
    leaf("fi.setup", t("nav.paymentSetup"), "/payment-setup", CreditCard, "payments.payment-setup"),
    leaf("fi.trust", t("nav.trustNetwork"), "/trust-network", ShieldCheck, "payments.trust-network"),
    leaf("fi.billing", t("nav.billing"), "/billing", Sparkles, "payments.billing"),
  ];
  const staffSub = [
    leaf("st.members", t("nav.members"), "/staff", User, "staff.members"),
    leaf("st.roles", t("nav.roles"), "/roles", UserCog, "staff.roles"),
  ];

  const groups: Group[] = [
    { ...leaf("home", t("nav.home"), "/", House, "dashboard", { exact: true }), active: path === "/" },
    { ...leaf("orders", t("nav.orders"), "/orders", ShoppingCart, "orders"), children: ordersSub, active: ordersActive },
    { ...leaf("products", t("nav.products"), "/products", Package, "products"), children: productsSub, active: productsActive },
    { ...leaf("customers", t("nav.customers"), "/customers", Users, "customers"), active: isActive("/customers") },
    { ...leaf("marketing", t("nav.marketing"), "/marketing", Megaphone, "marketing"), children: marketingSub, active: marketingActive },
    { ...leaf("whatsapp", t("nav.whatsapp"), "/whatsapp", WhatsAppNavIcon, "whatsapp"), children: whatsappSub, active: whatsappActive },
    { ...leaf("online-store", t("nav.onlineStore"), "/online-store", Storefront, "online-store", { dot: hasThemeUpdate }), children: onlineStoreSub, active: onlineStoreActive },
    { ...leaf("analytics", t("nav.analytics"), "/analytics/overview", ChartLineUp, "analytics"), children: analyticsSub, more: { label: t("nav.moreAnalytics"), items: analyticsMore }, active: analyticsActive },
    { ...leaf("logistics", t("nav.logistics"), "/logistics", Truck, "logistics"), children: logisticsSub, active: logisticsActive },
    { ...leaf("finance", t("nav.finance"), "/payments", Wallet, "payments"), children: financeSub, active: financeActive },
    { ...leaf("cod", t("nav.cod"), "/cod", Money, "cod"), active: isActive("/cod") },
    { ...leaf("staff", t("nav.staff"), "/staff", UserCog, "staff"), children: staffSub, active: staffActive },
  ];

  const channelsItems: Leaf[] = [
    leaf("ch.inbox", t("nav.inbox"), "/inbox", Inbox, "channels.inbox", { badge: totalUnread }),
    leaf("ch.channels", t("nav.channels"), "/channels", PlugZap, "channels", { exact: true }),
    leaf("ch.social", t("nav.social"), "/social", Sparkles, "channels.social"),
  ];

  // ── Settings tab data (shared with the Settings hub page) ────────────
  const isOwner = user?.role === "store_owner";
  const settingsSections = useMemo(
    () => visibleSettingsSections(isVisible, isOwner),
    [isVisible, isOwner],
  );
  const settingsItemActive = (to: string) =>
    to.includes("?") ? here === to || here.startsWith(`${to}&`) : isActive(to);

  // ── Apps tab data ────────────────────────────────────────────────────
  const appsVisible = isVisible("apps");
  const settingsVisible = isVisible("settings");
  const { data: installedApps } = useQuery({
    queryKey: ["apps", "installations", currentStore?.id],
    queryFn: () => listAppInstallations(currentStore!.id),
    enabled: !!currentStore?.id && appsVisible,
    staleTime: 120_000,
  });

  // ── Tab + drill state ────────────────────────────────────────────────
  const routeTab: Tab = useMemo(() => {
    if (path.startsWith("/apps") && appsVisible) return "apps";
    if (
      settingsVisible &&
      (path.startsWith("/settings") || path.startsWith("/profile") || path === "/store")
    ) {
      return "settings";
    }
    return "dashboard";
  }, [path, appsVisible, settingsVisible]);

  const seedDrill = (tab: Tab): string | null => {
    if (tab === "settings") {
      const idx = settingsSections.findIndex(
        (s, i) => i > 0 && s.items.some((it) => settingsItemActive(it.to)),
      );
      return idx > 0 ? `settings:${idx}` : null;
    }
    if (tab === "dashboard" && channelsActive) return "channels";
    return null;
  };

  const [tabOverride, setTabOverride] = useState<Tab | null>(null);
  const tab = tabOverride ?? routeTab;
  const [drill, setDrill] = useState<string | null>(() => seedDrill(routeTab));
  // Set by every sidebar link; the route effect below reads + clears it.
  const fromSidebar = useRef(false);

  useEffect(() => {
    if (fromSidebar.current) {
      fromSidebar.current = false;
      return;
    }
    setTabOverride(null);
    setDrill(seedDrill(routeTab));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here]);

  const selectTab = (next: Tab) => {
    setTabOverride(next);
    setDrill(seedDrill(next));
  };
  const onNavigate = () => {
    fromSidebar.current = true;
    if (isMobile) setOpenMobile(false);
  };

  // ── Renderers ────────────────────────────────────────────────────────
  const iconClass = "text-navy dark:text-saffron shrink-0";

  const renderLeaf = (item: Leaf, active: boolean, icon: React.ReactNode) => (
    <SidebarMenuItem key={item.key}>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.label}
        className="h-10 rounded-lg px-3"
      >
        <NavLink to={item.url} onClick={onNavigate}>
          {icon}
          <span className="truncate text-[13px] font-medium">{item.label}</span>
          {item.badge ? (
            <span className="ms-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-saffron px-1 text-[10px] font-bold text-navy-900 group-data-[collapsible=icon]:hidden">
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          ) : item.dot ? (
            <span className="ms-auto h-2 w-2 rounded-full bg-saffron group-data-[collapsible=icon]:hidden" aria-hidden />
          ) : null}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const renderSub = (item: Leaf) => (
    <NavItemGate key={item.key} navKey={item.navKey}>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild isActive={isActive(item.url, item.exact)} className="h-8">
          <NavLink to={item.url} onClick={onNavigate}>
            <item.icon size={14} weight="duotone" className="shrink-0" />
            <span className="truncate text-[12.5px]">{item.label}</span>
            {item.badge ? (
              <span className="ms-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-saffron px-1 text-[9px] font-bold text-navy-900">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            ) : item.dot ? (
              <span className="ms-auto h-2 w-2 rounded-full bg-red-500 ring-2 ring-sidebar" aria-hidden />
            ) : null}
          </NavLink>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    </NavItemGate>
  );

  const renderGroup = (g: Group) => {
    const Icon = g.icon;
    return (
      <NavItemGate key={g.key} navKey={g.navKey}>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={g.active} tooltip={g.label} className="h-10 rounded-lg px-3">
            <NavLink to={g.url} onClick={onNavigate}>
              <Icon size={20} weight={g.active ? "fill" : "duotone"} className={iconClass} />
              <span className="truncate text-[13px] font-medium">{g.label}</span>
              {g.badge ? (
                <span className="ms-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-saffron px-1 text-[10px] font-bold text-navy-900 group-data-[collapsible=icon]:hidden">
                  {g.badge}
                </span>
              ) : g.dot && !g.active ? (
                <span className="ms-auto h-2 w-2 rounded-full bg-red-500 ring-2 ring-sidebar group-data-[collapsible=icon]:hidden" aria-hidden />
              ) : null}
            </NavLink>
          </SidebarMenuButton>
          {g.active && g.children && (
            <SidebarMenuSub className="group-data-[collapsible=icon]:hidden">
              {g.children.map(renderSub)}
              {g.more && (
                <NavCollapsible
                  active={g.more.items.some((m) => isActive(m.url))}
                  className="group/more"
                >
                  {(open) => (
                    <>
                      <SidebarMenuSubItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuSubButton className="h-8 cursor-pointer text-muted-foreground">
                            <CaretRight
                              size={12}
                              weight="bold"
                              className={cn(
                                "shrink-0 transition-transform",
                                isRTL ? "rotate-180" : "",
                                open && (isRTL ? "-rotate-90" : "rotate-90"),
                              )}
                            />
                            <span className="truncate text-[12.5px]">{g.more.label}</span>
                          </SidebarMenuSubButton>
                        </CollapsibleTrigger>
                      </SidebarMenuSubItem>
                      <CollapsibleContent>
                        <SidebarMenuSub className="ms-3">{g.more.items.map(renderSub)}</SidebarMenuSub>
                      </CollapsibleContent>
                    </>
                  )}
                </NavCollapsible>
              )}
            </SidebarMenuSub>
          )}
        </SidebarMenuItem>
      </NavItemGate>
    );
  };

  /** Row that drills into a sub-panel ("Channels ›"). */
  const renderDrillRow = (key: string, label: string, icon: React.ReactNode, active: boolean, badge?: number) => (
    <SidebarMenuItem key={key}>
      <SidebarMenuButton
        isActive={active}
        tooltip={label}
        className="h-10 rounded-lg px-3"
        onClick={() => setDrill(key)}
      >
        {icon}
        <span className="truncate text-[13px] font-medium">{label}</span>
        {badge ? (
          <span className="ms-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-saffron px-1 text-[10px] font-bold text-navy-900 group-data-[collapsible=icon]:hidden">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
        <CaretRight
          size={14}
          weight="bold"
          className={cn("shrink-0 text-muted-foreground/70 group-data-[collapsible=icon]:hidden", badge ? "ms-1" : "ms-auto", isRTL && "rotate-180")}
        />
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  /** Section pill — "General" at the root, "‹ Communications" when drilled in. */
  const renderPill = (label: string, onBack?: () => void) => (
    <div className="px-2 pb-1 pt-1 group-data-[collapsible=icon]:px-1">
      <button
        type="button"
        onClick={onBack}
        disabled={!onBack}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg bg-muted/70 px-3 text-[13px] font-bold text-foreground",
          onBack && "hover:bg-muted transition-colors",
          "group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
        )}
        aria-label={onBack ? t("nav.back") : undefined}
      >
        {onBack && (
          <CaretLeft size={14} weight="bold" className={cn("shrink-0", isRTL && "rotate-180")} />
        )}
        <span className="truncate group-data-[collapsible=icon]:hidden">{label}</span>
        {!onBack && <span className="hidden text-[11px] group-data-[collapsible=icon]:inline">§</span>}
      </button>
    </div>
  );

  // ── Panels ───────────────────────────────────────────────────────────
  const dashboardPanel = () => {
    if (drill === "channels") {
      return (
        <>
          {renderPill(t("nav.channels"), () => setDrill(null))}
          <SidebarMenu>
            {channelsItems.map((item) => (
              <NavItemGate key={item.key} navKey={item.navKey}>
                {renderLeaf(
                  item,
                  isActive(item.url, item.exact),
                  <item.icon size={20} weight={isActive(item.url, item.exact) ? "fill" : "duotone"} className={iconClass} />,
                )}
              </NavItemGate>
            ))}
          </SidebarMenu>
        </>
      );
    }
    return (
      <>
        <SidebarMenu>{groups.map(renderGroup)}</SidebarMenu>
        <NavItemGate navKey="channels">
          <SidebarMenu className="mt-2 border-t border-sidebar-border/60 pt-2">
            {renderDrillRow(
              "channels",
              t("nav.channels"),
              <ChatsCircle size={20} weight={channelsActive ? "fill" : "duotone"} className={iconClass} />,
              channelsActive,
              totalUnread,
            )}
          </SidebarMenu>
        </NavItemGate>
      </>
    );
  };

  const settingsPanel = () => {
    if (settingsSections.length === 0) return null;
    const sectionLabel = (s: (typeof settingsSections)[number]) => (isRTL ? s.title.ar : s.title.en);
    const renderItems = (items: (typeof settingsSections)[number]["items"]) => (
      <SidebarMenu>
        {items.map((item) => {
          const active = settingsItemActive(item.to);
          const ItemIcon = item.icon;
          return renderLeaf(
            { key: item.to, label: isRTL ? item.title.ar : item.title.en, url: item.to, icon: House, navKey: item.navKey ?? "" },
            active,
            <ItemIcon className={cn("h-[18px] w-[18px]", iconClass)} />,
          );
        })}
      </SidebarMenu>
    );

    const drilled = drill?.startsWith("settings:") ? Number(drill.split(":")[1]) : NaN;
    if (!Number.isNaN(drilled) && settingsSections[drilled]) {
      const s = settingsSections[drilled];
      return (
        <>
          {renderPill(sectionLabel(s), () => setDrill(null))}
          {renderItems(s.items)}
        </>
      );
    }
    const [first, ...rest] = settingsSections;
    return (
      <>
        {renderPill(sectionLabel(first))}
        {renderItems(first.items)}
        {rest.length > 0 && (
          <SidebarMenu className="mt-2 border-t border-sidebar-border/60 pt-2">
            {rest.map((s, i) =>
              renderDrillRow(
                `settings:${i + 1}`,
                sectionLabel(s),
                <Gear size={20} weight="duotone" className={cn(iconClass, "hidden group-data-[collapsible=icon]:block")} />,
                s.items.some((it) => settingsItemActive(it.to)),
              ),
            )}
          </SidebarMenu>
        )}
      </>
    );
  };

  const appsPanel = () => (
    <>
      <SidebarMenu>
        {renderLeaf(
          leaf("apps.browse", t("nav.browseApps"), "/apps", Compass, "apps"),
          isActive("/apps"),
          <Compass size={20} weight={isActive("/apps") ? "fill" : "duotone"} className={iconClass} />,
        )}
      </SidebarMenu>
      <div className="mt-2">{renderPill(t("nav.installedApps"))}</div>
      {installedApps && installedApps.length > 0 ? (
        <SidebarMenu>
          {installedApps.map((app) =>
            renderLeaf(
              { key: `app-${app.slug}`, label: app.name, url: "/apps", icon: Boxes, navKey: "apps", dot: !app.is_enabled },
              false,
              app.icon_url ? (
                <img src={app.icon_url} alt="" className="h-5 w-5 shrink-0 rounded-md object-cover" />
              ) : (
                <Boxes size={20} weight="duotone" className={iconClass} />
              ),
            ),
          )}
        </SidebarMenu>
      ) : (
        <p className="px-4 py-2 text-[12px] text-muted-foreground group-data-[collapsible=icon]:hidden">
          {t("nav.noApps")}
        </p>
      )}
    </>
  );

  const tabs: { key: Tab; icon: IconType; label: string; visible: boolean }[] = [
    { key: "dashboard", icon: House, label: t("nav.tabDashboard"), visible: true },
    { key: "apps", icon: SquaresFour, label: t("nav.tabApps"), visible: appsVisible },
    { key: "settings", icon: Gear, label: t("nav.tabSettings"), visible: settingsVisible },
  ];

  return (
    <Sidebar
      collapsible="icon"
      side={isRTL ? "right" : "left"}
      // Sits under the full-width top bar (see .dash-header / --topbar-h).
      className="md:!top-[var(--topbar-h)] md:!h-[calc(100svh-var(--topbar-h))]"
    >
      {/* ─── Segmented switcher — Dashboard / Apps / Settings ─────── */}
      <SidebarHeader className="p-2 pb-1">
        <div
          role="tablist"
          aria-label={t("nav.sections")}
          className="flex gap-1 rounded-xl bg-muted/60 p-1 group-data-[collapsible=icon]:flex-col"
        >
          {tabs.filter((x) => x.visible).map((x) => {
            const active = x.key === tab;
            const Icon = x.icon;
            return (
              <button
                key={x.key}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={x.label}
                title={x.label}
                onClick={() => selectTab(x.key)}
                className={cn(
                  "flex h-9 flex-1 items-center justify-center rounded-lg transition-colors",
                  active
                    ? "bg-card text-navy shadow-sm dark:text-saffron"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon size={20} weight={active ? "fill" : "duotone"} />
              </button>
            );
          })}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="pt-1">
          <SidebarGroupContent>
            {tab === "apps" ? appsPanel() : tab === "settings" ? settingsPanel() : dashboardPanel()}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ─── FOOTER — store switcher card ─────────────────────────── */}
      <SidebarFooter>
        {currentStore && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="mt-1 mx-2 mb-1 flex items-center gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-accent/40 hover:bg-sidebar-accent/70 p-2 transition-colors group-data-[collapsible=icon]:mx-1 group-data-[collapsible=icon]:p-1.5 group-data-[collapsible=icon]:border-0"
                aria-label={currentStore.name}
              >
                {currentStore.logo_url ? (
                  <img src={currentStore.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-border" />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-saffron-100 text-saffron-600 text-xs font-extrabold ring-1 ring-saffron-100">
                    {currentStore.name?.slice(0, 2).toUpperCase() || "ST"}
                  </div>
                )}
                <div className="flex-1 min-w-0 text-start group-data-[collapsible=icon]:hidden">
                  <div className="text-[13px] font-extrabold truncate leading-tight">{currentStore.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate mt-0.5">{planLabel}</div>
                </div>
                <CaretUpDown size={15} weight="bold" className="text-muted-foreground/60 shrink-0 group-data-[collapsible=icon]:hidden" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-60 rounded-xl">
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                {t("nav.yourStores")}
              </DropdownMenuLabel>
              {stores.map((store) => (
                <DropdownMenuItem key={store.id} onClick={() => switchStore(store.id)} className="gap-2.5 rounded-lg py-2">
                  {store.logo_url ? (
                    <img src={store.logo_url} alt="" className="h-6 w-6 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-saffron-100 text-saffron-600 text-[10px] font-extrabold shrink-0">
                      {store.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 truncate text-[13px] font-semibold">{store.name}</span>
                  {store.id === currentStore.id && <Check className="h-3.5 w-3.5 text-navy shrink-0" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <NavItemGate navKey="store">
                <DropdownMenuItem onClick={() => navigate("/store")} className="gap-2.5 rounded-lg py-2">
                  <Storefront size={16} weight="duotone" />
                  <span className="text-[13px]">{t("nav.storeSettings")}</span>
                </DropdownMenuItem>
              </NavItemGate>
              <DropdownMenuItem onClick={() => navigate("/create-store")} className="gap-2.5 rounded-lg py-2">
                <Plus className="h-4 w-4" strokeWidth={2.4} />
                <span className="text-[13px]">{t("nav.newStore")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
