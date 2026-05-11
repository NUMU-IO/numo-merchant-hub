import { OrdersTab } from "@/components/analytics/OrdersTab";
import { AnalyticsLayout, useAnalyticsContext } from "@/components/analytics/AnalyticsLayout";

function OrdersContent() {
  const { period, formatCurrency } = useAnalyticsContext();
  return <OrdersTab period={period} formatCurrency={formatCurrency} />;
}

export default function OrdersPage() {
  return (
    <AnalyticsLayout
      title={{ en: "Orders Analytics", ar: "تحليلات الطلبات" }}
      subtitle={{ en: "Order patterns, fulfillment speed, and payment methods", ar: "أنماط الطلبات وسرعة التجهيز وطرق الدفع" }}
    >
      <OrdersContent />
    </AnalyticsLayout>
  );
}
