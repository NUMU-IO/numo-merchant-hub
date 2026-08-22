import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Bell, BellOff, CheckCheck, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { NotificationTabs } from "@/components/notifications/NotificationTabs";
import { NOTIFICATION_TABS, tabToFilter, type NotificationTab } from "@/lib/notifications/tabs";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  NOTIFICATION_CATEGORIES,
  updateNotificationPreferences,
  type NotificationCategory,
  type NotificationItem,
  type NotificationPreferences,
} from "@/services/notificationsApi";
import {
  invalidateNotificationQueries,
  notificationKeys,
  useUnreadCounts,
} from "@/hooks/useUnreadNotifications";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

type View = "activity" | "preferences";

export default function Notifications() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const [params, setParams] = useSearchParams();

  // URL-backed so the bell's "View all" and deep links land on a tab.
  const rawTab = params.get("tab");
  const tab: NotificationTab = (NOTIFICATION_TABS as string[]).includes(rawTab ?? "")
    ? (rawTab as NotificationTab)
    : "all";
  const view: View = params.get("view") === "preferences" ? "preferences" : "activity";
  const unreadOnly = params.get("unread") === "1";

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  const { data: counts } = useUnreadCounts(storeId);
  const unread = counts?.total ?? 0;

  const filter = useMemo(
    () => ({ ...tabToFilter(tab), unread_only: unreadOnly, limit: PAGE_SIZE }),
    [tab, unreadOnly],
  );

  const feed = useInfiniteQuery({
    queryKey: notificationKeys.list(storeId, filter),
    queryFn: ({ pageParam }) =>
      listNotifications(storeId!, { ...filter, cursor: pageParam as string | null }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!storeId && view === "activity",
    staleTime: 15_000,
  });

  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const invalidate = () => invalidateNotificationQueries(qc, storeId);

  const markAll = useMutation({
    mutationFn: () =>
      markAllNotificationsRead(storeId!, tabToFilter(tab).category as NotificationCategory | undefined),
    onSuccess: () => {
      invalidate();
      toast.success(t("notifications.markedAll"));
    },
  });

  const openItem = (item: NotificationItem) => {
    if (!item.is_read && storeId) {
      markNotificationsRead(storeId, [item.id]).finally(invalidate);
    }
    if (item.link) navigate(item.link);
  };

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <Badge variant="accent" className="text-[11px]">
                {t("notifications.newCount", { count: unread })}
              </Badge>
            )}
            <div className="flex gap-0.5 rounded-lg bg-muted/60 p-0.5">
              <Button
                variant={view === "activity" ? "default" : "ghost"}
                size="sm"
                className="h-8 gap-1.5 rounded-md px-3 text-xs"
                onClick={() => setParam("view", null)}
              >
                <Bell className="h-3.5 w-3.5" />
                {t("notifications.activity")}
              </Button>
              <Button
                variant={view === "preferences" ? "default" : "ghost"}
                size="sm"
                className="h-8 gap-1.5 rounded-md px-3 text-xs"
                onClick={() => setParam("view", "preferences")}
              >
                <Settings2 className="h-3.5 w-3.5" />
                {t("notifications.preferences")}
              </Button>
            </div>
          </div>
        }
      />

      {view === "preferences" ? (
        <PreferencesView storeId={storeId} />
      ) : (
        <Card className="overflow-hidden rounded-2xl">
          <div className="flex flex-col gap-3 border-b border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
            <NotificationTabs
              value={tab}
              onChange={(next) => setParam("tab", next === "all" ? null : next)}
              counts={counts}
              className="sm:max-w-[calc(100%-260px)]"
            />
            <div className="flex items-center gap-2 ps-1">
              <button
                type="button"
                onClick={() => setParam("unread", unreadOnly ? null : "1")}
                className={cn(
                  "h-8 rounded-lg border px-3 text-[12px] font-semibold transition-colors",
                  unreadOnly
                    ? "border-navy bg-navy text-white dark:border-saffron dark:bg-saffron dark:text-navy-900"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={unreadOnly}
              >
                {t("notifications.unreadOnly")}
              </button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-lg text-[12px]"
                onClick={() => markAll.mutate()}
                disabled={unread === 0 || markAll.isPending}
              >
                {markAll.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" />
                )}
                {t("notifications.markAllRead")}
              </Button>
            </div>
          </div>

          {feed.isLoading ? (
            <div className="space-y-4 p-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : feed.isError ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {t("notifications.loadFailed")}
            </div>
          ) : items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={BellOff}
                title={unreadOnly ? t("notifications.emptyUnread") : t("notifications.empty")}
                description={t("notifications.emptyBody")}
              />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border/60">
                {items.map((item) => (
                  <li key={item.id}>
                    <NotificationRow item={item} onOpen={openItem} />
                  </li>
                ))}
              </ul>
              {feed.hasNextPage && (
                <div className="border-t border-border/70 p-3 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[12px] font-bold text-navy dark:text-saffron"
                    onClick={() => feed.fetchNextPage()}
                    disabled={feed.isFetchingNextPage}
                  >
                    {feed.isFetchingNextPage ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      t("notifications.loadMore")
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}

/* ── Preferences ───────────────────────────────────────────────────── */

function PreferencesView({ storeId }: { storeId: string | undefined }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const prefsQuery = useQuery({
    queryKey: notificationKeys.prefs(storeId),
    queryFn: () => getNotificationPreferences(storeId!),
    enabled: !!storeId,
  });

  const update = useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      updateNotificationPreferences(storeId!, patch),
    onMutate: (patch) => {
      setPending(Object.keys(patch)[0] ?? null);
      const prev = qc.getQueryData<NotificationPreferences>(notificationKeys.prefs(storeId));
      if (prev) qc.setQueryData(notificationKeys.prefs(storeId), { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(notificationKeys.prefs(storeId), ctx.prev);
      toast.error(t("notifications.prefs.saveFailed"));
    },
    onSuccess: (data) => {
      qc.setQueryData(notificationKeys.prefs(storeId), data);
      toast.success(t("notifications.prefs.saved"));
    },
    onSettled: () => setPending(null),
  });

  const prefs = prefsQuery.data;
  const muted = new Set(prefs?.muted_categories ?? []);

  const toggleCategory = (cat: NotificationCategory, enabled: boolean) => {
    const next = new Set(muted);
    if (enabled) next.delete(cat);
    else next.add(cat);
    update.mutate({ muted_categories: [...next] });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">{t("notifications.prefs.categories")}</CardTitle>
          <CardDescription>{t("notifications.prefs.categoriesHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {prefsQuery.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          ) : (
            NOTIFICATION_CATEGORIES.map((cat) => (
              <div
                key={cat}
                className="flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-muted/50"
              >
                <Label htmlFor={`cat-${cat}`} className="cursor-pointer text-sm font-semibold">
                  {t(`notifications.tabs.${cat}`)}
                </Label>
                <Switch
                  id={`cat-${cat}`}
                  checked={!muted.has(cat)}
                  disabled={!prefs || pending === "muted_categories"}
                  onCheckedChange={(v) => toggleCategory(cat, v)}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">{t("notifications.prefs.channels")}</CardTitle>
            <CardDescription>{t("notifications.prefs.channelsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-muted/50">
              <div>
                <Label htmlFor="email-new-order" className="cursor-pointer text-sm font-semibold">
                  {t("notifications.prefs.emailNewOrder")}
                </Label>
                <p className="text-[12px] text-muted-foreground">
                  {t("notifications.prefs.emailNewOrderHint")}
                </p>
              </div>
              <Switch
                id="email-new-order"
                checked={prefs?.email_new_order ?? true}
                disabled={!prefs || pending === "email_new_order"}
                onCheckedChange={(v) => update.mutate({ email_new_order: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-muted/50">
              <div>
                <Label htmlFor="push-new-order" className="cursor-pointer text-sm font-semibold">
                  {t("notifications.prefs.pushNewOrder")}
                </Label>
                <p className="text-[12px] text-muted-foreground">
                  {t("notifications.prefs.pushNewOrderHint")}
                </p>
              </div>
              <Switch
                id="push-new-order"
                checked={prefs?.push_new_order ?? true}
                disabled={!prefs || pending === "push_new_order"}
                onCheckedChange={(v) => update.mutate({ push_new_order: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-muted/50">
              <div>
                <Label htmlFor="push-important" className="cursor-pointer text-sm font-semibold">
                  {t("notifications.prefs.pushImportant")}
                </Label>
                <p className="text-[12px] text-muted-foreground">
                  {t("notifications.prefs.pushImportantHint")}
                </p>
              </div>
              <Switch
                id="push-important"
                checked={prefs?.push_important ?? true}
                disabled={!prefs || pending === "push_important"}
                onCheckedChange={(v) => update.mutate({ push_important: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-muted/50">
              <div>
                <Label htmlFor="push-rich" className="cursor-pointer text-sm font-semibold">
                  {t("notifications.prefs.pushRichDetails")}
                </Label>
                <p className="text-[12px] text-muted-foreground">
                  {t("notifications.prefs.pushRichDetailsHint")}
                </p>
              </div>
              <Switch
                id="push-rich"
                checked={prefs?.push_rich_details ?? true}
                disabled={!prefs || pending === "push_rich_details"}
                onCheckedChange={(v) => update.mutate({ push_rich_details: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-muted/50">
              <div>
                <Label htmlFor="email-important" className="cursor-pointer text-sm font-semibold">
                  {t("notifications.prefs.emailImportant")}
                </Label>
                <p className="text-[12px] text-muted-foreground">
                  {t("notifications.prefs.emailImportantHint")}
                </p>
              </div>
              <Switch
                id="email-important"
                checked={prefs?.email_important ?? true}
                disabled={!prefs || pending === "email_important"}
                onCheckedChange={(v) => update.mutate({ email_important: v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Device push subscription + new-order sound (existing component). */}
        <NotificationSettings />
      </div>
    </div>
  );
}
