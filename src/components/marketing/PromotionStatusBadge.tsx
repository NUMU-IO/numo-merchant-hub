import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PromotionStatus } from "@/services/promotionApi";

const STATUS_CLASSES: Record<PromotionStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  paused: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  expired: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  archived: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
};

interface Props {
  status: PromotionStatus;
  className?: string;
}

export function PromotionStatusBadge({ status, className }: Props) {
  const { t } = useTranslation();
  return (
    <Badge
      variant="outline"
      aria-label={t(`promotions.status.${status}`)}
      className={cn(
        "font-medium border-transparent",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {t(`promotions.status.${status}`)}
    </Badge>
  );
}
