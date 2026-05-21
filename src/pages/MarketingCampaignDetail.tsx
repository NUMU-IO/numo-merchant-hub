/**
 * MarketingCampaignDetail — single-campaign view with tabs.
 *
 * v1 (feature 001):
 *   • Overview tab — campaign metadata + state
 *   • Trackable Links tab — TrackableLinkBuilder mount
 *
 * v2 (deferred):
 *   • Audience tab — segment / audience filter editor
 *   • Performance tab — US3's per-campaign funnel + revenue dashboard
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ArrowLeft, Loader2 } from "lucide-react";
import { showError } from "@/lib/show-error";
import { getCampaign, type Campaign } from "@/services/campaignApi";
import { TrackableLinkBuilder } from "@/components/campaigns/TrackableLinkBuilder";
import { CampaignPerformanceTab } from "@/components/campaigns/CampaignPerformanceTab";

const STATUS_VARIANT: Record<string, string> = {
  draft: "bg-muted text-foreground",
  scheduled: "bg-blue-50 text-blue-800 border-blue-200",
  sending: "bg-amber-50 text-amber-800 border-amber-200",
  completed: "bg-green-50 text-green-800 border-green-200",
  failed: "bg-red-50 text-red-800 border-red-200",
  canceled: "bg-muted text-muted-foreground",
};

export default function MarketingCampaignDetail() {
  const { id: campaignId } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";
  const storeId = currentStore?.id;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!storeId || !campaignId) return;
    setLoading(true);
    try {
      const c = await getCampaign(storeId, campaignId);
      setCampaign(c);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [storeId, campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!storeId || !campaignId) return null;

  if (loading) {
    return (
      <div className="p-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {isAr ? "لم يتم العثور على الحملة." : "Campaign not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/campaigns" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            {isAr ? "الحملات" : "Campaigns"}
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {campaign.name}
            </h1>
            <Badge
              variant="outline"
              className={STATUS_VARIANT[campaign.status] || ""}
            >
              {campaign.status}
            </Badge>
            <span className="text-xs text-muted-foreground uppercase">
              {campaign.channel}
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            {isAr ? "نظرة عامة" : "Overview"}
          </TabsTrigger>
          <TabsTrigger value="trackable-links">
            {isAr ? "روابط التتبع" : "Trackable links"}
          </TabsTrigger>
          <TabsTrigger value="performance">
            {isAr ? "الأداء" : "Performance"}
          </TabsTrigger>
          <TabsTrigger value="audience" disabled>
            {isAr ? "الجمهور" : "Audience"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {isAr ? "تفاصيل" : "Details"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row
                  label={isAr ? "القناة" : "Channel"}
                  value={campaign.channel.toUpperCase()}
                />
                <Row
                  label={isAr ? "الموضوع" : "Subject"}
                  value={campaign.inline_subject || "—"}
                />
                <Row
                  label={isAr ? "مجدولة في" : "Scheduled at"}
                  value={
                    campaign.scheduled_at
                      ? new Date(campaign.scheduled_at).toLocaleString(
                          isAr ? "ar-EG" : "en-EG",
                        )
                      : "—"
                  }
                />
                <Row
                  label={isAr ? "بدأت في" : "Started at"}
                  value={
                    campaign.started_at
                      ? new Date(campaign.started_at).toLocaleString(
                          isAr ? "ar-EG" : "en-EG",
                        )
                      : "—"
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {isAr ? "العدّادات" : "Counters"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row
                  label={isAr ? "إجمالي المستلمين" : "Total recipients"}
                  value={campaign.total_recipients.toLocaleString()}
                />
                <Row
                  label={isAr ? "أُرسلت" : "Sent"}
                  value={campaign.sent_count.toLocaleString()}
                />
                <Row
                  label={isAr ? "تم التسليم" : "Delivered"}
                  value={campaign.delivered_count.toLocaleString()}
                />
                <Row
                  label={isAr ? "فشلت" : "Failed"}
                  value={campaign.failed_count.toLocaleString()}
                />
              </CardContent>
            </Card>
          </div>

          {campaign.inline_body && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {isAr ? "نص الرسالة" : "Message body"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm font-sans text-muted-foreground">
                  {campaign.inline_body}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trackable-links">
          <TrackableLinkBuilder
            storeId={storeId}
            campaignId={campaign.id}
            campaignSlug={campaign.name}
          />
        </TabsContent>

        <TabsContent value="performance">
          <CampaignPerformanceTab
            storeId={storeId}
            campaignId={campaign.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
