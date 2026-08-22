/**
 * Abandoned-checkout API service for the merchant dashboard.
 *
 * Backs the Abandoned Checkouts page under /orders/abandoned.
 */

import { apiClient } from "./api";

export interface AbandonedCheckoutLineItem {
  product_id: string | null;
  product_name: string | null;
  variant_id: string | null;
  variant_name: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface AbandonedCheckout {
  id: string;
  store_id: string;
  customer_id: string | null;
  email: string | null;
  phone: string | null;
  line_items: AbandonedCheckoutLineItem[];
  shipping_address: Record<string, unknown> | null;
  subtotal: number;
  shipping_cost: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  currency: string;
  coupon_code: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  last_activity_at: string;
  abandoned_at: string | null;
  recovered_at: string | null;
  recovery_email_sent_at: string | null;
  recovered_order_id: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface PaginatedAbandonedCheckouts {
  items: AbandonedCheckout[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ListAbandonedParams {
  page?: number;
  limit?: number;
  include_recovered?: boolean;
  only_recovered?: boolean;
  /** True = recoverable (has email or phone). False = browse-only carts. */
  has_contact?: boolean;
}

export async function listAbandonedCheckouts(
  storeId: string,
  params: ListAbandonedParams = {},
): Promise<PaginatedAbandonedCheckouts> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.include_recovered !== undefined)
    qs.set("include_recovered", String(params.include_recovered));
  if (params.only_recovered !== undefined)
    qs.set("only_recovered", String(params.only_recovered));
  if (params.has_contact !== undefined)
    qs.set("has_contact", String(params.has_contact));
  const query = qs.toString();
  return apiClient<PaginatedAbandonedCheckouts>(
    `/stores/${storeId}/abandoned-checkouts/${query ? `?${query}` : ""}`,
  );
}

export async function getAbandonedCheckout(
  storeId: string,
  checkoutId: string,
): Promise<AbandonedCheckout> {
  return apiClient<AbandonedCheckout>(
    `/stores/${storeId}/abandoned-checkouts/${checkoutId}`,
  );
}

export interface SendRecoveryEmailResult {
  checkout_id: string;
  email: string;
  sent_at: string;
}

export async function sendRecoveryEmail(
  storeId: string,
  checkoutId: string,
): Promise<SendRecoveryEmailResult> {
  return apiClient<SendRecoveryEmailResult>(
    `/stores/${storeId}/abandoned-checkouts/${checkoutId}/send-recovery-email`,
    { method: "POST" },
  );
}

export async function markAbandonedCheckoutRecovered(
  storeId: string,
  checkoutId: string,
  orderId?: string,
): Promise<AbandonedCheckout> {
  const qs = orderId ? `?order_id=${encodeURIComponent(orderId)}` : "";
  return apiClient<AbandonedCheckout>(
    `/stores/${storeId}/abandoned-checkouts/${checkoutId}/mark-recovered${qs}`,
    { method: "POST" },
  );
}

export interface NotifyWhatsAppResult {
  sent: boolean;
  // Machine-readable skip reason when sent is false (no_phone,
  // no_credentials, template_not_approved, send_failed, already_recovered…).
  reason: string | null;
  message_id?: string | null;
}

export async function notifyAbandonedCheckoutWhatsApp(
  storeId: string,
  checkoutId: string,
): Promise<NotifyWhatsAppResult> {
  return apiClient<NotifyWhatsAppResult>(
    `/stores/${storeId}/abandoned-checkouts/${checkoutId}/notify-whatsapp`,
    { method: "POST" },
  );
}

export interface AbandonedCheckoutSummary {
  open_count: number;
  open_value_cents: number;
  recovered_count: number;
  recovered_value_cents: number;
  reminders_sent: number;
  payback_pct: number;
  currency: string;
}

/** Analytics strip: open vs recovered carts, value, payback %, reminders. */
export function getAbandonedCheckoutSummary(
  storeId: string,
  params: { date_from?: string; date_to?: string } = {},
): Promise<AbandonedCheckoutSummary> {
  const qs = new URLSearchParams();
  if (params.date_from) qs.set("date_from", params.date_from);
  if (params.date_to) qs.set("date_to", params.date_to);
  const q = qs.toString();
  return apiClient<AbandonedCheckoutSummary>(
    `/stores/${storeId}/abandoned-checkouts/summary${q ? `?${q}` : ""}`,
  );
}
