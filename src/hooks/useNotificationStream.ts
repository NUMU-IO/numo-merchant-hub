/**
 * Realtime notification stream.
 *
 * Subscribes to `GET /stores/{id}/notifications/stream` (SSE, relayed from
 * the API's Redis publish after each feed row commits) and invalidates the
 * notification queries on every event, so the bell badge, dropdown, page
 * and favicon badge update within a second instead of on the 45 s poll.
 * Important rows also raise a toast. The poll stays as the fallback.
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useSSE } from "@/hooks/useSSE";
import { invalidateNotificationQueries } from "@/hooks/useUnreadNotifications";

export interface NotificationStreamEvent {
  type: "connected" | "tick" | "notification";
  id?: string;
  category?: string;
  kind?: string;
  important?: boolean;
  link?: string | null;
}

export function getNotificationStreamUrl(storeId: string): string {
  // Same base apiClient uses (VITE_API_URL already ends in /api/v1).
  const base = import.meta.env.VITE_API_URL || "/api/v1";
  return `${base}/stores/${storeId}/notifications/stream`;
}

export function useNotificationStream(storeId: string | undefined) {
  const qc = useQueryClient();
  const { t } = useTranslation();

  const onMessage = useCallback(
    (ev: NotificationStreamEvent) => {
      if (ev.type === "connected") return;
      void invalidateNotificationQueries(qc, storeId);
      if (ev.type === "notification" && ev.important) {
        toast(t("notifications.importantToast"), {
          description: t(`notifications.kindShort.${(ev.kind ?? "").replace(".", "_")}`, {
            defaultValue: "",
          }),
          action: ev.link
            ? { label: t("notifications.open"), onClick: () => window.location.assign(ev.link!) }
            : undefined,
        });
      }
    },
    [qc, storeId, t],
  );

  return useSSE<NotificationStreamEvent>({
    url: storeId ? getNotificationStreamUrl(storeId) : "",
    enabled: !!storeId,
    onMessage,
    reconnectInterval: 5000,
  });
}
