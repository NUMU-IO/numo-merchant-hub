/**
 * Storefront access (password protection) API.
 *
 * Backs the "Password protect your store" control on the Online Store
 * landing. Wraps the backend's `/stores/{id}/settings/storefront-password`
 * endpoints, which persist `settings.password_protected = {enabled,
 * password_hash}` — the exact shape the Next.js storefront's pre-launch gate
 * reads. The plaintext is hashed server-side; we never store or return it.
 */

import { apiClient } from "./api";

export interface StorefrontPasswordStatus {
  enabled: boolean;
  /** Whether a password has been set (so the UI can offer "keep current"). */
  has_password: boolean;
  /**
   * Platform billing lock, separate from the merchant's own gate above.
   * Set while the tenant sits in `read_only` — an expired trial, a
   * cancellation, or a renewal that ran out of retries. The merchant cannot
   * turn this one off; only a wallet top-up (PAYG) or an activated
   * subscription clears it, so the UI shows it as state, never a toggle.
   */
  billing_locked: boolean;
  /** `awaiting_topup` for PAYG, `awaiting_subscription` for every other plan. */
  billing_lock_reason: string | null;
  /** Returned so the merchant can still open their own storefront. */
  billing_lock_password: string | null;
}

export function getStorefrontPassword(
  storeId: string,
): Promise<StorefrontPasswordStatus> {
  return apiClient<StorefrontPasswordStatus>(
    `/stores/${storeId}/settings/storefront-password`,
  );
}

export function updateStorefrontPassword(
  storeId: string,
  body: { enabled: boolean; password?: string },
): Promise<StorefrontPasswordStatus> {
  return apiClient<StorefrontPasswordStatus>(
    `/stores/${storeId}/settings/storefront-password`,
    { method: "PUT", body: JSON.stringify(body) },
  );
}
