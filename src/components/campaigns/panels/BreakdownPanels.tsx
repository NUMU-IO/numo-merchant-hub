/**
 * Chart panels for the campaign detail page — feature 002 US3.
 *
 * 8 panels combined in one file (each is ~30-60 LOC). They share the
 * same data-loading shape (TanStack Query keyed on store + campaign +
 * date range + attribution model) so colocating reduces boilerplate.
 *
 * All panels show "No data for this date range." (FR-014) when their
 * query returns empty — no blank cards, no misleading "0" values.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getCampaignBreakdownChannel,
  getCampaignBreakdownCustomerType,
  getCampaignBreakdownDevice,
  getCampaignBreakdownOrderSize,
  getCampaignBreakdownUtm,
  type AttributionModelName,
} from "@/services/campaignApi";

export interface PanelProps {
  storeId: string;
  campaignId: string;
  dateFrom: string;
  dateTo: string;
  attributionModel: AttributionModelName;
  formatCurrency: (cents: number) => string;
}

const DONUT_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#a855f7", // purple
  "#06b6d4", // cyan
];

function PanelShell({
  title,
  loading,
  empty,
  children,
}: {
  title: string;
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-14 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : empty ? (
          <div className="py-14 text-center text-sm text-muted-foreground">
            {isAr ? "لا توجد بيانات لهذه الفترة." : "No data for this date range."}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// ── Sessions / Sales by channel ────────────────────────────────────

export function SessionsByChannelPanel(props: PanelProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const q = useQuery({
    queryKey: [
      "campaign-breakdown",
      "channel",
      props.storeId,
      props.campaignId,
      props.dateFrom,
      props.dateTo,
      props.attributionModel,
    ],
    queryFn: () =>
      getCampaignBreakdownChannel(
        props.storeId,
        props.campaignId,
        props.dateFrom,
        props.dateTo,
        props.attributionModel,
      ),
    enabled: !!props.storeId && !!props.campaignId,
  });
  return (
    <PanelShell
      title={isAr ? "الجلسات حسب القناة" : "Sessions by channel"}
      loading={q.isLoading}
      empty={(q.data?.channels.length ?? 0) === 0}
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={q.data?.channels ?? []}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="channel" reversed={isAr} />
          <YAxis reversed={isAr} />
          <Tooltip />
          <Bar dataKey="sessions" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </PanelShell>
  );
}

export function SalesByChannelPanel(props: PanelProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const q = useQuery({
    queryKey: [
      "campaign-breakdown",
      "channel",
      props.storeId,
      props.campaignId,
      props.dateFrom,
      props.dateTo,
      props.attributionModel,
    ],
    queryFn: () =>
      getCampaignBreakdownChannel(
        props.storeId,
        props.campaignId,
        props.dateFrom,
        props.dateTo,
        props.attributionModel,
      ),
    enabled: !!props.storeId && !!props.campaignId,
  });
  const sortedBySales = useMemo(
    () =>
      [...(q.data?.channels ?? [])].sort(
        (a, b) => b.sales_cents - a.sales_cents,
      ),
    [q.data],
  );
  return (
    <PanelShell
      title={isAr ? "المبيعات حسب القناة" : "Sales by channel"}
      loading={q.isLoading}
      empty={sortedBySales.length === 0}
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={sortedBySales}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="channel" reversed={isAr} />
          <YAxis reversed={isAr} tickFormatter={(c) => props.formatCurrency(c)} />
          <Tooltip formatter={(v: number) => props.formatCurrency(v)} />
          <Bar dataKey="sales_cents" fill="#10b981" />
        </BarChart>
      </ResponsiveContainer>
    </PanelShell>
  );
}

// ── Sessions / Sales by UTM combo ──────────────────────────────────

function utmComboLabel(row: {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}): string {
  return [row.utm_source ?? "—", row.utm_medium ?? "—", row.utm_campaign ?? "—"].join(
    " / ",
  );
}

export function SessionsByUtmPanel(props: PanelProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const q = useQuery({
    queryKey: [
      "campaign-breakdown",
      "utm",
      props.storeId,
      props.campaignId,
      props.dateFrom,
      props.dateTo,
      props.attributionModel,
    ],
    queryFn: () =>
      getCampaignBreakdownUtm(
        props.storeId,
        props.campaignId,
        props.dateFrom,
        props.dateTo,
        props.attributionModel,
      ),
    enabled: !!props.storeId && !!props.campaignId,
  });
  return (
    <PanelShell
      title={isAr ? "الجلسات حسب معاملات UTM" : "Sessions by UTM parameters"}
      loading={q.isLoading}
      empty={(q.data?.combos.length ?? 0) === 0}
    >
      <div className="text-xs">
        <table className="w-full">
          <thead className="text-muted-foreground border-b">
            <tr>
              <th className="text-left py-1.5">source / medium / campaign</th>
              <th className="text-right py-1.5">
                {isAr ? "الجلسات" : "Sessions"}
              </th>
            </tr>
          </thead>
          <tbody>
            {(q.data?.combos ?? []).map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-1.5 truncate max-w-[260px]">
                  {utmComboLabel(row)}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {row.sessions.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelShell>
  );
}

export function SalesByUtmPanel(props: PanelProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const q = useQuery({
    queryKey: [
      "campaign-breakdown",
      "utm",
      props.storeId,
      props.campaignId,
      props.dateFrom,
      props.dateTo,
      props.attributionModel,
    ],
    queryFn: () =>
      getCampaignBreakdownUtm(
        props.storeId,
        props.campaignId,
        props.dateFrom,
        props.dateTo,
        props.attributionModel,
      ),
    enabled: !!props.storeId && !!props.campaignId,
  });
  const sorted = useMemo(
    () =>
      [...(q.data?.combos ?? [])].sort(
        (a, b) => b.sales_cents - a.sales_cents,
      ),
    [q.data],
  );
  return (
    <PanelShell
      title={isAr ? "المبيعات حسب معاملات UTM" : "Sales by UTM parameters"}
      loading={q.isLoading}
      empty={sorted.every((r) => r.sales_cents === 0)}
    >
      <div className="text-xs">
        <table className="w-full">
          <thead className="text-muted-foreground border-b">
            <tr>
              <th className="text-left py-1.5">source / medium / campaign</th>
              <th className="text-right py-1.5">
                {isAr ? "المبيعات" : "Sales"}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-1.5 truncate max-w-[260px]">
                  {utmComboLabel(row)}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {props.formatCurrency(row.sales_cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelShell>
  );
}

// ── Orders new vs returning ────────────────────────────────────────

export function OrdersNewVsReturningPanel(props: PanelProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const q = useQuery({
    queryKey: [
      "campaign-breakdown",
      "customer-type",
      props.storeId,
      props.campaignId,
      props.dateFrom,
      props.dateTo,
      props.attributionModel,
    ],
    queryFn: () =>
      getCampaignBreakdownCustomerType(
        props.storeId,
        props.campaignId,
        props.dateFrom,
        props.dateTo,
        props.attributionModel,
      ),
    enabled: !!props.storeId && !!props.campaignId,
  });
  const data = useMemo(() => {
    if (!q.data) return [];
    return [
      {
        name: isAr ? "عملاء جدد" : "New",
        value: q.data.new_customers.orders,
      },
      {
        name: isAr ? "عملاء عائدون" : "Returning",
        value: q.data.returning_customers.orders,
      },
    ];
  }, [q.data, isAr]);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <PanelShell
      title={isAr ? "الطلبات: عملاء جدد مقابل عائدون" : "Orders: new vs returning"}
      loading={q.isLoading}
      empty={total === 0}
    >
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={45}
            outerRadius={85}
            label={(entry) =>
              `${entry.name}: ${(((entry.value as number) / total) * 100).toFixed(0)}%`
            }
          >
            {data.map((_, i) => (
              <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </PanelShell>
  );
}

// ── Sales by order-size histogram ──────────────────────────────────

export function SalesByOrderSizePanel(props: PanelProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const q = useQuery({
    queryKey: [
      "campaign-breakdown",
      "order-size",
      props.storeId,
      props.campaignId,
      props.dateFrom,
      props.dateTo,
      props.attributionModel,
    ],
    queryFn: () =>
      getCampaignBreakdownOrderSize(
        props.storeId,
        props.campaignId,
        props.dateFrom,
        props.dateTo,
        props.attributionModel,
      ),
    enabled: !!props.storeId && !!props.campaignId,
  });
  const data = useMemo(() => {
    return (q.data?.bins ?? []).map((b) => ({
      bin:
        b.upper_cents === null
          ? `${props.formatCurrency(b.lower_cents)}+`
          : `${props.formatCurrency(b.lower_cents)}–${props.formatCurrency(b.upper_cents)}`,
      orders: b.orders,
    }));
  }, [q.data, props]);
  return (
    <PanelShell
      title={isAr ? "المبيعات حسب حجم الطلب" : "Sales by order size"}
      loading={q.isLoading}
      empty={data.every((b) => b.orders === 0)}
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="bin" reversed={isAr} tick={{ fontSize: 10 }} />
          <YAxis reversed={isAr} />
          <Tooltip />
          <Bar dataKey="orders" fill="#a855f7" />
        </BarChart>
      </ResponsiveContainer>
    </PanelShell>
  );
}

// ── Items sold by product (reuses existing performance.top_products) ─

export function ItemsSoldByProductPanel({
  topProducts,
  loading,
  formatCurrency,
}: {
  topProducts:
    | { product_id: string | null; name: string | null; orders: number; revenue_cents: number }[]
    | undefined;
  loading: boolean;
  formatCurrency: (cents: number) => string;
}) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const empty = (topProducts ?? []).length === 0;
  return (
    <PanelShell
      title={isAr ? "المنتجات الأكثر مبيعاً" : "Items sold by product"}
      loading={loading}
      empty={empty}
    >
      <div className="text-xs">
        <table className="w-full">
          <thead className="text-muted-foreground border-b">
            <tr>
              <th className="text-left py-1.5">{isAr ? "المنتج" : "Product"}</th>
              <th className="text-right py-1.5">{isAr ? "الطلبات" : "Orders"}</th>
              <th className="text-right py-1.5">{isAr ? "الإيرادات" : "Revenue"}</th>
            </tr>
          </thead>
          <tbody>
            {(topProducts ?? []).map((p, i) => (
              <tr key={p.product_id ?? i} className="border-b last:border-0">
                <td className="py-1.5 truncate max-w-[200px]">
                  {p.name ?? (isAr ? "—" : "—")}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {p.orders.toLocaleString()}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatCurrency(p.revenue_cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelShell>
  );
}

// ── Sessions by device ─────────────────────────────────────────────

export function SessionsByDevicePanel(props: PanelProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const q = useQuery({
    queryKey: [
      "campaign-breakdown",
      "device",
      props.storeId,
      props.campaignId,
      props.dateFrom,
      props.dateTo,
      props.attributionModel,
    ],
    queryFn: () =>
      getCampaignBreakdownDevice(
        props.storeId,
        props.campaignId,
        props.dateFrom,
        props.dateTo,
        props.attributionModel,
      ),
    enabled: !!props.storeId && !!props.campaignId,
  });
  const data = useMemo(
    () =>
      (q.data?.devices ?? []).map((d) => ({ name: d.device, value: d.sessions })),
    [q.data],
  );
  return (
    <PanelShell
      title={isAr ? "الجلسات حسب الجهاز" : "Sessions by device"}
      loading={q.isLoading}
      empty={data.length === 0}
    >
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={45}
            outerRadius={85}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </PanelShell>
  );
}
