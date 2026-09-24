import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDashboardStore } from "@/contexts/StoreContext";
import { entitlementKeys, getEntitlements, type Limit } from "@/services/entitlementsApi";

/** Keyed by store, not read from /auth/me: that is not refetched on a store switch. */
export function useEntitlements() {
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const { data, isError } = useQuery({
    queryKey: entitlementKeys.store(storeId),
    queryFn: () => getEntitlements(storeId!),
    enabled: !!storeId,
    staleTime: 60_000,
  });

  return useMemo(
    () => ({
      ready: !!data,
      failed: isError,
      plan: data?.plan ?? null,
      feature: (key: string) => data?.features[key],
      has: (key: string) => data?.features[key]?.available === true,
      limit: (key: string): Limit | null => {
        const value = data?.features[key]?.value;
        return typeof value === "number" || value === "unlimited" ? value : null;
      },
      flag: (key: string) => data?.flags.includes(key) ?? false,
    }),
    [data, isError],
  );
}
