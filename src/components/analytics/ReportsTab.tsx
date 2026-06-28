import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter,
} from "@/components/ui/table";
import {
  Search, Filter, Columns3, FileText, Calendar, Package,
  Wallet, Users, Megaphone, Tag, MapPin, CreditCard, Truck,
  ShoppingBag, FolderOpen, BadgeDollarSign, Crown, Repeat,
  TrendingUp, Target, Globe,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useAnalyticsContext } from "./AnalyticsLayout";
import { downloadCsv } from "@/lib/csvDownload";
import {
  getSalesChart, getRevenueBreakdown, getOrdersBreakdown,
  getProductPerformance, getMarketingAttribution, getSalesByLocation,
  getCustomerAnalytics, getCustomerSegments, getTrafficSources,
} from "@/services/analyticsApi";
import { dateRangeKey } from "@/services/dateRangeParams";
import { dateRangeSummary, type DateRange } from "@/components/filters/DateRangePicker";
import type { LucideIcon } from "lucide-react";

interface ReportsTabProps {
  range: DateRange;
  formatCurrency: (cents: number) => string;
}

type Category = "sales" | "inventory" | "finance" | "customers" | "marketing";

interface ReportDef {
  id: string;
  label: { en: string; ar: string };
  icon: LucideIcon;
}

const SALES_REPORTS: ReportDef[] = [
  { id: "periods", label: { en: "Periods", ar: "الفترات" }, icon: Calendar },
  { id: "channels", label: { en: "Sales Channels", ar: "قنوات البيع" }, icon: Megaphone },
  { id: "products", label: { en: "Products", ar: "المنتجات" }, icon: Package },
  { id: "categories", label: { en: "Categories", ar: "التصنيفات" }, icon: FolderOpen },
  { id: "coupons", label: { en: "Discount Coupons", ar: "قسائم الخصم" }, icon: Tag },
  { id: "cities", label: { en: "Cities", ar: "المدن" }, icon: MapPin },
  { id: "payment", label: { en: "Payment Methods", ar: "وسائل الدفع" }, icon: CreditCard },
  { id: "shipping", label: { en: "Shipping Methods", ar: "وسائل الشحن" }, icon: Truck },
];

const INVENTORY_REPORTS: ReportDef[] = [
  { id: "stock", label: { en: "Inventory Status", ar: "حالة المخزون" }, icon: Package },
  { id: "low-stock", label: { en: "Low / Out of Stock", ar: "مخزون منخفض / نفذ" }, icon: ShoppingBag },
  { id: "categories", label: { en: "By Category", ar: "حسب التصنيف" }, icon: FolderOpen },
];

const FINANCE_REPORTS: ReportDef[] = [
  { id: "overview", label: { en: "Revenue Breakdown", ar: "تفاصيل الإيرادات" }, icon: BadgeDollarSign },
  { id: "payment", label: { en: "Payment Methods", ar: "وسائل الدفع" }, icon: CreditCard },
  { id: "coupons", label: { en: "Discount Coupons", ar: "قسائم الخصم" }, icon: Tag },
  { id: "daily", label: { en: "Daily Cash Flow", ar: "التدفق النقدي اليومي" }, icon: Calendar },
];

const CUSTOMERS_REPORTS: ReportDef[] = [
  { id: "overview", label: { en: "Overview", ar: "نظرة عامة" }, icon: Users },
  { id: "segments", label: { en: "Segments (RFM)", ar: "شرائح العملاء" }, icon: Target },
  { id: "clv", label: { en: "Lifetime Value", ar: "القيمة الدائمة" }, icon: Crown },
  { id: "cohorts", label: { en: "Retention", ar: "الاحتفاظ" }, icon: Repeat },
];

const MARKETING_REPORTS: ReportDef[] = [
  { id: "channels", label: { en: "Channels", ar: "القنوات" }, icon: Megaphone },
  { id: "campaigns", label: { en: "Campaigns", ar: "الحملات" }, icon: TrendingUp },
  { id: "traffic", label: { en: "Traffic Sources", ar: "مصادر الزيارات" }, icon: Globe },
];

interface ColumnDef {
  key: string;
  label: { en: string; ar: string };
  align?: "start" | "end";
  format?: (v: number, fmt: (cents: number) => string, isAr: boolean) => string;
}

interface ReportRow {
  key: string;
  label: string;
  badge?: string;
  values: Record<string, number | null>;
}

interface ReportData {
  rows: ReportRow[];
  columns: ColumnDef[];
  totals?: Record<string, number | null>;
  groupHeader: { en: string; ar: string };
}

const num = (v: number, _fmt: (c: number) => string, isAr: boolean) =>
  v.toLocaleString(isAr ? "ar-EG" : undefined);
const cur = (v: number, fmt: (c: number) => string) => fmt(v);
const pct = (v: number, _fmt: (c: number) => string, isAr: boolean) =>
  `${v.toFixed(1).toString().replace(".", isAr ? "٫" : ".")}%`;

const ORDER_COL: ColumnDef = {
  key: "orders", label: { en: "Orders", ar: "عدد الطلبات" }, align: "end", format: num,
};
const AVG_BASKET_COL: ColumnDef = {
  key: "avg_basket", label: { en: "Avg Basket", ar: "متوسط حجم السلة" }, align: "end", format: cur,
};
const SALES_COL: ColumnDef = {
  key: "sales", label: { en: "Total Sales", ar: "إجمالي المبيعات" }, align: "end", format: cur,
};
const NET_REVENUE_COL: ColumnDef = {
  key: "net", label: { en: "Net Revenue", ar: "صافي الإيرادات" }, align: "end", format: cur,
};
const COGS_COL: ColumnDef = {
  key: "cogs", label: { en: "COGS", ar: "تكلفة السلع المباعة" }, align: "end", format: cur,
};
const DISCOUNTS_COL: ColumnDef = {
  key: "discounts", label: { en: "Discounts", ar: "الخصومات" }, align: "end", format: cur,
};

