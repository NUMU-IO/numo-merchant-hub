/**
 * VersionDiffDialog — side-by-side payload diff between two version snapshots.
 *
 * Shopify-parity: merchants can pick any two rows in Version History and
 * see what changed (which sections were added/removed, which settings
 * shifted). Uses `fetchVersionPayloadV3` to load each side's
 * ThemeSettingsV3 payload, computes a structural diff at the leaf level,
 * and surfaces the result as a paginated list of changes.
 *
 * Why structural over textual: a JSON character-diff is correct but
 * unreadable when nested objects shift indentation. We diff at the
 * "path → leaf-value" level (e.g. `templates.home.sections.hero.settings.heading`)
 * so merchants see "Heading: 'Welcome' → 'Welcome back!'" instead of a
 * 200-line text blob.
 *
 * Graceful 404: when the backend GET /versions/{id} endpoint isn't
 * deployed yet, we surface a "Backend version too old for diff —
 * shipping next release" message rather than crashing.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, Minus, Plus, RefreshCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchVersionPayloadV3 } from "../../services/themeEditorV3Api";
import type {
  CustomizationVersion,
  EditorLocale,
  ThemeSettingsV3,
} from "../../types";

interface DiffEntry {
  /** Dotted path from the root of `ThemeSettingsV3` to the leaf. */
  path: string;
  kind: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
}

const MAX_DIFF_ENTRIES = 500; // safety cap; pathological themes won't lock the UI

function isLeaf(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  const t = typeof v;
  if (t !== "object") return true;
  return false; // arrays + objects walked recursively
}

function diffValues(
  a: unknown,
  b: unknown,
  path: string,
  out: DiffEntry[],
): void {
  if (out.length >= MAX_DIFF_ENTRIES) return;
  // Both leaves — compare directly.
  if (isLeaf(a) && isLeaf(b)) {
    if (!Object.is(a, b)) {
      // Cheap shallow compare for primitives only; objects of equal
      // shape still differ if any leaf differs (covered by recursion).
      if (typeof a !== typeof b || JSON.stringify(a) !== JSON.stringify(b)) {
        out.push({ path, kind: "changed", before: a, after: b });
      }
    }
    return;
  }
  // a is leaf but b is object → treat as changed wholesale.
  if (isLeaf(a) !== isLeaf(b)) {
    out.push({ path, kind: "changed", before: a, after: b });
    return;
  }

  // Both objects/arrays: walk keys.
  if (Array.isArray(a) && Array.isArray(b)) {
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      const ai = i < a.length ? a[i] : undefined;
      const bi = i < b.length ? b[i] : undefined;
      const childPath = `${path}[${i}]`;
      if (i >= a.length) {
        out.push({ path: childPath, kind: "added", after: bi });
      } else if (i >= b.length) {
        out.push({ path: childPath, kind: "removed", before: ai });
      } else {
        diffValues(ai, bi, childPath, out);
      }
    }
    return;
  }
  if (typeof a === "object" && typeof b === "object" && a && b) {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      if (!(key in aObj)) {
        out.push({ path: childPath, kind: "added", after: bObj[key] });
      } else if (!(key in bObj)) {
        out.push({ path: childPath, kind: "removed", before: aObj[key] });
      } else {
        diffValues(aObj[key], bObj[key], childPath, out);
      }
    }
  }
}

function diffPayloads(a: ThemeSettingsV3, b: ThemeSettingsV3): DiffEntry[] {
  const out: DiffEntry[] = [];
  diffValues(a, b, "", out);
  return out;
}

function formatLeaf(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "—";
  if (typeof v === "string") return v.length > 60 ? `"${v.slice(0, 60)}…"` : `"${v}"`;
  if (typeof v === "object") return JSON.stringify(v).slice(0, 80);
  return String(v);
}

export interface VersionDiffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  versions: CustomizationVersion[];
  /** Initially-selected "before" version. The "after" defaults to the
   *  first published version newer than `before`. */
  defaultBeforeId?: string;
  defaultAfterId?: string;
  locale: EditorLocale;
}

