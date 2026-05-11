/**
 * React Query hooks for the merchant Promotions screen.
 *
 * The list, detail, and analytics queries each include `currentStoreId`
 * in their cache key so switching stores in the dashboard never serves
 * stale data from another tenant.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import {
  activatePromotion,
  archivePromotion,
  archivePromotionExplicit,
  createPromotion,
  duplicatePromotion,
  getPromotion,
  getPromotionAnalytics,
  listPromotions,
  pausePromotion,
  updatePromotion,
  type CreatePromotionRequest,
  type ListPromotionsParams,
  type Promotion,
  type PromotionAnalytics,
  type PromotionList,
  type UpdatePromotionRequest,
} from "@/services/promotionApi";

export const promotionKeys = {
  all: (storeId: string) => ["promotions", storeId] as const,
  list: (storeId: string, params: ListPromotionsParams) =>
    [...promotionKeys.all(storeId), "list", params] as const,
  detail: (storeId: string, promotionId: string) =>
    [...promotionKeys.all(storeId), "detail", promotionId] as const,
  analytics: (
    storeId: string,
    promotionId: string,
    range: { range_start?: string; range_end?: string } | undefined,
  ) =>
    [
      ...promotionKeys.all(storeId),
      "analytics",
      promotionId,
      range ?? null,
    ] as const,
};

export function usePromotions(
  storeId: string | undefined,
  params: ListPromotionsParams = {},
  options?: Partial<UseQueryOptions<PromotionList>>,
) {
  return useQuery({
    queryKey: storeId ? promotionKeys.list(storeId, params) : ["promotions", "noop"],
    queryFn: () => listPromotions(storeId!, params),
    enabled: !!storeId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    ...options,
  });
}

export function usePromotion(
  storeId: string | undefined,
  promotionId: string | undefined,
  options?: Partial<UseQueryOptions<Promotion>>,
) {
  return useQuery({
    queryKey:
      storeId && promotionId
        ? promotionKeys.detail(storeId, promotionId)
        : ["promotions", "detail", "noop"],
    queryFn: () => getPromotion(storeId!, promotionId!),
    enabled: !!storeId && !!promotionId,
    staleTime: 15_000,
    ...options,
  });
}

export function usePromotionAnalytics(
  storeId: string | undefined,
  promotionId: string | undefined,
  range?: { range_start?: string; range_end?: string },
  options?: Partial<UseQueryOptions<PromotionAnalytics>>,
) {
  return useQuery({
    queryKey:
      storeId && promotionId
        ? promotionKeys.analytics(storeId, promotionId, range)
        : ["promotions", "analytics", "noop"],
    queryFn: () => getPromotionAnalytics(storeId!, promotionId!, range),
    enabled: !!storeId && !!promotionId,
    staleTime: 60_000,
    ...options,
  });
}

// --------------------------------------------------------------------------
// Mutations
// --------------------------------------------------------------------------

function invalidateAll(qc: ReturnType<typeof useQueryClient>, storeId: string) {
  return qc.invalidateQueries({ queryKey: promotionKeys.all(storeId) });
}

export function useCreatePromotion(
  storeId: string | undefined,
  options?: UseMutationOptions<Promotion, Error, CreatePromotionRequest>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePromotionRequest) =>
      createPromotion(storeId!, payload),
    ...options,
    onSuccess: async (data, variables, context) => {
      if (storeId) await invalidateAll(qc, storeId);
      await options?.onSuccess?.(data, variables, context);
    },
  });
}

export function useUpdatePromotion(
  storeId: string | undefined,
  promotionId: string | undefined,
  options?: UseMutationOptions<Promotion, Error, UpdatePromotionRequest>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdatePromotionRequest) =>
      updatePromotion(storeId!, promotionId!, payload),
    ...options,
    onSuccess: async (data, variables, context) => {
      if (storeId) await invalidateAll(qc, storeId);
      await options?.onSuccess?.(data, variables, context);
    },
  });
}

export function useArchivePromotion(
  storeId: string | undefined,
  options?: UseMutationOptions<void, Error, string>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (promotionId: string) => archivePromotion(storeId!, promotionId),
    ...options,
    onSuccess: async (data, variables, context) => {
      if (storeId) await invalidateAll(qc, storeId);
      await options?.onSuccess?.(data, variables, context);
    },
  });
}

type LifecycleAction = "activate" | "pause" | "archive";

export function useLifecycleAction(
  storeId: string | undefined,
  options?: UseMutationOptions<
    Promotion,
    Error,
    { promotionId: string; action: LifecycleAction }
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ promotionId, action }) => {
      switch (action) {
        case "activate":
          return activatePromotion(storeId!, promotionId);
        case "pause":
          return pausePromotion(storeId!, promotionId);
        case "archive":
          return archivePromotionExplicit(storeId!, promotionId);
      }
    },
    ...options,
    onSuccess: async (data, variables, context) => {
      if (storeId) await invalidateAll(qc, storeId);
      await options?.onSuccess?.(data, variables, context);
    },
  });
}

export function useDuplicatePromotion(
  storeId: string | undefined,
  options?: UseMutationOptions<Promotion, Error, string>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (promotionId: string) =>
      duplicatePromotion(storeId!, promotionId),
    ...options,
    onSuccess: async (data, variables, context) => {
      if (storeId) await invalidateAll(qc, storeId);
      await options?.onSuccess?.(data, variables, context);
    },
  });
}
