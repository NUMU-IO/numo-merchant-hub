import { MarketingTab } from "@/components/analytics/MarketingTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function MarketingContent() {
  const { period, formatCurrency } = useAnalyticsContext();
  return <MarketingTab period={period} formatCurrency={formatCurrency} />;
}

export default function MarketingPage() {
  return (
    <AnalyticsLayout
      title={{ en: "Marketing Attribution", ar: "إسناد التسويق" }}
      subtitle={{ en: "Channel performance, UTM campaigns, and traffic sources", ar: "أداء القنوات وحملات UTM ومصادر الزيارات" }}
    >
      <MarketingContent />
    </AnalyticsLayout>
  );
}
