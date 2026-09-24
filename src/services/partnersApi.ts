/**
 * Partner program API (apps plan, Phase 2): /api/v1/partners.
 *
 * The whole program answers 404 while NUMU keeps it closed, so
 * `getPartnerMe` returns null then and the hub hides the portal.
 */

import { apiClient } from "./api";
import type { AppCatalogEntry } from "./appsApi";
import { ApiError } from "@/lib/api-error";
import type { AppReview, AppReviewPage, SupportThread, TicketPage } from "./appsApi";

export type PartnerStatus = "pending" | "approved" | "rejected" | "suspended";

export interface PartnerAccount {
  id: string;
  kind: "individual" | "company";
  display_name: string;
  legal_name: string | null;
  country: string;
  website_url: string | null;
  support_email: string;
  support_phone: string | null;
  status: PartnerStatus;
  agreement_version: string | null;
  agreement_accepted_at: string | null;
  /** What NUMU told the partner on reject/suspend. */
  review_notes: { ar?: string; en?: string } | null;
  reviewed_at: string | null;
  created_at: string;
  referral_bps?: number;
  referral_months?: number;
  directory_listed?: boolean;
  directory_profile?: DirectoryProfile | null;
  verified?: boolean;
  directory_hidden?: boolean;
}

export type PartnerService = "apps" | "themes" | "setup" | "marketing";

export interface DirectoryProfile {
  logo_url?: string | null;
  bio_ar?: string | null;
  bio_en?: string | null;
  services?: PartnerService[];
  languages?: ("ar" | "en" | "fr")[];
  city?: string | null;
}

export type PartnerRole = "owner" | "admin" | "developer";

export interface PartnerMe {
  account: PartnerAccount | null;
  /** The caller's role on `account`; absent from an older API. */
  role?: PartnerRole | null;
  /** Pending team invites addressed to the caller's email. */
  invitations?: { id: string; partner_name: string; role: PartnerRole }[];
  agreement_version: string;
  needs_agreement: boolean;
  max_dev_stores: number;
}

export interface DevStore {
  id: string;
  name: string;
  subdomain: string | null;
  url: string | null;
  seeded: boolean;
  created_at: string;
}

export interface PartnerProfile {
  display_name: string;
  legal_name?: string | null;
  country?: string;
  website_url?: string | null;
  support_email: string;
  support_phone?: string | null;
}

