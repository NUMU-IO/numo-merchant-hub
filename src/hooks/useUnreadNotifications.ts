/**
 * Unread notification counts — one query shared by the header bell, the
 * PWA app badge (`useAppBadge`) and the Notifications page tab badges.
 *
 * Replaces the order-derived localStorage read-set: read state now lives
 * server-side (`/stores/{id}/notifications/unread-count`), so the badge is
 * identical on every device and survives a cleared cache. Mark-as-read
 * mutations call `invalidateNotificationQueries` so every consumer
 * refetches in the same tick.
 */

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getUnreadCounts, type UnreadCounts } from "@/services/notificationsApi";

export const UNREAD_POLL_MS = 45_000;

export const notificationKeys = {
  all: (storeId: string | undefined) => ["notifications", storeId] as const,
  unread: (storeId: string | undefined) =>
    ["notifications", storeId, "unread-count"] as const,
  list: (storeId: string | undefined, filter: Record<string, unknown>) =>
    ["notifications", storeId, "list", filter] as const,
  prefs: (storeId: string | undefined) =>
    ["notifications", storeId, "preferences"] as const,
};

export function invalidateNotificationQueries(
  qc: QueryClient,
  storeId: string | undefined,
): Promise<void> {
  return qc.invalidateQueries({ queryKey: notificationKeys.all(storeId) });
}

/**
 * `poll` should be true for exactly ONE mounted observer (DashboardLayout).
 * React Query attaches a refetchInterval timer per observer, so the bell,
 * the mobile nav and the page all polling meant up to 3 requests per tick.
 */
export function useUnreadCounts(storeId: string | undefined, opts: { poll?: boolean } = {}) {
  return useQuery<UnreadCounts>({
    queryKey: notificationKeys.unread(storeId),
    queryFn: () => getUnreadCounts(storeId!),
    enabled: !!storeId,
    refetchInterval: opts.poll ? UNREAD_POLL_MS : false,
    staleTime: UNREAD_POLL_MS - 5_000,
    // A failed poll must never surface as a red error anywhere — the bell
    // simply shows no badge.
    retry: 1,
  });
}

export function useUnreadNotificationCount(
  storeId: string | undefined,
  opts: { poll?: boolean } = {},
): number {
  const { data } = useUnreadCounts(storeId, opts);
  return data?.total ?? 0;
}

/** Convenience for components that mark read and want to invalidate. */
export function useInvalidateNotifications(storeId: string | undefined) {
  const qc = useQueryClient();
  return () => invalidateNotificationQueries(qc, storeId);
}
