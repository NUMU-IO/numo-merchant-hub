/**
 * CampaignMessageCard — the "what's being sent" section on the campaign
 * detail page. Without this, the subject + body that the merchant typed
 * into the New Campaign dialog were invisible afterward: the detail page
 * showed name / status / KPIs / charts but nothing of the actual message.
 *
 * Layout:
 *   - EMAIL: subject row + sandboxed iframe preview of the HTML body, plus
 *     a collapsible "View HTML source" block underneath for power users.
 *   - SMS:   body rendered in a phone-bubble mock, with character count.
 *
 * Edit dialog is only available while status === "draft" — the backend
 * rejects PUT on any other state, so we mirror that in the UI instead of
 * letting the merchant attempt a change that will 409 / 422.
 *
 * Iframe sandboxing: `sandbox=""` (no flags) gives the iframe a unique
 * opaque origin and disallows scripts, top-navigation, and form submits.
 * Safe even when the merchant pastes arbitrary HTML (or HTML copied from
 * another tool that includes <script>) — the preview can't reach back into
 * the hub or fire requests.
 */

import { useEffect, useState } from "react";
import { Loader2, Pencil, Copy, Check, FileCode } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";
import { toast } from "sonner";

import { updateCampaign, type Campaign } from "@/services/campaignApi";

interface Props {
  storeId: string;
  campaign: Campaign;
  /** Called with the fresh campaign object after a successful save so the
   *  parent can update its state without a full re-fetch. */
  onUpdated: (next: Campaign) => void;
}

const EDITABLE_STATUSES = new Set(["draft"]);

