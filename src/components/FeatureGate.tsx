import type { ReactNode } from "react";

import { UpgradeCard } from "@/components/billing/UpgradeCard";
import { useEntitlements } from "@/hooks/useEntitlements";

interface Props {
  feature?: string;
  flag?: string;
  /** Shown when `feature` is not available. Defaults to an upgrade card; pass `null` to hide. */
  fallback?: ReactNode;
  children: ReactNode;
}

export function FeatureGate({ feature, flag, fallback, children }: Props) {
  const ents = useEntitlements();
  // The API enforces entitlements itself, so a failed fetch must not lock a
  // paying merchant out; an unreleased flag stays hidden either way.
  if (!ents.ready) return ents.failed && !flag ? <>{children}</> : null;
  if (flag && !ents.flag(flag)) return null;
  if (feature && !ents.has(feature)) {
    return <>{fallback === undefined ? <UpgradeCard feature={feature} /> : fallback}</>;
  }
  return <>{children}</>;
}
