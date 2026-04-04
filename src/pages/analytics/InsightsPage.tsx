import { InsightsTab } from "@/components/analytics/InsightsTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function InsightsContent() {
  const { formatCurrency } = useAnalyticsContext();
  return <InsightsTab formatCurrency={formatCurrency} />;
}

export default function InsightsPage() {
  return (
    <AnalyticsLayout>
      <InsightsContent />
    </AnalyticsLayout>
  );
}
