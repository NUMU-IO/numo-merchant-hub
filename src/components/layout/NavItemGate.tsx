/**
 * Gate a sidebar nav item against the platform-admin nav config.
 *
 * - Returns null when the tab is hidden (visible: false).
 * - Renders children with reduced opacity + a "Soon" badge and blocks
 *   clicks when marked coming_soon: true.
 * - Renders children as-is when the fetch is still pending or when the
 *   tab is fully live, so failure of the config endpoint never breaks
 *   the sidebar.
 */

import type { ReactNode } from "react";
import { useNavConfig } from "@/hooks/useNavConfig";
import { useLanguage } from "@/contexts/LanguageContext";

export function NavItemGate({
  navKey,
  children,
}: {
  navKey: string;
  children: ReactNode;
}) {
  const { isVisible, isComingSoon } = useNavConfig();
  const { isRTL } = useLanguage();

  if (!isVisible(navKey)) return null;
  if (!isComingSoon(navKey)) return <>{children}</>;

  return (
    <div
      className="relative"
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="pointer-events-none opacity-55">{children}</div>
      <span
        className="absolute top-1/2 -translate-y-1/2 text-[9px] font-semibold uppercase tracking-wider rounded bg-amber-500/20 text-amber-600 px-1.5 py-[1px] pointer-events-none group-data-[collapsible=icon]:hidden"
        style={isRTL ? { left: "0.75rem" } : { right: "0.75rem" }}
      >
        {isRTL ? "قريباً" : "Soon"}
      </span>
    </div>
  );
}
