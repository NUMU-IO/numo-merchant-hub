/**
 * Shared helpers for the order detail section components.
 *
 * These were duplicated inline in Orders.tsx; extracting them keeps the new
 * section components self-contained without forcing every consumer to import
 * `useLanguage`.
 */

export function formatOrderCurrency(cents: number, language: string): string {
  const val = cents / 100;
  return language === "ar"
    ? `${val.toLocaleString("ar-EG")} ج.م`
    : `EGP ${val.toLocaleString()}`;
}

export const ORDER_STATUS_COLORS: Record<string, string> = {
  delivered: "bg-primary/10 text-primary",
  fulfilled: "bg-primary/10 text-primary",
  shipped: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  processing: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  pending: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
  returned: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: "bg-primary/10 text-primary",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  unpaid: "bg-destructive/10 text-destructive",
  cod: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  refunded: "bg-blue-500/10 text-blue-600",
  partially_refunded: "bg-blue-500/10 text-blue-600",
};

export const REFUND_STATUS_COLORS: Record<string, string> = {
  requested: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  processing: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  processed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  completed: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  failed: "bg-destructive/10 text-destructive",
};

export type FulfillmentStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export const FULFILLMENT_WORKFLOW: FulfillmentStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
];

export function getNextFulfillmentStatus(
  current: string,
): FulfillmentStatus | null {
  const idx = FULFILLMENT_WORKFLOW.indexOf(current as FulfillmentStatus);
  return idx >= 0 && idx < FULFILLMENT_WORKFLOW.length - 1
    ? FULFILLMENT_WORKFLOW[idx + 1]
    : null;
}

export function initialsFromName(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
