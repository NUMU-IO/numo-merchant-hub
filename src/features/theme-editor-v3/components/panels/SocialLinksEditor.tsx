/**
 * SocialLinksEditor — store-level social links, edited inside the customizer.
 *
 * Why it lives here: footer/social icons render from `store.social_links`
 * (e.g. bon-younes `by-footer`), but there was no in-editor UI to set them —
 * a merchant had to leave for the legacy store settings, so footers shipped
 * with no social icons (director-reported "icons don't show"). This panel
 * writes `store.social_links` via `PATCH /stores/{id}` (store data, NOT theme
 * customization — so it never touches `store_themes` / needs no snapshot).
 *
 * The platform keys match the theme's social icon map (facebook / instagram /
 * twitter render brand glyphs; others fall back to a generic "send" glyph
 * until the theme adds them).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Share2, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useDashboardStore } from "@/contexts/StoreContext";
import { useCustomizerStore } from "../../store/customizerStore";
import { updateStore } from "@/services/storeApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EditorLocale } from "../../types";

interface PlatformDef {
  value: string;
  en: string;
  ar: string;
}

// Keep `value` keys lowercase + matching the theme social icon maps. The
// first three (facebook/instagram/twitter) currently render brand glyphs in
// bon-younes; the rest render a neutral fallback until a theme maps them.
const PLATFORMS: PlatformDef[] = [
  { value: "instagram", en: "Instagram", ar: "إنستجرام" },
  { value: "facebook", en: "Facebook", ar: "فيسبوك" },
  { value: "tiktok", en: "TikTok", ar: "تيك توك" },
  { value: "youtube", en: "YouTube", ar: "يوتيوب" },
  { value: "twitter", en: "X (Twitter)", ar: "إكس (تويتر)" },
  { value: "linkedin", en: "LinkedIn", ar: "لينكدإن" },
  { value: "whatsapp", en: "WhatsApp", ar: "واتساب" },
  { value: "telegram", en: "Telegram", ar: "تيليجرام" },
  { value: "snapchat", en: "Snapchat", ar: "سناب شات" },
  { value: "pinterest", en: "Pinterest", ar: "بينتريست" },
  { value: "website", en: "Website", ar: "الموقع الإلكتروني" },
];

interface Row {
  platform: string;
  url: string;
}

function rowsFromLinks(links: Record<string, string> | null | undefined): Row[] {
  if (!links) return [];
  return Object.entries(links)
    .filter(([, url]) => typeof url === "string")
    .map(([platform, url]) => ({ platform, url }));
}

/**
 * Light URL normalization so a scheme-less link still persists (and renders
 * its footer icon, #10): trims and prepends `https://` when the merchant
 * typed e.g. `instagram.com/foo` or `www.…`. Leaves mailto:/tel: + already-
 * schemed URLs alone; empty → "".
 */
function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^(https?:)?\/\//i.test(v) || /^(mailto|tel):/i.test(v)) return v;
  return `https://${v.replace(/^\/+/, "")}`;
}

function rowsEqual(a: Row[], b: Row[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (r, i) => r.platform === b[i].platform && r.url === b[i].url,
  );
}

export function SocialLinksEditor({ locale }: { locale: EditorLocale }) {
  const isAr = locale === "ar";
  const { currentStore, refetchStores } = useDashboardStore();
  // The customizer is always opened for a concrete store, so its storeId is
  // the reliable source of truth; fall back to the hub's selected store. A
  // transiently-null `currentStore` previously left Save permanently disabled
  // (the disabled guard includes `!storeId`).
  const customizerStoreId = useCustomizerStore((s) => s.storeId);
  const storeId = currentStore?.id ?? customizerStoreId ?? null;

  const initialRows = useMemo(
    () => rowsFromLinks(currentStore?.social_links),
    [currentStore?.social_links],
  );

  const [rows, setRows] = useState<Row[]>(initialRows);
  const [saving, setSaving] = useState(false);

  // Re-seed from the persisted links only when their CONTENT genuinely
  // changes (store switch, external/post-save update, or the initial
  // null→loaded transition) — NOT on every `currentStore` reference change.
  // A background store refetch produces a NEW social_links object with
  // IDENTICAL content; the old effect (`[initialRows]`) fired on that and
  // CLOBBERED the merchant's in-progress edits, resetting `rows` to the saved
  // state, which silently flipped `dirty` back to false and disabled Save
  // mid-edit (the "can't save when a link exists" bug). Comparing against the
  // last-seeded content preserves edits while still syncing real changes.
  const lastSeeded = useRef<Row[]>(initialRows);
  useEffect(() => {
    if (!rowsEqual(initialRows, lastSeeded.current)) {
      lastSeeded.current = initialRows;
      setRows(initialRows);
    }
  }, [initialRows]);

  const dirty = !rowsEqual(rows, initialRows);

  const addRow = () => {
    // Default to the first platform not already used (falls back to website).
    const used = new Set(rows.map((r) => r.platform));
    const next =
      PLATFORMS.find((p) => !used.has(p.value))?.value ?? "website";
    setRows((prev) => [...prev, { platform: next, url: "" }]);
  };

  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!storeId) return;
    // Build the map: last write wins on duplicate platforms; drop blank URLs.
    const links: Record<string, string> = {};
    for (const r of rows) {
      const url = normalizeUrl(r.url);
      if (r.platform && url) links[r.platform] = url;
    }
    setSaving(true);
    try {
      await updateStore(storeId, { social_links: links });
      // Sync local rows to exactly what persisted (blank rows dropped, URLs
      // normalized) so `dirty` settles to false after the save.
      setRows(rowsFromLinks(links));
      await refetchStores();
      toast.success(isAr ? "تم حفظ روابط التواصل" : "Social links saved");
    } catch {
      toast.error(
        isAr ? "تعذّر حفظ روابط التواصل" : "Couldn't save social links",
      );
    } finally {
      setSaving(false);
    }
  };

  const platformLabel = (p: PlatformDef) => (isAr ? p.ar : p.en);

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex items-center gap-2">
        <Share2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          {isAr ? "روابط التواصل الاجتماعي" : "Social links"}
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {isAr
          ? "تظهر هذه الروابط كأيقونات في تذييل المتجر."
          : "These appear as icons in your storefront footer."}
      </p>

      {rows.length === 0 && (
        <p className="py-2 text-xs text-muted-foreground">
          {isAr
            ? "لا توجد روابط بعد. أضف رابطاً للبدء."
            : "No links yet. Add one to get started."}
        </p>
      )}

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <Select
              value={row.platform}
              onValueChange={(v) => updateRow(index, { platform: v })}
            >
              <SelectTrigger className="w-36 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {platformLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={row.url}
              onChange={(e) => updateRow(index, { url: e.target.value })}
              placeholder="https://..."
              dir="ltr"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
              aria-label={isAr ? "حذف" : "Remove"}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={addRow}>
          <Plus className="h-4 w-4" />
          {isAr ? "إضافة رابط" : "Add link"}
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          disabled={!dirty || saving || !storeId}
          onClick={handleSave}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isAr ? "حفظ" : "Save"}
        </Button>
      </div>
    </div>
  );
}

export default SocialLinksEditor;
