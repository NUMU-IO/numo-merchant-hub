import { useTranslation } from "react-i18next";
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Mail,
  Save,
  Trash2,
  RefreshCw,
  RotateCcw,
  Send,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  Loader2,
  AlertTriangle,
  Search,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  getDefaultEmailTemplate,
  getEmailTemplate,
  listEmailTemplateEvents,
  previewEmailTemplate,
  previewEmailTemplateDraft,
  sendTestEmailTemplate,
  updateEmailTemplate,
} from "@/services/emailTemplatesApi";
import type {
  EmailTemplate,
  EmailTemplateEventInfo,
  EmailTemplateLanguage,
} from "@/services/emailTemplatesApi";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";

const SUBJECT_LIMIT = 200;
const BODY_BYTE_LIMIT = 100 * 1024; // 100 KB

const VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bytesOf(s: string): number {
  // Use Blob to count UTF-8 bytes — matches what the backend will see.
  if (typeof Blob !== "undefined") {
    try {
      return new Blob([s]).size;
    } catch {
      // fall through
    }
  }
  return s.length;
}

function formatKB(bytes: number): string {
  return (bytes / 1024).toFixed(1);
}

function extractVariables(text: string): string[] {
  if (!text) return [];
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = VARIABLE_RE.exec(text)) !== null) {
    out.add(m[1]);
  }
  return Array.from(out);
}

