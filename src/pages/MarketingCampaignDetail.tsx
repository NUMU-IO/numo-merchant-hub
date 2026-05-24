/**
 * MarketingCampaignDetail — Shopify-style campaign detail page.
 *
 * Feature 002 US3 rebuild. Replaces the prior tabbed view
 * (Overview / Trackable Links / Discount Codes / Performance / Audience)
 * with a single page:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ Sticky header: breadcrumb + title + badges + pills + actions │
 *   ├──────────────────────────────────────────┬──────────────────┤
 *   │                                          │                  │
 *   │   4 KPI cards                            │   Right sidebar  │
 *   │   ──────────────                         │                  │
 *   │   8-panel chart grid                     │   - Campaign     │
 *   │   (2 cols on lg+, 1 col on mobile)       │     name + ID    │
 *   │                                          │   - Shareable    │
 *   │                                          │     links        │
 *   │                                          │   - (US4 slot)   │
 *   │                                          │   - (US5 slot)   │
 *   │                                          │   - (US8 slot)   │
 *   │                                          │                  │
 *   └──────────────────────────────────────────┴──────────────────┘
 *
 * Sidebar collapses to a Sheet drawer below 1024px.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DateRangePicker,
  useDateRangeUrlState,
} from "@/components/filters/DateRangePicker";

import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  Loader2,
  PanelRightOpen,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  cancelCampaign,
  getCampaign,
  scheduleCampaign,
  sendCampaignNow,
  updateCampaign,
  type AttributionModelName,
  type Campaign,
} from "@/services/campaignApi";

import { CampaignKpiCards } from "@/components/campaigns/CampaignKpiCards";
import { CampaignChartGrid } from "@/components/campaigns/CampaignChartGrid";
import { TrackableLinkBuilder } from "@/components/campaigns/TrackableLinkBuilder";
import { CampaignCouponsPanel } from "@/components/campaigns/CampaignCouponsPanel";
import { CampaignAutoMatchPanel } from "@/components/campaigns/CampaignAutoMatchPanel";
import { CampaignActivitiesPanel } from "@/components/campaigns/CampaignActivitiesPanel";

const STATUS_VARIANT: Record<string, string> = {
  draft: "bg-muted text-foreground",
  scheduled: "bg-blue-50 text-blue-800 border-blue-200",
  sending: "bg-amber-50 text-amber-800 border-amber-200",
  completed: "bg-green-50 text-green-800 border-green-200",
  failed: "bg-red-50 text-red-800 border-red-200",
  canceled: "bg-muted text-muted-foreground",
};

const ATTRIBUTION_MODELS: AttributionModelName[] = [
  "last_touch",
  "first_touch",
  "linear",
  "time_decay",
  "position_based",
];

function formatCurrency(cents: number, isAr: boolean): string {
  const val = cents / 100;
  return isAr ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;
}

export default function MarketingCampaignDetail() {
  const { id: campaignId } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";
  const storeId = currentStore?.id;
  const fmt = useCallback((c: number) => formatCurrency(c, isAr), [isAr]);

  const { range, setRange } = useDateRangeUrlState();
  const [attributionModel, setAttributionModel] =
    useState<AttributionModelName>("last_touch");

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  // Inline name edit (T048) — debounced PUT on blur.
  const [nameDraft, setNameDraft] = useState("");
  const lastSavedName = useRef("");

  const [busyAction, setBusyAction] = useState<
    "send-now" | "schedule" | "cancel" | null
  >(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!storeId || !campaignId) return;
    setLoading(true);
    try {
      const c = await getCampaign(storeId, campaignId);
      setCampaign(c);
      setNameDraft(c.name);
      lastSavedName.current = c.name;
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [storeId, campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const onNameBlur = async () => {
    if (!storeId || !campaignId || !campaign) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === lastSavedName.current) {
      setNameDraft(lastSavedName.current);
      return;
    }
    try {
      const updated = await updateCampaign(storeId, campaignId, {
        name: trimmed,
      });
      setCampaign(updated);
      lastSavedName.current = updated.name;
      setNameDraft(updated.name);
    } catch (err) {
      showError(err);
      setNameDraft(lastSavedName.current);
    }
  };

  const onCopyShortCode = async () => {
    if (!campaign?.short_code) return;
    try {
      await navigator.clipboard.writeText(campaign.short_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore — clipboard blocked */
    }
  };

  if (!storeId || !campaignId) return null;

  if (loading || !campaign) {
    return (
      <div className="p-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canSendNow = campaign.status === "draft" || campaign.status === "scheduled";
  const canSchedule = campaign.status === "draft";
  const canCancel =
    campaign.status === "draft" ||
    campaign.status === "scheduled" ||
    campaign.status === "sending";

  const dateFromIso = range.start.toISOString();
  const dateToIso = range.end.toISOString();
  const shortCodeSnippet = (campaign as Campaign & { short_code?: string }).short_code;

  const sidebar = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="campaign-name" className="text-xs text-muted-foreground">
          {isAr ? "اسم الحملة" : "Campaign name"}
        </Label>
        <Input
          id="campaign-name"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={onNameBlur}
        />
      </div>

      {shortCodeSnippet && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {isAr ? "معرف الحملة" : "Campaign ID"}
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-2 py-1 text-xs font-mono">
              {shortCodeSnippet}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onCopyShortCode}
              title={isAr ? "نسخ" : "Copy"}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {isAr ? "روابط قابلة للمشاركة" : "Shareable links"}
        </Label>
        <TrackableLinkBuilder
          storeId={storeId}
          campaignId={campaign.id}
          campaignSlug={campaign.name}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {isAr ? "أكواد الخصم" : "Discount codes"}
        </Label>
        <CampaignCouponsPanel storeId={storeId} campaignId={campaign.id} />
      </div>

      {/* US4 — auto-match rules */}
      <CampaignAutoMatchPanel storeId={storeId} campaignId={campaign.id} />

      {/* US5 — campaign activities (backfill audit log) */}
      <CampaignActivitiesPanel storeId={storeId} campaignId={campaign.id} />

      {/* US8 (AI tips) slot — populated when that phase lands. */}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-background/95 backdrop-blur border-b">
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

          {/* Header pills + actions */}
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker
              value={range}
              onChange={setRange}
              size="sm"
              align="end"
            />
            <Select
              value={attributionModel}
              onValueChange={(v) => setAttributionModel(v as AttributionModelName)}
            >
              <SelectTrigger className="h-8 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATTRIBUTION_MODELS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

            {/* Sidebar drawer toggle on small viewports */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 lg:hidden">
                  <PanelRightOpen className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side={isAr ? "left" : "right"} className="w-[320px]">
                {sidebar}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Main grid: KPI cards + 8-panel chart grid on the left, sidebar (lg+) on right */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 lg:gap-6">
        <div className="space-y-4">
          <CampaignKpiCards
            storeId={storeId}
            campaignId={campaign.id}
            dateFrom={dateFromIso}
            dateTo={dateToIso}
            formatCurrency={fmt}
          />
          <CampaignChartGrid
            storeId={storeId}
            campaignId={campaign.id}
            dateFrom={dateFromIso}
            dateTo={dateToIso}
            attributionModel={attributionModel}
            formatCurrency={fmt}
          />
        </div>

        <aside className="hidden lg:block">{sidebar}</aside>
      </div>

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
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
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
