/**
 * 4 KPI cards: Sessions / Sales / Orders / Avg Order Value.
 * Feature 002 US3 T037.
 *
 * Sources data from the existing `getCampaignPerformance` endpoint
 * (no new endpoint needed for the KPI row — performance already
 * returns sessions + revenue + orders + AOV in one round trip).
 */

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2 } from "lucide-react";
import { getCampaignPerformance } from "@/services/campaignApi";

export interface CampaignKpiCardsProps {
  storeId: string;
  campaignId: string;
  dateFrom: string;
  dateTo: string;
  formatCurrency: (cents: number) => string;
}

interface KpiSpec {
  label: string;
  value: string;
}

export function CampaignKpiCards(props: CampaignKpiCardsProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const q = useQuery({
    queryKey: [
      "campaign-performance",
      props.storeId,
      props.campaignId,
      props.dateFrom,
      props.dateTo,
    ],
    queryFn: () =>
      getCampaignPerformance(
        props.storeId,
        props.campaignId,
        props.dateFrom,
        props.dateTo,
      ),
    enabled: !!props.storeId && !!props.campaignId,
  });

  const cards: KpiSpec[] = q.data
    ? [
        {
          label: isAr ? "الجلسات" : "Sessions",
          value: q.data.totals.sessions.toLocaleString(),
        },
        {
          label: isAr ? "المبيعات" : "Sales",
          value: props.formatCurrency(q.data.totals.revenue_cents),
        },
        {
          label: isAr ? "الطلبات" : "Orders",
          value: q.data.totals.orders.toLocaleString(),
        },
        {
          label: isAr ? "متوسط قيمة الطلب" : "Avg order value",
          value: props.formatCurrency(q.data.totals.average_order_value_cents),
        },
      ]
    : [];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.length === 0
        ? Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-5">
                <div className="flex items-center justify-center h-10 text-muted-foreground">
                  {q.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "—"
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        : cards.map((c) => (
            <Card key={c.label}>
              <CardContent className="py-4">
                <div className="text-xs text-muted-foreground mb-1">
                  {c.label}
                </div>
                <div className="text-2xl font-semibold tracking-tight tabular-nums">
                  {c.value}
                </div>
              </CardContent>
            </Card>
          ))}
    </div>
  );
}
