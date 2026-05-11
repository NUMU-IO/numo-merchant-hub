import { ForecastTab } from "@/components/analytics/ForecastTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function ForecastContent() {
  const { formatCurrency } = useAnalyticsContext();
  return <ForecastTab formatCurrency={formatCurrency} />;
}

export default function ForecastPage() {
  return (
    <AnalyticsLayout
      title={{ en: "Sales Forecast", ar: "توقعات المبيعات" }}
      subtitle={{ en: "Revenue predictions with confidence intervals", ar: "توقعات الإيرادات مع نطاقات الثقة" }}
      showPeriod={false}
    >
      <ForecastContent />
    </AnalyticsLayout>
  );
}
