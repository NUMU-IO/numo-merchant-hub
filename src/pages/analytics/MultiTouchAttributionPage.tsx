import { MultiTouchAttributionTab } from "@/components/analytics/MultiTouchAttributionTab";
import {
  AnalyticsLayout,
  useAnalyticsContext,
} from "@/components/analytics/AnalyticsLayout";

function Content() {
  const { range, formatCurrency } = useAnalyticsContext();
  return <MultiTouchAttributionTab range={range} formatCurrency={formatCurrency} />;
}

export default function MultiTouchAttributionPage() {
  return (
    <AnalyticsLayout
      title={{
        en: "Multi-Touch Attribution",
        ar: "الإسناد متعدد النقاط",
      }}
      subtitle={{
        en: "Distribute revenue credit across every touch in the customer's journey",
        ar: "وزّع تقدير الإيرادات على كل نقاط رحلة العميل",
      }}
    >
      <Content />
    </AnalyticsLayout>
  );
}
