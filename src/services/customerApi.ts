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
  location: string | null;
  /** Customer photo adopted from a linked conversation (nullable). */
  avatar_url?: string | null;
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

// ─── Create customer (merchant-side "Add customer") ──────────────────────────

export interface CreateCustomerInput {
  first_name: string;
  last_name?: string | null;
  phone: string;
  location: string;
  email?: string | null;
  accepts_marketing?: boolean;
  notes?: string | null;
  tags?: string[];
}

export async function createCustomer(
  storeId: string,
  input: CreateCustomerInput
): Promise<Customer> {
  return apiClient<Customer>(`/stores/${storeId}/customers/`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ─── Customer Trust Stats (cross-merchant network reputation) ───────────────

export interface CustomerTrustStats {
  has_data: boolean;
  network_orders: number;
  network_rtos: number;
  network_deliveries: number;
  network_refunds: number;
  contributing_store_count: number;
  rto_rate_pct: number;
  delivery_rate_pct: number;
  risk_score: number;
  risk_label: "new_to_network" | "low_risk" | "medium_risk" | "high_risk";
  confidence: "low" | "medium" | "high";
  last_order_at: string | null;
  last_rto_at: string | null;
  recommendation: "safe" | "caution" | "risky";
}

export async function getCustomerTrustStats(
  storeId: string,
  customerId: string
): Promise<CustomerTrustStats> {
  return apiClient<CustomerTrustStats>(
    `/stores/${storeId}/customers/${customerId}/trust-stats`
  );
}

// ─── Network-wide stats (for the empty-state trust card) ────────────────────

export interface NetworkStats {
  phones_analyzed: number;
  orders_analyzed: number;
  contributing_merchants: number;
}

export async function getNetworkStats(storeId: string): Promise<NetworkStats> {
  return apiClient<NetworkStats>(`/stores/${storeId}/customers/network-stats`);
}

// ─── Customer Journey (full touch timeline) ─────────────────────────────────

export interface JourneyTouch {
  id: string;
  ts: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  gclid: string | null;
  fbclid: string | null;
  /** TikTok click id. Optional: older API builds omit it. */
  ttclid?: string | null;
  referrer: string | null;
  landing_path: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  is_first_touch: boolean;
}

export interface CustomerJourney {
  customer_id: string;
  touch_count: number;
  touches: JourneyTouch[];
}

export async function getCustomerJourney(
  storeId: string,
  customerId: string,
  limit = 100
): Promise<CustomerJourney> {
  return apiClient<CustomerJourney>(
    `/stores/${storeId}/customers/${customerId}/journey?limit=${limit}`
  );
}

// ── Social profiles (linked inbox conversations) ────────────────────

export interface SocialProfile {
  kind: "thread" | "whatsapp";
  id: string;
  channel: "facebook" | "instagram" | "whatsapp";
  name: string | null;
  avatar_url: string | null;
  phone: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  status: string | null;
  /** Hub route that opens the conversation. */
  inbox_path: string;
}

export async function getCustomerSocialProfiles(
  storeId: string,
  customerId: string,
): Promise<SocialProfile[]> {
  const res = await apiClient<{ profiles: SocialProfile[] }>(
    `/stores/${storeId}/customers/${customerId}/social-profiles`,
  );
  return res.profiles;
}

/** Adopt a linked conversation's profile picture as the customer photo. */
export async function setCustomerAvatarFromThread(
  storeId: string,
  customerId: string,
  threadId: string,
): Promise<{ avatar_url: string }> {
  return apiClient<{ avatar_url: string }>(
    `/stores/${storeId}/customers/${customerId}/avatar`,
    { method: "POST", body: JSON.stringify({ thread_id: threadId }) },
  );
}
