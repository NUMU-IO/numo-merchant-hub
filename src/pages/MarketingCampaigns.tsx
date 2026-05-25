/**
 * MarketingCampaigns — list view for email + SMS broadcast campaigns.
 *
 * Mirrors the backend's /stores/{id}/marketing/campaigns/ endpoint. The
 * trackable-link generator lives on the detail page (one row per
 * campaign, click through to manage).
 *
 * Distinct from WhatsAppCampaigns.tsx, which is on its own table for
 * now — when WhatsApp campaigns adopt the marketing-campaign model
 * they can fold into this list. (Out of scope for v1 of feature 001.)
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, GitCompareArrows, Loader2, Mail, MessageSquare, Plus, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { showError } from "@/lib/show-error";
import { PromotedItemPicker } from "@/components/campaigns/PromotedItemPicker";
import { AudiencePicker } from "@/components/campaigns/AudiencePicker";
import {
  buildEmailBody,
  suggestSubject,
  type PromotedSnapshot,
} from "@/lib/campaignTemplate";
import {
  createCampaign,
  duplicateCampaign,
  listCampaigns,
  type AudienceFilter,
  type Campaign,
  type CampaignChannel,
  type CampaignStatus,
} from "@/services/campaignApi";

const STATUS_VARIANT: Record<string, string> = {
  draft: "bg-muted text-foreground",
  scheduled: "bg-blue-50 text-blue-800 border-blue-200",
  sending: "bg-amber-50 text-amber-800 border-amber-200",
  completed: "bg-green-50 text-green-800 border-green-200",
  failed: "bg-red-50 text-red-800 border-red-200",
  canceled: "bg-muted text-muted-foreground",
};

export default function MarketingCampaigns() {
  const { t: _t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";
  const storeId = currentStore?.id;

  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">(
    "all",
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onCompare = () => {
    const ids = Array.from(selectedIds);
    if (ids.length < 2 || ids.length > 4) return;
    navigate(`/campaigns/compare?ids=${ids.join(",")}`);
  };

  const onDuplicate = async (campaignId: string) => {
    if (!storeId) return;
    setDuplicatingId(campaignId);
    try {
      const created = await duplicateCampaign(storeId, campaignId);
      toast.success(isAr ? "تم نسخ الحملة" : "Campaign duplicated");
      navigate(`/campaigns/${created.id}`);
    } catch (err) {
      showError(err);
    } finally {
      setDuplicatingId(null);
    }
  };

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [promotedSnapshot, setPromotedSnapshot] = useState<PromotedSnapshot | null>(null);
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter | null>({
    preset: "all_opted_in",
  });

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const params = statusFilter === "all" ? undefined : { status: statusFilter };
      const rows = await listCampaigns(storeId, params);
      setCampaigns(rows);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [storeId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setName("");
    setChannel("email");
    setSubject("");
    setBody("");
    setPromotedSnapshot(null);
    setAudienceFilter({ preset: "all_opted_in" });
  };

  /** Fill subject + body from the picked promoted item. Triggered by the
   *  "Use as template" button — never auto-runs so the merchant can pick
   *  the destination first and then decide whether to keep their hand-
   *  written copy or start from the template. */
  const applyPromotedTemplate = () => {
    if (!promotedSnapshot) return;
    const storeName = currentStore?.name || "NUMU";
    setSubject(suggestSubject(promotedSnapshot, storeName, isAr));
    setBody(buildEmailBody(promotedSnapshot, { storeName, isAr }));
    toast.success(
      isAr ? "تم تطبيق القالب" : "Template applied",
    );
  };

  const handleCreate = async () => {
    if (!storeId || !name.trim() || !body.trim()) return;
    setCreating(true);
    try {
      await createCampaign(storeId, {
        name: name.trim(),
        channel,
        inline_subject: subject.trim() || null,
        inline_body: body.trim(),
        audience_filter: (audienceFilter ?? {}) as Record<string, unknown>,
      });
      toast.success(isAr ? "تم إنشاء الحملة" : "Campaign created");
      setDialogOpen(false);
      resetForm();
      await load();
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(isAr ? "ar-EG" : "en-EG") : "—";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isAr ? "حملات التسويق" : "Marketing campaigns"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "البريد الإلكتروني + الرسائل النصية. واتساب في صفحة مستقلة."
              : "Email + SMS broadcasts. WhatsApp lives on its own page."}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {isAr ? "حملة جديدة" : "New campaign"}
        </Button>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4" />
            {isAr ? "كل الحملات" : "All campaigns"}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="status-filter" className="text-xs text-muted-foreground">
              {isAr ? "الحالة" : "Status"}
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as CampaignStatus | "all")}
            >
              <SelectTrigger id="status-filter" className="h-8 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isAr ? "الكل" : "All"}</SelectItem>
                <SelectItem value="draft">{isAr ? "مسودة" : "Draft"}</SelectItem>
                <SelectItem value="scheduled">{isAr ? "مجدولة" : "Scheduled"}</SelectItem>
                <SelectItem value="sending">{isAr ? "جارٍ الإرسال" : "Sending"}</SelectItem>
                <SelectItem value="completed">{isAr ? "مكتملة" : "Completed"}</SelectItem>
                <SelectItem value="failed">{isAr ? "فاشلة" : "Failed"}</SelectItem>
                <SelectItem value="canceled">{isAr ? "ملغاة" : "Canceled"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <div className="rounded-full bg-muted p-3">
                <Send className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">
                  {statusFilter === "all"
                    ? isAr
                      ? "لا توجد حملات بعد"
                      : "No campaigns yet"
                    : isAr
                      ? "لا توجد حملات بهذه الحالة"
                      : "No campaigns in this status"}
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {isAr
                    ? "أنشئ حملة بريد إلكتروني أو رسائل نصية، ثم استخدم منشئ روابط التتبع لقياس الأداء حتى الإيرادات."
                    : "Create an email or SMS broadcast, then use the trackable-link builder to measure sessions, orders, and revenue per campaign."}
                </p>
              </div>
              {statusFilter === "all" && (
                <Button
                  onClick={() => setDialogOpen(true)}
                  size="sm"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {isAr ? "أنشئ أول حملة" : "Create your first campaign"}
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* US7 Compare CTA — appears when 2-4 rows selected. */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between mb-3 p-2 rounded-md bg-muted/40 border">
                  <span className="text-xs text-muted-foreground">
                    {isAr
                      ? `${selectedIds.size} حملة محددة`
                      : `${selectedIds.size} selected`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      {isAr ? "إلغاء" : "Clear"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={onCompare}
                      disabled={selectedIds.size < 2 || selectedIds.size > 4}
                      className="gap-1.5"
                    >
                      <GitCompareArrows className="h-3.5 w-3.5" />
                      {isAr ? "قارن" : "Compare"}
                      {selectedIds.size < 2 && (
                        <span className="text-[10px] opacity-70">
                          ({isAr ? "اختر 2-4" : "pick 2-4"})
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>{isAr ? "الاسم" : "Name"}</TableHead>
                    <TableHead>{isAr ? "القناة" : "Channel"}</TableHead>
                    <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{isAr ? "المرسَل" : "Sent"}</TableHead>
                    <TableHead>{isAr ? "إجمالي" : "Recipients"}</TableHead>
                    <TableHead>{isAr ? "أنشئت" : "Created"}</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c) => (
                    <TableRow
                      key={c.id}
                      className="group cursor-pointer hover:bg-muted/40"
                    >
                      <TableCell className="w-8">
                        <Checkbox
                          checked={selectedIds.has(c.id)}
                          onCheckedChange={() => toggleSelected(c.id)}
                          aria-label={isAr ? "حدد للمقارنة" : "Select to compare"}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/campaigns/${c.id}`}
                          className="font-medium hover:underline"
                        >
                          {c.name}
                        </Link>
                      </TableCell>
                    <TableCell className="uppercase text-xs text-muted-foreground">
                      {c.channel}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_VARIANT[c.status] || ""}
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.sent_count}</TableCell>
                    <TableCell>{c.total_recipients}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(c.created_at)}
                    </TableCell>
                    <TableCell className="w-8">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onDuplicate(c.id)}
                        disabled={duplicatingId === c.id}
                        title={isAr ? "نسخ" : "Duplicate"}
                      >
                        {duplicatingId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isAr ? "إنشاء حملة" : "Create campaign"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">{isAr ? "الاسم" : "Name"}</Label>
              <Input
                id="c-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isAr ? "تخفيضات العيد ٢٠٢٦" : "Eid Sale 2026"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-channel">{isAr ? "القناة" : "Channel"}</Label>
              <Select
                value={channel}
                onValueChange={(v) => setChannel(v as CampaignChannel)}
              >
                <SelectTrigger id="c-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </span>
                  </SelectItem>
                  <SelectItem value="sms">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      SMS
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isAr ? (
                  <>
                    لحملات واتساب،{" "}
                    <Link
                      to="/whatsapp"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      اذهب إلى صفحة واتساب
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    For WhatsApp campaigns,{" "}
                    <Link
                      to="/whatsapp"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      use the WhatsApp page
                    </Link>
                    .
                  </>
                )}
              </p>
            </div>
            {/* Audience filter — picks recipients. Live count shown
                inside the picker so the merchant sees the impact of
                each preset/filter before clicking Save. Default is
                "All opted-in" so older flows behave the same as before. */}
            {storeId && (
              <AudiencePicker
                storeId={storeId}
                channel={channel}
                isAr={isAr}
                value={audienceFilter}
                onChange={setAudienceFilter}
              />
            )}
            {/* "What are you promoting?" — drives the template generator
                below. Picker is optional; merchant can leave at "Nothing
                specific" and write the body freehand. */}
            {channel === "email" && currentStore?.subdomain && (
              <>
                <PromotedItemPicker
                  storeId={storeId!}
                  storeUrl={`https://${currentStore.subdomain}.numueg.app`}
                  isAr={isAr}
                  value={promotedSnapshot}
                  onChange={setPromotedSnapshot}
                />
                {promotedSnapshot && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 w-full"
                    onClick={applyPromotedTemplate}
                  >
                    <Sparkles className="h-4 w-4" />
                    {isAr
                      ? "استخدم القالب الجاهز"
                      : "Use template (overwrites subject + body)"}
                  </Button>
                )}
              </>
            )}
            {channel === "email" && (
              <div className="space-y-1.5">
                <Label htmlFor="c-subject">{isAr ? "الموضوع" : "Subject"}</Label>
                <Input
                  id="c-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="c-body">
                {isAr ? "نص الرسالة" : "Message body"}
              </Label>
              <Textarea
                id="c-body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !name.trim() || !body.trim()}
              className="gap-2"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              {isAr ? "حفظ كمسودة" : "Save as draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
