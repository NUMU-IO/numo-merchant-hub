/**
 * "Upgrade to unlock" CTA shown in place of the Activate button on themes
 * the merchant's plan can't currently activate. Routes to the existing
 * /billing page — there's no in-context upgrade flow.
 */

import { Button } from "@/components/ui/button";
import { tierLabel, tierLabelAr, type Tier } from "@/lib/themePlan";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  requiredPlan: Tier | undefined;
  isRTL: boolean;
  size?: "sm" | "default";
  className?: string;
}

export function UpgradeCTAButton({
  requiredPlan,
  isRTL,
  size = "default",
  className,
}: Props) {
  const navigate = useNavigate();

  const baseLabel = isRTL ? "ترقية لفتح" : "Upgrade to unlock";
  const planSuffix = requiredPlan && requiredPlan !== "free"
    ? isRTL
      ? ` (${tierLabelAr(requiredPlan)})`
      : ` (${tierLabel(requiredPlan)})`
    : "";

  return (
    <Button
      type="button"
      onClick={() => navigate("/billing")}
      size={size}
      className={`gap-2 ${className ?? ""}`}
    >
      <Sparkles className="w-4 h-4" />
      {baseLabel}
      {planSuffix}
    </Button>
  );
}
