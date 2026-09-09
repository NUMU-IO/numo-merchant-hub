/**
 * Auth API service — login, register, logout, get current user.
 * Authentication is handled via httpOnly cookies set by the backend.
 * CSRF token is fetched after login/register so subsequent requests pass validation.
 */

import { apiClient, getCurrentStoreId, getImpersonationToken } from "./api";
import { initCSRF, clearCSRFToken, getCSRFToken } from "./csrf";
import { apiErrorFromResponse, apiErrorFromNetwork } from "@/lib/api-error";

if (!import.meta.env.VITE_API_URL) {
  throw new Error(
    "VITE_API_URL is not set. Refusing to start without a configured API endpoint."
  );
}
const API_BASE = import.meta.env.VITE_API_URL;

export interface TenantInfo {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
  lifecycle_state: string;
  is_demo: boolean;
  is_on_trial: boolean;
  is_read_only: boolean;
  is_writable: boolean;
  expires_at: string | null;
  days_remaining: number | null;
  /** When the trial began — the countdown draws one mark per day of the whole
   *  trial, so it needs the length as well as the remainder. */
  trial_started_at?: string | null;
  demo_email: string | null;
  /**
   * Per-tenant feature flags. Controlled server-side. Empty `{}` means
   * no offers-v2 / experimental surfaces are unlocked for this tenant.
   * Read with `useFeatureFlag(name)`.
   */
  feature_flags: Record<string, boolean>;
  /**
   * Founder-merchant cohort — the join YEAR ("2025"), or null for everyone
   * else. A year rather than a rank on purpose: a rank would tell merchant
   * #42 that 41 came before them, which publishes how big the platform is.
   */
  founder_cohort: string | null;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string | null;
  role: string;
  status: string;
  avatar_url: string | null;
  is_verified: boolean;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
  tenant: TenantInfo | null;
}

export interface AuthResponse {
  user: User;
}

export interface LoginResponse {
  user: User | null;
  requires_2fa: boolean;
  challenge_token: string | null;
}

/** Thrown by login() when the account has 2FA enabled. */
export class TwoFactorRequiredError extends Error {
  challengeToken: string;
  constructor(challengeToken: string) {
    super("2FA verification required");
    this.name = "TwoFactorRequiredError";
    this.challengeToken = challengeToken;
  }
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  // Required by the API. A merchant we cannot reach on WhatsApp cannot be
  // warned about a low wallet or chased when their setup stalls.
  phone: string;
  /** Default true. When false, `whatsapp_phone` carries the real number. */
  whatsapp_same_as_phone?: boolean;
  /** Only sent when it differs from `phone`; absence means "same". */
  whatsapp_phone?: string;
  /** UI locale — picks the language of every merchant-facing message. */
  language?: "ar" | "en";
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw await apiErrorFromResponse(res);
  }

  const json = await res.json();
  const data = json.data as LoginResponse;

  // If 2FA is required, fetch CSRF (stale cookies may trigger validation)
  // then throw so the caller can prompt for the code
  if (data.requires_2fa && data.challenge_token) {
    await initCSRF();
    throw new TwoFactorRequiredError(data.challenge_token);
  }

  // Fetch CSRF token now that we have auth cookies
  await initCSRF();

  return { user: data.user! };
}

/** Complete login for accounts with 2FA enabled. */
export async function complete2FALogin(
  challengeToken: string,
  code: string
): Promise<AuthResponse> {
  const csrfToken = getCSRFToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

  const res = await fetch(`${API_BASE}/auth/2fa/complete-login`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ challenge_token: challengeToken, code }),
  });

  if (!res.ok) {
    throw await apiErrorFromResponse(res);
  }

  const json = await res.json();

  // Now we have auth cookies — fetch CSRF token
  await initCSRF();

  return { user: json.data.user };
}

export async function register(data: RegisterData): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw await apiErrorFromResponse(res);
  }

  const json = await res.json();

  // Fetch CSRF token now that we have auth cookies
  await initCSRF();

  return json.data;
}

export async function googleLogin(idToken: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });

  if (!res.ok) {
    throw await apiErrorFromResponse(res);
  }

  const json = await res.json();
  await initCSRF();
  return json.data;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  clearCSRFToken();
}

