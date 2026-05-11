/**
 * Coupon API service for the merchant dashboard.
 */

import { apiClient } from "./api";

export interface Coupon {
  id: string;
  store_id: string;
  code: string;
  coupon_type:
    | "percentage"
    | "fixed"
    | "free_shipping"
    | "buy_x_get_y"
    | "tiered";
  value: string; // decimal string
  min_order_amount: string | null;
  max_discount_amount: string | null;
  usage_limit: number | null;
  usage_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  is_expired: boolean;
  is_usable: boolean;
  applicable_product_ids: string[] | null;
  applicable_category_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedCoupons {
  items: Coupon[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CreateCouponData {
  code: string;
  coupon_type:
    | "percentage"
    | "fixed"
    | "free_shipping"
    | "buy_x_get_y"
    | "tiered";
  value: number;
  /** Phase 8.4 — extra config for BOGO + tiered:
   *   buy_x_get_y → { buy_qty, get_qty, get_discount_percent, applicable_product_ids? }
   *   tiered      → { tiers: [{ min_subtotal_cents, percent | fixed_cents }, ...] }
   * Other types ignore this field. */
  config?: Record<string, unknown> | null;
  min_order_amount?: number | null;
  max_discount_amount?: number | null;
  usage_limit?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  applicable_product_ids?: string[] | null;
  applicable_category_ids?: string[] | null;
}

export interface UpdateCouponData {
  code?: string;
  coupon_type?:
    | "percentage"
    | "fixed"
    | "free_shipping"
    | "buy_x_get_y"
    | "tiered";
  config?: Record<string, unknown> | null;
  value?: number;
  min_order_amount?: number | null;
  max_discount_amount?: number | null;
  usage_limit?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active?: boolean;
  applicable_product_ids?: string[] | null;
  applicable_category_ids?: string[] | null;
}

export interface ListCouponsParams {
  page?: number;
  limit?: number;
  is_active?: boolean;
}

export async function listCoupons(
  storeId: string,
  params?: ListCouponsParams
): Promise<PaginatedCoupons> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.is_active !== undefined) qs.set("is_active", String(params.is_active));
  const query = qs.toString();
  return apiClient<PaginatedCoupons>(
    `/stores/${storeId}/coupons/${query ? `?${query}` : ""}`
  );
}

export async function getCoupon(
  storeId: string,
  couponId: string
): Promise<Coupon> {
  return apiClient<Coupon>(`/stores/${storeId}/coupons/${couponId}`);
}

export async function createCoupon(
  storeId: string,
  data: CreateCouponData
): Promise<Coupon> {
  return apiClient<Coupon>(`/stores/${storeId}/coupons/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCoupon(
  storeId: string,
  couponId: string,
  data: UpdateCouponData
): Promise<Coupon> {
  return apiClient<Coupon>(`/stores/${storeId}/coupons/${couponId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteCoupon(
  storeId: string,
  couponId: string
): Promise<void> {
  return apiClient<void>(`/stores/${storeId}/coupons/${couponId}`, {
    method: "DELETE",
  });
}
