/**
 * Fetches the platform-admin-controlled merchant hub nav config.
 *
 * Returns helpers that the sidebar uses to decide whether to show each
 * tab, mark it "coming soon", or reorder the list. Falls back to
 * "everything visible, default order" when the fetch fails so a broken
 * admin endpoint never breaks merchant navigation.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMerchantHubNav, type NavTab } from "@/services/navConfigApi";
import { listAppCatalog, listAppInstallations, NUMU_APP_HOME } from "@/services/appsApi";
import { useDashboardStore } from "@/contexts/StoreContext";

/**
 * The NUMU App a nav key belongs to. Behind `ff_numu_apps` these tabs follow
 * the store's install, so every caller of `isVisible` (sidebar, mobile sheet,
 * Settings hub) hides an uninstalled app the same way.
 */
function numuAppFor(key: string): string | null {
  if (key === "whatsapp" || key.startsWith("whatsapp.") || key === "marketing.whatsapp") {
    return "whatsapp";
  }
  if (key === "channels.inbox") return "inbox";
  return null;
}

export interface NavConfigHelpers {
  isReady: boolean;
  isVisible: (key: string) => boolean;
  isComingSoon: (key: string) => boolean;
  /**
   * The name to show for a tab: the admin's override when one is set,
   * otherwise `fallback` — which is the caller's own translated string.
   *
   * Whitespace is not a rename. An admin who clears the field by typing
   * spaces would otherwise blank the tab, and a nameless row in a sidebar is
   * unrecoverable without going back to the admin to guess which one it was.
   */
  labelFor: (key: string, fallback: string) => string;
  /**
   * Sort in-place a list of {key, ...} items according to admin-defined
   * order. Unknown keys keep their current relative position.
   */
  sortByAdminOrder: <T extends { key: string }>(items: T[]) => T[];
  getTab: (key: string) => NavTab | undefined;
}

export function useNavConfig(): NavConfigHelpers {
  const { data } = useQuery({
    queryKey: ["merchant-hub-nav"],
    queryFn: fetchMerchantHubNav,
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });

  const { currentStore } = useDashboardStore();
  // `ff_numu_apps` is per TENANT of the store, and /auth/me carries only the
  // user's own tenant, so a merchant with stores under several tenants would
  // read the wrong flag there. The API lists NUMU Apps in a store's catalog
  // only when that store's tenant has the flag, so the catalog is the answer.
  const { data: catalog } = useQuery({
    queryKey: ["apps", "catalog", currentStore?.id],
    queryFn: () => listAppCatalog(currentStore!.id),
    enabled: !!currentStore?.id,
    staleTime: 5 * 60 * 1000,
  });
  const numuApps = (catalog ?? []).some((a) => NUMU_APP_HOME[a.slug]);
  // Same key as useHubNav's query, so both read one cached list.
  const { data: installs } = useQuery({
    queryKey: ["apps", "installations", currentStore?.id],
    queryFn: () => listAppInstallations(currentStore!.id),
    enabled: numuApps && !!currentStore?.id,
    staleTime: 120_000,
  });

  return useMemo<NavConfigHelpers>(() => {
    const byKey = new Map<string, NavTab>();
    (data?.tabs ?? []).forEach((t) => byKey.set(t.key, t));
    // Unknown until the list loads: stay visible rather than flash a tab away
    // from a merchant who has the app.
    const appHidden = (key: string) => {
      const slug = numuAppFor(key);
      if (!numuApps || !slug || !installs) return false;
      return !installs.some((i) => i.slug === slug && i.is_enabled);
    };

    return {
      isReady: !!data,
      isVisible: (key) => (byKey.get(key)?.visible ?? true) && !appHidden(key),
      isComingSoon: (key) => byKey.get(key)?.coming_soon ?? false,
      labelFor: (key, fallback) => byKey.get(key)?.label?.trim() || fallback,
      getTab: (key) => byKey.get(key),
      sortByAdminOrder: (items) => {
        return [...items].sort((a, b) => {
          const ao = byKey.get(a.key)?.order ?? Number.MAX_SAFE_INTEGER;
          const bo = byKey.get(b.key)?.order ?? Number.MAX_SAFE_INTEGER;
          return ao - bo;
        });
      },
    };
  }, [data, numuApps, installs]);
}
