/**
 * Merchant hub nav config — public read.
 *
 * Tells the hub which tabs to hide, mark "coming soon", or reorder.
 * Written by platform admins via `/api/v1/admin/merchant-hub-nav`.
 */

import { apiClient } from "./api";

export interface NavTab {
  key: string;
  visible: boolean;
  coming_soon: boolean;
  order: number;
}

export interface NavConfig {
  tabs: NavTab[];
}

export async function fetchMerchantHubNav(): Promise<NavConfig> {
  return apiClient<NavConfig>("/public/merchant-hub-nav");
}