export default function EmailTemplateEditor() {
  const { t } = useTranslation();
  const { language, isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const isCreateMode = !id;
  const canManage = user?.role === "store_owner";

  // ── Loaded data ──
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [events, setEvents] = useState<EmailTemplateEventInfo[]>([]);
  const [eventType, setEventType] = useState<string>("");
  const [tplLanguage, setTplLanguage] = useState<EmailTemplateLanguage>(
    isAr ? "ar" : "en",
  );

  // ── Form state ──
  const [name, setName] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [htmlBody, setHtmlBody] = useState<string>("");
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [fromName, setFromName] = useState<string>("");
  const [replyTo, setReplyTo] = useState<string>("");

  // ── Initial loaded values (for dirty tracking) ──
  const [initialSubject, setInitialSubject] = useState<string>("");
  const [initialHtmlBody, setInitialHtmlBody] = useState<string>("");
  const [initialIsEnabled, setInitialIsEnabled] = useState<boolean>(true);
  const [initialFromName, setInitialFromName] = useState<string>("");
  const [initialReplyTo, setInitialReplyTo] = useState<string>("");
  const [initialName, setInitialName] = useState<string>("");

  // ── Preview state ──
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // ── Test email ──
  const [testEmail, setTestEmail] = useState<string>("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  // ── UI state ──
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [pendingNavigateAction, setPendingNavigateAction] = useState<
    null | (() => void)
  >(null);
  const [variableSearch, setVariableSearch] = useState("");
  const [variablesOpen, setVariablesOpen] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ── Computed: dirty ──
  const dirty =
    subject !== initialSubject ||
    htmlBody !== initialHtmlBody ||
    isEnabled !== initialIsEnabled ||
    fromName !== initialFromName ||
    replyTo !== initialReplyTo ||
    name !== initialName;

  // ── Computed: event info ──
  const eventInfo = useMemo<EmailTemplateEventInfo | null>(() => {
    return events.find((e) => e.event_type === eventType) || null;
  }, [events, eventType]);

  const eventLabel = useMemo(() => {
    if (!eventInfo) return eventType;
    return isAr ? eventInfo.label_ar : eventInfo.label_en;
  }, [eventInfo, eventType, isAr]);

  // ── Body bytes ──
  const bodyBytes = useMemo(() => bytesOf(htmlBody), [htmlBody]);
  const subjectLength = subject.length;

  // ── Validation ──
  const subjectTooLong = subjectLength > SUBJECT_LIMIT;
  const bodyTooLarge = bodyBytes > BODY_BYTE_LIMIT;
  const subjectMissing = !subject.trim();
  const bodyMissing = !htmlBody.trim();
  const testEmailInvalid = testEmail.length > 0 && !EMAIL_RE.test(testEmail);

  // Unknown variables warning (soft)
  const unknownVariables = useMemo(() => {
    if (!eventInfo) return [];
    const known = new Set(Object.keys(eventInfo.variables || {}));
    const used = new Set<string>([
      ...extractVariables(subject),
      ...extractVariables(htmlBody),
    ]);
    return Array.from(used).filter((v) => !known.has(v));
  }, [subject, htmlBody, eventInfo]);

  // ── Initial load ──
  useEffect(() => {
    if (!storeId) return;
    if (!canManage) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        if (isCreateMode) {
          const ev = searchParams.get("event_type") || "";
          const lang = (searchParams.get("language") || "en") as EmailTemplateLanguage;
          if (!ev) {
            toast.error(
              isAr
                ? "اختر نوع الحدث الأول"
                : "Select an event type first",
            );
            navigate("/email-templates");
            return;
          }
          const [eventsRes, defaultRes] = await Promise.all([
            listEmailTemplateEvents(storeId),
            getDefaultEmailTemplate(storeId, ev, lang),
          ]);
          if (cancelled) return;
          setEvents(Array.isArray(eventsRes) ? eventsRes : []);
          setEventType(ev);
          setTplLanguage(lang);
          // Pre-fill from default
          const info = (Array.isArray(eventsRes) ? eventsRes : []).find(
            (e) => e.event_type === ev,
          );
          const defaultName = info
            ? `${isAr ? info.label_ar : info.label_en} (${lang.toUpperCase()})`
            : `${ev} (${lang.toUpperCase()})`;
          setName(defaultName);
          setInitialName(defaultName);
          setSubject(defaultRes.subject || "");
          setInitialSubject(defaultRes.subject || "");
          setHtmlBody(defaultRes.html_body || "");
          setInitialHtmlBody(defaultRes.html_body || "");
          setIsEnabled(true);
          setInitialIsEnabled(true);
          setFromName("");
          setInitialFromName("");
          setReplyTo("");
          setInitialReplyTo("");
        } else if (id) {
          const [eventsRes, tplRes] = await Promise.all([
            listEmailTemplateEvents(storeId),
            getEmailTemplate(storeId, id),
          ]);
          if (cancelled) return;
          setEvents(Array.isArray(eventsRes) ? eventsRes : []);
          setTemplate(tplRes);
          setEventType(tplRes.event_type);
          setTplLanguage(tplRes.language);
          setName(tplRes.name || "");
          setInitialName(tplRes.name || "");
          setSubject(tplRes.subject || "");
          setInitialSubject(tplRes.subject || "");
          setHtmlBody(tplRes.html_body || "");
          setInitialHtmlBody(tplRes.html_body || "");
          setIsEnabled(!!tplRes.is_enabled);
          setInitialIsEnabled(!!tplRes.is_enabled);
          setFromName(tplRes.from_name || "");
          setInitialFromName(tplRes.from_name || "");
          setReplyTo(tplRes.reply_to || "");
          setInitialReplyTo(tplRes.reply_to || "");
        }
      } catch (err: unknown) {
        if (!cancelled) {
          console.error("Failed to load editor data:", err);
          showError(err, language);
          navigate("/email-templates");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, id, canManage]);

  // ── Auto-preview (debounced) ──
  // Renders the in-flight buffer via the draft endpoint — works in both
  // create and edit mode regardless of dirty state. No need to save first.
  const fetchPreview = useCallback(async () => {
    if (!storeId) return;
    if (!eventType || !subject || !htmlBody) {
      setPreviewSubject("");
      setPreviewHtml("");
      return;
    }
    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await previewEmailTemplateDraft(storeId, {
        event_type: eventType,
        language,
        subject,
        html_body: htmlBody,
      });
      setPreviewSubject(res.subject || "");
      setPreviewHtml(res.html || "");
    } catch (err: unknown) {
      console.error("Preview failed:", err);
      setPreviewError(
        isAr ? "فشل تحميل المعاينة" : "Failed to load preview",
      );
    } finally {
      setIsPreviewLoading(false);
    }
  }, [storeId, eventType, language, subject, htmlBody, isAr]);

  // Initial preview after load + debounced re-preview on every edit.
  useEffect(() => {
    if (!eventType || !subject || !htmlBody) return;
    const handle = setTimeout(() => {
      fetchPreview();
    }, 600);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, htmlBody, eventType, language]);

  // ── Beforeunload guard ──
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ── Variable insertion ──
  const insertVariable = (varName: string) => {
    const ta = textareaRef.current;
    const placeholder = `{{${varName}}}`;
    if (!ta) {
      setHtmlBody((prev) => prev + placeholder);
      return;
    }
    const start = ta.selectionStart ?? htmlBody.length;
    const end = ta.selectionEnd ?? htmlBody.length;
    const next = htmlBody.slice(0, start) + placeholder + htmlBody.slice(end);
    setHtmlBody(next);
    // Restore caret after React re-renders
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      const pos = start + placeholder.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  // ── Save ──
  const handleSave = async () => {
    if (!storeId) return;
    if (subjectMissing) {
      toast.error(t("emailTemplates.validation.subjectRequired"));
      return;
    }
    if (bodyMissing) {
      toast.error(t("emailTemplates.validation.bodyRequired"));
      return;
    }
    if (bodyTooLarge) {
      toast.error(t("emailTemplates.validation.bodyTooLong"));
      return;
    }
    setIsSaving(true);
    try {
      if (isCreateMode) {
        const created = await createEmailTemplate(storeId, {
          event_type: eventType,
          language: tplLanguage,
          name: name.trim() || `${eventType} (${tplLanguage.toUpperCase()})`,
          subject,
          html_body: htmlBody,
          is_enabled: isEnabled,
          from_name: fromName || null,
          reply_to: replyTo || null,
        });
        // Sync local state to the persisted record before navigating —
        // the backend's bleach sanitizer may have normalized the HTML
        // (stripped comments, etc.) so the buffer needs to match what
        // was actually saved or the dirty flag stays stuck.
        setTemplate(created);
        setName(created.name || "");
        setSubject(created.subject || "");
        setHtmlBody(created.html_body || "");
        setIsEnabled(!!created.is_enabled);
        setFromName(created.from_name || "");
        setReplyTo(created.reply_to || "");
        setInitialName(created.name || "");
        setInitialSubject(created.subject || "");
        setInitialHtmlBody(created.html_body || "");
        setInitialIsEnabled(!!created.is_enabled);
        setInitialFromName(created.from_name || "");
        setInitialReplyTo(created.reply_to || "");
        toast.success(t("emailTemplates.toast.created"));
        // Replace URL so refresh stays on this template
        navigate(`/email-templates/${created.id}`, { replace: true });
      } else if (id) {
        const updated = await updateEmailTemplate(storeId, id, {
          name: name.trim() || undefined,
          subject,
          html_body: htmlBody,
          is_enabled: isEnabled,
          from_name: fromName || null,
          reply_to: replyTo || null,
        });
        // Sync both the editor buffer AND the initial-* baseline to the
        // server's persisted version so the dirty flag resets correctly
        // even when the bleach sanitizer normalizes the HTML.
        setTemplate(updated);
        setName(updated.name || "");
        setSubject(updated.subject || "");
        setHtmlBody(updated.html_body || "");
        setIsEnabled(!!updated.is_enabled);
        setFromName(updated.from_name || "");
        setReplyTo(updated.reply_to || "");
        setInitialName(updated.name || "");
        setInitialSubject(updated.subject || "");
        setInitialHtmlBody(updated.html_body || "");
        setInitialIsEnabled(!!updated.is_enabled);
        setInitialFromName(updated.from_name || "");
        setInitialReplyTo(updated.reply_to || "");
        toast.success(t("emailTemplates.toast.updated"));
        // Refresh preview
        fetchPreview();
      }
    } catch (err: unknown) {
      showError(err, language);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Discard ──
  const handleDiscard = () => {
    setName(initialName);
    setSubject(initialSubject);
    setHtmlBody(initialHtmlBody);
    setIsEnabled(initialIsEnabled);
    setFromName(initialFromName);
    setReplyTo(initialReplyTo);
  };

  // ── Reset to default ──
  const handleResetToDefault = async () => {
    if (!storeId || !eventType) return;
    try {
      const def = await getDefaultEmailTemplate(
        storeId,
        eventType,
        tplLanguage,
      );
      setSubject(def.subject || "");
      setHtmlBody(def.html_body || "");
      toast.success(t("emailTemplates.toast.resetDone"));
    } catch (err: unknown) {
      showError(err, language);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!storeId || !id) return;
    setIsDeleting(true);
    try {
      await deleteEmailTemplate(storeId, id);
      toast.success(t("emailTemplates.toast.deleted"));
      navigate("/email-templates");
    } catch (err: unknown) {
      showError(err, language);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Send test ──
  const handleSendTest = async () => {
    if (!storeId || !id) return;
    if (!testEmail || testEmailInvalid) {
      toast.error(t("emailTemplates.validation.testEmailInvalid"));
      return;
    }
    setIsSendingTest(true);
    try {
      await sendTestEmailTemplate(storeId, id, {
        recipient: testEmail.trim(),
        variables: eventInfo?.sample_data,
      });
      toast.success(t("emailTemplates.toast.testSent"));
    } catch (err: unknown) {
      showError(err, language);
    } finally {
      setIsSendingTest(false);
    }
  };

  // ── Navigation guards ──
  const guardedBack = () => {
    if (dirty) {
      setPendingNavigateAction(() => () => navigate("/email-templates"));
      setConfirmDiscardOpen(true);
    } else {
      navigate("/email-templates");
    }
  };

  // ── Permission gate ──
  if (!canManage) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight flex items-center gap-2.5">
            <Mail className="h-6 w-6 text-saffron" />
            {t("emailTemplates.title")}
          </h1>
        </div>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Lock}
              title={t("emailTemplates.permissionDenied")}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-[600px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Filter variables list
  const variableEntries = Object.entries(eventInfo?.variables || {});
  const filteredVariables = variableSearch.trim()
    ? variableEntries.filter(
        ([k, v]) =>
          k.toLowerCase().includes(variableSearch.toLowerCase()) ||
          (v || "").toLowerCase().includes(variableSearch.toLowerCase()),
      )
    : variableEntries;

  // Build a blob URL for "open in new tab"
  let openInNewTabHref: string | null = null;
  if (previewHtml) {
    try {
      openInNewTabHref = URL.createObjectURL(
        new Blob([previewHtml], { type: "text/html" }),
      );
    } catch {
      openInNewTabHref = null;
    }
  }

  // ── Editor column ──
  const editorColumn = (
    <div className="space-y-4">
      {/* Header strip */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">{eventLabel}</span>
              <Badge variant="outline" className="text-xs">
                {tplLanguage === "ar"
                  ? isAr ? "العربية" : "Arabic"
                  : isAr ? "الإنجليزية" : "English"}
              </Badge>
              {!isCreateMode && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  {t("emailTemplates.editor.lockedAfterCreate")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch
                  checked={isEnabled}
                  onCheckedChange={setIsEnabled}
                  id="enabled-switch"
                />
                <Label
                  htmlFor="enabled-switch"
                  className="text-xs text-muted-foreground"
                >
                  {isEnabled
                    ? t("emailTemplates.table.active")
                    : t("emailTemplates.table.inactive")}
                </Label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!dirty || isSaving || subjectMissing || bodyMissing || bodyTooLarge}
              className="gap-1.5"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {t("emailTemplates.actions.save")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDiscard}
              disabled={!dirty || isSaving}
            >
              {t("emailTemplates.actions.discard")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmReset(true)}
              className="gap-1.5"
              disabled={isSaving}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("emailTemplates.actions.resetToDefault")}
            </Button>
            {!isCreateMode && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmDelete(true)}
                className="gap-1.5 text-destructive hover:text-destructive"
                disabled={isSaving}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("emailTemplates.actions.delete")}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={guardedBack}
              className="ml-auto gap-1.5"
            >
              {isRTL ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
              {t("emailTemplates.actions.cancel")}
            </Button>
          </div>

          {dirty && (
            <p className="text-xs text-amber-600 dark:text-amber-500 inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t("emailTemplates.editor.dirtyWarning")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Subject card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            {t("emailTemplates.editor.subject")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            dir={tplLanguage === "ar" ? "rtl" : "ltr"}
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {t("emailTemplates.editor.subjectHint")}
            </span>
            <span
              className={
                subjectTooLong ? "text-destructive font-medium" : "text-muted-foreground"
              }
            >
              {t("emailTemplates.editor.subjectCounter", { used: subjectLength })}
            </span>
          </div>
          {subjectTooLong && (
            <p className="text-xs text-destructive">
              {t("emailTemplates.validation.subjectTooLong")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* HTML body card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            {t("emailTemplates.editor.htmlBody")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={htmlBody}
            onChange={(e) => setHtmlBody(e.target.value)}
            dir="ltr"
            rows={24}
            className="font-mono text-xs resize-y"
            spellCheck={false}
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {t("emailTemplates.editor.htmlBodyHint")}
            </span>
            <span
              className={
                bodyTooLarge ? "text-destructive font-medium" : "text-muted-foreground"
              }
            >
              {t("emailTemplates.editor.bytesUsed", { used: formatKB(bodyBytes) })}
            </span>
          </div>
          {bodyTooLarge && (
            <p className="text-xs text-destructive">
              {t("emailTemplates.validation.bodyTooLong")}
            </p>
          )}
          {unknownVariables.length > 0 && (
            <div className="flex items-start gap-1.5 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/40 px-2 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {t("emailTemplates.validation.unknownVariables", {
                  names: unknownVariables.join(", "),
                })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Variables card (collapsible) */}
      <Card>
        <Collapsible open={variablesOpen} onOpenChange={setVariablesOpen}>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-between w-full"
              >
                <CardTitle className="text-sm">
                  {t("emailTemplates.editor.variables")}
                </CardTitle>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${variablesOpen ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-3">
              {variableEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("emailTemplates.editor.variablesEmpty")}
                </p>
              ) : (
                <>
                  <div className="relative">
                    <Search
                      className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`}
                    />
                    <Input
                      value={variableSearch}
                      onChange={(e) => setVariableSearch(e.target.value)}
                      placeholder={t("emailTemplates.editor.variablesSearch")}
                      className={isRTL ? "pr-9" : "pl-9"}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                    {filteredVariables.map(([key, desc]) => (
                      <Button
                        key={key}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => insertVariable(key)}
                        className="h-auto py-1 px-2 text-xs font-mono"
                        title={String(desc || "")}
                      >
                        {`{{${key}}}`}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Send-test card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            {t("emailTemplates.editor.testEmailLabel")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder={t("emailTemplates.editor.testEmailPlaceholder")}
              dir="ltr"
              disabled={isCreateMode}
            />
            <Button
              onClick={handleSendTest}
              disabled={
                isCreateMode ||
                !testEmail ||
                testEmailInvalid ||
                isSendingTest
              }
              className="gap-1.5"
            >
              {isSendingTest ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {t("emailTemplates.actions.sendTest")}
            </Button>
          </div>
          {testEmailInvalid && (
            <p className="text-xs text-destructive">
              {t("emailTemplates.validation.testEmailInvalid")}
            </p>
          )}
          {isCreateMode && (
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "احفظ القالب الأول علشان تقدر تبعت اختبار."
                : "Save the template first to send a test email."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ── Preview column ──
  const previewColumn = (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">
              {t("emailTemplates.editor.previewTitle")}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={fetchPreview}
                disabled={isPreviewLoading || !subject || !htmlBody}
                title={t("emailTemplates.actions.refresh")}
              >
                {isPreviewLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              {openInNewTabHref && (
                <a
                  href={openInNewTabHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                  title={t("emailTemplates.actions.openInNewTab")}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!subject && !htmlBody ? (
            <EmptyState
              icon={Mail}
              title={
                isAr
                  ? "ابدأ بكتابة العنوان والمحتوى علشان تشوف المعاينة."
                  : "Start typing a subject and HTML body to see the preview."
              }
            />
          ) : (
            <>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {t("emailTemplates.editor.previewSubject")}
                </p>
                <p className="text-sm font-medium">
                  {previewSubject || subject || "—"}
                </p>
              </div>
              {previewError ? (
                <div className="text-center py-12 text-sm text-destructive">
                  {previewError}
                </div>
              ) : (
                <iframe
                  srcDoc={previewHtml}
                  sandbox=""
                  className="w-full h-[700px] rounded border bg-white"
                  title="Email preview"
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={guardedBack}
          className="gap-1.5"
        >
          {isRTL ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
          {t("emailTemplates.title")}
        </Button>
      </div>

      {/* Desktop layout — two columns */}
      <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6">
        {editorColumn}
        {previewColumn}
      </div>

      {/* Mobile layout — tabs */}
      <div className="lg:hidden">
        <Tabs defaultValue="editor">
          <TabsList className="w-full">
            <TabsTrigger value="editor" className="flex-1">
              {t("emailTemplates.editor.htmlBody")}
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex-1">
              {t("emailTemplates.actions.preview")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="editor" className="mt-4">
            {editorColumn}
          </TabsContent>
          <TabsContent value="preview" className="mt-4">
            {previewColumn}
          </TabsContent>
        </Tabs>
      </div>

      {/* Reset confirmation */}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("emailTemplates.confirm.reset.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("emailTemplates.confirm.reset.body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("emailTemplates.actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmReset(false);
                handleResetToDefault();
              }}
            >
              {t("emailTemplates.actions.resetToDefault")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("emailTemplates.confirm.delete.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("emailTemplates.confirm.delete.body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("emailTemplates.actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("emailTemplates.actions.delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Discard-on-leave confirmation */}
      <AlertDialog
        open={confirmDiscardOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDiscardOpen(false);
            setPendingNavigateAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("emailTemplates.confirm.discard.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("emailTemplates.confirm.discard.body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("emailTemplates.actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscardOpen(false);
                if (pendingNavigateAction) pendingNavigateAction();
                setPendingNavigateAction(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("emailTemplates.actions.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
