import type { NotificationCategory, UnreadCounts } from "@/services/notificationsApi";

export type NotificationTab = "all" | "important" | NotificationCategory;

export const NOTIFICATION_TABS: NotificationTab[] = [
  "all",
  "important",
  "orders",
  "abandoned_carts",
  "payments",
  "logistics",
];

export function tabToFilter(tab: NotificationTab): {
  category?: NotificationCategory;
  important?: boolean;
} {
  if (tab === "all") return {};
  if (tab === "important") return { important: true };
  return { category: tab };
}

export function tabUnread(tab: NotificationTab, counts?: UnreadCounts): number {
  if (!counts) return 0;
  if (tab === "all") return counts.total;
  if (tab === "important") return counts.important;
  return counts.by_category[tab] ?? 0;
}
