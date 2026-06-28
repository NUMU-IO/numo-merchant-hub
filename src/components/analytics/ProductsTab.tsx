import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Package, FolderOpen, AlertTriangle, ArrowUpDown,
  Crown, TrendingDown, BarChart3, Receipt,
  Percent, PackagePlus, ScatterChart as ScatterIcon,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ScatterChart, Scatter, ZAxis,
} from "recharts";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getProductPerformance } from "@/services/analyticsApi";
import type { ProductPerformanceItem } from "@/services/analyticsApi";
import { dateRangeKey } from "@/services/dateRangeParams";
import type { DateRange } from "@/components/filters/DateRangePicker";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAnalyticsContext } from "./AnalyticsLayout";
import { downloadCsv } from "@/lib/csvDownload";
import { ProductDetailDrawer } from "./ProductDetailDrawer";

interface ProductsTabProps {
  range: DateRange;
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

export function ProductsTab({ range, formatCurrency }: ProductsTabProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";
  const [sortBy, setSortBy] = useState<SortBy>("revenue");
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("product");

  const perfQuery = useQuery({
    queryKey: ["analytics", "product-performance", storeId, ...dateRangeKey(range), sortBy],
    queryFn: () => getProductPerformance(storeId!, range, sortBy),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
    // 3 SQL aggregations + a catalog fetch — not free. The data lags by
    // a few minutes anyway given the rollup pipeline.
    staleTime: 5 * 60 * 1000,
  });

  const data = perfQuery.data ?? null;

  // Drawer wiring: the open product is driven by the ?product=<id> URL param
  // so the dashboard Top Sellers widget can deep-link straight into a
  // product's analytics. Clicking a row sets the param; closing clears it.
  const selectedProduct = useMemo<ProductPerformanceItem | null>(
    () => data?.products.find((p) => p.id === selectedId) ?? null,
    [data, selectedId],
  );
  const openProduct = (id: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("product", id);
        return next;
      },
      { replace: true },
    );
  };
  const closeProduct = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("product");
        return next;
      },
      { replace: true },
    );
  };

  // Wire CSV export. Registers a callback the AnalyticsLayout's
  // download button calls. Null while loading so the button hides.
  const { registerExport } = useAnalyticsContext();
  useEffect(() => {
    if (!data) {
      registerExport(null);
      return;
    }
    registerExport(() => {
      downloadCsv(
        `products-${new Date().toISOString().slice(0, 10)}`,
        ["Product", "SKU", "Revenue (cents)", "Units sold", "In stock", "Profit (cents)"],
        data.products.map((p) => [
          p.name,
          p.sku ?? "",
          p.revenue,
          p.quantity_sold,
          p.current_stock,
          p.profit ?? "",
        ]),
      );
    });
    return () => registerExport(null);
  }, [data, registerExport]);

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

  // Profit aggregation across products with cost_price set
  const profitableProducts = (data?.products ?? []).filter((p) => p.profit !== null);
  const totalProfit = profitableProducts.reduce((sum, p) => sum + (p.profit ?? 0), 0);
  const profitableRevenue = profitableProducts.reduce((sum, p) => sum + p.revenue, 0);
  const overallMargin = profitableRevenue > 0 ? (totalProfit / profitableRevenue) * 100 : 0;
  const productsWithoutCost = totalProducts - profitableProducts.length;

  // Revenue concentration: % from top 20% of products
  const top20Count = Math.max(1, Math.ceil(totalProducts * 0.2));
  const sortedByRev = [...(data?.products ?? [])].sort((a, b) => b.revenue - a.revenue);
  const top20Revenue = sortedByRev.slice(0, top20Count).reduce((sum, p) => sum + p.revenue, 0);
  const concentrationPct = totalRevenue > 0 ? (top20Revenue / totalRevenue) * 100 : 0;

  // Dead stock products (have stock, zero sales)
  const deadStockProducts = (data?.products ?? [])
    .filter((p) => p.current_stock > 0 && p.quantity_sold === 0);

  // ── Profit & margin leaders ─────────────────────────────────────────
  // Only products with a cost price set have profit/margin. Surface the
  // best earners and the thinnest margins (where a price bump pays off).
  const withProfit = (data?.products ?? []).filter((p) => p.profit !== null);
  const profitLeaders = [...withProfit]
    .sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0))
    .slice(0, 5);
  const thinMargins = [...withProfit]
    .filter((p) => p.quantity_sold > 0)
    .sort((a, b) => (a.margin_percent ?? 0) - (b.margin_percent ?? 0))
    .slice(0, 5);

  // ── Restock suggestions ─────────────────────────────────────────────
  // Days-of-cover = current_stock / daily velocity over the selected range.
  // Flag the fastest-to-empty sellers (< 21 days of cover, still has sales).
  const periodDays = Math.max(
    1,
    Math.round(
      (range.end.getTime() - range.start.getTime()) / 86_400_000,
    ),
  );
  const restock = (data?.products ?? [])
    .filter((p) => p.quantity_sold > 0 && p.current_stock > 0)
    .map((p) => {
      const dailyVelocity = p.quantity_sold / periodDays;
      const daysLeft = dailyVelocity > 0 ? p.current_stock / dailyVelocity : Infinity;
      return { ...p, dailyVelocity, daysLeft };
    })
    .filter((p) => p.daysLeft < 21)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 6);

  // ── Price vs. volume scatter ────────────────────────────────────────
  // Avg selling price (revenue / units) against units sold. Top-right =
  // premium bestsellers; bottom-right = cheap high-volume movers.
  const scatterData = (data?.products ?? [])
    .filter((p) => p.quantity_sold > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.quantity_sold > 0 ? p.revenue / p.quantity_sold / 100 : 0,
      units: p.quantity_sold,
      revenue: p.revenue,
    }));

  const sortLabels: Record<SortBy, string> = {
    revenue: isAr ? "الإيرادات" : "Revenue",
    quantity: isAr ? "الكمية" : "Quantity",
    name: isAr ? "الاسم" : "Name",
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      {data && data.products.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                  {isAr ? "إجمالي الربح" : "Total Profit"}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Receipt className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalProfit)}</p>
              <p className="text-[10px] text-muted-foreground">
                {profitableProducts.length === 0
                  ? (isAr ? "حدد التكلفة لرؤية الربح" : "Set costs to see profit")
                  : (isAr
                      ? `هامش ${overallMargin.toFixed(1)}%${productsWithoutCost > 0 ? ` · ${productsWithoutCost} بدون تكلفة` : ""}`
                      : `${overallMargin.toFixed(1)}% margin${productsWithoutCost > 0 ? ` · ${productsWithoutCost} no cost` : ""}`)}
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
                    <th className="text-end font-medium text-muted-foreground p-2">{isAr ? "الربح" : "Profit"}</th>
                    <th className="text-end font-medium text-muted-foreground p-2">{isAr ? "هامش" : "Margin"}</th>
                    <th className="text-end font-medium text-muted-foreground p-2">{isAr ? "المبيع" : "Sold"}</th>
                    <th className="text-end font-medium text-muted-foreground p-2">{isAr ? "المخزون" : "Stock"}</th>
                    <th className="text-center font-medium text-muted-foreground p-2">{isAr ? "الاتجاه" : "Trend"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => openProduct(p.id)}
                      title={isAr ? "اعرض تحليلات المنتج" : "View product analytics"}
                    >
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-muted grid place-items-center ring-1 ring-border/30">
                            {p.image_url ? (
                              <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[180px]">{p.name}</p>
                            {p.sku && <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="text-end p-2 font-semibold tabular-nums">{formatCurrency(p.revenue)}</td>
                      <td className="text-end p-2 tabular-nums">
                        {p.profit !== null ? (
                          <span className={p.profit >= 0 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-destructive font-medium"}>
                            {formatCurrency(p.profit)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="text-end p-2 tabular-nums">
                        {p.margin_percent !== null ? (
                          <span className="text-muted-foreground">{p.margin_percent.toFixed(1)}%</span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
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

      {/* Profit & Margin leaders */}
      {withProfit.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Profit leaders */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-amber-500" />
                {isAr ? "أعلى ربح" : "Profit Leaders"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0.5">
                {profitLeaders.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openProduct(p.id)}
                    className="flex w-full items-center gap-2.5 rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors text-start"
                  >
                    <span className="text-[12px] font-extrabold text-muted-foreground/50 w-4 text-center tabular-nums">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {p.margin_percent !== null ? `${p.margin_percent.toFixed(1)}% ${isAr ? "هامش" : "margin"}` : ""}
                      </p>
                    </div>
                    <span className="text-[12px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">
                      {formatCurrency(p.profit ?? 0)}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Thin margins — pricing opportunities */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5 text-violet-500" />
                {isAr ? "أقل هامش ربح" : "Thinnest Margins"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0.5">
                {thinMargins.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openProduct(p.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg p-2 -mx-2 hover:bg-muted/50 transition-colors text-start"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {p.quantity_sold} {isAr ? "مبيع" : "sold"} · {formatCurrency(p.revenue)}
                      </p>
                    </div>
                    <span className={`text-[12px] font-bold tabular-nums shrink-0 ${(p.margin_percent ?? 0) < 10 ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}>
                      {p.margin_percent !== null ? `${p.margin_percent.toFixed(1)}%` : "—"}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                {isAr ? "فكّر في رفع السعر أو خفض التكلفة لهذه المنتجات" : "Consider a price bump or lower cost on these"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Inventory action + price positioning — paired into two columns */}
      <div className="grid gap-4 lg:grid-cols-2 items-start">
      {restock.length > 0 && (
        <Card className="border-border/60 border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <PackagePlus className="h-3.5 w-3.5" />
              {isAr ? "اقتراحات إعادة التخزين" : "Restock Suggestions"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {restock.map((p) => {
                const days = Math.floor(p.daysLeft);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openProduct(p.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-border/60 p-2.5 hover:bg-muted/40 transition-colors text-start"
                  >
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-muted grid place-items-center ring-1 ring-border/30">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {p.current_stock} {isAr ? "متبقي" : "left"} · {p.quantity_sold} {isAr ? "مبيع" : "sold"}
                      </p>
                    </div>
                    <span className={`text-[11px] font-bold tabular-nums shrink-0 ${days <= 7 ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}>
                      {isAr ? `~${days}ي` : `~${days}d`}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {isAr
                ? "تقدير أيام نفاد المخزون حسب سرعة البيع في الفترة المحددة"
                : "Estimated days until out of stock, based on sales velocity this period"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Price vs. volume scatter */}
      {scatterData.length >= 2 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <ScatterIcon className="h-3.5 w-3.5 text-muted-foreground" />
              {isAr ? "السعر مقابل الكمية" : "Price vs. Volume"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 16, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis
                    type="number"
                    dataKey="units"
                    name={isAr ? "الكمية" : "Units"}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: isAr ? "الكمية المباعة" : "Units sold", position: "insideBottom", offset: -8, fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    type="number"
                    dataKey="price"
                    name={isAr ? "السعر" : "Price"}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    tickFormatter={(v) => `${v.toLocaleString()}`}
                  />
                  <ZAxis type="number" dataKey="revenue" range={[40, 400]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px" }}
                    formatter={(value: number, name: string) => {
                      if (name === (isAr ? "السعر" : "Price")) return [formatCurrency(value * 100), name];
                      return [value, name];
                    }}
                    labelFormatter={() => ""}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as { name: string; price: number; units: number };
                      return (
                        <div className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] shadow-pop">
                          <p className="font-semibold truncate max-w-[160px]">{d.name}</p>
                          <p className="text-muted-foreground">{formatCurrency(d.price * 100)} · {d.units} {isAr ? "مبيع" : "sold"}</p>
                        </div>
                      );
                    }}
                  />
                  <Scatter
                    data={scatterData}
                    fill="hsl(var(--navy))"
                    fillOpacity={0.6}
                    onClick={(e: { id?: string; payload?: { id?: string } }) => {
                      const id = e?.payload?.id ?? e?.id;
                      if (id) openProduct(id);
                    }}
                    className="cursor-pointer"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground text-center">
              {isAr
                ? "حجم النقطة = الإيراد · أعلى يمين = منتجات مميزة عالية المبيعات"
                : "Bubble size = revenue · top-right = premium bestsellers"}
            </p>
          </CardContent>
        </Card>
      )}
      </div>

      {/* Dead stock — has inventory but zero sales this period (rare) */}
      {deadStockProducts.length > 0 && (
        <Card className="border-border/60 border-slate-400/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
              <TrendingDown className="h-3.5 w-3.5" />
              {isAr ? "منتجات راكدة (بدون مبيعات)" : "Dead Stock (Zero Sales)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {deadStockProducts.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2.5">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium truncate">{p.name}</p>
                    {p.sku && <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>}
                  </div>
                  <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                    {p.current_stock} {isAr ? "بالمخزون" : "in stock"}
                  </span>
                </div>
              ))}
            </div>
            {deadStockProducts.length > 6 && (
              <p className="mt-2 text-[10px] text-muted-foreground text-center">
                +{deadStockProducts.length - 6} {isAr ? "منتج آخر" : "more products"}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <ProductDetailDrawer
        product={selectedProduct}
        open={!!selectedProduct}
        onOpenChange={(o) => { if (!o) closeProduct(); }}
        formatCurrency={formatCurrency}
        isAr={isAr}
      />
    </div>
  );
}
