/**
 * Store API service — CRUD for merchant stores.
 */

import { apiClient } from "./api";
import { compressImage } from "@/lib/image-compression";
import type { ImageTransform } from "@/features/theme-editor-v3/components/inputs/imageTransform";

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
  /** ISO 3166-1 alpha-2 market code (e.g. "EG", "SA"). */
  country?: string;
  default_language: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  social_links: Record<string, string> | null;
  settings: Record<string, unknown> | null;
  theme_settings: Record<string, unknown> | null;
  business_hours: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  /**
   * Founder cohort year of THIS store's tenant, or null.
   *
   * Prefer this over the tenant on /auth/me: that one resolves to the
   * current-store tenant only when its owner_id matches the caller, and
   * otherwise falls back to any tenant the user owns. For a merchant with
   * two stores it answered about the wrong one.
   */
  founder_cohort?: string | null;
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
  /** ISO 3166-1 alpha-2 market code; defaults to "EG" server-side. */
  country?: string;
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

/**
 * Phase 5.11 — opt-in demo seed (5 products + 1 collection).
 *
 * Called from the CreateStore flow when the merchant toggles "Add
 * sample products". Idempotent — re-running against an already-
 * seeded store is a no-op (slug uniqueness covers it).
 */
export async function seedDemoCatalog(
  storeId: string,
): Promise<{ seeded: boolean; products: number; collections: number }> {
  return apiClient(`/stores/${storeId}/seed-demo`, { method: "POST" });
}

/**
 * Phase 5.11 — bulk delete demo-tagged products. Used by the
 * "I'm ready to go live" / "Reset demo" button in Settings.
 */
export async function removeDemoCatalog(
  storeId: string,
): Promise<{ deleted: number }> {
  return apiClient(`/stores/${storeId}/seed-demo`, { method: "DELETE" });
}

export async function checkSubdomain(
  subdomain: string
): Promise<CheckSubdomainResult> {
  return apiClient<CheckSubdomainResult>("/stores/check-subdomain", {
    method: "POST",
    body: JSON.stringify({ subdomain }),
  });
}

// ─── Custom domain (Cloudflare for SaaS) ─────────────────────────────────────

export interface CustomDomainDnsRecord {
  type: string;
  name: string;
  value: string;
}

/** Lifecycle the hub renders for a connected custom domain. */
export type CustomDomainStatus =
  | "none"
  | "pending_dns"
  | "verifying"
  | "active"
  | "failed";

export interface CustomDomainState {
  connected: boolean;
  domain: string | null;
  status: CustomDomainStatus;
  ssl_status: string | null;
  is_active: boolean;
  /** The single CNAME the merchant adds at their registrar. */
  cname: CustomDomainDnsRecord | null;
  /** Extra DCV records Cloudflare may require (usually empty with HTTP DCV). */
  verification: CustomDomainDnsRecord[];
  errors: string[];
  checked_at: string | null;
}

/** Current custom-domain status; polls Cloudflare for live cert state. */
export async function getCustomDomain(
  storeId: string,
): Promise<CustomDomainState> {
  return apiClient<CustomDomainState>(`/stores/${storeId}/custom-domain`);
}

/** Register a merchant-owned domain → returns the CNAME to add + status. */
export async function connectCustomDomain(
  storeId: string,
  domain: string,
): Promise<CustomDomainState> {
  return apiClient<CustomDomainState>(`/stores/${storeId}/custom-domain`, {
    method: "POST",
    body: JSON.stringify({ domain }),
  });
}

