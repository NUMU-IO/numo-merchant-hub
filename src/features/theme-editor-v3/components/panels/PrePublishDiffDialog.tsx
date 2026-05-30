/**
 * PrePublishDiffDialog — shows "what's about to publish" before the
 * merchant commits.
 *
 * Wave 7 deliverable. Diffs the current `draft` against the last
 * published version (fetched via `fetchVersionsV3` → newest published
 * row → `fetchVersionPayloadV3`). Surfaces a section-level summary
 * with a drill-down into individual setting changes.
 *
 * UX:
 *   - "Publish 6 changes" (count from `summariseDiff`)
 *   - Sectioned list: "Hero · 2 changes · changed", "Newsletter · added"
 *   - Click a row → leaf-level diff for that section in a sub-panel
 *   - "Publish" button confirms; "Cancel" closes
 *
 * Graceful states:
 *   - No previous version published yet → "This is your first publish"
 *     message + plain confirmation.
 *   - 404 on /versions/{id} → "Diff unavailable on this backend — publish
 *     proceeds without preview." (matches VersionDiffDialog's graceful
 *     degradation.)
 *   - First-publish empty diff → "No changes to publish" + disabled
 *     Publish button.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronRight, Plus, Minus, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchVersionPayloadV3,
  fetchVersionsV3,
} from "../../services/themeEditorV3Api";
import { diffPayloads, formatLeaf, summariseDiff, type DiffEntry } from "./diffPayloads";
import type { EditorLocale, ThemeSettingsV3 } from "../../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The current draft about to be published. */
  draft: ThemeSettingsV3;
  storeId: string;
  locale: EditorLocale;
  /** Called when the merchant clicks Publish. The dialog stays open
   *  while the parent's publish promise resolves (the parent owns the
   *  loading indicator on the Publish button). */
  onConfirm: () => Promise<void>;
  /** Publishing-in-flight flag from the parent — disables the button
   *  while the API call is running. */
  publishing?: boolean;
}

interface FocusedSection {
  rootPath: string;
  label: string;
}

