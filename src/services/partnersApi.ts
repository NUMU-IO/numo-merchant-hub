/**
 * Partner program API (apps plan, Phase 2): /api/v1/partners.
 *
 * The whole program answers 404 while NUMU keeps it closed, so
 * `getPartnerMe` returns null then and the hub hides the portal.
 */

import { apiClient } from "./api";
import { ApiError } from "@/lib/api-error";

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

export function submitAppVersion(id: string, versionId: string): Promise<PartnerAppVersion> {
  return apiClient(`${APPS}/${id}/versions/${versionId}/submit`, { method: "POST" });
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
}

const query = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
};

export function getPartnerDashboard(params: { from?: string; to?: string; app_id?: string }): Promise<PartnerDashboard> {
  return apiClient<PartnerDashboard>(`/partners/me/dashboard${query(params)}`);
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

export function updatePartnerProfile(body: Partial<PartnerProfile>): Promise<PartnerAccount> {
  return apiClient<PartnerAccount>("/partners/me", { method: "PATCH", body: JSON.stringify(body) });
}
