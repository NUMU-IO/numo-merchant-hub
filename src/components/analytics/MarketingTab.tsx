import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Megaphone, Globe, Eye } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getMarketingAttribution } from "@/services/analyticsApi";
import { dateRangeKey } from "@/services/dateRangeParams";
import type { DateRange } from "@/components/filters/DateRangePicker";

interface MarketingTabProps {
  range: DateRange;
  formatCurrency: (cents: number) => string;
}

const CHANNEL_COLORS: Record<string, string> = {
  Direct: "#3b82f6",
  Social: "#ec4899",
  Paid: "#f59e0b",
  Email: "#10b981",
  Referral: "#8b5cf6",
  Organic: "#06b6d4",
};

const CHANNEL_LABELS_AR: Record<string, string> = {
  Direct: "مباشر",
  Social: "تواصل اجتماعي",
  Paid: "مدفوع",
  Email: "بريد إلكتروني",
  Referral: "إحالة",
  Organic: "عضوي",
};

export function MarketingTab({ range, formatCurrency }: MarketingTabProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const attrQuery = useQuery({
    queryKey: ["analytics", "marketing-attribution", storeId, ...dateRangeKey(range)],
    queryFn: () => getMarketingAttribution(storeId!, range),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const data = attrQuery.data ?? null;

  const pieData = data?.channels.map((ch) => ({
    name: isAr ? (CHANNEL_LABELS_AR[ch.channel] || ch.channel) : ch.channel,
    value: ch.revenue,
    fill: CHANNEL_COLORS[ch.channel] || "#94a3b8",
  })) ?? [];

  const totalRevenue = pieData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Attribution Pie Chart */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "الإيرادات حسب القناة" : "Revenue by Channel"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="flex flex-col items-center">
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px" }}
                        formatter={(value: number, name: string) => [
                          `${formatCurrency(value)} (${totalRevenue > 0 ? ((value / totalRevenue) * 100).toFixed(1) : 0}%)`,
                          name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                      <span className="text-[10px] text-muted-foreground">{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState icon={Globe} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>

        {/* Channel Performance Table */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "أداء القنوات" : "Channel Performance"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data && data.channels.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="text-start font-medium text-muted-foreground p-2">{isAr ? "القناة" : "Channel"}</th>
                      <th className="text-end font-medium text-muted-foreground p-2">{isAr ? "الزيارات" : "Visits"}</th>
                      <th className="text-end font-medium text-muted-foreground p-2">{isAr ? "الطلبات" : "Orders"}</th>
                      <th className="text-end font-medium text-muted-foreground p-2">{isAr ? "الإيرادات" : "Revenue"}</th>
                      <th className="text-end font-medium text-muted-foreground p-2">{isAr ? "التحويل" : "Conv."}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.channels.map((ch) => (
                      <tr key={ch.channel} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="p-2">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: CHANNEL_COLORS[ch.channel] || "#94a3b8" }}
                            />
                            <span className="font-medium">
                              {isAr ? (CHANNEL_LABELS_AR[ch.channel] || ch.channel) : ch.channel}
                            </span>
                          </div>
                        </td>
                        <td className="text-end p-2 tabular-nums">{ch.visits.toLocaleString(isAr ? "ar-EG" : undefined)}</td>
                        <td className="text-end p-2 tabular-nums">{ch.orders.toLocaleString(isAr ? "ar-EG" : undefined)}</td>
                        <td className="text-end p-2 font-semibold tabular-nums">{formatCurrency(ch.revenue)}</td>
                        <td className="text-end p-2 tabular-nums">{ch.conversion_rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Megaphone} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Campaign Comparison */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            {isAr ? "مقارنة الحملات" : "Campaign Comparison"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data && data.campaigns.length > 0 ? (
            <div className="space-y-2">
              {data.campaigns.map((camp) => {
                const maxRevenue = data.campaigns[0]?.revenue || 1;
                const width = (camp.revenue / maxRevenue) * 100;
                return (
                  <div key={camp.campaign}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium font-mono truncate">{camp.campaign}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {camp.orders} {isAr ? "طلب" : "orders"}
                        </span>
                      </div>
                      <span className="font-semibold tabular-nums shrink-0">{formatCurrency(camp.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full transition-all duration-500"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Eye}
              title={isAr ? "مفيش حملات بعد" : "No campaigns yet"}
              description={isAr ? "أضف UTM parameters لروابط حملاتك" : "Add UTM parameters to your campaign links"}
            />
          )}
        </CardContent>
      </Card>

      {/* Attribution summary */}
      {data && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="border-border/60">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                {data.total_visits.toLocaleString(isAr ? "ar-EG" : undefined)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isAr ? "إجمالي الزيارات" : "Total Visits"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-400">
                {data.attributed_visits.toLocaleString(isAr ? "ar-EG" : undefined)}
                <span className="text-sm text-muted-foreground ml-1">
                  ({data.total_visits > 0 ? ((data.attributed_visits / data.total_visits) * 100).toFixed(1) : 0}%)
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isAr ? "زيارات بمصدر معروف" : "Attributed Visits"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
