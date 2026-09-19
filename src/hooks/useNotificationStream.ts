/**
 * Realtime notification stream.
 *
 * Subscribes to `GET /stores/{id}/notifications/stream` (SSE, relayed from
 * the API's Redis publish after each feed row commits) and invalidates the
 * notification queries on every event, so the bell badge, dropdown, page
 * and favicon badge update within a second instead of on the 45 s poll.
 * Important rows also raise a toast. The poll stays as the fallback.
 */

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useSSE } from "@/hooks/useSSE";
import { invalidateNotificationQueries } from "@/hooks/useUnreadNotifications";
import { recentOrdersQuery } from "@/services/orderApi";

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
  // The API sends `tick` frames only when it has no Redis to relay events
  // from. Such a stream carries no news, so the polls stay on.
  const [ticking, setTicking] = useState(false);

  const onMessage = useCallback(
    (ev: NotificationStreamEvent) => {
      if (ev.type === "tick") {
        setTicking(true);
        return;
      }
      if (ev.type !== "notification") return;
      void invalidateNotificationQueries(qc, storeId);
      if (storeId && ev.category === "orders") {
        void qc.invalidateQueries({ queryKey: recentOrdersQuery(storeId).queryKey });
      }
      if (ev.important) {
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

  const sse = useSSE<NotificationStreamEvent>({
    url: storeId ? getNotificationStreamUrl(storeId) : "",
    enabled: !!storeId,
    onMessage,
    reconnectInterval: 5000,
  });

  return { ...sse, live: sse.connected && !ticking };
}
