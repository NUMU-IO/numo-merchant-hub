/**
 * The hub URL for an order: its order NUMBER when known ("/orders/ORD-767567"),
 * the UUID otherwise.
 *
 * Merchants read, say and paste the order number; a UUID in the address bar
 * means nothing to them. Screens that only hold an id (abandoned checkouts,
 * shipping labels, notifications) still link by UUID — the detail page accepts
 * both and swaps the address bar to the number once the order loads.
 */
export function orderPath(order: {
  id: string;
  order_number?: string | null;
}): string {
  return `/orders/${encodeURIComponent(order.order_number || order.id)}`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return !!value && UUID_RE.test(value);
}
