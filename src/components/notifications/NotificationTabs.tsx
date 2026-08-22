import { useTranslation } from "react-i18next";
import type { UnreadCounts } from "@/services/notificationsApi";
import { NOTIFICATION_TABS, tabUnread, type NotificationTab } from "@/lib/notifications/tabs";
import { cn } from "@/lib/utils";

interface Props {
  value: NotificationTab;
  onChange: (tab: NotificationTab) => void;
  counts?: UnreadCounts;
  className?: string;
}

/** Zid-style pill row: All · Important · Orders · Abandoned carts … */
export function NotificationTabs({ value, onChange, counts, className }: Props) {
  const { t } = useTranslation();
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {NOTIFICATION_TABS.map((tab) => {
        const active = tab === value;
        const n = tabUnread(tab, counts);
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab)}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition-colors whitespace-nowrap",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`notifications.tabs.${tab}`)}
            {n > 0 && (
              <span
                className={cn(
                  "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                  active ? "bg-navy text-white dark:bg-saffron dark:text-navy-900" : "bg-muted-foreground/15 text-muted-foreground",
                )}
              >
                {n > 99 ? "99+" : n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
