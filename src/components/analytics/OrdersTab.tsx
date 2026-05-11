import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ShoppingCart, Clock, Calendar, CreditCard,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getOrdersBreakdown } from "@/services/analyticsApi";

interface OrdersTabProps {
  period: number;
  formatCurrency: (cents: number) => string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  processing: "#8b5cf6",
  shipped: "#06b6d4",
  delivered: "#10b981",
  cancelled: "#ef4444",
  refunded: "#f97316",
  payment_failed: "#dc2626",
};

const STATUS_LABELS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  processing: "قيد المعالجة",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  refunded: "مسترد",
  payment_failed: "فشل الدفع",
};

const DAY_LABELS_AR: Record<string, string> = {
  Monday: "الاثنين",
  Tuesday: "الثلاثاء",
  Wednesday: "الأربعاء",
  Thursday: "الخميس",
  Friday: "الجمعة",
  Saturday: "السبت",
  Sunday: "الأحد",
};

export function OrdersTab({ period, formatCurrency }: OrdersTabProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const breakdownQuery = useQuery({
    queryKey: ["analytics", "orders-breakdown", storeId, period],
    queryFn: () => getOrdersBreakdown(storeId!, period),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const breakdown = breakdownQuery.data ?? null;

  const statusChartData = breakdown?.by_status.map((s) => ({
    name: isAr ? (STATUS_LABELS_AR[s.status] || s.status) : s.status.replace("_", " "),
    value: s.count,
    fill: STATUS_COLORS[s.status] || "#94a3b8",
  })) ?? [];

  const totalOrders = statusChartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-4">
      {/* Top row: Status donut + Payment method + Fulfillment time */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Order Status Donut */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "حالة الطلبات" : "Order Status"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusChartData.length > 0 ? (
              <div className="flex flex-col items-center">
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px" }}
                        formatter={(value: number, name: string) => [`${value} (${totalOrders > 0 ? ((value / totalOrders) * 100).toFixed(1) : 0}%)`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
                  {statusChartData.map((s) => (
                    <div key={s.name} className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.fill }} />
                      <span className="text-[10px] text-muted-foreground capitalize">{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState icon={ShoppingCart} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "طرق الدفع" : "Payment Methods"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {breakdown && breakdown.by_payment_method.length > 0 ? (
              <div className="space-y-3">
                {breakdown.by_payment_method.map((pm) => {
                  const maxRevenue = breakdown.by_payment_method[0]?.revenue || 1;
                  const width = (pm.revenue / maxRevenue) * 100;
                  return (
                    <div key={pm.method}>
                      <div className="flex items-center justify-between text-[13px] mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">{pm.method === "cod" ? "COD" : pm.method}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {pm.count} {isAr ? "طلب" : pm.count === 1 ? "order" : "orders"}
                          </span>
                        </div>
                        <span className="font-semibold tabular-nums">{formatCurrency(pm.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/70 rounded-full transition-all duration-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={CreditCard} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>

        {/* Fulfillment Time */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "وقت التجهيز" : "Fulfillment Time"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {breakdown ? (
              <div className="space-y-5 py-2">
                {[
                  { label: isAr ? "المتوسط" : "Average", value: breakdown.fulfillment_time.avg_hours, color: "text-blue-600 dark:text-blue-400" },
                  { label: isAr ? "الوسيط (P50)" : "Median (P50)", value: breakdown.fulfillment_time.p50_hours, color: "text-emerald-600 dark:text-emerald-400" },
                  { label: isAr ? "النسبة المئوية 95 (P95)" : "P95", value: breakdown.fulfillment_time.p95_hours, color: "text-amber-600 dark:text-amber-400" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className={`text-3xl font-bold tabular-nums ${stat.color}`}>
                      {stat.value > 0 ? `${stat.value}h` : "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Clock} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Day of week + Hour of day */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Day of Week Heatmap */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "الطلبات حسب اليوم" : "Orders by Day of Week"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {breakdown && breakdown.by_day_of_week.length > 0 ? (
              <div className="space-y-2">
                {breakdown.by_day_of_week.map((d) => {
                  const maxOrders = Math.max(...breakdown.by_day_of_week.map((x) => x.orders));
                  const intensity = maxOrders > 0 ? d.orders / maxOrders : 0;
                  return (
                    <div key={d.day} className="flex items-center gap-3">
                      <span className="text-[11px] font-medium text-muted-foreground w-16 shrink-0 truncate">
                        {isAr ? (DAY_LABELS_AR[d.day] || d.day) : d.day.slice(0, 3)}
                      </span>
                      <div className="flex-1 h-6 bg-muted rounded overflow-hidden relative">
                        <div
                          className="h-full rounded transition-all duration-500"
                          style={{
                            width: `${intensity * 100}%`,
                            backgroundColor: `hsl(var(--primary) / ${0.3 + intensity * 0.7})`,
                          }}
                        />
                      </div>
                      <div className="text-end shrink-0 w-20">
                        <span className="text-[12px] font-semibold tabular-nums">{d.orders}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">{formatCurrency(d.revenue)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={Calendar} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>

        {/* Hour of Day Bar Chart */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "الطلبات حسب الساعة" : "Orders by Hour"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {breakdown && breakdown.by_hour_of_day.length > 0 ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={breakdown.by_hour_of_day}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(h) => `${h}:00`}
                      interval={2}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px" }}
                      labelFormatter={(h) => `${h}:00 - ${h}:59`}
                      formatter={(value: number) => [value, isAr ? "طلبات" : "Orders"]}
                    />
                    <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon={Clock} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
