/**
 * VersionHistoryPanel — Displays version history with restore capability.
 *
 * Features:
 *  - Lists all published versions (fetched from backend)
 *  - Shows version number, label, timestamp, and publisher
 *  - Preview a version before restoring
 *  - Restore button with confirmation
 *  - Auto-save indicator showing current draft status
 *  - Bilingual labels (EN/AR)
 */

import { useState, useEffect, useCallback } from "react";
import {
  History,
  RotateCcw,
  Eye,
  Check,
  X,
  Loader2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCustomizerStore } from "../../store/customizerStore";
import { themeEditorV3Api } from "../../services/themeEditorV3Api";

interface VersionEntry {
  id: string;
  version_number: number;
  label: string;
  published_at: string;
  published_by: string;
  is_current: boolean;
}

export function VersionHistoryPanel() {
  const locale = useCustomizerStore((s) => s.locale);
  const storeId = useCustomizerStore((s) => s.storeId);
  const isDirty = useCustomizerStore((s) => s.isDirty);
  const isSaving = useCustomizerStore((s) => s.isSaving);
  const lastSavedAt = useCustomizerStore((s) => s.lastSavedAt);
  const restoreVersion = useCustomizerStore((s) => s.restoreVersion);
  const setActivePanel = useCustomizerStore((s) => s.setActivePanel);

  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  // Fetch version history
  const fetchVersions = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await themeEditorV3Api.getVersionHistory(storeId, 1, 50);
      setVersions(data.items ?? []);
    } catch (err) {
      setError(locale === "ar" ? "فشل تحميل السجل." : "Failed to load history.");
    } finally {
      setLoading(false);
    }
  }, [storeId, locale]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  // Handle restore
  const handleRestore = useCallback(
    async (versionId: string) => {
      setRestoring(versionId);
      try {
        await restoreVersion(versionId);
        setConfirmRestore(null);
        // Refresh the list
        await fetchVersions();
      } catch {
        // Error handled by the store
      } finally {
        setRestoring(null);
      }
    },
    [restoreVersion, fetchVersions],
  );

  // Format timestamp
  const formatTime = useCallback(
    (iso: string) => {
      try {
        const date = new Date(iso);
        return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(date);
      } catch {
        return iso;
      }
    },
    [locale],
  );

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

      {/* Version list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={fetchVersions}>
              {locale === "ar" ? "إعادة المحاولة" : "Retry"}
            </Button>
          </div>
        ) : versions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {locale === "ar"
              ? "لا توجد إصدارات منشورة بعد. انشر لإنشاء أول إصدار."
              : "No published versions yet. Publish to create the first version."}
          </p>
        ) : (
          versions.map((version) => (
            <div
              key={version.id}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                version.is_current && "border-primary/50 bg-primary/5",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      v{version.version_number}
                    </span>
                    {version.is_current && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {locale === "ar" ? "الحالي" : "Current"}
                      </span>
                    )}
                  </div>
                  {version.label && (
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      {version.label}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatTime(version.published_at)}
                  </p>
                </div>

                {/* Actions */}
                {!version.is_current && (
                  <div className="flex items-center gap-1 shrink-0">
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
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
