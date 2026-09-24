/**
 * Apps platform API service — Phase 6.
 *
 * Mirrors /stores/{store_id}/apps/* endpoints. Listing the catalog
 * does NOT require a store scope at the backend, but we keep it
 * store-scoped here for consistency (the hub always operates inside
 * a chosen store).
 */

import { apiClient } from "./api";
import type { SettingDefinition } from "@/features/theme-editor-v3/types";

export interface AppBlockSchema {
  type: string;
  name: string;
  schema?: Record<string, unknown>;
}

export interface AppCatalogEntry {
  slug: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  version: string;
  blocks: AppBlockSchema[];
  listing?: AppListing;
  /** Set for Partner Apps: how to open their consent screen. */
  connect?: AppConnect | null;
  /** Average of visible reviews; null until the first one. */
  rating?: number | null;
  reviews_count?: number;
}

/** Listing metadata every app supplies; the detail page renders what exists. */
export interface AppListing {
  tagline?: string | null;
  developer?: {
    name?: string;
    url?: string;
    support_email?: string;
    is_first_party?: boolean;
  } | null;
  lockup_url?: string | null;
  screenshots?: { url?: string; locales?: Record<string, { caption?: string }> }[];
  highlights?: { locales?: Record<string, { text?: string }> }[];
  /** `locales[lang].tagline` */
  locales?: Record<string, { tagline?: string }>;
  /** `app_locales[lang].{name,description}` */
  app_locales?: Record<string, { name?: string; description?: string }>;
  /** The full tour. `highlights` is the pitch; this is the feature list. */
  features?: {
    icon?: string;
    locales?: Record<string, { title?: string; body?: string }>;
  }[];
  pricing?: { plan?: string; locales?: Record<string, { label?: string }> } | null;
  /** Language codes the app's own shopper-facing output supports. */
  languages?: string[];
  compatibility?: { locales?: Record<string, { text?: string }> } | null;
  /** A YouTube or Vimeo URL. */
  video_url?: string | null;
  keywords?: { ar?: string[]; en?: string[] };
}

export interface AppInstallation extends AppCatalogEntry {
  is_enabled: boolean;
  settings: Record<string, unknown>;
  /** The app's own settings form, straight off its manifest. */
  settings_schema?: SettingDefinition[];
  /** Platform status — `suspended` means shoppers can't see it whatever
   *  `is_enabled` says. Surfaced so the hub can stop disagreeing with the
   *  storefront silently. */
  app_status?: string;
  /** enabled AND published. The single thing to show the merchant. */
  is_live?: boolean;
  /** Partner Apps: the scopes this store consented to. */
  granted_scopes?: string[];
  /** Partner Apps: "pending_auth" until the app finishes connecting. */
  install_status?: string;
  /** Scopes the live version needs that were never granted: re-consent. */
  missing_scopes?: string[];
}

/**
 * NUMU Apps: NUMU's own optional features, installed from the catalog like
 * any app but living on their own hub pages. Behind `ff_numu_apps` their
 * sidebar entries follow the install (see useNavConfig). The API lists them
 * only when that flag is on.
 */
export const NUMU_APP_HOME: Record<string, string> = {
  whatsapp: "/whatsapp",
  inbox: "/inbox",
};

export async function listAppCatalog(
  storeId: string,
): Promise<AppCatalogEntry[]> {
  return apiClient<AppCatalogEntry[]>(`/stores/${storeId}/apps/catalog`);
}

export async function listAppInstallations(
  storeId: string,
): Promise<AppInstallation[]> {
  return apiClient<AppInstallation[]>(`/stores/${storeId}/apps`);
}

export async function installApp(
  storeId: string,
  slug: string,
): Promise<AppInstallation> {
  return apiClient<AppInstallation>(
    `/stores/${storeId}/apps/${encodeURIComponent(slug)}/install`,
    { method: "POST" },
  );
}

export async function updateAppSettings(
  storeId: string,
  slug: string,
  settings: Record<string, unknown>,
): Promise<AppInstallation> {
  return apiClient<AppInstallation>(
    `/stores/${storeId}/apps/${encodeURIComponent(slug)}/settings`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // The API merges by default; a replace is only correct when the caller
      // is submitting the whole form, which is what this function does.
      body: JSON.stringify({ settings, replace: true }),
    },
  );
}

export async function enableApp(
  storeId: string,
  slug: string,
): Promise<AppInstallation> {
  return apiClient<AppInstallation>(
    `/stores/${storeId}/apps/${encodeURIComponent(slug)}/enable`,
    { method: "POST" },
  );
}

export async function disableApp(
  storeId: string,
  slug: string,
): Promise<AppInstallation> {
  return apiClient<AppInstallation>(
    `/stores/${storeId}/apps/${encodeURIComponent(slug)}/disable`,
    { method: "POST" },
  );
}

