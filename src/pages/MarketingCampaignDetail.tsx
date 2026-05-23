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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calendar, Loader2, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  cancelCampaign,
  getCampaign,
  scheduleCampaign,
  sendCampaignNow,
  type Campaign,
} from "@/services/campaignApi";
import { TrackableLinkBuilder } from "@/components/campaigns/TrackableLinkBuilder";
import { CampaignPerformanceTab } from "@/components/campaigns/CampaignPerformanceTab";
import { CampaignCouponsPanel } from "@/components/campaigns/CampaignCouponsPanel";

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
  const [busyAction, setBusyAction] = useState<
    "send-now" | "schedule" | "cancel" | null
  >(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

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

  // Action handlers — each refreshes the campaign so the status badge
  // and counters reflect the new state without a full page reload.
  const onSendNow = async () => {
    if (!storeId || !campaignId) return;
    setBusyAction("send-now");
    try {
      const updated = await sendCampaignNow(storeId, campaignId);
      setCampaign(updated);
      toast.success(isAr ? "بدأ الإرسال" : "Send started");
    } catch (err) {
      showError(err);
    } finally {
      setBusyAction(null);
    }
  };

  const onSchedule = async () => {
    if (!storeId || !campaignId || !scheduledAt) return;
    setBusyAction("schedule");
    try {
      // <input type="datetime-local"> returns local time without a TZ
      // suffix; new Date(value).toISOString() converts to the UTC
      // representation the backend expects.
      const iso = new Date(scheduledAt).toISOString();
      const updated = await scheduleCampaign(storeId, campaignId, iso);
      setCampaign(updated);
      setScheduleOpen(false);
      setScheduledAt("");
      toast.success(isAr ? "تم جدولة الحملة" : "Campaign scheduled");
    } catch (err) {
      showError(err);
    } finally {
      setBusyAction(null);
    }
  };

  const onCancel = async () => {
    if (!storeId || !campaignId) return;
    setBusyAction("cancel");
    try {
      const updated = await cancelCampaign(storeId, campaignId);
      setCampaign(updated);
      toast.success(isAr ? "تم إلغاء الحملة" : "Campaign canceled");
    } catch (err) {
      showError(err);
    } finally {
      setBusyAction(null);
    }
  };

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

  // Action affordances by current status. Source of truth is the
  // backend's state machine — keeping this map in sync with the
  // FastAPI route guards in marketing_campaigns.py.
  const canSendNow =
    campaign.status === "draft" || campaign.status === "scheduled";
  const canSchedule = campaign.status === "draft";
  const canCancel =
    campaign.status === "draft" ||
    campaign.status === "scheduled" ||
    campaign.status === "sending";

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
        <div className="flex flex-wrap items-center gap-2">
          {canSchedule && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScheduleOpen(true)}
              disabled={busyAction !== null}
              className="gap-1.5"
            >
              <Calendar className="h-4 w-4" />
              {isAr ? "جدولة" : "Schedule"}
            </Button>
          )}
          {canSendNow && (
            <Button
              size="sm"
              onClick={onSendNow}
              disabled={busyAction !== null}
              className="gap-1.5"
            >
              {busyAction === "send-now" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isAr ? "إرسال الآن" : "Send now"}
            </Button>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={busyAction !== null}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              {busyAction === "cancel" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
          )}
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
          <TabsTrigger value="coupons">
            {isAr ? "أكواد الخصم" : "Discount codes"}
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

        <TabsContent value="coupons">
          <CampaignCouponsPanel
            storeId={storeId}
            campaignId={campaign.id}
          />
        </TabsContent>

        <TabsContent value="performance">
          <CampaignPerformanceTab
            storeId={storeId}
            campaignId={campaign.id}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isAr ? "جدولة الحملة" : "Schedule campaign"}
            </DialogTitle>
            <DialogDescription>
              {isAr
                ? "اختر متى تريد إرسال الحملة. سيقوم النظام بإرسالها تلقائياً في الوقت المحدد."
                : "Pick when to send. The system dispatches automatically at the scheduled time."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="scheduled-at">
              {isAr ? "وقت الإرسال" : "Send at"}
            </Label>
            <Input
              id="scheduled-at"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={new Date(Date.now() + 60_000)
                .toISOString()
                .slice(0, 16)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setScheduleOpen(false)}
              disabled={busyAction === "schedule"}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={onSchedule}
              disabled={busyAction === "schedule" || !scheduledAt}
              className="gap-2"
            >
              {busyAction === "schedule" && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {isAr ? "تأكيد الجدولة" : "Confirm schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
