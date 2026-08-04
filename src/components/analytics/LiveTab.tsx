import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Eye, Users, ShoppingCart, DollarSign, Radio, Wifi, WifiOff,
  TrendingUp, FileText, MapPin,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import {
  getRealtimeSnapshot, getRealtimeStreamUrl, getRealtimeGeo,
} from "@/services/analyticsApi";
import type { RealtimeSnapshot } from "@/services/analyticsApi";
import { useSSE } from "@/hooks/useSSE";
import { getActiveStoreTimezone } from "@/lib/store-timezone";
import { useState, useEffect } from "react";

interface LiveTabProps {
  formatCurrency: (cents: number) => string;
}

export function LiveTab({ formatCurrency }: LiveTabProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const snapshotQuery = useQuery({
    queryKey: ["analytics", "realtime-snapshot", storeId],
    queryFn: () => getRealtimeSnapshot(storeId!),
    enabled: !!storeId,
    refetchInterval: 30000,
  });

  // Geo is a DB query (today's orders by governorate) — polled on a
  // slower cadence than the Redis snapshot so it doesn't add DB load to
  // the 5s SSE / 30s snapshot path.
  const geoQuery = useQuery({
    queryKey: ["analytics", "realtime-geo", storeId],
    queryFn: () => getRealtimeGeo(storeId!),
    enabled: !!storeId,
    refetchInterval: 60000,
  });
  const geo = geoQuery.data ?? null;

  const streamUrl = storeId ? getRealtimeStreamUrl(storeId) : "";
  const { data: sseData, connected } = useSSE<RealtimeSnapshot>({
    url: streamUrl,
    enabled: !!storeId,
  });

  const data = sseData ?? snapshotQuery.data ?? null;

  // Track views history for sparkline — samples carry timestamps so the
  // per-minute rate is a real rate. The old version reported the raw
  // cumulative delta across the whole ~6-minute sample window labeled
  // "/min", overstating by the window length.
  const [viewsHistory, setViewsHistory] = useState<{ v: number; t: number }[]>([]);
  useEffect(() => {
    if (data) {
      setViewsHistory((prev) =>
        [...prev, { v: data.views_today, t: Date.now() }].slice(-12),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.views_today]);

  const viewsPerMinute = (() => {
    if (viewsHistory.length < 2) return 0;
    const first = viewsHistory[0];
    const last = viewsHistory[viewsHistory.length - 1];
    const minutes = (last.t - first.t) / 60_000;
    if (minutes <= 0) return 0;
    return Math.max(0, Math.round(((last.v - first.v) / minutes) * 10) / 10);
  })();

  const sparklineData = viewsHistory.length >= 2
    ? viewsHistory.map((s, i) => (i === 0 ? 0 : s.v - viewsHistory[i - 1].v)).slice(1)
    : [];

  // Derived KPIs
  const conversionRate = data && data.visitors_today > 0
    ? ((data.orders_today / data.visitors_today) * 100)
    : 0;
  const aovToday = data && data.orders_today > 0
    ? Math.round(data.revenue_today / data.orders_today)
    : 0;

  // Hourly chart data (only show hours up to current hour). The hour
  // axis follows the STORE's wall clock — the backend keys its hourly
  // Redis buckets the same way — not the browser's timezone.
  const currentHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: getActiveStoreTimezone(),
    }).format(new Date()),
  );
  const hourlyChartData = (data?.hourly_orders ?? [])
    .slice(0, currentHour + 1)
    .map((orders, h) => ({
      hour: `${h}:00`,
      orders,
      revenue: (data?.hourly_revenue ?? [])[h] ?? 0,
    }));

  return (
    <div className="space-y-4">
      {/* Connection status */}
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${connected ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
          {connected ? (
            <>
              <Wifi className="h-3 w-3" />
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              {isAr ? "متصل مباشر" : "Live"}
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              {isAr ? "غير متصل" : "Disconnected"}
            </>
          )}
        </div>
      </div>

      {/* Counter store unreachable — every figure below is a placeholder
          zero, not a measurement. Without this banner an outage is
          indistinguishable from a genuinely quiet day, and the merchant
          reads "0 visitors" as their store being dead. */}
      {data && data.available === false && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-amber-700 dark:text-amber-400">
              {isAr ? "البيانات المباشرة غير متاحة" : "Live data unavailable"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {isAr
                ? "مش قادرين نقرأ عدادات الوقت الحقيقي دلوقتي. الأرقام تحت مش دقيقة — مش معناها إن مفيش زوار."
                : "We can't read the realtime counters right now. The numbers below are placeholders, not a reading — they don't mean you have no visitors."}
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards — 6 cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {isAr ? "الزوار النشطون" : "Active Now"}
              </p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
                <Radio className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {data?.active_now ?? 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isAr ? "آخر ٥ دقائق" : "Last 5 minutes"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {isAr ? "المشاهدات اليوم" : "Views Today"}
              </p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
                <Eye className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {(data?.views_today ?? 0).toLocaleString(isAr ? "ar-EG" : undefined)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              ~{viewsPerMinute} {isAr ? "/دقيقة" : "/min"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {isAr ? "الزوار اليوم" : "Visitors Today"}
              </p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10">
                <Users className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {(data?.visitors_today ?? 0).toLocaleString(isAr ? "ar-EG" : undefined)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {isAr ? "زائر فريد" : "unique visitors"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {isAr ? "الطلبات اليوم" : "Orders Today"}
              </p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10">
                <ShoppingCart className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {(data?.orders_today ?? 0).toLocaleString(isAr ? "ar-EG" : undefined)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {isAr ? "الإيرادات اليوم" : "Revenue Today"}
              </p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                <DollarSign className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {formatCurrency(data?.revenue_today ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {isAr ? "معدل التحويل" : "Conversion Rate"}
              </p>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10">
                <TrendingUp className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {conversionRate.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              AOV: {formatCurrency(aovToday)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Velocity + Views Sparkline */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Hourly Sales Velocity */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "الطلبات بالساعة" : "Sales Velocity (Orders/Hour)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hourlyChartData.length > 0 && hourlyChartData.some((d) => d.orders > 0) ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px" }}
                      formatter={(value: number, name: string) => [
                        name === "revenue" ? formatCurrency(value) : value,
                        name === "revenue" ? (isAr ? "الإيرادات" : "Revenue") : (isAr ? "الطلبات" : "Orders"),
                      ]}
                    />
                    <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon={ShoppingCart} title={isAr ? "مفيش طلبات بعد" : "No orders yet"} className="py-6" />
            )}
          </CardContent>
        </Card>

        {/* Visitors + Sparkline */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "نشاط المشاهدات" : "View Activity"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-3xl font-bold tabular-nums">
                  {viewsPerMinute}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isAr ? "مشاهدة/دقيقة" : "views/minute"}
                </p>
              </div>
              {sparklineData.length > 2 && (
                <svg width={120} height={40}>
                  <polyline
                    points={sparklineData
                      .map((v, i) => `${(i / (sparklineData.length - 1)) * 120},${40 - (v / (Math.max(...sparklineData, 1))) * 36}`)
                      .join(" ")}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>

            {/* Hourly revenue mini chart */}
            {hourlyChartData.length > 0 && hourlyChartData.some((d) => d.revenue > 0) && (
              <div className="h-[120px] mt-2">
                <p className="text-[10px] font-medium text-muted-foreground mb-1">
                  {isAr ? "الإيرادات بالساعة" : "Hourly Revenue"}
                </p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyChartData}>
                    <XAxis
                      dataKey="hour"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8 }}
                      axisLine={false}
                      tickLine={false}
                      interval={3}
                    />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "11px" }}
                      formatter={(value: number) => [formatCurrency(value), isAr ? "الإيرادات" : "Revenue"]}
                    />
                    <Bar dataKey="revenue" fill="hsl(142 71% 45%)" radius={[2, 2, 0, 0]} opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Pages + Recent Orders */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Pages Right Now */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "أكتر الصفحات زيارة" : "Top Pages Today"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data && data.top_pages.length > 0 ? (
              <div className="space-y-0.5">
                {data.top_pages.map((page, i) => {
                  const maxViews = data.top_pages[0]?.views || 1;
                  const width = (page.views / maxViews) * 100;
                  return (
                    <div key={page.path} className="flex items-center gap-2 rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors">
                      <span className="text-[10px] font-bold text-muted-foreground/40 w-4 tabular-nums">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate font-mono">{page.path}</p>
                        <div className="h-1 bg-muted rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-primary/50 rounded-full transition-all duration-500"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold tabular-nums shrink-0">
                        {page.views.toLocaleString(isAr ? "ar-EG" : undefined)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={FileText} title={isAr ? "مفيش مشاهدات بعد" : "No views yet"} className="py-6" />
            )}
          </CardContent>
        </Card>

        {/* Live Order Feed */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "آخر الطلبات" : "Recent Orders"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data && data.recent_orders.length > 0 ? (
              <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
                {data.recent_orders.map((order, i) => (
                  <div
                    key={`${order.order_id}-${i}`}
                    className="flex items-center justify-between rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-all animate-in fade-in slide-in-from-top-1 duration-300"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold font-mono">#{order.order_number}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {order.payment_method === "cod" ? "COD" : order.payment_method}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{order.customer_name}</p>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-[13px] font-semibold tabular-nums">{formatCurrency(order.total)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {order.item_count} {isAr ? "منتج" : order.item_count === 1 ? "item" : "items"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ShoppingCart}
                title={isAr ? "مفيش طلبات النهاردة" : "No orders yet today"}
                className="py-6"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Today's orders by governorate — the geo layer for Live View.
          Real shipping-address data (not IP geo, which we don't store). */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            {isAr ? "طلبات النهاردة حسب المحافظة" : "Today's Orders by Governorate"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {geo && geo.locations.length > 0 ? (
            <div className="space-y-1.5">
              {geo.locations.slice(0, 8).map((loc) => (
                <div key={loc.location} className="flex items-center gap-3">
                  <span className="text-[12.5px] font-medium capitalize w-28 sm:w-36 shrink-0 truncate">
                    {loc.location}
                  </span>
                  <div className="flex-1 h-2.5 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-navy transition-all duration-500"
                      style={{ width: `${Math.max(loc.percentage, 4)}%` }}
                    />
                  </div>
                  <span className="text-[12px] font-semibold tabular-nums w-10 text-end shrink-0">
                    {loc.orders.toLocaleString(isAr ? "ar-EG" : undefined)}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums w-20 text-end shrink-0 hidden sm:inline">
                    {formatCurrency(loc.revenue)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={MapPin}
              title={isAr ? "مفيش طلبات النهاردة" : "No orders yet today"}
              description={isAr ? "أماكن العملاء هتظهر هنا أول ما تيجي طلبات" : "Customer locations will appear as orders come in"}
              className="py-6"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
