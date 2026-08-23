import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useHubPages } from "@/lib/nav/useHubPages";
import { pagesStore } from "@/lib/nav/pages-store";

/**
 * Remembers which hub pages the merchant opens (for the "Recent activity"
 * popover and the dashboard "Recently viewed" strip). Only registry pages
 * count — `/orders/ORD-123` and other detail routes are skipped so the
 * list stays a list of *pages*, not of records.
 */
export function usePageVisitTracker() {
  const { pathname, search } = useLocation();
  const { storeId, match } = useHubPages();

  useEffect(() => {
    if (!storeId) return;
    const url = match(pathname, search);
    if (url) pagesStore.recordVisit(storeId, url);
  }, [storeId, pathname, search, match]);
}
