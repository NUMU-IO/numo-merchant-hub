/**
 * Is the browser online?
 *
 * ⚠️ `navigator.onLine` only means "a network interface exists". It is TRUE on
 * a captive portal, a dead connection and a zero-balance SIM. So it is reliable
 * for detecting OFFLINE (false is trustworthy) and unreliable for asserting
 * ONLINE — which is exactly the mistake that made `offline.html` reload itself
 * every 600ms in Phase 0 QA.
 *
 * Used here only to decide whether to show a "you're offline" banner. Nothing
 * load-bearing keys off it.
 */
import { useEffect, useState } from "react";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
