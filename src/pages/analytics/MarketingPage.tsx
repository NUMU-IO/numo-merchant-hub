import { MarketingTab } from "@/components/analytics/MarketingTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function MarketingContent() {
  const { period, formatCurrency } = useAnalyticsContext();
  return <MarketingTab period={period} formatCurrency={formatCurrency} />;
}

export default function MarketingPage() {
  return (
    <AnalyticsLayout>
      <MarketingContent />
    </AnalyticsLayout>
  );
}
