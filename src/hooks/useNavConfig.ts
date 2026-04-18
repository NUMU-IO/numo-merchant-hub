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

export interface NavConfigHelpers {
  isReady: boolean;
  isVisible: (key: string) => boolean;
  isComingSoon: (key: string) => boolean;
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

  return useMemo<NavConfigHelpers>(() => {
    const byKey = new Map<string, NavTab>();
    (data?.tabs ?? []).forEach((t) => byKey.set(t.key, t));

    return {
      isReady: !!data,
      isVisible: (key) => byKey.get(key)?.visible ?? true,
      isComingSoon: (key) => byKey.get(key)?.coming_soon ?? false,
      getTab: (key) => byKey.get(key),
      sortByAdminOrder: (items) => {
        return [...items].sort((a, b) => {
          const ao = byKey.get(a.key)?.order ?? Number.MAX_SAFE_INTEGER;
          const bo = byKey.get(b.key)?.order ?? Number.MAX_SAFE_INTEGER;
          return ao - bo;
        });
      },
    };
  }, [data]);
}
