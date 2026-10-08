import { useQuery } from "@tanstack/react-query";
import { getStoreReadiness } from "@/services/storeApi";

export function useStoreReadiness(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store-readiness", storeId],
    queryFn: () => getStoreReadiness(storeId as string),
    enabled: !!storeId,
    staleTime: 30_000,
  });
}
