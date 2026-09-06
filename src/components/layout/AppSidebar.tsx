import { useFounderCohort } from "@/hooks/useFounderCohort";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, Plus } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// Phosphor icons match the Souq spec: duotone at rest, fill when active.
import {
  Storefront, Gear, Cube as Boxes, Compass,
  CaretUpDown, CaretRight, CaretLeft, ChatsCircle,
} from "@phosphor-icons/react";
import { FounderBadge, FounderRing } from "@/components/brand/FounderBadge";
import { useAuth } from "@/contexts/AuthContext";
import { planLabel } from "@/lib/planLabel";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { NavLink } from "@/components/NavLink";
import { useHubNav, type NavLeaf as Leaf, type NavGroup as Group, type HubTab as Tab } from "@/lib/nav/useHubNav";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, SidebarMenuSub, SidebarMenuSubItem,
  SidebarMenuSubButton, useSidebar,
} from "@/components/ui/sidebar";
import { CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { NavItemGate } from "./NavItemGate";
import { StoreHealthBanner } from "./StoreHealthBanner";
import { NavCollapsible } from "./NavCollapsible";

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
/**
 * Zid-style affordance: a small chevron appears at the end of a row on
 * hover (and keyboard focus). Hidden on active rows — the navy fill already
 * says "you are here" — and in icon-collapsed mode.
 */
function HoverCaret({ trailing }: { trailing: boolean }) {
  const { isRTL } = useLanguage();
  return (
    <CaretRight
      size={12}
      weight="bold"
      aria-hidden
      className={cn(
        "shrink-0 text-muted-foreground/70 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-visible/row:opacity-100 group-data-[active=true]/row:hidden group-data-[collapsible=icon]:hidden",
        trailing ? "ms-auto" : "ms-1",
        isRTL && "rotate-180",
      )}
    />
  );
}

const AppSidebar = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const { currentStore, stores, switchStore } = useDashboardStore();
  const { tenant } = useAuth();
  const founderCohort = useFounderCohort();
  const { isMobile, setOpenMobile } = useSidebar();

  const planLabelText = planLabel(tenant?.plan, isRTL);

  const {
    here, isActive, groups, channelsItems, channelsActive, appsItems,
    installedApps, appsVisible, settingsVisible, settingsSections,
    settingsItemActive, routeTab, tabs, totalUnread,
  } = useHubNav();

  // ── Tab + drill state ────────────────────────────────────────────────
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
        className="group/row h-10 rounded-lg px-3"
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
          <HoverCaret trailing={!item.badge && !item.dot} />
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
          <SidebarMenuButton asChild isActive={g.active} tooltip={g.label} className="group/row h-10 rounded-lg px-3">
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
              <HoverCaret trailing={!g.badge && !(g.dot && !g.active)} />
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
            { key: item.to, label: isRTL ? item.title.ar : item.title.en, url: item.to, icon: Gear, navKey: item.navKey ?? "" },
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
          appsItems[0],
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
        <StoreHealthBanner />
        {currentStore && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="mt-1 mx-2 mb-1 flex items-center gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-accent/40 hover:bg-sidebar-accent/70 p-2 transition-colors group-data-[collapsible=icon]:mx-1 group-data-[collapsible=icon]:p-1.5 group-data-[collapsible=icon]:border-0"
                aria-label={currentStore.name}
              >
                <FounderRing cohort={founderCohort} className="rounded-xl">
                  {currentStore.logo_url ? (
                    <img src={currentStore.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-border" />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-saffron-100 text-saffron-600 text-xs font-extrabold ring-1 ring-saffron-100">
                      {currentStore.name?.slice(0, 2).toUpperCase() || "ST"}
                    </div>
                  )}
                </FounderRing>
                <div className="flex-1 min-w-0 text-start group-data-[collapsible=icon]:hidden">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[13px] font-extrabold truncate leading-tight">{currentStore.name}</span>
                    {/* Mark only, not the chip: this row truncates the store
                        name already, and the label would win space the name
                        needs. The full chip lives in Settings, where there is
                        room to say what it means. */}
                    <FounderBadge cohort={founderCohort} size="mark" className="shrink-0" />
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate mt-0.5">{planLabelText}</div>
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