export function CampaignMessageCard({ storeId, campaign, onUpdated }: Props) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const isEmail = campaign.channel === "email";
  const editable = EDITABLE_STATUSES.has(campaign.status);

  const [editOpen, setEditOpen] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState(campaign.inline_subject ?? "");
  const [bodyDraft, setBodyDraft] = useState(campaign.inline_body ?? "");
  const [saving, setSaving] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);

  // Re-seed dialog drafts when the campaign reloads (e.g. after a parallel
  // edit, or after the user cancels then re-opens).
  useEffect(() => {
    setSubjectDraft(campaign.inline_subject ?? "");
    setBodyDraft(campaign.inline_body ?? "");
  }, [campaign.inline_subject, campaign.inline_body]);

  const onSave = async () => {
    if (!bodyDraft.trim()) return;
    setSaving(true);
    try {
      const updated = await updateCampaign(storeId, campaign.id, {
        inline_subject: isEmail ? subjectDraft.trim() || null : null,
        inline_body: bodyDraft.trim(),
      });
      toast.success(isAr ? "تم حفظ الرسالة" : "Message saved");
      onUpdated(updated);
      setEditOpen(false);
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  const onCopySubject = async () => {
    if (!campaign.inline_subject) return;
    try {
      await navigator.clipboard.writeText(campaign.inline_subject);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (insecure context, perms) — no-op
    }
  };

  const hasContent = !!(campaign.inline_subject || campaign.inline_body);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">
            {isAr ? "الرسالة" : "Message"}
          </CardTitle>
          {!editable && (
            <Badge variant="outline" className="text-[10px] font-normal">
              {isAr ? "للقراءة فقط" : "read-only"}
            </Badge>
          )}
        </div>
        {editable && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            {isAr ? "تعديل" : "Edit"}
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {!hasContent ? (
          <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-md">
            {isAr
              ? "لم يتم إضافة محتوى للرسالة بعد."
              : "No message content yet."}
          </div>
        ) : isEmail ? (
          <EmailPreview
            subject={campaign.inline_subject}
            body={campaign.inline_body ?? ""}
            isAr={isAr}
            copied={copied}
            onCopySubject={onCopySubject}
            showSource={showSource}
            onToggleSource={() => setShowSource((v) => !v)}
          />
        ) : (
          <SmsPreview body={campaign.inline_body ?? ""} isAr={isAr} />
        )}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isAr ? "تعديل الرسالة" : "Edit message"}
            </DialogTitle>
            <DialogDescription>
              {isAr
                ? "التعديلات تطبق فور الحفظ. الحملات التي بدأت لا يمكن تعديلها."
                : "Changes apply immediately. Campaigns that have started sending can't be edited."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isEmail && (
              <div className="space-y-1.5">
                <Label htmlFor="msg-subject">
                  {isAr ? "الموضوع" : "Subject"}
                </Label>
                <Input
                  id="msg-subject"
                  value={subjectDraft}
                  onChange={(e) => setSubjectDraft(e.target.value)}
                  maxLength={255}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="msg-body">
                {isAr
                  ? isEmail
                    ? "محتوى البريد (HTML مسموح)"
                    : "نص الرسالة"
                  : isEmail
                    ? "Body (HTML allowed)"
                    : "Message body"}
              </Label>
              <Textarea
                id="msg-body"
                rows={isEmail ? 14 : 5}
                value={bodyDraft}
                onChange={(e) => setBodyDraft(e.target.value)}
                className={isEmail ? "font-mono text-xs" : ""}
                maxLength={10_000}
              />
              {!isEmail && (
                <p className="text-xs text-muted-foreground">
                  {bodyDraft.length} / 160{" "}
                  {isAr ? "حرف" : "chars"}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={onSave}
              disabled={saving || !bodyDraft.trim()}
              className="gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isAr ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface EmailPreviewProps {
  subject: string | null;
  body: string;
  isAr: boolean;
  copied: boolean;
  onCopySubject: () => void;
  showSource: boolean;
  onToggleSource: () => void;
}

function EmailPreview({
  subject,
  body,
  isAr,
  copied,
  onCopySubject,
  showSource,
  onToggleSource,
}: EmailPreviewProps) {
  return (
    <>
      <div className="border rounded-md bg-muted/30">
        <div className="flex items-center gap-2 px-3 py-2 border-b text-xs">
          <span className="text-muted-foreground shrink-0">
            {isAr ? "الموضوع:" : "Subject:"}
          </span>
          <span className="font-medium text-foreground truncate flex-1">
            {subject || (
              <span className="text-muted-foreground italic">
                {isAr ? "بدون موضوع" : "(no subject)"}
              </span>
            )}
          </span>
          {subject && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={onCopySubject}
              title={isAr ? "نسخ" : "Copy"}
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-600" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
            </Button>
          )}
        </div>
        {/* Sandboxed preview. `sandbox=""` (no allowlist) → opaque origin,
            no scripts, no top-navigation, no form submits. Safe to render
            arbitrary merchant HTML. */}
        <iframe
          title="email-body-preview"
          srcDoc={body}
          sandbox=""
          className="w-full bg-white"
          style={{ height: 480, border: 0, display: "block" }}
        />
      </div>

      <div>
        <button
          type="button"
          onClick={onToggleSource}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <FileCode className="h-3.5 w-3.5" />
          {showSource
            ? isAr
              ? "إخفاء كود HTML"
              : "Hide HTML source"
            : isAr
              ? "عرض كود HTML"
              : "View HTML source"}
        </button>
        {showSource && (
          <pre className="mt-2 p-3 rounded-md border bg-muted/50 text-[11px] leading-relaxed font-mono overflow-x-auto max-h-72 whitespace-pre-wrap break-all">
            {body}
          </pre>
        )}
      </div>
    </>
  );
}

interface SmsPreviewProps {
  body: string;
  isAr: boolean;
}

function SmsPreview({ body, isAr }: SmsPreviewProps) {
  const len = body.length;
  // GSM-7 single SMS is 160 chars; concatenated parts use 153. Unicode (any
  // emoji / Arabic char) is 70 / 67. Cheap heuristic: if any char above the
  // ASCII range is present, assume Unicode mode. Matching the non-ASCII
  // range directly avoids the control-char lint warning on /[^\x00-\x7F]/.
  const isUnicode = /[^ -~\r\n\t]/.test(body);
  const perPart = isUnicode ? 70 : 160;
  const parts = len === 0 ? 0 : Math.ceil(len / perPart);

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <div
        className="relative max-w-xs rounded-2xl rounded-bl-sm bg-[#3b82f6] text-white px-4 py-2.5 text-sm leading-snug whitespace-pre-wrap break-words shadow-sm"
        style={{ wordBreak: "break-word" }}
      >
        {body || (
          <span className="italic opacity-70">
            {isAr ? "بدون محتوى" : "(empty)"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>
          {len} {isAr ? "حرف" : "chars"}
        </span>
        <span>•</span>
        <span>
          {parts} {isAr ? "رسالة" : parts === 1 ? "part" : "parts"}
        </span>
        {isUnicode && (
          <>
            <span>•</span>
            <span>Unicode</span>
          </>
        )}
      </div>
    </div>
  );
}
