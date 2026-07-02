import { MetaTrackingPanel } from "@/components/settings/MetaTrackingPanel";
import { TikTokTrackingPanel } from "@/components/settings/TikTokTrackingPanel";
import { TikTokShopCard } from "@/components/settings/TikTokShopCard";
import { SettingsBreadcrumb } from "@/components/layout/SettingsBreadcrumb";
import { useLanguage } from "@/contexts/LanguageContext";

export default function SettingsTracking() {
  const { language } = useLanguage();
  const isAr = language === "ar";

  return (
    <div className="space-y-6">
      <div>
        <SettingsBreadcrumb current={isAr ? "التتبع والـ Pixels" : "Tracking & Pixels"} />
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
          {isAr ? "التتبع والـ Pixels" : "Tracking & Pixels"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr
            ? "اربط Meta وTikTok Pixel وConversions/Events API لقياس أداء متجرك وحملاتك"
            : "Connect Meta and TikTok Pixel + Conversions/Events API to measure storefront and campaign performance"}
        </p>
      </div>

      <MetaTrackingPanel />
      <TikTokTrackingPanel />

      <div className="pt-2">
        <h2 className="text-lg font-bold tracking-tight mb-3">
          {isAr ? "قنوات البيع" : "Sales channels"}
        </h2>
        <TikTokShopCard />
      </div>
    </div>
  );
}
