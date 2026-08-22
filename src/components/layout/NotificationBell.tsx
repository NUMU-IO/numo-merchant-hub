import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, CheckCheck, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  type NotificationItem,
} from "@/services/notificationsApi";
import {
  invalidateNotificationQueries,
  notificationKeys,
  useUnreadCounts,
} from "@/hooks/useUnreadNotifications";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { NotificationTabs } from "@/components/notifications/NotificationTabs";
import { tabToFilter, type NotificationTab } from "@/lib/notifications/tabs";
import { cn } from "@/lib/utils";

const DROPDOWN_LIMIT = 12;

interface Props {
  /** Extra classes for the trigger (the header passes its on-navy styles). */
  className?: string;
}

/**
 * Header bell → Zid-style dropdown: title + "Mark all as read", category
 * pills, the latest rows, "View all" footer. Opening a row marks it read
 * and follows its deep link.
 */
export function NotificationBell({ className }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificationTab>("all");

  const { data: counts } = useUnreadCounts(storeId);
  const unread = counts?.total ?? 0;

  const filter = { ...tabToFilter(tab), limit: DROPDOWN_LIMIT };
  const listQuery = useQuery({
    queryKey: notificationKeys.list(storeId, filter),
    queryFn: () => listNotifications(storeId!, filter),
    enabled: !!storeId && open,
    staleTime: 15_000,
  });

  const invalidate = () => invalidateNotificationQueries(qc, storeId);

  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(storeId!),
    onSuccess: invalidate,
  });

  const openItem = async (item: NotificationItem) => {
    setOpen(false);
    if (!item.is_read && storeId) {
      // Optimistic: flip the row + decrement the badge before the roundtrip.
      qc.setQueryData(notificationKeys.list(storeId, filter), (prev: typeof listQuery.data) =>
        prev
          ? { ...prev, items: prev.items.map((i) => (i.id === item.id ? { ...i, is_read: true } : i)) }
          : prev,
      );
      markNotificationsRead(storeId, [item.id]).finally(invalidate);
    }
    if (item.link) navigate(item.link);
  };

  const items = listQuery.data?.items ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
            className,
          )}
          aria-label={
            unread > 0
              ? t("notifications.ariaUnread", { count: unread })
              : t("notifications.title")
          }
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Bell className="h-[19px] w-[19px]" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[hsl(var(--topbar))]">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(94vw,440px)] overflow-hidden rounded-2xl border-border p-0 shadow-depth-navy"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
          <h2 className="text-[15px] font-extrabold tracking-tight">
            {t("notifications.title")}
          </h2>
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={unread === 0 || markAll.isPending}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-navy hover:underline disabled:text-muted-foreground disabled:no-underline dark:text-saffron"
          >
            {markAll.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            {t("notifications.markAllRead")}
          </button>
        </div>

        <div className="px-3 pb-2">
          <NotificationTabs value={tab} onChange={setTab} counts={counts} />
        </div>

        {/* List */}
        <div className="max-h-[min(60vh,420px)] overflow-y-auto border-t border-border/70">
          {listQuery.isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : listQuery.isError ? (
            <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              {t("notifications.loadFailed")}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <span className="ichip ichip-saffron mb-3 h-12 w-12 rounded-2xl">
                <BellOff className="!h-5 !w-5" />
              </span>
              <p className="text-[13px] font-bold">{t("notifications.empty")}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {t("notifications.emptyBody")}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((item) => (
                <li key={item.id}>
                  <NotificationRow item={item} onOpen={openItem} compact />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            navigate("/notifications");
          }}
          className="block w-full border-t border-border/70 bg-muted/40 py-2.5 text-center text-[12px] font-bold text-navy hover:bg-muted/70 dark:text-saffron"
        >
          {t("notifications.viewAll")}
        </button>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBell;
