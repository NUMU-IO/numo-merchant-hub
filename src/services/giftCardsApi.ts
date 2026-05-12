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
  // Backend's IssueGiftCardRequest names this `initial_balance_cents`
  // (matches GiftCard.initial_balance_cents on the model). The previous
  // `amount_cents` field name caused a 422 "Field required" on every issue.
  initial_balance_cents: number;
  currency?: string;
  customer_id?: string | null;
  expires_at?: string | null;
  note?: string | null;
}

export interface ListGiftCardsParams {
  // page / limit are accepted but currently ignored by the backend — the
  // list endpoint returns all cards for the store (filtered by status).
  // Kept here so a future paginated backend doesn't require a signature change.
  page?: number;
  limit?: number;
  status?: "active" | "depleted" | "voided" | "expired";
  customer_id?: string;
}

export async function listGiftCards(
  storeId: string,
  params?: ListGiftCardsParams,
): Promise<GiftCard[]> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.status) qs.set("status", params.status);
  if (params?.customer_id) qs.set("customer_id", params.customer_id);
  const query = qs.toString();
  // Backend returns `SuccessResponse[list[GiftCardResponse]]` — apiClient
  // unwraps `data`, so we get a flat array here, not a paginated object.
  return apiClient<GiftCard[]>(
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
