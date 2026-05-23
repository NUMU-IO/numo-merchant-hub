/**
 * MarketingAttribution — consolidated LTV + Multi-touch dashboards.
 *
 * Feature 002 US2. Replaces the standalone /analytics/ltv and
 * /analytics/multi-touch pages with a single tabbed surface sharing
 * one date-range picker (provided by AnalyticsLayout's context).
 *
 * Legacy routes redirect here with ?from=ltv | ?from=multi-touch so
 * bookmarks land on the correct tab. The active tab is reflected in
 * ?tab= so deep-linking keeps working.
 */

import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";

import {
  AnalyticsLayout,
  useAnalyticsContext,
} from "@/components/analytics/AnalyticsLayout";
import { LtvByChannelTab } from "@/components/analytics/LtvByChannelTab";
import { MultiTouchAttributionTab } from "@/components/analytics/MultiTouchAttributionTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";

type AttributionTab = "ltv" | "multi-touch";

function tabFromParams(params: URLSearchParams): AttributionTab {
  // ?tab= wins; ?from= (legacy-redirect marker) falls back; default LTV.
  const tab = params.get("tab");
  if (tab === "ltv" || tab === "multi-touch") return tab;
  const from = params.get("from");
  if (from === "multi-touch") return "multi-touch";
  return "ltv";
}

function Inner({
  activeTab,
  onTabChange,
}: {
  activeTab: AttributionTab;
  onTabChange: (tab: AttributionTab) => void;
}) {
  const { language } = useLanguage();
  const { range, formatCurrency } = useAnalyticsContext();
  const isAr = language === "ar";

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => onTabChange(v as AttributionTab)}
    >
      <TabsList>
        <TabsTrigger value="ltv">
          {isAr ? "القيمة مدى الحياة" : "LTV by channel"}
        </TabsTrigger>
        <TabsTrigger value="multi-touch">
          {isAr ? "الإسناد متعدد النقاط" : "Multi-touch attribution"}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="ltv" className="pt-4">
        <LtvByChannelTab range={range} formatCurrency={formatCurrency} />
      </TabsContent>

      <TabsContent value="multi-touch" className="pt-4">
        <MultiTouchAttributionTab range={range} formatCurrency={formatCurrency} />
      </TabsContent>
    </Tabs>
  );
}

export default function MarketingAttribution() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = tabFromParams(searchParams);

  const handleTabChange = useCallback(
    (tab: AttributionTab) => {
      // Mirror tab into ?tab= for deep-linking. Drop the legacy ?from=
      // marker once the user starts interacting (it's only useful on
      // initial redirect from the old URLs).
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", tab);
          next.delete("from");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return (
    <AnalyticsLayout
      title={{ en: "Attribution", ar: "الإسناد" }}
      subtitle={{
        en: "Channel lifetime value + multi-touch revenue credit, side by side",
        ar: "قيمة العميل مدى الحياة + الإسناد متعدد النقاط في صفحة واحدة",
      }}
    >
      <Inner activeTab={activeTab} onTabChange={handleTabChange} />
    </AnalyticsLayout>
  );
}
