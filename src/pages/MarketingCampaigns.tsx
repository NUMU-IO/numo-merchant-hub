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
import { Loader2, Mail, MessageSquare, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  createCampaign,
  listCampaigns,
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

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">(
    "all",
  );

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isAr ? "الاسم" : "Name"}</TableHead>
                  <TableHead>{isAr ? "القناة" : "Channel"}</TableHead>
                  <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isAr ? "المرسَل" : "Sent"}</TableHead>
                  <TableHead>{isAr ? "إجمالي" : "Recipients"}</TableHead>
                  <TableHead>{isAr ? "أنشئت" : "Created"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40">
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
