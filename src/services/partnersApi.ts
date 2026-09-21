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

export interface PartnerMe {
  account: PartnerAccount | null;
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
