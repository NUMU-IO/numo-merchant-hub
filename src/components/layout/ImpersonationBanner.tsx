/**
 * Impersonation banner — shown when a super-admin has opened this hub via
 * "Log in as merchant" from the admin dashboard.
 *
 * Handoff protocol:
 *   1. The admin frontend opens `<hub>/?by=<admin>#handoff_token=<jwt>`.
 *   2. On first mount we pull the token from the URL *fragment* (fragments
 *      are never sent to the server or Referer headers), store it in
 *      `sessionStorage` (tab-scoped so parallel impersonation tabs don't
 *      collide), and strip it from the URL.
 *   3. The hub's apiClient reads this token and sends it as
 *      `Authorization: Bearer` on every request, bypassing the cookie
 *      jar entirely. Merchants who aren't being impersonated keep using
 *      cookie auth.
 */

import { useEffect, useState } from "react";
import { ShieldAlert, LogOut } from "lucide-react";

export const IMPERSONATION_TOKEN_KEY = "numu.impersonation_token";
export const IMPERSONATION_BY_KEY = "numu.impersonating_by";

export function ImpersonationBanner() {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    // Read the fragment first (new handoff-token flow) and then fall back
    // to the query string (old `?impersonating=1` flow) for back-compat.
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const fragParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);

    const handoffToken = fragParams.get("handoff_token");
    const by =
      queryParams.get("by") ||
      fragParams.get("by") ||
      (queryParams.get("impersonating") === "1" ? "admin" : null);

    if (handoffToken) {
      sessionStorage.setItem(IMPERSONATION_TOKEN_KEY, handoffToken);
      if (by) sessionStorage.setItem(IMPERSONATION_BY_KEY, by);
      setAdminEmail(by || "admin");
      // Strip the handoff bits from the URL so a refresh doesn't re-seed
      // sessionStorage from a stale token, and so tokens don't linger in
      // the address bar or browser history.
      queryParams.delete("by");
      queryParams.delete("impersonating");
      const rest = queryParams.toString();
      const clean = window.location.pathname + (rest ? `?${rest}` : "");
      window.history.replaceState({}, "", clean);
      return;
    }

    if (by && queryParams.get("impersonating") === "1") {
      // Legacy URL shape — no token in the fragment. Keep the banner up
      // for UX, but auth still relies on whatever cookie was set.
      sessionStorage.setItem(IMPERSONATION_BY_KEY, by);
      setAdminEmail(by);
      queryParams.delete("by");
      queryParams.delete("impersonating");
      const rest = queryParams.toString();
      const clean = window.location.pathname + (rest ? `?${rest}` : "");
      window.history.replaceState({}, "", clean);
      return;
    }

    const storedBy = sessionStorage.getItem(IMPERSONATION_BY_KEY);
    if (storedBy) setAdminEmail(storedBy);
  }, []);

  if (!adminEmail) return null;

  const stop = () => {
    sessionStorage.removeItem(IMPERSONATION_TOKEN_KEY);
    sessionStorage.removeItem(IMPERSONATION_BY_KEY);
    setAdminEmail(null);
    // Hard reload so the hub picks up whatever cookie-auth state exists
    // (usually logged-out), instead of half-applying stale Bearer headers.
    window.location.href = "/login";
  };

  return (
    <div className="sticky top-0 z-40 bg-amber-500 text-amber-950 text-sm font-medium">
      <div className="container mx-auto flex items-center gap-3 px-4 py-2">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">
          Impersonating this merchant — signed in by{" "}
          <span className="font-semibold">{adminEmail}</span>. Changes are written
          to the merchant's real data.
        </span>
        <button
          type="button"
          onClick={stop}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-900/15 px-2.5 py-1 text-xs font-semibold hover:bg-amber-900/25 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Stop impersonating
        </button>
      </div>
    </div>
  );
}