export async function uninstallApp(
  storeId: string,
  slug: string,
): Promise<void> {
  await apiClient<{ slug: string }>(
    `/stores/${storeId}/apps/${encodeURIComponent(slug)}`,
    { method: "DELETE" },
  );
}

/** Partner Apps install through consent, not `installApp`. */
export interface AppConnect {
  client_id: string;
  redirect_uri: string;
  scopes: string[];
}

/** The hub URL of the consent screen for a Partner App on this store. */
export function consentPath(connect: AppConnect, storeId: string, scopes?: string[]): string {
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: connect.client_id,
    store_id: storeId,
    redirect_uri: connect.redirect_uri,
    scope: (scopes ?? connect.scopes).join(" "),
    state,
  });
  return `/oauth/authorize?${params.toString()}`;
}

/** A signed link to the Partner App's own admin. */
export async function getAppOpenUrl(storeId: string, slug: string, locale: string): Promise<string> {
  const r = await apiClient<{ url: string }>(
    `/stores/${storeId}/apps/${encodeURIComponent(slug)}/open-url?locale=${locale === "en" ? "en" : "ar"}`,
  );
  return r.url;
}

// ─── Paid apps (Phase 7): the store's subscription ───────────────────

/** Money in piasters. A paid app is charged to the store's NUMU wallet. */
export interface AppSubscription {
  paid: boolean;
  price_cents: number | null;
  currency: string | null;
  cycle: "monthly" | "annual" | null;
  /** null: never subscribed. */
  status: "active" | "past_due" | "cancelled" | null;
  /** May the store use the app right now (a paid period, or the 3-day grace). */
  entitled: boolean;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  /** What this store renews at: the price when it subscribed. */
  subscribed_price_cents: number | null;
  /** Free days the app offers before the first charge (0: none). */
  trial_days: number;
  /** This store hasn't had the app's free trial yet. */
  trial_available: boolean;
  /** The current period is the free trial. */
  is_trial: boolean;
  /** Metered charges, taken from the wallet as the app reports them. */
  usage: {
    unit: Record<string, string>;
    unit_price_cents: number | null;
    cap_cents: number;
    used_cents: number;
  } | null;
  /** The next charge: VAT (14%) is on NUMU's fee only, added on top. */
  next_charge: AppChargeQuote | null;
  /** A partner coupon still discounting this store's periods. */
  coupon: { code: string; cycles_left: number | null } | null;
}

export interface AppChargeQuote {
  list_price_cents: number;
  discount_cents: number;
  /** The coupon was larger than the partner's share and was capped. */
  discount_capped: boolean;
  vat_cents: number;
  vat_bps: number;
  total_cents: number;
  coupon?: { code: string; duration_cycles: number | null } | null;
}

const subscriptionPath = (storeId: string, slug: string) =>
  `/stores/${storeId}/apps/${encodeURIComponent(slug)}/subscription`;

export function getAppSubscription(storeId: string, slug: string): Promise<AppSubscription> {
  return apiClient<AppSubscription>(subscriptionPath(storeId, slug));
}

/**
 * Pay one period from the wallet now. Also "resume": on a store still inside
 * a paid period it charges nothing and withdraws a pending cancellation. The
 * payload is the same either way, so `charged` comes from the envelope's
 * `message` ("Subscribed" vs "Already active"). An empty wallet is a 402.
 */
export async function subscribeApp(
  storeId: string,
  slug: string,
  couponCode?: string,
): Promise<{ sub: AppSubscription; charged: boolean }> {
  let message: Promise<unknown> = Promise.resolve(null);
  const sub = await apiClient<AppSubscription>(
    subscriptionPath(storeId, slug),
    { method: "POST", body: JSON.stringify({ coupon_code: couponCode || null }) },
    {
      onResponse: (res) => {
        message = res.clone().json().then((b) => b?.message, () => null);
      },
    },
  );
  return { sub, charged: (await message) === "Subscribed" };
}

/** What subscribing costs now; a coupon this store can't use is a 422 `{ code }`. */
export function quoteAppSubscription(
  storeId: string,
  slug: string,
  couponCode: string,
): Promise<AppChargeQuote> {
  return apiClient<AppChargeQuote>(
    `${subscriptionPath(storeId, slug)}/quote?coupon_code=${encodeURIComponent(couponCode)}`,
  );
}

/** Stop renewing. The app keeps working until `current_period_end`. */
export function cancelAppSubscription(storeId: string, slug: string): Promise<AppSubscription> {
  return apiClient<AppSubscription>(subscriptionPath(storeId, slug), { method: "DELETE" });
}

