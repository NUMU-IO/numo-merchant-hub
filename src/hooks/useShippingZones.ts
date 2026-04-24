/**
 * React Query hooks for shipping configuration.
 *
 * Read paths (zones, coverage, governorates) use `useQuery`; write paths
 * (create / update / delete / preset) use `useMutation` and invalidate
 * the relevant query keys on success.
 *
 * Query-key scheme (consistent with `Logistics.tsx` patterns):
 *   ["shipping-zones", storeId]             - list of zones
 *   ["shipping-zone", storeId, zoneId]      - single zone
 *   ["shipping-coverage", storeId]          - covered/uncovered split
 *   ["reference-governorates", locale]      - canonical governorate list
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  applyEgypt4ZonePreset,
  createShippingRate,
  createShippingZone,
  deleteShippingRate,
  deleteShippingZone,
  getShippingCoverage,
  getShippingZone,
  listReferenceGovernorates,
  listShippingZones,
  updateShippingRate,
  updateShippingZone,
  type CreateRateRequest,
  type CreateZoneRequest,
  type UpdateRateRequest,
  type UpdateZoneRequest,
} from "@/services/shippingApi";

// ─── Read hooks ──────────────────────────────────────────────────────

export function useShippingZones(storeId: string | undefined) {
  return useQuery({
    queryKey: ["shipping-zones", storeId],
    queryFn: () => listShippingZones(storeId!),
    enabled: !!storeId,
  });
}

export function useShippingZone(
  storeId: string | undefined,
  zoneId: string | undefined,
) {
  return useQuery({
    queryKey: ["shipping-zone", storeId, zoneId],
    queryFn: () => getShippingZone(storeId!, zoneId!),
    enabled: !!storeId && !!zoneId,
  });
}

export function useShippingCoverage(storeId: string | undefined) {
  return useQuery({
    queryKey: ["shipping-coverage", storeId],
    queryFn: () => getShippingCoverage(storeId!),
    enabled: !!storeId,
  });
}

export function useReferenceGovernorates(locale: "en" | "ar" = "en") {
  return useQuery({
    queryKey: ["reference-governorates", locale],
    queryFn: () => listReferenceGovernorates(locale),
    // Canonical list — never changes within a session. Keep forever.
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

// ─── Write hooks ─────────────────────────────────────────────────────

export function useCreateShippingZone(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateZoneRequest) => createShippingZone(storeId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-zones", storeId] });
      qc.invalidateQueries({ queryKey: ["shipping-coverage", storeId] });
    },
  });
}

export function useUpdateShippingZone(
  storeId: string | undefined,
  zoneId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateZoneRequest) =>
      updateShippingZone(storeId!, zoneId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-zones", storeId] });
      qc.invalidateQueries({ queryKey: ["shipping-zone", storeId, zoneId] });
      qc.invalidateQueries({ queryKey: ["shipping-coverage", storeId] });
    },
  });
}

export function useDeleteShippingZone(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (zoneId: string) => deleteShippingZone(storeId!, zoneId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-zones", storeId] });
      qc.invalidateQueries({ queryKey: ["shipping-coverage", storeId] });
    },
  });
}

export function useCreateShippingRate(
  storeId: string | undefined,
  zoneId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRateRequest) =>
      createShippingRate(storeId!, zoneId!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-zones", storeId] });
      qc.invalidateQueries({ queryKey: ["shipping-zone", storeId, zoneId] });
    },
  });
}

export function useUpdateShippingRate(
  storeId: string | undefined,
  zoneId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rateId, body }: { rateId: string; body: UpdateRateRequest }) =>
      updateShippingRate(storeId!, zoneId!, rateId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-zones", storeId] });
      qc.invalidateQueries({ queryKey: ["shipping-zone", storeId, zoneId] });
    },
  });
}

export function useDeleteShippingRate(
  storeId: string | undefined,
  zoneId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rateId: string) => deleteShippingRate(storeId!, zoneId!, rateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-zones", storeId] });
      qc.invalidateQueries({ queryKey: ["shipping-zone", storeId, zoneId] });
    },
  });
}

export function useApplyEgypt4ZonePreset(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => applyEgypt4ZonePreset(storeId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-zones", storeId] });
      qc.invalidateQueries({ queryKey: ["shipping-coverage", storeId] });
    },
  });
}