/** Remove the custom domain + its Cloudflare custom hostname. */
export async function disconnectCustomDomain(
  storeId: string,
): Promise<CustomDomainState> {
  return apiClient<CustomDomainState>(`/stores/${storeId}/custom-domain`, {
    method: "DELETE",
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
  business_hours?: Record<string, unknown> | null;
  /** Market country code (e.g. EG, SA) — re-resolves the market. */
  country?: string;
  /** ISO 4217 currency (e.g. EGP, SAR). Per-store; affects only this store. */
  default_currency?: string;
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

export type AssetType =
  | "logo"
  | "favicon"
  | "hero_image"
  | "profile_picture"
  | "section_image"
  | "social_image"
  | "generic_file";

export async function uploadStoreAsset(
  storeId: string,
  file: File,
  assetType: AssetType,
): Promise<UploadAssetResult> {
  // Favicons must stay crisp at their native size — don't touch. Everything
  // else (logo, banner, hero, profile, section images) gets downscaled to
  // fit comfortably under the server cap so phone photos upload cleanly.
  // `generic_file` skips compression too — PDFs, fonts, video, audio aren't
  // image candidates and would corrupt under the canvas-based path.
  const isImageAsset =
    assetType !== "favicon" && assetType !== "generic_file";
  const prepared = isImageAsset ? await compressImage(file) : file;

  const formData = new FormData();
  formData.append("file", prepared);
  formData.append("asset_type", assetType);

  return apiClient<UploadAssetResult>(`/stores/${storeId}/settings/customization/assets`, {
    method: "POST",
    body: formData,
  });
}

// ─── Asset Library ────────────────────────────────────────────────────────────

/**
 * One entry from `GET /stores/:id/settings/customization/assets`. The
 * backend returns whatever the storage service surfaces — keys vary
 * by backend (local-disk → `customization/<store_id>/<filename>`, R2
 * → the same prefix translated to an R2 key). Consumers only care
 * about `url` (for `<img>`) and `key` (for stable identity).
 */
export interface StoreAsset {
  key: string;
  url: string;
  /** Bytes. */
  size?: number;
  /** ISO timestamp string or empty when the storage backend doesn't track it. */
  last_modified?: string;
  /** Merchant-authored alt text (library default; seeds image-picker alt). */
  alt?: string;
  /** Friendly display label — metadata only, the object key never changes. */
  name?: string;
  /** Per-asset DEFAULT focal/zoom/rotation. Seeds a fresh placement's
   *  transform when this asset is first picked from the library. */
  transform?: ImageTransform;
}

/**
 * List all uploaded customization assets for a store. Used by the
 * Media Library tab in the V3 image picker so merchants can reuse
 * previously-uploaded imagery instead of re-uploading every time.
 */
export async function listStoreAssets(storeId: string): Promise<StoreAsset[]> {
  return apiClient<StoreAsset[]>(
    `/stores/${storeId}/settings/customization/assets`,
  );
}

/**
 * Update an asset's library metadata (alt text + friendly display
 * name). The object key / URL is immutable — only metadata changes —
 * so any section already referencing the URL keeps working.
 */
export async function updateStoreAsset(
  storeId: string,
  key: string,
  // `transform: null` explicitly CLEARS the asset's default; omitting it leaves
  // the stored default unchanged.
  meta: { alt?: string; name?: string; transform?: ImageTransform | null },
): Promise<{ key: string; alt?: string; name?: string; transform?: ImageTransform }> {
  return apiClient(`/stores/${storeId}/settings/customization/assets`, {
    method: "PATCH",
    body: JSON.stringify({ key, ...meta }),
  });
}

/**
 * Delete an uploaded asset from storage. The caller is responsible for
 * ensuring it isn't still referenced by a published section (Shopify
 * behaves the same — it warns but allows the delete).
 */
export async function deleteStoreAsset(
  storeId: string,
  key: string,
): Promise<{ key: string }> {
  return apiClient(`/stores/${storeId}/settings/customization/assets`, {
    method: "DELETE",
    body: JSON.stringify({ key }),
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
  /** When true, only ship to governorates that have a configured zone —
   *  uncovered destinations show "no options" at checkout. When false
   *  (default), uncovered destinations fall back to a free default rate so
   *  every place is shippable. */
  restrict_to_zones: boolean;
}

export async function fetchShippingSettings(
  storeId: string
): Promise<ShippingSettings> {
  return apiClient<ShippingSettings>(`/stores/${storeId}/settings/shipping`);
}

// ─── Payment settings (shape matches PaymentSettingsResponse) ───────

export interface PaymentMethodStatus {
  enabled: boolean;
  is_configured: boolean;
  last_configured: string | null;
}

/**
 * Payment methods verified by a customer-uploaded receipt rather than a
 * gateway callback — InstaPay and Vodafone Cash.
 *
 * Anything keyed off "is this order proof-verified?" must test this set
 * rather than a literal, or the next rail silently gets no proof UI.
 * Mirrors `MANUAL_TRANSFER_METHODS` in the API.
 */
export const MANUAL_PAYMENT_METHODS = ["instapay", "vodafone_cash"] as const;

/**
 * A payment method as a merchant should read it.
 *
 * `order.payment_method` is a wire enum — rendering it raw put
 * "vodafone_cash", underscore and all, on the order card. Unknown codes
 * fall back to a de-underscored, title-cased form so a gateway added later
 * still reads as words rather than crashing or showing nothing.
 */
const PAYMENT_METHOD_LABELS: Record<string, { en: string; ar: string }> = {
  cod: { en: "Cash on Delivery", ar: "الدفع عند الاستلام" },
  instapay: { en: "InstaPay", ar: "انستاباي" },
  vodafone_cash: { en: "Vodafone Cash", ar: "فودافون كاش" },
  paymob: { en: "Paymob", ar: "باي موب" },
  paymob_card: { en: "Card (Paymob)", ar: "بطاقة (باي موب)" },
  kashier: { en: "Kashier", ar: "كاشير" },
  fawry: { en: "Fawry", ar: "فوري" },
  fawaterak: { en: "Fawaterak", ar: "فواتيرك" },
  moyasar: { en: "Moyasar", ar: "ميسر" },
  bank_transfer: { en: "Bank Transfer", ar: "تحويل بنكي" },
};

export function paymentMethodLabel(method?: string | null, isAr = false): string {
  if (!method) return "";
  const known = PAYMENT_METHOD_LABELS[method];
  if (known) return isAr ? known.ar : known.en;
  return method
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function isManualPaymentMethod(method?: string | null): boolean {
  return (MANUAL_PAYMENT_METHODS as readonly string[]).includes(method ?? "");
}

/** Gateways that can carry a COD deposit. Must stay in sync with the
 *  backend's `DepositGateway` literal. */
export type DepositGateway =
  | "paymob"
  | "kashier"
  | "fawry"
  | "fawaterak"
  | "instapay";

export const DEPOSIT_GATEWAY_VALUES: DepositGateway[] = [
  "paymob",
  "kashier",
  "fawry",
  "fawaterak",
  "instapay",
];

export interface CodDepositPolicy {
  enabled: boolean;
  amount_cents: number;
  /** Minutes the customer has to complete the deposit before auto-cancel. */
  ttl_minutes: number;
  /** If true, cancelling an order with a paid deposit auto-refunds via the gateway. */
  auto_refund_on_cancel: boolean;
  /** Allowlist of gateways customers can use for the deposit. */
  allowed_gateways: DepositGateway[];
}

export interface PaymentSettings {
  cod: PaymentMethodStatus;
  fawry: PaymentMethodStatus;
  fawaterak: PaymentMethodStatus;
  paymob: PaymentMethodStatus;
  kashier: PaymentMethodStatus;
  instapay: PaymentMethodStatus;
  vodafone_cash: PaymentMethodStatus;
  bank_transfer: PaymentMethodStatus;
  bank_accounts_count: number;
  cod_deposit_policy: CodDepositPolicy;
}

export async function fetchPaymentSettings(
  storeId: string,
): Promise<PaymentSettings> {
  return apiClient<PaymentSettings>(`/stores/${storeId}/settings/payment`);
}

/**
 * Partial update — only the fields present in `patch` are modified
 * server-side. Mirrors the backend's `UpdatePaymentSettingsRequest`.
 */
export async function updatePaymentSettings(
  storeId: string,
  patch: {
    cod_enabled?: boolean;
    fawry_enabled?: boolean;
    fawaterak_enabled?: boolean;
    paymob_enabled?: boolean;
    kashier_enabled?: boolean;
    instapay_enabled?: boolean;
    vodafone_cash_enabled?: boolean;
    bank_transfer_enabled?: boolean;
    cod_deposit_policy?: CodDepositPolicy;
  },
): Promise<PaymentSettings> {
  return apiClient<PaymentSettings>(`/stores/${storeId}/settings/payment`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function updateShippingSettings(
  storeId: string,
  data: {
    free_shipping_threshold?: number;
    manual_enabled?: boolean;
    restrict_to_zones?: boolean;
  }
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

// ─── COD Trust Network ──────────────────────────────────────────────────────

export interface CodTrustSettings {
  enabled: boolean;
  threshold: number;
  min_confidence: "low" | "medium" | "high";
  action: "block" | "warn" | "recover";
  /**
   * "recover" only: promo line shown in the cod_recovery_offer_v1 WhatsApp
   * message that invites the buyer to pay online. Blank → backend default.
   */
  recovery_promo?: string | null;
  /** Days a COD order can sit in SHIPPED before the auto-RTO sweep flags it. 7-60. */
  auto_rto_days: number;
  /** Skip the auto-RTO sweep entirely for this store. */
  auto_rto_disabled: boolean;
}

export async function fetchCodTrustSettings(
  storeId: string
): Promise<CodTrustSettings> {
  return apiClient<CodTrustSettings>(`/stores/${storeId}/settings/cod-trust`);
}

export async function updateCodTrustSettings(
  storeId: string,
  data: Partial<CodTrustSettings>
): Promise<CodTrustSettings> {
  return apiClient<CodTrustSettings>(`/stores/${storeId}/settings/cod-trust`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/** Per-store COD trust impact over a rolling window. Merchant sees only
 *  their own numbers — never the network-wide (internal) moat metrics. */
export interface TrustStatsWindow {
  screened: number;
  high_risk: number;
  blocked: number;
  warned: number;
  recovered: number;
  recovered_value: number; // cents
}

export interface TrustStats {
  period_days: number;
  current: TrustStatsWindow;
  previous: TrustStatsWindow;
}

export async function fetchTrustStats(
  storeId: string,
  periodDays = 30
): Promise<TrustStats> {
  return apiClient<TrustStats>(
    `/stores/${storeId}/cod-trust/stats?period_days=${periodDays}`
  );
}

/** Cross-merchant network reputation for one phone (the lookup tool). */
export interface TrustLookup {
  phone_last4: string | null;
  known: boolean;
  score: number; // 0 (trusted) … 100 (abuser)
  confidence: "low" | "medium" | "high";
  label: string; // new_to_network / trusted_buyer / risky / serial_abuser
}

export async function lookupTrustPhone(
  storeId: string,
  phone: string
): Promise<TrustLookup> {
  return apiClient<TrustLookup>(
    `/stores/${storeId}/cod-trust/lookup?phone=${encodeURIComponent(phone)}`
  );
}

// ─── COD Autopilot (004-cod-autopilot) ──────────────────────────────────────

export interface CodAutopilotSettings {
  enabled: boolean;
  /** Store-local hour (0-23, market timezone) the daily ship digest is sent. */
  digest_hour: number;
  /** Days after shipped before the customer delivery-check is sent. 1-7. */
  delivery_check_delay_days: number;
  /** Days between delivery-check retries. 1-7. */
  delivery_check_retry_days: number;
  /** Total delivery-check attempts (initial + retries). 1-3. */
  delivery_check_max_attempts: number;
  /** Days after shipped before a silent order auto-closes as delivered. 5-30. */
  assumed_delivered_days: number;
  /** Read-only: store has a contact phone the digest can be sent to. */
  digest_deliverable: boolean;
  /** Read-only: the auto-RTO window, surfaced for overlap warnings. */
  auto_rto_days: number;
}

export async function fetchCodAutopilotSettings(
  storeId: string
): Promise<CodAutopilotSettings> {
  return apiClient<CodAutopilotSettings>(
    `/stores/${storeId}/settings/cod-autopilot`
  );
}

export async function updateCodAutopilotSettings(
  storeId: string,
  data: Partial<
    Omit<CodAutopilotSettings, "digest_deliverable" | "auto_rto_days">
  >
): Promise<CodAutopilotSettings> {
  return apiClient<CodAutopilotSettings>(
    `/stores/${storeId}/settings/cod-autopilot`,
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

// ─── Paymob Credentials ──────────────────────────────────────────────────────

export interface PaymobCredentialsResponse {
  is_configured: boolean;
  public_key_masked: string | null;
  secret_key_masked: string | null;
  hmac_secret_masked: string | null;
  card_integration_id: string | null;
  wallet_integration_id: string | null;
  /** Paymob Apple Pay integration ID. Presence ⇒ Apple Pay offered at checkout. */
  apple_pay_integration_id?: string | null;
  last_configured: string | null;
  /** Non-fatal warning from the save-time validation probe (e.g. Paymob
   *  Integration ID / currency mismatch). null when validation passed. */
  validation_warning?: string | null;
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
    apple_pay_integration_id?: string;
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
  /** Apple Pay offered inside the Kashier session when true (opt-in). */
  apple_pay_enabled?: boolean;
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
  data: { merchant_id: string; api_key: string; secret_key?: string; apple_pay_enabled?: boolean }
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

// ─── InstaPay Credentials ──────────────────────────────────────────────────

export interface InstapayCredentialsResponse {
  is_configured: boolean;
  enabled?: boolean;
  ipa_masked: string | null;
  ipa_display_name: string | null;
  fallback_phone: string | null;
  /** Master switch. Off by default on Vodafone Cash. */
  auto_approve_enabled?: boolean;
  auto_approve_threshold_cents: number | null;
  auto_approve_daily_cap_cents: number | null;
  auto_approve_daily_count: number | null;
  last_configured: string | null;
  /** Public URL of the merchant-uploaded InstaPay QR image. The
   *  customer-facing /instapay/:orderId page renders this when set;
   *  otherwise it falls back to IPA + reference text only. */
  qr_image_url?: string | null;
  /** Merchant-pasted InstaPay "Share link" URL. The storefront
   *  generates a QR from this on the fly. Takes priority over
   *  qr_image_url when both are set. */
  qr_link_url?: string | null;
  /** Phase C — OCR provider assigned by an admin. The merchant
   *  hub renders this read-only; admins switch via the backoffice.
   *  Null/undefined means OCR is disabled for this store. */
  ocr_provider?: string | null;
  require_ocr_amount_match?: boolean;
  require_ocr_ipa_match?: boolean;
  ocr_amount_tolerance_bps?: number;
  // Phase C extras
  require_note_contains_reference?: boolean;
  require_transaction_ref_match?: boolean;
  require_recipient_name_match?: boolean;
  /** Token that appears in the recipient block of bank-app receipts
   *  (typically the merchant's first name in Arabic or Latin). The
   *  recipient-name rule does case-insensitive substring matching. */
  recipient_name_token?: string | null;
}

export interface SaveInstapayCredentialsPayload {
  /** Omit (or send null) when updating an already-configured store to keep
   *  the previously-saved IPA. Required on first-time setup. */
  ipa?: string | null;
  ipa_display_name?: string | null;
  fallback_phone?: string | null;
  auto_approve_enabled?: boolean;
  auto_approve_threshold_cents: number;
  auto_approve_daily_cap_cents: number;
  auto_approve_daily_count: number;
  /** InstaPay "Share link" URL. Send empty string to clear, null/omit
   *  to leave unchanged, any string to set. */
  qr_link_url?: string | null;
  /** Phase C — merchant opt-in flags + tolerance. The
   *  ``ocr_provider`` is admin-managed and the backend silently
   *  drops it if a merchant tries to PUT it via this endpoint. */
  require_ocr_amount_match?: boolean;
  require_ocr_ipa_match?: boolean;
  ocr_amount_tolerance_bps?: number;
  // Phase C extras
  require_note_contains_reference?: boolean;
  require_transaction_ref_match?: boolean;
  require_recipient_name_match?: boolean;
  recipient_name_token?: string | null;
}

export async function fetchInstapayCredentials(
  storeId: string,
): Promise<InstapayCredentialsResponse> {
  return apiClient<InstapayCredentialsResponse>(
    `/stores/${storeId}/settings/payment/instapay/credentials`,
  );
}

export async function saveInstapayCredentials(
  storeId: string,
  data: SaveInstapayCredentialsPayload,
): Promise<InstapayCredentialsResponse> {
  return apiClient<InstapayCredentialsResponse>(
    `/stores/${storeId}/settings/payment/instapay/credentials`,
    { method: "PUT", body: JSON.stringify(data) },
  );
}

export async function deleteInstapayCredentials(
  storeId: string,
): Promise<InstapayCredentialsResponse> {
  return apiClient<InstapayCredentialsResponse>(
    `/stores/${storeId}/settings/payment/instapay/credentials`,
    { method: "DELETE" },
  );
}

export async function uploadInstapayQrImage(
  storeId: string,
  file: File,
): Promise<InstapayCredentialsResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient<InstapayCredentialsResponse>(
    `/stores/${storeId}/settings/payment/instapay/qr-image`,
    { method: "POST", body: formData },
  );
}

export async function deleteInstapayQrImage(
  storeId: string,
): Promise<InstapayCredentialsResponse> {
  return apiClient<InstapayCredentialsResponse>(
    `/stores/${storeId}/settings/payment/instapay/qr-image`,
    { method: "DELETE" },
  );
}

// ─── Vodafone Cash Credentials ────────────────────────────────────────────
//
// Vodafone Cash is a MANUAL rail, the same shape as InstaPay: the
// merchant publishes a wallet number, the customer transfers from their
// own wallet, and a screenshot + reference is verified. There is no API
// key — Vodafone's merchant API needs a commercial partnership and an
// aggregator, which is a different product. The wallet number is the
// only credential.

export interface VodafoneCashCredentialsResponse {
  is_configured: boolean;
  enabled?: boolean;
  /** Masked as 010****5678 — enough to recognise your own number. */
  wallet_number_masked: string | null;
  display_name: string | null;
  fallback_phone: string | null;
  /** Master switch. Off by default on Vodafone Cash. */
  auto_approve_enabled?: boolean;
  auto_approve_threshold_cents: number | null;
  auto_approve_daily_cap_cents: number | null;
  auto_approve_daily_count: number | null;
  last_configured: string | null;
  /** Admin-assigned; read-only here. Null means OCR is off. */
  ocr_provider?: string | null;
  require_ocr_amount_match?: boolean;
  /** "The screenshot's recipient must be my wallet number." Shares the
   *  InstaPay field name because one rules engine serves both rails. */
  require_ocr_ipa_match?: boolean;
  ocr_amount_tolerance_bps?: number;
  require_note_contains_reference?: boolean;
  require_transaction_ref_match?: boolean;
  require_recipient_name_match?: boolean;
  recipient_name_token?: string | null;
}

export interface SaveVodafoneCashCredentialsPayload {
  /** Omit (or send null) when updating an already-configured store to
   *  keep the saved number. Required on first-time setup. Accepts
   *  +20 / 0020 prefixes and separators; the backend normalizes. */
  wallet_number?: string | null;
  display_name?: string | null;
  fallback_phone?: string | null;
  auto_approve_enabled?: boolean;
  auto_approve_threshold_cents: number;
  auto_approve_daily_cap_cents: number;
  auto_approve_daily_count: number;
  require_ocr_amount_match?: boolean;
  require_ocr_ipa_match?: boolean;
  ocr_amount_tolerance_bps?: number;
  require_note_contains_reference?: boolean;
  require_transaction_ref_match?: boolean;
  require_recipient_name_match?: boolean;
  recipient_name_token?: string | null;
}

export async function fetchVodafoneCashCredentials(
  storeId: string,
): Promise<VodafoneCashCredentialsResponse> {
  return apiClient<VodafoneCashCredentialsResponse>(
    `/stores/${storeId}/settings/payment/vodafone-cash/credentials`,
  );
}

export async function saveVodafoneCashCredentials(
  storeId: string,
  data: SaveVodafoneCashCredentialsPayload,
): Promise<VodafoneCashCredentialsResponse> {
  return apiClient<VodafoneCashCredentialsResponse>(
    `/stores/${storeId}/settings/payment/vodafone-cash/credentials`,
    { method: "PUT", body: JSON.stringify(data) },
  );
}

export async function deleteVodafoneCashCredentials(
  storeId: string,
): Promise<VodafoneCashCredentialsResponse> {
  return apiClient<VodafoneCashCredentialsResponse>(
    `/stores/${storeId}/settings/payment/vodafone-cash/credentials`,
    { method: "DELETE" },
  );
}

// ─── Manual-rail Payment Proofs (merchant review) ─────────────────────────
//
// Endpoint path keeps its historical "instapay" name; the list covers
// both manual rails.

// Mirrors PaymentProofStatus (Python). Narrow union so switch statements
// that branch on proof status are checked for exhaustiveness.
export type PaymentProofStatus =
  | "awaiting_review"
  | "auto_approved"
  | "approved"
  | "rejected"
  | "expired";

/** Phase C — backend stamps one of these into ``ocr_status`` so the
 *  merchant review pane can render a specific message (GPU busy, auth
 *  failure, etc.) instead of a flat "OCR didn't run". */
export type OcrStatus =
  | "ok"
  | "skipped"
  | "failed"
  | "failed_gpu"
  | "failed_timeout"
  | "failed_auth"
  | "failed_transport"
  | "failed_parse"
  | "failed_empty";

export interface PaymentProof {
  id: string;
  order_id: string;
  transaction_ref: string;
  declared_amount_cents: number | null;
  status: PaymentProofStatus;
  rejection_reason: string | null;
  review_decision_by: string | null;
  review_decision_at: string | null;
  signed_image_url: string;
  created_at: string;
  // Phase C — populated when an OCR provider was configured for the
  // store at submission time. Pre-Phase-C / Noop rows leave these
  // null and the merchant pane hides the OCR section.
  ocr_status?: OcrStatus | null;
  ocr_provider?: string | null;
  ocr_extracted_amount_cents?: number | null;
  ocr_extracted_ipa?: string | null;
  ocr_extracted_note?: string | null;
  ocr_extracted_transaction_ref?: string | null;
  ocr_extracted_recipient_name?: string | null;
  // Phase D — rule-engine tags captured at submission. Empty / null
  // for auto-approved proofs. Strings (not a closed enum) so backend
  // can grow new rules without forcing a frontend deploy.
  auto_approval_block_reasons?: string[] | null;
}

export async function fetchPaymentProofs(
  storeId: string,
  orderId: string,
): Promise<PaymentProof[]> {
  return apiClient<PaymentProof[]>(
    `/stores/${storeId}/orders/${orderId}/payment-proofs`,
  );
}

export async function approvePaymentProof(
  storeId: string,
  proofId: string,
): Promise<PaymentProof> {
  return apiClient<PaymentProof>(
    `/stores/${storeId}/payment-proofs/${proofId}/approve`,
    { method: "POST" },
  );
}

export async function rejectPaymentProof(
  storeId: string,
  proofId: string,
  reason: string,
): Promise<PaymentProof> {
  return apiClient<PaymentProof>(
    `/stores/${storeId}/payment-proofs/${proofId}/reject`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

export interface PendingInstapayOrder {
  order_id: string;
  order_number: string;
  customer_id: string;
  amount_cents: number;
  currency: string;
  created_at: string;
  proof_id: string;
  proof_created_at: string;
  transaction_ref: string;
  declared_amount_cents: number | null;
}

export interface PendingInstapayPage {
  items: PendingInstapayOrder[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchPendingInstapayOrders(
  storeId: string,
  opts: { page?: number; limit?: number } = {},
): Promise<PendingInstapayPage> {
  const q = new URLSearchParams();
  if (opts.page) q.set("page", String(opts.page));
  if (opts.limit) q.set("limit", String(opts.limit));
  const qs = q.toString();
  return apiClient<PendingInstapayPage>(
    `/stores/${storeId}/orders/pending-instapay-review${qs ? `?${qs}` : ""}`,
  );
}

// ─── Similar payment proofs (Phase B reverse-image lookup) ────────────────

/** One match returned by the per-store pHash neighbour scan. The
 *  `hamming_distance` is the number of differing bits between this
 *  proof's perceptual hash and the proof the merchant is reviewing
 *  (lower = more similar; the dedup gate uses ≤ 5, the review panel
 *  shows ≤ 8). */
export interface SimilarProof {
  proof_id: string;
  order_id: string;
  order_number: string;
  status: PaymentProofStatus;
  transaction_ref: string;
  declared_amount_cents: number | null;
  created_at: string;
  signed_image_url: string;
  hamming_distance: number;
}

export async function fetchSimilarPaymentProofs(
  storeId: string,
  proofId: string,
): Promise<SimilarProof[]> {
  return apiClient<SimilarProof[]>(
    `/stores/${storeId}/payment-proofs/${proofId}/similar`,
  );
}

// ─── Fawaterak Credentials ─────────────────────────────────────────────────

export interface FawaterakCredentialsResponse {
  is_configured: boolean;
  api_key_masked: string | null;
  vendor_key_masked: string | null;
  environment: string | null;
  last_configured: string | null;
}

export async function fetchFawaterakCredentials(
  storeId: string
): Promise<FawaterakCredentialsResponse> {
  return apiClient<FawaterakCredentialsResponse>(
    `/stores/${storeId}/settings/payment/fawaterak/credentials`
  );
}

export async function saveFawaterakCredentials(
  storeId: string,
  data: {
    api_key: string;
    vendor_key: string;
    environment?: string;
  }
): Promise<FawaterakCredentialsResponse> {
  return apiClient<FawaterakCredentialsResponse>(
    `/stores/${storeId}/settings/payment/fawaterak/credentials`,
    { method: "PUT", body: JSON.stringify(data) }
  );
}

export async function deleteFawaterakCredentials(
  storeId: string
): Promise<void> {
  await apiClient(`/stores/${storeId}/settings/payment/fawaterak/credentials`, {
    method: "DELETE",
  });
}

// ─── Moyasar Credentials (KSA) ─────────────────────────────────────────────

export interface MoyasarCredentialsResponse {
  is_configured: boolean;
  secret_key_masked: string | null;
  publishable_key_masked: string | null;
  webhook_secret_masked: string | null;
  last_configured: string | null;
}

export async function fetchMoyasarCredentials(
  storeId: string
): Promise<MoyasarCredentialsResponse> {
  return apiClient<MoyasarCredentialsResponse>(
    `/stores/${storeId}/settings/payment/moyasar/credentials`
  );
}

export async function saveMoyasarCredentials(
  storeId: string,
  data: {
    secret_key: string;
    publishable_key?: string;
    webhook_secret?: string;
  }
): Promise<MoyasarCredentialsResponse> {
  return apiClient<MoyasarCredentialsResponse>(
    `/stores/${storeId}/settings/payment/moyasar/credentials`,
    { method: "PUT", body: JSON.stringify(data) }
  );
}

export async function deleteMoyasarCredentials(
  storeId: string
): Promise<void> {
  await apiClient(`/stores/${storeId}/settings/payment/moyasar/credentials`, {
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
