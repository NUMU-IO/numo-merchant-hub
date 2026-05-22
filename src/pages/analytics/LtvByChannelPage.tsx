import { LtvByChannelTab } from "@/components/analytics/LtvByChannelTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function LtvContent() {
  const { range, formatCurrency } = useAnalyticsContext();
  return <LtvByChannelTab range={range} formatCurrency={formatCurrency} />;
}

export default function LtvByChannelPage() {
  return (
    <AnalyticsLayout
      title={{ en: "Customer LTV", ar: "القيمة مدى الحياة" }}
      subtitle={{
        en: "Lifetime value by first-touch acquisition channel",
        ar: "قيمة العميل مدى الحياة حسب أول قناة دخل منها",
      }}
    >
      <LtvContent />
    </AnalyticsLayout>
  );
}
