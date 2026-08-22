/**
 * Merchant notification feed — mirrors /stores/{store_id}/notifications/*.
 *
 * Rows carry a machine `kind` + `data` snapshot, not rendered copy; see
 * `lib/notifications/render.ts` for the bilingual titles.
 *
 * `apiClient` already unwraps the `{success, data}` envelope, so every
 * function here returns its result directly (no `.data`).
 */

import { apiClient } from "./api";

export type NotificationCategory =
  | "orders"
  | "abandoned_carts"
  | "payments"
  | "logistics"
  | "system";

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "orders",
  "abandoned_carts",
  "payments",
  "logistics",
  "system",
];

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  kind: string;
  data: Record<string, unknown>;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_important: boolean;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  next_cursor: string | null;
}

export interface UnreadCounts {
  total: number;
  important: number;
  by_category: Partial<Record<NotificationCategory, number>>;
}

export interface NotificationPreferences {
  muted_categories: NotificationCategory[];
  email_new_order: boolean;
  push_new_order: boolean;
  /** Web-push for important rows (cancelled / payment failed / returned / kill-switch). */
  push_important: boolean;
  /** Include customer name / items / payment method in push bodies. */
  push_rich_details: boolean;
  /** Email the owner for important rows — reaches every phone, no PWA needed. */
  email_important: boolean;
}

export interface ListNotificationsParams {
  category?: NotificationCategory;
  important?: boolean;
  unread_only?: boolean;
  cursor?: string | null;
  limit?: number;
}

function base(storeId: string) {
  return `/stores/${storeId}/notifications`;
}

export function listNotifications(
  storeId: string,
  params: ListNotificationsParams = {},
): Promise<NotificationListResponse> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.important) qs.set("important", "true");
  if (params.unread_only) qs.set("unread_only", "true");
  if (params.cursor) qs.set("cursor", params.cursor);
  if (params.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  return apiClient<NotificationListResponse>(`${base(storeId)}/${q ? `?${q}` : ""}`);
}

export function getUnreadCounts(storeId: string): Promise<UnreadCounts> {
  return apiClient<UnreadCounts>(`${base(storeId)}/unread-count`);
}

export async function markNotificationsRead(
  storeId: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  const res = await apiClient<{ updated: number }>(`${base(storeId)}/read`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
  return res.updated;
}

export async function markAllNotificationsRead(
  storeId: string,
  category?: NotificationCategory,
): Promise<number> {
  const res = await apiClient<{ updated: number }>(`${base(storeId)}/read-all`, {
    method: "POST",
    body: JSON.stringify(category ? { category } : {}),
  });
  return res.updated;
}

export function getNotificationPreferences(
  storeId: string,
): Promise<NotificationPreferences> {
  return apiClient<NotificationPreferences>(`${base(storeId)}/preferences`);
}

export function updateNotificationPreferences(
  storeId: string,
  patch: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  return apiClient<NotificationPreferences>(`${base(storeId)}/preferences`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}