export interface Consent {
  app: {
    slug: string;
    name: Record<string, string>;
    tagline: Record<string, string>;
    icon: string | null;
    partner: string | null;
    pricing: {
      plan?: string;
      locales?: Record<string, { label?: string }>;
      trial_days?: number;
      /** NUMU charges the store's wallet once the merchant subscribes. */
      charged_from_wallet?: boolean;
      /** This store hasn't had the app's free trial yet. */
      trial_available?: boolean;
      currency?: string;
      /** VAT on NUMU's fee, added on top of the price each period. */
      vat_cents?: number;
    } | null;
    privacy_policy_url: string | null;
    rating?: number | null;
    reviews_count?: number;
  };
  store_id: string;
  store_name: string;
  scopes: string[];
  granted_scopes: string[];
  redirect_uri: string;
  state: string;
}

export function getConsent(query: string): Promise<Consent> {
  return apiClient<Consent>(`/oauth/authorize?${query}`);
}

export function approveConsent(body: {
  client_id: string;
  store_id: string;
  scope: string;
  redirect_uri: string;
  state: string;
}): Promise<{ redirect_url: string }> {
  return apiClient(`/oauth/authorize/approve`, { method: "POST", body: JSON.stringify(body) });
}

// ─── Reviews and support ─────────────────────────────────────────────

export interface AppReview {
  id: string;
  app_id: string;
  app_name?: string | null;
  store_name: string | null;
  rating: number;
  body: string | null;
  reply_body: string | null;
  replied_at: string | null;
  is_hidden: boolean;
  reported: boolean;
  created_at: string;
  updated_at: string;
}

export interface RatingSummary {
  average: number | null;
  count: number;
  distribution: Record<string, number>;
}

export interface AppReviewPage {
  summary: RatingSummary;
  items: AppReview[];
  total: number;
  page: number;
  page_size: number;
  mine?: AppReview | null;
  can_review?: boolean;
}

const reviewsPath = (storeId: string, slug: string) =>
  `/stores/${storeId}/apps/${encodeURIComponent(slug)}/reviews`;

export function listAppReviews(storeId: string, slug: string, page = 1): Promise<AppReviewPage> {
  return apiClient<AppReviewPage>(`${reviewsPath(storeId, slug)}?page=${page}`);
}

export function saveAppReview(
  storeId: string,
  slug: string,
  body: { rating: number; body: string | null },
): Promise<AppReview> {
  return apiClient<AppReview>(reviewsPath(storeId, slug), { method: "PUT", body: JSON.stringify(body) });
}

export function deleteAppReview(storeId: string, slug: string): Promise<unknown> {
  return apiClient(reviewsPath(storeId, slug), { method: "DELETE" });
}

export function reportAppReview(storeId: string, slug: string, id: string, reason: string): Promise<unknown> {
  return apiClient(`${reviewsPath(storeId, slug)}/${id}/report`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export type TicketStatus = "open" | "answered" | "closed";

export interface SupportTicket {
  id: string;
  kind: "app" | "partner";
  subject: string;
  status: TicketStatus;
  app_id: string | null;
  app_name: string | null;
  app_slug: string | null;
  store_id: string | null;
  store_name: string | null;
  partner_name: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface SupportAttachment {
  url: string;
  name: string;
  content_type: string;
  size: number;
}

export interface SupportThread {
  ticket: SupportTicket;
  messages: {
    id: string;
    author_role: "merchant" | "partner" | "staff";
    body: string;
    attachments: SupportAttachment[];
    created_at: string;
  }[];
}

export interface TicketPage {
  items: SupportTicket[];
  total: number;
  page: number;
  page_size: number;
}

/** Multipart: the message and up to 3 images or PDFs. */
export function supportForm(fields: Record<string, string>, files: File[]): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  for (const f of files) form.append("files", f);
  return form;
}

export function listAppTickets(storeId: string): Promise<TicketPage> {
  return apiClient<TicketPage>(`/stores/${storeId}/app-support?page_size=100`);
}

export function openAppTicket(storeId: string, form: FormData): Promise<SupportThread> {
  return apiClient<SupportThread>(`/stores/${storeId}/app-support`, { method: "POST", body: form });
}

export function getAppTicket(storeId: string, id: string): Promise<SupportThread> {
  return apiClient<SupportThread>(`/stores/${storeId}/app-support/${id}`);
}

export function replyAppTicket(storeId: string, id: string, form: FormData): Promise<SupportThread> {
  return apiClient<SupportThread>(`/stores/${storeId}/app-support/${id}/messages`, { method: "POST", body: form });
}

export function closeAppTicket(storeId: string, id: string): Promise<SupportThread> {
  return apiClient<SupportThread>(`/stores/${storeId}/app-support/${id}/close`, { method: "POST" });
}
