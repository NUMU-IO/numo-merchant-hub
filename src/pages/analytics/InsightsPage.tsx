import { InsightsTab } from "@/components/analytics/InsightsTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function InsightsContent() {
  const { formatCurrency } = useAnalyticsContext();
  return <InsightsTab formatCurrency={formatCurrency} />;
}

export default function InsightsPage() {
  return (
    <AnalyticsLayout
      title={{ en: "AI Insights", ar: "تحليلات ذكية" }}
      subtitle={{ en: "Anomaly detection, trends, and smart recommendations", ar: "اكتشاف الشذوذ والاتجاهات والتوصيات الذكية" }}
      showPeriod={false}
    >
      <InsightsContent />
    </AnalyticsLayout>
  );
}
