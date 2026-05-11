/**
 * Waitlist & beta-invite API service — public endpoints (no auth required).
 */

import { apiClient } from "./api";
import { initCSRF } from "./csrf";
import { apiErrorFromResponse } from "@/lib/api-error";
import type { User } from "./authApi";

if (!import.meta.env.VITE_API_URL) {
  throw new Error(
    "VITE_API_URL is not set. Refusing to start without a configured API endpoint."
  );
}
const API_BASE = import.meta.env.VITE_API_URL;

export interface JoinWaitlistData {
  email: string;
  name?: string;
  company_name?: string;
  phone?: string;
  referral_code?: string;
  source?: string;
}

export interface WaitlistPositionResponse {
  id: string;
  email: string;
  referral_code: string;
  position: number;
  message: string;
}

export interface WaitlistStatsResponse {
  total_signups: number;
  stores_launched: number;
}

export async function joinWaitlist(
  data: JoinWaitlistData
): Promise<WaitlistPositionResponse> {
  return apiClient<WaitlistPositionResponse>("/public/waitlist", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getWaitlistStats(): Promise<WaitlistStatsResponse> {
  return apiClient<WaitlistStatsResponse>("/public/waitlist/stats");
}

// ─── Beta invite redemption ──────────────────────────────────────────────────

export type BetaInviteStatus = "pending" | "invited" | "converted";

export interface BetaInviteCheck {
  email: string;
  name: string | null;
  company_name: string | null;
  status: BetaInviteStatus;
}

export interface BetaRedeemData {
  invite_code: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  store_name: string;
  subdomain: string;
}

export interface BetaRedeemGoogleData {
  invite_code: string;
  id_token: string;
  store_name: string;
  subdomain: string;
}

/**
 * Look up an admin-issued invite code so the accept-invite page can pre-fill
 * the form. Returns the invite's status so the page can react accordingly:
 * "invited" → show form, "converted" → bounce to login, "pending" → wait.
 * Throws on 404 only when the code itself is unknown.
 */
export async function checkBetaInvite(code: string): Promise<BetaInviteCheck> {
  return apiClient<BetaInviteCheck>(
    `/public/beta/invite/${encodeURIComponent(code)}`,
  );
}

async function postRedeem(
  endpoint: string,
  body: unknown,
): Promise<{ user: User }> {
  // Raw fetch (not apiClient) — pre-auth, no CSRF token yet, and a 4xx here
  // shouldn't trigger the 401 → /login redirect baked into apiClient.
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw await apiErrorFromResponse(res);
  }

  const json = await res.json();
  await initCSRF();
  return { user: json.data.user as User };
}

/** Redeem the invite with email + password. Auth cookies are set on success. */
export async function redeemBetaInvite(
  data: BetaRedeemData,
): Promise<{ user: User }> {
  return postRedeem("/public/beta/redeem", data);
}

/** Redeem the invite via Google OAuth. Auth cookies are set on success. */
export async function redeemBetaInviteGoogle(
  data: BetaRedeemGoogleData,
): Promise<{ user: User }> {
  return postRedeem("/public/beta/redeem-google", data);
}
