import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Mail,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Lock,
  Loader2,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  listEmailTemplates,
  listEmailTemplateEvents,
  updateEmailTemplate,
  deleteEmailTemplate,
} from "@/services/emailTemplatesApi";
import type {
  EmailTemplate,
  EmailTemplateEventInfo,
  EmailTemplateLanguage,
  ListEmailTemplatesParams,
} from "@/services/emailTemplatesApi";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";

const PAGE_SIZE = 20;
const SUBJECT_TRUNCATE = 60;

type StatusFilter = "all" | "active" | "inactive";

function truncate(s: string, n: number): string {
  if (!s) return "";
  if (s.length <= n) return s;
  return s.slice(0, n) + "…";
}

export default function EmailTemplates() {
  const { t } = useTranslation();
  const { language, isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  // Permission gate: only store_owner may manage email templates.
  const canManage = user?.role === "store_owner";

  const [events, setEvents] = useState<EmailTemplateEventInfo[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [enabledFilter, setEnabledFilter] = useState<StatusFilter>("all");

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardEvent, setWizardEvent] = useState<string>("");
  const [wizardLanguage, setWizardLanguage] = useState<EmailTemplateLanguage>(
    isAr ? "ar" : "en",
  );

  // Delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Track templates that are mid-toggle so we can disable the switch
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const params: ListEmailTemplatesParams = {
        page,
        limit: PAGE_SIZE,
      };
      if (eventTypeFilter !== "all") params.event_type = eventTypeFilter;
      if (languageFilter !== "all") {
        params.language = languageFilter as EmailTemplateLanguage;
      }
      if (enabledFilter === "active") params.is_enabled = true;
      if (enabledFilter === "inactive") params.is_enabled = false;

      const [eventsRes, templatesRes] = await Promise.all([
        listEmailTemplateEvents(storeId),
        listEmailTemplates(storeId, params),
      ]);
      setEvents(Array.isArray(eventsRes) ? eventsRes : []);
      setTemplates(templatesRes.items || []);
      setTotal(templatesRes.total || 0);
      setTotalPages(templatesRes.total_pages || 1);
    } catch (err: unknown) {
      console.error("Failed to fetch email templates:", err);
      setErrorMsg(isAr ? "فشل تحميل القوالب" : "Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  }, [storeId, page, eventTypeFilter, languageFilter, enabledFilter, isAr]);

  useEffect(() => {
    if (canManage) {
      fetchData();
    }
  }, [fetchData, canManage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [eventTypeFilter, languageFilter, enabledFilter]);

  const eventLabelFor = (eventType: string): string => {
    const info = events.find((e) => e.event_type === eventType);
    if (!info) return eventType;
    return isAr ? info.label_ar : info.label_en;
  };

  const handleToggleEnabled = async (tpl: EmailTemplate, next: boolean) => {
    if (!storeId) return;
    // Optimistic update
    setTemplates((prev) =>
      prev.map((p) => (p.id === tpl.id ? { ...p, is_enabled: next } : p)),
    );
    setTogglingIds((prev) => {
      const s = new Set(prev);
      s.add(tpl.id);
      return s;
    });
    try {
      const updated = await updateEmailTemplate(storeId, tpl.id, {
        is_enabled: next,
      });
      setTemplates((prev) =>
        prev.map((p) => (p.id === tpl.id ? updated : p)),
      );
    } catch (err: unknown) {
      // Revert
      setTemplates((prev) =>
        prev.map((p) => (p.id === tpl.id ? { ...p, is_enabled: !next } : p)),
      );
      showError(err, language);
    } finally {
      setTogglingIds((prev) => {
        const s = new Set(prev);
        s.delete(tpl.id);
        return s;
      });
    }
  };

  const handleDelete = async () => {
    if (!storeId || !confirmDeleteId) return;
    setIsDeleting(true);
    try {
      await deleteEmailTemplate(storeId, confirmDeleteId);
      toast.success(t("emailTemplates.toast.deleted"));
      setConfirmDeleteId(null);
      fetchData();
    } catch (err: unknown) {
      showError(err, language);
    } finally {
      setIsDeleting(false);
    }
  };

  const openWizard = () => {
    setWizardEvent(events[0]?.event_type || "");
    setWizardLanguage(isAr ? "ar" : "en");
    setWizardOpen(true);
  };

  const handleWizardContinue = () => {
    if (!wizardEvent) return;
    const qs = new URLSearchParams({
      event_type: wizardEvent,
      language: wizardLanguage,
    });
    setWizardOpen(false);
    navigate(`/email-templates/new?${qs.toString()}`);
  };

  const clearFilters = () => {
    setEventTypeFilter("all");
    setLanguageFilter("all");
    setEnabledFilter("all");
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

  const formatUpdatedAt = (s: string) => {
    if (!s) return "—";
    try {
      return new Date(s).toLocaleDateString(isAr ? "ar-EG" : "en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return s;
    }
  };

  const filtersActive =
    eventTypeFilter !== "all" ||
    languageFilter !== "all" ||
    enabledFilter !== "all";

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight leading-tight flex items-center gap-2.5">
              <Mail className="h-6 w-6 text-saffron" />
              {t("emailTemplates.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("emailTemplates.subtitle")}
            </p>
          </div>
          <Button className="gap-2" onClick={openWizard}>
            <Plus className="h-4 w-4" />
            {t("emailTemplates.actions.create")}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={eventTypeFilter}
            onValueChange={(v) => setEventTypeFilter(v)}
          >
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("emailTemplates.filters.allEvents")}
              </SelectItem>
              {events.map((ev) => (
                <SelectItem key={ev.event_type} value={ev.event_type}>
                  {isAr ? ev.label_ar : ev.label_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={languageFilter}
            onValueChange={(v) => setLanguageFilter(v)}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("emailTemplates.filters.allLanguages")}
              </SelectItem>
              <SelectItem value="ar">{isAr ? "العربية" : "Arabic"}</SelectItem>
              <SelectItem value="en">
                {isAr ? "الإنجليزية" : "English"}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={enabledFilter}
            onValueChange={(v) => setEnabledFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("emailTemplates.filters.statusAll")}
              </SelectItem>
              <SelectItem value="active">
                {t("emailTemplates.filters.statusActive")}
              </SelectItem>
              <SelectItem value="inactive">
                {t("emailTemplates.filters.statusInactive")}
              </SelectItem>
            </SelectContent>
          </Select>

          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {t("emailTemplates.filters.clear")}
            </Button>
          )}
        </div>

        {/* Templates table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("emailTemplates.table.eventType")}</TableHead>
                    <TableHead>{t("emailTemplates.table.language")}</TableHead>
                    <TableHead>{t("emailTemplates.table.subject")}</TableHead>
                    <TableHead>{t("emailTemplates.table.status")}</TableHead>
                    <TableHead>{t("emailTemplates.table.updatedAt")}</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-10" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : errorMsg ? (
              <div className="text-center py-16 text-muted-foreground">
                <p>{errorMsg}</p>
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() => fetchData()}
                >
                  {isAr ? "حاول تاني" : "Try again"}
                </Button>
              </div>
            ) : templates.length === 0 ? (
              <EmptyState
                icon={Mail}
                title={t("emailTemplates.empty.title")}
                description={t("emailTemplates.empty.body")}
                action={
                  <Button className="gap-2" onClick={openWizard}>
                    <Plus className="h-4 w-4" />
                    {t("emailTemplates.empty.cta")}
                  </Button>
                }
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("emailTemplates.table.eventType")}</TableHead>
                      <TableHead>{t("emailTemplates.table.language")}</TableHead>
                      <TableHead>{t("emailTemplates.table.subject")}</TableHead>
                      <TableHead>{t("emailTemplates.table.status")}</TableHead>
                      <TableHead>{t("emailTemplates.table.updatedAt")}</TableHead>
                      <TableHead className="w-[100px] text-right">
                        {t("emailTemplates.table.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((tpl) => {
                      const subject = tpl.subject || "";
                      const truncated = truncate(subject, SUBJECT_TRUNCATE);
                      const isTruncated = subject.length > SUBJECT_TRUNCATE;
                      const isToggling = togglingIds.has(tpl.id);
                      return (
                        <TableRow key={tpl.id}>
                          <TableCell className="font-medium">
                            {eventLabelFor(tpl.event_type)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {tpl.language === "ar"
                                ? isAr ? "العربية" : "Arabic"
                                : isAr ? "الإنجليزية" : "English"}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[360px]">
                            {isTruncated ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-sm cursor-help">
                                    {truncated}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md">
                                  <p className="text-xs whitespace-pre-wrap break-words">
                                    {subject}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-sm">{subject || "—"}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={tpl.is_enabled}
                                disabled={isToggling}
                                onCheckedChange={(v) =>
                                  handleToggleEnabled(tpl, v)
                                }
                              />
                              <span className="text-xs text-muted-foreground">
                                {tpl.is_enabled
                                  ? t("emailTemplates.table.active")
                                  : t("emailTemplates.table.inactive")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatUpdatedAt(tpl.updated_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  navigate(`/email-templates/${tpl.id}`)
                                }
                                aria-label={t("emailTemplates.actions.edit")}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setConfirmDeleteId(tpl.id)}
                                aria-label={t("emailTemplates.actions.delete")}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-sm text-muted-foreground">
                      {isAr
                        ? `صفحة ${page} من ${totalPages} (${total} قالب)`
                        : `Page ${page} of ${totalPages} (${total} template${total !== 1 ? "s" : ""})`}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        {isRTL ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronLeft className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        {isRTL ? (
                          <ChevronLeft className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Wizard dialog */}
        <Dialog
          open={wizardOpen}
          onOpenChange={(open) => {
            if (!open) setWizardOpen(false);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("emailTemplates.wizard.title")}</DialogTitle>
              <DialogDescription>
                {t("emailTemplates.subtitle")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium block mb-1">
                  {t("emailTemplates.wizard.eventTypeLabel")}
                </label>
                <Select
                  value={wizardEvent}
                  onValueChange={setWizardEvent}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("emailTemplates.wizard.eventTypeLabel")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((ev) => (
                      <SelectItem key={ev.event_type} value={ev.event_type}>
                        {isAr ? ev.label_ar : ev.label_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">
                  {t("emailTemplates.wizard.languageLabel")}
                </label>
                <Select
                  value={wizardLanguage}
                  onValueChange={(v) =>
                    setWizardLanguage(v as EmailTemplateLanguage)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">
                      {isAr ? "العربية" : "Arabic"}
                    </SelectItem>
                    <SelectItem value="en">
                      {isAr ? "الإنجليزية" : "English"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setWizardOpen(false)}
              >
                {t("emailTemplates.actions.cancel")}
              </Button>
              <Button
                onClick={handleWizardContinue}
                disabled={!wizardEvent}
              >
                {t("emailTemplates.wizard.continue")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog
          open={!!confirmDeleteId}
          onOpenChange={(open) => {
            if (!open) setConfirmDeleteId(null);
          }}
        >
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
      </div>
    </TooltipProvider>
  );
}
