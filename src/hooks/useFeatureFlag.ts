/**
 * Per-tenant feature flag reader.
 *
 * Release flags come from the store's entitlements. `tenant.feature_flags` on
 * `GET /auth/me` stays as a fallback: platform flags such as
 * `theme_app_embeds` are merged in there and are not in the flags table.
 * Defaults to `false` while neither has loaded so off-by-default callers
 * (gated nav rows, gated routes) won't flicker visible during boot.
 */

import { useAuth } from "@/contexts/AuthContext";
import { useEntitlements } from "@/hooks/useEntitlements";

export function useFeatureFlag(name: string): boolean {
  const { tenant } = useAuth();
  const { flag } = useEntitlements();
  return flag(name) || Boolean(tenant?.feature_flags?.[name]);
}
