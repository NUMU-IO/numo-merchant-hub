/**
 * Waitlist API service — public endpoints (no auth required).
 */

import { apiClient } from "./api";

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
