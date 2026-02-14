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
import { TrendingUp, ShoppingCart, Users, DollarSign, ArrowUpRight, Package, Eye } from "lucide-react";
import numuIcon from "@/assets/numu-icon.png";

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
    { label: t("dashboard.todayRevenue"), value: formatCurrency(kpiData.todayRevenue), icon: DollarSign, trend: "+12%", color: "text-emerald-600" },
    { label: t("dashboard.todayOrders"), value: kpiData.todayOrders, icon: ShoppingCart, trend: "+8%", color: "text-emerald-600" },
    { label: t("dashboard.newCustomers"), value: kpiData.newCustomers, icon: Users, trend: "+5%", color: "text-emerald-600" },
    { label: t("dashboard.avgOrderValue"), value: formatCurrency(kpiData.avgOrderValue), icon: TrendingUp, trend: "+3%", color: "text-emerald-600" },
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
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={numuIcon} alt="NUMU" className="h-10 w-10 object-contain" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("dashboard.welcome")}, {t("dashboard.merchantName")} 👋
            </h1>
            <p className="text-muted-foreground text-sm">
              {language === "ar" ? "إليك نظرة عامة على متجرك اليوم" : "Here's an overview of your store today"}
            </p>
          </div>
        </div>
        <div className="hidden sm:flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            {language === "ar" ? "معاينة المتجر" : "View Store"}
          </Button>
          <Button size="sm" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            {t("products.addProduct")}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <kpi.icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-600">{kpi.trend}</span>
                <span className="text-xs text-muted-foreground">
                  {language === "ar" ? "من الأمس" : "vs yesterday"}
                </span>
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
            <div className="flex gap-1 rounded-lg bg-muted p-0.5">
              {(["7d", "30d", "90d"] as const).map((p) => (
                <Button
                  key={p}
                  variant={period === p ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => setPeriod(p)}
                >
                  {t(`dashboard.last${p === "7d" ? "7days" : p === "30d" ? "30days" : "90days"}`)}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="day" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
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
                  <Pie data={orderStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} strokeWidth={0}>
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
            <div className="mt-3 grid grid-cols-2 gap-2">
              {orderStatusData.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.fill }} />
                  <span className="text-muted-foreground truncate">{language === "ar" ? s.nameAr : s.name}</span>
                  <span className="font-semibold ms-auto">{s.value}</span>
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
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">{t("dashboard.topProducts")}</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              {t("dashboard.viewAll")}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProducts.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-lg shrink-0">
                    {p.image}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{language === "ar" ? p.nameAr : p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sold} {t("dashboard.units")}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(p.price)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">{t("dashboard.recentOrders")}</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              {t("dashboard.viewAll")}
            </Button>
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
                    <TableCell className="tabular-nums">{formatCurrency(o.total)}</TableCell>
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
