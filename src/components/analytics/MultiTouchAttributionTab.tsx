/**
 * MultiTouchAttributionTab — model-selectable per-channel + per-campaign credit.
 *
 * Calls GET /stores/{id}/analytics/multi-touch with the selected
 * model. Renders two stacked tables: revenue credit by channel
 * (utm_source bucket) and by campaign (only touches that resolved to
 * a known marketing_campaigns row appear here).
 *
 * The model selector is intentionally a top-level Tabs so a merchant
 * can flip between models and immediately see how their numbers
 * change — that comparison IS the product feature.
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Megaphone, TrendingUp } from "lucide-react";

import {
  getMultiTouchAttribution,
  type AttributionModel,
} from "@/services/analyticsApi";
import { dateRangeKey } from "@/services/dateRangeParams";
import type { DateRange } from "@/components/filters/DateRangePicker";

interface MultiTouchAttributionTabProps {
  range: DateRange;
  formatCurrency: (cents: number) => string;
}

const MODEL_OPTIONS: ReadonlyArray<{
  value: AttributionModel;
  en: string;
  ar: string;
  hint_en: string;
  hint_ar: string;
}> = [
  {
    value: "last_touch",
    en: "Last touch",
    ar: "آخر نقطة",
    hint_en: "100% to the most recent touch (legacy)",
    hint_ar: "كامل التقدير لآخر نقطة (الافتراضي)",
  },
  {
    value: "first_touch",
    en: "First touch",
    ar: "أول نقطة",
    hint_en: "100% to the acquisition touch",
    hint_ar: "كامل التقدير لأول نقطة دخول",
  },
  {
    value: "linear",
    en: "Linear",
    ar: "متساوٍ",
    hint_en: "Equal split across every touch",
    hint_ar: "توزيع متساوٍ على كل نقاط التتبع",
  },
  {
    value: "time_decay",
    en: "Time decay",
    ar: "تراجع زمني",
    hint_en: "Recent touches weigh more (7-day half-life)",
    hint_ar: "النقاط الأحدث لها وزن أكبر (نصف عمر 7 أيام)",
  },
  {
    value: "position_based",
    en: "Position-based",
    ar: "حسب الموضع",
    hint_en: "40% first + 40% last, 20% spread across middle",
    hint_ar: "40٪ أول + 40٪ آخر + 20٪ موزع على المتوسط",
  },
];

const CHANNEL_TINTS: Record<string, string> = {
  facebook: "#3b82f6",
  instagram: "#ec4899",
  whatsapp: "#10b981",
  email: "#06b6d4",
  tiktok: "#a855f7",
  google: "#f59e0b",
  sms: "#8b5cf6",
  direct: "#94a3b8",
  customer_share: "#14b8a6",
};

function colorFor(channel: string): string {
  return CHANNEL_TINTS[channel.toLowerCase()] || "#94a3b8";
}

export function MultiTouchAttributionTab({
  range,
  formatCurrency,
}: MultiTouchAttributionTabProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const [model, setModel] = useState<AttributionModel>("linear");

  const query = useQuery({
    queryKey: [
      "analytics",
      "multi-touch",
      storeId,
      model,
      ...dateRangeKey(range),
    ],
    queryFn: () => getMultiTouchAttribution(storeId!, range, model),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const data = query.data ?? null;
  const activeOption = MODEL_OPTIONS.find((m) => m.value === model)!;
  const channels = data?.by_channel ?? [];
  const campaigns = data?.by_campaign ?? [];
  const maxChannelCredit =
    channels.length > 0 ? Math.max(...channels.map((c) => c.credit_cents)) : 0;
  const maxCampaignCredit =
    campaigns.length > 0
      ? Math.max(...campaigns.map((c) => c.credit_cents))
      : 0;

  return (
    <div className="space-y-4">
      {/* Model selector + active model description */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={model}
          onValueChange={(v) => setModel(v as AttributionModel)}
        >
          <TabsList>
            {MODEL_OPTIONS.map((m) => (
              <TabsTrigger key={m.value} value={m.value}>
                {isAr ? m.ar : m.en}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-[11px] text-muted-foreground italic">
          {isAr ? activeOption.hint_ar : activeOption.hint_en}
        </p>
      </div>

      {/* Totals */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                {isAr ? "إجمالي الطلبات" : "Attributed Orders"}
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {data
                ? data.total_orders.toLocaleString(isAr ? "ar-EG" : undefined)
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                {isAr ? "إجمالي الإيرادات" : "Total Revenue"}
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {data ? formatCurrency(data.total_revenue_cents) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* By channel */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {isAr ? "التقدير حسب القناة" : "Credit by Channel"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {channels.length > 0 ? (
            <div className="space-y-2">
              {channels.map((c) => {
                const widthPct =
                  maxChannelCredit > 0
                    ? (c.credit_cents / maxChannelCredit) * 100
                    : 0;
                return (
                  <div key={c.channel}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: colorFor(c.channel) }}
                        />
                        <span className="font-medium font-mono">
                          {c.channel}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {c.credit_pct.toFixed(1)}%
                        </span>
                      </div>
                      <span className="font-semibold tabular-nums shrink-0">
                        {formatCurrency(c.credit_cents)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: colorFor(c.channel),
                          opacity: 0.6,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={BarChart3}
              title={
                isAr ? "مفيش بيانات تتبع كافية" : "Not enough attribution data"
              }
              description={
                isAr
                  ? "هتظهر النتائج بعد ما العملاء يدخلوا برابط حملة UTM ويكملوا طلبات"
                  : "Results appear once customers arrive via UTM-tagged links and complete orders"
              }
              className="py-6"
            />
          )}
        </CardContent>
      </Card>

      {/* By campaign */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {isAr ? "التقدير حسب الحملة" : "Credit by Campaign"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length > 0 ? (
            <div className="space-y-2">
              {campaigns.map((c) => {
                const widthPct =
                  maxCampaignCredit > 0
                    ? (c.credit_cents / maxCampaignCredit) * 100
                    : 0;
                return (
                  <div key={c.campaign_id}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">
                          {c.campaign_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {c.credit_pct.toFixed(1)}%
                        </span>
                      </div>
                      <span className="font-semibold tabular-nums shrink-0">
                        {formatCurrency(c.credit_cents)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 bg-primary/60"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Megaphone}
              title={isAr ? "مفيش حملات منسوب لها" : "No campaign attribution"}
              description={
                isAr
                  ? "هتظهر هنا الحملات لما تربط روابطها بالأكواد"
                  : "Campaigns show up here once their trackable links produce conversions"
              }
              className="py-6"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
