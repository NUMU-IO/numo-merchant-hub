/**
 * VersionHistoryPanel — Browse + restore prior theme customization versions.
 *
 * Backend returns rows from `theme_customization_versions` with these flags:
 *  - `is_published=true`  — created on publish (the "real" history a user cares about)
 *  - `is_autosave=true`   — created on every autosave/restore
 *  - `version_label`      — optional merchant-supplied label (free-form)
 *
 * We surface published rows by default; autosaves are hidden behind a toggle
 * so the list isn't dominated by editor noise.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Clock,
  History,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCustomizerStore } from "../../store/customizerStore";
import { fetchVersionsV3 } from "../../services/themeEditorV3Api";
import type { CustomizationVersion } from "../../types";

export function VersionHistoryPanel() {
  const locale = useCustomizerStore((s) => s.locale);
  const storeId = useCustomizerStore((s) => s.storeId);
  const isDirty = useCustomizerStore((s) => s.isDirty);
  const isSaving = useCustomizerStore((s) => s.isSaving);
  const lastSavedAt = useCustomizerStore((s) => s.lastSavedAt);
  const restoreVersion = useCustomizerStore((s) => s.restoreVersion);

  const [versions, setVersions] = useState<CustomizationVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [showAutosaves, setShowAutosaves] = useState(false);

  const fetchVersions = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVersionsV3(storeId, 1, 50);
      setVersions(data.versions ?? []);
    } catch {
      setError(
        locale === "ar" ? "فشل تحميل السجل." : "Failed to load history.",
      );
    } finally {
      setLoading(false);
    }
  }, [storeId, locale]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleRestore = useCallback(
    async (versionId: string) => {
      setRestoring(versionId);
      try {
        await restoreVersion(versionId);
        setConfirmRestore(null);
        await fetchVersions();
      } catch {
        // Error already surfaced through the store's `error` field.
      } finally {
        setRestoring(null);
      }
    },
    [restoreVersion, fetchVersions],
  );

  const formatTime = useCallback(
    (iso: string | null) => {
      if (!iso) return "";
      try {
        const date = new Date(iso);
        return new Intl.DateTimeFormat(
          locale === "ar" ? "ar-EG" : "en-US",
          { dateStyle: "medium", timeStyle: "short" },
        ).format(date);
      } catch {
        return iso;
      }
    },
    [locale],
  );

  const visible = showAutosaves
    ? versions
    : versions.filter((v) => v.is_published);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">
          {locale === "ar" ? "سجل الإصدارات" : "Version History"}
        </h2>
      </div>

      {/* Auto-save status */}
      <div className="border-b px-4 py-2">
        <div className="flex items-center gap-2 text-xs">
          {isSaving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">
                {locale === "ar" ? "جاري الحفظ..." : "Saving..."}
              </span>
            </>
          ) : isDirty ? (
            <>
              <Clock className="h-3 w-3 text-amber-500" />
              <span className="text-amber-600">
                {locale === "ar" ? "تغييرات غير محفوظة" : "Unsaved changes"}
              </span>
            </>
          ) : lastSavedAt ? (
            <>
              <Check className="h-3 w-3 text-green-500" />
              <span className="text-muted-foreground">
                {locale === "ar" ? "آخر حفظ: " : "Last saved: "}
                {formatTime(lastSavedAt)}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              {locale === "ar" ? "لم يتم الحفظ بعد" : "Not saved yet"}
            </span>
          )}
        </div>
      </div>

      {/* Filter toggle */}
      <div className="flex items-center justify-between border-b px-4 py-2 text-xs">
        <span className="text-muted-foreground">
          {locale === "ar"
            ? showAutosaves
              ? "إظهار الحفظ التلقائي"
              : "إخفاء الحفظ التلقائي"
            : showAutosaves
              ? "Showing autosaves"
              : "Hiding autosaves"}
        </span>
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={() => setShowAutosaves((v) => !v)}
        >
          {showAutosaves
            ? locale === "ar"
              ? "إخفاء"
              : "Hide"
            : locale === "ar"
              ? "إظهار"
              : "Show"}
        </button>
      </div>

      {/* Version list */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={fetchVersions}
            >
              {locale === "ar" ? "إعادة المحاولة" : "Retry"}
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {locale === "ar"
              ? "لا توجد إصدارات بعد. انشر لإنشاء أول إصدار."
              : "No versions yet. Publish to create the first version."}
          </p>
        ) : (
          visible.map((version) => (
            <div
              key={version.id}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                version.is_published && "border-primary/30 bg-primary/5",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {version.is_published
                        ? locale === "ar"
                          ? "منشور"
                          : "Published"
                        : locale === "ar"
                          ? "حفظ تلقائي"
                          : "Autosave"}
                    </span>
                    {version.version_label && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {version.version_label}
                      </span>
                    )}
                  </div>
                  {version.change_summary && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {version.change_summary}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatTime(version.created_at)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  {confirmRestore === version.id ? (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        disabled={restoring === version.id}
                        onClick={() => handleRestore(version.id)}
                      >
                        {restoring === version.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        {locale === "ar" ? "تأكيد" : "Confirm"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setConfirmRestore(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => setConfirmRestore(version.id)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {locale === "ar" ? "استعادة" : "Restore"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
