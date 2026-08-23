import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Home, ShoppingCart, Package, Plus, MoreHorizontal, X, Tag,
  ChevronRight, ChevronDown, Bell, Smartphone,
} from "lucide-react";
import { CaretRight } from "@phosphor-icons/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { listOrders } from "@/services/orderApi";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { IosInstallSheet } from "@/components/pwa/IosInstallSheet";
import { NavItemGate } from "@/components/layout/NavItemGate";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotifications";
import { useHubNav, type HubTab, type NavGroup, type NavLeaf } from "@/lib/nav/useHubNav";
import { cn } from "@/lib/utils";

type IconType = typeof Home;

/**
 * Souq mobile chrome: Home · Orders · +FAB · Products · More.
 *
 * The "More" sheet is the Zid shell on a phone — the same Dashboard /
 * Apps / Settings switcher and the same nav model as the desktop
 * sidebar (`useHubNav`), rendered as a list with expandable groups
 * instead of a tile grid. Notifications (with the unread count) sit at
 * the top because the header bell is the one thing a thumb can't reach.
 */
const MobileBottomNav = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentStore } = useDashboardStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { affordance: installAffordance, install } = useInstallPrompt();
  const [iosSheetOpen, setIosSheetOpen] = useState(false);
  const nav = useHubNav();
  const unreadNotifications = useUnreadNotificationCount(currentStore?.id);

  // Orders count badge (pending) — same signal the Dashboard attention bar uses.
  const ordersQuery = useQuery({
    queryKey: ["mnav", "ordersCount", currentStore?.id],
    queryFn: () => listOrders(currentStore!.id, { page: 1, limit: 1, status: "pending" }),
    enabled: !!currentStore?.id,
    staleTime: 60_000,
  });
  const pendingOrders = ordersQuery.data?.total ?? 0;

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  // ── Sheet state: tab + expanded group, re-seeded from the route on open ──
  const [tab, setTab] = useState<HubTab>(nav.routeTab);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    setTab(nav.routeTab);
    const activeGroup = nav.groups.find((g) => g.active && g.children);
    setExpanded(
      nav.channelsActive ? "channels" : activeGroup ? activeGroup.key : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  const quickAdd: { Icon: IconType; label: string; tone: string; href: string }[] = [
    { Icon: Package, label: t("nav.newProduct"), tone: "ichip-navy", href: "/products/new" },
    { Icon: ShoppingCart, label: t("nav.newOrder"), tone: "ichip-saffron", href: "/orders/create" },
    { Icon: Tag, label: t("nav.newDiscount"), tone: "ichip-sage", href: "/marketing/promotions/new" },
  ];

  const showInstall = installAffordance !== null;
  const goAdd = (href: string) => { setAddOpen(false); navigate(href); };
  const go = (href: string) => { setMenuOpen(false); navigate(href); };

  // ── Bottom tabs ─────────────────────────────────────────────────────
  type Tab = { key: string; label: string; Icon: IconType; path?: string; fab?: boolean; onClick?: () => void; count?: number };
  const tabs: Tab[] = [
    { key: "home", label: t("nav.home"), Icon: Home, path: "/" },
    { key: "orders", label: t("nav.orders"), Icon: ShoppingCart, path: "/orders", count: pendingOrders },
    { key: "add", label: t("nav.add"), Icon: Plus, fab: true, onClick: () => setAddOpen(true) },
    { key: "products", label: t("nav.products"), Icon: Package, path: "/products" },
    { key: "more", label: t("nav.more"), Icon: MoreHorizontal, onClick: () => setMenuOpen(true), count: unreadNotifications },
  ];

  // ── Sheet renderers ─────────────────────────────────────────────────
  const Row = ({
    icon, label, active, badge, dot, chevron, onClick, sub,
  }: {
    icon: React.ReactNode; label: string; active?: boolean; badge?: number; dot?: boolean;
    chevron?: "open" | "closed" | "link"; onClick: () => void; sub?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3 text-start transition-colors",
        sub ? "py-2 ps-12" : "py-2.5",
        active ? "bg-navy text-white dark:bg-saffron dark:text-navy-900" : "hover:bg-muted/60",
      )}
    >
      {icon}
      <span className={cn("flex-1 truncate", sub ? "text-[13.5px] font-medium" : "text-[14.5px] font-semibold")}>
        {label}
      </span>
      {badge ? (
        <span className={cn(
          "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
          active ? "bg-white/20" : "bg-saffron text-navy-900",
        )}>
          {badge > 99 ? "99+" : badge}
        </span>
      ) : dot ? (
        <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
      ) : null}
      {chevron === "open" ? (
        <ChevronDown className="h-4 w-4 opacity-60" />
      ) : chevron === "closed" ? (
        <CaretRight size={14} weight="bold" className={cn("opacity-60", isRTL && "rotate-180")} />
      ) : chevron === "link" ? (
        <ChevronRight className="h-4 w-4 opacity-60 rtl:rotate-180" />
      ) : null}
    </button>
  );

  const iconCls = (active?: boolean) =>
    cn("shrink-0", active ? "text-saffron dark:text-navy-900" : "text-navy dark:text-saffron");

  const renderLeaf = (item: NavLeaf, sub = false) => {
    const active = nav.isActive(item.url, item.exact);
    return (
      <NavItemGate key={item.key} navKey={item.navKey}>
        <Row
          sub={sub}
          icon={<item.icon size={sub ? 16 : 20} weight={active ? "fill" : "duotone"} className={iconCls(active)} />}
          label={item.label}
          active={active}
          badge={item.badge}
          dot={item.dot}
          onClick={() => go(item.url)}
        />
      </NavItemGate>
    );
  };

  const renderGroup = (g: NavGroup) => {
    const open = expanded === g.key;
    const hasChildren = !!g.children?.length;
    return (
      <NavItemGate key={g.key} navKey={g.navKey}>
        <div>
          <Row
            icon={<g.icon size={20} weight={g.active ? "fill" : "duotone"} className={iconCls(g.active && !hasChildren)} />}
            label={g.label}
            active={g.active && !hasChildren}
            dot={g.dot && !open}
            chevron={hasChildren ? (open ? "open" : "closed") : undefined}
            onClick={() => (hasChildren ? setExpanded(open ? null : g.key) : go(g.url))}
          />
          {hasChildren && open && (
            <div className="mb-1 space-y-0.5">
              {g.children!.map((c) => renderLeaf(c, true))}
              {g.more?.items.map((c) => renderLeaf(c, true))}
            </div>
          )}
        </div>
      </NavItemGate>
    );
  };

  const dashboardPanel = (
    <div className="space-y-0.5">
      {nav.groups.map(renderGroup)}
      <NavItemGate navKey="channels">
        <div className="mt-2 border-t border-border/60 pt-2">
          <Row
            icon={<Bell className="hidden" />}
            label={t("nav.channels")}
            badge={nav.totalUnread}
            chevron={expanded === "channels" ? "open" : "closed"}
            onClick={() => setExpanded(expanded === "channels" ? null : "channels")}
          />
          {expanded === "channels" && (
            <div className="space-y-0.5">{nav.channelsItems.map((c) => renderLeaf(c, true))}</div>
          )}
        </div>
      </NavItemGate>
    </div>
  );

  const appsPanel = (
    <div className="space-y-0.5">
      {nav.appsItems.map((c) => renderLeaf(c))}
      <h3 className="souq-eyebrow mt-3 mb-1 px-3">§ {t("nav.installedApps")}</h3>
      {nav.installedApps.length === 0 ? (
        <p className="px-3 py-2 text-[13px] text-muted-foreground">{t("nav.noApps")}</p>
      ) : (
        nav.installedApps.map((app) => (
          <Row
            key={app.slug}
            icon={
              app.icon_url ? (
                <img src={app.icon_url} alt="" className="h-5 w-5 rounded-md object-cover" />
              ) : (
                <nav.Boxes size={20} weight="duotone" className={iconCls()} />
              )
            }
            label={app.name}
            dot={!app.is_enabled}
            chevron="link"
            onClick={() => go("/apps")}
          />
        ))
      )}
    </div>
  );

  const settingsPanel = (
    <div className="space-y-3">
      {nav.settingsSections.map((section, i) => {
        const key = `settings:${i}`;
        const open = i === 0 || expanded === key;
        const label = isRTL ? section.title.ar : section.title.en;
        return (
          <div key={key}>
            {i === 0 ? (
              <h3 className="souq-eyebrow mb-1 px-3">§ {label}</h3>
            ) : (
              <Row
                icon={<span className="w-5" aria-hidden />}
                label={label}
                chevron={open ? "open" : "closed"}
                onClick={() => setExpanded(open ? null : key)}
              />
            )}
            {open && (
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = nav.settingsItemActive(item.to);
                  const ItemIcon = item.icon;
                  return (
                    <Row
                      key={item.to}
                      sub={i !== 0}
                      icon={<ItemIcon className={cn("h-[18px] w-[18px]", iconCls(active))} />}
                      label={isRTL ? item.title.ar : item.title.en}
                      active={active}
                      onClick={() => go(item.to)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-border bg-background/90 backdrop-blur-lg safe-bottom">
        {/* 60 px row, minimal bottom padding: the iOS home-indicator inset
            (.safe-bottom, 34 px) already provides the gap below the labels.
            76 px + pb-3 on top of it left the items floating mid-bar. */}
        <div className="flex items-stretch justify-around h-[60px] px-2 pt-1.5 pb-0.5">
          {tabs.map((tabItem) => {
            const active = tabItem.path ? isActive(tabItem.path) : false;
            const onTap = tabItem.onClick ?? (() => tabItem.path && navigate(tabItem.path));
            return (
              <button
                key={tabItem.key}
                type="button"
                onClick={onTap}
                aria-label={tabItem.label}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 flex-1 rounded-2xl transition-colors cursor-pointer ${
                  tabItem.fab
                    ? "text-saffron"
                    : active
                      ? "text-navy dark:text-saffron"
                      : "text-ink-faint hover:text-foreground"
                }`}
              >
                {tabItem.fab ? (
                  <div className="mnav-fab">
                    <tabItem.Icon className="h-6 w-6" strokeWidth={2.5} />
                  </div>
                ) : (
                  <span className="relative">
                    <tabItem.Icon className={`h-[25px] w-[25px] ${active ? "stroke-[2.5]" : ""}`} />
                    {tabItem.count && tabItem.count > 0 ? (
                      <span className={cn(
                        "absolute -top-1.5 -end-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-extrabold ring-2 ring-background tabular-nums",
                        tabItem.key === "more" ? "bg-red-500 text-white" : "bg-saffron text-navy-900",
                      )}>
                        {tabItem.count > 9 ? "9+" : tabItem.count}
                      </span>
                    ) : null}
                  </span>
                )}
                <span className={`text-[10.5px] leading-none ${active || tabItem.fab ? "font-bold" : "font-semibold"}`}>
                  {tabItem.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Quick add bottom sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-base font-extrabold">{t("nav.quickAdd")}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2.5 pt-4 pb-2">
            {quickAdd.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => goAdd(item.href)}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 hover-lift text-start"
              >
                <div className={`ichip ${item.tone} shrink-0`}>
                  <item.Icon className="h-5 w-5" />
                </div>
                <span className="text-[15px] font-bold flex-1">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* More sheet — Zid shell on a phone */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] flex flex-col p-0">
          <SheetHeader className="flex-row items-center justify-between px-4 pt-4 pb-2">
            <SheetTitle className="text-base font-extrabold">{t("nav.allSections")}</SheetTitle>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="h-9 w-9 rounded-xl bg-card border border-border grid place-items-center"
              aria-label={t("nav.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </SheetHeader>

          {/* Segmented switcher — same three tabs as the desktop sidebar */}
          <div className="px-4 pb-2">
            <div role="tablist" className="flex gap-1 rounded-xl bg-muted/60 p-1">
              {nav.tabs.filter((x) => x.visible).map((x) => {
                const active = x.key === tab;
                return (
                  <button
                    key={x.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => { setTab(x.key); setExpanded(null); }}
                    className={cn(
                      "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-bold transition-colors",
                      active ? "bg-card text-navy shadow-sm dark:text-saffron" : "text-muted-foreground",
                    )}
                  >
                    <x.icon size={18} weight={active ? "fill" : "duotone"} />
                    {x.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-3">
            {tab === "dashboard" && (
              <NavItemGate navKey="notifications">
                <Row
                  icon={<Bell className={cn("h-5 w-5", iconCls(isActive("/notifications")))} />}
                  label={t("nav.notifications")}
                  active={isActive("/notifications")}
                  badge={unreadNotifications}
                  chevron="link"
                  onClick={() => go("/notifications")}
                />
              </NavItemGate>
            )}

            {tab === "apps" ? appsPanel : tab === "settings" ? settingsPanel : dashboardPanel}

            {showInstall && (
              <div className="border-t border-border/60 pt-2">
                <Row
                  icon={<Smartphone className="h-5 w-5 text-navy dark:text-saffron" />}
                  label={t("nav.installApp")}
                  chevron="link"
                  onClick={() => {
                    setMenuOpen(false);
                    if (installAffordance === "native") void install();
                    else setIosSheetOpen(true);
                  }}
                />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <IosInstallSheet
        open={iosSheetOpen}
        onOpenChange={setIosSheetOpen}
        inWebView={installAffordance === "webview"}
      />
    </>
  );
};

export default MobileBottomNav;
