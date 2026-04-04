import { ForecastTab } from "@/components/analytics/ForecastTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function ForecastContent() {
  const { formatCurrency } = useAnalyticsContext();
  return <ForecastTab formatCurrency={formatCurrency} />;
}

export default function ForecastPage() {
  return (
    <AnalyticsLayout>
      <ForecastContent />
    </AnalyticsLayout>
  );
}
