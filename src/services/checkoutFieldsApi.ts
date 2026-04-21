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

export interface CheckoutFieldsConfig {
  standard_fields: Record<string, StandardFieldSetting>;
  custom_fields: CustomFieldSetting[];
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
