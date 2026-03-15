/**
 * Refund API service for the merchant dashboard.
 */

import { apiClient } from "./api";

// ── Types ──

export interface Refund {
  id: string;
  order_id: string;
  store_id: string;
  refund_number: string;
  refund_type: "full" | "partial";
  status: RefundStatus;
  reason: RefundReason;
  reason_note: string | null;
  amount: number; // cents
  currency: string;
  payment_provider: string | null;
  payment_id: string | null;
  provider_refund_id: string | null;
  requested_by: string | null;
  approved_by: string | null;
  rejected_by: string | null;
  processed_at: string | null;
  completed_at: string | null;
  rejected_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RefundListItem {
  id: string;
  refund_number: string;
  order_id: string;
  order_number: string | null;
  refund_type: "full" | "partial";
  status: RefundStatus;
  reason: RefundReason;
  amount: number; // cents
  currency: string;
  created_at: string;
}

export interface PaginatedRefunds {
  items: RefundListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export type RefundStatus =
  | "requested"
  | "approved"
  | "processing"
  | "processed"
  | "completed"
  | "rejected"
  | "failed";

export type RefundReason =
  | "defective"
  | "wrong_item"
  | "not_as_described"
  | "customer_request"
  | "duplicate_order"
  | "other";

export interface CreateRefundRequest {
  refund_type: "full" | "partial";
  reason: RefundReason;
  reason_note?: string;
  amount?: number; // required for partial
}

// ── API calls ──

export async function createRefund(
  storeId: string,
  orderId: string,
  data: CreateRefundRequest,
): Promise<Refund> {
  return apiClient<Refund>(
    `/stores/${storeId}/orders/${orderId}/refunds`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function listOrderRefunds(
  storeId: string,
  orderId: string,
): Promise<PaginatedRefunds> {
  return apiClient<PaginatedRefunds>(
    `/stores/${storeId}/orders/${orderId}/refunds`,
  );
}

export async function getRefund(
  storeId: string,
  orderId: string,
  refundId: string,
): Promise<Refund> {
  return apiClient<Refund>(
    `/stores/${storeId}/orders/${orderId}/refunds/${refundId}`,
  );
}

export async function approveRefund(
  storeId: string,
  orderId: string,
  refundId: string,
): Promise<Refund> {
  return apiClient<Refund>(
    `/stores/${storeId}/orders/${orderId}/refunds/${refundId}/approve`,
    { method: "POST" },
  );
}

export async function rejectRefund(
  storeId: string,
  orderId: string,
  refundId: string,
  reason?: string,
): Promise<Refund> {
  return apiClient<Refund>(
    `/stores/${storeId}/orders/${orderId}/refunds/${refundId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ reason: reason || null }),
    },
  );
}

export async function processRefund(
  storeId: string,
  orderId: string,
  refundId: string,
): Promise<Refund> {
  return apiClient<Refund>(
    `/stores/${storeId}/orders/${orderId}/refunds/${refundId}/process`,
    { method: "POST" },
  );
}

export async function listStoreRefunds(
  storeId: string,
  params?: { status?: RefundStatus; page?: number; page_size?: number },
): Promise<PaginatedRefunds> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.page_size) qs.set("page_size", String(params.page_size));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiClient<PaginatedRefunds>(`/stores/${storeId}/refunds${query}`);
}
