import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, TrendingUp, Repeat } from "lucide-react";
import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

import {
  getLtvByChannel,
  type LtvGroupBy,
} from "@/services/analyticsApi";
import { dateRangeKey } from "@/services/dateRangeParams";
import type { DateRange } from "@/components/filters/DateRangePicker";

interface LtvByChannelTabProps {
  range: DateRange;
  formatCurrency: (cents: number) => string;
}

// Stable colors per group_by dimension so a merchant scanning the bar
// chart and the table sees the same hue for "facebook" in both places.
// "direct" is a sentinel emitted by the backend when first-touch data
// is missing; keep it muted so it doesn't dominate the eye.
const CHANNEL_COLORS = [
  "#3b82f6", "#ec4899", "#f59e0b", "#10b981",
  "#8b5cf6", "#06b6d4", "#ef4444", "#84cc16",
  "#f97316", "#a855f7",
];
const DIRECT_COLOR = "#94a3b8";

function colorFor(channel: string, index: number): string {
  if (channel.toLowerCase() === "direct") return DIRECT_COLOR;
  return CHANNEL_COLORS[index % CHANNEL_COLORS.length];
}

export function LtvByChannelTab({ range, formatCurrency }: LtvByChannelTabProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const [groupBy, setGroupBy] = useState<LtvGroupBy>("source");

  const query = useQuery({
    queryKey: [
      "analytics",
      "ltv-by-channel",
      storeId,
      groupBy,
      ...dateRangeKey(range),
    ],
    queryFn: () => getLtvByChannel(storeId!, range, groupBy),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const data = query.data ?? null;
  const rows = data?.channels ?? [];
  const maxLtv = rows.length > 0 ? Math.max(...rows.map((r) => r.ltv_cents)) : 0;

  return (
    <div className="space-y-4">
      {/* Group-by selector + totals */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={groupBy}
          onValueChange={(v) => setGroupBy(v as LtvGroupBy)}
        >
          <TabsList>
            <TabsTrigger value="source">
              {isAr ? "المصدر" : "Source"}
            </TabsTrigger>
            <TabsTrigger value="medium">
              {isAr ? "الوسيلة" : "Medium"}
            </TabsTrigger>
            <TabsTrigger value="campaign">
              {isAr ? "الحملة" : "Campaign"}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Top KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                {isAr ? "العملاء المكتسبون" : "Customers Acquired"}
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {data
                ? data.totals.customer_count.toLocaleString(isAr ? "ar-EG" : undefined)
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                {isAr ? "متوسط القيمة مدى الحياة" : "Average LTV"}
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {data ? formatCurrency(data.totals.average_ltv_cents) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                {isAr ? "إجمالي الإيرادات" : "Total Lifetime Revenue"}
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
              {data ? formatCurrency(data.totals.total_revenue_cents) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* LTV bar chart */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {isAr ? "القيمة مدى الحياة حسب القناة" : "LTV by Channel"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length > 0 ? (
            <div className="space-y-2">
              {rows.map((r, i) => {
                const widthPct = maxLtv > 0 ? (r.ltv_cents / maxLtv) * 100 : 0;
                return (
                  <div key={r.channel}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: colorFor(r.channel, i) }}
                        />
                        <span className="font-medium font-mono truncate">
                          {r.channel}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {r.customer_count.toLocaleString(isAr ? "ar-EG" : undefined)}{" "}
                          {isAr ? "عميل" : r.customer_count === 1 ? "customer" : "customers"}
                        </span>
                      </div>
                      <span className="font-semibold tabular-nums shrink-0">
                        {formatCurrency(r.ltv_cents)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: colorFor(r.channel, i),
                          opacity: 0.6,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title={isAr ? "مفيش بيانات" : "No data yet"}
              description={
                isAr
                  ? "هتظهر هنا قيمة العملاء حسب أول مصدر مكتسبوا منه"
                  : "Lifetime value shows up here once customers are acquired with UTM-tagged links"
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Detail table */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {isAr ? "التفاصيل" : "Detail"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-start font-medium text-muted-foreground p-2">
                      {groupBy === "source"
                        ? isAr ? "المصدر" : "Source"
                        : groupBy === "medium"
                        ? isAr ? "الوسيلة" : "Medium"
                        : isAr ? "الحملة" : "Campaign"}
                    </th>
                    <th className="text-end font-medium text-muted-foreground p-2">
                      {isAr ? "العملاء" : "Customers"}
                    </th>
                    <th className="text-end font-medium text-muted-foreground p-2">
                      {isAr ? "الطلبات" : "Orders"}
                    </th>
                    <th className="text-end font-medium text-muted-foreground p-2">
                      {isAr ? "طلبات/عميل" : "Orders / Customer"}
                    </th>
                    <th className="text-end font-medium text-muted-foreground p-2">
                      {isAr ? "متوسط قيمة الطلب" : "AOV"}
                    </th>
                    <th className="text-end font-medium text-muted-foreground p-2">
                      {isAr ? "إجمالي الإيرادات" : "Revenue"}
                    </th>
                    <th className="text-end font-medium text-muted-foreground p-2">
                      {isAr ? "LTV" : "LTV"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={r.channel}
                      className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-2">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: colorFor(r.channel, i) }}
                          />
                          <span className="font-medium font-mono">{r.channel}</span>
                        </div>
                      </td>
                      <td className="text-end p-2 tabular-nums">
                        {r.customer_count.toLocaleString(isAr ? "ar-EG" : undefined)}
                      </td>
                      <td className="text-end p-2 tabular-nums">
                        {r.total_orders.toLocaleString(isAr ? "ar-EG" : undefined)}
                      </td>
                      <td className="text-end p-2 tabular-nums">
                        {r.orders_per_customer.toFixed(2)}
                      </td>
                      <td className="text-end p-2 tabular-nums">
                        {formatCurrency(r.average_order_value_cents)}
                      </td>
                      <td className="text-end p-2 tabular-nums">
                        {formatCurrency(r.total_revenue_cents)}
                      </td>
                      <td className="text-end p-2 font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(r.ltv_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Users} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
