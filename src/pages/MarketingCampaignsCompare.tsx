/**
 * MarketingCampaignsCompare — feature 002 US7.
 *
 * Side-by-side comparison of 2-4 campaigns. URL: `/campaigns/compare?ids=a,b,c`.
 * Each campaign gets a column with 4 KPI cards; one overlaid line
 * chart shows sessions over time, one line per campaign.
 *
 * Cross-store leakage protection (SEC-001) lives on the backend —
 * the frontend just renders the per-campaign `found` flag + warning
 * banner when the backend reports unavailable ids.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AnalyticsLayout,
  useAnalyticsContext,
} from "@/components/analytics/AnalyticsLayout";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  compareCampaigns,
  type CompareCampaignBlock,
} from "@/services/campaignApi";

const LINE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

function Inner() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const { range, formatCurrency } = useAnalyticsContext();
  const [searchParams] = useSearchParams();
  const idsRaw = searchParams.get("ids") || "";
  const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);

  const validIds = ids.length >= 2 && ids.length <= 4;

  const q = useQuery({
    queryKey: [
      "campaigns-compare",
      storeId,
      idsRaw,
      range.start.toISOString(),
      range.end.toISOString(),
    ],
    queryFn: () =>
      compareCampaigns(
        storeId!,
        ids,
        range.start.toISOString(),
        range.end.toISOString(),
      ),
    enabled: !!storeId && validIds,
  });

  // useMemo MUST run on every render — keep it above early returns so
  // hook order stays stable.
  const combinedSeries = useMemo(() => {
    if (!q.data) return [];
    const byDate: Record<string, Record<string, number | string>> = {};
    q.data.campaigns.forEach((block) => {
      if (!block.found) return;
      block.series.forEach((pt) => {
        if (!byDate[pt.date]) byDate[pt.date] = { date: pt.date };
        byDate[pt.date][block.id] = pt.sessions;
      });
    });
    return Object.values(byDate).sort((a, b) =>
      String(a.date) < String(b.date) ? -1 : 1,
    );
  }, [q.data]);

  if (!validIds) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {isAr ? "اختر من 2 إلى 4 حملات." : "Pick 2 to 4 campaigns."}
        </AlertDescription>
      </Alert>
    );
  }

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-14 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!q.data) return null;

  return (
    <div className="space-y-5">
      {q.data.warnings.length > 0 && (
        <Alert>
          <AlertDescription>
            {q.data.warnings.map((w) => w.message).join(" · ")}
          </AlertDescription>
        </Alert>
      )}

      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${q.data.campaigns.length}, minmax(0, 1fr))`,
        }}
      >
        {q.data.campaigns.map((block, i) => (
          <CampaignColumn
            key={block.id}
            block={block}
            color={LINE_COLORS[i % LINE_COLORS.length]}
            formatCurrency={formatCurrency}
          />
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={combinedSeries}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" reversed={isAr} />
              <YAxis reversed={isAr} />
              <Tooltip />
              <Legend />
              {q.data.campaigns.map((block, i) =>
                block.found ? (
                  <Line
                    key={block.id}
                    type="monotone"
                    dataKey={block.id}
                    name={block.name ?? block.id.slice(0, 6)}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ) : null,
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function CampaignColumn({
  block,
  color,
  formatCurrency,
}: {
  block: CompareCampaignBlock;
  color: string;
  formatCurrency: (cents: number) => string;
}) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  if (!block.found) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          {isAr ? "حملة غير متاحة" : "Campaign unavailable"}
        </CardContent>
      </Card>
    );
  }

  const kpis = [
    { label: isAr ? "الجلسات" : "Sessions", value: block.kpis!.sessions.toLocaleString() },
    { label: isAr ? "المبيعات" : "Sales", value: formatCurrency(block.kpis!.sales_cents) },
    { label: isAr ? "الطلبات" : "Orders", value: block.kpis!.orders.toLocaleString() },
    {
      label: isAr ? "متوسط الطلب" : "Avg order",
      value: formatCurrency(block.kpis!.average_order_value_cents),
    },
  ];

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div
          className="text-xs font-medium border-l-4 pl-2 truncate"
          style={{ borderLeftColor: color }}
        >
          {block.name}
        </div>
        <div className="space-y-2">
          {kpis.map((k) => (
            <div key={k.label}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {k.label}
              </div>
              <div className="text-lg font-semibold tabular-nums">{k.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MarketingCampaignsCompare() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  return (
    <AnalyticsLayout
      title={{ en: "Campaign comparison", ar: "مقارنة الحملات" }}
      subtitle={{
        en: "Side-by-side metrics for 2-4 campaigns",
        ar: "مقاييس جنباً إلى جنب من 2 إلى 4 حملات",
      }}
    >
      <div className="space-y-4">
        <Button variant="outline" size="sm" asChild className="w-fit">
          <Link to="/campaigns" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            {isAr ? "العودة إلى الحملات" : "Back to campaigns"}
          </Link>
        </Button>
        <Inner />
      </div>
    </AnalyticsLayout>
  );
}
