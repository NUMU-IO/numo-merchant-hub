/**
 * MFA/2FA API service — enable, verify, disable, and manage backup codes.
 */

import { apiClient } from "./api";

// ── Types ──

export interface TwoFactorStatus {
  is_enabled: boolean;
  method: string | null;
  backup_codes_remaining: number;
  enabled_at: string | null;
  last_used_at: string | null;
}

/** Returned by /auth/2fa/enable — backup codes shown ONCE here */
export interface EnableTwoFactorResponse {
  secret: string;
  provisioning_uri: string;
  qr_code_uri: string;
  backup_codes: string[]; // plaintext, only shown once
  method: string;
}

/** Returned by /auth/2fa/verify — just confirms; no backup codes */
export interface VerifyTwoFactorResponse {
  verified: boolean;
  method_used: string;
  backup_codes_remaining: number | null;
}

export interface BackupCodesResponse {
  backup_codes: string[];
  previous_count: number;
  new_count: number;
}

// ── API calls ──

export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  return apiClient<TwoFactorStatus>("/auth/2fa/status");
}

/** Initiates 2FA setup. Returns QR URI, secret, AND plaintext backup codes (only time they're shown). */
export async function enableTwoFactor(): Promise<EnableTwoFactorResponse> {
  return apiClient<EnableTwoFactorResponse>("/auth/2fa/enable", {
    method: "POST",
  });
}

/** Confirms 2FA setup with a TOTP code. Backend auto-detects is_initial_setup from pending state. */
export async function verifyTwoFactor(
  code: string,
): Promise<VerifyTwoFactorResponse> {
  return apiClient<VerifyTwoFactorResponse>("/auth/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

/** Disables 2FA. Requires password (and optionally a TOTP code). Uses DELETE per API spec. */
export async function disableTwoFactor(
  password: string,
  code?: string,
): Promise<void> {
  return apiClient<void>("/auth/2fa/disable", {
    method: "DELETE",
    body: JSON.stringify({ password, code: code ?? null }),
  });
}

export async function regenerateBackupCodes(
  code: string,
): Promise<BackupCodesResponse> {
  return apiClient<BackupCodesResponse>("/auth/2fa/backup-codes/regenerate", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}
