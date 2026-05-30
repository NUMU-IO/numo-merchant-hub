import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Send,
  Calendar,
  Users,
  CheckCheck,
  Eye,
  AlertCircle,
  RefreshCw,
  Megaphone,
  Clock,
  XCircle,
} from "lucide-react";
import {
  listCampaigns,
  createCampaign,
  sendCampaignNow,
  cancelCampaign,
  listTemplates,
  estimateAudience,
  type Campaign,
  type WhatsAppTemplate,
  type AudienceEstimate,
} from "@/services/whatsappApi";

export default function WhatsAppCampaigns() {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";
  const storeId = currentStore?.id;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [newName, setNewName] = useState("");
  const [newTemplateId, setNewTemplateId] = useState("");
  const [audienceType, setAudienceType] = useState("all");
  const [estimate, setEstimate] = useState<AudienceEstimate | null>(null);
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const [campRes, tmplRes] = await Promise.all([
        listCampaigns(storeId),
        listTemplates(storeId),
      ]);
      setCampaigns(campRes.data.campaigns);
      setTemplates(tmplRes.data.templates.filter((t) => t.status === "APPROVED"));
    } catch {
      toast.error(isAr ? "فشل التحميل" : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [storeId, isAr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEstimate = async () => {
    if (!storeId) return;
    try {
      const res = await estimateAudience(storeId, { type: audienceType });
      setEstimate(res.data);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    if (showCreate && storeId) handleEstimate();
  }, [audienceType, showCreate]);

  const handleCreate = async () => {
    if (!storeId || !newName || !newTemplateId) return;
    setCreating(true);
    try {
      const res = await createCampaign(storeId, {
        name: newName,
        template_id: newTemplateId,
        audience_filter: { type: audienceType },
      });
      // Send immediately
      await sendCampaignNow(storeId, res.data.id);
      toast.success(isAr ? "تم إرسال الحملة" : "Campaign sent!");
      setShowCreate(false);
      setNewName("");
      setNewTemplateId("");
      loadData();
    } catch (err) {
      const message = (err as { message?: string })?.message;
      toast.error(message || (isAr ? "فشل إنشاء الحملة" : "Failed to create campaign"));
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!storeId) return;
    try {
      await cancelCampaign(storeId, id);
      toast.success(isAr ? "تم الإلغاء" : "Cancelled");
      loadData();
    } catch {
      toast.error(isAr ? "فشل الإلغاء" : "Failed to cancel");
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; labelAr: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      draft: { label: "Draft", labelAr: "مسودة", variant: "secondary" },
      scheduled: { label: "Scheduled", labelAr: "مجدولة", variant: "outline" },
      sending: { label: "Sending", labelAr: "جاري الإرسال", variant: "default" },
      completed: { label: "Completed", labelAr: "مكتملة", variant: "default" },
      failed: { label: "Failed", labelAr: "فشلت", variant: "destructive" },
      cancelled: { label: "Cancelled", labelAr: "ملغية", variant: "secondary" },
    };
    const m = map[s] || { label: s, labelAr: s, variant: "secondary" as const };
    return <Badge variant={m.variant}>{isAr ? m.labelAr : m.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{isAr ? "الحملات" : "Campaigns"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr ? "أرسل رسائل جماعية لعملاءك" : "Send broadcast messages to your customers"}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {isAr ? "حملة جديدة" : "New Campaign"}
        </Button>
      </div>

      {/* Campaign List */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
            <h3 className="font-semibold mb-1">{isAr ? "لا توجد حملات" : "No campaigns yet"}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isAr
                ? "أنشئ أول حملة واتساب لعملاءك"
                : "Create your first WhatsApp campaign"}
            </p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {isAr ? "إنشاء حملة" : "Create Campaign"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Megaphone className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString(isAr ? "ar-EG" : "en-US")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {c.total_recipients}
                      </span>
                      <span className="flex items-center gap-1">
                        <Send className="h-3 w-3" /> {c.sent_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCheck className="h-3 w-3 text-green-500" /> {c.delivered_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3 text-blue-500" /> {c.read_count}
                      </span>
                      {c.failed_count > 0 && (
                        <span className="flex items-center gap-1 text-red-500">
                          <AlertCircle className="h-3 w-3" /> {c.failed_count}
                        </span>
                      )}
                    </div>
                    {statusBadge(c.status)}
                    {(c.status === "draft" || c.status === "scheduled") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleCancel(c.id)}
                      >
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Progress bar for sending campaigns */}
                {c.status === "sending" && c.total_recipients > 0 && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${(c.sent_count / c.total_recipients) * 100}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {c.sent_count} / {c.total_recipients}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md" dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isAr ? "حملة جديدة" : "New Campaign"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{isAr ? "اسم الحملة" : "Campaign Name"}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={isAr ? "مثال: عرض رمضان" : "e.g., Ramadan Sale"}
              />
            </div>

            <div className="space-y-2">
              <Label>{isAr ? "قالب الرسالة" : "Message Template"}</Label>
              <Select value={newTemplateId} onValueChange={setNewTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder={isAr ? "اختر قالب" : "Select template"} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.language})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {isAr ? "لا توجد قوالب معتمدة. أنشئ قالب أولاً" : "No approved templates. Create one first."}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{isAr ? "الجمهور" : "Audience"}</Label>
              <Select value={audienceType} onValueChange={setAudienceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isAr ? "كل العملاء" : "All Customers"}</SelectItem>
                  <SelectItem value="recent_buyers">{isAr ? "مشترين حديثين" : "Recent Buyers"}</SelectItem>
                  <SelectItem value="inactive">{isAr ? "عملاء غير نشطين" : "Inactive Customers"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {estimate && (
              <Card>
                <CardContent className="py-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {isAr ? "عدد المستلمين المتوقع:" : "Estimated recipients:"}{" "}
                      <strong>{estimate.estimated_count}</strong>
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newName || !newTemplateId}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {creating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isAr ? "إرسال الآن" : "Send Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
