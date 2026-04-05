import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Users, Monitor, Smartphone, Tablet, Globe,
  ShoppingCart, Timer, ArrowLeft, MousePointerClick,
} from "lucide-react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getSessions, getSessionDetail } from "@/services/analyticsApi";
import { SessionTimeline } from "@/components/analytics/SessionTimeline";
import { useState } from "react";

interface JourneyReplayTabProps {
  period: number;
  formatCurrency: (cents: number) => string;
}

const FUNNEL_LABELS: Record<string, { en: string; ar: string }> = {
  page_view: { en: "Browsed", ar: "تصفح" },
  product_view: { en: "Viewed product", ar: "شاف منتج" },
  add_to_cart: { en: "Added to cart", ar: "أضاف للسلة" },
  checkout_started: { en: "Started checkout", ar: "بدأ الدفع" },
  order_completed: { en: "Completed order", ar: "أكمل الطلب" },
  order_delivered: { en: "Delivered", ar: "تم التسليم" },
};

const DEVICE_ICONS: Record<string, typeof Monitor> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  unknown: Globe,
};

function formatDuration(seconds: number, isAr: boolean): string {
  if (seconds < 60) return `${seconds}${isAr ? "ث" : "s"}`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}${isAr ? "د" : "m"} ${s}${isAr ? "ث" : "s"}`;
  const h = Math.floor(m / 60);
  return `${h}${isAr ? "س" : "h"} ${m % 60}${isAr ? "د" : "m"}`;
}

type DeviceFilter = "" | "desktop" | "mobile" | "tablet";

export function JourneyReplayTab({ period, formatCurrency }: JourneyReplayTabProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const [hasOrder, setHasOrder] = useState(false);
  const [minPages, setMinPages] = useState(1);
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>("");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const days = Math.min(period, 30); // Sessions max 30 days

  const sessionsQuery = useQuery({
    queryKey: ["analytics", "sessions", storeId, days, hasOrder, minPages, deviceFilter],
    queryFn: () => getSessions(storeId!, days, hasOrder, minPages, deviceFilter),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const detailQuery = useQuery({
    queryKey: ["analytics", "session-detail", storeId, selectedSession],
    queryFn: () => getSessionDetail(storeId!, selectedSession!),
    enabled: !!storeId && !!selectedSession,
  });

  const data = sessionsQuery.data ?? null;
  const detail = detailQuery.data ?? null;

  // If viewing a session detail
  if (selectedSession) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-[12px]"
          onClick={() => setSelectedSession(null)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {isAr ? "رجوع للجلسات" : "Back to sessions"}
        </Button>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "مسار الجلسة" : "Session Journey"}
            </CardTitle>
            {detail && (
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                {(() => {
                  const DevIcon = DEVICE_ICONS[detail.device_type] || Globe;
                  return <DevIcon className="h-3 w-3" />;
                })()}
                <span className="capitalize">{detail.device_type}</span>
                <span>•</span>
                <span>{detail.page_count} {isAr ? "صفحة" : "pages"}</span>
                <span>•</span>
                <span>{formatDuration(detail.duration_seconds, isAr)}</span>
                {detail.referrer && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[200px]">{detail.referrer}</span>
                  </>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {detail ? (
              <SessionTimeline timeline={detail.timeline} formatCurrency={formatCurrency} />
            ) : detailQuery.isLoading ? (
              <div className="py-8 text-center text-[12px] text-muted-foreground">
                {isAr ? "جاري التحميل..." : "Loading..."}
              </div>
            ) : (
              <EmptyState icon={MousePointerClick} title={isAr ? "مفيش بيانات" : "No data"} />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overview KPIs */}
      {data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "إجمالي الجلسات" : "Total Sessions"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
                  <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {data.overview.total_sessions.toLocaleString(isAr ? "ar-EG" : undefined)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "متوسط المدة" : "Avg Duration"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10">
                  <Timer className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {formatDuration(data.overview.avg_duration_seconds, isAr)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "معدل الارتداد" : "Bounce Rate"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                  <Globe className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${data.overview.bounce_rate > 60 ? "text-destructive" : ""}`}>
                {data.overview.bounce_rate}%
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "جلسات بطلبات" : "Sessions with Orders"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
                  <ShoppingCart className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {data.overview.sessions_with_order_pct}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={hasOrder ? "default" : "outline"}
          size="sm"
          className="h-7 text-[11px] rounded-md"
          onClick={() => setHasOrder(!hasOrder)}
        >
          <ShoppingCart className="h-3 w-3 mr-1" />
          {isAr ? "بطلبات فقط" : "With orders"}
        </Button>

        <div className="flex gap-0.5 rounded-lg bg-muted/60 p-0.5">
          {(["", "desktop", "mobile", "tablet"] as DeviceFilter[]).map((d) => (
            <Button
              key={d}
              variant={deviceFilter === d ? "default" : "ghost"}
              size="sm"
              className={`h-6 text-[10px] px-2 rounded-md ${deviceFilter === d ? "" : "text-muted-foreground"}`}
              onClick={() => setDeviceFilter(d)}
            >
              {d === "" ? (isAr ? "الكل" : "All") : d === "desktop" ? "Desktop" : d === "mobile" ? "Mobile" : "Tablet"}
            </Button>
          ))}
        </div>

        <div className="flex gap-0.5 rounded-lg bg-muted/60 p-0.5">
          {[1, 2, 5].map((mp) => (
            <Button
              key={mp}
              variant={minPages === mp ? "default" : "ghost"}
              size="sm"
              className={`h-6 text-[10px] px-2 rounded-md ${minPages === mp ? "" : "text-muted-foreground"}`}
              onClick={() => setMinPages(mp)}
            >
              {mp}+ {isAr ? "صفحة" : "pages"}
            </Button>
          ))}
        </div>
      </div>

      {/* Sessions List */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
            {isAr ? "الجلسات" : "Sessions"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data && data.sessions.length > 0 ? (
            <div className="space-y-0.5">
              {data.sessions.map((session) => {
                const DevIcon = DEVICE_ICONS[session.device_type] || Globe;
                const funnelLabel = FUNNEL_LABELS[session.funnel_reached || "page_view"] || FUNNEL_LABELS.page_view;

                return (
                  <button
                    key={session.session_fingerprint}
                    className="w-full flex items-center justify-between rounded-lg p-2.5 -mx-2 hover:bg-muted/50 transition-colors text-start"
                    onClick={() => setSelectedSession(session.session_fingerprint)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <DevIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold">
                            {session.page_count} {isAr ? "صفحة" : "pages"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDuration(session.duration_seconds, isAr)}
                          </span>
                          {session.has_order && (
                            <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                              {isAr ? "طلب" : "ORDER"}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {isAr ? funnelLabel.ar : funnelLabel.en}
                          {session.referrer && ` • ${session.referrer}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {new Date(session.started_at).toLocaleString(isAr ? "ar-EG" : "en-US", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title={isAr ? "مفيش جلسات" : "No sessions found"}
              description={isAr ? "جرب تعديل الفلاتر" : "Try adjusting the filters"}
              className="py-6"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
