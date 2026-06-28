import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Package,
  Pencil,
  TrendingUp,
  Receipt,
  Boxes,
  Tag,
  AlertTriangle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  CartesianGrid,
} from "recharts";
import type { ProductPerformanceItem } from "@/services/analyticsApi";

interface ProductDetailDrawerProps {
  product: ProductPerformanceItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatCurrency: (cents: number) => string;
  isAr: boolean;
}

/**
 * Slide-in per-product analytics panel. Opens from a Product Performance
 * row click or from the dashboard Top Sellers widget (via ?product=<id>).
 * Reuses the row data already loaded by the table — no extra fetch.
 */
export function ProductDetailDrawer({
  product,
  open,
  onOpenChange,
  formatCurrency,
  isAr,
}: ProductDetailDrawerProps) {
  const navigate = useNavigate();

  if (!product) return null;

  const avgPrice =
    product.quantity_sold > 0
      ? Math.round(product.revenue / product.quantity_sold)
      : 0;

  // Last-7-days revenue trend (cents). Label as relative days so the chart
  // reads left→old, right→today without needing the server to send dates.
  const trend = product.revenue_trend.map((v, i) => ({
    label:
      i === product.revenue_trend.length - 1
        ? isAr
          ? "النهاردة"
          : "Today"
        : `-${product.revenue_trend.length - 1 - i}${isAr ? "ي" : "d"}`,
    revenue: v / 100,
  }));
  const hasTrend = trend.some((p) => p.revenue > 0);

  const stockState =
    product.current_stock <= 0
      ? "out"
      : product.current_stock <= 5
        ? "low"
        : "ok";

  const stockBadge = {
    out: {
      text: isAr ? "نفذ المخزون" : "Out of stock",
      cls: "bg-destructive/10 text-destructive",
    },
    low: {
      text: isAr ? "مخزون منخفض" : "Low stock",
      cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    ok: {
      text: isAr ? "متوفر" : "In stock",
      cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
  }[stockState];

  const kpis = [
    {
      label: isAr ? "الإيرادات" : "Revenue",
      value: formatCurrency(product.revenue),
      icon: TrendingUp,
      tint: "text-navy",
    },
    {
      label: isAr ? "الوحدات المباعة" : "Units sold",
      value: String(product.quantity_sold),
      icon: Boxes,
      tint: "text-blue-600 dark:text-blue-400",
    },
    {
      label: isAr ? "متوسط السعر" : "Avg. price",
      value: formatCurrency(avgPrice),
      icon: Tag,
      tint: "text-violet-600 dark:text-violet-400",
    },
    {
      label: isAr ? "الربح" : "Profit",
      value: product.profit !== null ? formatCurrency(product.profit) : "—",
      icon: Receipt,
      tint:
        product.profit !== null && product.profit >= 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-destructive",
      sub:
        product.margin_percent !== null
          ? `${product.margin_percent.toFixed(1)}% ${isAr ? "هامش" : "margin"}`
          : isAr
            ? "حدد التكلفة"
            : "Set cost price",
    },
    {
      label: isAr ? "المخزون" : "Stock",
      value: String(product.current_stock),
      icon: Package,
      tint:
        stockState === "out"
          ? "text-destructive"
          : stockState === "low"
            ? "text-amber-600 dark:text-amber-400"
            : "text-foreground",
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader className="text-start">
          <div className="flex items-center gap-3 pe-8">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted grid place-items-center ring-1 ring-border/40">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate text-[17px]">
                {product.name}
              </SheetTitle>
              <div className="mt-1 flex items-center gap-2">
                {product.sku && (
                  <span className="text-[11px] font-mono text-muted-foreground truncate">
                    {product.sku}
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stockBadge.cls}`}
                >
                  {stockBadge.text}
                </span>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* KPI grid */}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-xl border border-border/60 bg-card p-3"
            >
              <div className="flex items-center gap-1.5">
                <k.icon className={`h-3.5 w-3.5 ${k.tint}`} />
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {k.label}
                </p>
              </div>
              <p className="mt-1.5 text-lg font-bold tabular-nums">{k.value}</p>
              {k.sub && (
                <p className="text-[10px] text-muted-foreground">{k.sub}</p>
              )}
            </div>
          ))}
        </div>

        {/* 7-day revenue trend */}
        <div className="mt-4 rounded-xl border border-border/60 bg-card p-4">
          <p className="mb-2 text-[12px] font-semibold flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            {isAr ? "الإيرادات آخر ٧ أيام" : "Revenue · last 7 days"}
          </p>
          <div className="h-[140px]">
            {hasTrend ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="pdTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--navy))"
                        stopOpacity={0.18}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--navy))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 5"
                    className="stroke-border/40"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "10px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [
                      formatCurrency(value * 100),
                      isAr ? "الإيراد" : "Revenue",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--navy))"
                    fill="url(#pdTrend)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                <AlertTriangle className="h-4 w-4 mb-1 opacity-50" />
                <p className="text-[11px]">
                  {isAr ? "لا مبيعات في آخر ٧ أيام" : "No sales in the last 7 days"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex gap-2">
          <Button
            className="flex-1 gap-1.5"
            onClick={() => navigate(`/products/${product.id}/edit`)}
          >
            <Pencil className="h-3.5 w-3.5" />
            {isAr ? "تعديل المنتج" : "Edit product"}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate("/orders")}
          >
            {isAr ? "كل الطلبات" : "View orders"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
