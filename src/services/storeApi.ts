/**
 * Store API service — CRUD for merchant stores.
 */

import { apiClient } from "./api";

export interface StoreData {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  subdomain: string;
  custom_domain: string | null;
  store_url: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  status: string;
  default_currency: string;
  default_language: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  social_links: Record<string, string> | null;
  theme_settings: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedStores {
  items: StoreData[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CreateStoreData {
  name: string;
  subdomain: string;
  slug?: string;
  description?: string;
  default_currency?: string;
  default_language?: string;
  contact_email?: string;
  contact_phone?: string;
}

export interface CheckSubdomainResult {
  subdomain: string;
  available: boolean;
  message: string;
}

export async function listStores(): Promise<PaginatedStores> {
  return apiClient<PaginatedStores>("/stores/");
}

export async function createStore(data: CreateStoreData): Promise<StoreData> {
  return apiClient<StoreData>("/stores/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function checkSubdomain(
  subdomain: string
): Promise<CheckSubdomainResult> {
  return apiClient<CheckSubdomainResult>("/stores/check-subdomain", {
    method: "POST",
    body: JSON.stringify({ subdomain }),
  });
}

export async function getStore(storeId: string): Promise<StoreData> {
  return apiClient<StoreData>(`/stores/${storeId}`);
}
