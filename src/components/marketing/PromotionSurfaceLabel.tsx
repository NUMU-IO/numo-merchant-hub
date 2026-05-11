import { useTranslation } from "react-i18next";
import {
  Megaphone,
  MessageSquare,
  Percent,
  Shield,
  Sparkles,
  Tag,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { PromotionSurface } from "@/services/promotionApi";

const ICONS: Record<PromotionSurface, typeof Tag> = {
  discount_code: Tag,
  automatic: Sparkles,
  announcement_bar: Megaphone,
  popup: MessageSquare,
  floating_widget: Percent,
  cookie_banner: Shield,
};

interface Props {
  surface: PromotionSurface;
  className?: string;
  iconOnly?: boolean;
}

export function PromotionSurfaceLabel({ surface, className, iconOnly }: Props) {
  const { t } = useTranslation();
  const Icon = ICONS[surface];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-muted-foreground",
        className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {!iconOnly && <span>{t(`promotions.surface.${surface}`)}</span>}
    </span>
  );
}