export function ReportsTab({ range, formatCurrency }: ReportsTabProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const [category, setCategory] = useState<Category>("sales");
  const [reportId, setReportId] = useState<string>("periods");
  const [search, setSearch] = useState("");
  const rangeKey = useMemo(() => dateRangeKey(range), [range]);

  const reports =
    category === "sales" ? SALES_REPORTS :
    category === "inventory" ? INVENTORY_REPORTS :
    category === "finance" ? FINANCE_REPORTS :
    category === "customers" ? CUSTOMERS_REPORTS :
    category === "marketing" ? MARKETING_REPORTS :
    [];

  // Reset sub-tab when category changes
  useEffect(() => {
    if (reports.length > 0 && !reports.find((r) => r.id === reportId)) {
      setReportId(reports[0].id);
    }
  }, [category, reportId, reports]);

  // Date range label (for "التاريخ" pill in screenshot)
  const dateRangeLabel = useMemo(
    () => dateRangeSummary(range, isAr ? "ar" : "en"),
    [range, isAr],
  );

  // Data fetches — only the one needed for the active sub-tab actually fires
  const salesChartQuery = useQuery({
    queryKey: ["analytics", "chart", storeId, ...rangeKey],
    queryFn: () => getSalesChart(storeId!, range),
    enabled: !!storeId && (
      (category === "sales" && reportId === "periods") ||
      (category === "finance" && reportId === "daily")
    ),
    placeholderData: keepPreviousData,
  });

  const channelsQuery = useQuery({
    queryKey: ["analytics", "marketing-attribution", storeId, ...rangeKey],
    queryFn: () => getMarketingAttribution(storeId!, range),
    enabled: !!storeId && (
      (category === "sales" && reportId === "channels") ||
      (category === "marketing" && (reportId === "channels" || reportId === "campaigns"))
    ),
    placeholderData: keepPreviousData,
  });

  const productsQuery = useQuery({
    queryKey: ["analytics", "product-performance", storeId, ...rangeKey, "revenue"],
    queryFn: () => getProductPerformance(storeId!, range, "revenue"),
    enabled: !!storeId &&
      ((category === "sales" && (reportId === "products" || reportId === "categories")) ||
       category === "inventory"),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });

  const revenueBreakdownQuery = useQuery({
    queryKey: ["analytics", "revenue-breakdown", storeId, ...rangeKey],
    queryFn: () => getRevenueBreakdown(storeId!, range),
    enabled: !!storeId && (
      (category === "sales" && reportId === "coupons") ||
      (category === "finance" && (reportId === "overview" || reportId === "coupons"))
    ),
    placeholderData: keepPreviousData,
  });

  const citiesQuery = useQuery({
    queryKey: ["analytics", "sales-by-location", storeId, ...rangeKey],
    queryFn: () => getSalesByLocation(storeId!, range),
    enabled: !!storeId && category === "sales" && reportId === "cities",
    placeholderData: keepPreviousData,
  });

  const ordersBreakdownQuery = useQuery({
    queryKey: ["analytics", "orders-breakdown", storeId, ...rangeKey],
    queryFn: () => getOrdersBreakdown(storeId!, range),
    enabled: !!storeId && (
      (category === "sales" && reportId === "payment") ||
      (category === "finance" && reportId === "payment")
    ),
    placeholderData: keepPreviousData,
  });

  const customerStatsQuery = useQuery({
    queryKey: ["analytics", "customers", storeId, ...rangeKey],
    queryFn: () => getCustomerAnalytics(storeId!, range),
    enabled: !!storeId && category === "customers" && reportId === "overview",
    placeholderData: keepPreviousData,
  });

  const customerSegmentsQuery = useQuery({
    queryKey: ["analytics", "customer-segments", storeId, ...rangeKey],
    queryFn: () => getCustomerSegments(storeId!, range),
    enabled: !!storeId && category === "customers" && (
      reportId === "segments" || reportId === "clv" || reportId === "cohorts"
    ),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });

  const trafficSourcesQuery = useQuery({
    queryKey: ["analytics", "traffic-sources", storeId, ...rangeKey],
    queryFn: () => getTrafficSources(storeId!, range),
    enabled: !!storeId && category === "marketing" && reportId === "traffic",
    placeholderData: keepPreviousData,
  });

  // Build report data based on the active selection
  const reportData: ReportData | null = useMemo(() => {
    if (category === "sales") {
      if (reportId === "periods") {
        const points = salesChartQuery.data ?? [];
        const rows: ReportRow[] = points.map((p) => ({
          key: p.date,
          label: new Date(p.date).toLocaleDateString(isAr ? "ar-EG" : "en-US", {
            year: "numeric", month: "short", day: "numeric",
          }),
          values: {
            orders: p.orders,
            avg_basket: p.orders > 0 ? Math.round(p.sales / p.orders) : 0,
            sales: p.sales,
          },
        }));
        const totalOrders = rows.reduce((s, r) => s + (r.values.orders ?? 0), 0);
        const totalSales = rows.reduce((s, r) => s + (r.values.sales ?? 0), 0);
        return {
          rows,
          columns: [ORDER_COL, AVG_BASKET_COL, SALES_COL],
          totals: {
            orders: totalOrders,
            avg_basket: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
            sales: totalSales,
          },
          groupHeader: { en: "Date", ar: "التاريخ" },
        };
      }

      if (reportId === "channels") {
        const channels = channelsQuery.data?.channels ?? [];
        const rows: ReportRow[] = channels.map((c) => ({
          key: c.channel,
          label: channelLabel(c.channel, isAr),
          values: {
            orders: c.orders,
            visits: c.visits,
            avg_basket: c.orders > 0 ? Math.round(c.revenue / c.orders) : 0,
            sales: c.revenue,
            conversion: c.conversion_rate,
          },
        }));
        const totalOrders = rows.reduce((s, r) => s + (r.values.orders ?? 0), 0);
        const totalSales = rows.reduce((s, r) => s + (r.values.sales ?? 0), 0);
        return {
          rows,
          columns: [
            { key: "visits", label: { en: "Visits", ar: "الزيارات" }, align: "end", format: num },
            ORDER_COL,
            AVG_BASKET_COL,
            SALES_COL,
            { key: "conversion", label: { en: "Conversion", ar: "نسبة التحويل" }, align: "end", format: pct },
          ],
          totals: {
            visits: rows.reduce((s, r) => s + (r.values.visits ?? 0), 0),
            orders: totalOrders,
            avg_basket: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
            sales: totalSales,
            conversion: null,
          },
          groupHeader: { en: "Channel", ar: "القناة" },
        };
      }

      if (reportId === "products") {
        const products = productsQuery.data?.products ?? [];
        const rows: ReportRow[] = products.map((p) => ({
          key: p.id,
          label: p.name,
          badge: p.sku ?? undefined,
          values: {
            orders: p.quantity_sold,
            avg_basket: p.quantity_sold > 0 ? Math.round(p.revenue / p.quantity_sold) : 0,
            sales: p.revenue,
            cogs: p.cost_price !== null ? p.cost_price * p.quantity_sold : null,
            net: p.profit,
          },
        }));
        const totalUnits = rows.reduce((s, r) => s + (r.values.orders ?? 0), 0);
        const totalSales = rows.reduce((s, r) => s + (r.values.sales ?? 0), 0);
        const totalCogs = rows.reduce((s, r) => s + (r.values.cogs ?? 0), 0);
        const totalNet = rows.reduce((s, r) => s + (r.values.net ?? 0), 0);
        return {
          rows,
          columns: [
            { key: "orders", label: { en: "Units sold", ar: "الكمية المباعة" }, align: "end", format: num },
            AVG_BASKET_COL,
            SALES_COL,
            COGS_COL,
            NET_REVENUE_COL,
          ],
          totals: {
            orders: totalUnits,
            avg_basket: totalUnits > 0 ? Math.round(totalSales / totalUnits) : 0,
            sales: totalSales,
            cogs: totalCogs,
            net: totalNet,
          },
          groupHeader: { en: "Product", ar: "المنتج" },
        };
      }

      if (reportId === "categories") {
        const cats = productsQuery.data?.categories ?? [];
        const rows: ReportRow[] = cats.map((c) => ({
          key: c.category_id ?? c.category_name,
          label: c.category_name,
          values: {
            products: c.product_count,
            orders: c.quantity_sold,
            avg_basket: c.quantity_sold > 0 ? Math.round(c.revenue / c.quantity_sold) : 0,
            sales: c.revenue,
          },
        }));
        return {
          rows,
          columns: [
            { key: "products", label: { en: "Products", ar: "عدد المنتجات" }, align: "end", format: num },
            { key: "orders", label: { en: "Units sold", ar: "الكمية المباعة" }, align: "end", format: num },
            AVG_BASKET_COL,
            SALES_COL,
          ],
          totals: {
            products: rows.reduce((s, r) => s + (r.values.products ?? 0), 0),
            orders: rows.reduce((s, r) => s + (r.values.orders ?? 0), 0),
            avg_basket: null,
            sales: rows.reduce((s, r) => s + (r.values.sales ?? 0), 0),
          },
          groupHeader: { en: "Category", ar: "التصنيف" },
        };
      }

      if (reportId === "coupons") {
        const coupons = revenueBreakdownQuery.data?.coupon_usage ?? [];
        const rows: ReportRow[] = coupons.map((c) => ({
          key: c.code,
          label: c.code,
          values: {
            uses: c.uses,
            discounts: c.revenue_impact,
          },
        }));
        return {
          rows,
          columns: [
            { key: "uses", label: { en: "Uses", ar: "مرات الاستخدام" }, align: "end", format: num },
            DISCOUNTS_COL,
          ],
          totals: {
            uses: rows.reduce((s, r) => s + (r.values.uses ?? 0), 0),
            discounts: rows.reduce((s, r) => s + (r.values.discounts ?? 0), 0),
          },
          groupHeader: { en: "Coupon", ar: "الكوبون" },
        };
      }

      if (reportId === "cities") {
        const locs = citiesQuery.data ?? [];
        const rows: ReportRow[] = locs.map((l) => ({
          key: l.location,
          label: l.location || (isAr ? "غير محدد" : "Unknown"),
          values: {
            orders: l.orders,
            avg_basket: l.orders > 0 ? Math.round(l.sales / l.orders) : 0,
            sales: l.sales,
            share: l.percentage,
          },
        }));
        const totalOrders = rows.reduce((s, r) => s + (r.values.orders ?? 0), 0);
        const totalSales = rows.reduce((s, r) => s + (r.values.sales ?? 0), 0);
        return {
          rows,
          columns: [
            ORDER_COL,
            AVG_BASKET_COL,
            SALES_COL,
            { key: "share", label: { en: "Share", ar: "النسبة" }, align: "end", format: pct },
          ],
          totals: {
            orders: totalOrders,
            avg_basket: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
            sales: totalSales,
            share: null,
          },
          groupHeader: { en: "City", ar: "المدينة" },
        };
      }

      if (reportId === "payment") {
        const methods = ordersBreakdownQuery.data?.by_payment_method ?? [];
        const rows: ReportRow[] = methods.map((m) => ({
          key: m.method,
          label: paymentMethodLabel(m.method, isAr),
          values: {
            orders: m.count,
            avg_basket: m.count > 0 ? Math.round(m.revenue / m.count) : 0,
            sales: m.revenue,
          },
        }));
        const totalOrders = rows.reduce((s, r) => s + (r.values.orders ?? 0), 0);
        const totalSales = rows.reduce((s, r) => s + (r.values.sales ?? 0), 0);
        return {
          rows,
          columns: [ORDER_COL, AVG_BASKET_COL, SALES_COL],
          totals: {
            orders: totalOrders,
            avg_basket: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
            sales: totalSales,
          },
          groupHeader: { en: "Payment Method", ar: "وسيلة الدفع" },
        };
      }

      if (reportId === "shipping") {
        // No backend endpoint yet — render as a "soon" report.
        return null;
      }
    }

    if (category === "inventory") {
      const data = productsQuery.data;
      if (reportId === "stock") {
        const products = data?.products ?? [];
        const rows: ReportRow[] = products.map((p) => ({
          key: p.id,
          label: p.name,
          badge: p.sku ?? undefined,
          values: {
            stock: p.current_stock,
            sold: p.quantity_sold,
            value: p.cost_price !== null ? p.cost_price * p.current_stock : null,
            sales: p.revenue,
          },
        }));
        return {
          rows,
          columns: [
            { key: "stock", label: { en: "In stock", ar: "المتوفر" }, align: "end", format: num },
            { key: "sold", label: { en: "Sold", ar: "المباع" }, align: "end", format: num },
            { key: "value", label: { en: "Stock value", ar: "قيمة المخزون" }, align: "end", format: cur },
            SALES_COL,
          ],
          groupHeader: { en: "Product", ar: "المنتج" },
        };
      }

      if (reportId === "low-stock") {
        const products = (data?.products ?? []).filter((p) => p.current_stock <= 5);
        const rows: ReportRow[] = products.map((p) => ({
          key: p.id,
          label: p.name,
          badge: p.sku ?? undefined,
          values: {
            stock: p.current_stock,
            sold: p.quantity_sold,
            sales: p.revenue,
          },
        }));
        return {
          rows,
          columns: [
            { key: "stock", label: { en: "Remaining", ar: "المتبقي" }, align: "end", format: num },
            { key: "sold", label: { en: "Sold", ar: "المباع" }, align: "end", format: num },
            SALES_COL,
          ],
          groupHeader: { en: "Product", ar: "المنتج" },
        };
      }

      if (reportId === "categories") {
        const cats = data?.categories ?? [];
        const rows: ReportRow[] = cats.map((c) => ({
          key: c.category_id ?? c.category_name,
          label: c.category_name,
          values: {
            products: c.product_count,
            sold: c.quantity_sold,
            sales: c.revenue,
          },
        }));
        return {
          rows,
          columns: [
            { key: "products", label: { en: "Products", ar: "عدد المنتجات" }, align: "end", format: num },
            { key: "sold", label: { en: "Units sold", ar: "الكمية المباعة" }, align: "end", format: num },
            SALES_COL,
          ],
          groupHeader: { en: "Category", ar: "التصنيف" },
        };
      }
    }

    if (category === "finance") {
      if (reportId === "overview") {
        const r = revenueBreakdownQuery.data;
        if (!r) return { rows: [], columns: [], groupHeader: { en: "Line Item", ar: "البند" } };
        const rows: ReportRow[] = [
          {
            key: "gross",
            label: isAr ? "إجمالي الإيرادات" : "Gross Revenue",
            values: { amount: r.gross_revenue, share: 100 },
          },
          {
            key: "shipping",
            label: isAr ? "الشحن المحصّل" : "Shipping Collected",
            values: {
              amount: r.shipping_collected,
              share: r.gross_revenue > 0 ? (r.shipping_collected / r.gross_revenue) * 100 : 0,
            },
          },
          {
            key: "discounts",
            label: isAr ? "الخصومات" : "Discounts",
            values: {
              amount: -r.discounts,
              share: r.gross_revenue > 0 ? -(r.discounts / r.gross_revenue) * 100 : 0,
            },
          },
          {
            key: "refunds",
            label: isAr ? "المسترد" : "Refunds",
            values: {
              amount: -r.refunds,
              share: r.gross_revenue > 0 ? -(r.refunds / r.gross_revenue) * 100 : 0,
            },
          },
          {
            key: "net",
            label: isAr ? "صافي الإيرادات" : "Net Revenue",
            values: {
              amount: r.net_revenue,
              share: r.gross_revenue > 0 ? (r.net_revenue / r.gross_revenue) * 100 : 0,
            },
          },
        ];
        return {
          rows,
          columns: [
            { key: "amount", label: { en: "Amount", ar: "المبلغ" }, align: "end", format: cur },
            { key: "share", label: { en: "% of Gross", ar: "% من الإجمالي" }, align: "end", format: pct },
          ],
          groupHeader: { en: "Line Item", ar: "البند" },
        };
      }

      if (reportId === "payment") {
        const methods = ordersBreakdownQuery.data?.by_payment_method ?? [];
        const totalOrders = methods.reduce((s, m) => s + m.count, 0);
        const totalRevenue = methods.reduce((s, m) => s + m.revenue, 0);
        const rows: ReportRow[] = methods.map((m) => ({
          key: m.method,
          label: paymentMethodLabel(m.method, isAr),
          values: {
            orders: m.count,
            sales: m.revenue,
            avg_basket: m.count > 0 ? Math.round(m.revenue / m.count) : 0,
            share: totalRevenue > 0 ? (m.revenue / totalRevenue) * 100 : 0,
          },
        }));
        return {
          rows,
          columns: [
            ORDER_COL,
            AVG_BASKET_COL,
            SALES_COL,
            { key: "share", label: { en: "% of Revenue", ar: "% من الإيرادات" }, align: "end", format: pct },
          ],
          totals: {
            orders: totalOrders,
            avg_basket: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
            sales: totalRevenue,
            share: null,
          },
          groupHeader: { en: "Payment Method", ar: "وسيلة الدفع" },
        };
      }

      if (reportId === "coupons") {
        const r = revenueBreakdownQuery.data;
        const coupons = r?.coupon_usage ?? [];
        const rows: ReportRow[] = coupons.map((c) => ({
          key: c.code,
          label: c.code,
          values: {
            uses: c.uses,
            discounts: c.revenue_impact,
            avg_discount: c.uses > 0 ? Math.round(c.revenue_impact / c.uses) : 0,
          },
        }));
        return {
          rows,
          columns: [
            { key: "uses", label: { en: "Uses", ar: "مرات الاستخدام" }, align: "end", format: num },
            { key: "avg_discount", label: { en: "Avg Discount", ar: "متوسط الخصم" }, align: "end", format: cur },
            DISCOUNTS_COL,
          ],
          totals: {
            uses: rows.reduce((s, x) => s + (x.values.uses ?? 0), 0),
            avg_discount: null,
            discounts: rows.reduce((s, x) => s + (x.values.discounts ?? 0), 0),
          },
          groupHeader: { en: "Coupon", ar: "الكوبون" },
        };
      }

      if (reportId === "daily") {
        const points = salesChartQuery.data ?? [];
        const rows: ReportRow[] = points.map((p) => ({
          key: p.date,
          label: new Date(p.date).toLocaleDateString(isAr ? "ar-EG" : "en-US", {
            year: "numeric", month: "short", day: "numeric",
          }),
          values: {
            orders: p.orders,
            sales: p.sales,
            avg_basket: p.orders > 0 ? Math.round(p.sales / p.orders) : 0,
          },
        }));
        const totalOrders = rows.reduce((s, x) => s + (x.values.orders ?? 0), 0);
        const totalSales = rows.reduce((s, x) => s + (x.values.sales ?? 0), 0);
        return {
          rows,
          columns: [ORDER_COL, AVG_BASKET_COL, SALES_COL],
          totals: {
            orders: totalOrders,
            avg_basket: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
            sales: totalSales,
          },
          groupHeader: { en: "Date", ar: "التاريخ" },
        };
      }
    }

    if (category === "customers") {
      if (reportId === "overview") {
        const c = customerStatsQuery.data;
        if (!c) return { rows: [], columns: [], groupHeader: { en: "Metric", ar: "المؤشر" } };
        const rows: ReportRow[] = [
          {
            key: "total",
            label: isAr ? "إجمالي العملاء" : "Total Customers",
            values: { count: c.total_customers, share: null, amount: null },
          },
          {
            key: "new",
            label: isAr ? "عملاء جدد" : "New Customers",
            values: {
              count: c.new_customers,
              share: c.total_customers > 0 ? (c.new_customers / c.total_customers) * 100 : 0,
              amount: null,
            },
          },
          {
            key: "returning",
            label: isAr ? "عملاء مكرّرون" : "Returning Customers",
            values: {
              count: c.returning_customers,
              share: c.total_customers > 0 ? (c.returning_customers / c.total_customers) * 100 : 0,
              amount: null,
            },
          },
          {
            key: "avg",
            label: isAr ? "متوسط قيمة العميل" : "Avg Customer Value",
            values: { count: null, share: null, amount: c.avg_customer_value },
          },
        ];
        return {
          rows,
          columns: [
            { key: "count", label: { en: "Count", ar: "العدد" }, align: "end", format: num },
            { key: "share", label: { en: "% of Total", ar: "% من الإجمالي" }, align: "end", format: pct },
            { key: "amount", label: { en: "Amount", ar: "القيمة" }, align: "end", format: cur },
          ],
          groupHeader: { en: "Metric", ar: "المؤشر" },
        };
      }

      if (reportId === "segments") {
        const segs = customerSegmentsQuery.data?.segments ?? [];
        const rows: ReportRow[] = segs.map((s) => ({
          key: s.segment,
          label: segmentLabel(s.segment, isAr),
          values: {
            count: s.count,
            share: s.percentage,
            avg_orders: s.avg_orders,
            avg_revenue: s.avg_revenue,
          },
        }));
        return {
          rows,
          columns: [
            { key: "count", label: { en: "Customers", ar: "العملاء" }, align: "end", format: num },
            { key: "share", label: { en: "Share", ar: "النسبة" }, align: "end", format: pct },
            { key: "avg_orders", label: { en: "Avg Orders", ar: "متوسط الطلبات" }, align: "end",
              format: (v, _fmt, ar) => v.toFixed(1).replace(".", ar ? "٫" : ".") },
            { key: "avg_revenue", label: { en: "Avg Revenue", ar: "متوسط الإيرادات" }, align: "end", format: cur },
          ],
          totals: {
            count: rows.reduce((s, r) => s + (r.values.count ?? 0), 0),
            share: null,
            avg_orders: null,
            avg_revenue: null,
          },
          groupHeader: { en: "Segment", ar: "الشريحة" },
        };
      }

      if (reportId === "clv") {
        const clv = customerSegmentsQuery.data?.clv;
        if (!clv) return { rows: [], columns: [], groupHeader: { en: "Metric", ar: "المؤشر" } };
        const rows: ReportRow[] = [
          { key: "avg", label: isAr ? "متوسط القيمة الدائمة" : "Average CLV", values: { value: clv.avg_clv } },
          { key: "median", label: isAr ? "وسيط القيمة الدائمة" : "Median CLV", values: { value: clv.median_clv } },
          { key: "top", label: isAr ? "أعلى 10% CLV" : "Top 10% CLV", values: { value: clv.top_10_pct_clv } },
          {
            key: "single",
            label: isAr ? "% طلب واحد فقط" : "Single-Order %",
            values: { value: null, share: clv.single_order_pct },
          },
          {
            key: "total",
            label: isAr ? "إجمالي العملاء" : "Total Customers",
            values: { value: null, count: clv.total_customers },
          },
        ];
        return {
          rows,
          columns: [
            { key: "value", label: { en: "Amount", ar: "المبلغ" }, align: "end", format: cur },
            { key: "share", label: { en: "Share", ar: "النسبة" }, align: "end", format: pct },
            { key: "count", label: { en: "Count", ar: "العدد" }, align: "end", format: num },
          ],
          groupHeader: { en: "Metric", ar: "المؤشر" },
        };
      }

      if (reportId === "cohorts") {
        const cohorts = customerSegmentsQuery.data?.cohorts ?? [];
        const rows: ReportRow[] = cohorts.map((c) => ({
          key: c.cohort,
          label: c.cohort,
          values: {
            size: c.size,
            m1: c.retention[0] ?? null,
            m2: c.retention[1] ?? null,
            m3: c.retention[2] ?? null,
            m6: c.retention[5] ?? null,
          },
        }));
        return {
          rows,
          columns: [
            { key: "size", label: { en: "Cohort Size", ar: "حجم المجموعة" }, align: "end", format: num },
            { key: "m1", label: { en: "Month 1", ar: "الشهر ١" }, align: "end", format: pct },
            { key: "m2", label: { en: "Month 2", ar: "الشهر ٢" }, align: "end", format: pct },
            { key: "m3", label: { en: "Month 3", ar: "الشهر ٣" }, align: "end", format: pct },
            { key: "m6", label: { en: "Month 6", ar: "الشهر ٦" }, align: "end", format: pct },
          ],
          groupHeader: { en: "Cohort", ar: "المجموعة" },
        };
      }
    }

    if (category === "marketing") {
      if (reportId === "channels") {
        const channels = channelsQuery.data?.channels ?? [];
        const rows: ReportRow[] = channels.map((c) => ({
          key: c.channel,
          label: channelLabel(c.channel, isAr),
          values: {
            visits: c.visits,
            orders: c.orders,
            sales: c.revenue,
            conversion: c.conversion_rate,
          },
        }));
        return {
          rows,
          columns: [
            { key: "visits", label: { en: "Visits", ar: "الزيارات" }, align: "end", format: num },
            ORDER_COL,
            SALES_COL,
            { key: "conversion", label: { en: "Conversion", ar: "نسبة التحويل" }, align: "end", format: pct },
          ],
          totals: {
            visits: rows.reduce((s, r) => s + (r.values.visits ?? 0), 0),
            orders: rows.reduce((s, r) => s + (r.values.orders ?? 0), 0),
            sales: rows.reduce((s, r) => s + (r.values.sales ?? 0), 0),
            conversion: null,
          },
          groupHeader: { en: "Channel", ar: "القناة" },
        };
      }

      if (reportId === "campaigns") {
        const campaigns = channelsQuery.data?.campaigns ?? [];
        const rows: ReportRow[] = campaigns.map((c) => ({
          key: c.campaign,
          label: c.campaign || (isAr ? "بدون حملة" : "No campaign"),
          values: {
            visits: c.visits,
            orders: c.orders,
            sales: c.revenue,
            avg_basket: c.orders > 0 ? Math.round(c.revenue / c.orders) : 0,
          },
        }));
        const totalOrders = rows.reduce((s, r) => s + (r.values.orders ?? 0), 0);
        const totalSales = rows.reduce((s, r) => s + (r.values.sales ?? 0), 0);
        return {
          rows,
          columns: [
            { key: "visits", label: { en: "Visits", ar: "الزيارات" }, align: "end", format: num },
            ORDER_COL,
            AVG_BASKET_COL,
            SALES_COL,
          ],
          totals: {
            visits: rows.reduce((s, r) => s + (r.values.visits ?? 0), 0),
            orders: totalOrders,
            avg_basket: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
            sales: totalSales,
          },
          groupHeader: { en: "Campaign", ar: "الحملة" },
        };
      }

      if (reportId === "traffic") {
        const sources = trafficSourcesQuery.data ?? [];
        const rows: ReportRow[] = sources.map((s) => ({
          key: s.source,
          label: s.source || (isAr ? "مباشر" : "Direct"),
          values: {
            orders: s.orders,
            sales: s.revenue,
            share: s.percentage,
            avg_basket: s.orders > 0 ? Math.round(s.revenue / s.orders) : 0,
          },
        }));
        const totalOrders = rows.reduce((s, r) => s + (r.values.orders ?? 0), 0);
        const totalSales = rows.reduce((s, r) => s + (r.values.sales ?? 0), 0);
        return {
          rows,
          columns: [
            ORDER_COL,
            AVG_BASKET_COL,
            SALES_COL,
            { key: "share", label: { en: "Share", ar: "النسبة" }, align: "end", format: pct },
          ],
          totals: {
            orders: totalOrders,
            avg_basket: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
            sales: totalSales,
            share: null,
          },
          groupHeader: { en: "Source", ar: "المصدر" },
        };
      }
    }

    return null;
  }, [
    category, reportId, isAr,
    salesChartQuery.data, channelsQuery.data, productsQuery.data,
    revenueBreakdownQuery.data, citiesQuery.data, ordersBreakdownQuery.data,
    customerStatsQuery.data, customerSegmentsQuery.data, trafficSourcesQuery.data,
  ]);

  // Filter rows by search text
  const filteredRows = useMemo(() => {
    if (!reportData) return [];
    if (!search.trim()) return reportData.rows;
    const q = search.toLowerCase().trim();
    return reportData.rows.filter(
      (r) => r.label.toLowerCase().includes(q) || r.badge?.toLowerCase().includes(q),
    );
  }, [reportData, search]);

  // CSV export — wires into AnalyticsLayout's export button
  const { registerExport } = useAnalyticsContext();
  useEffect(() => {
    if (!reportData || filteredRows.length === 0) {
      registerExport(null);
      return;
    }
    registerExport(() => {
      const headers = [
        isAr ? reportData.groupHeader.ar : reportData.groupHeader.en,
        ...reportData.columns.map((c) => (isAr ? c.label.ar : c.label.en)),
      ];
      const rows = filteredRows.map((r) => [
        r.label + (r.badge ? ` (${r.badge})` : ""),
        ...reportData.columns.map((c) => r.values[c.key] ?? ""),
      ]);
      downloadCsv(`${category}-${reportId}-${new Date().toISOString().slice(0, 10)}`, headers, rows);
    });
    return () => registerExport(null);
  }, [reportData, filteredRows, category, reportId, isAr, registerExport]);

  const isLoading = (
    (category === "sales" && reportId === "periods" && salesChartQuery.isLoading) ||
    (category === "sales" && reportId === "channels" && channelsQuery.isLoading) ||
    (category === "sales" && (reportId === "products" || reportId === "categories") && productsQuery.isLoading) ||
    (category === "sales" && reportId === "coupons" && revenueBreakdownQuery.isLoading) ||
    (category === "sales" && reportId === "cities" && citiesQuery.isLoading) ||
    (category === "sales" && reportId === "payment" && ordersBreakdownQuery.isLoading) ||
    (category === "inventory" && productsQuery.isLoading) ||
    (category === "finance" && reportId === "overview" && revenueBreakdownQuery.isLoading) ||
    (category === "finance" && reportId === "payment" && ordersBreakdownQuery.isLoading) ||
    (category === "finance" && reportId === "coupons" && revenueBreakdownQuery.isLoading) ||
    (category === "finance" && reportId === "daily" && salesChartQuery.isLoading) ||
    (category === "customers" && reportId === "overview" && customerStatsQuery.isLoading) ||
    (category === "customers" && (reportId === "segments" || reportId === "clv" || reportId === "cohorts") && customerSegmentsQuery.isLoading) ||
    (category === "marketing" && (reportId === "channels" || reportId === "campaigns") && channelsQuery.isLoading) ||
    (category === "marketing" && reportId === "traffic" && trafficSourcesQuery.isLoading)
  );
  const isShippingComingSoon = category === "sales" && reportId === "shipping";

  return (
    <div className="space-y-3">
      {/* Top-level category pills (mimics the screenshot's row of pills) */}
      <div className="flex flex-wrap items-center justify-end gap-1.5 rounded-xl border border-border/60 bg-card p-2">
        <CategoryPill
          active={category === "sales"}
          icon={BadgeDollarSign}
          label={isAr ? "تقارير المبيعات" : "Sales Reports"}
          onClick={() => setCategory("sales")}
        />
        <CategoryPill
          active={category === "inventory"}
          icon={Package}
          label={isAr ? "المخزون والمنتجات" : "Inventory & Products"}
          onClick={() => setCategory("inventory")}
        />
        <CategoryPill
          active={category === "finance"}
          icon={Wallet}
          label={isAr ? "المالية والمدفوعات" : "Finance & Payments"}
          onClick={() => setCategory("finance")}
        />
        <CategoryPill
          active={category === "customers"}
          icon={Users}
          label={isAr ? "العملاء" : "Customers"}
          onClick={() => setCategory("customers")}
        />
        <CategoryPill
          active={category === "marketing"}
          icon={Megaphone}
          label={isAr ? "التسويق" : "Marketing"}
          onClick={() => setCategory("marketing")}
        />
      </div>

      {/* Report panel */}
      <Card className="border-border/60">
        {/* Sub-report tabs (only when category has reports) */}
        {reports.length > 0 && (
          <div className="border-b border-border/60 px-3 pt-2 overflow-x-auto">
            <div className="flex items-center gap-1 min-w-max">
              {reports.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReportId(r.id)}
                  className={`relative px-3 py-2 text-[12px] font-medium whitespace-nowrap transition-colors ${
                    reportId === r.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isAr ? r.label.ar : r.label.en}
                  {reportId === r.id && (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Title + last updated */}
        <div className="px-4 pt-3 pb-2 flex items-end justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">
              {category === "sales" && (isAr ? "تقارير المبيعات" : "Sales Reports")}
              {category === "inventory" && (isAr ? "تقارير المخزون والمنتجات" : "Inventory & Products Reports")}
              {category === "finance" && (isAr ? "تقارير المالية والمدفوعات" : "Finance & Payments Reports")}
              {category === "customers" && (isAr ? "تقارير العملاء" : "Customers Reports")}
              {category === "marketing" && (isAr ? "تقارير التسويق" : "Marketing Reports")}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isAr ? "آخر تحديث: " : "Last updated: "}
              {new Date().toLocaleString(isAr ? "ar-EG" : "en-US", {
                year: "numeric", month: "short", day: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        {/* Filter row */}
        {!isShippingComingSoon && (
          <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-md">
              <Search className={`absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground ${isAr ? "right-2.5" : "left-2.5"}`} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? "بحث" : "Search"}
                className={`h-8 text-[13px] ${isAr ? "pr-8" : "pl-8"}`}
              />
            </div>
            <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5" disabled>
              <Filter className="h-3.5 w-3.5" />
              {isAr ? "فلتر" : "Filter"}
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5" disabled>
              <Columns3 className="h-3.5 w-3.5" />
              {isAr ? "الأعمدة" : "Columns"}
            </Button>
            <div className="flex items-center gap-1.5 ms-auto rounded-lg bg-muted/60 px-2.5 py-1 text-[11px]">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium text-muted-foreground">
                {isAr ? "التاريخ:" : "Date:"}
              </span>
              <span className="font-semibold tabular-nums">{dateRangeLabel}</span>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="px-1 pb-1">
          {isShippingComingSoon ? (
            <ShippingSoonState isAr={isAr} />
          ) : isLoading ? (
            <ReportTableSkeleton />
          ) : !reportData || filteredRows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={isAr ? "لا توجد تقارير" : "No reports"}
              description={
                search
                  ? (isAr ? "ما لقيناش نتايج للبحث" : "No results matched your search")
                  : (isAr ? "ما فيش بيانات في الفترة دي" : "No data for this period")
              }
              className="py-10"
            />
          ) : (
            <ReportTableView
              data={reportData}
              rows={filteredRows}
              isAr={isAr}
              formatCurrency={formatCurrency}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

function CategoryPill({
  active, icon: Icon, label, onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}

function ReportTableView({
  data, rows, isAr, formatCurrency,
}: {
  data: ReportData;
  rows: ReportRow[];
  isAr: boolean;
  formatCurrency: (cents: number) => string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-[11px] font-semibold uppercase tracking-wider">
            {isAr ? data.groupHeader.ar : data.groupHeader.en}
          </TableHead>
          {data.columns.map((c) => (
            <TableHead
              key={c.key}
              className={`text-[11px] font-semibold uppercase tracking-wider ${c.align === "end" ? "text-end" : "text-start"}`}
            >
              {isAr ? c.label.ar : c.label.en}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell className="py-2.5">
              <div className="flex flex-col">
                <span className="text-[13px] font-medium truncate max-w-[280px]">{row.label}</span>
                {row.badge && (
                  <span className="text-[10px] font-mono text-muted-foreground">{row.badge}</span>
                )}
              </div>
            </TableCell>
            {data.columns.map((c) => {
              const v = row.values[c.key];
              return (
                <TableCell
                  key={c.key}
                  className={`py-2.5 text-[13px] tabular-nums ${c.align === "end" ? "text-end" : "text-start"}`}
                >
                  {v === null || v === undefined
                    ? <span className="text-muted-foreground">—</span>
                    : c.format
                      ? c.format(v, formatCurrency, isAr)
                      : String(v)}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
      {data.totals && rows.length > 0 && (
        <TableFooter>
          <TableRow>
            <TableCell className="py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isAr ? "الإجمالي" : "Total"}
            </TableCell>
            {data.columns.map((c) => {
              const v = data.totals?.[c.key];
              return (
                <TableCell
                  key={c.key}
                  className={`py-2.5 text-[13px] font-semibold tabular-nums ${c.align === "end" ? "text-end" : "text-start"}`}
                >
                  {v === null || v === undefined
                    ? <span className="text-muted-foreground">—</span>
                    : c.format
                      ? c.format(v, formatCurrency, isAr)
                      : String(v)}
                </TableCell>
              );
            })}
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}

function ReportTableSkeleton() {
  return (
    <div className="px-4 py-3 space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}

function segmentLabel(segment: string, isAr: boolean): string {
  const map: Record<string, { en: string; ar: string }> = {
    champions: { en: "Champions", ar: "الأبطال" },
    loyal: { en: "Loyal", ar: "العملاء الدائمون" },
    potential_loyalists: { en: "Potential Loyalists", ar: "محتمل أن يكونوا دائمين" },
    new_customers: { en: "New Customers", ar: "عملاء جدد" },
    promising: { en: "Promising", ar: "واعدون" },
    at_risk: { en: "At Risk", ar: "في خطر" },
    cant_lose: { en: "Can't Lose Them", ar: "لا يمكن خسارتهم" },
    hibernating: { en: "Hibernating", ar: "في سُبات" },
    lost: { en: "Lost", ar: "مفقودون" },
    needs_attention: { en: "Needs Attention", ar: "يحتاج اهتمام" },
    about_to_sleep: { en: "About to Sleep", ar: "على وشك السبات" },
  };
  const m = map[segment.toLowerCase()];
  if (m) return isAr ? m.ar : m.en;
  return segment.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ShippingSoonState({ isAr }: { isAr: boolean }) {
  return (
    <EmptyState
      icon={Truck}
      title={isAr ? "قريبًا" : "Coming Soon"}
      description={
        isAr
          ? "تقرير تفصيلي للشحن حسب شركة الشحن وطريقة الاستلام — هيكون متاح بعد توصيل الإنتجريشن مع كل شركاء الشحن."
          : "Per-carrier shipping reports — broken down by carrier and delivery method — will land once all carrier integrations are wired up."
      }
      className="py-12"
    />
  );
}

function channelLabel(channel: string, isAr: boolean): string {
  const map: Record<string, { en: string; ar: string }> = {
    direct: { en: "Direct", ar: "مباشر" },
    organic: { en: "Organic Search", ar: "بحث طبيعي" },
    social: { en: "Social", ar: "السوشيال" },
    paid: { en: "Paid Ads", ar: "إعلانات مدفوعة" },
    email: { en: "Email", ar: "إيميل" },
    referral: { en: "Referral", ar: "إحالة" },
  };
  const m = map[channel.toLowerCase()];
  if (m) return isAr ? m.ar : m.en;
  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

function paymentMethodLabel(method: string, isAr: boolean): string {
  const map: Record<string, { en: string; ar: string }> = {
    cod: { en: "Cash on Delivery", ar: "الدفع عند الاستلام" },
    card: { en: "Card", ar: "بطاقة ائتمانية" },
    instapay: { en: "InstaPay", ar: "إنستاباي" },
    fawry: { en: "Fawry", ar: "فوري" },
    paymob: { en: "Paymob", ar: "بايموب" },
    wallet: { en: "Wallet", ar: "محفظة إلكترونية" },
  };
  const m = map[method.toLowerCase()];
  if (m) return isAr ? m.ar : m.en;
  return method.charAt(0).toUpperCase() + method.slice(1);
}
