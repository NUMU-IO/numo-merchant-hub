/**
 * Auth API service — login, register, logout, get current user.
 * Authentication is handled via httpOnly cookies set by the backend.
 * CSRF token is fetched after login/register so subsequent requests pass validation.
 */

import { apiClient } from "./api";
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
  demo_email: string | null;
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
  phone?: string;
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

export async function getMe(): Promise<User> {
  // Use raw fetch — NOT apiClient — to avoid the 401 → redirect loop.
  // This is called on mount to check session validity; a 401 here simply
  // means "not logged in", not "redirect now".
  const res = await fetch(`${API_BASE}/auth/me`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error("Not authenticated");
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
