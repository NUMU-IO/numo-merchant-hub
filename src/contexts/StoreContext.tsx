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

  const fetchStores = useCallback(async () => {
    if (!isAuthenticated) {
      setStores([]);
      setCurrentStore(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const result = await listStores();
      const items = result.items || [];
      setStores(items);

      if (items.length > 0) {
        // Restore saved store or default to first
        const savedId = localStorage.getItem(STORE_KEY);
        const saved = items.find((s) => s.id === savedId);
        setCurrentStore(saved || items[0]);
      } else {
        setCurrentStore(null);
      }
    } catch {
      setStores([]);
      setCurrentStore(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    fetchStores();
  }, [authLoading, fetchStores]);

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

  return (
    <StoreContext.Provider
      value={{
        stores,
        currentStore,
        isLoading,
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
