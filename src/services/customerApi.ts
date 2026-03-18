/**
 * Customer API service for the merchant dashboard.
 */

import { apiClient } from "./api";

export interface Customer {
  id: string;
  store_id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string | null;
  accepts_marketing: boolean;
  is_verified: boolean;
  total_orders: number;
  total_spent: number; // cents
  default_address_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PaginatedCustomers {
  items: Customer[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ListCustomersParams {
  page?: number;
  limit?: number;
  query?: string;
}

export async function listCustomers(
  storeId: string,
  params?: ListCustomersParams
): Promise<PaginatedCustomers> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.query) qs.set("query", params.query);
  const query = qs.toString();
  return apiClient<PaginatedCustomers>(
    `/stores/${storeId}/customers/${query ? `?${query}` : ""}`
  );
}

export async function getCustomer(
  storeId: string,
  customerId: string
): Promise<Customer> {
  return apiClient<Customer>(`/stores/${storeId}/customers/${customerId}`);
}
