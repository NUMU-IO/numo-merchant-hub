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
  /**
   * Admin-set rename. Empty (the default) means "use our own translated
   * name". An override replaces BOTH languages, because the admin has one
   * field and cannot hold two — that trade is spelled out on the admin
   * screen, and clearing it gives the translations back.
   */
  label?: string;
}

export interface NavConfig {
  tabs: NavTab[];
}

export async function fetchMerchantHubNav(): Promise<NavConfig> {
  return apiClient<NavConfig>("/public/merchant-hub-nav");
}
