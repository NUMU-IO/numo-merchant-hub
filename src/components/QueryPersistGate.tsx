/**
 * Drives query persistence for the ACTIVE store.
 *
 * Mounted inside the store context so it can re-key on a store switch: when
 * the merchant changes store we stop persisting, wipe the snapshot, and start
 * again for the new one. Without that wipe the previous store's numbers would
 * sit in IndexedDB and could be restored under the new store on next launch.
 *
 * Renders nothing.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useDashboardStore } from "@/contexts/StoreContext";
import { isImpersonating } from "@/services/pushApi";
import {
  clearPersistedQueries,
  restorePersistedQueries,
  startPersistingQueries,
} from "@/lib/query-persist";

export function QueryPersistGate() {
  const client = useQueryClient();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id ?? null;

  useEffect(() => {
    if (!storeId) return;

    // SECURITY: never persist during impersonation. An admin opening a
    // merchant's dashboard to debug something must not leave that store's data
    // in IndexedDB on their own laptop, where it would outlive the session.
    if (isImpersonating()) {
      void clearPersistedQueries();
      return;
    }

    let stop: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      // Restore BEFORE subscribing, so the first debounced write cannot
      // overwrite a good snapshot with a half-populated cache.
      await restorePersistedQueries(client, storeId);
      if (cancelled) return;
      stop = startPersistingQueries(client, storeId);
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [client, storeId]);

  // Store switch: drop the previous store's snapshot immediately rather than
  // waiting for the next write to overwrite it.
  useEffect(() => {
    return () => {
      void clearPersistedQueries();
    };
  }, [storeId]);

  return null;
}
