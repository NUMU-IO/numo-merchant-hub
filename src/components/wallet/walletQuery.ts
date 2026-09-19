import { apiClient } from "@/services/api";

export interface WalletState {
  balance_cents: number;
  pending_balance_cents: number;
  currency: string;
  is_blocked: boolean;
  low_balance_level: number; // 0 healthy, 1 low, 2 negative, 3 blocked
  effective_commission_bps: number;
}

/** GET /wallet — one cache entry for the header chip and both wallet banners. */
export const walletQuery = {
  queryKey: ["wallet"] as const,
  queryFn: () => apiClient<WalletState>("/wallet"),
};
