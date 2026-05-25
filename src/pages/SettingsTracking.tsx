import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { MetaTrackingPanel } from "@/components/settings/MetaTrackingPanel";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SettingsTracking() {
  const { language, isRTL } = useLanguage();
  const isAr = language === "ar";
  const BackArrow = isRTL ? ChevronRight : ChevronLeft;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <BackArrow className="h-3.5 w-3.5" />
          {isAr ? "الإعدادات" : "All settings"}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          {isAr ? "التتبع والـ Pixels" : "Tracking & Pixels"}
        </h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {isAr
            ? "اربط Meta Pixel وConversions API لقياس أداء متجرك وحملاتك"
            : "Connect Meta Pixel and Conversions API to measure storefront and campaign performance"}
        </p>
      </div>

      <MetaTrackingPanel />
    </div>
  );
}
