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
import { useNavigate } from "react-router-dom";
import { useCountUp } from "@/hooks/useCountUp";

const Dashboard = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");
  const navigate = useNavigate();

  const revenueMap = { "7d": revenueData7d, "30d": revenueData30d, "90d": revenueData90d };
  const chartData = revenueMap[period];

  const formatCurrency = (val: number) =>
    language === "ar" ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;

  const topProducts = [...products].sort((a, b) => b.sold - a.sold).slice(0, 5);
  const recentOrders = [...orders].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  // Animated count-up values
  const animRevenue = useCountUp(kpiData.todayRevenue, 1400);
  const animOrders = useCountUp(kpiData.todayOrders, 800);
  const animCustomers = useCountUp(kpiData.newCustomers, 800);
  const animAvg = useCountUp(kpiData.avgOrderValue, 1200);

  const kpis = [
    { label: t("dashboard.todayRevenue"), value: formatCurrency(animRevenue), icon: DollarSign, trend: "+12%", gradient: "from-emerald-500/10 to-emerald-600/5" },
    { label: t("dashboard.todayOrders"), value: animOrders, icon: ShoppingCart, trend: "+8%", gradient: "from-blue-500/10 to-blue-600/5" },
    { label: t("dashboard.newCustomers"), value: animCustomers, icon: Users, trend: "+5%", gradient: "from-violet-500/10 to-violet-600/5" },
    { label: t("dashboard.avgOrderValue"), value: formatCurrency(animAvg), icon: TrendingUp, trend: "+3%", gradient: "from-amber-500/10 to-amber-600/5" },
  ];

  const iconColors = [
    "from-emerald-500 to-emerald-600",
    "from-blue-500 to-blue-600",
    "from-violet-500 to-violet-600",
    "from-amber-500 to-amber-600",
  ];

  const statusColorMap: Record<string, string> = {
    delivered: "bg-primary/10 text-primary",
    shipped: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    processing: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    pending: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive",
  };

  // Skeuomorphic card style
  const skeuCard = "rounded-2xl border bg-card text-card-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_8px_24px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]";
  const skeuButton = "shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.2)] active:shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)] active:translate-y-px transition-all";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10"
            style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.4)" }}
          >
            <img src={numuIcon} alt="NUMU" className="h-9 w-9 object-contain drop-shadow-sm" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("dashboard.welcome")}, {t("dashboard.merchantName")} 👋
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("dashboard.storeOverview")}
            </p>
          </div>
        </div>
        <div className="hidden sm:flex gap-2">
          <Button variant="outline" size="sm" className={`gap-1.5 rounded-xl ${skeuButton}`}>
            <Eye className="h-3.5 w-3.5" />
            {t("dashboard.viewStore")}
          </Button>
          <Button size="sm" className={`gap-1.5 rounded-xl ${skeuButton}`} onClick={() => navigate("/products")}>
            <Package className="h-3.5 w-3.5" />
            {t("products.addProduct")}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <div
            key={kpi.label}
            className={`${skeuCard} overflow-hidden group hover:-translate-y-0.5 transition-all duration-300`}
            style={{ animationDelay: `${i * 75}ms` }}
          >
            <div className={`p-5 bg-gradient-to-br ${kpi.gradient}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${iconColors[i]} text-white`}
                  style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25)" }}
                >
                  <kpi.icon className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
              </div>
              <div className="mt-1.5 flex items-center gap-1">
                <div
                  className="flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 animate-pulse"
                  style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)", animationDuration: "3s" }}
                >
                  <ArrowUpRight className="h-3 w-3 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-600">{kpi.trend}</span>
                </div>
                <span className="text-xs text-muted-foreground ms-1">
                  {t("dashboard.vsYesterday")}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue Chart */}
        <div className={`${skeuCard} lg:col-span-2 overflow-hidden`}>
          <div className="flex items-center justify-between p-6 pb-2">
            <h3 className="text-base font-semibold">{t("dashboard.revenueTrend")}</h3>
            <div
              className="flex gap-0.5 rounded-xl bg-muted/80 p-1 border border-border/50"
              style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)" }}
            >
              {(["7d", "30d", "90d"] as const).map((p) => (
                <Button
                  key={p}
                  variant={period === p ? "default" : "ghost"}
                  size="sm"
                  className={`h-7 text-xs px-3 rounded-lg ${period === p ? skeuButton : ""}`}
                  onClick={() => setPeriod(p)}
                >
                  {t(`dashboard.last${p === "7d" ? "7days" : p === "30d" ? "30days" : "90days"}`)}
                </Button>
              ))}
            </div>
          </div>
          <div className="p-6 pt-0">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="day" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.4)",
                    }}
                    formatter={(value: number) => [formatCurrency(value), t("dashboard.todayRevenue")]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#colorRevenue)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Order Status Donut */}
        <div className={`${skeuCard} overflow-hidden`}>
          <div className="p-6 pb-2">
            <h3 className="text-base font-semibold">{t("dashboard.orderStatus")}</h3>
          </div>
          <div className="p-6 pt-0">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={orderStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} strokeWidth={2} stroke="hsl(var(--card))">
                    {orderStatusData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    }}
                    formatter={(value: number, name: string) => {
                      const item = orderStatusData.find(d => d.name === name);
                      return [value, language === "ar" && item ? item.nameAr : name];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {orderStatusData.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-xs rounded-lg p-1.5 hover:bg-muted/50 transition-colors">
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: s.fill, boxShadow: "inset 0 -1px 2px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1)" }}
                  />
                  <span className="text-muted-foreground truncate">{language === "ar" ? s.nameAr : s.name}</span>
                  <span className="font-semibold ms-auto">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Products */}
        <div className={`${skeuCard} overflow-hidden`}>
          <div className="flex items-center justify-between p-6 pb-2">
            <h3 className="text-base font-semibold">{t("dashboard.topProducts")}</h3>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground rounded-lg" onClick={() => navigate("/products")}>
              {t("dashboard.viewAll")}
            </Button>
          </div>
          <div className="p-6 pt-0">
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl p-2.5 -mx-2 transition-all hover:bg-muted/60 cursor-pointer group"
                >
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-muted to-muted/50 text-lg shrink-0 border border-border/50"
                    style={{ boxShadow: "inset 0 -1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)" }}
                  >
                    {p.image}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{language === "ar" ? p.nameAr : p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sold} {t("dashboard.units")}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(p.price)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div className={`${skeuCard} overflow-hidden`}>
          <div className="flex items-center justify-between p-6 pb-2">
            <h3 className="text-base font-semibold">{t("dashboard.recentOrders")}</h3>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground rounded-lg" onClick={() => navigate("/orders")}>
              {t("dashboard.viewAll")}
            </Button>
          </div>
          <div className="p-6 pt-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>{t("dashboard.order")}</TableHead>
                  <TableHead>{t("dashboard.customer")}</TableHead>
                  <TableHead>{t("dashboard.total")}</TableHead>
                  <TableHead>{t("dashboard.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => navigate("/orders")}>
                    <TableCell className="font-medium">{o.orderNumber}</TableCell>
                    <TableCell>{language === "ar" ? o.customerNameAr : o.customerName}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(o.total)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`${statusColorMap[o.fulfillmentStatus]} rounded-full px-2.5`}
                        style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)" }}
                      >
                        {t(`orders.${o.fulfillmentStatus}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
