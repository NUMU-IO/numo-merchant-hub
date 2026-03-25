/**
 * Upsell rules API service for the merchant dashboard.
 */

import { apiClient } from "./api";

export interface UpsellRule {
  id: string;
  store_id: string;
  name: string;
  is_active: boolean;
  trigger_type: "product" | "category" | "cart_value" | "any";
  trigger_product_ids: string[];
  trigger_category_ids: string[];
  trigger_min_cart_value: number;
  offer_product_id: string;
  discount_type: "percentage" | "fixed" | "none";
  discount_value: number;
  priority: number;
  max_uses: number | null;
  uses_count: number;
  headline_ar: string;
  headline_en: string;
  description_ar: string | null;
  description_en: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUpsellRule {
  name: string;
  trigger_type: string;
  trigger_product_ids?: string[];
  trigger_category_ids?: string[];
  trigger_min_cart_value?: number;
  offer_product_id: string;
  discount_type: string;
  discount_value: number;
  priority?: number;
  max_uses?: number | null;
  headline_ar?: string;
  headline_en?: string;
  description_ar?: string;
  description_en?: string;
}

export async function listUpsellRules(storeId: string): Promise<UpsellRule[]> {
  return apiClient<UpsellRule[]>(`/stores/${storeId}/upsells`);
}

export async function createUpsellRule(storeId: string, data: CreateUpsellRule): Promise<UpsellRule> {
  return apiClient<UpsellRule>(`/stores/${storeId}/upsells`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateUpsellRule(
  storeId: string,
  ruleId: string,
  data: Partial<CreateUpsellRule> & { is_active?: boolean },
): Promise<UpsellRule> {
  return apiClient<UpsellRule>(`/stores/${storeId}/upsells/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteUpsellRule(storeId: string, ruleId: string): Promise<void> {
  return apiClient<void>(`/stores/${storeId}/upsells/${ruleId}`, {
    method: "DELETE",
  });
}
