/**
 * MFA (Two-Factor Authentication) API service.
 * Endpoints: /auth/2fa/*
 */

import { apiClient } from "./api";

export interface Enable2FAData {
  secret: string;
  provisioning_uri: string;
  qr_code_uri: string;
  backup_codes: string[];
  method: string;
}

export interface Verify2FAData {
  verified: boolean;
  method_used: string;
  backup_codes_remaining: number | null;
}

export interface TwoFactorStatus {
  is_enabled: boolean;
  method: string | null;
  backup_codes_remaining: number;
  enabled_at: string | null;
  last_used_at: string | null;
}

export interface RegenerateBackupCodesData {
  backup_codes: string[];
  previous_count: number;
  new_count: number;
}

/** Start 2FA setup — returns QR code URI and backup codes. */
export async function enable2FA(): Promise<Enable2FAData> {
  return apiClient<Enable2FAData>("/auth/2fa/enable", { method: "POST" });
}

/** Verify a TOTP or backup code to complete 2FA setup. */
export async function verify2FA(code: string): Promise<Verify2FAData> {
  return apiClient<Verify2FAData>("/auth/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

/** Disable 2FA (requires password). */
export async function disable2FA(
  password: string,
  code?: string
): Promise<void> {
  return apiClient<void>("/auth/2fa/disable", {
    method: "DELETE",
    body: JSON.stringify({ password, ...(code ? { code } : {}) }),
  });
}

/** Get current 2FA status. */
export async function get2FAStatus(): Promise<TwoFactorStatus> {
  return apiClient<TwoFactorStatus>("/auth/2fa/status");
}

/** Regenerate backup codes (requires current TOTP code). */
export async function regenerateBackupCodes(
  code: string
): Promise<RegenerateBackupCodesData> {
  return apiClient<RegenerateBackupCodesData>(
    "/auth/2fa/backup-codes/regenerate",
    {
      method: "POST",
      body: JSON.stringify({ code }),
    }
  );
}
