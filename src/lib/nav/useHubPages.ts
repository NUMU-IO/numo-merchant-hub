/**
 * Flat registry of every navigable hub page (sidebar groups + children,
 * Channels, Apps, Settings cards, plus the merchant's custom pages),
 * keyed by URL. Used to label recent/pinned entries at render time and to
 * decide which route visits are worth remembering.
 */

import { useCallback, useMemo, type ComponentType } from "react";
import { Link as LinkIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useHubNav, type NavLeaf } from "./useHubNav";
import { pagesStore, usePagesState, type PagesState } from "./pages-store";

export type PageIcon = ComponentType<{ className?: string }>;

export interface HubPage {
  url: string;
  label: string;
  /** Parent group label (e.g. "Orders" for "Abandoned carts"). */
  group?: string;
  icon: PageIcon;
  custom?: boolean;
}

export interface ResolvedPage extends HubPage {
  pinned: boolean;
}

export function useHubPages() {
  const nav = useHubNav();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const state = usePagesState(storeId);

  const registry = useMemo(() => {
    const map = new Map<string, HubPage>();
    const put = (leaf: NavLeaf, group?: string) => {
      if (!map.has(leaf.url)) map.set(leaf.url, { url: leaf.url, label: leaf.label, group, icon: leaf.icon as PageIcon });
    };
    for (const g of nav.groups) {
      put(g);
      g.children?.forEach((c) => put(c, g.label));
      g.more?.items.forEach((c) => put(c, g.label));
    }
    nav.channelsItems.forEach((c) => put(c));
    nav.appsItems.forEach((c) => put(c));
    for (const section of nav.settingsSections) {
      for (const item of section.items) {
        if (!map.has(item.to)) {
          map.set(item.to, {
            url: item.to,
            label: language === "ar" ? item.title.ar : item.title.en,
            group: language === "ar" ? section.title.ar : section.title.en,
            icon: item.icon,
          });
        }
      }
    }
    for (const c of state.custom) {
      map.set(c.url, { url: c.url, label: c.label, icon: LinkIcon, custom: true });
    }
    return map;
  }, [nav.groups, nav.channelsItems, nav.appsItems, nav.settingsSections, state.custom, language]);

  const resolve = useCallback(
    (url: string): ResolvedPage | null => {
      const page = registry.get(url);
      return page ? { ...page, pinned: state.pinned.includes(url) } : null;
    },
    [registry, state.pinned],
  );

  const pinned = useMemo(
    () => state.pinned.map(resolve).filter((p): p is ResolvedPage => p !== null),
    [state.pinned, resolve],
  );
  const recent = useMemo(
    () => state.recent.map((r) => resolve(r.url)).filter((p): p is ResolvedPage => p !== null),
    [state.recent, resolve],
  );

  /** Match the current location to a registry URL (exact, then path only). */
  const match = useCallback(
    (pathname: string, search: string): string | null => {
      const full = pathname + search;
      if (registry.has(full)) return full;
      if (registry.has(pathname)) return pathname;
      return null;
    },
    [registry],
  );

  const actions = useMemo(
    () =>
      storeId
        ? {
            togglePin: (url: string) => pagesStore.togglePin(storeId, url),
            addCustom: (page: { url: string; label: string }) => pagesStore.addCustom(storeId, page),
            removeCustom: (url: string) => pagesStore.removeCustom(storeId, url),
            clearRecent: () => pagesStore.clearRecent(storeId),
            dismissIntro: () => pagesStore.dismissIntro(storeId),
          }
        : null,
    [storeId],
  );

  return { storeId, registry, state: state as PagesState, pinned, recent, resolve, match, actions };
}
