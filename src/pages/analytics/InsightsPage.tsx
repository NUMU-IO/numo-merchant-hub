import { InsightsTab } from "@/components/analytics/InsightsTab";
import { AdvisorFeed } from "@/components/analytics/AdvisorFeed";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function InsightsContent() {
  const { formatCurrency } = useAnalyticsContext();
  return (
    <div className="space-y-4">
      {/* Advisor (AI-1): rule-engine signals with actions + EGP impact,
          ranked by impact. Sits above the anomaly narrative. */}
      <AdvisorFeed />
      <InsightsTab formatCurrency={formatCurrency} />
    </div>
  );
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
