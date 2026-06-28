/**
 * CampaignMetaAttributionCard — US6 v1 (spec NUMU-api#339).
 *
 * Honest first version: Meta's `/insights` endpoint doesn't natively
 * surface per-NUMU-campaign attribution without the merchant first
 * setting up a Meta Custom Conversion filtered on
 * `custom_data.numu_utm_campaign`. We forward that UTM with every
 * Purchase event (see NUMU-api PR #337), but the merchant still has
 * to point Meta at it.
 *
 * v1: render the setup steps + a deep-link to Meta Events Manager.
 * v2 (after backend auto-creates the Custom Conversion at campaign-
 * send time): replace this card body with the real numbers.
 *
 * Visible only on completed campaigns — promoting attribution before
 * any sends have actually fired would be misleading.
 */

import { Megaphone, ExternalLink } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  isAr: boolean;
}

const META_EVENTS_MANAGER_URL = "https://business.facebook.com/events_manager2/";

export function CampaignMetaAttributionCard({ isAr }: Props) {
  return (
    <Card className="border-dashed">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">
            {isAr ? "إسناد ميتا" : "Meta attribution"}
          </CardTitle>
          <Badge variant="outline" className="text-[10px] font-normal">
            {isAr ? "إعداد يدوي" : "Setup required"}
          </Badge>
        </div>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <a href={META_EVENTS_MANAGER_URL} target="_blank" rel="noreferrer">
            {isAr ? "افتح ميتا" : "Open Meta"}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground leading-relaxed">
          {isAr
            ? "NUMU يرسل UTM الحملة في كل حدث شراء يصل لـ Meta عبر CAPI. لتشوف الأرقام داخل Events Manager، اعمل Custom Conversion يفلتر على المعرف ده:"
            : "NUMU forwards this campaign's UTM with every Purchase event sent to Meta via CAPI. To see attributed numbers inside Events Manager, create a Custom Conversion filtered on the value below."}
        </p>

        <div className="rounded-md border bg-muted/40 p-3 space-y-1.5 font-mono text-xs">
          <div className="text-muted-foreground">
            {isAr ? "اسم الحقل:" : "Field:"}{" "}
            <span className="text-foreground">custom_data.numu_utm_campaign</span>
          </div>
          <div className="text-muted-foreground">
            {isAr ? "القيمة:" : "Value:"}{" "}
            <span className="text-foreground">
              {isAr
                ? "كود الحملة من لوحة الروابط القابلة للتتبع"
                : "this campaign's short code from the Trackable links panel"}
            </span>
          </div>
        </div>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground transition-colors">
            {isAr ? "كيف؟" : "How to set this up"}
          </summary>
          <ol className="list-decimal ms-5 mt-2 space-y-1 leading-relaxed">
            <li>
              {isAr
                ? "افتح Meta Events Manager > Custom Conversions > Create"
                : "Open Meta Events Manager → Custom Conversions → Create"}
            </li>
            <li>
              {isAr
                ? "اختر بكسلك + Purchase event"
                : "Pick your Pixel and the Purchase event"}
            </li>
            <li>
              {isAr
                ? "ضع شرط: custom_data.numu_utm_campaign EQUALS <كود الحملة>"
                : "Add rule: custom_data.numu_utm_campaign EQUALS <short_code>"}
            </li>
            <li>
              {isAr
                ? "بعد ٢٤ ساعة تظهر الإحصائيات في تقرير الحملات داخل Ads Manager"
                : "Stats appear in the Ads Manager Campaigns report ~24h after the next Purchase"}
            </li>
          </ol>
          <p className="mt-2 italic">
            {isAr
              ? "قريباً: NUMU سيُنشئ هذا الـ Custom Conversion تلقائياً عند إرسال كل حملة."
              : "Coming soon: NUMU auto-creates this Custom Conversion on every campaign send."}
          </p>
        </details>
      </CardContent>
    </Card>
  );
}
