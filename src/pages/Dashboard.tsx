import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { kpiData, revenueData7d, revenueData30d, revenueData90d, orderStatusData } from "@/data/mock-dashboard";
import { products } from "@/data/mock-products";
import { orders } from "@/data/mock-orders";
import { TrendingUp, ShoppingCart, Users, DollarSign } from "lucide-react";

const Dashboard = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");

  const revenueMap = { "7d": revenueData7d, "30d": revenueData30d, "90d": revenueData90d };
  const chartData = revenueMap[period];

  const formatCurrency = (val: number) =>
    language === "ar" ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;

  const topProducts = [...products].sort((a, b) => b.sold - a.sold).slice(0, 5);
  const recentOrders = [...orders].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const kpis = [
    { label: t("dashboard.todayRevenue"), value: formatCurrency(kpiData.todayRevenue), icon: DollarSign, trend: "+12%" },
    { label: t("dashboard.todayOrders"), value: kpiData.todayOrders, icon: ShoppingCart, trend: "+8%" },
    { label: t("dashboard.newCustomers"), value: kpiData.newCustomers, icon: Users, trend: "+5%" },
    { label: t("dashboard.avgOrderValue"), value: formatCurrency(kpiData.avgOrderValue), icon: TrendingUp, trend: "+3%" },
  ];

  const statusColorMap: Record<string, string> = {
    delivered: "bg-primary/10 text-primary",
    shipped: "bg-blue-100 text-blue-700",
    processing: "bg-yellow-100 text-yellow-700",
    pending: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("dashboard.welcome")}, {t("dashboard.merchantName")} 👋
        </h1>
        <p className="text-muted-foreground text-sm">{t("header.storeName")}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 flex items-end gap-2">
                <p className="text-2xl font-bold">{kpi.value}</p>
                <span className="mb-0.5 text-xs font-medium text-primary">{kpi.trend}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">{t("dashboard.revenueTrend")}</CardTitle>
            <div className="flex gap-1">
              {(["7d", "30d", "90d"] as const).map((p) => (
                <Button
                  key={p}
                  variant={period === p ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setPeriod(p)}
                >
                  {t(`dashboard.last${p === "7d" ? "7days" : p === "30d" ? "30days" : "90days"}`)}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(value: number) => [formatCurrency(value), t("dashboard.todayRevenue")]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#colorRevenue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Order Status Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{t("dashboard.orderStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={orderStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {orderStatusData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => {
                    const item = orderStatusData.find(d => d.name === name);
                    return [value, language === "ar" && item ? item.nameAr : name];
                  }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {orderStatusData.map((s) => (
                <div key={s.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                  <span className="text-muted-foreground">{language === "ar" ? s.nameAr : s.name}</span>
                  <span className="font-medium">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Products */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{t("dashboard.topProducts")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-lg">{p.image}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{language === "ar" ? p.nameAr : p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sold} {t("dashboard.units")}</p>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(p.price)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">{t("dashboard.recentOrders")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dashboard.order")}</TableHead>
                  <TableHead>{t("dashboard.customer")}</TableHead>
                  <TableHead>{t("dashboard.total")}</TableHead>
                  <TableHead>{t("dashboard.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.orderNumber}</TableCell>
                    <TableCell>{language === "ar" ? o.customerNameAr : o.customerName}</TableCell>
                    <TableCell>{formatCurrency(o.total)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColorMap[o.fulfillmentStatus]}>
                        {t(`orders.${o.fulfillmentStatus}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
