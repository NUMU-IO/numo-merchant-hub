import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, TrendingDown, Minus, Calendar, DollarSign, BarChart3,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getForecast } from "@/services/analyticsApi";
import { useState } from "react";

interface ForecastTabProps {
  formatCurrency: (cents: number) => string;
}

type Horizon = 7 | 14 | 30 | 60;

export function ForecastTab({ formatCurrency }: ForecastTabProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";
  const [horizon, setHorizon] = useState<Horizon>(30);

  const forecastQuery = useQuery({
    queryKey: ["analytics", "forecast", storeId, horizon],
    queryFn: () => getForecast(storeId!, horizon),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
    staleTime: 30 * 60 * 1000, // 30 min cache
  });

  const data = forecastQuery.data ?? null;
  const meta = data?.metadata;

  // Combine historical + forecast for chart
  // Show last 30 days of historical + full forecast
  const historicalSlice = (data?.historical ?? []).slice(-30);
  const chartData = [
    ...historicalSlice.map((h) => ({
      date: h.date.slice(5), // MM-DD
      revenue: h.revenue,
      predicted: null as number | null,
      lower: null as number | null,
      upper: null as number | null,
    })),
    // Overlap point: last historical = first predicted
    ...(data?.forecast ?? []).map((f) => ({
      date: f.date.slice(5),
      revenue: null as number | null,
      predicted: f.predicted,
      lower: f.lower,
      upper: f.upper,
    })),
  ];

  // Find the boundary date for the reference line
  const boundaryIdx = historicalSlice.length;

  const TrendIcon = meta?.trend === "up" ? TrendingUp : meta?.trend === "down" ? TrendingDown : Minus;
  const trendColor = meta?.trend === "up"
    ? "text-emerald-600 dark:text-emerald-400"
    : meta?.trend === "down"
      ? "text-red-600 dark:text-red-400"
      : "text-muted-foreground";

  const horizonLabels: Record<Horizon, string> = {
    7: isAr ? "٧ أيام" : "7 days",
    14: isAr ? "١٤ يوم" : "14 days",
    30: isAr ? "٣٠ يوم" : "30 days",
    60: isAr ? "٦٠ يوم" : "60 days",
  };

  // Insufficient data state
  if (meta?.status === "insufficient_data" || meta?.status === "no_revenue") {
    return (
      <div className="space-y-4">
        <Card className="border-border/60">
          <CardContent className="p-8">
            <EmptyState
              icon={BarChart3}
              title={isAr ? (meta.message_ar ?? "مفيش بيانات كافية") : (meta.message_en ?? "Not enough data")}
              description={
                isAr
                  ? `محتاجين ${meta.days_required ?? 14} يوم بيانات. عندك ${meta.days_available ?? 0} حالياً.`
                  : `Need ${meta.days_required ?? 14} days of data. You have ${meta.days_available ?? 0}.`
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      {meta && meta.status === "ok" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "الاتجاه المتوقع" : "Forecast Trend"}
                </p>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.trend === "up" ? "bg-emerald-500/10" : meta.trend === "down" ? "bg-red-500/10" : "bg-muted"}`}>
                  <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
                </div>
              </div>
              <p className={`text-xl font-bold capitalize ${trendColor}`}>
                {isAr
                  ? (meta.trend === "up" ? "صاعد" : meta.trend === "down" ? "هابط" : "مستقر")
                  : (meta.trend ?? "stable")}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "إجمالي التوقع" : "Forecast Total"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
                  <DollarSign className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-xl font-bold tabular-nums">
                {formatCurrency(meta.forecast_total ?? 0)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {isAr ? `خلال ${meta.horizon_days} يوم` : `next ${meta.horizon_days} days`}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "متوسط يومي متوقع" : "Forecast Daily Avg"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10">
                  <Calendar className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
              <p className="text-xl font-bold tabular-nums">
                {formatCurrency(meta.forecast_daily_avg ?? 0)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "المعدل الحالي (٧ أيام)" : "Current Avg (7d)"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                  <BarChart3 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <p className="text-xl font-bold tabular-nums">
                {formatCurrency(meta.avg_daily_revenue_7d ?? 0)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {isAr ? "/يوم" : "/day"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Forecast Chart */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "توقع الإيرادات" : "Revenue Forecast"}
            </CardTitle>
            <div className="flex gap-0.5 rounded-lg bg-muted/60 p-0.5">
              {([7, 14, 30, 60] as Horizon[]).map((h) => (
                <Button
                  key={h}
                  variant={horizon === h ? "default" : "ghost"}
                  size="sm"
                  className={`h-6 text-[10px] px-2 rounded-md ${horizon === h ? "" : "text-muted-foreground"}`}
                  onClick={() => setHorizon(h)}
                >
                  {horizonLabels[h]}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorHistorical" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(262 83% 58%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(262 83% 58%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(262 83% 58%)" stopOpacity={0.08} />
                      <stop offset="95%" stopColor="hsl(262 83% 58%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${(v / 100).toLocaleString()}`}
                  />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px" }}
                    formatter={(value: number | null, name: string) => {
                      if (value === null) return [null, null];
                      const label = {
                        revenue: isAr ? "الفعلي" : "Actual",
                        predicted: isAr ? "المتوقع" : "Predicted",
                        upper: isAr ? "الحد الأعلى" : "Upper",
                        lower: isAr ? "الحد الأدنى" : "Lower",
                      }[name] || name;
                      return [formatCurrency(value), label];
                    }}
                  />

                  {/* Confidence band (upper - lower fill) */}
                  <Area
                    type="monotone"
                    dataKey="upper"
                    stroke="none"
                    fill="url(#colorConfidence)"
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="lower"
                    stroke="none"
                    fill="hsl(var(--background))"
                    connectNulls={false}
                  />

                  {/* Historical line */}
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    fill="url(#colorHistorical)"
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls={false}
                  />

                  {/* Forecast line */}
                  <Area
                    type="monotone"
                    dataKey="predicted"
                    stroke="hsl(262 83% 58%)"
                    fill="url(#colorForecast)"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                    connectNulls={false}
                  />

                  {/* Today marker */}
                  {boundaryIdx > 0 && boundaryIdx < chartData.length && (
                    <ReferenceLine
                      x={chartData[boundaryIdx - 1]?.date}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="3 3"
                      strokeOpacity={0.5}
                      label={{
                        value: isAr ? "اليوم" : "Today",
                        position: "top",
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 10,
                      }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={TrendingUp} title={isAr ? "مفيش بيانات" : "No data"} className="py-8" />
          )}
        </CardContent>
      </Card>

      {/* Method & Data Info */}
      {meta && meta.status === "ok" && (
        <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
          <span>
            {isAr ? "الطريقة" : "Method"}: {meta.method === "holt_winters_seasonal" ? "Holt-Winters (seasonal)" : "Holt-Winters (trend)"}
          </span>
          <span>•</span>
          <span>
            {isAr ? "البيانات المتاحة" : "Data"}: {meta.days_available} {isAr ? "يوم" : "days"}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-primary rounded" /> {isAr ? "فعلي" : "Actual"}
            <span className="inline-block w-3 h-0.5 rounded border-t-2 border-dashed border-violet-500 ml-2" /> {isAr ? "متوقع" : "Forecast"}
          </span>
        </div>
      )}
    </div>
  );
}
