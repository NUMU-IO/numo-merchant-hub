import { useTranslation } from "react-i18next";
import { AlertTriangle, CreditCard, ShoppingBag, ShoppingCart, Truck } from "lucide-react";
import type { NotificationItem } from "@/services/notificationsApi";
import {
  formatTimeAgo,
  renderNotification,
  type NotificationIcon,
} from "@/lib/notifications/render";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationIcon, typeof ShoppingCart> = {
  order: ShoppingCart,
  cart: ShoppingBag,
  payment: CreditCard,
  shipment: Truck,
  alert: AlertTriangle,
};

const TONE_CHIP = {
  navy: "ichip-navy",
  saffron: "ichip-saffron",
  sage: "ichip-sage",
  terra: "ichip-terra",
} as const;

interface Props {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
  /** Compact = bell dropdown; default = full page. */
  compact?: boolean;
}

/**
 * One feed row — Zid layout: icon tile, bold title with the customer
 * name emphasised, muted body, time on the end, unread dot under the tile.
 */
export function NotificationRow({ item, onOpen, compact }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const r = renderNotification(item, t, language === "ar" ? "ar" : "en");
  const Icon = ICONS[r.icon];

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        "group flex w-full items-start gap-3 text-start transition-colors",
        compact ? "px-4 py-3" : "px-4 py-3.5 sm:px-5",
        "hover:bg-muted/60 focus-visible:outline-none focus-visible:bg-muted/60",
        !item.is_read && "bg-saffron-100/25 dark:bg-saffron/5",
      )}
      aria-label={r.title.map((s) => s.text).join("")}
    >
      <span className="relative shrink-0">
        <span className={cn("ichip", TONE_CHIP[r.tone], "h-10 w-10 rounded-xl")}>
          <Icon className="!h-[18px] !w-[18px]" />
        </span>
        {!item.is_read && (
          <span
            className="absolute -bottom-0.5 -start-0.5 h-2.5 w-2.5 rounded-full bg-saffron ring-2 ring-card"
            aria-hidden
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[13px] leading-snug",
            item.is_read ? "font-semibold text-foreground/85" : "font-bold text-foreground",
          )}
        >
          {r.title.map((seg, i) =>
            seg.em ? (
              <span key={i} className="text-navy dark:text-saffron">
                {seg.text}
              </span>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </span>
        {r.body && (
          <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
            {r.body}
          </span>
        )}
      </span>
      <span className="shrink-0 ps-2 pt-0.5 text-[11px] tabular-nums text-muted-foreground/80 whitespace-nowrap">
        {formatTimeAgo(item.created_at, t)}
      </span>
    </button>
  );
}
