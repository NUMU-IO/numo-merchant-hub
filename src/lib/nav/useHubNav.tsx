/**
 * The hub's navigation model — ONE source for the desktop sidebar and the
 * mobile "More" sheet, so the two can never drift again.
 *
 * Groups mirror Zid's flat Dashboard list; Channels is a drill-in; the
 * Settings tab reuses `settings-sections.ts`; Apps lists installations.
 */

import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
} from "@phosphor-icons/react";
import { WhatsAppGlyph } from "@/components/whatsapp/WhatsAppGlyph";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useNavConfig } from "@/hooks/useNavConfig";
import { listThreads } from "@/services/inboxApi";
import { listThemeUpdates } from "@/services/themeUpdatesApi";
import { listAppInstallations } from "@/services/appsApi";
import { visibleSettingsSections, type SettingSection } from "@/lib/settings-sections";

export type NavIconType = typeof House;
const WhatsAppNavIcon = WhatsAppGlyph as unknown as NavIconType;

/** One navigable row. `navKey` gates it against the platform-admin nav config. */
export type NavLeaf = {
  key: string;
  label: string;
  url: string;
  icon: NavIconType;
  navKey: string;
  exact?: boolean;
  badge?: number;
  dot?: boolean;
};
export type NavGroup = NavLeaf & {
  children?: NavLeaf[];
  more?: { label: string; items: NavLeaf[] };
  /** Group is "open" (children shown) when this is true. */
  active: boolean;
};

export type HubTab = "dashboard" | "apps" | "settings";

export const HUB_TAB_ICONS: Record<HubTab, NavIconType> = {
  dashboard: House,
  apps: SquaresFour,
  settings: Gear,
};

export function useHubNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const { currentStore } = useDashboardStore();
  const { user } = useAuth();
  const { isVisible } = useNavConfig();

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

  const appsVisible = isVisible("apps");
  const settingsVisible = isVisible("settings");
  const { data: installedApps } = useQuery({
    queryKey: ["apps", "installations", currentStore?.id],
    queryFn: () => listAppInstallations(currentStore!.id),
    enabled: !!currentStore?.id && appsVisible,
    staleTime: 120_000,
  });

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

  const leaf = (key: string, label: string, url: string, icon: NavIconType, navKey: string, extra: Partial<NavLeaf> = {}): NavLeaf =>
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

  const groups: NavGroup[] = [
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

  const channelsItems: NavLeaf[] = [
    leaf("ch.inbox", t("nav.inbox"), "/inbox", Inbox, "channels.inbox", { badge: totalUnread }),
    leaf("ch.channels", t("nav.channels"), "/channels", PlugZap, "channels", { exact: true }),
    leaf("ch.social", t("nav.social"), "/social", Sparkles, "channels.social"),
  ];

  const appsItems: NavLeaf[] = [
    leaf("apps.browse", t("nav.browseApps"), "/apps", Compass, "apps"),
  ];

  // ── Settings tab (shared with the Settings hub page) ─────────────────
  const isOwner = user?.role === "store_owner";
  const settingsSections: SettingSection[] = useMemo(
    () => visibleSettingsSections(isVisible, isOwner),
    [isVisible, isOwner],
  );
  const settingsItemActive = (to: string) =>
    to.includes("?") ? here === to || here.startsWith(`${to}&`) : isActive(to);

  const routeTab: HubTab = useMemo(() => {
    if (path.startsWith("/apps") && appsVisible) return "apps";
    if (
      settingsVisible &&
      (path.startsWith("/settings") || path.startsWith("/profile") || path === "/store")
    ) {
      return "settings";
    }
    return "dashboard";
  }, [path, appsVisible, settingsVisible]);

  const tabs: { key: HubTab; icon: NavIconType; label: string; visible: boolean }[] = [
    { key: "dashboard", icon: House, label: t("nav.tabDashboard"), visible: true },
    { key: "apps", icon: SquaresFour, label: t("nav.tabApps"), visible: appsVisible },
    { key: "settings", icon: Gear, label: t("nav.tabSettings"), visible: settingsVisible },
  ];

  return {
    here,
    isActive,
    groups,
    channelsItems,
    channelsActive,
    appsItems,
    installedApps: installedApps ?? [],
    appsVisible,
    settingsVisible,
    settingsSections,
    settingsItemActive,
    routeTab,
    tabs,
    totalUnread,
    hasThemeUpdate,
    Boxes,
  };
}
