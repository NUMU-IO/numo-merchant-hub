/**
 * Gift cards API service — Phase 8.3.
 *
 * Merchant-side: issue / list / void / refund. Storefront's balance
 * check + redemption live under /storefront — those don't go through
 * this file.
 *
 * The plaintext code is only returned from `issueGiftCard` once;
 * after that, only the hash + last_four live in the DB. UI must
 * surface the plaintext immediately + warn the merchant.
 */

import { apiClient } from "./api";

export interface GiftCard {
  id: string;
  store_id: string;
  last_four: string;
  initial_balance_cents: number;
  current_balance_cents: number;
  currency: string;
  status: "active" | "depleted" | "voided" | "expired";
  customer_id: string | null;
  issued_by_user_id: string | null;
  issuing_order_id: string | null;
  expires_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface IssueGiftCardResult {
  card: GiftCard;
  /** Plaintext code. ONLY available in this response. Show it to the
   * merchant once + warn that it can't be recovered from the DB. */
  code: string;
}

export interface IssueGiftCardData {
  amount_cents: number;
  currency: string;
  customer_id?: string | null;
  expires_at?: string | null;
  note?: string | null;
}

export interface ListGiftCardsParams {
  page?: number;
  limit?: number;
  status?: "active" | "depleted" | "voided" | "expired";
  customer_id?: string;
}

export interface PaginatedGiftCards {
  items: GiftCard[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function listGiftCards(
  storeId: string,
  params?: ListGiftCardsParams,
): Promise<PaginatedGiftCards> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.status) qs.set("status", params.status);
  if (params?.customer_id) qs.set("customer_id", params.customer_id);
  const query = qs.toString();
  return apiClient<PaginatedGiftCards>(
    `/stores/${storeId}/gift-cards${query ? `?${query}` : ""}`,
  );
}

export async function issueGiftCard(
  storeId: string,
  data: IssueGiftCardData,
): Promise<IssueGiftCardResult> {
  return apiClient<IssueGiftCardResult>(`/stores/${storeId}/gift-cards`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function voidGiftCard(
  storeId: string,
  cardId: string,
  note?: string,
): Promise<GiftCard> {
  return apiClient<GiftCard>(`/stores/${storeId}/gift-cards/${cardId}/void`, {
    method: "POST",
    body: JSON.stringify({ note: note ?? null }),
  });
}
