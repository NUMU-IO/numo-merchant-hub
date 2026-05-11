/**
 * Single source of truth for the merchant-hub "unread notifications" count.
 *
 * Two surfaces consume the same notion of "unread":
 *   • the bell-badge in `AppHeader` (top navbar)
 *   • the Notifications page list + its own internal count
 *
 * Before this hook existed, the bell-badge counted `pending + processing`
 * orders from a separate dashboard-stats query — totally unrelated to
 * "notifications read state" — so marking a notification as read on the
 * page did nothing for the badge. The two surfaces now share:
 *   • the same orders fetch (cached by React Query under one key),
 *   • the same `>24h auto-read` rule used by the page, and
 *   • the same localStorage set of user-marked-read ids.
 *
 * Mark-as-read writes from the Notifications page go through
 * `saveReadNotificationIds`, which dispatches a custom event so any
 * mounted hook instance (the header bell) re-reads localStorage and
 * recomputes immediately — without a roundtrip or refetch.
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listOrders, type OrderListItem } from "@/services/orderApi";

export const READ_NOTIFICATIONS_STORAGE_KEY = "numu-read-notifications";
export const READ_NOTIFICATIONS_EVENT = "numu:notifications-read-changed";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function loadReadNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_NOTIFICATIONS_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveReadNotificationIds(ids: Set<string>): void {
  try {
    localStorage.setItem(
      READ_NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify([...ids]),
    );
  } catch {
    /* storage unavailable — ignore */
  }
  // The native `storage` event only fires across documents, never in the
  // same tab that wrote the value. Dispatching this custom event is what
  // lets the header bell (mounted in the same tab as the Notifications
  // page) react instantly to mark-as-read clicks.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(READ_NOTIFICATIONS_EVENT));
  }
}

/**
 * Mirror of `ordersToNotifications` in `pages/Notifications.tsx` —
 * returns the id + auto-read flag for every notification the page would
 * render. Touch BOTH places if the page's notification-derivation rules
 * change, otherwise the badge and the list will drift again.
 */
export function notificationIdsFromOrders(
  orders: OrderListItem[],
  now: number = Date.now(),
): { id: string; autoRead: boolean }[] {
  const out: { id: string; autoRead: boolean }[] = [];
  for (const o of orders) {
    const autoRead = now - new Date(o.created_at).getTime() > ONE_DAY_MS;
    out.push({ id: `order-${o.id}`, autoRead });
    if (o.payment_status === "paid") {
      out.push({ id: `payment-${o.id}`, autoRead });
    }
  }
  return out;
}

export function useUnreadNotificationCount(
  storeId: string | undefined,
): number {
  const ordersQuery = useQuery({
    queryKey: ["notification-orders", storeId],
    queryFn: () => listOrders(storeId!, { limit: 20 }),
    enabled: !!storeId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const [readIds, setReadIds] = useState<Set<string>>(() =>
    loadReadNotificationIds(),
  );

  useEffect(() => {
    const sync = () => setReadIds(loadReadNotificationIds());
    window.addEventListener(READ_NOTIFICATIONS_EVENT, sync);
    // Cross-tab updates (open the page in a second tab, mark read there).
    window.addEventListener("storage", (e) => {
      if (!e.key || e.key === READ_NOTIFICATIONS_STORAGE_KEY) sync();
    });
    return () => {
      window.removeEventListener(READ_NOTIFICATIONS_EVENT, sync);
      window.removeEventListener("storage", sync as EventListener);
    };
  }, []);

  const orders = ordersQuery.data?.items ?? [];
  const ids = notificationIdsFromOrders(orders);
  return ids.filter(({ id, autoRead }) => !autoRead && !readIds.has(id))
    .length;
}
