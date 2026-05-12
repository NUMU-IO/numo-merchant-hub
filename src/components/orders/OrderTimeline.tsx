import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Package,
  RotateCcw,
  Truck,
  XCircle,
} from "lucide-react";
import { showError } from "@/lib/show-error";
import {
  addOrderComment,
  getOrderTimeline,
  listOrderActivities,
  type OrderActivity,
  type PaginatedActivities,
  type TimelineEvent,
} from "@/services/orderApi";
import { initialsFromName } from "./_shared";

interface Props {
  storeId: string;
  orderId: string;
}

/**
 * Merged system-event timeline + staff comments thread.
 *
 * Two queries run in parallel:
 *   - `/orders/{id}/timeline`  → lightweight events derived from order timestamps
 *   - `/orders/{id}/activities` → persisted rows (comments + future system events)
 *
 * The frontend merges by `created_at` so comments interleave with status
 * transitions chronologically, the way Shopify does.
 */
export function OrderTimeline({ storeId, orderId }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState("");

  const timelineQuery = useQuery({
    queryKey: ["order-timeline", storeId, orderId],
    queryFn: () => getOrderTimeline(storeId, orderId),
  });

  const activitiesQuery = useQuery({
    queryKey: ["order-activities", storeId, orderId],
    queryFn: () => listOrderActivities(storeId, orderId),
  });

  const addComment = useMutation({
    mutationFn: (content: string) =>
      addOrderComment(storeId, orderId, content),
    onMutate: async (content) => {
      const key = ["order-activities", storeId, orderId];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<PaginatedActivities>(key);
      const optimistic: OrderActivity = {
        id: `temp-${Date.now()}`,
        order_id: orderId,
        kind: "comment",
        event_type: "comment",
        body: content,
        user_id: user?.id ?? null,
        user_name: user?.full_name ?? null,
        user_avatar_url: user?.avatar_url ?? null,
        metadata: null,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<PaginatedActivities>(key, (old) => ({
        items: [optimistic, ...(old?.items ?? [])],
        total: (old?.total ?? 0) + 1,
        page: 1,
        page_size: old?.page_size ?? 50,
      }));
      return { prev };
    },
    onError: (err, _content, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(
          ["order-activities", storeId, orderId],
          ctx.prev,
        );
      }
      showError(err, language);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["order-activities", storeId, orderId],
      });
    },
    onSuccess: () => setDraft(""),
  });

  const merged = useMemo(() => {
    const events = (timelineQuery.data?.events ?? []).map((e: TimelineEvent) => ({
      kind: "system" as const,
      created_at: e.timestamp,
      status: e.status,
      description: e.description,
    }));
    const activities = (activitiesQuery.data?.items ?? []).map((a) => ({
      kind: "activity" as const,
      created_at: a.created_at,
      activity: a,
    }));
    const all = [...events, ...activities];
    all.sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
    return all;
  }, [timelineQuery.data, activitiesQuery.data]);

  const handleSubmit = () => {
    const content = draft.trim();
    if (!content) return;
    addComment.mutate(content);
  };

  const dateLocale = language === "ar" ? "ar-EG" : "en-US";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("orders.timeline")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comment composer (matches the Shopify screenshot's layout) */}
        <div className="flex items-start gap-3 pb-3 border-b">
          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              initialsFromName(user?.full_name)
            )}
          </div>
          <div className="flex-1 space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("orders.commentPlaceholder")}
              className="min-h-[60px] text-sm resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                {t("orders.commentHint")}
              </p>
              <Button
                size="sm"
                disabled={!draft.trim() || addComment.isPending}
                onClick={handleSubmit}
              >
                {addComment.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin me-1.5" />
                )}
                {t("orders.postComment")}
              </Button>
            </div>
          </div>
        </div>

        {/* Merged event + comment list */}
        <div className="space-y-3">
          {merged.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {language === "ar" ? "لا توجد أحداث بعد" : "No events yet"}
            </p>
          ) : (
            merged.map((entry, i) =>
              entry.kind === "system" ? (
                <SystemEventRow
                  key={`s-${i}`}
                  status={entry.status}
                  description={entry.description}
                  timestamp={entry.created_at}
                  dateLocale={dateLocale}
                />
              ) : (
                <ActivityRow
                  key={entry.activity.id}
                  activity={entry.activity}
                  dateLocale={dateLocale}
                />
              ),
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const SYSTEM_EVENT_ICONS: Record<string, React.ReactNode> = {
  pending: <Circle className="h-4 w-4" />,
  processing: <Clock className="h-4 w-4" />,
  shipped: <Truck className="h-4 w-4" />,
  delivered: <CheckCircle2 className="h-4 w-4" />,
  fulfilled: <CheckCircle2 className="h-4 w-4" />,
  cancelled: <XCircle className="h-4 w-4" />,
  returned: <RotateCcw className="h-4 w-4" />,
  paid: <CheckCircle2 className="h-4 w-4" />,
  refunded: <XCircle className="h-4 w-4" />,
};

function SystemEventRow({
  status,
  description,
  timestamp,
  dateLocale,
}: {
  status: string;
  description: string;
  timestamp: string;
  dateLocale: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">
        {SYSTEM_EVENT_ICONS[status] || <Package className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{description}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(timestamp).toLocaleString(dateLocale)}
        </p>
      </div>
    </div>
  );
}

function ActivityRow({
  activity,
  dateLocale,
}: {
  activity: OrderActivity;
  dateLocale: string;
}) {
  if (activity.kind === "system_event") {
    return (
      <SystemEventRow
        status={activity.event_type || "pending"}
        description={activity.body}
        timestamp={activity.created_at}
        dateLocale={dateLocale}
      />
    );
  }
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-semibold shrink-0">
        {activity.user_avatar_url ? (
          <img
            src={activity.user_avatar_url}
            alt={activity.user_name || ""}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          initialsFromName(activity.user_name)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">
            {activity.user_name || "Staff"}
          </span>{" "}
          <span className="whitespace-pre-wrap text-muted-foreground">
            {activity.body}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(activity.created_at).toLocaleString(dateLocale)}
        </p>
      </div>
    </div>
  );
}
