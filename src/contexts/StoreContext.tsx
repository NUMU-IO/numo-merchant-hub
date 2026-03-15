/**
 * StoreContext — manages the current merchant store for the dashboard.
 *
 * After authentication, fetches the user's stores via GET /stores/.
 * Persists the selected store ID in localStorage so it survives refresh.
 *
 * Performance note: stores are fetched immediately on mount (in parallel
 * with the auth/me check) because the session cookie is already present.
 * If the optimistic fetch fails (no session) the auth-aware effect retries
 * once the session is confirmed.
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

const STORE_KEY = "numu-current-store";

interface StoreContextType {
  stores: StoreData[];
  currentStore: StoreData | null;
  isLoading: boolean;
  hasStores: boolean;
  switchStore: (storeId: string) => void;
  refetchStores: () => Promise<void>;
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

  // null = not yet fetched (or failed — retry eligible)
  // true = fetched successfully
  const fetchedForAuthRef = useRef<boolean | null>(null);

  // Fetch stores without an auth pre-check — the API returns 401 if the
  // session is invalid and we handle it in the catch block.
  const fetchStores = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await listStores();
      const items = result?.items || [];
      setStores(items);

      if (items.length > 0) {
        const savedId = localStorage.getItem(STORE_KEY);
        const saved = items.find((s) => s.id === savedId);
        setCurrentStore(saved || items[0]);
      } else {
        setCurrentStore(null);
      }
      fetchedForAuthRef.current = true;
    } catch (err) {
      console.error("[StoreContext] Failed to fetch stores:", err);
      setStores([]);
      setCurrentStore(null);
      // Leave fetchedForAuthRef as null so the auth-aware effect can retry.
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Optimistic fetch on mount — fires in parallel with the auth/me request.
  // For authenticated users this resolves at the same time as auth, cutting
  // one full round-trip from the critical path.
  useEffect(() => {
    fetchStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retry once auth is confirmed: covers the case where the optimistic fetch
  // failed because the session cookie wasn't present yet, or the user just
  // logged in during this page load.
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (fetchedForAuthRef.current === true) return; // already have good data
    fetchStores();
  }, [authLoading, isAuthenticated, fetchStores]);

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
  // but haven't completed a successful fetch for this session yet.
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
