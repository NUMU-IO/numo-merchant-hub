/**
 * StoreContext — manages the current merchant store for the dashboard.
 *
 * After authentication, fetches the user's stores via GET /stores/.
 * Persists the selected store ID in localStorage so it survives refresh.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";
import { listStores } from "@/services/storeApi";
import type { StoreData } from "@/services/storeApi";
import { setActiveStoreCurrency } from "@/lib/format-money";
import { setActiveStoreTimezone } from "@/lib/store-timezone";

const STORE_KEY = "numu-current-store";

interface StoreContextType {
  stores: StoreData[];
  currentStore: StoreData | null;
  isLoading: boolean;
  hasStores: boolean;
  switchStore: (storeId: string) => void;
  /** Refetch the store list. Pass `preferId` to select a specific store
   *  (e.g. one just created) instead of the saved/first store. */
  refetchStores: (preferId?: string) => Promise<void>;
}

const StoreContext = createContext<StoreContextType>({
  stores: [],
  currentStore: null,
  isLoading: true,
  hasStores: false,
  switchStore: () => {},
  refetchStores: async () => {},
});

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [stores, setStores] = useState<StoreData[]>([]);
  const [currentStore, setCurrentStore] = useState<StoreData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Track which auth state we last fetched for, so we know when to re-fetch
  const fetchedForAuthRef = useRef<boolean | null>(null);

  const fetchStores = useCallback(async (preferId?: string) => {
    if (!isAuthenticated) {
      setStores([]);
      setCurrentStore(null);
      fetchedForAuthRef.current = false;
      return;
    }

    // Only show loading spinner on initial fetch, not on refetches,
    // so RequireStore doesn't unmount the current page.
    const isInitial = fetchedForAuthRef.current !== true;
    if (isInitial) setIsLoading(true);

    try {
      const result = await listStores();
      const items = result?.items || [];
      setStores(items);

      if (items.length > 0) {
        // Selection priority: explicit preferId (e.g. a just-created store)
        // → saved id → first store. Persist so the choice survives reloads.
        const savedId = localStorage.getItem(STORE_KEY);
        const selected =
          (preferId && items.find((s) => s.id === preferId)) ||
          items.find((s) => s.id === savedId) ||
          items[0];
        setCurrentStore(selected);
        localStorage.setItem(STORE_KEY, selected.id);
      } else {
        setCurrentStore(null);
      }
      fetchedForAuthRef.current = true;
    } catch (err) {
      console.error("[StoreContext] Failed to fetch stores:", err);
      setStores([]);
      setCurrentStore(null);
      fetchedForAuthRef.current = true;
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    fetchStores();
  }, [authLoading, fetchStores]);

  // Keep the module-level home currency in sync with the selected store
  // so `formatMoney()` renders every figure in the merchant's market
  // currency (SAR for a Saudi store) instead of a hardcoded EGP.
  useEffect(() => {
    setActiveStoreCurrency(currentStore?.default_currency);
    // Same pattern for the store's wall-clock timezone — analytics
    // requests send it as `tz` so the backend buckets days on the
    // store's calendar, not UTC. Defaults to Africa/Cairo when unset.
    setActiveStoreTimezone(
      (currentStore?.settings as { timezone?: string } | undefined)?.timezone
    );
  }, [currentStore]);

  const switchStore = useCallback(
    (storeId: string) => {
      const store = stores.find((s) => s.id === storeId);
      if (store) {
        setCurrentStore(store);
        localStorage.setItem(STORE_KEY, storeId);
      }
    },
    [stores]
  );

  // Derive loading: true if auth is still loading, or if we're authenticated
  // but haven't completed a fetch for this auth session yet.
  const effectiveLoading =
    authLoading ||
    isLoading ||
    (isAuthenticated && fetchedForAuthRef.current !== true);

  return (
    <StoreContext.Provider
      value={{
        stores,
        currentStore,
        isLoading: effectiveLoading,
        hasStores: stores.length > 0,
        switchStore,
        refetchStores: fetchStores,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useDashboardStore = () => useContext(StoreContext);