/** null = the program is closed. */
export async function getPartnerMe(): Promise<PartnerMe | null> {
  try {
    return await apiClient<PartnerMe>("/partners/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function applyPartner(
  body: PartnerProfile & {
    kind: PartnerAccount["kind"];
    agreement_version: string;
    accept_agreement: boolean;
  },
): Promise<PartnerAccount> {
  return apiClient<PartnerAccount>("/partners/apply", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listDevStores(): Promise<DevStore[]> {
  return apiClient<DevStore[]>("/partners/me/dev-stores");
}

export function createDevStore(body: { name: string; subdomain: string }): Promise<DevStore> {
  return apiClient<DevStore>("/partners/me/dev-stores", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function seedDevStore(storeId: string): Promise<DevStore> {
  return apiClient<DevStore>(`/partners/me/dev-stores/${storeId}/seed`, { method: "POST" });
}

/** Re-accept a newer Partner Agreement (`needs_agreement`). */
export function acceptAgreement(version: string): Promise<PartnerAccount> {
  return apiClient<PartnerAccount>("/partners/me", {
    method: "PATCH",
    body: JSON.stringify({ accept_agreement_version: version }),
  });
}

// ─── Partner apps (Phase 3) ──────────────────────────────────────────

export type AppVersionStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "changes_requested"
  | "rejected"
  | "approved"
  | "published"
  | "superseded";

export interface PartnerAppVersion {
  id: string;
  version: string;
  status: AppVersionStatus;
  change_type: string | null;
  release_notes: { ar?: string; en?: string } | null;
  review_notes: { ar?: string; en?: string } | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_at: string;
}

export interface PartnerApp {
  id: string;
  slug: string;
  name: string;
  name_ar: string | null;
  status: "draft" | "published" | "suspended";
  version: string;
  icon_url: string | null;
  category: string | null;
  catalog_visible: boolean;
  client_id: string | null;
  installs: number;
  latest_version: PartnerAppVersion | null;
  /** A custom app: the one store it installs on. */
  private_store_id: string | null;
  private_store_name: string | null;
}

export interface PartnerAppDetail extends PartnerApp {
  versions: PartnerAppVersion[];
}

const APPS = "/partners/me/apps";

export function listPartnerApps(): Promise<PartnerApp[]> {
  return apiClient<PartnerApp[]>(APPS);
}

/** The client secret is in this response only. */
export function createPartnerApp(body: {
  slug: string;
  name_ar: string;
  name_en: string;
  private_store?: string;
}): Promise<PartnerApp & { client_secret: string }> {
  return apiClient(APPS, { method: "POST", body: JSON.stringify(body) });
}

export function getPartnerApp(id: string): Promise<PartnerAppDetail> {
  return apiClient<PartnerAppDetail>(`${APPS}/${id}`);
}

export function uploadAppVersion(
  id: string,
  body: { manifest: unknown; release_notes_ar?: string; release_notes_en?: string },
): Promise<PartnerAppVersion> {
  return apiClient(`${APPS}/${id}/versions`, { method: "POST", body: JSON.stringify(body) });
}

export function submitAppVersion(
  id: string,
  versionId: string,
  withListing = false,
): Promise<PartnerAppVersion> {
  return apiClient(`${APPS}/${id}/versions/${versionId}/submit`, {
    method: "POST",
    body: JSON.stringify({ with_listing: withListing }),
  });
}

export function publishAppVersion(id: string, versionId: string): Promise<PartnerAppDetail> {
  return apiClient(`${APPS}/${id}/versions/${versionId}/publish`, { method: "POST" });
}

export function rotateAppSecret(id: string): Promise<{ client_id: string; client_secret: string }> {
  return apiClient(`${APPS}/${id}/client-secret`, { method: "POST" });
}

export function devInstallApp(id: string, storeId: string): Promise<{ store_id: string; slug: string }> {
  return apiClient(`${APPS}/${id}/dev-install`, {
    method: "POST",
    body: JSON.stringify({ store_id: storeId }),
  });
}

// ─── Review and listing ──────────────────────────────────────────────

export type ReviewStatus = "submitted" | "in_review" | "approved" | "changes_requested" | "rejected";

export interface ReviewRound {
  id: string;
  round: number;
  subject: "version" | "listing" | "version_listing";
  version: string | null;
  version_id: string | null;
  listing_id: string | null;
  status: ReviewStatus;
  submitted_at: string;
  decided_at: string | null;
  notes: { ar?: string; en?: string } | null;
  checklist: Record<string, boolean> | null;
}

export interface AppReviews {
  rounds: ReviewRound[];
  open: {
    review_id: string;
    position: number;
    queue_length: number;
    submitted_at: string;
    expected_by: string;
  } | null;
  sla_business_days: number;
}

export function getAppReviews(id: string): Promise<AppReviews> {
  return apiClient<AppReviews>(`${APPS}/${id}/reviews`);
}

type Bi = { ar: string; en: string };

export interface ListingContent {
  name: Bi;
  tagline: Bi;
  description: Bi;
  screenshots: { src: string; caption?: Bi }[];
  video_url: string | null;
  category: string;
  keywords: { ar: string[]; en: string[] };
}

export type ListingStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "changes_requested"
  | "rejected"
  | "live"
  | "superseded";

export interface ListingDraft {
  id: string;
  status: ListingStatus;
  content: ListingContent;
  version_id: string | null;
  submitted_at: string | null;
  updated_at: string;
}

export interface AppListingState {
  listed: boolean;
  categories: string[];
  live: ListingContent;
  draft: ListingDraft | null;
  preview: AppCatalogEntry;
}

export function getAppListing(id: string): Promise<AppListingState> {
  return apiClient<AppListingState>(`${APPS}/${id}/listing`);
}

export function saveAppListing(id: string, body: ListingContent): Promise<ListingDraft> {
  return apiClient(`${APPS}/${id}/listing`, { method: "PUT", body: JSON.stringify(body) });
}

export function submitAppListing(id: string): Promise<ListingDraft> {
  return apiClient(`${APPS}/${id}/listing/submit`, { method: "POST" });
}

export function uploadListingScreenshot(id: string, file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  return apiClient(`${APPS}/${id}/listing/screenshots`, { method: "POST", body: form });
}

// ─── Notifications ───────────────────────────────────────────────────

export interface PartnerNotification {
  id: string;
  kind: "review_status" | "payout_recorded" | "platform_notice" | "subscription_past_due" | string;
  data: Record<string, unknown>;
  app_id: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export function listPartnerNotifications(params: { limit?: number; unread?: boolean } = {}): Promise<{
  items: PartnerNotification[];
  unread_count: number;
}> {
  return apiClient(`/partners/me/notifications${query(params)}`);
}

export function markPartnerNotificationsRead(ids?: string[]): Promise<{ updated: number }> {
  return apiClient("/partners/me/notifications/read", {
    method: "POST",
    body: JSON.stringify(ids ? { ids } : {}),
  });
}

// ─── Earnings (Phase 7) ──────────────────────────────────────────────

/** One ledger row, in piasters. `amount_cents` is signed: a sale is the
 *  partner's 80% (+), a payout a bank transfer NUMU sent (-), an adjustment
 *  a correction such as a refunded charge's share reversed. */
export interface PartnerLedgerEntry {
  kind: "sale" | "payout" | "adjustment";
  amount_cents: number;
  /** Sales: what the merchant paid, and NUMU's 20% of it. */
  gross_cents: number | null;
  platform_fee_cents: number | null;
  app_id: string | null;
  /** The app the entry is for (NUMU-api #656). Null on payouts and on
   *  adjustments that name no app; absent from an older API. */
  app_name?: string | null;
  app_slug?: string | null;
  reference: string | null;
  created_at: string;
}

export interface PartnerEarnings {
  /** What NUMU owes the partner: the sum of every entry. */
  balance_cents: number;
  /** The balance minus sales still inside the 30-day hold. */
  payable_cents: number;
  currency: string;
  /** Newest first, at most 100. */
  entries: PartnerLedgerEntry[];
}

export function getPartnerEarnings(): Promise<PartnerEarnings> {
  return apiClient<PartnerEarnings>("/partners/me/earnings");
}

// ─── Partner portal: dashboard, webhook deliveries, team ─────────────

export interface PartnerDashboard {
  installs_total: number;
  active: number;
  disabled: number;
  pending: number;
  uninstalled: number;
  monthly: { month: string; installs: number }[];
  latest: {
    store_name: string | null;
    app_id: string;
    app_name: string;
    installed_at: string;
    status: "active" | "disabled" | "pending";
  }[];
  /** Your share of sales in the period, in piasters. */
  net_sales_cents: number;
  balance_cents: number;
  payable_cents: number;
}

export type PartnerSubStatus = "active" | "trial" | "past_due" | "cancelled";

export interface PartnerSubscriptions {
  counts: Record<PartnerSubStatus, number>;
  total: number;
  items: {
    id: string;
    app_id: string;
    app_name: string;
    store_name: string | null;
    status: PartnerSubStatus;
    price_cents: number;
    currency: string;
    cycle: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    created_at: string;
  }[];
}

export function listPartnerSubscriptions(params: { app_id?: string }): Promise<PartnerSubscriptions> {
  return apiClient<PartnerSubscriptions>(`/partners/me/subscriptions${query(params)}`);
}

export interface PartnerCoupon {
  id: string;
  app_id: string;
  app_name: string | null;
  code: string;
  percent_off: number | null;
  amount_off_cents: number | null;
  /** Charged periods it discounts; null: every one. */
  duration_cycles: number | null;
  max_redemptions: number | null;
  expires_at: string | null;
  store_id: string | null;
  active: boolean;
  redemptions: number;
  created_at: string;
  list_price_cents?: number;
  discount_cents?: number;
  max_discount_cents?: number;
  /** Worth more than your share of the price, so it is capped at it. */
  capped?: boolean;
}

export interface NewPartnerCoupon {
  app_id: string;
  code: string;
  percent_off?: number | null;
  amount_off_cents?: number | null;
  duration_cycles?: number | null;
  max_redemptions?: number | null;
  expires_at?: string | null;
  store_id?: string | null;
}

export function listPartnerCoupons(): Promise<PartnerCoupon[]> {
  return apiClient<PartnerCoupon[]>("/partners/me/coupons");
}

export function createPartnerCoupon(body: NewPartnerCoupon): Promise<PartnerCoupon> {
  return apiClient<PartnerCoupon>("/partners/me/coupons", { method: "POST", body: JSON.stringify(body) });
}

export function setPartnerCouponActive(id: string, active: boolean): Promise<PartnerCoupon> {
  return apiClient<PartnerCoupon>(`/partners/me/coupons/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export function listCouponRedemptions(
  id: string,
): Promise<{ id: string; store_id: string; store_name: string | null; created_at: string }[]> {
  return apiClient(`/partners/me/coupons/${id}/redemptions`);
}

const query = (params: Record<string, string | number | boolean | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
};

export function getPartnerDashboard(params: { from?: string; to?: string; app_id?: string }): Promise<PartnerDashboard> {
  return apiClient<PartnerDashboard>(`/partners/me/dashboard${query(params)}`);
}

export interface PartnerAnalytics {
  months: { month: string; installs: number; uninstalls: number; active_stores: number; churn_rate: number | null }[];
  reasons: { reason: string; count: number }[];
  notes: { app_id: string; reason: string | null; text: string; created_at: string }[];
  paid_active: number;
  trial_to_paid: number | null;
  trial_note: string | null;
  api: { app_id: string; app_name: string; requests: number; errors: number; error_rate: number | null }[];
  api_from: string | null;
}

export function getPartnerAnalytics(params: { from?: string; to?: string; app_id?: string }): Promise<PartnerAnalytics> {
  return apiClient<PartnerAnalytics>(`/partners/me/analytics${query(params)}`);
}

export interface ApiLogPage {
  items: {
    at: string;
    request_id: string | null;
    method: string;
    route: string;
    status: number;
    latency_ms: number;
    rate_limited: boolean;
    store_id: string | null;
    store_name: string | null;
  }[];
  total: number;
  page: number;
  page_size: number;
  stats: { requests: number; errors: number; error_rate: number | null; p95_ms: number | null; rate_limited: number };
  routes: string[];
}

export function listAppApiLogs(
  appId: string,
  params: { status_class?: string; route?: string; store_id?: string; hours?: number; page?: number },
): Promise<ApiLogPage> {
  return apiClient<ApiLogPage>(`/partners/me/apps/${appId}/api-logs${query(params)}`);
}

export type DeliveryStatus = "pending" | "success" | "failed" | "exhausted";

export interface WebhookDelivery {
  id: string;
  app_id: string;
  app_name: string;
  event: string;
  store_id: string;
  store_name: string | null;
  url: string;
  status: DeliveryStatus;
  status_code: number | null;
  attempts: number;
  error: string | null;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  created_at: string;
}

export interface DeliveryPage {
  items: WebhookDelivery[];
  total: number;
  page: number;
  page_size: number;
}

export function listWebhookDeliveries(params: {
  app_id?: string;
  event?: string;
  status?: string;
  page?: number;
}): Promise<DeliveryPage> {
  return apiClient<DeliveryPage>(`/partners/me/webhooks/deliveries${query(params)}`);
}

export function resendWebhookDelivery(id: string): Promise<WebhookDelivery> {
  return apiClient<WebhookDelivery>(`/partners/me/webhooks/deliveries/${id}/resend`, { method: "POST" });
}

export interface PartnerMember {
  /** null for the owner, who is the partner account itself. */
  id: string | null;
  email: string;
  name: string | null;
  role: PartnerRole;
  status: "invited" | "active";
  created_at: string;
}

export function listPartnerTeam(): Promise<PartnerMember[]> {
  return apiClient<PartnerMember[]>("/partners/me/team");
}

export function invitePartnerMember(body: { email: string; role: "admin" | "developer" }): Promise<PartnerMember> {
  return apiClient<PartnerMember>("/partners/me/team", { method: "POST", body: JSON.stringify(body) });
}

export function updatePartnerMember(id: string, role: "admin" | "developer"): Promise<unknown> {
  return apiClient(`/partners/me/team/${id}`, { method: "PATCH", body: JSON.stringify({ role }) });
}

export function removePartnerMember(id: string): Promise<unknown> {
  return apiClient(`/partners/me/team/${id}`, { method: "DELETE" });
}

export function acceptPartnerInvitation(id: string): Promise<{ partner_id: string }> {
  return apiClient(`/partners/invitations/${id}/accept`, { method: "POST" });
}

export function updatePartnerProfile(
  body: Partial<PartnerProfile> & { directory_listed?: boolean; directory_profile?: DirectoryProfile },
): Promise<PartnerAccount> {
  return apiClient<PartnerAccount>("/partners/me", { method: "PATCH", body: JSON.stringify(body) });
}

// ─── Reviews and support ─────────────────────────────────────────────

export function listPartnerReviews(params: { app_id?: string; rating?: number; page?: number }): Promise<AppReviewPage> {
  return apiClient<AppReviewPage>(`/partners/me/reviews${query(params)}`);
}

export function replyPartnerReview(id: string, body: string): Promise<AppReview> {
  return apiClient<AppReview>(`/partners/me/reviews/${id}/reply`, { method: "PUT", body: JSON.stringify({ body }) });
}

export function reportPartnerReview(id: string, reason: string): Promise<unknown> {
  return apiClient(`/partners/me/reviews/${id}/report`, { method: "POST", body: JSON.stringify({ reason }) });
}

export function listPartnerTickets(params: { kind?: string; status?: string; page?: number }): Promise<TicketPage> {
  return apiClient<TicketPage>(`/partners/me/support${query(params)}`);
}

export function openPartnerTicket(form: FormData): Promise<SupportThread> {
  return apiClient<SupportThread>("/partners/me/support", { method: "POST", body: form });
}

export function getPartnerTicket(id: string): Promise<SupportThread> {
  return apiClient<SupportThread>(`/partners/me/support/${id}`);
}

export function replyPartnerTicket(id: string, form: FormData): Promise<SupportThread> {
  return apiClient<SupportThread>(`/partners/me/support/${id}/messages`, { method: "POST", body: form });
}

export function closePartnerTicket(id: string): Promise<SupportThread> {
  return apiClient<SupportThread>(`/partners/me/support/${id}/close`, { method: "POST" });
export interface PartnerReferrals {
  code: string | null;
  link: string | null;
  referral_bps: number;
  referral_months: number;
  earned_cents: number;
  stores: {
    tenant_id: string;
    store_name: string;
    signed_up_at: string;
    plan: string;
    status: string;
    first_paid_at: string | null;
    earned_cents: number;
  }[];
}

export function getPartnerReferrals(): Promise<PartnerReferrals> {
  return apiClient<PartnerReferrals>("/partners/me/referrals");
}
