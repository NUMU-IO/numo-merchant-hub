import { SalesTab } from "@/components/analytics/SalesTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function SalesContent() {
  const { period, formatCurrency } = useAnalyticsContext();
  return <SalesTab period={period} formatCurrency={formatCurrency} />;
}

export default function SalesPage() {
  return (
    <AnalyticsLayout
      title={{ en: "Sales Analytics", ar: "تحليلات المبيعات" }}
      subtitle={{ en: "Revenue trends, breakdowns, and coupon impact", ar: "اتجاهات الإيرادات وتفاصيل الخصومات والكوبونات" }}
    >
      <SalesContent />
    </AnalyticsLayout>
  );
}
