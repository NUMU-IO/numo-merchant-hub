/**
 * The founder cohort of the store currently on screen.
 *
 * Reads the store first and only falls back to the /auth/me tenant.
 *
 * That order matters and is the whole point of this hook. `/auth/me`
 * resolves its tenant by preferring the current-store tenant ONLY when that
 * tenant's owner_id matches the caller, and otherwise returning any tenant
 * the user owns (newest non-demo first). A merchant with two stores — or a
 * store whose tenant has a null owner_id — therefore got an answer about a
 * different store than the one they were looking at: the badge vanished on
 * the store that had it, or appeared on one that did not.
 *
 * The fallback is kept so the badge still works for sessions where the
 * store payload has not loaded yet.
 */

import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStore } from "@/contexts/StoreContext";

export function useFounderCohort(): string | null {
  const { currentStore } = useDashboardStore();
  const { tenant } = useAuth();

  const fromStore = currentStore?.founder_cohort;
  if (fromStore !== undefined && fromStore !== null) return fromStore;

  // Only trust the tenant-level value when there is no store loaded to
  // contradict it — otherwise a multi-store merchant sees the wrong badge.
  if (currentStore) return null;
  return tenant?.founder_cohort ?? null;
}
