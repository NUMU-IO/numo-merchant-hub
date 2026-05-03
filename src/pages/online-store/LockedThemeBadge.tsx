/**
 * Lock badge overlaid on themes the merchant can't activate at their
 * current plan tier. Pure presentational — gating logic lives in
 * ``canUnlockTheme`` and the parent decides whether to render this.
 */

import { Badge } from "@/components/ui/badge";
import { tierLabel, tierLabelAr, type Tier } from "@/lib/themePlan";
import { Lock } from "lucide-react";

interface Props {
  requiredPlan: Tier | undefined;
  isRTL: boolean;
  className?: string;
}

export function LockedThemeBadge({ requiredPlan, isRTL, className }: Props) {
  const label = isRTL
    ? `تتطلب ${tierLabelAr(requiredPlan)}`
    : `Requires ${tierLabel(requiredPlan)}`;
  return (
    <Badge
      variant="secondary"
      className={`gap-1 bg-foreground/85 text-background border-0 backdrop-blur-sm ${className ?? ""}`}
    >
      <Lock className="w-3 h-3" />
      <span className="text-[10px] font-medium tracking-wide uppercase">
        {label}
      </span>
    </Badge>
  );
}
