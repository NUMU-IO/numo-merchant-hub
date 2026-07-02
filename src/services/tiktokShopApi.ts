/**
 * TikTok Shop (sales channel) connection.
 *
 * Backend endpoints:
 *   GET/DELETE /stores/{id}/settings/channels/tiktok-shop  (status / disconnect)
 *   PUT        /stores/{id}/settings/channels/tiktok-shop   (connect — picker submit)
 *   /oauth/tiktok-shop/start?store_id=…                     (OAuth redirect)
 *
 * Orders placed on TikTok Shop flow into NUMU as native orders (source
 * recorded in order metadata) via the webhook + ingestion pipeline.
 */

import { apiClient } from "./api";

export interface TikTokShopStatus {
  connected: boolean;
  shop_id: string | null;
  shop_name: string | null;
  region: string | null;
  seller_name: string | null;
  connected_at: string | null;
}

export function tiktokShopOAuthStartUrl(storeId: string): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api/v1";
  return `${base.replace(/\/$/, "")}/oauth/tiktok-shop/start?store_id=${encodeURIComponent(storeId)}`;
}

export async function fetchTikTokShopStatus(
  storeId: string,
): Promise<TikTokShopStatus> {
  return apiClient<TikTokShopStatus>(
    `/stores/${storeId}/settings/channels/tiktok-shop`,
  );
}

export async function disconnectTikTokShop(storeId: string): Promise<void> {
  await apiClient<void>(`/stores/${storeId}/settings/channels/tiktok-shop`, {
    method: "DELETE",
  });
}
