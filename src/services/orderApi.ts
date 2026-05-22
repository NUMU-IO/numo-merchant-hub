/**
 * Order API service for the merchant dashboard.
 */

import { apiClient } from "./api";

// ── Types ──

export interface OrderLineItem {
  product_id: string;
  product_name: string;
  variant_id: string | null;
  variant_name: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number; // cents
  total_price: number; // cents
}

export interface OrderAddress {
  first_name: string;
  last_name: string;
  full_name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
}

export interface Order {
  id: string;
  store_id: string;
  customer_id: string;
  order_number: string;
  line_items: OrderLineItem[];
  shipping_address: OrderAddress;
  billing_address: OrderAddress | null;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  subtotal: number;
  shipping_cost: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  currency: string;
  payment_method: string | null;
  payment_id: string | null;
  shipping_method: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  notes: string | null;
  customer_notes: string | null;
  item_count: number;
  is_paid: boolean;
  can_be_cancelled: boolean;
  cancelled_at: string | null;
  paid_at: string | null;
  fulfilled_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderListItem {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string | null;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  total: number; // cents
  currency: string;
  item_count: number;
  payment_method: string | null;
  created_at: string;
  /**
   * Feature 001 — campaign attribution. Populated when the order has
   * a resolved `campaign_id` (set at checkout via campaign_resolver,
   * scoped by short_code per SEC-006). Rendered in the orders list as
   * a "via {campaign.name}" subtitle. Optional on the wire so this
   * client tolerates backends that haven't yet been extended to embed
   * the campaign join (gracefully no-op badge).
   */
  campaign?: { id: string; name: string } | null;
}

export interface PaginatedOrders {
  items: OrderListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TimelineEvent {
  timestamp: string;
  status: string;
  description: string;
}

export interface OrderTimeline {
  order_id: string;
  order_number: string;
  events: TimelineEvent[];
}

export interface BulkStatusResult {
  updated: number;
  failed: number;
  errors: Array<{ order_id: string; error: string }>;
}

export interface ListOrdersParams {
  page?: number;
  limit?: number;
  status?: string;
  payment_status?: string;
  fulfillment_status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  customer_id?: string;
}

// ── API calls ──

export async function listOrders(
  storeId: string,
  params?: ListOrdersParams,
): Promise<PaginatedOrders> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.status) qs.set("status", params.status);
  if (params?.payment_status) qs.set("payment_status", params.payment_status);
  if (params?.fulfillment_status) qs.set("fulfillment_status", params.fulfillment_status);
  if (params?.date_from) qs.set("date_from", params.date_from);
  if (params?.date_to) qs.set("date_to", params.date_to);
  if (params?.search) qs.set("search", params.search);
  // `customer_id` was typed on ListOrdersParams but never serialized —
  // Customers.tsx → customer detail view passed it expecting a per-customer
  // filter and silently got "all orders for the store" back (showed up on
  // the customer-history card as unrelated orders).
  if (params?.customer_id) qs.set("customer_id", params.customer_id);
  const query = qs.toString();
  return apiClient<PaginatedOrders>(
    `/stores/${storeId}/orders/${query ? `?${query}` : ""}`,
  );
}

export async function getOrder(
  storeId: string,
  orderId: string,
): Promise<Order> {
  return apiClient<Order>(`/stores/${storeId}/orders/${orderId}`);
}

export interface UpdateOrderData {
  tracking_number?: string;
  tracking_url?: string;
  shipping_method?: string;
  notes?: string;
  customer_notes?: string;
}

export async function updateOrder(
  storeId: string,
  orderId: string,
  data: UpdateOrderData,
): Promise<Order> {
  return apiClient<Order>(`/stores/${storeId}/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function updateOrderStatus(
  storeId: string,
  orderId: string,
  status: string,
  reason?: string,
): Promise<Order> {
  return apiClient<Order>(`/stores/${storeId}/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, reason }),
  });
}

export async function cancelOrder(
  storeId: string,
  orderId: string,
  reason?: string,
): Promise<void> {
  const qs = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  return apiClient<void>(`/stores/${storeId}/orders/${orderId}${qs}`, {
    method: "DELETE",
  });
}

export async function getOrderTimeline(
  storeId: string,
  orderId: string,
): Promise<OrderTimeline> {
  return apiClient<OrderTimeline>(
    `/stores/${storeId}/orders/${orderId}/timeline`,
  );
}

export async function bulkUpdateStatus(
  storeId: string,
  orderIds: string[],
  status: string,
  reason?: string,
): Promise<BulkStatusResult> {
  return apiClient<BulkStatusResult>(
    `/stores/${storeId}/orders/bulk-status`,
    {
      method: "POST",
      body: JSON.stringify({ order_ids: orderIds, status, reason }),
    },
  );
}

export async function markOrderPaid(
  storeId: string,
  orderId: string,
): Promise<Order> {
  return apiClient<Order>(`/stores/${storeId}/orders/${orderId}/mark-paid`, {
    method: "POST",
  });
}

// ── Manual Order Creation ──

export interface CreateOrderLineItem {
  product_id: string;
  product_name: string;
  variant_id?: string;
  variant_name?: string;
  sku?: string;
  quantity: number;
  unit_price: number; // cents
}

export interface CreateOrderAddress {
  first_name: string;
  last_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  postal_code?: string;
  country: string;
  phone?: string;
}

export interface CreateOrderData {
  customer_id: string;
  line_items: CreateOrderLineItem[];
  shipping_address: CreateOrderAddress;
  billing_address?: CreateOrderAddress;
  shipping_cost?: number;
  tax_amount?: number;
  discount_amount?: number;
  currency?: string;
  payment_method?: string;
  shipping_method?: string;
  customer_notes?: string;
}

export async function createManualOrder(
  storeId: string,
  data: CreateOrderData,
): Promise<Order> {
  return apiClient<Order>(`/stores/${storeId}/orders/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Draft Orders ──

/**
 * Save an order as a draft (status=DRAFT).
 *
 * Same shape as createManualOrder — but the backend skips trust checks and
 * suppresses the OrderCreatedEvent, so no emails / shipments / webhooks fire
 * until the merchant explicitly converts.
 */
export async function createDraftOrder(
  storeId: string,
  data: CreateOrderData,
): Promise<Order> {
  return apiClient<Order>(`/stores/${storeId}/orders/drafts`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Promote a draft order to PENDING. The backend runs the normal status
 * transition, so notifications / activity log / webhooks fire as if the
 * order had just been created.
 */
export async function convertDraftOrder(
  storeId: string,
  orderId: string,
): Promise<Order> {
  return apiClient<Order>(
    `/stores/${storeId}/orders/${orderId}/convert`,
    { method: "POST" },
  );
}

// ── Order Activity Stream (staff comments + persisted system events) ──

export interface OrderActivity {
  id: string;
  order_id: string;
  kind: "comment" | "system_event";
  event_type: string | null;
  body: string;
  user_id: string | null;
  user_name: string | null;
  user_avatar_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface PaginatedActivities {
  items: OrderActivity[];
  total: number;
  page: number;
  page_size: number;
}

export async function listOrderActivities(
  storeId: string,
  orderId: string,
  page: number = 1,
  limit: number = 50,
): Promise<PaginatedActivities> {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiClient<PaginatedActivities>(
    `/stores/${storeId}/orders/${orderId}/activities?${qs.toString()}`,
  );
}

export async function addOrderComment(
  storeId: string,
  orderId: string,
  content: string,
): Promise<OrderActivity> {
  return apiClient<OrderActivity>(
    `/stores/${storeId}/orders/${orderId}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    },
  );
}
