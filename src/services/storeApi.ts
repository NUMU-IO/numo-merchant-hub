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
  settings: Record<string, unknown> | null;
  theme_settings: Record<string, unknown> | null;
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
  invite_code?: string;
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

export interface UpdateStoreData {
  name?: string;
  description?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  social_links?: Record<string, string> | null;
  default_language?: string;
  status?: string;
  settings?: Record<string, unknown>;
  theme_settings?: Record<string, unknown>;
}

export async function updateStore(
  storeId: string,
  data: UpdateStoreData
): Promise<StoreData> {
  return apiClient<StoreData>(`/stores/${storeId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ─── Asset Upload ────────────────────────────────────────────────────────────

export interface UploadAssetResult {
  url: string;
  asset_type: string;
  filename: string;
}

export async function uploadStoreAsset(
  storeId: string,
  file: File,
  assetType: "logo" | "favicon" | "hero_image" | "profile_picture",
): Promise<UploadAssetResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("asset_type", assetType);

  return apiClient<UploadAssetResult>(`/stores/${storeId}/settings/customization/assets`, {
    method: "POST",
    body: formData,
  });
}

// ─── Shipping Settings ────────────────────────────────────────────────────────

export interface ShippingZone {
  id: string;
  zone: string;
  governorates: string;
  rate: number;
  estimated_days: string;
}

export interface ShippingCarrierStatus {
  enabled: boolean;
  is_configured: boolean;
  last_configured: string | null;
}

export interface ShippingSettings {
  aramex: ShippingCarrierStatus;
  bosta: ShippingCarrierStatus;
  mylerz: ShippingCarrierStatus;
  manual: ShippingCarrierStatus;
  zones: ShippingZone[];
  free_shipping_threshold: number;
}

export async function fetchShippingSettings(
  storeId: string
): Promise<ShippingSettings> {
  return apiClient<ShippingSettings>(`/stores/${storeId}/settings/shipping`);
}

export async function updateShippingSettings(
  storeId: string,
  data: { free_shipping_threshold?: number; manual_enabled?: boolean }
): Promise<ShippingSettings> {
  return apiClient<ShippingSettings>(`/stores/${storeId}/settings/shipping`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function addShippingZone(
  storeId: string,
  data: { zone: string; governorates: string; rate: number; estimated_days: string }
): Promise<ShippingZone> {
  return apiClient<ShippingZone>(`/stores/${storeId}/settings/shipping/zones`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteShippingZone(
  storeId: string,
  zoneId: string
): Promise<void> {
  await apiClient(`/stores/${storeId}/settings/shipping/zones/${zoneId}`, {
    method: "DELETE",
  });
}

// ─── Paymob Credentials ──────────────────────────────────────────────────────

export interface PaymobCredentialsResponse {
  is_configured: boolean;
  public_key_masked: string | null;
  secret_key_masked: string | null;
  hmac_secret_masked: string | null;
  card_integration_id: string | null;
  wallet_integration_id: string | null;
  last_configured: string | null;
}

export async function fetchPaymobCredentials(
  storeId: string
): Promise<PaymobCredentialsResponse> {
  return apiClient<PaymobCredentialsResponse>(
    `/stores/${storeId}/settings/payment/paymob/credentials`
  );
}

export async function savePaymobCredentials(
  storeId: string,
  data: {
    secret_key: string;
    public_key: string;
    hmac_secret: string;
    card_integration_id: string;
    wallet_integration_id?: string;
  }
): Promise<PaymobCredentialsResponse> {
  return apiClient<PaymobCredentialsResponse>(
    `/stores/${storeId}/settings/payment/paymob/credentials`,
    { method: "PUT", body: JSON.stringify(data) }
  );
}

export async function deletePaymobCredentials(
  storeId: string
): Promise<void> {
  await apiClient(`/stores/${storeId}/settings/payment/paymob/credentials`, {
    method: "DELETE",
  });
}

// ─── Kashier Credentials ─────────────────────────────────────────────────────

export interface KashierCredentialsResponse {
  is_configured: boolean;
  merchant_id: string | null;
  api_key_masked: string | null;
  last_configured: string | null;
}

export async function fetchKashierCredentials(
  storeId: string
): Promise<KashierCredentialsResponse> {
  return apiClient<KashierCredentialsResponse>(
    `/stores/${storeId}/settings/payment/kashier/credentials`
  );
}

export async function saveKashierCredentials(
  storeId: string,
  data: { merchant_id: string; api_key: string; secret_key?: string }
): Promise<KashierCredentialsResponse> {
  return apiClient<KashierCredentialsResponse>(
    `/stores/${storeId}/settings/payment/kashier/credentials`,
    { method: "PUT", body: JSON.stringify(data) }
  );
}

export async function deleteKashierCredentials(
  storeId: string
): Promise<void> {
  await apiClient(`/stores/${storeId}/settings/payment/kashier/credentials`, {
    method: "DELETE",
  });
}

// ─── Fawry Credentials ─────────────────────────────────────────────────────

export interface FawryCredentialsResponse {
  is_configured: boolean;
  merchant_code: string | null;
  security_key_masked: string | null;
  last_configured: string | null;
}

export async function fetchFawryCredentials(
  storeId: string
): Promise<FawryCredentialsResponse> {
  return apiClient<FawryCredentialsResponse>(
    `/stores/${storeId}/settings/payment/fawry/credentials`
  );
}

export async function saveFawryCredentials(
  storeId: string,
  data: {
    merchant_code: string;
    security_key: string;
  }
): Promise<FawryCredentialsResponse> {
  return apiClient<FawryCredentialsResponse>(
    `/stores/${storeId}/settings/payment/fawry/credentials`,
    { method: "PUT", body: JSON.stringify(data) }
  );
}

export async function deleteFawryCredentials(
  storeId: string
): Promise<void> {
  await apiClient(`/stores/${storeId}/settings/payment/fawry/credentials`, {
    method: "DELETE",
  });
}

// ─── Onboarding State ────────────────────────────────────────────────────────

export interface OnboardingStep {
  key: string;
  status: "pending" | "completed" | "skipped";
  is_skippable: boolean;
  completed_at: string | null;
  skipped_at: string | null;
}

export interface OnboardingData {
  id: string;
  store_id: string;
  steps: OnboardingStep[];
  completion_percentage: number;
  current_step: string | null;
  is_completed: boolean;
  is_dismissed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getOnboarding(storeId: string): Promise<OnboardingData> {
  return apiClient<OnboardingData>(`/stores/${storeId}/onboarding`);
}

export async function dismissOnboarding(storeId: string): Promise<OnboardingData> {
  return apiClient<OnboardingData>(`/stores/${storeId}/onboarding/dismiss`, {
    method: "POST",
  });
}

export async function undismissOnboarding(storeId: string): Promise<OnboardingData> {
  return apiClient<OnboardingData>(`/stores/${storeId}/onboarding/undismiss`, {
    method: "POST",
  });
}

export async function completeOnboardingStep(
  storeId: string,
  step: string
): Promise<OnboardingData> {
  return apiClient<OnboardingData>(
    `/stores/${storeId}/onboarding/complete/${step}`,
    { method: "POST" }
  );
}

export async function skipOnboardingStep(
  storeId: string,
  step: string
): Promise<OnboardingData> {
  return apiClient<OnboardingData>(
    `/stores/${storeId}/onboarding/skip/${step}`,
    { method: "POST" }
  );
}

// ─── Onboarding Wizard ────────────────────────────────────────────────────────

export interface WizardConfig {
  business_type: string;
  country: string;
  shipping_preference: string;
  payment_methods: string[];
  store_language: string;
}

export interface WizardConfigResult {
  configured: boolean;
  settings_applied: string[];
}

export async function configureFromWizard(
  storeId: string,
  config: WizardConfig
): Promise<WizardConfigResult> {
  return apiClient<WizardConfigResult>(
    `/stores/${storeId}/onboarding/configure`,
    {
      method: "POST",
      body: JSON.stringify(config),
    }
  );
}
