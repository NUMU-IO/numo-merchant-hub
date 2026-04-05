import { JourneyReplayTab } from "@/components/analytics/JourneyReplayTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function JourneyContent() {
  const { period, formatCurrency } = useAnalyticsContext();
  return <JourneyReplayTab period={period} formatCurrency={formatCurrency} />;
}

export default function JourneyPage() {
  return (
    <AnalyticsLayout
      title={{ en: "Customer Journey", ar: "رحلة العميل" }}
      subtitle={{ en: "Session replays, path analysis, and behavior tracking", ar: "إعادة تشغيل الجلسات وتحليل المسارات وتتبع السلوك" }}
    >
      <JourneyContent />
    </AnalyticsLayout>
  );
}
