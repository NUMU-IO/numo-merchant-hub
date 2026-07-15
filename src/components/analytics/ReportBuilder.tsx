import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Wrench, Download } from "lucide-react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  getReportBuilder,
  type ReportDimension, type ReportBuilderRow,
} from "@/services/analyticsApi";
import { dateRangeKey } from "@/services/dateRangeParams";
import type { DateRange } from "@/components/filters/DateRangePicker";
import { downloadCsv } from "@/lib/csvDownload";
import { useState } from "react";

interface ReportBuilderProps {
  range: DateRange;
  formatCurrency: (cents: number) => string;
}

type Metric = "revenue" | "orders" | "aov" | "units";

const DIMENSIONS: { key: ReportDimension; en: string; ar: string }[] = [
  { key: "day", en: "Day", ar: "اليوم" },
  { key: "week", en: "Week", ar: "الأسبوع" },
  { key: "month", en: "Month", ar: "الشهر" },
  { key: "governorate", en: "Governorate", ar: "المحافظة" },
  { key: "payment_method", en: "Payment method", ar: "طريقة الدفع" },
  { key: "channel", en: "Channel", ar: "القناة" },
  { key: "coupon", en: "Coupon", ar: "الكوبون" },
  { key: "product", en: "Product", ar: "المنتج" },
];

const METRICS: { key: Metric; en: string; ar: string; money: boolean }[] = [
  { key: "revenue", en: "Revenue", ar: "الإيرادات", money: true },
  { key: "orders", en: "Orders", ar: "الطلبات", money: false },
  { key: "aov", en: "Avg order value", ar: "متوسط الطلب", money: true },
  { key: "units", en: "Units", ar: "الوحدات", money: false },
];

function metricValue(row: ReportBuilderRow, m: Metric): number {
  if (m === "revenue") return row.revenue_cents;
  if (m === "aov") return row.aov_cents;
  if (m === "units") return row.units;
  return row.orders;
}

/** Custom report builder (v1): pick a metric and a dimension, get a
 *  chart + table + CSV. The backend returns all columns per group, so
 *  switching metric is instant (no re-fetch). */
export function ReportBuilder({ range, formatCurrency }: ReportBuilderProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const [dimension, setDimension] = useState<ReportDimension>("day");
  const [metric, setMetric] = useState<Metric>("revenue");

  const query = useQuery({
    queryKey: ["analytics", "report-builder", storeId, dimension, ...dateRangeKey(range)],
    queryFn: () => getReportBuilder(storeId!, range, dimension),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.rows ?? [];
  const totals = query.data?.totals ?? null;
  const metricMeta = METRICS.find((m) => m.key === metric)!;

  const fmt = (v: number) => (metricMeta.money ? formatCurrency(v) : v.toLocaleString(isAr ? "ar-EG" : undefined));

  const chartData = rows.slice(0, 20).map((r) => ({
    label: r.label,
    value: metricValue(r, metric),
  }));

  const exportCsv = () => {
    const headers = [
      isAr ? DIMENSIONS.find((d) => d.key === dimension)?.ar ?? dimension : DIMENSIONS.find((d) => d.key === dimension)?.en ?? dimension,
      "Revenue",
      "Orders",
      "AOV",
      "Units",
    ];
    const body = rows.map((r) => [
      r.label,
      (r.revenue_cents / 100).toFixed(2),
      r.orders,
      (r.aov_cents / 100).toFixed(2),
      r.units,
    ]);
    downloadCsv(`report-${dimension}-${new Date().toISOString().slice(0, 10)}`, headers, body);
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
            {isAr ? "أنشئ تقريرك" : "Build a Report"}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
              <SelectTrigger className="h-8 w-[150px] text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRICS.map((m) => (
                  <SelectItem key={m.key} value={m.key} className="text-[12.5px]">
                    {isAr ? m.ar : m.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[12px] text-muted-foreground">{isAr ? "حسب" : "by"}</span>
            <Select value={dimension} onValueChange={(v) => setDimension(v as ReportDimension)}>
              <SelectTrigger className="h-8 w-[150px] text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIMENSIONS.map((d) => (
                  <SelectItem key={d.key} value={d.key} className="text-[12.5px]">
                    {isAr ? d.ar : d.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost" size="icon" className="h-8 w-8 rounded-lg"
              onClick={exportCsv} disabled={rows.length === 0}
              title={isAr ? "تصدير CSV" : "Export CSV"}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title={isAr ? "مفيش بيانات للفترة دي" : "No data for this range"}
            className="py-8"
          />
        ) : (
          <>
            <div className="h-[240px] mb-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => metricMeta.money ? `${(v / 100).toLocaleString()}` : `${v}`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px" }}
                    formatter={(v: number) => [fmt(v), isAr ? metricMeta.ar : metricMeta.en]}
                  />
                  <Bar dataKey="value" radius={[5, 5, 0, 0]} fill="hsl(var(--navy))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="text-start font-medium py-1.5">
                      {isAr ? DIMENSIONS.find((d) => d.key === dimension)?.ar : DIMENSIONS.find((d) => d.key === dimension)?.en}
                    </th>
                    <th className="text-end font-medium py-1.5">{isAr ? metricMeta.ar : metricMeta.en}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 30).map((r) => (
                    <tr key={r.label} className="border-b border-border/30 hover:bg-muted/40">
                      <td className="py-1.5 capitalize truncate max-w-[240px]" dir="auto">{r.label}</td>
                      <td className="py-1.5 text-end tabular-nums font-medium">{fmt(metricValue(r, metric))}</td>
                    </tr>
                  ))}
                  {totals && (
                    <tr className="font-bold">
                      <td className="py-1.5">{isAr ? "الإجمالي" : "Total"}</td>
                      <td className="py-1.5 text-end tabular-nums">{fmt(metricValue(totals, metric))}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
