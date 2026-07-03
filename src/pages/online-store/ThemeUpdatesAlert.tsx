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
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  ArrowUpCircle,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import {
  checkThemeUpdates,
  applyThemeUpdate,
  skipThemeUpdate,
  type ThemeUpdateNotification,
} from "@/services/themeUpdatesApi";

const T = {
  eyebrow: { en: "Theme update", ar: "تحديث القالب" },
  available: { en: "A new version is ready", ar: "إصدار جديد جاهز" },
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
            className="group relative overflow-hidden rounded-2xl border bg-card shadow-sm"
          >
            {/* Slim status rail — the only color the card carries, so it reads
                as a native surface rather than a tinted alert box. */}
            <span
              aria-hidden
              className={`absolute inset-y-0 ${isRTL ? "right-0" : "left-0"} w-1 ${
                manual ? "bg-amber-400/80" : "bg-primary/70"
              }`}
            />

            <div className="p-5 ps-6">
              <div className="flex items-start gap-4">
                {/* Icon chip — neutral tile, not a floating sparkle. */}
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                    manual
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {manual ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <ArrowUpCircle className="h-5 w-5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {/* Eyebrow + status pill */}
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                      {tr("eyebrow")}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        manual
                          ? "border-amber-300/70 text-amber-700 dark:border-amber-800/60 dark:text-amber-400"
                          : "border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          manual ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                      />
                      {manual ? tr("manual") : tr("automatic")}
                    </span>
                  </div>

                  {/* Headline */}
                  <h3 className="mt-1.5 text-[15px] font-semibold tracking-tight">
                    {tr("available")}
                  </h3>

                  {/* Version jump — mono pills, new version emphasized */}
                  <div
                    dir="ltr"
                    className={`mt-2 inline-flex items-center gap-2 font-mono text-xs ltr-nums ${
                      isRTL ? "flex-row-reverse" : ""
                    }`}
                  >
                    <span className="text-muted-foreground/70 line-through decoration-muted-foreground/30">
                      v{n.from_version || "?"}
                    </span>
                    <ArrowRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/50 ${isRTL ? "rotate-180" : ""}`} />
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
                      v{n.to_version}
                    </span>
                  </div>

                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {manual ? tr("manualHint") : tr("autoHint")}
                  </p>

                  {(n.changes.length > 0 || n.release_notes) && (
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
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
                    <div className="mt-3 space-y-2.5 rounded-xl border bg-muted/40 p-3.5 text-sm">
                      {n.changes.length > 0 && (
                        <ul className="space-y-1.5">
                          {n.changes.map((c, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <span
                                className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                                  c.breaking ? "bg-amber-500" : "bg-emerald-500"
                                }`}
                              />
                              <span className="leading-relaxed">
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
                        <div className="border-t pt-2.5">
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {tr("releaseNotes")}
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
                            {n.release_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={busy}
                      onClick={() => applyMut.mutate(n.id)}
                    >
                      {applyMut.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUpCircle className="h-4 w-4" />
                      )}
                      {tr("apply")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                      disabled={busy}
                      onClick={() => skipMut.mutate(n.id)}
                    >
                      {tr("skip")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