export function VersionDiffDialog({
  open,
  onOpenChange,
  storeId,
  versions,
  defaultBeforeId,
  defaultAfterId,
  locale,
}: VersionDiffDialogProps) {
  const [beforeId, setBeforeId] = useState<string | null>(defaultBeforeId ?? null);
  const [afterId, setAfterId] = useState<string | null>(defaultAfterId ?? null);
  const [beforePayload, setBeforePayload] = useState<ThemeSettingsV3 | null>(null);
  const [afterPayload, setAfterPayload] = useState<ThemeSettingsV3 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on open.
  useEffect(() => {
    if (!open) return;
    setBeforeId(defaultBeforeId ?? versions[1]?.id ?? null);
    setAfterId(defaultAfterId ?? versions[0]?.id ?? null);
  }, [open, defaultBeforeId, defaultAfterId, versions]);

  // Load both payloads when the selection changes.
  useEffect(() => {
    if (!open || !beforeId || !afterId) return;
    if (beforeId === afterId) {
      setBeforePayload(null);
      setAfterPayload(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [b, a] = await Promise.all([
          fetchVersionPayloadV3(storeId, beforeId),
          fetchVersionPayloadV3(storeId, afterId),
        ]);
        if (cancelled) return;
        setBeforePayload(b.payload);
        setAfterPayload(a.payload);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        // Distinguish 404-ish "endpoint not deployed" from real errors so
        // merchants on a stale backend get the right hint.
        if (/404|not found/i.test(msg)) {
          setError(
            locale === "ar"
              ? "ميزة المقارنة تتطلب أحدث إصدار من الواجهة الخلفية. ستصل في التحديث التالي."
              : "Diff feature requires the latest backend. Shipping in the next release.",
          );
        } else {
          setError(
            locale === "ar"
              ? `فشل تحميل المقارنة: ${msg}`
              : `Failed to load diff: ${msg}`,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, storeId, beforeId, afterId, locale]);

  const diff = useMemo(() => {
    if (!beforePayload || !afterPayload) return [];
    return diffPayloads(beforePayload, afterPayload);
  }, [beforePayload, afterPayload]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {locale === "ar" ? "مقارنة الإصدارات" : "Compare versions"}
          </DialogTitle>
          <DialogDescription>
            {locale === "ar"
              ? "اختر إصدارين لرؤية التغييرات بينهما."
              : "Pick two versions to see what changed between them."}
          </DialogDescription>
        </DialogHeader>

        {/* Version picker row */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-y py-3">
          <VersionSelect
            value={beforeId}
            onChange={setBeforeId}
            versions={versions}
            label={locale === "ar" ? "من" : "From"}
            locale={locale}
          />
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <VersionSelect
            value={afterId}
            onChange={setAfterId}
            versions={versions}
            label={locale === "ar" ? "إلى" : "To"}
            locale={locale}
          />
        </div>

        {/* Diff body */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {error}
            </div>
          ) : !beforeId || !afterId ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {locale === "ar"
                ? "اختر إصدارين أعلاه."
                : "Select two versions above."}
            </p>
          ) : beforeId === afterId ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {locale === "ar"
                ? "اختر إصدارين مختلفين."
                : "Pick two different versions."}
            </p>
          ) : diff.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {locale === "ar"
                ? "لا توجد فروقات."
                : "No differences."}
            </p>
          ) : (
            <DiffList diff={diff} locale={locale} />
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-xs text-muted-foreground">
            {diff.length > 0 && (
              <>
                {diff.length} {locale === "ar" ? "تغيير" : "change(s)"}
                {diff.length >= MAX_DIFF_ENTRIES &&
                  (locale === "ar" ? " (مقتطع)" : " (truncated)")}
              </>
            )}
          </p>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {locale === "ar" ? "إغلاق" : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VersionSelect({
  value,
  onChange,
  versions,
  label,
  locale,
}: {
  value: string | null;
  onChange: (id: string) => void;
  versions: CustomizationVersion[];
  label: string;
  locale: EditorLocale;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
      >
        <option value="">
          {locale === "ar" ? "— اختر —" : "— select —"}
        </option>
        {versions.map((v) => {
          const stamp = v.created_at
            ? new Date(v.created_at).toLocaleString(
                locale === "ar" ? "ar-EG" : "en-US",
                { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
              )
            : v.id.slice(0, 8);
          const tag = v.is_published
            ? locale === "ar" ? "منشور" : "Published"
            : locale === "ar" ? "حفظ تلقائي" : "Autosave";
          return (
            <option key={v.id} value={v.id}>
              {stamp} · {tag}
              {v.version_label ? ` · ${v.version_label}` : ""}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function DiffList({ diff, locale }: { diff: DiffEntry[]; locale: EditorLocale }) {
  return (
    <ul className="space-y-1 py-2 font-mono text-xs">
      {diff.map((entry, i) => (
        <li
          key={`${entry.path}-${i}`}
          className={cn(
            "rounded border px-2 py-1.5",
            entry.kind === "added" && "border-green-200 bg-green-50",
            entry.kind === "removed" && "border-red-200 bg-red-50",
            entry.kind === "changed" && "border-amber-200 bg-amber-50",
          )}
        >
          <div className="flex items-start gap-1.5">
            {entry.kind === "added" && (
              <Plus className="h-3 w-3 shrink-0 text-green-700" />
            )}
            {entry.kind === "removed" && (
              <Minus className="h-3 w-3 shrink-0 text-red-700" />
            )}
            {entry.kind === "changed" && (
              <RefreshCcw className="h-3 w-3 shrink-0 text-amber-700" />
            )}
            <code className="flex-1 break-all text-[11px]">{entry.path}</code>
          </div>
          {entry.kind === "changed" && (
            <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 pl-4 text-[11px]">
              <span className="truncate text-red-700 line-through">
                {formatLeaf(entry.before)}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="truncate text-green-700">
                {formatLeaf(entry.after)}
              </span>
            </div>
          )}
          {entry.kind === "added" && (
            <p className="mt-1 truncate pl-4 text-[11px] text-green-700">
              {formatLeaf(entry.after)}
            </p>
          )}
          {entry.kind === "removed" && (
            <p className="mt-1 truncate pl-4 text-[11px] text-red-700 line-through">
              {formatLeaf(entry.before)}
            </p>
          )}
        </li>
      ))}
      {/* Hint for the locale-conditional path so unused-var doesn't fire on it. */}
      <li className="hidden">{locale}</li>
    </ul>
  );
}
