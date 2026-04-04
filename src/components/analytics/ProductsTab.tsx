import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Package, FolderOpen, AlertTriangle, ArrowUpDown,
  Crown, TrendingDown, BarChart3, AlertCircle,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getProductPerformance } from "@/services/analyticsApi";
import { useState } from "react";

interface ProductsTabProps {
  period: number;
  formatCurrency: (cents: number) => string;
}

type SortBy = "revenue" | "quantity" | "name";

const INVENTORY_COLORS = {
  in_stock: "#10b981",
  low_stock: "#f59e0b",
  out_of_stock: "#ef4444",
  dead_stock: "#94a3b8",
};

const CATEGORY_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#f97316", "#14b8a6", "#6366f1",
];

function MiniSparkline({ data }: { data: number[] }) {
  if (!data.length || data.every((v) => v === 0)) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }
  const max = Math.max(...data, 1);
  const h = 20;
  const w = 48;
  const step = w / (data.length - 1 || 1);
  const points = data
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(" ");

  return (
    <svg width={w} height={h} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProductsTab({ period, formatCurrency }: ProductsTabProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";
  const [sortBy, setSortBy] = useState<SortBy>("revenue");

  const perfQuery = useQuery({
    queryKey: ["analytics", "product-performance", storeId, period, sortBy],
    queryFn: () => getProductPerformance(storeId!, period, sortBy),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const data = perfQuery.data ?? null;

  const inventoryData = data
    ? [
        { name: isAr ? "متوفر" : "In Stock", value: data.inventory.in_stock, fill: INVENTORY_COLORS.in_stock },
        { name: isAr ? "مخزون منخفض" : "Low Stock", value: data.inventory.low_stock, fill: INVENTORY_COLORS.low_stock },
        { name: isAr ? "نفذ" : "Out of Stock", value: data.inventory.out_of_stock, fill: INVENTORY_COLORS.out_of_stock },
        { name: isAr ? "راكد" : "Dead Stock", value: data.inventory.dead_stock, fill: INVENTORY_COLORS.dead_stock },
      ].filter((d) => d.value > 0)
    : [];

  const totalInventory = inventoryData.reduce((sum, d) => sum + d.value, 0);

  // Computed KPIs
  const bestSeller = data?.products[0] ?? null; // sorted by revenue by default
  const totalRevenue = data?.products.reduce((sum, p) => sum + p.revenue, 0) ?? 0;
  const totalProducts = data ? data.products.length : 0;

  // Revenue concentration: % from top 20% of products
  const top20Count = Math.max(1, Math.ceil(totalProducts * 0.2));
  const sortedByRev = [...(data?.products ?? [])].sort((a, b) => b.revenue - a.revenue);
  const top20Revenue = sortedByRev.slice(0, top20Count).reduce((sum, p) => sum + p.revenue, 0);
  const concentrationPct = totalRevenue > 0 ? (top20Revenue / totalRevenue) * 100 : 0;

  // Stock risk: products with sales but low/zero stock
  const stockRisk = (data?.products ?? [])
    .filter((p) => p.quantity_sold > 0 && p.current_stock <= 5)
    .sort((a, b) => b.quantity_sold - a.quantity_sold)
    .slice(0, 5);

  // Dead stock products (have stock, zero sales)
  const deadStockProducts = (data?.products ?? [])
    .filter((p) => p.current_stock > 0 && p.quantity_sold === 0);

  const sortLabels: Record<SortBy, string> = {
    revenue: isAr ? "الإيرادات" : "Revenue",
    quantity: isAr ? "الكمية" : "Quantity",
    name: isAr ? "الاسم" : "Name",
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      {data && data.products.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "الأكثر مبيعاً" : "Best Seller"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                  <Crown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <p className="text-[13px] font-bold truncate">{bestSeller?.name ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground">
                {bestSeller ? `${formatCurrency(bestSeller.revenue)} · ${bestSeller.quantity_sold} ${isAr ? "مبيع" : "sold"}` : ""}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "إجمالي المنتجات" : "Products Sold"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
                  <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">{totalProducts}</p>
              <p className="text-[10px] text-muted-foreground">
                {isAr ? "منتج حقق مبيعات" : "products with sales"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "تركز الإيرادات" : "Revenue Concentration"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10">
                  <BarChart3 className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">{concentrationPct.toFixed(0)}%</p>
              <p className="text-[10px] text-muted-foreground">
                {isAr ? `من أعلى ${top20Count} منتج` : `from top ${top20Count} products`}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? "تنبيهات المخزون" : "Stock Alerts"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {data.inventory.out_of_stock + data.inventory.low_stock}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {data.inventory.out_of_stock} {isAr ? "نفذ" : "out"} · {data.inventory.low_stock} {isAr ? "منخفض" : "low"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Product Performance Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "أداء المنتجات" : "Product Performance"}
            </CardTitle>
            <div className="flex gap-0.5 rounded-lg bg-muted/60 p-0.5">
              {(["revenue", "quantity", "name"] as SortBy[]).map((s) => (
                <Button
                  key={s}
                  variant={sortBy === s ? "default" : "ghost"}
                  size="sm"
                  className={`h-6 text-[10px] px-2 rounded-md gap-1 ${sortBy === s ? "" : "text-muted-foreground"}`}
                  onClick={() => setSortBy(s)}
                >
                  <ArrowUpDown className="h-2.5 w-2.5" />
                  {sortLabels[s]}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {data && data.products.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-start font-medium text-muted-foreground p-2">{isAr ? "المنتج" : "Product"}</th>
                    <th className="text-end font-medium text-muted-foreground p-2">{isAr ? "الإيرادات" : "Revenue"}</th>
                    <th className="text-end font-medium text-muted-foreground p-2">{isAr ? "المبيع" : "Sold"}</th>
                    <th className="text-end font-medium text-muted-foreground p-2">{isAr ? "المخزون" : "Stock"}</th>
                    <th className="text-center font-medium text-muted-foreground p-2">{isAr ? "الاتجاه" : "Trend"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p) => (
                    <tr key={p.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                      <td className="p-2">
                        <p className="font-medium truncate max-w-[200px]">{p.name}</p>
                        {p.sku && <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>}
                      </td>
                      <td className="text-end p-2 font-semibold tabular-nums">{formatCurrency(p.revenue)}</td>
                      <td className="text-end p-2 tabular-nums">{p.quantity_sold}</td>
                      <td className="text-end p-2">
                        <span className={`tabular-nums font-medium ${p.current_stock <= 0 ? "text-destructive" : p.current_stock <= 5 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                          {p.current_stock}
                        </span>
                      </td>
                      <td className="text-center p-2">
                        <MiniSparkline data={p.revenue_trend} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Package} title={isAr ? "مفيش بيانات منتجات" : "No product data"} className="py-6" />
          )}
        </CardContent>
      </Card>

      {/* Stock Risk Alerts + Dead Stock */}
      {(stockRisk.length > 0 || deadStockProducts.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Stock Risk */}
          {stockRisk.length > 0 && (
            <Card className="border-border/60 border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {isAr ? "منتجات مطلوبة بمخزون منخفض" : "High-Demand, Low Stock"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0.5">
                  {stockRisk.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {p.quantity_sold} {isAr ? "مبيع" : "sold"} · {formatCurrency(p.revenue)}
                        </p>
                      </div>
                      <span className={`text-[12px] font-bold tabular-nums shrink-0 ${p.current_stock <= 0 ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}>
                        {p.current_stock <= 0 ? (isAr ? "نفذ" : "OUT") : `${p.current_stock} ${isAr ? "متبقي" : "left"}`}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dead Stock */}
          {deadStockProducts.length > 0 && (
            <Card className="border-border/60 border-slate-400/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
                  <TrendingDown className="h-3.5 w-3.5" />
                  {isAr ? "منتجات راكدة (بدون مبيعات)" : "Dead Stock (Zero Sales)"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0.5">
                  {deadStockProducts.slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium truncate">{p.name}</p>
                        {p.sku && <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>}
                      </div>
                      <span className="text-[12px] tabular-nums text-muted-foreground shrink-0">
                        {p.current_stock} {isAr ? "في المخزون" : "in stock"}
                      </span>
                    </div>
                  ))}
                  {deadStockProducts.length > 5 && (
                    <p className="text-[10px] text-muted-foreground text-center pt-1">
                      +{deadStockProducts.length - 5} {isAr ? "منتج آخر" : "more products"}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Category Performance */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "أداء الفئات" : "Category Performance"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data && data.categories.length > 0 ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.categories.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${(v / 100).toLocaleString()}`}
                    />
                    <YAxis
                      type="category"
                      dataKey="category_name"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px" }}
                      formatter={(value: number) => [formatCurrency(value), isAr ? "الإيرادات" : "Revenue"]}
                    />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {data.categories.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon={FolderOpen} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>

        {/* Inventory Health */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "صحة المخزون" : "Inventory Health"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inventoryData.length > 0 ? (
              <div className="flex flex-col items-center">
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={inventoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {inventoryData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px" }}
                        formatter={(value: number, name: string) => [`${value} (${totalInventory > 0 ? ((value / totalInventory) * 100).toFixed(1) : 0}%)`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-1">
                  {inventoryData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                      <span className="text-[11px] text-muted-foreground">{d.name}</span>
                      <span className="text-[11px] font-semibold tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState icon={Package} title={isAr ? "مفيش بيانات" : "No data"} className="py-6" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
