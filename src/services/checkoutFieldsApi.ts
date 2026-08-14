/**
 * Checkout fields API — merchant-configurable checkout form.
 * Backs the CheckoutFields settings page.
 */

import { apiClient } from "./api";

export type CustomFieldType = "text" | "textarea" | "number" | "select" | "checkbox";

export interface StandardFieldSetting {
  enabled: boolean;
  required: boolean;
}

export interface CustomFieldSetting {
  id?: string;
  label: string;
  label_ar?: string | null;
  type: CustomFieldType;
  required: boolean;
  placeholder?: string | null;
  options?: string[] | null;
  position: number;
}

/**
 * Phone-first identity layer (checkout-identity): the WhatsApp-OTP gate at
 * checkout + the "save your cart" nudge. Only takes effect once the
 * platform rollout gate is on AND the store's WhatsApp transport can
 * deliver an OTP; until then these settings are stored but inert.
 */
export interface IdentityConfig {
  require_verification: boolean;
  nudge_enabled: boolean;
  nudge_min_items: number;
  nudge_min_value_cents: number;
  nudge_delay_seconds: number;
}

export interface CheckoutFieldsConfig {
  standard_fields: Record<string, StandardFieldSetting>;
  custom_fields: CustomFieldSetting[];
  /** Optional so the page tolerates an older backend without the block. */
  identity?: IdentityConfig;
}

export async function getCheckoutFields(
  storeId: string,
): Promise<CheckoutFieldsConfig> {
  return apiClient<CheckoutFieldsConfig>(
    `/stores/${storeId}/settings/checkout-fields`,
  );
}

export async function updateCheckoutFields(
  storeId: string,
  config: CheckoutFieldsConfig,
): Promise<CheckoutFieldsConfig> {
  return apiClient<CheckoutFieldsConfig>(
    `/stores/${storeId}/settings/checkout-fields`,
    {
      method: "PUT",
      body: JSON.stringify(config),
    },
  );
}
