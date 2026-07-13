import { apiClient } from "./api";

/** Personal access token metadata (the secret is only returned at creation). */
export interface AccessToken {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[] | null; // null = unrestricted (owner-equivalent)
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface CreatedAccessToken extends AccessToken {
  /** The raw secret — shown exactly once at creation. */
  token: string;
}

export interface CreateAccessTokenInput {
  name: string;
  scopes?: string[];
  expires_in_days?: number;
}

/** Scope domains, mirrored from NUMU-api's VALID_SCOPES. */
export const SCOPE_DOMAINS = [
  "catalog",
  "media",
  "orders",
  "customers",
  "analytics",
  "marketing",
  "themes",
  "risk",
  "settings",
] as const;

export function listAccessTokens(storeId: string): Promise<AccessToken[]> {
  return apiClient<AccessToken[]>(`/stores/${storeId}/access-tokens/`);
}

export function createAccessToken(
  storeId: string,
  input: CreateAccessTokenInput,
): Promise<CreatedAccessToken> {
  return apiClient<CreatedAccessToken>(`/stores/${storeId}/access-tokens/`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function revokeAccessToken(storeId: string, tokenId: string): Promise<void> {
  return apiClient<void>(`/stores/${storeId}/access-tokens/${tokenId}`, {
    method: "DELETE",
  });
}
