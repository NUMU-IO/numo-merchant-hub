/**
 * CampaignTipsPanel — feature 002 US8.
 *
 * Right-sidebar card surfacing 0-3 heuristic recommendations. Tips are
 * dismissable per session (sessionStorage), keyed by (campaign_id,
 * tip_id) per FR-039.
 */

import { useQuery } from "@tanstack/react-query";
import { Lightbulb, X } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getCampaignTips,
  type AttributionModelName,
  type CampaignTip,
} from "@/services/campaignApi";

const SESSION_PREFIX = "numu:campaign-tip-dismissed:";

function isDismissed(campaignId: string, tipId: string): boolean {
  try {
    return sessionStorage.getItem(`${SESSION_PREFIX}${campaignId}:${tipId}`) === "1";
  } catch {
    return false;
  }
}

function dismiss(campaignId: string, tipId: string): void {
  try {
    sessionStorage.setItem(`${SESSION_PREFIX}${campaignId}:${tipId}`, "1");
  } catch {
    /* ignore — storage disabled */
  }
}

export function CampaignTipsPanel({
  storeId,
  campaignId,
  dateFrom,
  dateTo,
  attributionModel,
}: {
  storeId: string;
  campaignId: string;
  dateFrom: string;
  dateTo: string;
  attributionModel: AttributionModelName;
}) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const q = useQuery({
    queryKey: [
      "campaign-tips",
      storeId,
      campaignId,
      dateFrom,
      dateTo,
      attributionModel,
    ],
    queryFn: () =>
      getCampaignTips(storeId, campaignId, dateFrom, dateTo, attributionModel),
    enabled: !!storeId && !!campaignId,
  });

  const [dismissedTick, setDismissedTick] = useState(0);
  const onDismiss = useCallback(
    (tipId: string) => {
      dismiss(campaignId, tipId);
      setDismissedTick((t) => t + 1);
    },
    [campaignId],
  );

  if (q.isLoading || !q.data) return null;

  const visibleTips: CampaignTip[] = q.data.tips.filter(
    (t) => !isDismissed(campaignId, t.id),
  );

  // Quietly hide the entire panel when no tips fire / all dismissed —
  // empty Tips cards add noise (per FR-037).
  if (visibleTips.length === 0) {
    // referencing dismissedTick so the effect of dismiss re-renders
    void dismissedTick;
    return null;
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Lightbulb className="h-3 w-3" />
        {isAr ? "نصائح ذكية" : "Tips"}
      </Label>
      <div className="space-y-2">
        {visibleTips.map((tip) => (
          <Card
            key={tip.id}
            className={
              tip.severity === "warning"
                ? "border-amber-200 bg-amber-50/40"
                : "border-blue-200 bg-blue-50/40"
            }
          >
            <CardContent className="p-3 text-xs space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm leading-tight">
                  {tip.title}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 -mt-0.5"
                  onClick={() => onDismiss(tip.id)}
                  title={isAr ? "إخفاء" : "Dismiss"}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="text-muted-foreground leading-relaxed">
                {tip.body}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
