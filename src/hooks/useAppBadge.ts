/**
 * Mirrors the unread count onto the installed app's icon.
 *
 * Support is genuinely patchy and the gaps are counter-intuitive:
 *   • Desktop Chromium — yes (taskbar/dock)
 *   • iOS 16.4+ Home-Screen apps — yes
 *   • Chrome for ANDROID — no, despite Android being our largest platform
 *
 * So this is decoration, never a channel. Push (Phase 2) is what actually
 * reaches a merchant; the badge is a bonus where the OS happens to allow it.
 * Every call is feature-detected and swallowed — an unsupported browser must
 * not throw into a render path.
 */
import { useEffect } from "react";

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function useAppBadge(count: number | null | undefined) {
  useEffect(() => {
    const nav = navigator as BadgeNavigator;
    if (typeof nav.setAppBadge !== "function") return;

    const n = Number(count) || 0;
    try {
      if (n > 0) void nav.setAppBadge(n).catch(() => {});
      else void nav.clearAppBadge?.().catch(() => {});
    } catch {
      /* unsupported or blocked — decoration only */
    }
  }, [count]);
}