/**
 * Silently refresh the access token using the httpOnly refresh-token cookie.
 *
 * Returns true when the backend rotated the cookies, false on any failure
 * (expired/missing refresh token, rate limit, network). apiClient calls this
 * on 401 to extend the session without bouncing the user to /login.
 *
 * Uses raw fetch (not apiClient) so a 401 here doesn't recurse back through
 * the 401 handler.
 */
export type RefreshOutcome = "ok" | "expired" | "transient";

/** Refresh must never hang every 401'd caller behind the shared promise. */
const REFRESH_TIMEOUT_MS = 15_000;

/**
 * Rotate the session.
 *
 * Three outcomes, because they need three different reactions:
 *  - "ok"        → retry the original request.
 *  - "expired"   → the refresh cookie is gone/invalid (401/403): only THIS
 *                  means the session is really over → go to /login.
 *  - "transient" → 429 (rate limit), 5xx, timeout, offline. The session is
 *                  fine; the caller surfaces an error and tries again later.
 *                  Treating these as "expired" is what used to log merchants
 *                  out mid-work.
 */
export async function refreshSession(): Promise<RefreshOutcome> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
    if (res.ok) return "ok";
    if (res.status === 401 || res.status === 403) return "expired";
    return "transient";
  } catch {
    return "transient";
  }
}

/** How long the boot-time session check may hang before we give up. */
export const AUTH_BOOT_TIMEOUT_MS = 10_000;

export async function getMe(): Promise<User> {
  // Use raw fetch — NOT apiClient — to avoid the 401 → redirect loop.
  // This is called on mount to check session validity; a 401 here simply
  // means "not logged in", not "redirect now".
  //
  // Throws ApiError, not a bare Error: AuthContext distinguishes "the
  // server said no" (status 401 → /login) from "there is no server"
  // (status 0 → restore the cached session / show the offline screen).
  // It used to throw `new Error("Not authenticated")` for BOTH, which made
  // the offline-boot branch unreachable and a hung request an infinite
  // splash with no way out.
  // Carries the same identity headers apiClient sends. Without them this call
  // authenticated by COOKIE alone, and in an admin impersonation tab the
  // cookie is the ADMIN's: /auth/me answered with the operator's user and the
  // operator's tenant while every other request — which does send the handoff
  // Bearer — answered as the merchant. The hub then greeted the operator by
  // name over the merchant's dashboard, and read lifecycle off the wrong
  // tenant, so the merchant's trial banner, welcome, plan, feature flags and
  // read-only state were all resolved against the wrong account.
  const handoff = getImpersonationToken();
  const storeId = getCurrentStoreId();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/me`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(handoff ? { Authorization: `Bearer ${handoff}` } : {}),
        // Which store's tenant to report for a multi-store merchant. Without
        // it the server falls back to their newest tenant, which is not
        // necessarily the store the hub is showing.
        ...(storeId ? { "X-Tenant-Id": storeId } : {}),
      },
      signal: AbortSignal.timeout(AUTH_BOOT_TIMEOUT_MS),
    });
  } catch (err) {
    throw apiErrorFromNetwork(err);
  }

  if (!res.ok) {
    throw await apiErrorFromResponse(res);
  }

  const json = await res.json();
  return json.data;
}

/** Verify email using a 6-digit code. */
export async function verifyEmailByCode(code: string): Promise<void> {
  const res = await apiClient<{ message: string }>("/auth/verify-email-code", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

/** Verify email using the JWT token (link click). */
export async function verifyEmailByToken(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/verify-email`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    throw await apiErrorFromResponse(res);
  }
}

/** Request a new verification email (code + link). */
export async function resendVerificationEmail(): Promise<void> {
  await apiClient<{ message: string }>("/auth/resend-verification", {
    method: "POST",
  });
}

/** Update current user's profile. */
export async function updateProfile(data: {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
}): Promise<User> {
  return apiClient<User>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/** Change password (requires current password). Revokes all other sessions. */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiClient<{ message: string }>("/auth/me/password", {
    method: "PATCH",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

/** Request a password reset email. */
export async function forgotPassword(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    throw await apiErrorFromResponse(res);
  }
}

/** Reset password using the token from email. */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  if (!res.ok) {
    throw await apiErrorFromResponse(res);
  }
}
