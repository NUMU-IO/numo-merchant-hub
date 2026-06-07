/**
 * Theme update channel — inline alert (Phase 5.1).
 *
 * Renders on the Themes/Library page when the merchant's installed theme has
 * a newer published version. Shows the version jump, a manual/automatic
 * classification, an expandable "What changed" (the classifier's change list
 * + release notes), and Apply / Skip. Apply re-points the store to the latest
 * version (snapshot-first on the backend) — never silent, even for automatic
 * updates. Bilingual (en + Egyptian Arabic) + RTL via `isRTL`.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  Sparkles,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Download,
} from "lucide-react";
import {
  checkThemeUpdates,
  applyThemeUpdate,
  skipThemeUpdate,
  type ThemeUpdateNotification,
} from "@/services/themeUpdatesApi";

const T = {
  available: { en: "Theme update available", ar: "يتوفّر تحديث للقالب" },
  manual: { en: "Review needed", ar: "يتطلّب مراجعة" },
  automatic: { en: "Safe update", ar: "تحديث آمن" },
  from: { en: "Installed", ar: "المثبّت" },
  to: { en: "New", ar: "الجديد" },
  whatChanged: { en: "What changed", ar: "ما الذي تغيّر" },
  hideChanges: { en: "Hide details", ar: "إخفاء التفاصيل" },
  releaseNotes: { en: "Release notes", ar: "ملاحظات الإصدار" },
  breaking: { en: "may affect your customization", ar: "قد يؤثّر على تخصيصك" },
  apply: { en: "Apply update", ar: "تطبيق التحديث" },
  skip: { en: "Skip", ar: "تخطّي" },
  applied: { en: "Update applied — a snapshot was saved first", ar: "تم تطبيق التحديث — تم حفظ نسخة احتياطية أولاً" },
  skipped: { en: "Update skipped", ar: "تم تخطّي التحديث" },
  manualHint: {
    en: "This version changes settings your theme uses. Review the changes, then apply when ready — we snapshot your current theme first so you can roll back.",
    ar: "يغيّر هذا الإصدار إعدادات يستخدمها قالبك. راجع التغييرات ثم طبّقه عند الاستعداد — نحفظ نسخة من قالبك الحالي أولاً حتى يمكنك التراجع.",
  },
  autoHint: {
    en: "This update is safe to apply — no settings were removed or changed.",
    ar: "هذا التحديث آمن للتطبيق — لم تتم إزالة أو تغيير أي إعدادات.",
  },
};

export function ThemeUpdatesAlert({ storeId }: { storeId: string }) {
  const { isRTL } = useLanguage();
  const tr = (k: keyof typeof T) => (isRTL ? T[k].ar : T[k].en);
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  // POST /check runs detection server-side and returns the pending set.
  const { data: notifs = [] } = useQuery({
    queryKey: ["theme-updates", storeId],
    queryFn: () => checkThemeUpdates(storeId),
    enabled: !!storeId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const applyMut = useMutation({
    mutationFn: (id: string) => applyThemeUpdate(storeId, id),
    onSuccess: () => {
      toast.success(tr("applied"));
      qc.invalidateQueries({ queryKey: ["theme-updates", storeId] });
      qc.invalidateQueries({ queryKey: ["store-themes", storeId] });
      qc.invalidateQueries({ queryKey: ["customization", storeId] });
    },
    onError: showError,
  });

  const skipMut = useMutation({
    mutationFn: (id: string) => skipThemeUpdate(storeId, id),
    onSuccess: () => {
      toast.success(tr("skipped"));
      qc.invalidateQueries({ queryKey: ["theme-updates", storeId] });
    },
    onError: showError,
  });

  const pending = notifs.filter((n) => n.status === "pending");
  if (pending.length === 0) return null;

  return (
    <div className="space-y-3" dir={isRTL ? "rtl" : "ltr"}>
      {pending.map((n: ThemeUpdateNotification) => {
        const manual = n.classification === "manual";
        const isOpen = expanded === n.id;
        const busy = applyMut.isPending || skipMut.isPending;
        return (
          <div
            key={n.id}
            className={`rounded-lg border p-4 ${
              manual
                ? "border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30"
                : "border-indigo-200 bg-indigo-50 dark:border-indigo-800/60 dark:bg-indigo-950/30"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {manual ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{tr("available")}</span>
                  <Badge variant={manual ? "outline" : "secondary"}>
                    {manual ? tr("manual") : tr("automatic")}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {tr("from")} v{n.from_version || "?"} → {tr("to")} v{n.to_version}
                  </span>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  {manual ? tr("manualHint") : tr("autoHint")}
                </p>

                {(n.changes.length > 0 || n.release_notes) && (
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-foreground/80 hover:text-foreground"
                    onClick={() => setExpanded(isOpen ? null : n.id)}
                  >
                    {isOpen ? tr("hideChanges") : tr("whatChanged")}
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                )}

                {isOpen && (
                  <div className="mt-2 space-y-2 rounded-md border bg-background/60 p-3 text-sm">
                    {n.changes.length > 0 && (
                      <ul className="space-y-1">
                        {n.changes.map((c, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span
                              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                                c.breaking ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                            />
                            <span>
                              {c.detail}
                              {c.breaking && (
                                <span className="text-amber-600 dark:text-amber-400">
                                  {" "}
                                  — {tr("breaking")}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {n.release_notes && (
                      <div className="border-t pt-2">
                        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                          {tr("releaseNotes")}
                        </div>
                        <p className="whitespace-pre-wrap text-foreground/90">
                          {n.release_notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => applyMut.mutate(n.id)}
                  >
                    {applyMut.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {tr("apply")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => skipMut.mutate(n.id)}
                  >
                    {tr("skip")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
