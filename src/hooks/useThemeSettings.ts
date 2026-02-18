/**
 * React Query hooks for theme / customization settings.
 *
 * Uses the current store from StoreContext instead of a hardcoded ID.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchThemes,
  fetchCustomization,
  updateCustomization,
  publishCustomization,
} from "@/services/themeApi";
import type { CustomizationData } from "@/services/themeApi";
import { useDashboardStore } from "@/contexts/StoreContext";

export function useAvailableThemes() {
  return useQuery({
    queryKey: ["themes"],
    queryFn: fetchThemes,
    staleTime: 1000 * 60 * 60, // themes rarely change
  });
}

export function useCurrentStoreId() {
  const { currentStore } = useDashboardStore();
  return currentStore?.id ?? "";
}

export function useCustomization(storeId?: string) {
  const fallbackId = useCurrentStoreId();
  const id = storeId || fallbackId;

  return useQuery({
    queryKey: ["customization", id],
    queryFn: () => fetchCustomization(id),
    enabled: !!id,
  });
}

export function useUpdateCustomization(storeId?: string) {
  const fallbackId = useCurrentStoreId();
  const id = storeId || fallbackId;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof updateCustomization>[1]) =>
      updateCustomization(id, data),
    onSuccess: (updated: CustomizationData) => {
      qc.setQueryData(["customization", id], updated);
    },
  });
}

export function usePublishCustomization(storeId?: string) {
  const fallbackId = useCurrentStoreId();
  const id = storeId || fallbackId;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => publishCustomization(id),
    onSuccess: (updated: CustomizationData) => {
      qc.setQueryData(["customization", id], updated);
    },
  });
}
