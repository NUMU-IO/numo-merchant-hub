import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, CheckCheck, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { useLanguage } from "@/contexts/LanguageContext";
import { partnerPath } from "@/lib/partner-host";
import { formatMoney } from "@/lib/format-money";
import type { RenderedNotification } from "@/lib/notifications/render";
import type { NotificationItem } from "@/services/notificationsApi";
import {
  listPartnerNotifications,
  markPartnerNotificationsRead,
  type PartnerNotification,
} from "@/services/partnersApi";

const KEY = ["partners", "notifications"];

type Bi = { ar?: string; en?: string };

function asItem(n: PartnerNotification): NotificationItem {
  return {
    id: n.id,
    category: "system",
    kind: n.kind,
    data: n.data,
    link: n.link,
    entity_type: null,
    entity_id: n.app_id,
    is_important: n.kind === "platform_notice" && n.data.notice_kind === "deprecation",
    is_read: Boolean(n.read_at),
    created_at: n.created_at,
  };
}

function render(item: NotificationItem, t: TFunction, lang: "ar" | "en"): RenderedNotification {
  const d = item.data as Record<string, unknown>;
  const pick = (v: unknown) => ((v as Bi | undefined)?.[lang] ?? (v as Bi | undefined)?.en ?? "") as string;
  switch (item.kind) {
    case "review_status": {
      const status = String(d.status);
      const bad = ["changes_requested", "rejected", "suspended"].includes(status);
      return {
        title: [
          { text: String(d.app_name ?? ""), em: true },
          { text: ` · ${t(`partnerNotifications.status.${status}`)}` },
        ],
        body: t(`partnerNotifications.subject.${d.subject === "listing" ? "listing" : "version"}`, {
          version: d.version ?? "",
        }),
        icon: "request",
        tone: bad ? "terra" : status === "approved" || status === "published" ? "sage" : "navy",
      };
    }
    case "payout_recorded":
      return {
        title: [{ text: t("partnerNotifications.payoutTitle") }],
        body: t("partnerNotifications.payoutBody", {
          amount: formatMoney(Number(d.amount_cents ?? 0), { fromCents: true, currency: String(d.currency ?? "EGP"), locale: lang }),
          reference: d.reference ?? "",
        }),
        icon: "payment",
        tone: "sage",
      };
    case "platform_notice":
      return {
        title: [
          { text: t(`partnerNotifications.notice.${d.notice_kind === "deprecation" ? "deprecation" : "changelog"}`) + " · " },
          { text: pick(d.title), em: true },
        ],
        body: pick(d.body),
        icon: "alert",
        tone: d.notice_kind === "deprecation" ? "terra" : "saffron",
      };
    case "subscription_past_due":
      return {
        title: [{ text: String(d.app_name ?? ""), em: true }, { text: ` · ${t("partnerNotifications.pastDue")}` }],
        body: t("partnerNotifications.pastDueBody"),
        icon: "payment",
        tone: "terra",
      };
    default:
      return { title: [{ text: item.kind }], body: "", icon: "alert", tone: "navy" };
  }
}

function usePartnerFeed(limit: number, enabled = true, unread = false) {
  return useQuery({
    queryKey: [...KEY, limit, unread],
    queryFn: () => listPartnerNotifications({ limit, unread: unread || undefined }),
    enabled,
    refetchInterval: 60_000,
  });
}

function useOpen(close?: () => void) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const markAll = useMutation({
    mutationFn: () => markPartnerNotificationsRead(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
  const open = (item: NotificationItem) => {
    close?.();
    if (!item.is_read) markPartnerNotificationsRead([item.id]).finally(() => void qc.invalidateQueries({ queryKey: KEY }));
    if (item.link) navigate(partnerPath(item.link));
  };
  return { open, markAll };
}

function Empty() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="ichip ichip-saffron mb-3 h-12 w-12 rounded-2xl">
        <BellOff className="!h-5 !w-5" />
      </span>
      <p className="text-[13px] font-bold">{t("notifications.empty")}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">{t("partnerNotifications.emptyBody")}</p>
    </div>
  );
}

function List({ items, onOpen, compact }: { items: PartnerNotification[]; onOpen: (i: NotificationItem) => void; compact?: boolean }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const lang = language === "ar" ? "ar" : "en";
  return (
    <ul className="divide-y divide-border/60">
      {items.map((n) => (
        <li key={n.id}>
          <NotificationRow item={asItem(n)} onOpen={onOpen} compact={compact} render={(i) => render(i, t, lang)} />
        </li>
      ))}
    </ul>
  );
}

export function PartnerNotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const feed = usePartnerFeed(12);
  const unread = feed.data?.unread_count ?? 0;
  const { open: openItem, markAll } = useOpen(() => setOpen(false));
  const items = feed.data?.items ?? [];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted"
          aria-label={unread > 0 ? t("notifications.ariaUnread", { count: unread }) : t("notifications.title")}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-[min(94vw,420px)] overflow-hidden rounded-2xl p-0">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
          <h2 className="text-[15px] font-extrabold tracking-tight">{t("notifications.title")}</h2>
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={unread === 0 || markAll.isPending}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold hover:underline disabled:text-muted-foreground disabled:no-underline"
          >
            {markAll.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            {t("notifications.markAllRead")}
          </button>
        </div>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto border-t border-border/70">
          {feed.isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : items.length === 0 ? (
            <Empty />
          ) : (
            <List items={items} onOpen={openItem} compact />
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            navigate(partnerPath("/notifications"));
          }}
          className="block w-full border-t border-border/70 bg-muted/40 py-2.5 text-center text-[12px] font-bold hover:bg-muted/70"
        >
          {t("notifications.viewAll")}
        </button>
      </PopoverContent>
    </Popover>
  );
}

export function PartnerNotificationsPage() {
  const { t } = useTranslation();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const feed = usePartnerFeed(100, true, unreadOnly);
  const { open, markAll } = useOpen();
  const items = feed.data?.items ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-extrabold tracking-tight">{t("notifications.title")}</h1>
        <Button variant={unreadOnly ? "default" : "outline"} size="sm" onClick={() => setUnreadOnly((v) => !v)}>
          {t("partnerNotifications.unreadOnly")}
        </Button>
        <Button size="sm" variant="outline" disabled={!feed.data?.unread_count || markAll.isPending} onClick={() => markAll.mutate()}>
          <CheckCheck className="me-1 h-4 w-4" />
          {t("notifications.markAllRead")}
        </Button>
      </div>
      <Card className="overflow-hidden">
        {feed.isLoading ? (
          <div className="p-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Empty />
        ) : (
          <List items={items} onOpen={open} />
        )}
      </Card>
    </div>
  );
}
