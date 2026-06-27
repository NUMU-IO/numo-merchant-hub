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