export function PrePublishDiffDialog({
  open,
  onOpenChange,
  draft,
  storeId,
  locale,
  onConfirm,
  publishing,
}: Props) {
  const isAr = locale === "ar";
  const [lastPublished, setLastPublished] = useState<ThemeSettingsV3 | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstPublish, setFirstPublish] = useState(false);
  // A published version exists but its payload couldn't be loaded → we can't
  // render a diff, but we must NEVER block Publish on a diff-preview failure.
  const [diffUnavailable, setDiffUnavailable] = useState(false);
  const [focused, setFocused] = useState<FocusedSection | null>(null);

  useEffect(() => {
    if (!open) {
      // Reset focused on close so re-open starts at the summary view.
      setFocused(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFirstPublish(false);
    setDiffUnavailable(false);
    setLastPublished(null);
    void (async () => {
      try {
        // Fetch the most recent versions; pick the newest "published"
        // one. We don't paginate — the latest published row will be
        // on page 1 in practice (versions are listed newest-first).
        const list = await fetchVersionsV3(storeId, 1, 20);
        if (cancelled) return;
        const published = list.versions.find((v) => v.is_published);
        if (!published) {
          setFirstPublish(true);
          return;
        }
        const payloadResp = await fetchVersionPayloadV3(storeId, published.id);
        if (cancelled) return;
        const payload = payloadResp?.payload;
        if (payload && typeof payload === "object") {
          setLastPublished(payload);
        } else {
          // A published version exists but its payload didn't come back as a
          // usable object — degrade to "diff unavailable" so Publish still
          // proceeds (never block on a diff-preview gap).
          setDiffUnavailable(true);
        }
      } catch (err) {
        if (cancelled) return;
        // ANY failure loading the baseline (missing endpoint, 404, network,
        // deleted version) → diff unavailable, but Publish still proceeds.
        // Blocking Publish on a diff-preview failure is never correct.
        setDiffUnavailable(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, storeId]);

  const entries: DiffEntry[] = useMemo(() => {
    if (!lastPublished) return [];
    return diffPayloads(lastPublished, draft);
  }, [lastPublished, draft]);

  const summary = useMemo(() => summariseDiff(entries), [entries]);

  const focusedEntries = useMemo(() => {
    if (!focused) return [];
    return entries.filter((e) => e.path.startsWith(focused.rootPath));
  }, [focused, entries]);

  // Only a TRUE "nothing to publish" (baseline loaded + zero diff) disables
  // Publish. firstPublish and diffUnavailable both keep Publish enabled.
  const noChanges =
    !loading &&
    !firstPublish &&
    !diffUnavailable &&
    lastPublished !== null &&
    entries.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {isAr ? "نشر التغييرات" : "Publish changes"}
          </DialogTitle>
          <DialogDescription>
            {isAr
              ? "راجع ما سيتم نشره. هذه التغييرات ستصبح مرئية للعملاء فور النشر."
              : "Review what's about to go live. These changes will be visible to customers immediately after publishing."}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isAr ? "جاري المقارنة..." : "Comparing with last published…"}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-md border border-destructive/30 bg-destructive/5 text-sm text-destructive">
            {isAr ? "تعذرت المقارنة" : "Could not compare"}: {error}
          </div>
        )}

        {!loading && firstPublish && (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm font-medium">
              {isAr ? "هذا هو منشورك الأول" : "This is your first publish"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "بعد النشر، ستتمكن من مقارنة كل إصدار جديد بسابقه."
                : "After publishing, future diffs will compare against this snapshot."}
            </p>
          </div>
        )}

        {!loading && noChanges && (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm font-medium">
              {isAr ? "لا توجد تغييرات للنشر" : "No changes to publish"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "المسودة الحالية مطابقة لآخر إصدار منشور."
                : "Your draft matches the last published version exactly."}
            </p>
          </div>
        )}

        {!loading && diffUnavailable && (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm font-medium">
              {isAr ? "تعذّر تحميل المقارنة" : "Diff preview unavailable"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "تعذّر تحميل آخر إصدار منشور للمقارنة، لكن يمكنك المتابعة والنشر."
                : "Couldn't load the last published version to compare — you can still publish."}
            </p>
          </div>
        )}

        {!loading && !error && summary.length > 0 && !focused && (
          <div className="max-h-96 overflow-y-auto space-y-1.5 -mx-2 px-2">
            <p className="text-xs text-muted-foreground mb-1">
              {isAr
                ? `${entries.length} تغيير عبر ${summary.length} قسم`
                : `${entries.length} changes across ${summary.length} section${
                    summary.length === 1 ? "" : "s"
                  }`}
            </p>
            {summary.map((s) => (
              <button
                key={s.rootPath}
                type="button"
                onClick={() =>
                  setFocused({ rootPath: s.rootPath, label: s.label })
                }
                className="w-full flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2.5 text-start hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {s.kind === "added" && (
                    <Plus className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  )}
                  {s.kind === "removed" && (
                    <Minus className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  )}
                  {s.kind === "changed" && (
                    <ArrowRight className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  )}
                  <span className="font-mono text-xs truncate">{s.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-[10px]">
                    {s.count}
                  </Badge>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}

        {focused && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFocused(null)}
              >
                ← {isAr ? "العودة" : "Back"}
              </Button>
              <span className="text-xs font-mono text-muted-foreground truncate max-w-md">
                {focused.rootPath}
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1 -mx-2 px-2">
              {focusedEntries.map((e, idx) => (
                <div
                  key={`${e.path}-${idx}`}
                  className={cn(
                    "rounded-md border p-2 text-xs",
                    e.kind === "added" && "border-green-200 bg-green-50",
                    e.kind === "removed" && "border-red-200 bg-red-50",
                    e.kind === "changed" && "border-amber-200 bg-amber-50",
                  )}
                >
                  <p className="font-mono text-[11px] text-muted-foreground truncate">
                    {e.path}
                  </p>
                  <div className="flex items-center gap-2 mt-1 font-mono">
                    {e.kind === "added" && (
                      <span className="text-green-700">+ {formatLeaf(e.after)}</span>
                    )}
                    {e.kind === "removed" && (
                      <span className="text-red-700">− {formatLeaf(e.before)}</span>
                    )}
                    {e.kind === "changed" && (
                      <>
                        <span className="text-muted-foreground line-through">
                          {formatLeaf(e.before)}
                        </span>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <span className="text-foreground">
                          {formatLeaf(e.after)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={publishing}
          >
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            onClick={() => void onConfirm()}
            disabled={publishing || noChanges}
          >
            {publishing && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {firstPublish
              ? isAr
                ? "نشر للمرة الأولى"
                : "Publish for the first time"
              : diffUnavailable
                ? isAr
                  ? "نشر"
                  : "Publish"
                : isAr
                  ? `نشر ${entries.length} تغيير`
                  : `Publish ${entries.length} change${
                      entries.length === 1 ? "" : "s"
                    }`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PrePublishDiffDialog;
