/**
 * Impersonation banner — shown when a super-admin has opened this hub via
 * "Log in as merchant" from the admin dashboard.
 *
 * On first mount: if the URL has `?impersonating=1`, stash the admin email
 * in sessionStorage and strip the params so a refresh doesn't keep them in
 * the URL. The sessionStorage entry keeps the banner alive for the whole
 * tab session.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldAlert, LogOut } from "lucide-react";

const STORAGE_KEY = "numu.impersonating_by";

export function ImpersonationBanner() {
  const { logout } = useAuth();
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    // Pick up the flag from either the URL (first load) or sessionStorage
    // (subsequent navigation within the tab).
    const params = new URLSearchParams(window.location.search);
    if (params.get("impersonating") === "1") {
      const by = params.get("by") || "admin";
      sessionStorage.setItem(STORAGE_KEY, by);
      setAdminEmail(by);
      params.delete("impersonating");
      params.delete("by");
      const rest = params.toString();
      const clean =
        window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash;
      window.history.replaceState({}, "", clean);
      return;
    }
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) setAdminEmail(stored);
  }, []);

  if (!adminEmail) return null;

  const stop = async () => {
    sessionStorage.removeItem(STORAGE_KEY);
    try {
      await logout();
    } catch {
      /* logout failures shouldn't keep us stuck on the banner */
    }
    setAdminEmail(null);
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
