import { CustomersTab } from "@/components/analytics/CustomersTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function CustomersContent() {
  const { period, formatCurrency } = useAnalyticsContext();
  return <CustomersTab period={period} formatCurrency={formatCurrency} />;
}

export default function CustomersPage() {
  return (
    <AnalyticsLayout
      title={{ en: "Customer Analytics", ar: "تحليلات العملاء" }}
      subtitle={{ en: "Segmentation, retention cohorts, and lifetime value", ar: "التصنيفات والاحتفاظ وقيمة العميل مدى الحياة" }}
    >
      <CustomersContent />
    </AnalyticsLayout>
  );
}
