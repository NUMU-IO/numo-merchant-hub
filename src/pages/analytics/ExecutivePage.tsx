import { ExecutiveTab } from "@/components/analytics/ExecutiveTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function ExecutiveContent() {
  const { formatCurrency } = useAnalyticsContext();
  return <ExecutiveTab formatCurrency={formatCurrency} />;
}

export default function ExecutivePage() {
  return (
    <AnalyticsLayout
      title={{ en: "Executive View", ar: "النظرة التنفيذية" }}
      subtitle={{ en: "What should I do today?", ar: "أعمل إيه النهارده؟" }}
      showPeriod={false}
    >
      <ExecutiveContent />
    </AnalyticsLayout>
  );
}
