/**
 * Auth API service — login, register, logout, get current user.
 * Authentication is handled via httpOnly cookies set by the backend.
 * CSRF token is fetched after login/register so subsequent requests pass validation.
 */

import { apiClient } from "./api";

if (!import.meta.env.VITE_API_URL) {
  throw new Error(
    "VITE_API_URL is not set. Refusing to start without a configured API endpoint."
  );
}
const API_BASE = import.meta.env.VITE_API_URL;

/** Fetch a CSRF token from the backend (sets csrf_token cookie). */
export async function fetchCsrfToken(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/csrf-token`, {
      credentials: "include",
    });
  } catch {
    // Non-critical — CSRF cookie may already exist
  }
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
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: User;
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
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `Login failed (${res.status})`);
  }

  const json = await res.json();

  // Fetch CSRF token now that we have auth cookies
  await fetchCsrfToken();

  return json.data;
}

export async function register(data: RegisterData): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `Registration failed (${res.status})`);
  }

  const json = await res.json();

  // Fetch CSRF token now that we have auth cookies
  await fetchCsrfToken();

  return json.data;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
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
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `Verification failed (${res.status})`);
  }
}

/** Request a new verification email (code + link). */
export async function resendVerificationEmail(): Promise<void> {
  await apiClient<{ message: string }>("/auth/resend-verification", {
    method: "POST",
  });
}
