/**
 * Per-tenant feature flag reader.
 *
 * The backend exposes `tenant.feature_flags` on `GET /auth/me`; this hook
 * pulls the named flag out of the auth context. Defaults to `false` when
 * the auth/tenant payload hasn't loaded yet so off-by-default callers
 * (gated nav rows, gated routes) won't flicker visible during boot.
 */

import { useAuth } from "@/contexts/AuthContext";

export function useFeatureFlag(name: string): boolean {
  const { tenant } = useAuth();
  return Boolean(tenant?.feature_flags?.[name]);
}
